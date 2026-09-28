// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use tauri::{command, Manager};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Mutex;
use rand::RngCore;
use gorka_shared::storage::AppStorage;
use gorka_shared::models::*;
use gorka_shared::enrollment::{build_enrollment_package, parse_enrollment_package};
use gorka_shared::debtors;
use gorka_shared::debts;
use gorka_shared::communications;
use gorka_shared::actions;

mod auth;
mod storage_migration;

use gorka_shared::db;

struct AppState {
    db: Mutex<Option<Connection>>,
}

fn get_trusted_organization_id(app: &tauri::AppHandle) -> Result<String, String> {
    auth::get_organization_id(app.clone())
}

#[command]
async fn login(
    email: String,
    password: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    auth::login(email, password, app).await
}

#[command]
fn get_auth_token(app: tauri::AppHandle) -> Result<String, String> {
    auth::get_token(app)
}

#[command]
fn logout(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    auth::logout(app)
}

#[command]
fn get_organization_id(app: tauri::AppHandle) -> Result<String, String> {
    auth::get_organization_id(app)
}

#[command]
fn get_salt(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    auth::get_salt(&app)
}


#[command]
fn database_exists(storage: tauri::State<AppStorage>) -> bool {
    db::database_exists(&storage)
}

#[command]
fn unlock_database(password: String, app: tauri::AppHandle, storage: tauri::State<AppStorage>) -> Result<(), String> {
    println!("========================================");
    println!("ðŸ”‘ [RUST] unlock_database STARTED");
    println!("========================================");

    println!("ðŸ“Œ [RUST] Step 1: Getting salt...");
    let salt = match auth::get_salt(&app) {
        Ok(s) => {
            println!("âœ… [RUST] Salt retrieved: {} bytes", s.len());
            s
        }
        Err(e) => {
            println!("âŒ [RUST] Failed to get salt: {}", e);
            return Err(e);
        }
    };

    println!("ðŸ“Œ [RUST] Step 2: Deriving key from password...");
    let key = match db::derive_key(&password, &salt) {
        Ok(k) => {
            println!("âœ… [RUST] Key derived successfully (length: {})", k.len());
            k
        }
        Err(e) => {
            println!("âŒ [RUST] Key derivation failed: {}", e);
            return Err(format!("Key derivation failed: {}", e));
        }
    };

    println!("ðŸ“Œ [RUST] Step 3: Initializing database with key...");
    let conn = match db::init_db(&storage, &key) {
        Ok(c) => {
            println!("âœ… [RUST] Database initialized successfully");
            c
        }
        Err(e) => {
            println!("âŒ [RUST] Database init failed: {}", e);
            return Err(e);
        }
    };

    println!("ðŸ“Œ [RUST] Step 4: Verifying password...");
    match db::verify_password(&conn) {
        Ok(()) => println!("âœ… [RUST] Password verified successfully"),
        Err(e) => {
            println!("âŒ [RUST] Password verification failed: {}", e);
            return Err(e);
        }
    };

    println!("ðŸ“Œ [RUST] Step 5: Storing connection in app state...");
    let state = app.state::<AppState>();
    let mut db_guard = match state.db.lock() {
        Ok(g) => g,
        Err(e) => {
            println!("âŒ [RUST] Failed to lock db: {}", e);
            return Err(e.to_string());
        }
    };
    *db_guard = Some(conn);
    println!("âœ… [RUST] Connection stored in app state");

    println!("ðŸ“Œ [RUST] Step 6: Setting unlocked state...");
    match auth::set_unlocked(&app, true) {
        Ok(()) => println!("âœ… [RUST] Unlocked state set successfully"),
        Err(e) => {
            println!("âŒ [RUST] Failed to set unlocked state: {}", e);
            return Err(e);
        }
    };

    println!("========================================");
    println!("âœ… [RUST] unlock_database COMPLETE");
    println!("========================================");

    Ok(())
}

#[command]
fn is_database_unlocked(state: tauri::State<AppState>) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db_guard.is_some())
}

#[command]
fn enable_sync(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM organization_keys WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return Err("Sync is already enabled for this organization".to_string());
    }

    let mut key_material = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key_material);

    conn.execute(
        "INSERT INTO organization_keys (id, organization_id, key_material, created_at)
         VALUES (1, ?1, ?2, ?3)",
        params![&organization_id, &key_material[..], Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
#[command]
fn get_debtors(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_debtors(conn, &organization_id)
}

#[command]
fn get_debtor(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_debtor(conn, &organization_id, &id)
}

#[command]
fn insert_debtor(
    input: DebtorInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::insert_debtor(conn, &organization_id, input)
}

#[command]
fn bulk_insert_debtors(
    inputs: Vec<DebtorInput>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    debtors::bulk_insert_debtors(conn, &organization_id, inputs)
}

#[command]
fn update_debtor(
    id: String,
    input: DebtorInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::update_debtor(conn, &organization_id, &id, input)
}

#[command]
fn delete_debtor(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::delete_debtor(conn, &storage, &organization_id, &id)
}

#[command]
fn search_debtors(
    query: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::search_debtors(conn, &organization_id, &query)
}

#[command]
fn get_debtor_count(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<i64, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_debtor_count(conn, &organization_id)
}
#[command]
fn get_dashboard_stats(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<DashboardStats, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let stats = conn.query_row(
        "SELECT
            (SELECT COUNT(*) FROM debtors
               WHERE organization_id = ?1) AS total_debtors,
            (SELECT COALESCE(SUM(d.amount), 0)
               FROM debts d
               INNER JOIN debtors b ON b.id = d.debtor_id
               WHERE b.organization_id = ?1
                 AND d.status NOT IN ('PAID', 'CANCELLED')) AS total_debt,
            (SELECT COUNT(*) FROM actions a
               INNER JOIN debtors b ON b.id = a.debtor_id
               WHERE b.organization_id = ?1) AS total_actions",
        params![&organization_id],
        |row| Ok(DashboardStats {
            total_debtors: row.get(0)?,
            total_debt: row.get(1)?,
            total_actions: row.get(2)?,
        }),
    ).map_err(|e| e.to_string())?;

    Ok(stats)
}

#[command]
fn get_debts(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debt>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debts::get_debts(conn, &organization_id, &debtor_id)
}

#[command]
fn insert_debt(
    input: DebtInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debt, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debts::insert_debt(conn, &organization_id, input)
}

#[command]
fn update_debt(
    id: String,
    input: DebtInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debt, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debts::update_debt(conn, &organization_id, &id, input)
}

#[command]
fn delete_debt(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debts::delete_debt(conn, &organization_id, &id)
}


#[command]
fn get_actions(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Action>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    actions::get_actions(conn, &organization_id, &debtor_id)
}

#[command]
fn insert_action(
    input: ActionInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Action, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    actions::insert_action(conn, &organization_id, input)
}

#[command]
fn update_action(
    id: String,
    input: ActionInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Action, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    actions::update_action(conn, &organization_id, &id, input)
}

#[command]
fn delete_action(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    actions::delete_action(conn, &organization_id, &id)
}

#[command]
fn get_communications(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Communication>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    communications::get_communications(conn, &organization_id, &debtor_id)
}

#[command]
fn insert_communication(
    input: CommunicationInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Communication, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    communications::insert_communication(conn, &organization_id, input)
}

#[command]
fn delete_communication(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    communications::delete_communication(conn, &organization_id, &id)
}

#[command]
fn upload_document(
    input: DocumentInput,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<Document, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

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

    let debtor_dir = db::get_debtor_files_dir(&storage, &input.entity_id)?;
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

#[command]
fn get_documents(
    entity_id: String,
    entity_type: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Vec<Document>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let mut query = String::from(
        "SELECT id, entity_id, entity_type, file_name, file_path, file_type,
                file_size, category, description, uploaded_by, is_primary, created_at
         FROM documents WHERE entity_id = ?1"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(entity_id)];

    if let Some(et) = entity_type {
        query.push_str(" AND entity_type = ?2");
        params.push(Box::new(et));
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

#[command]
fn delete_document(
    id: String,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let file_path: String = conn.query_row(
        "SELECT file_path FROM documents WHERE id = ?1",
        params![&id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if let Err(e) = std::fs::remove_file(&file_path) {
        eprintln!("Failed to delete file: {}", e);
    }

    let affected = conn.execute(
        "DELETE FROM documents WHERE id = ?1",
        params![&id],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "DELETE_DOC", None, 1, &format!("Deleted document: {}", id))?;

    Ok(affected > 0)
}


#[command]
fn export_enrollment_package(
    passphrase: String,
    file_path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let (key_org_id, key_material): (String, Vec<u8>) = conn
        .query_row(
            "SELECT organization_id, key_material FROM organization_keys WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Sync is not enabled for this organization".to_string())?;

    if key_org_id != organization_id {
        return Err("Organization mismatch".to_string());
    }

    if key_material.len() != 32 {
        return Err("Invalid organization key length".to_string());
    }

    // Fresh random salt (16 bytes) and nonce (24 bytes).
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    let package = build_enrollment_package(
        &passphrase,
        &key_org_id,
        &key_material,
        &salt,
        &nonce_bytes,
    )?;

    std::fs::write(&file_path, &package)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(file_path)
}
#[command]
fn import_enrollment_package(
    passphrase: String,
    file_path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;

    // Read the package file.
    let file = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let organization_key = parse_enrollment_package(&file, &passphrase, &organization_id)?;
    // Begin the transaction.
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Check for an existing key inside the transaction.
    let existing: Option<i64> = tx
        .query_row("SELECT id FROM organization_keys WHERE id = 1", [], |row| row.get(0))
        .ok();

    if existing.is_some() {
        return Err("Sync is already enabled for this organization".to_string());
    }

    // Insert the key.
    tx.execute(
        "INSERT INTO organization_keys (id, organization_id, key_material, created_at)
         VALUES (1, ?1, ?2, ?3)",
        params![&organization_id, &organization_key, Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;

    // Commit.
    tx.commit().map_err(|e| e.to_string())?;

    // Delete the package file after commit. Failure is logged, not fatal.
    if let Err(e) = std::fs::remove_file(&file_path) {
        eprintln!("Failed to delete package file: {}", e);
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            db: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Phase 2B: one-time storage-root migration.
            // Runs before any code path can open the database.
            storage_migration::migrate_client_storage_if_needed(&handle)
                .map_err(|e| {
                    eprintln!("[setup] storage migration failed: {}", e);
                    Box::<dyn std::error::Error>::from(e)
                })?;

            // Construct the Client's AppStorage and place it in
            // managed state. Shared code consumes it via
            // tauri::State<AppStorage>.
            let app_data_dir = handle
                .path()
                .app_data_dir()
                .map_err(|e| {
                    Box::<dyn std::error::Error>::from(format!(
                        "Failed to resolve app data dir: {}", e
                    ))
                })?;

            let storage = AppStorage::new(
                app_data_dir,
                "gorka-client.db",
                "data/files",
            );

            app.manage(storage);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            get_auth_token,
            get_salt,
            database_exists,
            logout,
            get_organization_id,
            unlock_database,
            is_database_unlocked,
            enable_sync,
            get_debtors,
            get_debtor,
            insert_debtor,
            bulk_insert_debtors,
            update_debtor,
            delete_debtor,
            search_debtors,
            get_debtor_count,
            get_dashboard_stats,
            get_debts,
            insert_debt,
            update_debt,
            delete_debt,
            get_communications,
            insert_communication,
            delete_communication,
            get_actions,
            insert_action,
            update_action,
            delete_action,
            upload_document,
            get_documents,
            delete_document,
            export_enrollment_package,
            import_enrollment_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
