// gorka-shared::sync_session
//
// Session establishment and message exchange over a TCP stream.
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
// key. SYNC_MESSAGE and SYNC_ACK travel over the same stream.
//
// Receive side, two forms:
//
//   recv_frame       blocking read, used during handshake
//   try_recv_frame   buffered non-blocking read, used by the engine
//
// try_recv_frame keeps a small buffer so a partial frame that
// arrives across a tick boundary is preserved, not discarded.
// The two forms must not be mixed on the same Session: once the
// engine takes over, it uses try_recv_frame exclusively.
//
// Nothing here is Tauri-specific. The stream is a TcpStream.

use std::io::Read;
use std::net::TcpStream;
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
use crate::sync_transport::{read_frame, write_frame, MAX_FRAME_VALUE_BYTES};

/// The MVP protocol version (SYNC-ARCHITECTURE.md Section 24.1).
pub const PROTOCOL_VERSION: u16 = 0x0001;

/// A live sync session between two peers.
pub struct Session {
    stream: TcpStream,
    session_key: [u8; 32],
    peer_device_id: Vec<u8>,
    read_buffer: Vec<u8>,
}

impl Session {
    /// Initiator side of the handshake.
    pub fn connect(
        stream: TcpStream,
        organization_id: &str,
        organization_key: &[u8; 32],
        device_id: &[u8],
    ) -> Result<Session, String> {
        let mut stream = stream;

        let mut initiator_nonce = [0u8; 24];
        rand::rngs::OsRng.fill_bytes(&mut initiator_nonce);

        let hello = HandshakeHello {
            protocol_version: PROTOCOL_VERSION,
            organization_id: organization_id.to_string(),
            device_id: device_id.to_vec(),
            nonce: initiator_nonce,
        };
        write_frame(&mut stream, &encode_handshake_hello(&hello))?;

        let reply_frame = read_frame(&mut stream)?;
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
        write_frame(
            &mut stream,
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

        let est_frame = read_frame(&mut stream)?;
        let _ = parse_session_established(&session_key, &est_frame)?;

        Ok(Session {
            stream,
            session_key,
            peer_device_id: reply.device_id,
            read_buffer: Vec::new(),
        })
    }

    /// Responder side of the handshake.
    pub fn accept(
        mut stream: TcpStream,
        organization_id: &str,
        organization_key: &[u8; 32],
        device_id: &[u8],
    ) -> Result<Session, String> {
        let hello_frame = read_frame(&mut stream)?;
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
        write_frame(&mut stream, &encode_handshake_reply(&reply))?;

        let confirm_frame = read_frame(&mut stream)?;
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
        write_frame(
            &mut stream,
            &encode_session_established(&session_key, &est_nonce, &est)?,
        )?;

        Ok(Session {
            stream,
            session_key,
            peer_device_id: hello.device_id,
            read_buffer: Vec::new(),
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

    /// Set the socket read timeout. Called once after the handshake,
    /// before entering the engine's tick loop. It is a receive-poll
    /// property of the stream, not a protocol value.
    pub fn set_read_timeout(&self, timeout: Option<Duration>) -> Result<(), String> {
        self.stream
            .set_read_timeout(timeout)
            .map_err(|e| format!("set read timeout: {}", e))
    }

    /// Send one framed message over the session.
    pub fn send_frame(&mut self, framed_bytes: &[u8]) -> Result<(), String> {
        write_frame(&mut self.stream, framed_bytes)
    }

    /// Blocking read of one framed message. Used during handshake
    /// and in tests. Do not mix with try_recv_frame after a read
    /// timeout has been set.
    pub fn recv_frame(&mut self) -> Result<Vec<u8>, String> {
        read_frame(&mut self.stream)
    }

    /// Non-blocking read of one framed message.
    ///
    /// Reads whatever bytes are available, appends them to an
    /// internal buffer, and tries to extract a complete frame. A
    /// partial frame that arrives across a tick boundary is kept in
    /// the buffer for the next call.
    ///
    /// Returns:
    ///   Ok(Some(frame))   a complete frame was available
    ///   Ok(None)          no complete frame yet; try again later
    ///   Err(...)          connection closed or a real I/O error
    ///
    /// The read timeout must already be set on the stream; otherwise
    /// this method blocks.
    pub fn try_recv_frame(&mut self) -> Result<Option<Vec<u8>>, String> {
        loop {
            // Try to parse a complete frame from the buffer.
            if self.read_buffer.len() >= 6 {
                let value_len = u32::from_be_bytes([
                    self.read_buffer[2],
                    self.read_buffer[3],
                    self.read_buffer[4],
                    self.read_buffer[5],
                ]) as usize;
                if value_len > MAX_FRAME_VALUE_BYTES {
                    return Err(format!(
                        "frame value too large: {} bytes (max {})",
                        value_len, MAX_FRAME_VALUE_BYTES
                    ));
                }
                let total = 6 + value_len;
                if self.read_buffer.len() >= total {
                    let frame = self.read_buffer[..total].to_vec();
                    self.read_buffer.drain(..total);
                    return Ok(Some(frame));
                }
            }

            // Need more bytes.
            let mut chunk = [0u8; 8192];
            match self.stream.read(&mut chunk) {
                Ok(0) => return Err("peer closed the connection".to_string()),
                Ok(n) => {
                    self.read_buffer.extend_from_slice(&chunk[..n]);
                    // Loop again to try parsing with the new bytes.
                }
                Err(e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    return Ok(None);
                }
                Err(e) => return Err(format!("read: {}", e)),
            }
        }
    }
}