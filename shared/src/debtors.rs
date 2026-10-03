// gorka-shared::debtors
//
// Debtor database operations. Moved from the Client Dashboard's
// Tauri command layer in Phase 9.5, slice "debtors".
//
// Every SQL string, parameter binding, row mapping, and audit
// call is preserved from the version that lived in
// src-tauri/src/main.rs.
//
// Phase 9.6 batch 2: every mutating function now opens a
// transaction, applies the state change, originates a
// sync_events row, and commits atomically. Delete is a soft
// delete: rows are marked deleted = 'true' and retained
// (SYNC-ARCHITECTURE.md Section 14.6). Read queries filter
// deleted rows out.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::sync;
use crate::sync_events;
use crate::storage::AppStorage;
use crate::models::{Debtor, DebtorInput, DebtorPhotoData, RelatedDebtorRole, DebtorDebtTotal, PrimaryDebtorRelation};

pub fn get_debtors(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<Debtor>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors WHERE organization_id = ?1 AND deleted != 'true'
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
         FROM debtors WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
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
    conn: &mut Connection,
    organization_id: &str,
    input: DebtorInput,
) -> Result<Debtor, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let data_json = serde_json::to_string(&input.data).unwrap_or_else(|_| "{}".to_string());

    let tx = conn.transaction().map_err(|e| e.to_string())?;

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
            &data_json,
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    let payload = sync::encode_debtor_created_payload(
        &input.name,
        &input.surname,
        input.email.as_deref(),
        input.phone.as_deref(),
        Some(&data_json),
    );
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_DEBTOR_CREATED,
        sync_events::ENTITY_DEBTOR,
        &id,
        &payload,
    )?;

    db::log_audit(&tx, "INSERT", Some(&id), 1, "Inserted debtor")?;

    tx.commit().map_err(|e| e.to_string())?;

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
        let data_json = serde_json::to_string(&input.data).unwrap_or_else(|_| "{}".to_string());

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
                &data_json,
                &now,
                &now,
            ],
        ).map_err(|e| e.to_string())?;

        let payload = sync::encode_debtor_created_payload(
            &input.name,
            &input.surname,
            input.email.as_deref(),
            input.phone.as_deref(),
            Some(&data_json),
        );
        sync_events::originate_event(
            &tx,
            organization_id,
            sync_events::EVENT_DEBTOR_CREATED,
            sync_events::ENTITY_DEBTOR,
            &id,
            &payload,
        )?;

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

    let count = inserted.len() as i64;
    db::log_audit(&tx, "BULK_INSERT", None, count, &format!("Inserted {} debtors", count))?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(inserted)
}

pub fn update_debtor(
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
    input: DebtorInput,
) -> Result<Debtor, String> {
    let now = Utc::now().to_rfc3339();
    let data_json = serde_json::to_string(&input.data).unwrap_or_else(|_| "{}".to_string());

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let affected = tx.execute(
        "UPDATE debtors
         SET name = ?1, surname = ?2, email = ?3, phone = ?4, data = ?5, updated_at = ?6
         WHERE id = ?7 AND organization_id = ?8",
        params![
            &input.name,
            &input.surname,
            &input.email,
            &input.phone,
            &data_json,
            &now,
            id,
            organization_id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let changes: Vec<(&str, Option<&str>)> = vec![
        ("name", Some(&input.name)),
        ("surname", Some(&input.surname)),
        ("email", input.email.as_deref()),
        ("phone", input.phone.as_deref()),
        ("data_json", Some(&data_json)),
    ];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_DEBTOR,
        id,
        &payload,
    )?;

    db::log_audit(&tx, "UPDATE", Some(id), 1, "Updated debtor")?;

    tx.commit().map_err(|e| e.to_string())?;

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
    conn: &mut Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let now = Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let affected = tx.execute(
        "UPDATE debtors SET deleted = 'true', updated_at = ?1
         WHERE id = ?2 AND organization_id = ?3 AND deleted != 'true'",
        params![&now, id, organization_id],
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
        sync_events::ENTITY_DEBTOR,
        id,
        &payload,
    )?;

    db::log_audit(&tx, "DELETE", Some(id), 1, "Deleted debtor (soft delete)")?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(true)
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
         AND deleted != 'true'
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
        "SELECT COUNT(*) FROM debtors WHERE organization_id = ?1 AND deleted != 'true'",
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

/// Read the debtor's profile photo from disk and return its bytes
/// together with the inferred MIME type.
///
/// Returns Ok(None) if the debtor has no photo_path, or if the
/// file recorded in photo_path no longer exists on disk. Returns
/// Err only for I/O failures that are not "file not found".
///
/// No organization scoping. Matches set_debtor_photo and
/// get_debtor_photo, which also do not scope.
pub fn read_debtor_photo(
    conn: &Connection,
    debtor_id: &str,
) -> Result<Option<DebtorPhotoData>, String> {
    let photo_path: Option<String> = conn
        .query_row(
            "SELECT photo_path FROM debtors WHERE id = ?1",
            params![debtor_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let path = match photo_path {
        Some(p) if !p.is_empty() => p,
        _ => return Ok(None),
    };

    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Failed to read photo: {}", e)),
    };

    let mime = mime_from_extension(&path).to_string();

    Ok(Some(DebtorPhotoData { bytes, mime }))
}

fn mime_from_extension(path: &str) -> &'static str {
    let ext = path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

pub fn get_related_debtor_roles(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<RelatedDebtorRole>, String> {
    let mut stmt = conn.prepare(
        "SELECT related_debtor_id, relation_type
         FROM debtor_relations
         WHERE organization_id = ?1"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([organization_id], |row| {
        Ok(RelatedDebtorRole {
            debtor_id: row.get(0)?,
            relation_type: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut roles = Vec::new();
    for row in rows {
        roles.push(row.map_err(|e| e.to_string())?);
    }

    Ok(roles)
}

pub fn get_debtor_debt_totals(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<DebtorDebtTotal>, String> {
    let mut stmt = conn.prepare(
        "SELECT d.debtor_id, d.currency, COALESCE(SUM(d.amount), 0) AS total
         FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE b.organization_id = ?1
           AND b.deleted != 'true'
           AND d.status NOT IN ('PAID', 'CANCELLED')
         GROUP BY d.debtor_id, d.currency
         ORDER BY d.debtor_id, d.currency"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([organization_id], |row| {
        Ok(DebtorDebtTotal {
            debtor_id: row.get(0)?,
            currency: row.get(1)?,
            total_amount: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut totals = Vec::new();
    for row in rows {
        totals.push(row.map_err(|e| e.to_string())?);
    }

    Ok(totals)
}

pub fn insert_related_debtor(
    conn: &mut Connection,
    organization_id: &str,
    input: DebtorInput,
    role: &str,
) -> Result<Debtor, String> {
    match role {
        "GUARANTOR" | "PLEDGER" => {}
        _ => return Err("Invalid role".to_string()),
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let data_json = serde_json::to_string(&input.data).unwrap_or_else(|_| "{}".to_string());

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone, data, role, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            organization_id,
            &input.name,
            &input.surname,
            &input.email,
            &input.phone,
            &data_json,
            role,
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    let payload = sync::encode_debtor_created_payload(
        &input.name,
        &input.surname,
        input.email.as_deref(),
        input.phone.as_deref(),
        Some(&data_json),
    );
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_DEBTOR_CREATED,
        sync_events::ENTITY_DEBTOR,
        &id,
        &payload,
    )?;

    db::log_audit(&tx, "INSERT_RELATED_DEBTOR", Some(&id), 1, "Inserted related debtor")?;

    tx.commit().map_err(|e| e.to_string())?;

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

fn is_orphaned_related_debtor(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<bool, String> {
    let relations: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtor_relations
         WHERE organization_id = ?1
           AND (debtor_id = ?2 OR related_debtor_id = ?2)",
        params![organization_id, debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if relations > 0 {
        return Ok(false);
    }

    let debts: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debts WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debts > 0 {
        return Ok(false);
    }

    let comms: i64 = conn.query_row(
        "SELECT COUNT(*) FROM communications WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if comms > 0 {
        return Ok(false);
    }

    let acts: i64 = conn.query_row(
        "SELECT COUNT(*) FROM actions WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if acts > 0 {
        return Ok(false);
    }

    let docs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE entity_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if docs > 0 {
        return Ok(false);
    }

    Ok(true)
}

pub fn cleanup_orphaned_related_debtors(
    conn: &Connection,
    storage: &AppStorage,
    organization_id: &str,
) -> Result<u32, String> {
    let ids: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT id FROM debtors
             WHERE organization_id = ?1 AND role != 'DEBTOR' AND deleted != 'true'"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([organization_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        let mut collected: Vec<String> = Vec::new();
        for row in rows {
            collected.push(row.map_err(|e| e.to_string())?);
        }
        collected
    };

    let mut removed: u32 = 0;
    for id in ids {
        if is_orphaned_related_debtor(conn, organization_id, &id)? {
            conn.execute(
                "DELETE FROM debtors WHERE id = ?1 AND organization_id = ?2",
                params![&id, organization_id],
            ).map_err(|e| e.to_string())?;

            if let Ok(dir) = db::get_debtor_files_dir(storage, &id) {
                if dir.exists() {
                    let _ = std::fs::remove_dir_all(&dir);
                }
            }
            removed += 1;
        }
    }

    if removed > 0 {
        db::log_audit(
            conn,
            "CLEANUP_ORPHANS",
            None,
            removed as i64,
            "Cleaned orphaned related debtors",
        )?;
    }

    Ok(removed)
}

pub fn get_primary_debtors(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<Debtor>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors
         WHERE organization_id = ?1 AND role = 'DEBTOR' AND deleted != 'true'
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

pub fn search_primary_debtors(
    conn: &Connection,
    organization_id: &str,
    query: &str,
) -> Result<Vec<Debtor>, String> {
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors
         WHERE organization_id = ?1
         AND role = 'DEBTOR'
         AND deleted != 'true'
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

pub fn get_primary_debtor_relations(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<PrimaryDebtorRelation>, String> {
    let mut stmt = conn.prepare(
        "SELECT debtor_id, relation_type
         FROM debtor_relations
         WHERE organization_id = ?1"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([organization_id], |row| {
        Ok(PrimaryDebtorRelation {
            debtor_id: row.get(0)?,
            relation_type: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut relations = Vec::new();
    for row in rows {
        relations.push(row.map_err(|e| e.to_string())?);
    }

    Ok(relations)
}