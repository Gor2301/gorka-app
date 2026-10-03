// shared/tests/sync_wire_roundtrip.rs
//
// Round-trip tests for the wire-format parsers.
//
// Each test encodes a message or payload with the existing
// gorka_shared::sync or gorka_shared::sync_handshake encoders,
// then parses it back with the gorka_shared::sync_parse or
// gorka_shared::sync_handshake parsers, and asserts that the
// values survive byte-for-byte.

use gorka_shared::sync::{
    encode_debtor_created_payload,
    encode_entity_updated_payload,
    encode_action_created_payload,
    encode_communication_logged_payload,
    encode_event_record,
    build_sync_message,
    parse_sync_message,
};

use gorka_shared::sync_parse::{
    parse_debtor_created_payload,
    parse_entity_updated_payload,
    parse_action_created_payload,
    parse_communication_logged_payload,
    parse_event_record,
    parse_sync_message_inner,
};

use gorka_shared::sync_handshake::{
    encode_handshake_hello, parse_handshake_hello,
    encode_handshake_reply, parse_handshake_reply,
    encode_handshake_confirm, parse_handshake_confirm,
    encode_session_established, parse_session_established,
    encode_session_end, parse_session_end,
    encode_sync_ack, parse_sync_ack,
    HandshakeHello, HandshakeReply, HandshakeConfirm,
    SessionEstablished, SessionEnd,
    SyncAck, SyncAckOutcome, AckOutcome,
    CLOSE_NORMAL,
};

#[test]
fn debtor_created_round_trip() {
    let bytes = encode_debtor_created_payload(
        "Test",
        "Debtor",
        Some("t@example.invalid"),
        Some("+63-900-000-0001"),
        Some("{\"note\":\"hi\"}"),
    );
    let p = parse_debtor_created_payload(&bytes).expect("parse failed");
    assert_eq!(p.name, "Test");
    assert_eq!(p.surname, "Debtor");
    assert_eq!(p.email.as_deref(), Some("t@example.invalid"));
    assert_eq!(p.phone.as_deref(), Some("+63-900-000-0001"));
    assert_eq!(p.data_json.as_deref(), Some("{\"note\":\"hi\"}"));
}

#[test]
fn debtor_created_minimal_round_trip() {
    let bytes = encode_debtor_created_payload("A", "B", None, None, None);
    let p = parse_debtor_created_payload(&bytes).expect("parse failed");
    assert_eq!(p.name, "A");
    assert_eq!(p.surname, "B");
    assert_eq!(p.email, None);
    assert_eq!(p.phone, None);
    assert_eq!(p.data_json, None);
}

#[test]
fn entity_updated_round_trip() {
    let bytes = encode_entity_updated_payload(&[
        ("deleted", Some("false")),
        ("data_json", Some("{}")),
    ]);
    let p = parse_entity_updated_payload(&bytes).expect("parse failed");
    assert_eq!(p.changes.len(), 2);
    // Encoder sorts lexicographically: data_json then deleted.
    assert_eq!(p.changes[0].field_name, "data_json");
    assert_eq!(p.changes[0].field_value.as_deref(), Some("{}"));
    assert_eq!(p.changes[1].field_name, "deleted");
    assert_eq!(p.changes[1].field_value.as_deref(), Some("false"));
}

#[test]
fn entity_updated_null_field_round_trip() {
    // A null field value: TLV value of zero bytes.
    let bytes = encode_entity_updated_payload(&[("email", None)]);
    let p = parse_entity_updated_payload(&bytes).expect("parse failed");
    assert_eq!(p.changes.len(), 1);
    assert_eq!(p.changes[0].field_name, "email");
    assert_eq!(p.changes[0].field_value, None);
}

#[test]
fn entity_updated_empty_string_round_trip() {
    // An empty string value: length prefix 0, distinct from null.
    let bytes = encode_entity_updated_payload(&[("email", Some(""))]);
    let p = parse_entity_updated_payload(&bytes).expect("parse failed");
    assert_eq!(p.changes.len(), 1);
    assert_eq!(p.changes[0].field_name, "email");
    assert_eq!(p.changes[0].field_value.as_deref(), Some(""));
}

#[test]
fn action_created_round_trip() {
    let bytes = encode_action_created_payload(
        "entity-test-001",
        "CALL",
        "PENDING",
        Some("agent-A"),
        Some("2026-09-20"),
        Some("call tomorrow"),
        "{}",
    );
    let p = parse_action_created_payload(&bytes).expect("parse failed");
    assert_eq!(p.debtor_id, "entity-test-001");
    assert_eq!(p.action_type, "CALL");
    assert_eq!(p.status, "PENDING");
    assert_eq!(p.assigned_to.as_deref(), Some("agent-A"));
    assert_eq!(p.due_date.as_deref(), Some("2026-09-20"));
    assert_eq!(p.description.as_deref(), Some("call tomorrow"));
    assert_eq!(p.data_json.as_deref(), Some("{}"));
}

#[test]
fn communication_logged_round_trip() {
    let bytes = encode_communication_logged_payload(
        "entity-test-001",
        "CALL",
        "OUTBOUND",
        "Test call",
        Some("120"),
    );
    let p = parse_communication_logged_payload(&bytes).expect("parse failed");
    assert_eq!(p.debtor_id, "entity-test-001");
    assert_eq!(p.communication_type, "CALL");
    assert_eq!(p.direction, "OUTBOUND");
    assert_eq!(p.content, "Test call");
    assert_eq!(p.duration.as_deref(), Some("120"));
}

#[test]
fn event_record_round_trip() {
    let event_id: [u8; 16] = [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ];
    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);
    let record_bytes = encode_event_record(
        &event_id,
        b"device-test-A",
        1,
        1,
        0x0001,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &payload,
    );
    let r = parse_event_record(&record_bytes).expect("parse failed");
    assert_eq!(r.event_id, event_id);
    assert_eq!(r.device_id, b"device-test-A");
    assert_eq!(r.sequence, 1);
    assert_eq!(r.logical_clock, 1);
    assert_eq!(r.event_type, 0x0001);
    assert_eq!(r.entity_type, 0x01);
    assert_eq!(r.entity_id, b"entity-test-001");
    assert_eq!(r.created_at_ms, 1_789_891_200_000);
    assert_eq!(r.payload, payload);
}

#[test]
fn sync_message_inner_round_trip() {
    let session_key = [0u8; 32];
    let nonce = [0u8; 24];
    let message_id: [u8; 16] = [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ];
    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);
    let record = encode_event_record(
        &message_id,
        b"device-test-A",
        1,
        1,
        0x0001,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&session_key, &nonce, &message_id, &[record])
        .expect("build failed");
    let inner = parse_sync_message(&session_key, &framed).expect("decrypt failed");
    let parsed = parse_sync_message_inner(&inner).expect("inner parse failed");
    assert_eq!(parsed.message_id, message_id);
    assert_eq!(parsed.events.len(), 1);
    assert_eq!(parsed.events[0].sequence, 1);
    assert_eq!(parsed.events[0].entity_id, b"entity-test-001");
}

#[test]
fn handshake_hello_round_trip() {
    let h = HandshakeHello {
        protocol_version: 0x0001,
        organization_id: "org-test-A".to_string(),
        device_id: b"device-test-A".to_vec(),
        nonce: [0u8; 24],
    };
    let bytes = encode_handshake_hello(&h);
    let p = parse_handshake_hello(&bytes).expect("parse failed");
    assert_eq!(p.protocol_version, 0x0001);
    assert_eq!(p.organization_id, "org-test-A");
    assert_eq!(p.device_id, b"device-test-A");
    assert_eq!(p.nonce, [0u8; 24]);
}

#[test]
fn handshake_reply_round_trip() {
    let h = HandshakeReply {
        protocol_version: 0x0001,
        organization_id: "org-test-B".to_string(),
        device_id: b"device-test-B".to_vec(),
        nonce: [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        ],
        proof_tag: [0xAB; 32],
    };
    let bytes = encode_handshake_reply(&h);
    let p = parse_handshake_reply(&bytes).expect("parse failed");
    assert_eq!(p.protocol_version, 0x0001);
    assert_eq!(p.organization_id, "org-test-B");
    assert_eq!(p.device_id, b"device-test-B");
    assert_eq!(p.nonce, h.nonce);
    assert_eq!(p.proof_tag, [0xAB; 32]);
}

#[test]
fn handshake_confirm_round_trip() {
    let h = HandshakeConfirm { proof_tag: [0xCD; 32] };
    let bytes = encode_handshake_confirm(&h);
    let p = parse_handshake_confirm(&bytes).expect("parse failed");
    assert_eq!(p.proof_tag, [0xCD; 32]);
}

#[test]
fn session_established_round_trip() {
    let session_key = [0x11u8; 32];
    let nonce = [0x22u8; 24];
    let msg = SessionEstablished {
        origin_sequence_hint: 42,
    };
    let framed = encode_session_established(&session_key, &nonce, &msg)
        .expect("encode failed");
    let p = parse_session_established(&session_key, &framed).expect("parse failed");
    assert_eq!(p.origin_sequence_hint, 42);
}

#[test]
fn session_end_round_trip() {
    let session_key = [0x33u8; 32];
    let nonce = [0x44u8; 24];
    let msg = SessionEnd {
        close_reason: CLOSE_NORMAL,
    };
    let framed = encode_session_end(&session_key, &nonce, &msg).expect("encode failed");
    let p = parse_session_end(&session_key, &framed).expect("parse failed");
    assert_eq!(p.close_reason, CLOSE_NORMAL);
}

#[test]
fn sync_ack_round_trip() {
    let session_key = [0x55u8; 32];
    let nonce = [0x66u8; 24];
    let message_id: [u8; 16] = [0xAA; 16];
    let event_id_1: [u8; 16] = [0x01; 16];
    let event_id_2: [u8; 16] = [0x02; 16];
    let ack = SyncAck {
        acknowledged_message_id: message_id,
        outcomes: vec![
            SyncAckOutcome {
                event_id: event_id_1,
                outcome: AckOutcome::Accepted,
            },
            SyncAckOutcome {
                event_id: event_id_2,
                outcome: AckOutcome::Duplicate,
            },
        ],
    };
    let framed = encode_sync_ack(&session_key, &nonce, &ack).expect("encode failed");
    let p = parse_sync_ack(&session_key, &framed).expect("parse failed");
    assert_eq!(p.acknowledged_message_id, message_id);
    assert_eq!(p.outcomes.len(), 2);
    assert_eq!(p.outcomes[0].event_id, event_id_1);
    assert_eq!(p.outcomes[0].outcome, AckOutcome::Accepted);
    assert_eq!(p.outcomes[1].event_id, event_id_2);
    assert_eq!(p.outcomes[1].outcome, AckOutcome::Duplicate);
}