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
use tauri::{command, Emitter, Manager};
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
use gorka_shared::send_orchestration::{SendRecommendationInput, SendRecommendationResult};

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

    // Auto-start the sync engine when the device is enrolled.
    // Founder decision 2026-10-05: auto-start on unlock. No manual
    // Settings toggle for MVP. Failure is logged and ignored; the
    // user still reaches the shell and the sync indicator reports
    // whatever state the engine is actually in.
    let enrolled = {
        let db_guard = state.db.lock().map_err(|e| e.to_string())?;
        let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
        db::is_enrolled(conn).unwrap_or(false)
    };
    if enrolled {
        if let Err(e) = start_engine_inner(None, &app, &storage) {
            eprintln!("auto-start sync engine: {}", e);
        }
    }

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
fn set_debtor_opt_out(
    debtor_id: String,
    channel: String,
    value: bool,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let channel: gorka_shared::compliance::Channel = channel.parse()?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    gorka_shared::compliance::set_debtor_opt_out(
        conn,
        &organization_id,
        &debtor_id,
        channel,
        value,
    )
}

#[command]
fn get_disclosure_text(
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    gorka_shared::compliance::get_disclosure_text(conn)
}

#[command]
fn set_disclosure_text(
    text: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    gorka_shared::compliance::set_disclosure_text(
        conn,
        &organization_id,
        text.as_deref(),
    )
}

#[command]
fn list_local_connectors(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<gorka_shared::connectors::local_record::LocalConnectorRow>, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    gorka_shared::connectors::local_record::list_local_connectors(conn, &organization_id)
}

#[command]
fn test_connector_connection(
    connector_code: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let secret = gorka_shared::connectors::local_record::read_local_connector_credential(
        conn,
        &organization_id,
        &connector_code,
    )?
    .ok_or_else(|| format!("Connector {} is not enabled on this device", connector_code))?;

    let cred = gorka_shared::connectors::ConnectorCredential {
        value: secret.credential_value,
        configuration: secret.configuration,
    };

    let registry = gorka_shared::connectors::build_default_registry();
    let factory = registry
        .factory(&connector_code)
        .ok_or_else(|| format!("No adapter registered for {}", connector_code))?;
    let adapter = factory(cred).map_err(|e| e.to_string())?;
    adapter.test_connection().map_err(|e| e.to_string())?;
    Ok(())
}

fn communication_type_for(connector_code: &str) -> &'static str {
    if connector_code.ends_with("-sms") {
        "SMS"
    } else if connector_code.ends_with("-email") {
        "EMAIL"
    } else if connector_code.ends_with("-voice") {
        "CALL"
    } else {
        "NOTE"
    }
}

#[command]
fn send_connector_message(
    connector_code: String,
    debtor_id: String,
    to: String,
    body: String,
    subject: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<gorka_shared::connectors::SendResult, String> {
    let organization_id = get_trusted_organization_id(&app)?;
    let user_id = crate::auth::get_user_id(app.clone())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;

    gorka_shared::compliance::check_opt_out(
        conn,
        &organization_id,
        &debtor_id,
        &connector_code,
    )
    .map_err(|block| block.user_message())?;

    let secret = gorka_shared::connectors::local_record::read_local_connector_credential(
        conn,
        &organization_id,
        &connector_code,
    )?
    .ok_or_else(|| format!("Connector {} is not enabled on this device", connector_code))?;

    let from = secret
        .configuration
        .get("from")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Connector configuration has no 'from' field".to_string())?
        .to_string();

    let cred = gorka_shared::connectors::ConnectorCredential {
        value: secret.credential_value,
        configuration: secret.configuration,
    };

    let registry = gorka_shared::connectors::build_default_registry();
    let factory = registry
        .factory(&connector_code)
        .ok_or_else(|| format!("No adapter registered for {}", connector_code))?;
    let adapter = factory(cred).map_err(|e| e.to_string())?;

    let send_request = gorka_shared::connectors::SendRequest {
        to: to.clone(),
        body: body.clone(),
        subject: subject.clone(),
        from,
    };

    let result = adapter.send(&send_request).map_err(|e| e.to_string())?;

    if result.success {
        let input = gorka_shared::models::CommunicationInput {
            debtor_id,
            r#type: communication_type_for(&connector_code).to_string(),
            direction: "OUTBOUND".to_string(),
            content: Some(body),
            duration: None,
            data: None,
        };
        gorka_shared::communications::insert_communication(
            conn,
            &organization_id,
            input,
            &user_id,
        )?;
    }

    Ok(result)
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
    let user_id = crate::auth::get_user_id(app.clone())?;
    communications::insert_communication(conn, &organization_id, input, &user_id)
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

fn start_engine_inner(
    manual_override: Option<String>,
    app: &tauri::AppHandle,
    storage: &AppStorage,
) -> Result<(), String> {
    let state = app.state::<AppState>();

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
    let organization_id = get_trusted_organization_id(app)?;

    let mut engine_conn = db::init_db(storage, &db_key)?;

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

    let app_for_notifier = app.clone();
    let notifier: gorka_shared::sync_engine::ApplyNotifier =
        std::sync::Arc::new(move || {
        let _ = app_for_notifier.emit("connector-sync", ());
        });

    let discovery = DiscoveryConfig {
        jwt,
        local_wire_device_id: device_id,
        local_wire_device_id_hex,
        backend_base_url,
        manual_override: manual_override.filter(|s| !s.trim().is_empty()),
        apply_notifier: Some(notifier),
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
fn start_sync_engine(
    manual_override: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    storage: tauri::State<AppStorage>,
) -> Result<(), String> {
    let _ = &state;
    start_engine_inner(manual_override, &app, &storage)
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

// ---------------------------------------------------------------------
// Slice 5b Copilot commands
// ---------------------------------------------------------------------

#[derive(serde::Serialize)]
struct RecommendationView {
    id: String,
    organization_id: String,
    debtor_id: String,
    ai_connector_code: String,
    created_by: String,
    source: String,
    channel: gorka_shared::recommendation::Channel,
    priority: gorka_shared::recommendation::Priority,
    tone: gorka_shared::recommendation::Tone,
    timing: gorka_shared::recommendation::Timing,
    draft_subject: Option<String>,
    draft_body: String,
    rationale: Option<String>,
    risk_flags: Vec<String>,
    prompt_version: String,
    status: String,
    created_at: String,
    decided_at: Option<String>,
    superseded_by: Option<String>,
    snapshot_hash: String,
    uncertain_attempt_id: Option<String>,
    delivery_connector_code: Option<String>,
}

#[derive(serde::Serialize)]
struct ConfirmResult {
    communication_id: Option<String>,
    attempt_id: String,
}

#[derive(serde::Serialize)]
struct CopilotProviderRow {
    connector_code: String,
    tier: String,
    model: Option<String>,
}

fn view_from_row(
    row: gorka_shared::recommendation_store::RecommendationRow,
    uncertain_attempt_id: Option<String>,
    delivery_connector_code: Option<String>,
) -> RecommendationView {
    use gorka_shared::recommendation_store::RecommendationStatus;
    use gorka_shared::strategy::StrategySource;
    let status = match row.status {
        RecommendationStatus::Pending => "PENDING",
        RecommendationStatus::Accepted => "ACCEPTED",
        RecommendationStatus::Rejected => "REJECTED",
        RecommendationStatus::Sent => "SENT",
        RecommendationStatus::Expired => "EXPIRED",
        RecommendationStatus::SendUncertain => "SEND_UNCERTAIN",
    }
    .to_string();
    let source = match row.source {
        StrategySource::Ai => "AI",
        StrategySource::Fallback => "FALLBACK",
    }
    .to_string();
    RecommendationView {
        id: row.id,
        organization_id: row.organization_id,
        debtor_id: row.debtor_id,
        ai_connector_code: row.ai_connector_code,
        created_by: row.created_by,
        source,
        channel: row.channel,
        priority: row.priority,
        tone: row.tone,
        timing: row.timing,
        draft_subject: row.draft_subject,
        draft_body: row.draft_body,
        rationale: row.rationale,
        risk_flags: row.risk_flags,
        prompt_version: row.prompt_version,
        status,
        created_at: row.created_at.to_rfc3339(),
        decided_at: row.decided_at.map(|d| d.to_rfc3339()),
        superseded_by: row.superseded_by,
        snapshot_hash: row.snapshot_hash,
        uncertain_attempt_id,
        delivery_connector_code,
    }
}

#[tauri::command]
fn analyze_debtor(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<RecommendationView, String> {
    let org_id = get_trusted_organization_id(&app)?;
    let user_id = crate::auth::get_user_id(app.clone())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;

    let selected = gorka_shared::copilot::select_ai_provider(conn, &org_id)
        .map_err(|e| e.to_string())?;
    let adapter = gorka_shared::copilot::build_selected_adapter(&selected)
        .map_err(|e| e.to_string())?;
    let now = chrono::Utc::now();
    let row = gorka_shared::copilot::analyze_debtor(
        conn,
        &org_id,
        &debtor_id,
        &selected.model,
        adapter.as_ref(),
        &user_id,
        now,
    )
    .map_err(|e| e.to_string())?;
    Ok(view_from_row(row, None, None))
}

#[tauri::command]
fn list_recommendations_for_debtor(
    debtor_id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<RecommendationView>, String> {
    let org_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    let rows = gorka_shared::recommendation_store::list_for_debtor(conn, &org_id, &debtor_id, 100)
        .map_err(|e| format!("{:?}", e))?;

    let mut views = Vec::with_capacity(rows.len());
    for row in rows {
        let uncertain: Option<String> = conn
            .query_row(
                "SELECT id FROM send_attempts
                  WHERE organization_id = ?1 AND recommendation_id = ?2
                    AND state = 'UNCERTAIN' LIMIT 1",
                rusqlite::params![&org_id, &row.id],
                |r| r.get(0),
            )
            .ok();
        let delivery_connector_code: Option<String> = conn
            .query_row(
                "SELECT connector_code FROM send_attempts
                  WHERE organization_id = ?1 AND recommendation_id = ?2
                    AND state = 'CONFIRMED_SUCCESS'
                  ORDER BY finalized_at DESC LIMIT 1",
                rusqlite::params![&org_id, &row.id],
                |r| r.get(0),
            )
            .ok();
        views.push(view_from_row(row, uncertain, delivery_connector_code));
    }
    Ok(views)
}

#[tauri::command]
fn decide_recommendation(
    id: String,
    decision: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let org_id = get_trusted_organization_id(&app)?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    let now = chrono::Utc::now();
    match decision.as_str() {
        "accept" => gorka_shared::recommendation_store::mark_accepted(conn, &org_id, &id, now)
            .map_err(|e| format!("{:?}", e))?,
        "reject" => gorka_shared::recommendation_store::mark_rejected(conn, &org_id, &id, now)
            .map_err(|e| format!("{:?}", e))?,
        other => return Err(format!("unknown decision: {}", other)),
    }
    Ok(())
}

#[tauri::command]
fn send_recommendation(
    input: SendRecommendationInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<SendRecommendationResult, String> {
    let org_id = get_trusted_organization_id(&app)?;
    let user_id = crate::auth::get_user_id(app.clone())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    let now = chrono::Utc::now();
    gorka_shared::send_orchestration::execute_send(conn, &org_id, &user_id, input, now)
}

#[tauri::command]
fn list_copilot_providers(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<CopilotProviderRow>, String> {
    let org_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;
    let mut out = Vec::new();
    for code in gorka_shared::copilot::AI_PROVIDER_CODES {
        let row: Option<(String, String)> = conn
            .query_row(
                "SELECT tier, configuration FROM local_connectors
                  WHERE organization_id = ?1 AND connector_code = ?2 AND status = 'ENABLED'",
                rusqlite::params![&org_id, *code],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        if let Some((tier, config_str)) = row {
            let model = serde_json::from_str::<serde_json::Value>(&config_str)
                .ok()
                .and_then(|v| v.get("model").and_then(|m| m.as_str()).map(String::from));
            out.push(CopilotProviderRow {
                connector_code: (*code).to_string(),
                tier,
                model,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
fn confirm_uncertain_attempt(
    attempt_id: String,
    delivered: bool,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<ConfirmResult, String> {
    let org_id = get_trusted_organization_id(&app)?;
    let user_id = crate::auth::get_user_id(app.clone())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_mut().ok_or("Database not unlocked")?;
    let now = chrono::Utc::now();
    if delivered {
        let comm_id = gorka_shared::send_safety::confirm_delivered(
            conn, &org_id, &attempt_id, &user_id, now,
        )
        .map_err(|e| format!("{:?}", e))?;
        Ok(ConfirmResult {
            communication_id: Some(comm_id),
            attempt_id,
        })
    } else {
        gorka_shared::send_safety::confirm_not_delivered(conn, &org_id, &attempt_id, now)
            .map_err(|e| format!("{:?}", e))?;
        Ok(ConfirmResult {
            communication_id: None,
            attempt_id,
        })
    }
}
// ---------------------------------------------------------------------
// Slice 5c. Advisory draft validation.
// ---------------------------------------------------------------------

#[derive(serde::Serialize)]
struct ClaimFlagView {
    claim_type: &'static str,
    source: &'static str,
    span_start: usize,
    span_end: usize,
    matched_text: String,
    verification_kind: &'static str,
    db_value: Option<String>,
    draft_id: u64,
}

fn claim_type_str(t: gorka_shared::fact_validation::ClaimType) -> &'static str {
    use gorka_shared::fact_validation::ClaimType;
    match t {
        ClaimType::DollarAmount => "DollarAmount",
        ClaimType::CalendarDate => "CalendarDate",
        ClaimType::InvoiceRef => "InvoiceRef",
        ClaimType::PriorPromisePayment => "PriorPromisePayment",
        ClaimType::LegalOrCreditConsequence => "LegalOrCreditConsequence",
    }
}

fn claim_source_str(s: gorka_shared::fact_validation::ClaimSource) -> &'static str {
    use gorka_shared::fact_validation::ClaimSource;
    match s {
        ClaimSource::Subject => "Subject",
        ClaimSource::Body => "Body",
    }
}

/// Advisory fact-validation for the Copilot panel. Read-only. No
/// state transitions. No provider call. send_recommendation remains
/// the authoritative validation gate.
#[tauri::command]
fn validate_draft_for_copilot(
    debtor_id: String,
    subject: Option<String>,
    body: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<ClaimFlagView>, String> {
    use gorka_shared::fact_validation::Verification;

    let org_id = get_trusted_organization_id(&app)?;
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let subject_str = subject.as_deref().unwrap_or("");
    let flags = gorka_shared::fact_validation::validate_draft(
        conn,
        &org_id,
        &debtor_id,
        subject_str,
        &body,
        0,
    )
    .map_err(|e| format!("{:?}", e))?;

    let mut out = Vec::with_capacity(flags.len());
    for f in flags {
        let (kind, db_value) = match f.verification {
            Verification::Verified { db_value } => ("Verified", Some(db_value)),
            Verification::Mismatch { db_value } => ("Mismatch", Some(db_value)),
            Verification::Unverifiable => ("Unverifiable", None),
        };
        out.push(ClaimFlagView {
            claim_type: claim_type_str(f.claim_type),
            source: claim_source_str(f.source),
            span_start: f.span_start,
            span_end: f.span_end,
            matched_text: f.matched_text,
            verification_kind: kind,
            db_value,
            draft_id: f.draft_id,
        });
    }
    Ok(out)
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {
            // A second Agent process was launched. The plugin exits
            // that process before it touches any file. The first
            // process continues running. No action required here;
            // window-focus UX can be added later.
        }))
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
            set_debtor_opt_out,
            get_disclosure_text,
            set_disclosure_text,
            list_local_connectors,
            test_connector_connection,
            send_connector_message,
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
            analyze_debtor,
            list_recommendations_for_debtor,
            decide_recommendation,
            send_recommendation,
            list_copilot_providers,
            confirm_uncertain_attempt,
            validate_draft_for_copilot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
