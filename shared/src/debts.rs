// gorka-shared::debts
//
// Debt database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "debts".
//
// Phase 9.6 batch 2: every mutating function opens a
// transaction and, after the debt state change, rebuilds the
// parent debtor's data_json.debts array and originates an
// ENTITY_UPDATED event for the parent debtor.
//
// This is Rule 2 of SYNC-ARCHITECTURE.md Section 25.9.2a: debt
// data that is part of the synchronized debtor representation
// travels inside the parent debtor's data_json field. Debts do
// not get their own entity type on the wire in the MVP.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, Transaction, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::sync;
use crate::sync_events;
use crate::models::{Debt, DebtInput};

pub fn get_debts(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<Vec<Debt>, String> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.debtor_id, d.amount, d.currency, d.status,
                d.due_date, d.description, d.data, d.created_at, d.updated_at
         FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.debtor_id = ?1 AND b.organization_id = ?2
           AND b.deleted != 'true'
         ORDER BY d.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![debtor_id, organization_id], |row| {
        let data_json: String = row.get(7)?;
        Ok(Debt {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            amount: row.get(2)?,
            currency: row.get(3)?,
            status: row.get(4)?,
            due_date: row.get(5)?,
            description: row.get(6)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut debts = Vec::new();
    for row in rows {
        debts.push(row.map_err(|e| e.to_string())?);
    }

    Ok(debts)
}

/// Rebuild the parent debtor's data_json.debts array from the
/// current debts table, update the debtors row, and return the
/// new data_json string. Must be called inside an open
/// transaction, after the debt state change has been applied.
///
/// Rule 2 of SYNC-ARCHITECTURE.md Section 25.9.2a.
fn refresh_debtor_debt_json(
    tx: &Transaction,
    organization_id: &str,
    debtor_id: &str,
) -> Result<String, String> {
    let existing: String = tx.query_row(
        "SELECT data FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![debtor_id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let mut parsed: JsonValue = serde_json::from_str(&existing)
        .unwrap_or_else(|_| JsonValue::Object(serde_json::Map::new()));
    if !parsed.is_object() {
        parsed = JsonValue::Object(serde_json::Map::new());
    }

    let mut debts_array: Vec<JsonValue> = Vec::new();
    {
        let mut stmt = tx.prepare(
            "SELECT id, amount, currency, status, due_date, description
             FROM debts WHERE debtor_id = ?1
             ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([debtor_id], |row| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), JsonValue::String(row.get::<_, String>(0)?));
            let amount: f64 = row.get(1)?;
            obj.insert("amount".to_string(), serde_json::json!(amount));
            let currency: Option<String> = row.get(2).ok();
            if let Some(c) = currency {
                obj.insert("currency".to_string(), JsonValue::String(c));
            }
            let status: Option<String> = row.get(3).ok();
            if let Some(s) = status {
                obj.insert("status".to_string(), JsonValue::String(s));
            }
            let due_date: Option<String> = row.get(4).ok();
            if let Some(d) = due_date {
                obj.insert("due_date".to_string(), JsonValue::String(d));
            }
            let description: Option<String> = row.get(5).ok();
            if let Some(desc) = description {
                obj.insert("description".to_string(), JsonValue::String(desc));
            }
            Ok(JsonValue::Object(obj))
        }).map_err(|e| e.to_string())?;

        for row in rows {
            debts_array.push(row.map_err(|e| e.to_string())?);
        }
    }

    if let Some(obj) = parsed.as_object_mut() {
        obj.insert("debts".to_string(), JsonValue::Array(debts_array));
    }

    let new_json = serde_json::to_string(&parsed).unwrap_or_else(|_| "{}".to_string());
    let now = Utc::now().to_rfc3339();

    tx.execute(
        "UPDATE debtors SET data = ?1, updated_at = ?2 WHERE id = ?3 AND organization_id = ?4",
        params![&new_json, &now, debtor_id, organization_id],
    ).map_err(|e| e.to_string())?;

    Ok(new_json)
}

pub fn insert_debt(
    conn: &mut Connection,
    organization_id: &str,
    input: DebtInput,
) -> Result<Debt, String> {
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
    let currency = input.currency.unwrap_or_else(|| "USD".to_string());
    let status = input.status.unwrap_or_else(|| "ACTIVE".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    tx.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date, description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            &input.debtor_id,
            input.amount,
            &currency,
            &status,
            &input.due_date,
            &input.description,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    let new_data_json = refresh_debtor_debt_json(&tx, organization_id, &input.debtor_id)?;

    let changes: Vec<(&str, Option<&str>)> = vec![("data_json", Some(&new_data_json))];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_DEBTOR,
        &input.debtor_id,
        &payload,
        &["data_json"],
    )?;

    db::log_audit(&tx, "INSERT_DEBT", Some(&input.debtor_id), 1, "Inserted debt")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Debt {
        id,
        debtor_id: input.debtor_id,
        amount: input.amount,
        currency,
        status,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_debt(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
    input: DebtInput,
) -> Result<Debt, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let owner_debtor_id: String = tx.query_row(
        "SELECT d.debtor_id FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.id = ?1 AND b.organization_id = ?2",
        params![id, organization_id],
        |row| row.get(0),
    ).map_err(|_| "Debt not found or not in this organization".to_string())?;

    let now = Utc::now().to_rfc3339();
    let currency = input.currency.unwrap_or_else(|| "USD".to_string());
    let status = input.status.unwrap_or_else(|| "ACTIVE".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let affected = tx.execute(
        "UPDATE debts
         SET amount = ?1, currency = ?2, status = ?3, due_date = ?4,
             description = ?5, data = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            input.amount,
            &currency,
            &status,
            &input.due_date,
            &input.description,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debt not found".to_string());
    }

    let new_data_json = refresh_debtor_debt_json(&tx, organization_id, &owner_debtor_id)?;

    let changes: Vec<(&str, Option<&str>)> = vec![("data_json", Some(&new_data_json))];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_DEBTOR,
        &owner_debtor_id,
        &payload,
        &["data_json"],
    )?;

    db::log_audit(&tx, "UPDATE_DEBT", Some(&owner_debtor_id), 1, "Updated debt")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Debt {
        id: id.to_string(),
        debtor_id: owner_debtor_id,
        amount: input.amount,
        currency,
        status,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn delete_debt(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let owner_debtor_id: Option<String> = tx.query_row(
        "SELECT d.debtor_id FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.id = ?1 AND b.organization_id = ?2",
        params![id, organization_id],
        |row| row.get(0),
    ).ok();

    let owner_debtor_id = match owner_debtor_id {
        Some(owner) => owner,
        None => return Ok(false),
    };

    let affected = tx.execute(
        "DELETE FROM debts WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Ok(false);
    }

    let new_data_json = refresh_debtor_debt_json(&tx, organization_id, &owner_debtor_id)?;

    let changes: Vec<(&str, Option<&str>)> = vec![("data_json", Some(&new_data_json))];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_DEBTOR,
        &owner_debtor_id,
        &payload,
        &["data_json"],
    )?;

    db::log_audit(&tx, "DELETE_DEBT", Some(&owner_debtor_id), 1, "Deleted debt")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(true)
}