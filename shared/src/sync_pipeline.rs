// gorka-shared::sync_pipeline
//
// The receiving pipeline (SYNC-ARCHITECTURE.md v1.4, Section 25.12)
// and the deterministic reconciliation algorithm (Section 25.9.9).
//
// Input: a framed, encrypted SYNC_MESSAGE and the session key.
// Output: an outcome per event (Accepted, Duplicate, Rejected) and
// the side effects on the local database.
//
// All effects happen in one transaction per event. A duplicate or
// a rejected event leaves the database unchanged.
//
// Nothing here is Tauri-specific.

use rusqlite::{params, Transaction, Connection};
use uuid::Uuid;
use chrono::Utc;

use crate::sync::parse_sync_message;
use crate::sync_handshake::AckOutcome;
use crate::sync_parse::{
    parse_sync_message_inner,
    parse_debtor_created_payload,
    parse_entity_updated_payload,
    parse_action_created_payload,
    parse_communication_logged_payload,
    parse_connector_enabled_payload,
    parse_connector_disabled_payload,
    parse_connector_credential_replaced_payload,
    EventRecord,
};
use crate::db;

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const EVT_DEBTOR_CREATED: u16 = 0x0001;
const EVT_ENTITY_UPDATED: u16 = 0x0002;
const EVT_ACTION_CREATED: u16 = 0x0003;
const EVT_COMMUNICATION_LOGGED: u16 = 0x0004;
const EVT_CONNECTOR_ENABLED: u16 = 0x0005;
const EVT_CONNECTOR_DISABLED: u16 = 0x0006;
const EVT_CONNECTOR_CREDENTIAL_REPLACED: u16 = 0x0007;

const ENT_DEBTOR: u8 = 0x01;
const ENT_ACTION: u8 = 0x03;
const ENT_COMMUNICATION: u8 = 0x04;
const ENT_CONNECTOR: u8 = 0x06;

// ---------------------------------------------------------------
// Public types
// ---------------------------------------------------------------

pub struct EventOutcome {
    pub event_id: [u8; 16],
    pub outcome: AckOutcome,
}

pub struct SyncMessageResult {
    pub message_id: [u8; 16],
    pub outcomes: Vec<EventOutcome>,
}

// ---------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------

/// Process a framed, encrypted SYNC_MESSAGE.
///
/// Decrypts the message with the session key, parses the inner
/// content, and applies each event in order. Returns the
/// message_id and the per-event outcomes.
pub fn process_sync_message(
    conn: &mut Connection,
    organization_id: &str,
    session_key: &[u8; 32],
    framed_message: &[u8],
) -> Result<SyncMessageResult, String> {
    let inner = parse_sync_message(session_key, framed_message)?;
    let parsed = parse_sync_message_inner(&inner)?;

    let mut outcomes = Vec::with_capacity(parsed.events.len());
    for event in parsed.events.iter() {
        let outcome = process_event(conn, organization_id, event)?;
        outcomes.push(EventOutcome {
            event_id: event.event_id,
            outcome,
        });
    }

    Ok(SyncMessageResult {
        message_id: parsed.message_id,
        outcomes,
    })
}

// ---------------------------------------------------------------
// Per-event processing
// ---------------------------------------------------------------

fn process_event(
    conn: &mut Connection,
    organization_id: &str,
    event: &EventRecord,
) -> Result<AckOutcome, String> {
    // Structural validation. No DB access needed.
    if !valid_event_type(event.event_type) {
        return Ok(AckOutcome::Rejected);
    }
    if !valid_entity_type(event.entity_type) {
        return Ok(AckOutcome::Rejected);
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Duplicate check (5b).
    let event_id_str = uuid_string_from_bytes(&event.event_id);
    let exists: bool = tx
        .query_row(
            "SELECT 1 FROM sync_events WHERE id = ?1",
            params![&event_id_str],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if exists {
        // tx drops -> rollback. Nothing written.
        return Ok(AckOutcome::Duplicate);
    }

    // Semantic validation (5c).
    if validate_event_semantics(event).is_err() {
        return Ok(AckOutcome::Rejected);
    }

    // Deferred CONNECTOR apply paths (this slice only).
    //
    // Recognized and validated above. Not applied. Terminal reject.
    // Rationale: SYNC-ARCHITECTURE.md Section 25.15.5 and 25.16.5
    // contradict Section 12.9 (order independence). Resolution
    // requires a frozen-doc amendment; not this slice. Returning
    // Ok(Rejected) is a clean per-event outcome: the transaction
    // drops, nothing is written, and the batch continues.
    if matches!(
        event.event_type,
        EVT_CONNECTOR_DISABLED | EVT_CONNECTOR_CREDENTIAL_REPLACED
    ) {
        return Ok(AckOutcome::Rejected);
    }

    // Accept: advance the clock, append the event.
    advance_logical_clock(&tx, organization_id, event.logical_clock)?;
    append_event_to_log(&tx, organization_id, event)?;

    // Prerequisite check (5d).
    if !prerequisite_exists(&tx, event)? {
        insert_pending(&tx, &event_id_str, event)?;
        tx.commit().map_err(|e| e.to_string())?;
        return Ok(AckOutcome::Accepted);
    }

    // Apply (5e).
    apply_event(&tx, organization_id, event)?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(AckOutcome::Accepted)
}

fn valid_event_type(code: u16) -> bool {
    matches!(
        code,
        EVT_DEBTOR_CREATED
            | EVT_ENTITY_UPDATED
            | EVT_ACTION_CREATED
            | EVT_COMMUNICATION_LOGGED
            | EVT_CONNECTOR_ENABLED
            | EVT_CONNECTOR_DISABLED
            | EVT_CONNECTOR_CREDENTIAL_REPLACED
    )
}

fn valid_entity_type(code: u8) -> bool {
    matches!(code, ENT_DEBTOR | ENT_ACTION | ENT_COMMUNICATION | ENT_CONNECTOR)
}

// ---------------------------------------------------------------
// Semantic validation
// ---------------------------------------------------------------

fn validate_event_semantics(event: &EventRecord) -> Result<(), String> {
    match event.event_type {
        EVT_DEBTOR_CREATED => {
            let p = parse_debtor_created_payload(&event.payload)?;
            if p.name.is_empty() {
                return Err("DEBTOR_CREATED: name is empty".to_string());
            }
            if p.surname.is_empty() {
                return Err("DEBTOR_CREATED: surname is empty".to_string());
            }
        }
        EVT_ENTITY_UPDATED => {
            let p = parse_entity_updated_payload(&event.payload)?;
            for change in &p.changes {
                if change.field_name == "deleted" {
                    match change.field_value.as_deref() {
                        Some("true") => {}
                        _ => {
                            return Err(
                                "ENTITY_UPDATED: deleted must be set to true".to_string()
                            );
                        }
                    }
                }
            }
        }
        EVT_ACTION_CREATED => {
            let p = parse_action_created_payload(&event.payload)?;
            if p.debtor_id.is_empty() {
                return Err("ACTION_CREATED: debtor_id is empty".to_string());
            }
            match p.action_type.as_str() {
                "CALL" | "EMAIL" | "SMS" | "VISIT" | "LETTER" | "TASK" | "LEGAL" => {}
                _ => return Err("ACTION_CREATED: invalid action_type".to_string()),
            }
            match p.status.as_str() {
                "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" => {}
                _ => return Err("ACTION_CREATED: invalid status".to_string()),
            }
        }
        EVT_COMMUNICATION_LOGGED => {
            let p = parse_communication_logged_payload(&event.payload)?;
            match p.communication_type.as_str() {
                "CALL" | "EMAIL" | "SMS" | "NOTE" => {}
                _ => return Err("COMMUNICATION_LOGGED: invalid communication_type".to_string()),
            }
            match p.direction.as_str() {
                "INBOUND" | "OUTBOUND" => {}
                _ => return Err("COMMUNICATION_LOGGED: invalid direction".to_string()),
            }
        }
        EVT_CONNECTOR_ENABLED => {
            let p = parse_connector_enabled_payload(&event.payload)?;
            if p.connector_code.is_empty() {
                return Err("CONNECTOR_ENABLED: connector_code is empty".to_string());
            }
            match p.tier.as_str() {
                "TIER1" | "TIER2" => {}
                _ => return Err("CONNECTOR_ENABLED: invalid tier".to_string()),
            }
            if p.credential_value.is_empty() {
                return Err("CONNECTOR_ENABLED: credential_value is empty".to_string());
            }
        }
        EVT_CONNECTOR_DISABLED => {
            let p = parse_connector_disabled_payload(&event.payload)?;
            if p.connector_code.is_empty() {
                return Err("CONNECTOR_DISABLED: connector_code is empty".to_string());
            }
        }
        EVT_CONNECTOR_CREDENTIAL_REPLACED => {
            let p = parse_connector_credential_replaced_payload(&event.payload)?;
            if p.connector_code.is_empty() {
                return Err(
                    "CONNECTOR_CREDENTIAL_REPLACED: connector_code is empty".to_string()
                );
            }
            if p.credential_value.is_empty() {
                return Err(
                    "CONNECTOR_CREDENTIAL_REPLACED: credential_value is empty".to_string()
                );
            }
        }
        _ => return Err("unknown event type".to_string()),
    }
    Ok(())
}

// ---------------------------------------------------------------
// Append + advance clock
// ---------------------------------------------------------------

fn append_event_to_log(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let event_id_str = uuid_string_from_bytes(&event.event_id);
    let event_type_str = event_type_string(event.event_type)?;
    let entity_type_str = entity_type_string(event.entity_type)?;
    let entity_id_str = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "entity_id is not valid UTF-8".to_string())?;
    let created_at = ms_to_rfc3339(event.created_at_ms);
    let now = Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO sync_events (
            id, organization_id, device_id, event_type, entity_type, entity_id,
            payload, sequence, logical_clock, created_at, local_received_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &event_id_str,
            organization_id,
            &event.device_id,
            &event_type_str,
            &entity_type_str,
            &entity_id_str,
            &event.payload,
            event.sequence as i64,
            event.logical_clock as i64,
            &created_at,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn advance_logical_clock(
    tx: &Transaction,
    organization_id: &str,
    received_clock: u64,
) -> Result<(), String> {
    // Ensure the sync_state row exists. If it does not, create one.
    // This can happen on a fresh device that has not yet originated
    // an event but has received one.
    let existing: Option<i64> = tx
        .query_row("SELECT logical_clock FROM sync_state LIMIT 1", [], |row| row.get(0))
        .ok();

    let current_clock = match existing {
        Some(v) => v as u64,
        None => {
            // Create the row with a fresh device_id.
            let mut device_id = [0u8; 16];
            use rand::RngCore;
            rand::rngs::OsRng.fill_bytes(&mut device_id);
            tx.execute(
                "INSERT INTO sync_state (device_id, organization_id, sequence_counter, logical_clock, updated_at)
                 VALUES (?1, ?2, 0, 0, ?3)",
                params![&device_id[..], organization_id, &Utc::now().to_rfc3339()],
            ).map_err(|e| e.to_string())?;
            0
        }
    };

    let new_clock = std::cmp::max(current_clock, received_clock + 1);
    tx.execute(
        "UPDATE sync_state SET logical_clock = ?1, updated_at = ?2",
        params![new_clock as i64, &Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------
// Prerequisite + pending
// ---------------------------------------------------------------

fn prerequisite_exists(tx: &Transaction, event: &EventRecord) -> Result<bool, String> {
    match event.event_type {
        EVT_DEBTOR_CREATED => Ok(true),
        EVT_CONNECTOR_ENABLED => Ok(true),
        EVT_ENTITY_UPDATED => {
            let entity_id_str = String::from_utf8(event.entity_id.clone())
                .map_err(|_| "entity_id not UTF-8".to_string())?;
            let table = table_for_entity_type(event.entity_type)?;
            let exists: bool = tx
                .query_row(
                    &format!("SELECT 1 FROM {} WHERE id = ?1", table),
                    params![&entity_id_str],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            Ok(exists)
        }
        EVT_ACTION_CREATED => {
            let p = parse_action_created_payload(&event.payload)?;
            let exists: bool = tx
                .query_row(
                    "SELECT 1 FROM debtors WHERE id = ?1",
                    params![&p.debtor_id],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            Ok(exists)
        }
        EVT_COMMUNICATION_LOGGED => {
            let p = parse_communication_logged_payload(&event.payload)?;
            let exists: bool = tx
                .query_row(
                    "SELECT 1 FROM debtors WHERE id = ?1",
                    params![&p.debtor_id],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            Ok(exists)
        }
        _ => Ok(false),
    }
}

fn insert_pending(
    tx: &Transaction,
    event_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let (dep_type, dep_id): (String, String) = match event.event_type {
        EVT_ENTITY_UPDATED => {
            let entity_id_str = String::from_utf8(event.entity_id.clone())
                .map_err(|_| "entity_id not UTF-8".to_string())?;
            (
                entity_type_string(event.entity_type)?.to_string(),
                entity_id_str,
            )
        }
        EVT_ACTION_CREATED => {
            let p = parse_action_created_payload(&event.payload)?;
            ("debtor".to_string(), p.debtor_id)
        }
        EVT_COMMUNICATION_LOGGED => {
            let p = parse_communication_logged_payload(&event.payload)?;
            ("debtor".to_string(), p.debtor_id)
        }
        _ => return Ok(()),
    };

    tx.execute(
        "INSERT INTO pending_events (event_id, reason, depends_on_entity_type, depends_on_entity_id, added_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            event_id,
            "ENTITY_NOT_YET_PRESENT",
            &dep_type,
            &dep_id,
            &Utc::now().to_rfc3339(),
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------
// Apply
// ---------------------------------------------------------------

fn apply_event(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    match event.event_type {
        EVT_DEBTOR_CREATED => apply_debtor_created(tx, organization_id, event),
        EVT_ENTITY_UPDATED => apply_entity_updated(tx, organization_id, event),
        EVT_ACTION_CREATED => apply_action_created(tx, organization_id, event),
        EVT_COMMUNICATION_LOGGED => apply_communication_logged(tx, organization_id, event),
        EVT_CONNECTOR_ENABLED => apply_connector_enabled(tx, organization_id, event),
        _ => Err("unsupported event type".to_string()),
    }
}

fn apply_debtor_created(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let entity_id_str = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "debtor entity_id not UTF-8".to_string())?;
    let p = parse_debtor_created_payload(&event.payload)?;
    let created_at = ms_to_rfc3339(event.created_at_ms);
    let data_json = p.data_json.clone().unwrap_or_else(|| "{}".to_string());

    let exists: bool = tx
        .query_row("SELECT 1 FROM debtors WHERE id = ?1", params![&entity_id_str], |_| Ok(true))
        .unwrap_or(false);

    if !exists {
        tx.execute(
            "INSERT INTO debtors (id, organization_id, name, surname, email, phone, data, role, deleted, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'DEBTOR', 'false', ?8, ?8)",
            params![
                &entity_id_str,
                organization_id,
                &p.name,
                &p.surname,
                &p.email,
                &p.phone,
                &data_json,
                &created_at,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        // Concurrent creation: reconcile each field.
        let changes: Vec<(&str, Option<&str>)> = vec![
            ("name", Some(&p.name)),
            ("surname", Some(&p.surname)),
            ("email", p.email.as_deref()),
            ("phone", p.phone.as_deref()),
            ("data_json", Some(&data_json)),
        ];
        for (field, value) in changes {
            let col = column_for_field("debtor", field)?;
            reconcile_field(tx, "debtor", &entity_id_str, field, value, event, "debtors", col)?;
        }
        return Ok(());
    }

    // First-time insert: register winners.
    for field in ["name", "surname", "email", "phone", "data_json"] {
        set_field_winner(tx, "debtor", &entity_id_str, field, event)?;
    }
    Ok(())
}

fn apply_entity_updated(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let _ = organization_id;
    let entity_id_str = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "entity_id not UTF-8".to_string())?;
    let p = parse_entity_updated_payload(&event.payload)?;
    let entity_type = entity_type_string(event.entity_type)?;
    let table = table_for_entity_type(event.entity_type)?;

    for change in &p.changes {
        let col = column_for_field(entity_type, &change.field_name)?;
        reconcile_field(
            tx,
            entity_type,
            &entity_id_str,
            &change.field_name,
            change.field_value.as_deref(),
            event,
            table,
            col,
        )?;
    }
    Ok(())
}

fn apply_action_created(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let _ = organization_id;
    let entity_id_str = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "action entity_id not UTF-8".to_string())?;
    let p = parse_action_created_payload(&event.payload)?;
    let created_at = ms_to_rfc3339(event.created_at_ms);
    let data_json = p.data_json.clone().unwrap_or_else(|| "{}".to_string());

    let exists: bool = tx
        .query_row("SELECT 1 FROM actions WHERE id = ?1", params![&entity_id_str], |_| Ok(true))
        .unwrap_or(false);

    if !exists {
        tx.execute(
            "INSERT INTO actions (id, debtor_id, type, status, assigned_to, due_date, description, data, deleted, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'false', ?9, ?9)",
            params![
                &entity_id_str,
                &p.debtor_id,
                &p.action_type,
                &p.status,
                &p.assigned_to,
                &p.due_date,
                &p.description,
                &data_json,
                &created_at,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        let changes: Vec<(&str, Option<&str>)> = vec![
            ("debtor_id", Some(&p.debtor_id)),
            ("action_type", Some(&p.action_type)),
            ("status", Some(&p.status)),
            ("assigned_to", p.assigned_to.as_deref()),
            ("due_date", p.due_date.as_deref()),
            ("description", p.description.as_deref()),
            ("data_json", Some(&data_json)),
        ];
        for (field, value) in changes {
            let col = column_for_field("action", field)?;
            reconcile_field(tx, "action", &entity_id_str, field, value, event, "actions", col)?;
        }
        return Ok(());
    }

    for field in ["debtor_id", "action_type", "status", "assigned_to", "due_date", "description", "data_json"] {
        set_field_winner(tx, "action", &entity_id_str, field, event)?;
    }
    Ok(())
}

fn apply_communication_logged(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let _ = organization_id;
    let entity_id_str = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "communication entity_id not UTF-8".to_string())?;
    let p = parse_communication_logged_payload(&event.payload)?;
    let created_at = ms_to_rfc3339(event.created_at_ms);

    let duration: Option<i64> = match &p.duration {
        Some(s) => s.parse::<i64>().ok(),
        None => None,
    };

    let exists: bool = tx
        .query_row("SELECT 1 FROM communications WHERE id = ?1", params![&entity_id_str], |_| Ok(true))
        .unwrap_or(false);

    if !exists {
        tx.execute(
            "INSERT INTO communications (id, debtor_id, type, direction, content, duration, created_by, data, deleted, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '{}', 'false', ?8)",
            params![
                &entity_id_str,
                &p.debtor_id,
                &p.communication_type,
                &p.direction,
                &p.content,
                &duration,
                &p.created_by,
                &created_at,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        let changes: Vec<(&str, Option<&str>)> = vec![
            ("debtor_id", Some(&p.debtor_id)),
            ("communication_type", Some(&p.communication_type)),
            ("direction", Some(&p.direction)),
            ("content", Some(&p.content)),
        ];
        for (field, value) in changes {
            let col = column_for_field("communication", field)?;
            reconcile_field(
                tx,
                "communication",
                &entity_id_str,
                field,
                value,
                event,
                "communications",
                col,
            )?;
        }
        return Ok(());
    }

    for field in ["debtor_id", "communication_type", "direction", "content"] {
        set_field_winner(tx, "communication", &entity_id_str, field, event)?;
    }
    Ok(())
}

// ---------------------------------------------------------------
// apply_connector_enabled (SYNC-ARCHITECTURE.md Section 25.14.5)
// ---------------------------------------------------------------

/// Apply a CONNECTOR_ENABLED event.
///
/// Per Section 25.14.5:
///   1. Determine whether a connector local record exists for this
///      connector_code and this device's organization_id. Insert
///      if not present; update if present.
///   2. Write an entry to the application audit log.
///
/// Steps 3 (advance the logical clock) and 4 (append the event to
/// sync_events) are already performed by process_event before this
/// function is called. They are not repeated here.
///
/// No entity_field_state rows are written for CONNECTOR events
/// (Section 25.14.5). CONNECTOR records do not participate in
/// field-level reconciliation.
///
/// Note on source_device_id: the Client's origination side
/// currently passes the literal "local-device" as source_device_id
/// in its local_connectors write. That is a placeholder, not the
/// wire-origin id. The receiver here stores the real wire
/// device_id (hex) so the local record reflects the device that
/// last wrote this connector. The two fields are not expected to
/// match.
fn apply_connector_enabled(
    tx: &Transaction,
    organization_id: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let connector_code = String::from_utf8(event.entity_id.clone())
        .map_err(|_| "connector entity_id not UTF-8".to_string())?;
    let p = parse_connector_enabled_payload(&event.payload)?;
    let now = ms_to_rfc3339(event.created_at_ms);
    let source_device_id = hex::encode(&event.device_id);

    let existing_id: Option<String> = tx
        .query_row(
            "SELECT id FROM local_connectors WHERE organization_id = ?1 AND connector_code = ?2",
            params![organization_id, &connector_code],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match existing_id {
        Some(id) => {
            tx.execute(
                "UPDATE local_connectors SET tier = ?1, status = 'ENABLED', credential_value = ?2, configuration = ?3, source_device_id = ?4, updated_at = ?5 WHERE id = ?6",
                params![
                    &p.tier,
                    &p.credential_value,
                    &p.configuration,
                    &source_device_id,
                    &now,
                    &id,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        None => {
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO local_connectors (id, connector_code, organization_id, tier, status, credential_value, configuration, source_device_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'ENABLED', ?5, ?6, ?7, ?8, ?8)",
                params![
                    &id,
                    &connector_code,
                    organization_id,
                    &p.tier,
                    &p.credential_value,
                    &p.configuration,
                    &source_device_id,
                    &now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Section 25.14.5 step 2: write an application audit entry.
    // The audit action name is implementation-level, not a wire
    // event type. Wire: CONNECTOR_ENABLED. Audit: SYNC_CONNECTOR_ENABLED.
    db::log_audit(
        tx,
        "SYNC_CONNECTOR_ENABLED",
        Some(&connector_code),
        1,
        "Applied CONNECTOR_ENABLED from sync",
    )?;

    Ok(())
}

// ---------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------

fn set_field_winner(
    tx: &Transaction,
    entity_type: &str,
    entity_id: &str,
    field_name: &str,
    event: &EventRecord,
) -> Result<(), String> {
    let event_id_str = uuid_string_from_bytes(&event.event_id);
    let now = Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO entity_field_state (
            entity_type, entity_id, field_name,
            winning_event_id, winning_logical_clock, winning_device_id,
            winning_sequence, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
            winning_event_id = excluded.winning_event_id,
            winning_logical_clock = excluded.winning_logical_clock,
            winning_device_id = excluded.winning_device_id,
            winning_sequence = excluded.winning_sequence,
            updated_at = excluded.updated_at",
        params![
            entity_type,
            entity_id,
            field_name,
            &event_id_str,
            event.logical_clock as i64,
            &event.device_id,
            event.sequence as i64,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn read_state_value(
    tx: &Transaction,
    table: &str,
    column: &str,
    entity_id: &str,
) -> Result<Option<String>, String> {
    let query = format!("SELECT {} FROM {} WHERE id = ?1", column, table);
    let value: Option<String> = tx
        .query_row(&query, params![entity_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(value)
}

fn reconcile_field(
    tx: &Transaction,
    entity_type: &str,
    entity_id: &str,
    field_name: &str,
    new_value: Option<&str>,
    event: &EventRecord,
    table: &str,
    column: &str,
) -> Result<(), String> {
    let event_id_str = uuid_string_from_bytes(&event.event_id);
    let now = Utc::now().to_rfc3339();

    // Look up the current winner.
    let current: Option<(String, i64, Vec<u8>, i64)> = tx
        .query_row(
            "SELECT winning_event_id, winning_logical_clock, winning_device_id, winning_sequence
             FROM entity_field_state
             WHERE entity_type = ?1 AND entity_id = ?2 AND field_name = ?3",
            params![entity_type, entity_id, field_name],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .ok();

    let incoming_wins = match &current {
        None => true,
        Some((_, w_clock, w_dev, w_seq)) => protocol_order_less(
            *w_clock,
            w_dev,
            *w_seq,
            event.logical_clock as i64,
            &event.device_id,
            event.sequence as i64,
        ),
    };

    if incoming_wins {
        // Read the previous value (if any) before overwriting.
        let old_value: Option<String> = read_state_value(tx, table, column, entity_id).unwrap_or(None);

        // Update the state table.
        let update_sql = format!("UPDATE {} SET {} = ?1 WHERE id = ?2", table, column);
        match new_value {
            None => {
                tx.execute(&update_sql, params![Option::<String>::None, entity_id])
                    .map_err(|e| e.to_string())?;
            }
            Some(v) => {
                tx.execute(&update_sql, params![v, entity_id])
                    .map_err(|e| e.to_string())?;
            }
        }

        // Record the losing value if the value actually changed and
        // there was a prior winner.
        if let Some((old_winner_id, _, _, _)) = &current {
            let changed = match (&old_value, &new_value) {
                (None, None) => false,
                (Some(a), Some(b)) => a != b,
                _ => true,
            };
            if changed {
                tx.execute(
                    "INSERT INTO history_records (
                        entity_type, entity_id, field_name,
                        losing_value, losing_event_id, winning_event_id, reconciled_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
                        losing_value = excluded.losing_value,
                        losing_event_id = excluded.losing_event_id,
                        winning_event_id = excluded.winning_event_id,
                        reconciled_at = excluded.reconciled_at",
                    params![
                        entity_type,
                        entity_id,
                        field_name,
                        &old_value,
                        old_winner_id,
                        &event_id_str,
                        &now,
                    ],
                ).map_err(|e| e.to_string())?;
            }
        }

        // Update the winner pointer.
        tx.execute(
            "INSERT INTO entity_field_state (
                entity_type, entity_id, field_name,
                winning_event_id, winning_logical_clock, winning_device_id,
                winning_sequence, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
                winning_event_id = excluded.winning_event_id,
                winning_logical_clock = excluded.winning_logical_clock,
                winning_device_id = excluded.winning_device_id,
                winning_sequence = excluded.winning_sequence,
                updated_at = excluded.updated_at",
            params![
                entity_type,
                entity_id,
                field_name,
                &event_id_str,
                event.logical_clock as i64,
                &event.device_id,
                event.sequence as i64,
                &now,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        // Incoming loses. Record the incoming value as the losing value.
        let new_value_str: Option<String> = new_value.map(|s| s.to_string());
        let winning_event_id = current.as_ref().map(|c| c.0.clone()).unwrap_or_default();
        tx.execute(
            "INSERT INTO history_records (
                entity_type, entity_id, field_name,
                losing_value, losing_event_id, winning_event_id, reconciled_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
                losing_value = excluded.losing_value,
                losing_event_id = excluded.losing_event_id,
                winning_event_id = excluded.winning_event_id,
                reconciled_at = excluded.reconciled_at",
            params![
                entity_type,
                entity_id,
                field_name,
                &new_value_str,
                &event_id_str,
                &winning_event_id,
                &now,
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn protocol_order_less(
    a_clock: i64,
    a_dev: &[u8],
    a_seq: i64,
    b_clock: i64,
    b_dev: &[u8],
    b_seq: i64,
) -> bool {
    if a_clock != b_clock {
        return a_clock < b_clock;
    }
    match a_dev.cmp(b_dev) {
        std::cmp::Ordering::Less => true,
        std::cmp::Ordering::Greater => false,
        std::cmp::Ordering::Equal => a_seq < b_seq,
    }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

fn uuid_string_from_bytes(b: &[u8; 16]) -> String {
    Uuid::from_bytes(*b).to_string()
}

fn ms_to_rfc3339(ms: u64) -> String {
    chrono::DateTime::<Utc>::from_timestamp_millis(ms as i64)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339())
}

fn event_type_string(code: u16) -> Result<&'static str, String> {
    match code {
        EVT_DEBTOR_CREATED => Ok("DEBTOR_CREATED"),
        EVT_ENTITY_UPDATED => Ok("ENTITY_UPDATED"),
        EVT_ACTION_CREATED => Ok("ACTION_CREATED"),
        EVT_COMMUNICATION_LOGGED => Ok("COMMUNICATION_LOGGED"),
        EVT_CONNECTOR_ENABLED => Ok("CONNECTOR_ENABLED"),
        EVT_CONNECTOR_DISABLED => Ok("CONNECTOR_DISABLED"),
        EVT_CONNECTOR_CREDENTIAL_REPLACED => Ok("CONNECTOR_CREDENTIAL_REPLACED"),
        _ => Err(format!("unknown event type 0x{:04x}", code)),
    }
}

fn entity_type_string(code: u8) -> Result<&'static str, String> {
    match code {
        ENT_DEBTOR => Ok("debtor"),
        ENT_ACTION => Ok("action"),
        ENT_COMMUNICATION => Ok("communication"),
        ENT_CONNECTOR => Ok("connector"),
        _ => Err(format!("unknown entity type 0x{:02x}", code)),
    }
}

fn table_for_entity_type(code: u8) -> Result<&'static str, String> {
    match code {
        ENT_DEBTOR => Ok("debtors"),
        ENT_ACTION => Ok("actions"),
        ENT_COMMUNICATION => Ok("communications"),
        _ => Err(format!("unknown entity type 0x{:02x}", code)),
    }
}

fn column_for_field(entity_type: &str, field_name: &str) -> Result<&'static str, String> {
    match (entity_type, field_name) {
        ("debtor", "name") => Ok("name"),
        ("debtor", "surname") => Ok("surname"),
        ("debtor", "email") => Ok("email"),
        ("debtor", "phone") => Ok("phone"),
        ("debtor", "data_json") => Ok("data"),
        ("debtor", "deleted") => Ok("deleted"),

        ("action", "debtor_id") => Ok("debtor_id"),
        ("action", "action_type") => Ok("type"),
        ("action", "status") => Ok("status"),
        ("action", "assigned_to") => Ok("assigned_to"),
        ("action", "due_date") => Ok("due_date"),
        ("action", "description") => Ok("description"),
        ("action", "data_json") => Ok("data"),
        ("action", "deleted") => Ok("deleted"),

        ("communication", "debtor_id") => Ok("debtor_id"),
        ("communication", "communication_type") => Ok("type"),
        ("communication", "direction") => Ok("direction"),
        ("communication", "content") => Ok("content"),
        ("communication", "deleted") => Ok("deleted"),

        _ => Err(format!(
            "unknown field mapping: {}.{}",
            entity_type, field_name
        )),
    }
}