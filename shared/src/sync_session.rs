// gorka-shared::sync_session
//
// Session establishment and message exchange.
//
// SYNC-ARCHITECTURE.md v1.4, Section 8 and Section 22.8 through
// 22.11. The handshake is four messages:
//
//   Initiator                          Responder
//   ---------                          ---------
//   HANDSHAKE_HELLO          -------->
//                            <-------- HANDSHAKE_REPLY
//   HANDSHAKE_CONFIRM        -------->
//                            <-------- SESSION_ESTABLISHED
//
// After SESSION_ESTABLISHED, both peers hold the same session
// key. SYNC_MESSAGE and SYNC_ACK travel over the same transport.
//
// Two transports are supported, both implementing
// SessionTransport and HandshakeTransport from sync_transport:
//   TcpTransport    direct TCP
//   RelayTransport  WebSocket via the Control Plane relay
//                   (in sync_relay.rs)
//
// Nothing here is Tauri-specific.

use std::time::Duration;

use rand::RngCore;

use crate::sync::{
    derive_handshake_key, derive_session_key,
    compute_handshake_reply_tag, compute_handshake_confirm_tag,
};
use crate::sync_handshake::{
    HandshakeHello, HandshakeReply, HandshakeConfirm, SessionEstablished,
    encode_handshake_hello, parse_handshake_hello,
    encode_handshake_reply, parse_handshake_reply,
    encode_handshake_confirm, parse_handshake_confirm,
    encode_session_established, parse_session_established,
};
use crate::sync_transport::{HandshakeTransport, SessionTransport};

/// The MVP protocol version (SYNC-ARCHITECTURE.md Section 24.1).
pub const PROTOCOL_VERSION: u16 = 0x0001;

/// A live sync session between two peers.
pub struct Session {
    transport: Box<dyn SessionTransport>,
    session_key: [u8; 32],
    peer_device_id: Vec<u8>,
}

impl Session {
    /// Initiator side of the handshake.
    ///
    /// After the handshake, the transport is switched to tick-loop
    /// mode with the given tick interval. That is a mode
    /// transition, not a protocol value.
    pub fn connect<T>(
        transport: T,
        organization_id: &str,
        organization_key: &[u8; 32],
        device_id: &[u8],
        tick: Duration,
    ) -> Result<Session, String>
    where
        T: SessionTransport + HandshakeTransport + 'static,
    {
        let mut transport = transport;

        let mut initiator_nonce = [0u8; 24];
        rand::rngs::OsRng.fill_bytes(&mut initiator_nonce);

        let hello = HandshakeHello {
            protocol_version: PROTOCOL_VERSION,
            organization_id: organization_id.to_string(),
            device_id: device_id.to_vec(),
            nonce: initiator_nonce,
        };
        transport.send_blocking(&encode_handshake_hello(&hello))?;

        let reply_frame = transport.recv_blocking()?;
        let reply = parse_handshake_reply(&reply_frame)?;

        if reply.protocol_version != PROTOCOL_VERSION {
            return Err(format!(
                "peer protocol version mismatch: 0x{:04x}",
                reply.protocol_version
            ));
        }
        if reply.organization_id != organization_id {
            return Err("peer organization mismatch".to_string());
        }

        let handshake_key = derive_handshake_key(organization_key)?;
        let expected_reply_tag = compute_handshake_reply_tag(
            &handshake_key,
            PROTOCOL_VERSION,
            organization_id,
            device_id,
            &initiator_nonce,
            &reply.organization_id,
            &reply.device_id,
            &reply.nonce,
        )?;
        if expected_reply_tag != reply.proof_tag {
            return Err("REPLY proof tag mismatch".to_string());
        }

        let confirm_tag = compute_handshake_confirm_tag(
            &handshake_key,
            PROTOCOL_VERSION,
            organization_id,
            device_id,
            &initiator_nonce,
            &reply.organization_id,
            &reply.device_id,
            &reply.nonce,
        )?;
        transport.send_blocking(
            &encode_handshake_confirm(&HandshakeConfirm { proof_tag: confirm_tag }),
        )?;

        let session_key = derive_session_key(
            organization_key,
            &initiator_nonce,
            &reply.nonce,
            organization_id,
            device_id,
            &reply.device_id,
        )?;

        let est_frame = transport.recv_blocking()?;
        let _ = parse_session_established(&session_key, &est_frame)?;

        transport.enter_tick_loop(tick)?;

        Ok(Session {
            transport: Box::new(transport),
            session_key,
            peer_device_id: reply.device_id,
        })
    }

    /// Responder side of the handshake.
    pub fn accept<T>(
        transport: T,
        organization_id: &str,
        organization_key: &[u8; 32],
        device_id: &[u8],
        tick: Duration,
    ) -> Result<Session, String>
    where
        T: SessionTransport + HandshakeTransport + 'static,
    {
        let mut transport = transport;

        let hello_frame = transport.recv_blocking()?;
        let hello = parse_handshake_hello(&hello_frame)?;

        if hello.protocol_version != PROTOCOL_VERSION {
            return Err(format!(
                "peer protocol version mismatch: 0x{:04x}",
                hello.protocol_version
            ));
        }
        if hello.organization_id != organization_id {
            return Err("peer organization mismatch".to_string());
        }

        let mut responder_nonce = [0u8; 24];
        rand::rngs::OsRng.fill_bytes(&mut responder_nonce);

        let handshake_key = derive_handshake_key(organization_key)?;
        let reply_tag = compute_handshake_reply_tag(
            &handshake_key,
            PROTOCOL_VERSION,
            &hello.organization_id,
            &hello.device_id,
            &hello.nonce,
            organization_id,
            device_id,
            &responder_nonce,
        )?;

        let reply = HandshakeReply {
            protocol_version: PROTOCOL_VERSION,
            organization_id: organization_id.to_string(),
            device_id: device_id.to_vec(),
            nonce: responder_nonce,
            proof_tag: reply_tag,
        };
        transport.send_blocking(&encode_handshake_reply(&reply))?;

        let confirm_frame = transport.recv_blocking()?;
        let confirm = parse_handshake_confirm(&confirm_frame)?;

        let expected_confirm_tag = compute_handshake_confirm_tag(
            &handshake_key,
            PROTOCOL_VERSION,
            &hello.organization_id,
            &hello.device_id,
            &hello.nonce,
            organization_id,
            device_id,
            &responder_nonce,
        )?;
        if expected_confirm_tag != confirm.proof_tag {
            return Err("CONFIRM proof tag mismatch".to_string());
        }

        let session_key = derive_session_key(
            organization_key,
            &hello.nonce,
            &responder_nonce,
            organization_id,
            &hello.device_id,
            device_id,
        )?;

        let est = SessionEstablished { origin_sequence_hint: 0 };
        let mut est_nonce = [0u8; 24];
        rand::rngs::OsRng.fill_bytes(&mut est_nonce);
        transport.send_blocking(
            &encode_session_established(&session_key, &est_nonce, &est)?,
        )?;

        transport.enter_tick_loop(tick)?;

        Ok(Session {
            transport: Box::new(transport),
            session_key,
            peer_device_id: hello.device_id,
        })
    }

    /// The session key. Both peers hold the same value after a
    /// successful handshake.
    pub fn session_key(&self) -> &[u8; 32] {
        &self.session_key
    }

    /// The peer's device_id, as claimed in its HANDSHAKE_HELLO or
    /// HANDSHAKE_REPLY. Set during the handshake.
    pub fn peer_device_id(&self) -> &[u8] {
        &self.peer_device_id
    }

    /// Send one framed message over the session.
    pub fn send_frame(&mut self, framed_bytes: &[u8]) -> Result<(), String> {
        self.transport.send_frame(framed_bytes)
    }

    /// Non-blocking read of one framed message. Delegates to the
    /// transport. Returns Ok(None) if no complete frame is
    /// available yet.
    pub fn try_recv_frame(&mut self) -> Result<Option<Vec<u8>>, String> {
        self.transport.try_recv_frame()
    }
}