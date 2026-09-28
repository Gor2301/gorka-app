// gorka-shared::debts
//
// Debt database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "debts".
//
// Every SQL string, parameter binding, row mapping, transaction
// boundary, and audit call is identical to the code that lived
// in src-tauri/src/main.rs. Only the signatures changed: the
// organization id and the connection are supplied by the caller.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
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

pub fn insert_debt(
    conn: &Connection,
    organization_id: &str,
    input: DebtInput,
) -> Result<Debt, String> {
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
    let currency = input.currency.unwrap_or_else(|| "USD".to_string());
    let status = input.status.unwrap_or_else(|| "ACTIVE".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    conn.execute(
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

    db::log_audit(conn, "INSERT_DEBT", Some(&input.debtor_id), 1, "Inserted debt")?;

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
    conn: &Connection,
    organization_id: &str,
    id: &str,
    input: DebtInput,
) -> Result<Debt, String> {
    let ownership_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.id = ?1 AND b.organization_id = ?2",
        params![id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if ownership_ok == 0 {
        return Err("Debt not found or not in this organization".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let currency = input.currency.unwrap_or_else(|| "USD".to_string());
    let status = input.status.unwrap_or_else(|| "ACTIVE".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let affected = conn.execute(
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

    db::log_audit(conn, "UPDATE_DEBT", Some(&input.debtor_id), 1, "Updated debt")?;

    Ok(Debt {
        id: id.to_string(),
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

pub fn delete_debt(
    conn: &Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let affected = conn.execute(
        "DELETE FROM debts
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_DEBT", None, 1, "Deleted debt")?;
        Ok(true)
    } else {
        Ok(false)
    }
}