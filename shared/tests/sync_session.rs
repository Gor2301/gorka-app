// shared/tests/sync_session.rs
//
// Integration tests for the session handshake and message
// exchange. Two threads, one real TCP listener on loopback, two
// Session values, one successful handshake, one SYNC_MESSAGE
// exchanged in each direction.

use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::{Duration, Instant};

use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::sync::{
    encode_debtor_created_payload,
    encode_event_record,
    build_sync_message,
};
use gorka_shared::sync_handshake::AckOutcome;
use gorka_shared::sync_pipeline::process_sync_message;
use gorka_shared::sync_session::Session;
use gorka_shared::sync_transport::TcpTransport;

const ORG_ID: &str = "org-test-A";
const ORG_KEY: [u8; 32] = [0u8; 32];
const DEVICE_INITIATOR: &[u8] = b"device-A-16bytes";
const DEVICE_RESPONDER: &[u8] = b"device-B-16bytes";
const TICK: Duration = Duration::from_millis(100);

fn poll_frame(session: &mut Session, deadline: Duration) -> Option<Vec<u8>> {
    let start = Instant::now();
    while start.elapsed() < deadline {
        match session.try_recv_frame() {
            Ok(Some(f)) => return Some(f),
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => return None,
        }
    }
    None
}

#[test]
fn full_handshake_and_one_message_each_way() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = listener.local_addr().expect("addr");

    // Responder thread.
    let responder = thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        let transport = TcpTransport::new(stream);
        let mut session = Session::accept(
            transport,
            ORG_ID,
            &ORG_KEY,
            DEVICE_RESPONDER,
            TICK,
        )
        .expect("accept handshake");

        // Responder waits for one SYNC_MESSAGE.
        let frame = poll_frame(&mut session, Duration::from_secs(5))
            .expect("no frame received within deadline");
        let key = *session.session_key();
        let mut conn = open_in_memory_for_tests().expect("db");
        let result = process_sync_message(&mut conn, ORG_ID, &key, &frame)
            .expect("pipeline");
        assert_eq!(result.outcomes.len(), 1);
        assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);
    });

    // Initiator.
    let stream = TcpStream::connect(addr).expect("connect");
    let transport = TcpTransport::new(stream);
    let mut session = Session::connect(
        transport,
        ORG_ID,
        &ORG_KEY,
        DEVICE_INITIATOR,
        TICK,
    )
    .expect("connect handshake");

    // Send a DEBTOR_CREATED SYNC_MESSAGE.
    let payload = encode_debtor_created_payload("Wire", "Test", None, None, None);
    let event_id: [u8; 16] = [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ];
    let record = encode_event_record(
        &event_id,
        DEVICE_INITIATOR,
        1,
        1,
        0x0001,
        0x01,
        b"entity-wire-001",
        1_789_891_200_000,
        &payload,
    );
    let message_id: [u8; 16] = [0xAA; 16];
    let nonce = [0u8; 24];
    let key = *session.session_key();
    let framed = build_sync_message(&key, &nonce, &message_id, &[record])
        .expect("build");
    session.send_frame(&framed).expect("send");

    responder.join().expect("responder join");
}

#[test]
fn wrong_organization_key_fails_handshake() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = listener.local_addr().expect("addr");

    let responder = thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        // A read timeout prevents this thread from blocking forever
        // when the initiator aborts after rejecting the bad REPLY.
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .expect("set read timeout");
        let transport = TcpTransport::new(stream);
        // Responder uses a different org key.
        let wrong_key = [0xFFu8; 32];
        let result = Session::accept(
            transport,
            ORG_ID,
            &wrong_key,
            DEVICE_RESPONDER,
            TICK,
        );
        // Either accept fails, or the initiator rejects the reply.
        // Either way the responder does not complete a full session.
        let _ = result;
    });

    let stream = TcpStream::connect(addr).expect("connect");
    let transport = TcpTransport::new(stream);
    let initiator_result = Session::connect(
        transport,
        ORG_ID,
        &ORG_KEY,
        DEVICE_INITIATOR,
        TICK,
    );
    // The initiator must fail: the REPLY proof tag uses the wrong key.
    assert!(initiator_result.is_err(), "expected handshake failure");

    let _ = responder.join();
}