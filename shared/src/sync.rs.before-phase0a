// gorka-shared::sync
//
// Wire-format and handshake primitives for the GORKA sync protocol.
//
// These are the pure protocol primitives defined in
// SYNC-ARCHITECTURE.md: the session-key derivation (H1), the
// handshake proof tags (H2, H3), the TLV encoder, the event
// payload encoders (V1, V4, V6), and the SYNC_MESSAGE framing
// (M1, M2).
//
// Nothing here is Tauri-specific. Nothing here performs I/O or
// generates randomness. Every input is supplied by the caller.
//
// Phase 9.6 (the sync engine) will consume these primitives.
//
// Device identity: the wire device_id is exactly 16 raw bytes
// (Section 25.6.6). It is passed as &[u8] here, never as &str.

use chacha20poly1305::{aead::{Aead, KeyInit, Payload}, XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::Sha256;

/// Derive the handshake authentication key (Section 8.5).
///
///   handshake_key = HKDF-SHA256(
///       IKM  = organization_key,
///       salt = empty,
///       info = "GORKA-MVP-HANDSHAKE-v1",
///       output_length = 32
///   )
pub fn derive_handshake_key(organization_key: &[u8; 32]) -> Result<[u8; 32], String> {
    let hk = Hkdf::<Sha256>::new(None, organization_key);
    let mut out = [0u8; 32];
    hk.expand(b"GORKA-MVP-HANDSHAKE-v1", &mut out)
        .map_err(|e| format!("HKDF expand failed: {}", e))?;
    Ok(out)
}

/// Derive the session key for a sync session.
///
/// This is the H1 operation. It is the shared session-key
/// derivation used by the handshake. It performs no I/O and
/// generates no randomness: every input is supplied by the
/// caller.
///
/// Per Section 22.11.1 and Section 22.19.1:
///   session_key = HKDF-SHA256(
///       IKM  = organization_key,
///       salt = initiator_nonce || responder_nonce,
///       info = "GORKA-MVP-SESSION-v1"
///              || u16_be(len(organization_id))
///              || organization_id
///              || u16_be(len(initiator_device_id))
///              || initiator_device_id
///              || u16_be(len(responder_device_id))
///              || responder_device_id,
///       output_length = 32
///   )
///
/// The device ids are raw bytes; the length prefix is the byte
/// count.
pub fn derive_session_key(
    organization_key: &[u8; 32],
    initiator_nonce: &[u8; 24],
    responder_nonce: &[u8; 24],
    organization_id: &str,
    initiator_device_id: &[u8],
    responder_device_id: &[u8],
) -> Result<[u8; 32], String> {
    // salt = initiator_nonce || responder_nonce, 48 bytes.
    let mut salt = [0u8; 48];
    salt[0..24].copy_from_slice(initiator_nonce);
    salt[24..48].copy_from_slice(responder_nonce);

    // info = "GORKA-MVP-SESSION-v1"
    //        || u16_be(len(organization_id)) || organization_id
    //        || u16_be(len(initiator_device_id)) || initiator_device_id
    //        || u16_be(len(responder_device_id)) || responder_device_id
    let mut info = Vec::new();
    info.extend_from_slice(b"GORKA-MVP-SESSION-v1");
    let org_id_bytes = organization_id.as_bytes();
    info.extend_from_slice(&(org_id_bytes.len() as u16).to_be_bytes());
    info.extend_from_slice(org_id_bytes);
    info.extend_from_slice(&(initiator_device_id.len() as u16).to_be_bytes());
    info.extend_from_slice(initiator_device_id);
    info.extend_from_slice(&(responder_device_id.len() as u16).to_be_bytes());
    info.extend_from_slice(responder_device_id);

    let hk = Hkdf::<Sha256>::new(Some(&salt), organization_key);
    let mut out = [0u8; 32];
    hk.expand(&info, &mut out)
        .map_err(|e| format!("HKDF expand failed: {}", e))?;
    Ok(out)
}

/// Compute the H2 proof tag: the HANDSHAKE_REPLY transcript
/// bound to the REPLY role.
///
/// Per Section 22.9.3 and Section 22.19.1:
///   proof_input =
///       "GORKA-MVP-HANDSHAKE-REPLY-v1"
///       || u16_be(protocol_version)
///       || u16_be(len(initiator_organization_id))
///       || initiator_organization_id
///       || u16_be(len(initiator_device_id))
///       || initiator_device_id
///       || initiator_nonce
///       || u16_be(len(responder_organization_id))
///       || responder_organization_id
///       || u16_be(len(responder_device_id))
///       || responder_device_id
///       || responder_nonce
///   proof_tag = HMAC-SHA256(handshake_key, proof_input)
pub fn compute_handshake_reply_tag(
    handshake_key: &[u8; 32],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &[u8],
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &[u8],
    responder_nonce: &[u8; 24],
) -> Result<[u8; 32], String> {
    let input = build_handshake_proof_input(
        b"GORKA-MVP-HANDSHAKE-REPLY-v1",
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        initiator_nonce,
        responder_organization_id,
        responder_device_id,
        responder_nonce,
    );

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(handshake_key)
        .map_err(|e| format!("HMAC init failed: {}", e))?;
    mac.update(&input);
    let result = mac.finalize().into_bytes();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Compute the H3 proof tag: the HANDSHAKE_CONFIRM transcript
/// bound to the CONFIRM role.
///
/// Identical to compute_handshake_reply_tag, except the leading
/// domain-separation string is
/// "GORKA-MVP-HANDSHAKE-CONFIRM-v1".
pub fn compute_handshake_confirm_tag(
    handshake_key: &[u8; 32],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &[u8],
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &[u8],
    responder_nonce: &[u8; 24],
) -> Result<[u8; 32], String> {
    let input = build_handshake_proof_input(
        b"GORKA-MVP-HANDSHAKE-CONFIRM-v1",
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        initiator_nonce,
        responder_organization_id,
        responder_device_id,
        responder_nonce,
    );

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(handshake_key)
        .map_err(|e| format!("HMAC init failed: {}", e))?;
    mac.update(&input);
    let result = mac.finalize().into_bytes();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Build the shared handshake proof input for H2 and H3.
///
/// The only difference between the REPLY and CONFIRM inputs is
/// the leading domain-separation string.
fn build_handshake_proof_input(
    domain: &[u8],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &[u8],
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &[u8],
    responder_nonce: &[u8; 24],
) -> Vec<u8> {
    let mut input = Vec::new();
    // domain-separation string, ASCII, no length prefix
    input.extend_from_slice(domain);
    // protocol_version, u16 BE
    input.extend_from_slice(&protocol_version.to_be_bytes());
    // initiator_organization_id, u16 BE length prefix
    let b = initiator_organization_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // initiator_device_id, u16 BE length prefix, raw bytes
    input.extend_from_slice(&(initiator_device_id.len() as u16).to_be_bytes());
    input.extend_from_slice(initiator_device_id);
    // initiator_nonce, 24 bytes, no prefix
    input.extend_from_slice(initiator_nonce);
    // responder_organization_id, u16 BE length prefix
    let b = responder_organization_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // responder_device_id, u16 BE length prefix, raw bytes
    input.extend_from_slice(&(responder_device_id.len() as u16).to_be_bytes());
    input.extend_from_slice(responder_device_id);
    // responder_nonce, 24 bytes, no prefix
    input.extend_from_slice(responder_nonce);
    input
}

/// Encode a single TLV record.
///
/// Per Section 22.5:
///   u16 BE type code || u32 BE value length || value
///
/// This is the single TLV primitive. Every higher-level encoder
/// calls this function. No higher-level encoder writes a TLV
/// header on its own.
pub fn encode_tlv(type_code: u16, value: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(6 + value.len());
    out.extend_from_slice(&type_code.to_be_bytes());
    out.extend_from_slice(&(value.len() as u32).to_be_bytes());
    out.extend_from_slice(value);
    out
}

/// Encode a UTF-8 string field value.
///
/// Per Section 22.3: u32 BE length (bytes) || UTF-8 bytes.
/// The result is the TLV *value*, not the TLV record.
pub fn encode_string_value(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    out
}

/// Encode a DEBTOR_CREATED payload (Section 25.8.3).
///
/// Fields, in order:
///   name       0x2001
///   surname    0x2002
///   email      0x2003  optional
///   phone      0x2004  optional
///   data_json  0x2005  optional
pub fn encode_debtor_created_payload(
    name: &str,
    surname: &str,
    email: Option<&str>,
    phone: Option<&str>,
    data_json: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x2001, &encode_string_value(name)));
    out.extend_from_slice(&encode_tlv(0x2002, &encode_string_value(surname)));
    if let Some(e) = email {
        out.extend_from_slice(&encode_tlv(0x2003, &encode_string_value(e)));
    }
    if let Some(p) = phone {
        out.extend_from_slice(&encode_tlv(0x2004, &encode_string_value(p)));
    }
    if let Some(d) = data_json {
        out.extend_from_slice(&encode_tlv(0x2005, &encode_string_value(d)));
    }
    out
}

/// Encode an ENTITY_UPDATED payload (Section 25.9.3).
///
/// One or more change records, each of type 0x3001. Each change's
/// value is a sequence of two TLV records:
///   field_name   0x3011
///   field_value  0x3012
///
/// Section 25.9.3 requires the change records to appear in
/// lexicographic order by field_name. This encoder establishes
/// that order before serializing. The input slice is not itself
/// a wire-order guarantee.
pub fn encode_entity_updated_payload(changes: &[(&str, Option<&str>)]) -> Vec<u8> {
    let mut sorted: Vec<(&str, Option<&str>)> = changes.to_vec();
    sorted.sort_by(|a, b| a.0.cmp(b.0));

    let mut out = Vec::new();
    for (field_name, field_value) in sorted {
        let mut change = Vec::new();
        change.extend_from_slice(&encode_tlv(0x3011, &encode_string_value(field_name)));
        match field_value {
            Some(v) => {
                change.extend_from_slice(&encode_tlv(0x3012, &encode_string_value(v)));
            }
            None => {
                // Null field: record present with zero-length value
                // (SYNC-ARCHITECTURE.md Section 25.13.3). This is
                // distinct from an empty string, which encodes as a
                // 4-byte length prefix with zero bytes following.
                change.extend_from_slice(&encode_tlv(0x3012, &[]));
            }
        }
        out.extend_from_slice(&encode_tlv(0x3001, &change));
    }
    out
}

/// Encode a COMMUNICATION_LOGGED payload (Section 25.11.3).
///
/// Fields, in order:
///   debtor_id           0x5001
///   communication_type  0x5002
///   direction           0x5003
///   content             0x5004
///   duration            0x5005  optional
pub fn encode_communication_logged_payload(
    debtor_id: &str,
    communication_type: &str,
    direction: &str,
    content: &str,
    duration: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x5001, &encode_string_value(debtor_id)));
    out.extend_from_slice(&encode_tlv(0x5002, &encode_string_value(communication_type)));
    out.extend_from_slice(&encode_tlv(0x5003, &encode_string_value(direction)));
    out.extend_from_slice(&encode_tlv(0x5004, &encode_string_value(content)));
    if let Some(d) = duration {
        out.extend_from_slice(&encode_tlv(0x5005, &encode_string_value(d)));
    }
    out
}

/// Encode an event record (Section 22.13.2).
///
/// Fields, in order:
///   event_id       0x1101  exactly 16 bytes
///   device_id      0x1102  raw bytes
///   sequence       0x1103  u64
///   logical_clock  0x1104  u64
///   event_type     0x1105  u16
///   entity_type    0x1106  u8
///   entity_id      0x1107  raw bytes
///   created_at     0x1108  u64, milliseconds since epoch
///   payload        0x1109  TLV-encoded payload
pub fn encode_event_record(
    event_id: &[u8; 16],
    device_id: &[u8],
    sequence: u64,
    logical_clock: u64,
    event_type: u16,
    entity_type: u8,
    entity_id: &[u8],
    created_at_ms: u64,
    payload: &[u8],
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x1101, event_id));
    out.extend_from_slice(&encode_tlv(0x1102, device_id));
    out.extend_from_slice(&encode_tlv(0x1103, &sequence.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1104, &logical_clock.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1105, &event_type.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1106, &[entity_type]));
    out.extend_from_slice(&encode_tlv(0x1107, entity_id));
    out.extend_from_slice(&encode_tlv(0x1108, &created_at_ms.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1109, payload));
    out
}

/// Build a framed, encrypted SYNC_MESSAGE (Section 22.13.1).
///
/// Inner content:
///   message_id  0x1001  16 bytes
///   event_count 0x1002  u32 = event_records.len()
///   events      0x1003  repeatable, one per event record
///
/// Outer framing:
///   type 0x0010 (u16 BE) || length (u32 BE) ||
///   nonce (24) || ciphertext || tag (16)
///
/// The AAD is the 6-byte outer header, as transmitted.
pub fn build_sync_message(
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    message_id: &[u8; 16],
    event_records: &[Vec<u8>],
) -> Result<Vec<u8>, String> {
    let mut inner = Vec::new();
    inner.extend_from_slice(&encode_tlv(0x1001, message_id));
    let event_count = event_records.len() as u32;
    inner.extend_from_slice(&encode_tlv(0x1002, &event_count.to_be_bytes()));
    for record in event_records {
        inner.extend_from_slice(&encode_tlv(0x1003, record));
    }

    let outer_length = (24 + inner.len() + 16) as u32;
    let mut outer_header = Vec::with_capacity(6);
    outer_header.extend_from_slice(&0x0010u16.to_be_bytes());
    outer_header.extend_from_slice(&outer_length.to_be_bytes());

    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let ciphertext = cipher
        .encrypt(
            xnonce,
            Payload {
                msg: &inner,
                aad: &outer_header,
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut framed = Vec::with_capacity(6 + 24 + ciphertext.len());
    framed.extend_from_slice(&outer_header);
    framed.extend_from_slice(nonce);
    framed.extend_from_slice(&ciphertext);
    Ok(framed)
}

/// Parse and decrypt a framed SYNC_MESSAGE (Section 22.13.1).
///
/// This validates and decrypts the outer envelope and returns the
/// decrypted inner content. It does not parse event records. Full
/// message parsing is a separate concern, for a later phase.
pub fn parse_sync_message(
    session_key: &[u8; 32],
    framed_message: &[u8],
) -> Result<Vec<u8>, String> {
    if framed_message.len() < 6 + 24 + 16 {
        return Err("SYNC_MESSAGE too short".to_string());
    }

    let msg_type = u16::from_be_bytes([framed_message[0], framed_message[1]]);
    if msg_type != 0x0010 {
        return Err("SYNC_MESSAGE: unexpected type code".to_string());
    }
    let outer_length =
        u32::from_be_bytes([framed_message[2], framed_message[3], framed_message[4], framed_message[5]])
            as usize;
    if framed_message.len() != 6 + outer_length {
        return Err("SYNC_MESSAGE: length mismatch".to_string());
    }

    let outer_header = &framed_message[0..6];
    let nonce = &framed_message[6..30];
    let ciphertext = &framed_message[30..];

    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let plaintext = cipher
        .decrypt(
            xnonce,
            Payload {
                msg: ciphertext,
                aad: outer_header,
            },
        )
        .map_err(|_| "SYNC_MESSAGE: decryption failed".to_string())?;

    Ok(plaintext)
}

/// Encode an ACTION_CREATED payload (SYNC-ARCHITECTURE.md
/// Section 25.10.3).
///
/// Fields, in order:
///   debtor_id    0x4001
///   action_type  0x4002
///   status       0x4003
///   assigned_to  0x4004  optional
///   due_date     0x4005  optional
///   description  0x4006  optional
///   data_json    0x4007  optional
pub fn encode_action_created_payload(
    debtor_id: &str,
    action_type: &str,
    status: &str,
    assigned_to: Option<&str>,
    due_date: Option<&str>,
    description: Option<&str>,
    data_json: &str,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x4001, &encode_string_value(debtor_id)));
    out.extend_from_slice(&encode_tlv(0x4002, &encode_string_value(action_type)));
    out.extend_from_slice(&encode_tlv(0x4003, &encode_string_value(status)));
    if let Some(v) = assigned_to {
        out.extend_from_slice(&encode_tlv(0x4004, &encode_string_value(v)));
    }
    if let Some(v) = due_date {
        out.extend_from_slice(&encode_tlv(0x4005, &encode_string_value(v)));
    }
    if let Some(v) = description {
        out.extend_from_slice(&encode_tlv(0x4006, &encode_string_value(v)));
    }
    out.extend_from_slice(&encode_tlv(0x4007, &encode_string_value(data_json)));
    out
}