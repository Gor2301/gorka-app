// gorka-shared::documents
//
// Document database and filesystem operations. Moved from the
// Client Dashboard's Tauri command layer in Phase 9.5, slice
// "documents".
//
// Every SQL string, parameter binding, row mapping, filesystem
// call, and audit call is identical to the code that lived in
// src-tauri/src/main.rs. Only the signatures changed: the
// connection and any needed storage context are supplied by
// the caller.
//
// These commands do NOT perform organization scoping. That is
// the existing behavior. Preserved exactly. Not added here.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::storage::AppStorage;
use crate::models::{Document, DocumentInput, DocumentCategory};

pub fn upload_document(
    conn: &Connection,
    storage: &AppStorage,
    input: DocumentInput,
) -> Result<Document, String> {
    Uuid::parse_str(&input.entity_id)
        .map_err(|_| format!("Invalid entity_id format: {}", input.entity_id))?;

    let category = match input.category.as_str() {
        "profile_photo" => DocumentCategory::ProfilePhoto,
        "id_card" => DocumentCategory::IdCard,
        "passport" => DocumentCategory::Passport,
        "driver_license" => DocumentCategory::DriverLicense,
        "contract" => DocumentCategory::Contract,
        "proof_of_address" => DocumentCategory::ProofOfAddress,
        "income_proof" => DocumentCategory::IncomeProof,
        "collateral_photo" => DocumentCategory::CollateralPhoto,
        "other" => DocumentCategory::Other,
        _ => return Err("Invalid document category".to_string()),
    };

    let category_str = category.as_str();
    let id = Uuid::new_v4().to_string();

    let debtor_dir = db::get_debtor_files_dir(storage, &input.entity_id)?;
    let docs_dir = debtor_dir.join("documents");
    std::fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;

    let file_extension = input.file_name
        .split('.')
        .last()
        .unwrap_or("bin");

    let timestamp = Utc::now().timestamp();
    let unique_name = format!("{}_{}.{}", category_str, timestamp, file_extension);
    let file_path = docs_dir.join(&unique_name);

    std::fs::write(&file_path, input.file_content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    let file_size = std::fs::metadata(&file_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let file_path_str = file_path.to_string_lossy().to_string();
    let is_primary = input.is_primary.unwrap_or(false);

    if is_primary && input.category == "profile_photo" {
        conn.execute(
            "UPDATE documents SET is_primary = 0
             WHERE entity_id = ?1 AND category = ?2",
            params![&input.entity_id, &category_str],
        ).map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO documents (
            id, entity_id, entity_type, file_name, file_path, file_type,
            file_size, category, description, uploaded_by, is_primary, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            &id,
            &input.entity_id,
            &input.entity_type,
            &input.file_name,
            &file_path_str,
            &input.file_type,
            file_size,
            &category_str,
            &input.description,
            &input.uploaded_by,
            is_primary,
            &Utc::now().to_rfc3339(),
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(
        conn,
        "UPLOAD_DOC",
        Some(&input.entity_id),
        1,
        &format!("Uploaded document: category={}", category_str),
    )?;

    Ok(Document {
        id,
        entity_id: input.entity_id,
        entity_type: input.entity_type,
        file_name: input.file_name,
        file_path: file_path_str,
        file_type: input.file_type,
        file_size,
        category: category_str.to_string(),
        description: input.description,
        uploaded_by: input.uploaded_by,
        is_primary,
        created_at: Utc::now().to_rfc3339(),
    })
}

pub fn get_documents(
    conn: &Connection,
    entity_id: &str,
    entity_type: Option<&str>,
) -> Result<Vec<Document>, String> {
    let mut query = String::from(
        "SELECT id, entity_id, entity_type, file_name, file_path, file_type,
                file_size, category, description, uploaded_by, is_primary, created_at
         FROM documents WHERE entity_id = ?1"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(entity_id.to_string())];

    if let Some(et) = entity_type {
        query.push_str(" AND entity_type = ?2");
        params.push(Box::new(et.to_string()));
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(Document {
            id: row.get(0)?,
            entity_id: row.get(1)?,
            entity_type: row.get(2)?,
            file_name: row.get(3)?,
            file_path: row.get(4)?,
            file_type: row.get(5)?,
            file_size: row.get(6)?,
            category: row.get(7)?,
            description: row.get(8)?,
            uploaded_by: row.get(9)?,
            is_primary: row.get(10)?,
            created_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut documents = Vec::new();
    for row in rows {
        documents.push(row.map_err(|e| e.to_string())?);
    }

    Ok(documents)
}

pub fn delete_document(
    conn: &Connection,
    id: &str,
) -> Result<bool, String> {
    let file_path: String = conn.query_row(
        "SELECT file_path FROM documents WHERE id = ?1",
        params![id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if let Err(e) = std::fs::remove_file(&file_path) {
        eprintln!("Failed to delete file: {}", e);
    }

    let affected = conn.execute(
        "DELETE FROM documents WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "DELETE_DOC", None, 1, &format!("Deleted document: {}", id))?;

    Ok(affected > 0)
}