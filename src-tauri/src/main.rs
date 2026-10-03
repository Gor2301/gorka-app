// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use tauri::{command, Manager};
use chrono::Utc;
use std::sync::Mutex;
use rand::RngCore;
use gorka_shared::storage::AppStorage;
use gorka_shared::models::*;
use gorka_shared::enrollment::{build_enrollment_package, parse_enrollment_package};
use gorka_shared::sync_engine::{self, EngineHandle, EngineStatus};
use gorka_shared::sync_events;
use gorka_shared::debtors;
use gorka_shared::debts;
use gorka_shared::communications;
use gorka_shared::actions;
use gorka_shared::documents;
use gorka_shared::dashboard;

mod auth;

use gorka_shared::db;

struct AppState {
    db: Mutex<Option<Connection>>,
    db_key: Mutex<Option<String>>,
    engine: Mutex<Option<EngineHandle>>,
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
        let mut engine_guard = state.engine.lock().map_err(|e| e.to_string())?;
        if let Some(mut handle) = engine_guard.take() {
            handle.stop();
        }
    }
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    {
        let mut key_guard = state.db_key.lock().map_err(|e| e.to_string())?;
        *key_guard = None;
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
    println!("🔑 [RUST] unlock_database STARTED");
    println!("========================================");

    println!("📌 [RUST] Step 1: Getting salt...");
    let salt = match auth::get_salt(&app) {
        Ok(s) => {
            println!("✅ [RUST] Salt retrieved: {} bytes", s.len());
            s
        }
        Err(e) => {
            println!("❌ [RUST] Failed to get salt: {}", e);
            return Err(e);
        }
    };

    println!("📌 [RUST] Step 2: Deriving key from password...");
    let key = match db::derive_key(&password, &salt) {
        Ok(k) => {
            println!("✅ [RUST] Key derived successfully (length: {})", k.len());
            k
        }
        Err(e) => {
            println!("❌ [RUST] Key derivation failed: {}", e);
            return Err(format!("Key derivation failed: {}", e));
        }
    };

    println!("📌 [RUST] Step 3: Initializing database with key...");
    let conn = match db::init_db(&storage, &key) {
        Ok(c) => {
            println!("✅ [RUST] Database initialized successfully");
            c
        }
        Err(e) => {
            println!("❌ [RUST] Database init failed: {}", e);
            return Err(e);
        }
    };

    println!("📌 [RUST] Step 4: Verifying password...");
    match db::verify_password(&conn) {
        Ok(()) => println!("✅ [RUST] Password verified successfully"),
        Err(e) => {
            println!("❌ [RUST] Password verification failed: {}", e);
            return Err(e);
        }
    };

    println!("📌 [RUST] Step 5: Storing connection in app state...");
    let state = app.state::<AppState>();
    {
        let mut db_guard = match state.db.lock() {
            Ok(g) => g,
            Err(e) => {
                println!("❌ [RUST] Failed to lock db: {}", e);
                return Err(e.to_string());
            }
        };
        *db_guard = Some(conn);
    }
    {
        let mut key_guard = match state.db_key.lock() {
            Ok(g) => g,
            Err(e) => {
                println!("❌ [RUST] Failed to lock db_key: {}", e);
                return Err(e.to_string());
            }
        };
                *key_guard = Some(key);
    }
    println!("✅ [RUST] Connection and key stored in app state");

    println!("📌 [RUST] Step 6: Setting unlocked state...");
    match auth::set_unlocked(&app, true) {
        Ok(()) => println!("✅ [RUST] Unlocked state set successfully"),
        Err(e) => {
            println!("❌ [RUST] Failed to set unlocked state: {}", e);
            return Err(e);
        }
    };

    println!("========================================");
    println!("✅ [RUST] unlock_database COMPLETE");
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

    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;

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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    debtors::update_debtor(conn, &organization_id, &id, input)
}

#[command]
fn delete_debtor(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    debtors::delete_debtor(conn, &organization_id, &id)
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
    dashboard::get_dashboard_stats(conn, &organization_id)
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    debts::update_debt(conn, &organization_id, &id, input)
}

#[command]
fn delete_debt(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    actions::update_action(conn, &organization_id, &id, input)
}

#[command]
fn delete_action(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    communications::insert_communication(conn, &organization_id, input)
}

#[command]
fn delete_communication(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
    documents::upload_document(conn, &storage, input)
}

#[command]
fn get_documents(
    entity_id: String,
    entity_type: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Vec<Document>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    documents::get_documents(conn, &entity_id, entity_type.as_deref())
}

#[command]
fn delete_document(
    id: String,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    documents::delete_document(conn, &id)
}

#[command]
fn start_sync_engine(
    listen_port: u16,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<(), String> {
    let db_key: String = {
        let guard = state.db_key.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("Database not unlocked")?
    };

    {
        let guard = state.engine.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("Sync engine is already running".to_string());
        }
    }

    let port = if listen_port == 0 {
        auth::get_listen_port(&app)?.ok_or("No listen port provided and none stored")?
    } else {
        auth::set_listen_port(&app, listen_port)?;
        listen_port
    };

    let organization_id = get_trusted_organization_id(&app)?;

    let mut engine_conn = db::init_db(&storage, &db_key)?;

    let device_id = {
        let tx = engine_conn.transaction().map_err(|e| e.to_string())?;
        let did = sync_events::ensure_sync_state(&tx, &organization_id)?;
        tx.commit().map_err(|e| e.to_string())?;
        did
    };

    let key_bytes: Vec<u8> = engine_conn
        .query_row(
            "SELECT key_material FROM organization_keys WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| {
            "Organization key not found. Enable sync first.".to_string()
        })?;
    let organization_key: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "Organization key has wrong length".to_string())?;

    let handle = sync_engine::start_engine_listen(
        engine_conn,
        organization_id,
        organization_key,
        device_id,
        port,
    )?;

    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    *guard = Some(handle);

    Ok(())
}

#[command]
fn stop_sync_engine(state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    if let Some(mut handle) = guard.take() {
        handle.stop();
    }
    Ok(())
}

#[command]
fn sync_engine_status(state: tauri::State<AppState>) -> Result<String, String> {
    let guard = state.engine.lock().map_err(|e| e.to_string())?;
    let status_str = match guard.as_ref() {
        None => "disabled".to_string(),
        Some(handle) => match handle.status() {
            EngineStatus::Disabled => "disabled".to_string(),
            EngineStatus::Connecting => "connecting".to_string(),
            EngineStatus::Pending => "pending".to_string(),
            EngineStatus::Synced => "synced".to_string(),
            EngineStatus::Offline => "offline".to_string(),
            EngineStatus::Error(e) => format!("error: {}", e),
        },
    };
    Ok(status_str)
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

    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let existing: Option<i64> = tx
        .query_row("SELECT id FROM organization_keys WHERE id = 1", [], |row| row.get(0))
        .ok();

    if existing.is_some() {
        return Err("Sync is already enabled for this organization".to_string());
    }

    tx.execute(
        "INSERT INTO organization_keys (id, organization_id, key_material, created_at)
         VALUES (1, ?1, ?2, ?3)",
        params![&organization_id, &organization_key, Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

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
            db_key: Mutex::new(None),
            engine: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();

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
            start_sync_engine,
            stop_sync_engine,
            sync_engine_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}