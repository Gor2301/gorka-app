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
// Phase 9.6 batch 2: mutating commands now hold a &mut connection
// so that the shared layer can open a transaction for the state
// change and the sync_events row.

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
use gorka_shared::sync_engine::{self, EngineHandle, EngineStatus, DiscoveryConfig};
use gorka_shared::sync_events;

mod auth;

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
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = Some(conn);
    }
    {
        let mut key_guard = state.db_key.lock().map_err(|e| e.to_string())?;
        *key_guard = Some(key);
    }

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

// TEMPORARY: Batch 7 acceptance test hooks. Removed after the
// acceptance test in a single revert commit.

/// Delete every sync_delivery row for this device's own origin.
/// Forces the engine to re-send all locally-originated events to
/// every peer on the next tick. Used to exercise criterion 6
/// (duplicate prevention).
#[command]
fn test_force_resend_own_events(
    state: tauri::State<AppState>,
) -> Result<usize, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    let local_device_id: Vec<u8> = conn
        .query_row(
            "SELECT device_id FROM sync_state LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("read local device_id: {}", e))?;
    let affected = conn
        .execute(
            "DELETE FROM sync_delivery
             WHERE local_device_id = ?1 AND origin_device_id = ?1",
            params![&local_device_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(affected)
}
/// Flip one byte of the next outbound SYNC_MESSAGE frame,
/// corrupting the AEAD tag. Used to exercise criterion 10
/// (corrupted message rejection).
#[command]
fn test_corrupt_next_frame() {
    sync_engine::TEST_CORRUPT_NEXT_FRAME
        .store(true, std::sync::atomic::Ordering::SeqCst);
}

#[command]
fn logout(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    // 1. Stop the engine and wait for its thread to exit.
    {
        let mut engine_guard = state.engine.lock().map_err(|e| e.to_string())?;
        if let Some(mut handle) = engine_guard.take() {
            handle.stop();
        }
    }
    // 2. Close the Tauri command's connection.
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    // 3. Clear the derived key.
    {
        let mut key_guard = state.db_key.lock().map_err(|e| e.to_string())?;
        *key_guard = None;
    }
    auth::logout(app)
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
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
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
fn get_all_actions(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<ActionWithDebtor>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    actions::get_all_actions(conn, &organization_id)
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

#[command]
fn start_sync_engine(
    manual_override: Option<String>,
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

    let jwt = auth::get_token(app.clone())?;
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
            "Organization key not found. Import an enrollment package first.".to_string()
        })?;
    let organization_key: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "Organization key has wrong length".to_string())?;

    let local_wire_device_id_hex = hex::encode(device_id);
    let backend_base_url =
        gorka_shared::sync_discovery::CONTROL_PLANE_BASE_URL.to_string();

    let discovery = DiscoveryConfig {
        jwt,
        local_wire_device_id: device_id,
        local_wire_device_id_hex,
        backend_base_url,
        manual_override: manual_override.filter(|s| !s.trim().is_empty()),
    };

    let handle = sync_engine::start_engine_connect(
        engine_conn,
        organization_id,
        organization_key,
        device_id,
        discovery,
    );

    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    *guard = Some(handle);

    Ok(())
}
#[command]
fn stop_sync_engine(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    if let Some(mut handle) = guard.take() {
        handle.stop();
    }
    drop(guard);

    // Best-effort: tell the Control Plane this endpoint is gone.
    // Failure is logged but not returned; the entry will expire on
    // its own TTL.
    if let Ok(jwt) = auth::get_token(app.clone()) {
        if let Ok(guard) = state.db.lock() {
            if let Some(conn) = guard.as_ref() {
                if let Ok(did) = conn.query_row::<Vec<u8>, _, _>(
                    "SELECT device_id FROM sync_state LIMIT 1",
                    [],
                    |row| row.get(0),
                ) {
                    let _ = gorka_shared::sync_discovery::unregister_endpoint(&jwt, &did);
                }
            }
        }
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
fn import_enrollment_package(
    passphrase: String,
    file_path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;

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
            get_all_actions,
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
            start_sync_engine,
            stop_sync_engine,
            sync_engine_status,
            test_force_resend_own_events,
            test_corrupt_next_frame,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}