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
// Stage C.2 adds the CRUD adapters (debtors, debts,
// communications, actions, documents). Stage C.3 adds the Stage B
// adapters (photo, calendar, relations). Stage C.4 adds the
// enrollment import command.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use rusqlite::{params, Connection};
use tauri::{command, Manager};
use chrono::Utc;
use gorka_shared::storage::AppStorage;
use gorka_shared::models::*;
use gorka_shared::db;
use gorka_shared::debtors;
use gorka_shared::debts;
use gorka_shared::communications;
use gorka_shared::actions;
use gorka_shared::documents;
use gorka_shared::calendar;
use gorka_shared::relations;
use gorka_shared::enrollment::parse_enrollment_package;

mod auth;

/// Application state for the Agent binary. Holds the unlocked
/// SQLCipher connection, if any. Mirrors the Client's AppState.
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
fn is_enrolled(state: tauri::State<AppState>) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    db::is_enrolled(conn)
}

#[command]
fn logout(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    auth::logout(app)
}

// ---------------------------------------------------------------------
// Stage C.2 - CRUD adapters.
//
// Each adapter mirrors the Client's equivalent in
// src-tauri/src/main.rs. Thin wrapper: lock AppState, acquire the
// trusted organization id where applicable, call the shared
// function.
//
// Documents commands do NOT perform organization scoping. That is
// the Client's existing behavior (Slice 5 preserved it); the Agent
// mirrors it. No Agent-only behavior is introduced here.
// ---------------------------------------------------------------------

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
fn get_related_debtor_roles(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<RelatedDebtorRole>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_related_debtor_roles(conn, &organization_id)
}

#[command]
fn get_debtor_debt_totals(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<DebtorDebtTotal>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_debtor_debt_totals(conn, &organization_id)
}

#[command]
fn insert_related_debtor(
    input: DebtorInput,
    role: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::insert_related_debtor(conn, &organization_id, input, &role)
}

#[command]
fn cleanup_orphaned_related_debtors(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<u32, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::cleanup_orphaned_related_debtors(conn, &storage, &organization_id)
}
#[command]
fn get_primary_debtors(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_primary_debtors(conn, &organization_id)
}

#[command]
fn search_primary_debtors(
    query: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<Debtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::search_primary_debtors(conn, &organization_id, &query)
}

#[command]
fn get_primary_debtor_relations(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<PrimaryDebtorRelation>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_primary_debtor_relations(conn, &organization_id)
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

// ---------------------------------------------------------------------
// Stage C.3 - Stage B adapters.
//
// Photo commands do NOT perform organization scoping, matching
// the shared functions in Stage B.1 and the Slice 5 documents
// precedent. Calendar and relations commands DO acquire the
// trusted organization id via the helper, per LOCAL-TABLES.md
// v1.3 Amendment 1. The asymmetry is intentional.
// ---------------------------------------------------------------------

#[command]
fn set_debtor_photo(
    debtor_id: String,
    source_file_path: String,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::set_debtor_photo(conn, &storage, &debtor_id, &source_file_path)
}

#[command]
fn get_debtor_photo(
    debtor_id: String,
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::get_debtor_photo(conn, &debtor_id)
}

#[command]
fn read_debtor_photo(
    debtor_id: String,
    state: tauri::State<AppState>,
) -> Result<Option<DebtorPhotoData>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    debtors::read_debtor_photo(conn, &debtor_id)
}

#[command]
fn get_calendar_events(
    start_date: String,
    end_date: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<CalendarEvent>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::get_calendar_events(conn, &organization_id, &start_date, &end_date)
}

#[command]
fn insert_calendar_event(
    input: CalendarEventInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<CalendarEvent, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::insert_calendar_event(conn, &organization_id, input)
}

#[command]
fn update_calendar_event(
    id: String,
    input: CalendarEventInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<CalendarEvent, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::update_calendar_event(conn, &organization_id, &id, input)
}

#[command]
fn delete_calendar_event(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::delete_calendar_event(conn, &organization_id, &id)
}

#[command]
fn get_upcoming_payments(
    start_date: String,
    end_date: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<UpcomingPayment>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::get_upcoming_payments(conn, &organization_id, &start_date, &end_date)
}

#[command]
fn get_upcoming_followups(
    start_date: String,
    end_date: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<UpcomingFollowup>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    calendar::get_upcoming_followups(conn, &organization_id, &start_date, &end_date)
}

#[command]
fn get_debtor_relations(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<DebtorRelation>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    relations::get_debtor_relations(conn, &organization_id, &debtor_id)
}

#[command]
fn insert_debtor_relation(
    input: DebtorRelationInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<DebtorRelation, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    relations::insert_debtor_relation(conn, &organization_id, input)
}

#[command]
fn delete_debtor_relation(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    relations::delete_debtor_relation(conn, &storage, &organization_id, &id)
}

// ---------------------------------------------------------------------
// Stage C.4 - Enrollment import.
//
// Mirrors the Client's import_enrollment_package exactly. The
// Agent imports an enrollment package exported by the admin's
// Client Dashboard. Export is Client-only (spec 6.4) and is not
// added to the Agent.
// ---------------------------------------------------------------------

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
            is_enrolled,
            logout,
            get_debtors,
            get_debtor,
            insert_debtor,
            update_debtor,
            delete_debtor,
            search_debtors,
            get_debtor_count,
            get_related_debtor_roles,
            get_debtor_debt_totals,
            insert_related_debtor,
            cleanup_orphaned_related_debtors,
            get_primary_debtors,
            search_primary_debtors,
            get_primary_debtor_relations,
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
            set_debtor_photo,
            get_debtor_photo,
            read_debtor_photo,
            get_calendar_events,
            insert_calendar_event,
            update_calendar_event,
            delete_calendar_event,
            get_upcoming_payments,
            get_upcoming_followups,
            get_debtor_relations,
            insert_debtor_relation,
            delete_debtor_relation,
            import_enrollment_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}