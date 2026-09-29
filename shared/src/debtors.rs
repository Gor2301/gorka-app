// gorka-shared::debtors
//
// Debtor database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "debtors".
//
// Every SQL string, parameter binding, row mapping, transaction
// boundary, and audit call is identical to the code that lived
// in src-tauri/src/main.rs. Only the signatures changed: the
// organization id, the connection, and any needed storage context
// are supplied by the caller.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::storage::AppStorage;
use crate::models::{Debtor, DebtorInput};

pub fn get_debtors(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<Debtor>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors WHERE organization_id = ?1
         ORDER BY surname, name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([organization_id], |row| {
        let data_json: String = row.get(6)?;
        Ok(Debtor {
            id: row.get(0)?,
            organization_id: row.get(1)?,
            name: row.get(2)?,
            surname: row.get(3)?,
            email: row.get(4)?,
            phone: row.get(5)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut debtors = Vec::new();
    for row in rows {
        debtors.push(row.map_err(|e| e.to_string())?);
    }

    Ok(debtors)
}

pub fn get_debtor(
    conn: &Connection,
    organization_id: &str,
    id: &str,
) -> Result<Debtor, String> {
    let debtor = conn.query_row(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![id, organization_id],
        |row| {
            let data_json: String = row.get(6)?;
            Ok(Debtor {
                id: row.get(0)?,
                organization_id: row.get(1)?,
                name: row.get(2)?,
                surname: row.get(3)?,
                email: row.get(4)?,
                phone: row.get(5)?,
                data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    Ok(debtor)
}

pub fn insert_debtor(
    conn: &Connection,
    organization_id: &str,
    input: DebtorInput,
) -> Result<Debtor, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            organization_id,
            &input.name,
            &input.surname,
            &input.email,
            &input.phone,
            &serde_json::to_string(&input.data).unwrap_or("{}".to_string()),
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "INSERT", Some(&id), 1, "Inserted debtor")?;

    Ok(Debtor {
        id,
        organization_id: organization_id.to_string(),
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone,
        data: input.data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn bulk_insert_debtors(
    conn: &mut Connection,
    organization_id: &str,
    inputs: Vec<DebtorInput>,
) -> Result<Vec<Debtor>, String> {
    let now = Utc::now().to_rfc3339();
    let mut inserted = Vec::new();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for input in inputs {
        let id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO debtors (id, organization_id, name, surname, email, phone, data, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &id,
                organization_id,
                &input.name,
                &input.surname,
                &input.email,
                &input.phone,
                &serde_json::to_string(&input.data).unwrap_or("{}".to_string()),
                &now,
                &now,
            ],
        ).map_err(|e| e.to_string())?;

        inserted.push(Debtor {
            id,
            organization_id: organization_id.to_string(),
            name: input.name,
            surname: input.surname,
            email: input.email,
            phone: input.phone,
            data: input.data,
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    }

    tx.commit().map_err(|e| e.to_string())?;

    let count = inserted.len() as i64;
    db::log_audit(conn, "BULK_INSERT", None, count, &format!("Inserted {} debtors", count))?;

    Ok(inserted)
}

pub fn update_debtor(
    conn: &Connection,
    organization_id: &str,
    id: &str,
    input: DebtorInput,
) -> Result<Debtor, String> {
    let now = Utc::now().to_rfc3339();

    let affected = conn.execute(
        "UPDATE debtors
         SET name = ?1, surname = ?2, email = ?3, phone = ?4, data = ?5, updated_at = ?6
         WHERE id = ?7 AND organization_id = ?8",
        params![
            &input.name,
            &input.surname,
            &input.email,
            &input.phone,
            &serde_json::to_string(&input.data).unwrap_or("{}".to_string()),
            &now,
            id,
            organization_id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    db::log_audit(conn, "UPDATE", Some(id), 1, "Updated debtor")?;

    Ok(Debtor {
        id: id.to_string(),
        organization_id: organization_id.to_string(),
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone,
        data: input.data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn delete_debtor(
    conn: &Connection,
    storage: &AppStorage,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let affected = conn.execute(
        "DELETE FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        let debtor_dir = db::get_debtor_files_dir(storage, id)?;
        if debtor_dir.exists() {
            std::fs::remove_dir_all(&debtor_dir)
                .map_err(|e| format!("Failed to delete debtor files: {}", e))?;
        }

        db::log_audit(conn, "DELETE", Some(id), 1, "Deleted debtor")?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn search_debtors(
    conn: &Connection,
    organization_id: &str,
    query: &str,
) -> Result<Vec<Debtor>, String> {
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors
         WHERE organization_id = ?1
         AND (name LIKE ?2 OR surname LIKE ?2 OR email LIKE ?2 OR phone LIKE ?2
         OR json_extract(data, '$.contacts.phone1') LIKE ?2
         OR json_extract(data, '$.contacts.email1') LIKE ?2
         OR json_extract(data, '$.guarantor.name') LIKE ?2)
         ORDER BY surname, name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([organization_id, &search_pattern], |row| {
        let data_json: String = row.get(6)?;
        Ok(Debtor {
            id: row.get(0)?,
            organization_id: row.get(1)?,
            name: row.get(2)?,
            surname: row.get(3)?,
            email: row.get(4)?,
            phone: row.get(5)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut debtors = Vec::new();
    for row in rows {
        debtors.push(row.map_err(|e| e.to_string())?);
    }

    Ok(debtors)
}

pub fn get_debtor_count(
    conn: &Connection,
    organization_id: &str,
) -> Result<i64, String> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE organization_id = ?1",
        params![organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(count)
}

pub fn set_debtor_photo(
    conn: &Connection,
    storage: &AppStorage,
    debtor_id: &str,
    source_file_path: &str,
) -> Result<(), String> {
    Uuid::parse_str(debtor_id)
        .map_err(|_| format!("Invalid debtor_id format: {}", debtor_id))?;

    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("Debtor not found".to_string());
    }

    let debtor_dir = db::get_debtor_files_dir(storage, debtor_id)?;

    if let Ok(entries) = std::fs::read_dir(&debtor_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("photo.") && path.is_file() {
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }

    let file_extension = source_file_path
        .split('.')
        .last()
        .unwrap_or("bin");

    let target_path = debtor_dir.join(format!("photo.{}", file_extension));
    std::fs::copy(source_file_path, &target_path)
        .map_err(|e| format!("Failed to save photo: {}", e))?;

    let target_path_str = target_path.to_string_lossy().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE debtors SET photo_path = ?1, updated_at = ?2 WHERE id = ?3",
        params![&target_path_str, &now, debtor_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_debtor_photo(
    conn: &Connection,
    debtor_id: &str,
) -> Result<Option<String>, String> {
    let photo_path: Option<String> = conn
        .query_row(
            "SELECT photo_path FROM debtors WHERE id = ?1",
            params![debtor_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    Ok(photo_path)
}
