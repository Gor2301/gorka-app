// gorka-shared::sync_handshake
//
// Handshake and session-control wire format.
//
// SYNC-ARCHITECTURE.md v1.4, Section 22.8 through 22.14. The six
// messages here are HANDSHAKE_HELLO, HANDSHAKE_REPLY,
// HANDSHAKE_CONFIRM, SESSION_ESTABLISHED, SESSION_END, and
// SYNC_ACK. SYNC_MESSAGE lives in gorka-shared::sync.
//
// Nothing here is Tauri-specific. Nothing here performs I/O or
// generates randomness. Every nonce, every session key is
// supplied by the caller.

use chacha20poly1305::{aead::{Aead, KeyInit, Payload}, XChaCha20Poly1305, XNonce};

use crate::sync::encode_tlv;

// ---------------------------------------------------------------
// Message type codes (Section 22.6)
// ---------------------------------------------------------------

pub const MSG_HANDSHAKE_HELLO: u16 = 0x0002;
pub const MSG_HANDSHAKE_REPLY: u16 = 0x0003;
pub const MSG_HANDSHAKE_CONFIRM: u16 = 0x0004;
pub const MSG_SESSION_ESTABLISHED: u16 = 0x0005;
pub const MSG_SESSION_END: u16 = 0x0006;
pub const MSG_SYNC_ACK: u16 = 0x0011;

// ---------------------------------------------------------------
// Outer framing
// ---------------------------------------------------------------

/// Build the 6-byte outer header for a message.
fn outer_header(type_code: u16, value_len: usize) -> [u8; 6] {
    let mut h = [0u8; 6];
    h[0..2].copy_from_slice(&type_code.to_be_bytes());
    h[2..6].copy_from_slice(&(value_len as u32).to_be_bytes());
    h
}

/// Read and validate the outer header of a message.
///
/// Returns (value_start, value_len). Value bytes are at
/// data[6..6+value_len].
fn read_outer_header(data: &[u8], expected_type: u16) -> Result<usize, String> {
    if data.len() < 6 {
        return Err("message too short for outer header".to_string());
    }
    let type_code = u16::from_be_bytes([data[0], data[1]]);
    if type_code != expected_type {
        return Err(format!(
            "unexpected message type 0x{:04x}, expected 0x{:04x}",
            type_code, expected_type
        ));
    }
    let value_len = u32::from_be_bytes([data[2], data[3], data[4], data[5]]) as usize;
    if data.len() != 6 + value_len {
        return Err("outer length does not match received bytes".to_string());
    }
    Ok(value_len)
}

// ---------------------------------------------------------------
// Sequential-layout field readers
// ---------------------------------------------------------------

struct SeqReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> SeqReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len() - self.pos
    }

    fn read_u16(&mut self) -> Result<u16, String> {
        if self.pos + 2 > self.data.len() {
            return Err("truncated u16".to_string());
        }
        let v = u16::from_be_bytes([self.data[self.pos], self.data[self.pos + 1]]);
        self.pos += 2;
        Ok(v)
    }

    fn read_u32(&mut self) -> Result<u32, String> {
        if self.pos + 4 > self.data.len() {
            return Err("truncated u32".to_string());
        }
        let v = u32::from_be_bytes([
            self.data[self.pos],
            self.data[self.pos + 1],
            self.data[self.pos + 2],
            self.data[self.pos + 3],
        ]);
        self.pos += 4;
        Ok(v)
    }

    fn read_u64(&mut self) -> Result<u64, String> {
        if self.pos + 8 > self.data.len() {
            return Err("truncated u64".to_string());
        }
        let mut b = [0u8; 8];
        b.copy_from_slice(&self.data[self.pos..self.pos + 8]);
        self.pos += 8;
        Ok(u64::from_be_bytes(b))
    }

    fn read_bytes(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.pos + n > self.data.len() {
            return Err("truncated byte sequence".to_string());
        }
        let v = &self.data[self.pos..self.pos + n];
        self.pos += n;
        Ok(v)
    }

    fn read_string(&mut self) -> Result<String, String> {
        let n = self.read_u32()? as usize;
        let bytes = self.read_bytes(n)?;
        std::str::from_utf8(bytes)
            .map_err(|_| "string field is not valid UTF-8".to_string())
            .map(|s| s.to_string())
    }

    fn read_len_prefixed_bytes(&mut self) -> Result<Vec<u8>, String> {
        let n = self.read_u32()? as usize;
        Ok(self.read_bytes(n)?.to_vec())
    }
}

// ---------------------------------------------------------------
// HANDSHAKE_HELLO (0x0002)
// ---------------------------------------------------------------

pub struct HandshakeHello {
    pub protocol_version: u16,
    pub organization_id: String,
    pub device_id: Vec<u8>,
    pub nonce: [u8; 24],
}

pub fn encode_handshake_hello(h: &HandshakeHello) -> Vec<u8> {
    let mut inner = Vec::new();
    inner.extend_from_slice(&h.protocol_version.to_be_bytes());
    let org = h.organization_id.as_bytes();
    inner.extend_from_slice(&(org.len() as u32).to_be_bytes());
    inner.extend_from_slice(org);
    inner.extend_from_slice(&(h.device_id.len() as u32).to_be_bytes());
    inner.extend_from_slice(&h.device_id);
    inner.extend_from_slice(&h.nonce);

    let mut out = Vec::with_capacity(6 + inner.len());
    out.extend_from_slice(&outer_header(MSG_HANDSHAKE_HELLO, inner.len()));
    out.extend_from_slice(&inner);
    out
}

pub fn parse_handshake_hello(data: &[u8]) -> Result<HandshakeHello, String> {
    let _ = read_outer_header(data, MSG_HANDSHAKE_HELLO)?;
    let mut r = SeqReader::new(&data[6..]);
    let protocol_version = r.read_u16()?;
    let organization_id = r.read_string()?;
    let device_id = r.read_len_prefixed_bytes()?;
    let nonce_bytes = r.read_bytes(24)?;
    let mut nonce = [0u8; 24];
    nonce.copy_from_slice(nonce_bytes);
    if r.remaining() != 0 {
        return Err("HANDSHAKE_HELLO: trailing bytes".to_string());
    }
    Ok(HandshakeHello {
        protocol_version,
        organization_id,
        device_id,
        nonce,
    })
}

// ---------------------------------------------------------------
// HANDSHAKE_REPLY (0x0003)
// ---------------------------------------------------------------

pub struct HandshakeReply {
    pub protocol_version: u16,
    pub organization_id: String,
    pub device_id: Vec<u8>,
    pub nonce: [u8; 24],
    pub proof_tag: [u8; 32],
}

pub fn encode_handshake_reply(h: &HandshakeReply) -> Vec<u8> {
    let mut inner = Vec::new();
    inner.extend_from_slice(&h.protocol_version.to_be_bytes());
    let org = h.organization_id.as_bytes();
    inner.extend_from_slice(&(org.len() as u32).to_be_bytes());
    inner.extend_from_slice(org);
    inner.extend_from_slice(&(h.device_id.len() as u32).to_be_bytes());
    inner.extend_from_slice(&h.device_id);
    inner.extend_from_slice(&h.nonce);
    inner.extend_from_slice(&h.proof_tag);

    let mut out = Vec::with_capacity(6 + inner.len());
    out.extend_from_slice(&outer_header(MSG_HANDSHAKE_REPLY, inner.len()));
    out.extend_from_slice(&inner);
    out
}

pub fn parse_handshake_reply(data: &[u8]) -> Result<HandshakeReply, String> {
    let _ = read_outer_header(data, MSG_HANDSHAKE_REPLY)?;
    let mut r = SeqReader::new(&data[6..]);
    let protocol_version = r.read_u16()?;
    let organization_id = r.read_string()?;
    let device_id = r.read_len_prefixed_bytes()?;
    let nonce_bytes = r.read_bytes(24)?;
    let mut nonce = [0u8; 24];
    nonce.copy_from_slice(nonce_bytes);
    let tag_bytes = r.read_bytes(32)?;
    let mut proof_tag = [0u8; 32];
    proof_tag.copy_from_slice(tag_bytes);
    if r.remaining() != 0 {
        return Err("HANDSHAKE_REPLY: trailing bytes".to_string());
    }
    Ok(HandshakeReply {
        protocol_version,
        organization_id,
        device_id,
        nonce,
        proof_tag,
    })
}

// ---------------------------------------------------------------
// HANDSHAKE_CONFIRM (0x0004)
// ---------------------------------------------------------------

pub struct HandshakeConfirm {
    pub proof_tag: [u8; 32],
}

pub fn encode_handshake_confirm(h: &HandshakeConfirm) -> Vec<u8> {
    let mut out = Vec::with_capacity(6 + 32);
    out.extend_from_slice(&outer_header(MSG_HANDSHAKE_CONFIRM, 32));
    out.extend_from_slice(&h.proof_tag);
    out
}

pub fn parse_handshake_confirm(data: &[u8]) -> Result<HandshakeConfirm, String> {
    let _ = read_outer_header(data, MSG_HANDSHAKE_CONFIRM)?;
    if data.len() != 6 + 32 {
        return Err("HANDSHAKE_CONFIRM: expected exactly 32 bytes of value".to_string());
    }
    let mut proof_tag = [0u8; 32];
    proof_tag.copy_from_slice(&data[6..38]);
    Ok(HandshakeConfirm { proof_tag })
}

// ---------------------------------------------------------------
// Encrypted-message helper
// ---------------------------------------------------------------

/// Encrypt an inner plaintext with the session key and wrap it in
/// an outer TLV record. The AAD is the 6-byte outer header.
fn encrypt_envelope(
    type_code: u16,
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    inner: &[u8],
) -> Result<Vec<u8>, String> {
    // outer_length = 24 nonce + inner + 16 tag
    let outer_length = 24 + inner.len() + 16;
    let header = outer_header(type_code, outer_length);

    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let ciphertext = cipher
        .encrypt(
            xnonce,
            Payload {
                msg: inner,
                aad: &header,
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut out = Vec::with_capacity(6 + 24 + ciphertext.len());
    out.extend_from_slice(&header);
    out.extend_from_slice(nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt an encrypted envelope, verify the outer header, and
/// return the inner plaintext.
fn decrypt_envelope(
    expected_type: u16,
    session_key: &[u8; 32],
    data: &[u8],
) -> Result<Vec<u8>, String> {
    let _ = read_outer_header(data, expected_type)?;
    if data.len() < 6 + 24 + 16 {
        return Err("encrypted envelope too short".to_string());
    }
    let header = &data[0..6];
    let nonce = &data[6..30];
    let ciphertext = &data[30..];

    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    cipher
        .decrypt(
            xnonce,
            Payload {
                msg: ciphertext,
                aad: header,
            },
        )
        .map_err(|_| "decryption failed".to_string())
}

// ---------------------------------------------------------------
// SESSION_ESTABLISHED (0x0005)
// ---------------------------------------------------------------

pub struct SessionEstablished {
    pub origin_sequence_hint: u64,
}

pub fn encode_session_established(
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    msg: &SessionEstablished,
) -> Result<Vec<u8>, String> {
    let inner = msg.origin_sequence_hint.to_be_bytes();
    encrypt_envelope(MSG_SESSION_ESTABLISHED, session_key, nonce, &inner)
}

pub fn parse_session_established(
    session_key: &[u8; 32],
    framed: &[u8],
) -> Result<SessionEstablished, String> {
    let plaintext = decrypt_envelope(MSG_SESSION_ESTABLISHED, session_key, framed)?;
    if plaintext.len() != 8 {
        return Err("SESSION_ESTABLISHED: inner content must be 8 bytes".to_string());
    }
    let mut b = [0u8; 8];
    b.copy_from_slice(&plaintext);
    Ok(SessionEstablished {
        origin_sequence_hint: u64::from_be_bytes(b),
    })
}

// ---------------------------------------------------------------
// SESSION_END (0x0006)
// ---------------------------------------------------------------

pub const CLOSE_NORMAL: u16 = 0x0000;
pub const CLOSE_TIMEOUT: u16 = 0x0001;
pub const CLOSE_SHUTDOWN: u16 = 0x0002;
pub const CLOSE_RESTART: u16 = 0x0003;
pub const CLOSE_ERROR: u16 = 0x0004;

pub struct SessionEnd {
    pub close_reason: u16,
}

pub fn encode_session_end(
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    msg: &SessionEnd,
) -> Result<Vec<u8>, String> {
    let inner = msg.close_reason.to_be_bytes();
    encrypt_envelope(MSG_SESSION_END, session_key, nonce, &inner)
}

pub fn parse_session_end(
    session_key: &[u8; 32],
    framed: &[u8],
) -> Result<SessionEnd, String> {
    let plaintext = decrypt_envelope(MSG_SESSION_END, session_key, framed)?;
    if plaintext.len() != 2 {
        return Err("SESSION_END: inner content must be 2 bytes".to_string());
    }
    Ok(SessionEnd {
        close_reason: u16::from_be_bytes([plaintext[0], plaintext[1]]),
    })
}

// ---------------------------------------------------------------
// SYNC_ACK (0x0011)
// ---------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AckOutcome {
    Accepted,
    Duplicate,
    Rejected,
}

impl AckOutcome {
    fn as_u8(self) -> u8 {
        match self {
            AckOutcome::Accepted => 0x00,
            AckOutcome::Duplicate => 0x01,
            AckOutcome::Rejected => 0x02,
        }
    }
    fn from_u8(v: u8) -> Result<Self, String> {
        match v {
            0x00 => Ok(AckOutcome::Accepted),
            0x01 => Ok(AckOutcome::Duplicate),
            0x02 => Ok(AckOutcome::Rejected),
            _ => Err(format!("unknown ACK outcome 0x{:02x}", v)),
        }
    }
}

pub struct SyncAckOutcome {
    pub event_id: [u8; 16],
    pub outcome: AckOutcome,
}

pub struct SyncAck {
    pub acknowledged_message_id: [u8; 16],
    pub outcomes: Vec<SyncAckOutcome>,
}

pub fn encode_sync_ack(
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    ack: &SyncAck,
) -> Result<Vec<u8>, String> {
    let mut inner = Vec::new();
    inner.extend_from_slice(&encode_tlv(0x1201, &ack.acknowledged_message_id));
    inner.extend_from_slice(&encode_tlv(0x1202, &(ack.outcomes.len() as u32).to_be_bytes()));
    for o in &ack.outcomes {
        let mut record = Vec::with_capacity(6 + 16 + 6 + 1);
        record.extend_from_slice(&encode_tlv(0x1211, &o.event_id));
        record.extend_from_slice(&encode_tlv(0x1212, &[o.outcome.as_u8()]));
        inner.extend_from_slice(&encode_tlv(0x1203, &record));
    }
    encrypt_envelope(MSG_SYNC_ACK, session_key, nonce, &inner)
}

pub fn parse_sync_ack(
    session_key: &[u8; 32],
    framed: &[u8],
) -> Result<SyncAck, String> {
    let plaintext = decrypt_envelope(MSG_SYNC_ACK, session_key, framed)?;
    let mut pos = 0;
    let mut acknowledged_message_id: Option<[u8; 16]> = None;
    let mut outcome_count: Option<u32> = None;
    let mut outcomes: Vec<SyncAckOutcome> = Vec::new();

    while pos < plaintext.len() {
        if pos + 6 > plaintext.len() {
            return Err("SYNC_ACK: truncated TLV header".to_string());
        }
        let code = u16::from_be_bytes([plaintext[pos], plaintext[pos + 1]]);
        let len = u32::from_be_bytes([
            plaintext[pos + 2],
            plaintext[pos + 3],
            plaintext[pos + 4],
            plaintext[pos + 5],
        ]) as usize;
        let vstart = pos + 6;
        if vstart + len > plaintext.len() {
            return Err("SYNC_ACK: truncated TLV value".to_string());
        }
        let value = &plaintext[vstart..vstart + len];
        pos = vstart + len;

        match code {
            0x1201 => {
                if acknowledged_message_id.is_some() {
                    return Err("SYNC_ACK: duplicate acknowledged_message_id".to_string());
                }
                if value.len() != 16 {
                    return Err("SYNC_ACK: acknowledged_message_id must be 16 bytes".to_string());
                }
                let mut b = [0u8; 16];
                b.copy_from_slice(value);
                acknowledged_message_id = Some(b);
            }
            0x1202 => {
                if outcome_count.is_some() {
                    return Err("SYNC_ACK: duplicate outcome_count".to_string());
                }
                if value.len() != 4 {
                    return Err("SYNC_ACK: outcome_count must be u32".to_string());
                }
                outcome_count = Some(u32::from_be_bytes([
                    value[0], value[1], value[2], value[3],
                ]));
            }
            0x1203 => {
                outcomes.push(parse_ack_outcome_record(value)?);
            }
            _ => return Err(format!("SYNC_ACK: unknown field type 0x{:04x}", code)),
        }
    }

    let acknowledged_message_id =
        acknowledged_message_id.ok_or("SYNC_ACK: missing acknowledged_message_id")?;
    let outcome_count = outcome_count.ok_or("SYNC_ACK: missing outcome_count")?;
    if outcome_count as usize != outcomes.len() {
        return Err(format!(
            "SYNC_ACK: outcome_count {} does not match {} outcome records",
            outcome_count,
            outcomes.len()
        ));
    }

    Ok(SyncAck {
        acknowledged_message_id,
        outcomes,
    })
}

fn parse_ack_outcome_record(data: &[u8]) -> Result<SyncAckOutcome, String> {
    let mut pos = 0;
    let mut event_id: Option<[u8; 16]> = None;
    let mut outcome: Option<AckOutcome> = None;

    while pos < data.len() {
        if pos + 6 > data.len() {
            return Err("SYNC_ACK outcome: truncated TLV header".to_string());
        }
        let code = u16::from_be_bytes([data[pos], data[pos + 1]]);
        let len = u32::from_be_bytes([
            data[pos + 2], data[pos + 3], data[pos + 4], data[pos + 5],
        ]) as usize;
        let vstart = pos + 6;
        if vstart + len > data.len() {
            return Err("SYNC_ACK outcome: truncated TLV value".to_string());
        }
        let value = &data[vstart..vstart + len];
        pos = vstart + len;

        match code {
            0x1211 => {
                if event_id.is_some() {
                    return Err("SYNC_ACK outcome: duplicate event_id".to_string());
                }
                if value.len() != 16 {
                    return Err("SYNC_ACK outcome: event_id must be 16 bytes".to_string());
                }
                let mut b = [0u8; 16];
                b.copy_from_slice(value);
                event_id = Some(b);
            }
            0x1212 => {
                if outcome.is_some() {
                    return Err("SYNC_ACK outcome: duplicate outcome".to_string());
                }
                if value.len() != 1 {
                    return Err("SYNC_ACK outcome: outcome must be u8".to_string());
                }
                outcome = Some(AckOutcome::from_u8(value[0])?);
            }
            _ => return Err(format!("SYNC_ACK outcome: unknown field 0x{:04x}", code)),
        }
    }

    Ok(SyncAckOutcome {
        event_id: event_id.ok_or("SYNC_ACK outcome: missing event_id")?,
        outcome: outcome.ok_or("SYNC_ACK outcome: missing outcome")?,
    })
}