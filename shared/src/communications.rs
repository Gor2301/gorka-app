// gorka-shared::communications
//
// Communication database operations. Moved from the Client
// Dashboard's Tauri command layer in Phase 9.5, slice
// "communications".
//
// Every SQL string, parameter binding, row mapping, and audit
// call is identical to the code that lived in
// src-tauri/src/main.rs. Only the signatures changed: the
// organization id and the connection are supplied by the caller.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
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
    conn: &Connection,
    organization_id: &str,
    input: CommunicationInput,
) -> Result<Communication, String> {
    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
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
    let now = Utc::now().to_rfc3339();
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    conn.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content, duration, created_by, data, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            &input.debtor_id,
            comm_type.as_str(),
            direction.as_str(),
            &input.content,
            &input.duration,
            Option::<String>::None,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "INSERT_COMM", Some(&input.debtor_id), 1, "Inserted communication")?;

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
    conn: &Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let affected = conn.execute(
        "DELETE FROM communications
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_COMM", None, 1, "Deleted communication")?;
        Ok(true)
    } else {
        Ok(false)
    }
}