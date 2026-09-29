// src-tauri-agent/src/main.rs
//
// GORKA Agent Dashboard. Phase 9.5.
//
// The Agent is the second Tauri binary in the GORKA repository.
// It shares the Tauri-free gorka-shared crate with the Client
// Dashboard. The Agent has its own bundle identifier, its own app
// data folder, its own settings.dat, and its own SQLCipher
// database file.
//
// Stage C.1 wires the Agent's authentication foundation: login,
// unlock, logout, and the session reads the entry flow requires.
// CRUD adapters (debtors, debts, communications, actions,
// documents) follow in C.2; the Stage B adapters (photo,
// calendar, relations) in C.3; enrollment in C.4.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{command, Manager};
use gorka_shared::storage::AppStorage;
use gorka_shared::db;

mod auth;

/// Application state for the Agent binary. Holds the unlocked
/// SQLCipher connection, if any. Mirrors the Client's AppState.
struct AppState {
    db: Mutex<Option<Connection>>,
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
fn get_salt(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    auth::get_salt(&app)
}

#[command]
fn get_organization_id(app: tauri::AppHandle) -> Result<String, String> {
    auth::get_organization_id(app)
}

#[command]
fn database_exists(storage: tauri::State<AppStorage>) -> bool {
    db::database_exists(&storage)
}

#[command]
fn unlock_database(
    password: String,
    app: tauri::AppHandle,
    storage: tauri::State<AppStorage>,
) -> Result<(), String> {
    let salt = auth::get_salt(&app)?;
    let key = db::derive_key(&password, &salt)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    let conn = db::init_db(&storage, &key)?;
    db::verify_password(&conn)?;

    let state = app.state::<AppState>();
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(conn);

    auth::set_unlocked(&app, true)?;

    Ok(())
}

#[command]
fn is_database_unlocked(state: tauri::State<AppState>) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db_guard.is_some())
}

#[command]
fn logout(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    auth::logout(app)
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
                "gorka-agent.db",
                "data/files",
            );

            storage.ensure_dirs().map_err(|e| {
                Box::<dyn std::error::Error>::from(format!(
                    "Failed to create Agent data directories: {}", e
                ))
            })?;

            app.manage(storage);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            get_auth_token,
            get_salt,
            get_organization_id,
            database_exists,
            unlock_database,
            is_database_unlocked,
            logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}