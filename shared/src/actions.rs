// gorka-shared::actions
//
// Action database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "actions".
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
use crate::models::{Action, ActionInput};

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
    conn: &Connection,
    organization_id: &str,
    input: ActionInput,
) -> Result<Action, String> {
    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
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

    conn.execute(
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
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "INSERT_ACTION", Some(&input.debtor_id), 1, "Inserted action")?;

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
    conn: &Connection,
    organization_id: &str,
    id: &str,
    input: ActionInput,
) -> Result<Action, String> {
    let ownership_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.id = ?1 AND b.organization_id = ?2",
        params![id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if ownership_ok == 0 {
        return Err("Action not found or not in this organization".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let status = input.status.unwrap_or_else(|| "PENDING".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let affected = conn.execute(
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
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Action not found".to_string());
    }

    db::log_audit(conn, "UPDATE_ACTION", Some(&input.debtor_id), 1, "Updated action")?;

    Ok(Action {
        id: id.to_string(),
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

pub fn delete_action(
    conn: &Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let affected = conn.execute(
        "DELETE FROM actions
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_ACTION", None, 1, "Deleted action")?;
        Ok(true)
    } else {
        Ok(false)
    }
}