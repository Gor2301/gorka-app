// gorka-shared::sync_events
//
// Event origination for the GORKA sync protocol.
//
// Every state mutation in gorka-shared opens a transaction,
// applies the state change, and calls originate_event to append
// the corresponding sync_events row. The state change and the
// event commit or roll back together (SYNC-ARCHITECTURE.md
// Section 25.4.1).
//
// The primitives in gorka-shared::sync build the payload bytes.
// This module wraps them and writes the row.

use rusqlite::{params, Transaction};
use uuid::Uuid;
use chrono::Utc;
use rand::RngCore;

// Entity type strings as stored in sync_events.entity_type.
pub const ENTITY_DEBTOR: &str = "debtor";
pub const ENTITY_ACTION: &str = "action";
pub const ENTITY_COMMUNICATION: &str = "communication";

// Event type strings as stored in sync_events.event_type.
pub const EVENT_DEBTOR_CREATED: &str = "DEBTOR_CREATED";
pub const EVENT_ENTITY_UPDATED: &str = "ENTITY_UPDATED";
pub const EVENT_ACTION_CREATED: &str = "ACTION_CREATED";
pub const EVENT_COMMUNICATION_LOGGED: &str = "COMMUNICATION_LOGGED";

/// Ensure the sync_state row exists. Generates the 16-byte local
/// replica identifier on first call and stores it in
/// sync_state.device_id (BLOB). Idempotent.
///
/// Returns the device_id bytes.
pub fn ensure_sync_state(
    tx: &Transaction,
    organization_id: &str,
) -> Result<[u8; 16], String> {
    let existing: Option<Vec<u8>> = tx
        .query_row(
            "SELECT device_id FROM sync_state LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(bytes) = existing {
        if bytes.len() == 16 {
            let mut out = [0u8; 16];
            out.copy_from_slice(&bytes);
            return Ok(out);
        }
        // Malformed row: replace it.
        tx.execute("DELETE FROM sync_state", [])
            .map_err(|e| e.to_string())?;
    }

    let mut device_id = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut device_id);
    let now = Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO sync_state (device_id, organization_id, sequence_counter, logical_clock, updated_at)
         VALUES (?1, ?2, 0, 0, ?3)",
        params![&device_id[..], organization_id, &now],
    ).map_err(|e| e.to_string())?;

    Ok(device_id)
}

/// Originate one event.
///
/// Allocates the next sequence number and logical clock value,
/// writes the sync_events row, and advances the counters in
/// sync_state. Returns the event_id (36-char UUIDv7 string).
///
/// Must be called inside an open transaction. The caller commits
/// after this returns and after the state write is complete.
pub fn originate_event(
    tx: &Transaction,
    organization_id: &str,
    event_type: &str,
    entity_type: &str,
    entity_id: &str,
    payload: &[u8],
) -> Result<String, String> {
    let device_id = ensure_sync_state(tx, organization_id)?;

    let (seq_counter, clock_counter): (i64, i64) = tx
        .query_row(
            "SELECT sequence_counter, logical_clock FROM sync_state LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let next_seq = seq_counter + 1;
    let next_clock = clock_counter + 1;

    let now = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE sync_state SET sequence_counter = ?1, logical_clock = ?2, updated_at = ?3",
        params![next_seq, next_clock, &now],
    ).map_err(|e| e.to_string())?;

    let event_id = Uuid::now_v7().to_string();

    tx.execute(
        "INSERT INTO sync_events (
            id, organization_id, device_id, event_type, entity_type, entity_id,
            payload, sequence, logical_clock, created_at, local_received_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &event_id,
            organization_id,
            &device_id[..],
            event_type,
            entity_type,
            entity_id,
            payload,
            next_seq,
            next_clock,
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(event_id)
}