// gorka-shared::actions
//
// Action database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "actions".
//
// Phase 9.6 batch 2: every mutating function opens a
// transaction and originates a sync event. An action is its
// own synchronized entity type (ACTION_CREATED, ENTITY_UPDATED).
// Delete is a soft delete.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::sync;
use crate::sync_events;
use crate::models::{Action, ActionInput, ActionWithDebtor};

pub fn get_actions(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<Vec<Action>, String> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.debtor_id, a.type, a.status, a.assigned_to,
                a.due_date, a.description, a.data, a.created_at, a.updated_at
         FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.debtor_id = ?1 AND b.organization_id = ?2
           AND b.deleted != 'true'
           AND a.deleted != 'true'
         ORDER BY a.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![debtor_id, organization_id], |row| {
        let data_json: String = row.get(7)?;
        Ok(Action {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            r#type: row.get(2)?,
            status: row.get(3)?,
            assigned_to: row.get(4)?,
            due_date: row.get(5)?,
            description: row.get(6)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut actions = Vec::new();
    for row in rows {
        actions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(actions)
}

pub fn insert_action(
    conn: &mut Connection,
    organization_id: &str,
    input: ActionInput,
) -> Result<Action, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let debtor_ok: i64 = tx.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
        params![&input.debtor_id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debtor_ok == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let status = input.status.unwrap_or_else(|| "PENDING".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let data_json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string());

    tx.execute(
        "INSERT INTO actions (id, debtor_id, type, status, assigned_to, due_date, description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            &input.debtor_id,
            &input.r#type,
            &status,
            &input.assigned_to,
            &input.due_date,
            &input.description,
            &data_json,
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    let payload = encode_action_created_payload(
        &input.debtor_id,
        &input.r#type,
        &status,
        input.assigned_to.as_deref(),
        input.due_date.as_deref(),
        input.description.as_deref(),
        &data_json,
    );
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ACTION_CREATED,
        sync_events::ENTITY_ACTION,
        &id,
        &payload,
    )?;

    db::log_audit(&tx, "INSERT_ACTION", Some(&input.debtor_id), 1, "Inserted action")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Action {
        id,
        debtor_id: input.debtor_id,
        r#type: input.r#type,
        status,
        assigned_to: input.assigned_to,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_action(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
    input: ActionInput,
) -> Result<Action, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let owner_debtor_id: String = tx.query_row(
        "SELECT a.debtor_id FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.id = ?1 AND b.organization_id = ?2",
        params![id, organization_id],
        |row| row.get(0),
    ).map_err(|_| "Action not found or not in this organization".to_string())?;

    let now = Utc::now().to_rfc3339();
    let status = input.status.unwrap_or_else(|| "PENDING".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let data_json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string());

    let affected = tx.execute(
        "UPDATE actions
         SET type = ?1, status = ?2, assigned_to = ?3, due_date = ?4,
             description = ?5, data = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            &input.r#type,
            &status,
            &input.assigned_to,
            &input.due_date,
            &input.description,
            &data_json,
            &now,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Action not found".to_string());
    }

    let changes: Vec<(&str, Option<&str>)> = vec![
        ("action_type", Some(&input.r#type)),
        ("status", Some(&status)),
        ("assigned_to", input.assigned_to.as_deref()),
        ("due_date", input.due_date.as_deref()),
        ("description", input.description.as_deref()),
        ("data_json", Some(&data_json)),
    ];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_ACTION,
        id,
        &payload,
    )?;

    db::log_audit(&tx, "UPDATE_ACTION", Some(&owner_debtor_id), 1, "Updated action")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Action {
        id: id.to_string(),
        debtor_id: owner_debtor_id,
        r#type: input.r#type,
        status,
        assigned_to: input.assigned_to,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn delete_action(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let owner_debtor_id: Option<String> = tx.query_row(
        "SELECT a.debtor_id FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.id = ?1 AND b.organization_id = ?2 AND a.deleted != 'true'",
        params![id, organization_id],
        |row| row.get(0),
    ).ok();

    let owner_debtor_id = match owner_debtor_id {
        Some(owner) => owner,
        None => return Ok(false),
    };

    let now = Utc::now().to_rfc3339();
    let affected = tx.execute(
        "UPDATE actions SET deleted = 'true', updated_at = ?1 WHERE id = ?2",
        params![&now, id],
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
        sync_events::ENTITY_ACTION,
        id,
        &payload,
    )?;

    db::log_audit(&tx, "DELETE_ACTION", Some(&owner_debtor_id), 1, "Deleted action (soft delete)")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(true)
}

pub fn get_all_actions(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<ActionWithDebtor>, String> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.debtor_id, b.name, b.surname,
                a.type, a.status, a.assigned_to,
                a.due_date, a.description, a.data,
                a.created_at, a.updated_at
         FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE b.organization_id = ?1
           AND b.deleted != 'true'
           AND a.deleted != 'true'
         ORDER BY (a.due_date IS NULL), a.due_date ASC, a.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![organization_id], |row| {
        let data_json: String = row.get(9)?;
        Ok(ActionWithDebtor {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            debtor_name: row.get(2)?,
            debtor_surname: row.get(3)?,
            r#type: row.get(4)?,
            status: row.get(5)?,
            assigned_to: row.get(6)?,
            due_date: row.get(7)?,
            description: row.get(8)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut actions = Vec::new();
    for row in rows {
        actions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(actions)
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
fn encode_action_created_payload(
    debtor_id: &str,
    action_type: &str,
    status: &str,
    assigned_to: Option<&str>,
    due_date: Option<&str>,
    description: Option<&str>,
    data_json: &str,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&sync::encode_tlv(0x4001, &sync::encode_string_value(debtor_id)));
    out.extend_from_slice(&sync::encode_tlv(0x4002, &sync::encode_string_value(action_type)));
    out.extend_from_slice(&sync::encode_tlv(0x4003, &sync::encode_string_value(status)));
    if let Some(v) = assigned_to {
        out.extend_from_slice(&sync::encode_tlv(0x4004, &sync::encode_string_value(v)));
    }
    if let Some(v) = due_date {
        out.extend_from_slice(&sync::encode_tlv(0x4005, &sync::encode_string_value(v)));
    }
    if let Some(v) = description {
        out.extend_from_slice(&sync::encode_tlv(0x4006, &sync::encode_string_value(v)));
    }
    out.extend_from_slice(&sync::encode_tlv(0x4007, &sync::encode_string_value(data_json)));
    out
}