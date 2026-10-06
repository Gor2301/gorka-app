// gorka-shared::communications
//
// Communication database operations. Moved from the Client
// Dashboard's Tauri command layer in Phase 9.5, slice
// "communications".
//
// Phase 9.6 batch 2: insert_communication opens a transaction
// and originates a COMMUNICATION_LOGGED event.
// delete_communication is a soft delete that originates an
// ENTITY_UPDATED event with deleted = true.
//
// Communications are append-only (SYNC-ARCHITECTURE.md
// Section 25.11.6). There is no update path. Correction is
// delete-and-relog.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::sync;
use crate::sync_events;
use crate::models::{
    Communication, CommunicationInput,
    CommunicationType, CommunicationDirection,
};

pub fn get_communications(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<Vec<Communication>, String> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.debtor_id, c.type, c.direction, c.content,
                c.duration, c.created_by, c.data, c.created_at
         FROM communications c
         INNER JOIN debtors b ON b.id = c.debtor_id
         WHERE c.debtor_id = ?1 AND b.organization_id = ?2
           AND b.deleted != 'true'
           AND c.deleted != 'true'
         ORDER BY c.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![debtor_id, organization_id], |row| {
        let data_json: String = row.get(7)?;
        Ok(Communication {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            r#type: row.get(2)?,
            direction: row.get(3)?,
            content: row.get(4)?,
            duration: row.get(5)?,
            created_by: row.get(6)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut communications = Vec::new();
    for row in rows {
        communications.push(row.map_err(|e| e.to_string())?);
    }

    Ok(communications)
}

pub fn insert_communication(
    conn: &mut Connection,
    organization_id: &str,
    input: CommunicationInput,
) -> Result<Communication, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let debtor_ok: i64 = tx.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
        params![&input.debtor_id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debtor_ok == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let comm_type = match input.r#type.as_str() {
        "CALL" => CommunicationType::Call,
        "EMAIL" => CommunicationType::Email,
        "SMS" => CommunicationType::Sms,
        "NOTE" => CommunicationType::Note,
        _ => return Err("Invalid communication type".to_string()),
    };

    let direction = match input.direction.as_str() {
        "INBOUND" => CommunicationDirection::Inbound,
        "OUTBOUND" => CommunicationDirection::Outbound,
        _ => return Err("Invalid communication direction".to_string()),
    };

    let id = Uuid::new_v4().to_string();
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let data_json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string());
    let now = Utc::now().to_rfc3339();
    let comm_type_str = comm_type.as_str();
    let direction_str = direction.as_str();

    tx.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content, duration, created_by, data, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            &input.debtor_id,
            comm_type_str,
            direction_str,
            &input.content,
            &input.duration,
            Option::<String>::None,
            &data_json,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    // Duration is carried in the payload only for CALL, encoded
    // as a canonical decimal string (Section 25.11.3).
    let duration_str = if comm_type_str == "CALL" {
        input.duration.map(|d| d.to_string())
    } else {
        None
    };

    let payload = sync::encode_communication_logged_payload(
        &input.debtor_id,
        comm_type_str,
        direction_str,
        input.content.as_deref().unwrap_or(""),
        duration_str.as_deref(),
    );
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_COMMUNICATION_LOGGED,
        sync_events::ENTITY_COMMUNICATION,
        &id,
        &payload,
        &["debtor_id", "communication_type", "direction", "content"],
    )?;

    db::log_audit(&tx, "INSERT_COMM", Some(&input.debtor_id), 1, "Inserted communication")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Communication {
        id,
        debtor_id: input.debtor_id,
        r#type: comm_type.as_str().to_string(),
        direction: direction.as_str().to_string(),
        content: input.content,
        duration: input.duration,
        created_by: None,
        data,
        created_at: now,
    })
}

pub fn delete_communication(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let owner_debtor_id: Option<String> = tx.query_row(
        "SELECT c.debtor_id FROM communications c
         INNER JOIN debtors b ON b.id = c.debtor_id
         WHERE c.id = ?1 AND b.organization_id = ?2 AND c.deleted != 'true'",
        params![id, organization_id],
        |row| row.get(0),
    ).ok();

    let owner_debtor_id = match owner_debtor_id {
        Some(owner) => owner,
        None => return Ok(false),
    };

        let affected = tx.execute(
        "UPDATE communications SET deleted = 'true' WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Ok(false);
    }

    let changes: Vec<(&str, Option<&str>)> = vec![("deleted", Some("true"))];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_COMMUNICATION,
        id,
        &payload,
        &["deleted"],
    )?;

    db::log_audit(&tx, "DELETE_COMM", Some(&owner_debtor_id), 1, "Deleted communication (soft delete)")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(true)
}