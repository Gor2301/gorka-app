// gorka-shared::sync_parse
//
// Parser side of the GORKA sync wire format.
//
// SYNC-ARCHITECTURE.md v1.4. Every parser here is the inverse of
// an encoder in gorka-shared::sync. Round-trip is the test.
//
// Nothing here is Tauri-specific. Nothing here performs I/O or
// generates randomness. Every input is a byte slice supplied by
// the caller.

use std::collections::HashSet;

// ---------------------------------------------------------------
// TLV reader
// ---------------------------------------------------------------

/// Sequential TLV reader. Reads u16 type, u32 length, then value.
struct TlvReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> TlvReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn is_empty(&self) -> bool {
        self.pos >= self.data.len()
    }

    fn read_tlv(&mut self) -> Result<(u16, &'a [u8]), String> {
        if self.pos + 6 > self.data.len() {
            return Err("truncated TLV header".to_string());
        }
        let type_code = u16::from_be_bytes([self.data[self.pos], self.data[self.pos + 1]]);
        let length = u32::from_be_bytes([
            self.data[self.pos + 2],
            self.data[self.pos + 3],
            self.data[self.pos + 4],
            self.data[self.pos + 5],
        ]) as usize;
        let value_start = self.pos + 6;
        if value_start + length > self.data.len() {
            return Err("truncated TLV value".to_string());
        }
        let value = &self.data[value_start..value_start + length];
        self.pos = value_start + length;
        Ok((type_code, value))
    }
}

// ---------------------------------------------------------------
// Primitive value decoders
// ---------------------------------------------------------------

/// Decode a u8 from a TLV value of exactly 1 byte.
fn decode_u8(value: &[u8]) -> Result<u8, String> {
    if value.len() != 1 {
        return Err("expected 1 byte for u8".to_string());
    }
    Ok(value[0])
}

/// Decode a u16 from a TLV value of exactly 2 bytes, big-endian.
fn decode_u16(value: &[u8]) -> Result<u16, String> {
    if value.len() != 2 {
        return Err("expected 2 bytes for u16".to_string());
    }
    Ok(u16::from_be_bytes([value[0], value[1]]))
}

/// Decode a u32 from a TLV value of exactly 4 bytes, big-endian.
fn decode_u32(value: &[u8]) -> Result<u32, String> {
    if value.len() != 4 {
        return Err("expected 4 bytes for u32".to_string());
    }
    Ok(u32::from_be_bytes([value[0], value[1], value[2], value[3]]))
}

/// Decode a u64 from a TLV value of exactly 8 bytes, big-endian.
fn decode_u64(value: &[u8]) -> Result<u64, String> {
    if value.len() != 8 {
        return Err("expected 8 bytes for u64".to_string());
    }
    Ok(u64::from_be_bytes([
        value[0], value[1], value[2], value[3],
        value[4], value[5], value[6], value[7],
    ]))
}

/// Decode a length-prefixed UTF-8 string value.
///
/// Per Section 22.3: u32 BE byte length, then UTF-8 bytes.
/// The input is the TLV value, not a TLV record.
fn decode_string_value(value: &[u8]) -> Result<String, String> {
    if value.len() < 4 {
        return Err("string value too short for length prefix".to_string());
    }
    let n = u32::from_be_bytes([value[0], value[1], value[2], value[3]]) as usize;
    if value.len() != 4 + n {
        return Err("string value length prefix mismatch".to_string());
    }
    let s = std::str::from_utf8(&value[4..])
        .map_err(|_| "string value is not valid UTF-8".to_string())?;
    Ok(s.to_string())
}

/// Decode an optional string value.
///
/// Per Section 25.13.3:
///   - TLV value of zero bytes means null. Returns Ok(None).
///   - TLV value with a valid length-prefixed string returns
///     Ok(Some(s)). An empty string (length prefix 0) is Some("").
fn decode_optional_string_value(value: &[u8]) -> Result<Option<String>, String> {
    if value.is_empty() {
        return Ok(None);
    }
    decode_string_value(value).map(Some)
}

/// Decode a fixed-size byte array from a TLV value.
fn decode_fixed<const N: usize>(value: &[u8]) -> Result<[u8; N], String> {
    if value.len() != N {
        return Err(format!("expected {} bytes, got {}", N, value.len()));
    }
    let mut out = [0u8; N];
    out.copy_from_slice(value);
    Ok(out)
}

// ---------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------

/// DEBTOR_CREATED payload (Section 25.8.3).
pub struct DebtorCreatedPayload {
    pub name: String,
    pub surname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub data_json: Option<String>,
}

/// A single field change in an ENTITY_UPDATED payload.
pub struct EntityFieldChange {
    pub field_name: String,
    /// None means the wire carried a null for this field
    /// (zero-length TLV value). Some("") means the wire carried
    /// an empty string.
    pub field_value: Option<String>,
}

/// ENTITY_UPDATED payload (Section 25.9.3).
pub struct EntityUpdatedPayload {
    pub changes: Vec<EntityFieldChange>,
}

/// ACTION_CREATED payload (Section 25.10.3).
pub struct ActionCreatedPayload {
    pub debtor_id: String,
    pub action_type: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data_json: Option<String>,
}

/// COMMUNICATION_LOGGED payload (Section 25.11.3).
pub struct CommunicationLoggedPayload {
    pub debtor_id: String,
    pub communication_type: String,
    pub direction: String,
    pub content: String,
    pub duration: Option<String>,
}

// ---------------------------------------------------------------
// Payload parsers
// ---------------------------------------------------------------

/// Parse a DEBTOR_CREATED payload.
///
/// Wire fields, in order:
///   name        0x2001  required
///   surname     0x2002  required
///   email       0x2003  optional
///   phone       0x2004  optional
///   data_json   0x2005  optional
pub fn parse_debtor_created_payload(data: &[u8]) -> Result<DebtorCreatedPayload, String> {
    let mut r = TlvReader::new(data);
    let mut name: Option<String> = None;
    let mut surname: Option<String> = None;
    let mut email: Option<String> = None;
    let mut phone: Option<String> = None;
    let mut data_json: Option<String> = None;
    let mut seen: HashSet<u16> = HashSet::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        if !seen.insert(code) {
            return Err(format!("duplicate field type 0x{:04x}", code));
        }
        match code {
            0x2001 => name = Some(decode_string_value(value)?),
            0x2002 => surname = Some(decode_string_value(value)?),
            0x2003 => email = decode_optional_string_value(value)?,
            0x2004 => phone = decode_optional_string_value(value)?,
            0x2005 => data_json = decode_optional_string_value(value)?,
            _ => return Err(format!("unknown DEBTOR_CREATED field type 0x{:04x}", code)),
        }
    }

    Ok(DebtorCreatedPayload {
        name: name.ok_or("missing required DEBTOR_CREATED field: name")?,
        surname: surname.ok_or("missing required DEBTOR_CREATED field: surname")?,
        email,
        phone,
        data_json,
    })
}

/// Parse an ENTITY_UPDATED payload.
///
/// Wire fields:
///   changes  0x3001  required, at least one
///
/// Each change record:
///   field_name   0x3011  required
///   field_value  0x3012  optional (may be null)
///
/// Section 25.9.3 requires changes to be in lexicographic order
/// by field_name, and the same field_name must not appear twice.
pub fn parse_entity_updated_payload(data: &[u8]) -> Result<EntityUpdatedPayload, String> {
    let mut r = TlvReader::new(data);
    let mut changes: Vec<EntityFieldChange> = Vec::new();
    let mut last_field_name: Option<String> = None;
    let mut seen_field_names: HashSet<String> = HashSet::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        if code != 0x3001 {
            return Err(format!("unknown ENTITY_UPDATED field type 0x{:04x}", code));
        }
        let change = parse_entity_change(value)?;
        if !seen_field_names.insert(change.field_name.clone()) {
            return Err(format!(
                "duplicate field_name in ENTITY_UPDATED: {}",
                change.field_name
            ));
        }
        if let Some(prev) = &last_field_name {
            if prev.as_str() > change.field_name.as_str() {
                return Err("ENTITY_UPDATED change records out of order".to_string());
            }
        }
        last_field_name = Some(change.field_name.clone());
        changes.push(change);
    }

    if changes.is_empty() {
        return Err("ENTITY_UPDATED must carry at least one change".to_string());
    }

    Ok(EntityUpdatedPayload { changes })
}

fn parse_entity_change(data: &[u8]) -> Result<EntityFieldChange, String> {
    let mut r = TlvReader::new(data);
    let mut field_name: Option<String> = None;
    let mut field_value: Option<Option<String>> = None;

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        match code {
            0x3011 => {
                if field_name.is_some() {
                    return Err("duplicate field_name in change".to_string());
                }
                field_name = Some(decode_string_value(value)?);
            }
            0x3012 => {
                if field_value.is_some() {
                    return Err("duplicate field_value in change".to_string());
                }
                field_value = Some(decode_optional_string_value(value)?);
            }
            _ => return Err(format!("unknown change record field type 0x{:04x}", code)),
        }
    }

    let field_name = field_name.ok_or("missing field_name in change")?;
    let field_value = field_value.unwrap_or(None);

    Ok(EntityFieldChange {
        field_name,
        field_value,
    })
}

/// Parse an ACTION_CREATED payload (Section 25.10.3).
///
/// Wire fields, in order:
///   debtor_id     0x4001  required
///   action_type   0x4002  required
///   status        0x4003  required
///   assigned_to   0x4004  optional
///   due_date      0x4005  optional
///   description   0x4006  optional
///   data_json     0x4007  optional
pub fn parse_action_created_payload(data: &[u8]) -> Result<ActionCreatedPayload, String> {
    let mut r = TlvReader::new(data);
    let mut debtor_id: Option<String> = None;
    let mut action_type: Option<String> = None;
    let mut status: Option<String> = None;
    let mut assigned_to: Option<String> = None;
    let mut due_date: Option<String> = None;
    let mut description: Option<String> = None;
    let mut data_json: Option<String> = None;
    let mut seen: HashSet<u16> = HashSet::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        if !seen.insert(code) {
            return Err(format!("duplicate field type 0x{:04x}", code));
        }
        match code {
            0x4001 => debtor_id = Some(decode_string_value(value)?),
            0x4002 => action_type = Some(decode_string_value(value)?),
            0x4003 => status = Some(decode_string_value(value)?),
            0x4004 => assigned_to = decode_optional_string_value(value)?,
            0x4005 => due_date = decode_optional_string_value(value)?,
            0x4006 => description = decode_optional_string_value(value)?,
            0x4007 => data_json = decode_optional_string_value(value)?,
            _ => return Err(format!("unknown ACTION_CREATED field type 0x{:04x}", code)),
        }
    }

    Ok(ActionCreatedPayload {
        debtor_id: debtor_id.ok_or("missing required ACTION_CREATED field: debtor_id")?,
        action_type: action_type.ok_or("missing required ACTION_CREATED field: action_type")?,
        status: status.ok_or("missing required ACTION_CREATED field: status")?,
        assigned_to,
        due_date,
        description,
        data_json,
    })
}

/// Parse a COMMUNICATION_LOGGED payload (Section 25.11.3).
///
/// Wire fields, in order:
///   debtor_id           0x5001  required
///   communication_type  0x5002  required
///   direction           0x5003  required
///   content             0x5004  required (may be empty)
///   duration            0x5005  optional
pub fn parse_communication_logged_payload(
    data: &[u8],
) -> Result<CommunicationLoggedPayload, String> {
    let mut r = TlvReader::new(data);
    let mut debtor_id: Option<String> = None;
    let mut communication_type: Option<String> = None;
    let mut direction: Option<String> = None;
    let mut content: Option<String> = None;
    let mut duration: Option<String> = None;
    let mut seen: HashSet<u16> = HashSet::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        if !seen.insert(code) {
            return Err(format!("duplicate field type 0x{:04x}", code));
        }
        match code {
            0x5001 => debtor_id = Some(decode_string_value(value)?),
            0x5002 => communication_type = Some(decode_string_value(value)?),
            0x5003 => direction = Some(decode_string_value(value)?),
            0x5004 => content = Some(decode_string_value(value)?),
            0x5005 => duration = decode_optional_string_value(value)?,
            _ => return Err(format!("unknown COMMUNICATION_LOGGED field type 0x{:04x}", code)),
        }
    }

    Ok(CommunicationLoggedPayload {
        debtor_id: debtor_id.ok_or("missing required field: debtor_id")?,
        communication_type: communication_type
            .ok_or("missing required field: communication_type")?,
        direction: direction.ok_or("missing required field: direction")?,
        content: content.ok_or("missing required field: content")?,
        duration,
    })
}

// ---------------------------------------------------------------
// Event record
// ---------------------------------------------------------------

/// A parsed event record (Section 22.13.2).
pub struct EventRecord {
    pub event_id: [u8; 16],
    pub device_id: Vec<u8>,
    pub sequence: u64,
    pub logical_clock: u64,
    pub event_type: u16,
    pub entity_type: u8,
    pub entity_id: Vec<u8>,
    pub created_at_ms: u64,
    pub payload: Vec<u8>,
}

/// Parse an event record from its TLV value bytes.
pub fn parse_event_record(data: &[u8]) -> Result<EventRecord, String> {
    let mut r = TlvReader::new(data);
    let mut event_id: Option<[u8; 16]> = None;
    let mut device_id: Option<Vec<u8>> = None;
    let mut sequence: Option<u64> = None;
    let mut logical_clock: Option<u64> = None;
    let mut event_type: Option<u16> = None;
    let mut entity_type: Option<u8> = None;
    let mut entity_id: Option<Vec<u8>> = None;
    let mut created_at_ms: Option<u64> = None;
    let mut payload: Option<Vec<u8>> = None;
    let mut seen: HashSet<u16> = HashSet::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        if !seen.insert(code) {
            return Err(format!("duplicate event record field type 0x{:04x}", code));
        }
        match code {
            0x1101 => event_id = Some(decode_fixed::<16>(value)?),
            0x1102 => device_id = Some(value.to_vec()),
            0x1103 => sequence = Some(decode_u64(value)?),
            0x1104 => logical_clock = Some(decode_u64(value)?),
            0x1105 => event_type = Some(decode_u16(value)?),
            0x1106 => entity_type = Some(decode_u8(value)?),
            0x1107 => entity_id = Some(value.to_vec()),
            0x1108 => created_at_ms = Some(decode_u64(value)?),
            0x1109 => payload = Some(value.to_vec()),
            _ => return Err(format!("unknown event record field type 0x{:04x}", code)),
        }
    }

    Ok(EventRecord {
        event_id: event_id.ok_or("missing event_id")?,
        device_id: device_id.ok_or("missing device_id")?,
        sequence: sequence.ok_or("missing sequence")?,
        logical_clock: logical_clock.ok_or("missing logical_clock")?,
        event_type: event_type.ok_or("missing event_type")?,
        entity_type: entity_type.ok_or("missing entity_type")?,
        entity_id: entity_id.ok_or("missing entity_id")?,
        created_at_ms: created_at_ms.ok_or("missing created_at")?,
        payload: payload.ok_or("missing payload")?,
    })
}

// ---------------------------------------------------------------
// SYNC_MESSAGE inner content
// ---------------------------------------------------------------

/// The parsed inner content of a SYNC_MESSAGE (Section 22.13.1).
pub struct SyncMessageInner {
    pub message_id: [u8; 16],
    pub events: Vec<EventRecord>,
}

/// Parse the decrypted inner content of a SYNC_MESSAGE.
///
/// Wire fields:
///   message_id   0x1001  required, 16 bytes
///   event_count  0x1002  required, u32
///   events       0x1003  repeatable, event_count occurrences
pub fn parse_sync_message_inner(data: &[u8]) -> Result<SyncMessageInner, String> {
    let mut r = TlvReader::new(data);
    let mut message_id: Option<[u8; 16]> = None;
    let mut event_count: Option<u32> = None;
    let mut events: Vec<EventRecord> = Vec::new();

    while !r.is_empty() {
        let (code, value) = r.read_tlv()?;
        match code {
            0x1001 => {
                if message_id.is_some() {
                    return Err("duplicate message_id".to_string());
                }
                message_id = Some(decode_fixed::<16>(value)?);
            }
            0x1002 => {
                if event_count.is_some() {
                    return Err("duplicate event_count".to_string());
                }
                event_count = Some(decode_u32(value)?);
            }
            0x1003 => {
                events.push(parse_event_record(value)?);
            }
            _ => return Err(format!("unknown SYNC_MESSAGE field type 0x{:04x}", code)),
        }
    }

    let message_id = message_id.ok_or("missing message_id")?;
    let event_count = event_count.ok_or("missing event_count")?;
    if event_count as usize != events.len() {
        return Err(format!(
            "event_count {} does not match {} event records",
            event_count,
            events.len()
        ));
    }

    Ok(SyncMessageInner { message_id, events })
}