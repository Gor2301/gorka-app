// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::{command, State, Manager};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Mutex;
use rand::RngCore;
use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{aead::{Aead, KeyInit, Payload}, XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::Sha256;

mod db;
mod auth;

struct AppState {
    db: Mutex<Option<Connection>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Debtor {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub surname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DebtorInput {
    pub name: String,
    pub surname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub data: JsonValue,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i64,
    pub category: String,
    pub description: Option<String>,
    pub uploaded_by: Option<String>,
    pub is_primary: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DocumentInput {
    pub entity_id: String,
    pub entity_type: String,
    pub file_name: String,
    pub file_content: Vec<u8>,
    pub file_type: String,
    pub category: String,
    pub description: Option<String>,
    pub uploaded_by: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Debt {
    pub id: String,
    pub debtor_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DebtInput {
    pub debtor_id: String,
    pub amount: f64,
    pub currency: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: Option<JsonValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Communication {
    pub id: String,
    pub debtor_id: String,
    pub r#type: String,
    pub direction: String,
    pub content: Option<String>,
    pub duration: Option<i64>,
    pub created_by: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CommunicationInput {
    pub debtor_id: String,
    pub r#type: String,
    pub direction: String,
    pub content: Option<String>,
    pub duration: Option<i64>,
    pub data: Option<JsonValue>,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    pub id: String,
    pub debtor_id: String,
    pub r#type: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ActionInput {
    pub debtor_id: String,
    pub r#type: String,
    pub status: Option<String>,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: Option<JsonValue>,
}


#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_debtors: i64,
    pub total_debt: f64,
    pub total_actions: i64,
}


#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DocumentCategory {
    ProfilePhoto,
    IdCard,
    Passport,
    DriverLicense,
    Contract,
    ProofOfAddress,
    IncomeProof,
    CollateralPhoto,
    Other,
}

impl DocumentCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            DocumentCategory::ProfilePhoto => "profile_photo",
            DocumentCategory::IdCard => "id_card",
            DocumentCategory::Passport => "passport",
            DocumentCategory::DriverLicense => "driver_license",
            DocumentCategory::Contract => "contract",
            DocumentCategory::ProofOfAddress => "proof_of_address",
            DocumentCategory::IncomeProof => "income_proof",
            DocumentCategory::CollateralPhoto => "collateral_photo",
            DocumentCategory::Other => "other",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum CommunicationType {
    Call,
    Email,
    Sms,
    Note,
}

impl CommunicationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CommunicationType::Call => "CALL",
            CommunicationType::Email => "EMAIL",
            CommunicationType::Sms => "SMS",
            CommunicationType::Note => "NOTE",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum CommunicationDirection {
    Inbound,
    Outbound,
}

impl CommunicationDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            CommunicationDirection::Inbound => "INBOUND",
            CommunicationDirection::Outbound => "OUTBOUND",
        }
    }
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
fn database_exists() -> bool {
    db::database_exists()
}


#[command]
fn unlock_database(password: String, app: tauri::AppHandle) -> Result<(), String> {
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
    let conn = match db::init_db(&key) {
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
    let mut db_guard = match state.db.lock() {
        Ok(g) => g,
        Err(e) => {
            println!("❌ [RUST] Failed to lock db: {}", e);
            return Err(e.to_string());
        }
    };
    *db_guard = Some(conn);
    println!("✅ [RUST] Connection stored in app state");

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

    let mut stmt = conn.prepare(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors WHERE organization_id = ?1
         ORDER BY surname, name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([&organization_id], |row| {
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

#[command]
fn get_debtor(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let debtor = conn.query_row(
        "SELECT id, organization_id, name, surname, email, phone, data, created_at, updated_at
         FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&id, &organization_id],
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

#[command]
fn insert_debtor(
    input: DebtorInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debtor, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            &organization_id,
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
        organization_id,
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone,
        data: input.data,
        created_at: now.clone(),
        updated_at: now,
    })
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
                &organization_id,
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
            organization_id: organization_id.clone(),
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
            &id,
            &organization_id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    db::log_audit(conn, "UPDATE", Some(&id), 1, "Updated debtor")?;

    Ok(Debtor {
        id,
        organization_id,
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone,
        data: input.data,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
fn delete_debtor(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let affected = conn.execute(
        "DELETE FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&id, &organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        let debtor_dir = db::get_debtor_files_dir(&id)?;
        if debtor_dir.exists() {
            std::fs::remove_dir_all(&debtor_dir)
                .map_err(|e| format!("Failed to delete debtor files: {}", e))?;
        }

        db::log_audit(conn, "DELETE", Some(&id), 1, "Deleted debtor")?;
        Ok(true)
    } else {
        Ok(false)
    }
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

    let rows = stmt.query_map([&organization_id, &search_pattern], |row| {
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

#[command]
fn get_debtor_count(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<i64, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE organization_id = ?1",
        params![&organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(count)
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

    let mut stmt = conn.prepare(
        "SELECT d.id, d.debtor_id, d.amount, d.currency, d.status,
                d.due_date, d.description, d.data, d.created_at, d.updated_at
         FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.debtor_id = ?1 AND b.organization_id = ?2
         ORDER BY d.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![&debtor_id, &organization_id], |row| {
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

#[command]
fn insert_debt(
    input: DebtInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Debt, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&input.debtor_id, &organization_id],
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

    let ownership_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE d.id = ?1 AND b.organization_id = ?2",
        params![&id, &organization_id],
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
            &id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debt not found".to_string());
    }

    db::log_audit(conn, "UPDATE_DEBT", Some(&input.debtor_id), 1, "Updated debt")?;

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

#[command]
fn delete_debt(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<bool, String> {
    let organization_id = get_trusted_organization_id(&app)?;

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.as_ref().ok_or("Database not unlocked")?;

    let affected = conn.execute(
        "DELETE FROM debts
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![&id, &organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_DEBT", None, 1, "Deleted debt")?;
        Ok(true)
    } else {
        Ok(false)
    }
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

    let mut stmt = conn.prepare(
        "SELECT a.id, a.debtor_id, a.type, a.status, a.assigned_to,
                a.due_date, a.description, a.data, a.created_at, a.updated_at
         FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.debtor_id = ?1 AND b.organization_id = ?2
         ORDER BY a.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![&debtor_id, &organization_id], |row| {
        let data_json: String = row.get(7)?;
        Ok(Action {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            r#type: row.get(2)?,
            status: row.get(3)?,
            assigned_to: row.get(4)?,
            due_date: row.get(5)?,
            description: row.get(6)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut actions = Vec::new();
    for row in rows {
        actions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(actions)
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

    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&input.debtor_id, &organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debtor_ok == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let status = input.status.unwrap_or_else(|| "PENDING".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    conn.execute(
        "INSERT INTO actions (id, debtor_id, type, status, assigned_to, due_date, description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            &input.debtor_id,
            &input.r#type,
            &status,
            &input.assigned_to,
            &input.due_date,
            &input.description,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "INSERT_ACTION", Some(&input.debtor_id), 1, "Inserted action")?;

    Ok(Action {
        id,
        debtor_id: input.debtor_id,
        r#type: input.r#type,
        status,
        assigned_to: input.assigned_to,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
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

    let ownership_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE a.id = ?1 AND b.organization_id = ?2",
        params![&id, &organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if ownership_ok == 0 {
        return Err("Action not found or not in this organization".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let status = input.status.unwrap_or_else(|| "PENDING".to_string());
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let affected = conn.execute(
        "UPDATE actions
         SET type = ?1, status = ?2, assigned_to = ?3, due_date = ?4,
             description = ?5, data = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            &input.r#type,
            &status,
            &input.assigned_to,
            &input.due_date,
            &input.description,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            &id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Action not found".to_string());
    }

    db::log_audit(conn, "UPDATE_ACTION", Some(&input.debtor_id), 1, "Updated action")?;

    Ok(Action {
        id,
        debtor_id: input.debtor_id,
        r#type: input.r#type,
        status,
        assigned_to: input.assigned_to,
        due_date: input.due_date,
        description: input.description,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
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

    let affected = conn.execute(
        "DELETE FROM actions
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![&id, &organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_ACTION", None, 1, "Deleted action")?;
        Ok(true)
    } else {
        Ok(false)
    }
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

    let mut stmt = conn.prepare(
        "SELECT c.id, c.debtor_id, c.type, c.direction, c.content,
                c.duration, c.created_by, c.data, c.created_at
         FROM communications c
         INNER JOIN debtors b ON b.id = c.debtor_id
         WHERE c.debtor_id = ?1 AND b.organization_id = ?2
         ORDER BY c.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![&debtor_id, &organization_id], |row| {
        let data_json: String = row.get(7)?;
        Ok(Communication {
            id: row.get(0)?,
            debtor_id: row.get(1)?,
            r#type: row.get(2)?,
            direction: row.get(3)?,
            content: row.get(4)?,
            duration: row.get(5)?,
            created_by: row.get(6)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut communications = Vec::new();
    for row in rows {
        communications.push(row.map_err(|e| e.to_string())?);
    }

    Ok(communications)
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

    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&input.debtor_id, &organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debtor_ok == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let comm_type = match input.r#type.as_str() {
        "CALL" => CommunicationType::Call,
        "EMAIL" => CommunicationType::Email,
        "SMS" => CommunicationType::Sms,
        "NOTE" => CommunicationType::Note,
        _ => return Err("Invalid communication type".to_string()),
    };

    let direction = match input.direction.as_str() {
        "INBOUND" => CommunicationDirection::Inbound,
        "OUTBOUND" => CommunicationDirection::Outbound,
        _ => return Err("Invalid communication direction".to_string()),
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    conn.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content, duration, created_by, data, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            &input.debtor_id,
            comm_type.as_str(),
            direction.as_str(),
            &input.content,
            &input.duration,
            Option::<String>::None,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    db::log_audit(conn, "INSERT_COMM", Some(&input.debtor_id), 1, "Inserted communication")?;

    Ok(Communication {
        id,
        debtor_id: input.debtor_id,
        r#type: comm_type.as_str().to_string(),
        direction: direction.as_str().to_string(),
        content: input.content,
        duration: input.duration,
        created_by: None,
        data,
        created_at: now,
    })
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

    let affected = conn.execute(
        "DELETE FROM communications
         WHERE id = ?1
         AND debtor_id IN (SELECT id FROM debtors WHERE organization_id = ?2)",
        params![&id, &organization_id],
    ).map_err(|e| e.to_string())?;

    if affected > 0 {
        db::log_audit(conn, "DELETE_COMM", None, 1, "Deleted communication")?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[command]
fn upload_document(
    input: DocumentInput,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
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

    let debtor_dir = db::get_debtor_files_dir(&input.entity_id)?;
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

/// Build the enrollment package bytes from explicit inputs.
///
/// This is the shared package-construction operation. It is the
/// single implementation used by both the production export command
/// and the E1 known-answer test. It performs no I/O and generates no
/// randomness: the salt and nonce are supplied by the caller.
///
/// Inputs:
///   passphrase        UTF-8 passphrase for the package
///   organization_id   the organization id, as a string
///   organization_key  the 32-byte organization key
///   salt              16-byte Argon2id salt
///   nonce             24-byte XChaCha20-Poly1305 nonce
///
/// Output: the complete package bytes: 63-byte header, then the
/// AEAD ciphertext and 16-byte tag.
fn build_enrollment_package(
    passphrase: &str,
    organization_id: &str,
    organization_key: &[u8],
    salt: &[u8; 16],
    nonce: &[u8; 24],
) -> Result<Vec<u8>, String> {
    if organization_key.len() != 32 {
        return Err("Invalid organization key length".to_string());
    }

    // Derive the package encryption key with Argon2id at the frozen parameters.
    let params = Params::new(131072, 4, 1, Some(32))
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut package_key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut package_key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    // Build the inner content: org_id_len (u32 BE) || org_id || org_key.
    let org_id_bytes = organization_id.as_bytes();
    let mut inner = Vec::with_capacity(4 + org_id_bytes.len() + 32);
    inner.extend_from_slice(&(org_id_bytes.len() as u32).to_be_bytes());
    inner.extend_from_slice(org_id_bytes);
    inner.extend_from_slice(organization_key);

    // Ciphertext length = plaintext length + 16-byte Poly1305 tag.
    let encrypted_payload_len = (inner.len() + 16) as u32;

    // Build the 63-byte header exactly as it will be transmitted.
    let mut header = Vec::with_capacity(63);
    header.extend_from_slice(b"GORKAEP\0");
    header.extend_from_slice(&1u16.to_be_bytes());
    header.extend_from_slice(&131072u32.to_be_bytes());
    header.extend_from_slice(&4u32.to_be_bytes());
    header.push(1u8);
    header.extend_from_slice(salt);
    header.extend_from_slice(nonce);
    header.extend_from_slice(&encrypted_payload_len.to_be_bytes());

    if header.len() != 63 {
        return Err("Internal error: header length is not 63 bytes".to_string());
    }

    // Encrypt with XChaCha20-Poly1305, using the full header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(&package_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let ciphertext = cipher
        .encrypt(
            xnonce,
            Payload {
                msg: &inner,
                aad: &header,
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Assemble the full package: header || ciphertext (which includes the tag).
    let mut package = Vec::with_capacity(header.len() + ciphertext.len());
    package.extend_from_slice(&header);
    package.extend_from_slice(&ciphertext);

    Ok(package)
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

/// Derive the session key for a sync session.
///
/// This is the H1 operation. It is the shared session-key
/// derivation used by the handshake. It performs no I/O and
/// generates no randomness: every input is supplied by the
/// caller.
///
/// Per §22.11.1 and §22.19.1:
///   session_key = HKDF-SHA256(
///       IKM  = organization_key,
///       salt = initiator_nonce || responder_nonce,
///       info = "GORKA-MVP-SESSION-v1"
///              || u16_be(len(organization_id))
///              || organization_id
///              || u16_be(len(initiator_device_id))
///              || initiator_device_id
///              || u16_be(len(responder_device_id))
///              || responder_device_id,
///       output_length = 32
///   )
fn derive_session_key(
    organization_key: &[u8; 32],
    initiator_nonce: &[u8; 24],
    responder_nonce: &[u8; 24],
    organization_id: &str,
    initiator_device_id: &str,
    responder_device_id: &str,
) -> Result<[u8; 32], String> {
    // salt = initiator_nonce || responder_nonce, 48 bytes.
    let mut salt = [0u8; 48];
    salt[0..24].copy_from_slice(initiator_nonce);
    salt[24..48].copy_from_slice(responder_nonce);

    // info = "GORKA-MVP-SESSION-v1"
    //        || u16_be(len(organization_id)) || organization_id
    //        || u16_be(len(initiator_device_id)) || initiator_device_id
    //        || u16_be(len(responder_device_id)) || responder_device_id
    let mut info = Vec::new();
    info.extend_from_slice(b"GORKA-MVP-SESSION-v1");
    let org_id_bytes = organization_id.as_bytes();
    info.extend_from_slice(&(org_id_bytes.len() as u16).to_be_bytes());
    info.extend_from_slice(org_id_bytes);
    let init_dev_bytes = initiator_device_id.as_bytes();
    info.extend_from_slice(&(init_dev_bytes.len() as u16).to_be_bytes());
    info.extend_from_slice(init_dev_bytes);
    let resp_dev_bytes = responder_device_id.as_bytes();
    info.extend_from_slice(&(resp_dev_bytes.len() as u16).to_be_bytes());
    info.extend_from_slice(resp_dev_bytes);

    let hk = Hkdf::<Sha256>::new(Some(&salt), organization_key);
    let mut out = [0u8; 32];
    hk.expand(&info, &mut out)
        .map_err(|e| format!("HKDF expand failed: {}", e))?;
    Ok(out)
}

/// Compute the H2 proof tag: the HANDSHAKE_REPLY transcript
/// bound to the REPLY role.
///
/// Per §22.9.3 and §22.19.1:
///   proof_input =
///       "GORKA-MVP-HANDSHAKE-REPLY-v1"
///       || u16_be(protocol_version)
///       || u16_be(len(initiator_organization_id))
///       || initiator_organization_id
///       || u16_be(len(initiator_device_id))
///       || initiator_device_id
///       || initiator_nonce
///       || u16_be(len(responder_organization_id))
///       || responder_organization_id
///       || u16_be(len(responder_device_id))
///       || responder_device_id
///       || responder_nonce
///   proof_tag = HMAC-SHA256(handshake_key, proof_input)
fn compute_handshake_reply_tag(
    handshake_key: &[u8; 32],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &str,
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &str,
    responder_nonce: &[u8; 24],
) -> Result<[u8; 32], String> {
    let input = build_handshake_proof_input(
        b"GORKA-MVP-HANDSHAKE-REPLY-v1",
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        initiator_nonce,
        responder_organization_id,
        responder_device_id,
        responder_nonce,
    );

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(handshake_key)
        .map_err(|e| format!("HMAC init failed: {}", e))?;
    mac.update(&input);
    let result = mac.finalize().into_bytes();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Compute the H3 proof tag: the HANDSHAKE_CONFIRM transcript
/// bound to the CONFIRM role.
///
/// Identical to compute_handshake_reply_tag, except the leading
/// domain-separation string is
/// "GORKA-MVP-HANDSHAKE-CONFIRM-v1".
fn compute_handshake_confirm_tag(
    handshake_key: &[u8; 32],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &str,
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &str,
    responder_nonce: &[u8; 24],
) -> Result<[u8; 32], String> {
    let input = build_handshake_proof_input(
        b"GORKA-MVP-HANDSHAKE-CONFIRM-v1",
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        initiator_nonce,
        responder_organization_id,
        responder_device_id,
        responder_nonce,
    );

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(handshake_key)
        .map_err(|e| format!("HMAC init failed: {}", e))?;
    mac.update(&input);
    let result = mac.finalize().into_bytes();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Build the shared handshake proof input for H2 and H3.
///
/// The only difference between the REPLY and CONFIRM inputs is
/// the leading domain-separation string.
fn build_handshake_proof_input(
    domain: &[u8],
    protocol_version: u16,
    initiator_organization_id: &str,
    initiator_device_id: &str,
    initiator_nonce: &[u8; 24],
    responder_organization_id: &str,
    responder_device_id: &str,
    responder_nonce: &[u8; 24],
) -> Vec<u8> {
    let mut input = Vec::new();
    // domain-separation string, ASCII, no length prefix
    input.extend_from_slice(domain);
    // protocol_version, u16 BE
    input.extend_from_slice(&protocol_version.to_be_bytes());
    // initiator_organization_id, u16 BE length prefix
    let b = initiator_organization_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // initiator_device_id, u16 BE length prefix
    let b = initiator_device_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // initiator_nonce, 24 bytes, no prefix
    input.extend_from_slice(initiator_nonce);
    // responder_organization_id, u16 BE length prefix
    let b = responder_organization_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // responder_device_id, u16 BE length prefix
    let b = responder_device_id.as_bytes();
    input.extend_from_slice(&(b.len() as u16).to_be_bytes());
    input.extend_from_slice(b);
    // responder_nonce, 24 bytes, no prefix
    input.extend_from_slice(responder_nonce);
    input
}
/// Encode a single TLV record.
///
/// Per Section 22.5:
///   u16 BE type code || u32 BE value length || value
///
/// This is the single TLV primitive. Every higher-level encoder
/// in this file calls this function. No higher-level encoder
/// writes a TLV header on its own.
fn encode_tlv(type_code: u16, value: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(6 + value.len());
    out.extend_from_slice(&type_code.to_be_bytes());
    out.extend_from_slice(&(value.len() as u32).to_be_bytes());
    out.extend_from_slice(value);
    out
}

/// Encode a UTF-8 string field value.
///
/// Per Section 22.3: u32 BE length (bytes) || UTF-8 bytes.
/// The result is the TLV *value*, not the TLV record.
fn encode_string_value(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    out
}

/// Encode a DEBTOR_CREATED payload (Section 25.8.3).
///
/// Fields, in order:
///   name       0x2001
///   surname    0x2002
///   email      0x2003  optional
///   phone      0x2004  optional
///   data_json  0x2005  optional
fn encode_debtor_created_payload(
    name: &str,
    surname: &str,
    email: Option<&str>,
    phone: Option<&str>,
    data_json: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x2001, &encode_string_value(name)));
    out.extend_from_slice(&encode_tlv(0x2002, &encode_string_value(surname)));
    if let Some(e) = email {
        out.extend_from_slice(&encode_tlv(0x2003, &encode_string_value(e)));
    }
    if let Some(p) = phone {
        out.extend_from_slice(&encode_tlv(0x2004, &encode_string_value(p)));
    }
    if let Some(d) = data_json {
        out.extend_from_slice(&encode_tlv(0x2005, &encode_string_value(d)));
    }
    out
}

/// Encode an ENTITY_UPDATED payload (Section 25.9.3).
///
/// One or more change records, each of type 0x3001. Each change's
/// value is a sequence of two TLV records:
///   field_name   0x3011
///   field_value  0x3012
///
/// Section 25.9.3 requires the change records to appear in
/// lexicographic order by field_name. This encoder establishes
/// that order before serializing. The input slice is not itself
/// a wire-order guarantee.
fn encode_entity_updated_payload(changes: &[(&str, &str)]) -> Vec<u8> {
    let mut sorted: Vec<(&str, &str)> = changes.to_vec();
    sorted.sort_by(|a, b| a.0.cmp(b.0));

    let mut out = Vec::new();
    for (field_name, field_value) in sorted {
        let mut change = Vec::new();
        change.extend_from_slice(&encode_tlv(0x3011, &encode_string_value(field_name)));
        change.extend_from_slice(&encode_tlv(0x3012, &encode_string_value(field_value)));
        out.extend_from_slice(&encode_tlv(0x3001, &change));
    }
    out
}
/// Encode a COMMUNICATION_LOGGED payload (Section 25.11.3).
///
/// Fields, in order:
///   debtor_id           0x5001
///   communication_type  0x5002
///   direction           0x5003
///   content             0x5004
///   duration            0x5005  optional
fn encode_communication_logged_payload(
    debtor_id: &str,
    communication_type: &str,
    direction: &str,
    content: &str,
    duration: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x5001, &encode_string_value(debtor_id)));
    out.extend_from_slice(&encode_tlv(0x5002, &encode_string_value(communication_type)));
    out.extend_from_slice(&encode_tlv(0x5003, &encode_string_value(direction)));
    out.extend_from_slice(&encode_tlv(0x5004, &encode_string_value(content)));
    if let Some(d) = duration {
        out.extend_from_slice(&encode_tlv(0x5005, &encode_string_value(d)));
    }
    out
}
/// Encode an event record (Section 22.13.2).
///
/// Fields, in order:
///   event_id       0x1101  exactly 16 bytes
///   device_id      0x1102  raw bytes
///   sequence       0x1103  u64
///   logical_clock  0x1104  u64
///   event_type     0x1105  u16
///   entity_type    0x1106  u8
///   entity_id      0x1107  raw bytes
///   created_at     0x1108  u64, milliseconds since epoch
///   payload        0x1109  TLV-encoded payload
fn encode_event_record(
    event_id: &[u8; 16],
    device_id: &[u8],
    sequence: u64,
    logical_clock: u64,
    event_type: u16,
    entity_type: u8,
    entity_id: &[u8],
    created_at_ms: u64,
    payload: &[u8],
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&encode_tlv(0x1101, event_id));
    out.extend_from_slice(&encode_tlv(0x1102, device_id));
    out.extend_from_slice(&encode_tlv(0x1103, &sequence.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1104, &logical_clock.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1105, &event_type.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1106, &[entity_type]));
    out.extend_from_slice(&encode_tlv(0x1107, entity_id));
    out.extend_from_slice(&encode_tlv(0x1108, &created_at_ms.to_be_bytes()));
    out.extend_from_slice(&encode_tlv(0x1109, payload));
    out
}

/// Build a framed, encrypted SYNC_MESSAGE (Section 22.13.1).
///
/// Inner content:
///   message_id  0x1001  16 bytes
///   event_count 0x1002  u32 = event_records.len()
///   events      0x1003  repeatable, one per event record
///
/// Outer framing:
///   type 0x0010 (u16 BE) || length (u32 BE) ||
///   nonce (24) || ciphertext || tag (16)
///
/// The AAD is the 6-byte outer header, as transmitted.
fn build_sync_message(
    session_key: &[u8; 32],
    nonce: &[u8; 24],
    message_id: &[u8; 16],
    event_records: &[Vec<u8>],
) -> Result<Vec<u8>, String> {
    // Inner content.
    let mut inner = Vec::new();
    inner.extend_from_slice(&encode_tlv(0x1001, message_id));
    let event_count = event_records.len() as u32;
    inner.extend_from_slice(&encode_tlv(0x1002, &event_count.to_be_bytes()));
    for record in event_records {
        inner.extend_from_slice(&encode_tlv(0x1003, record));
    }

    // Outer header: type 0x0010 || length.
    let outer_length = (24 + inner.len() + 16) as u32;
    let mut outer_header = Vec::with_capacity(6);
    outer_header.extend_from_slice(&0x0010u16.to_be_bytes());
    outer_header.extend_from_slice(&outer_length.to_be_bytes());

    // Encrypt with XChaCha20-Poly1305, header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let ciphertext = cipher
        .encrypt(
            xnonce,
            Payload {
                msg: &inner,
                aad: &outer_header,
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Assemble: outer_header || nonce || ciphertext (includes tag).
    let mut framed = Vec::with_capacity(6 + 24 + ciphertext.len());
    framed.extend_from_slice(&outer_header);
    framed.extend_from_slice(nonce);
    framed.extend_from_slice(&ciphertext);
    Ok(framed)
}

/// Parse and decrypt a framed SYNC_MESSAGE (Section 22.13.1).
///
/// This validates and decrypts the outer envelope and returns the
/// decrypted inner content. It does not parse event records. Full
/// message parsing is a separate concern, for a later phase.
fn parse_sync_message(
    session_key: &[u8; 32],
    framed_message: &[u8],
) -> Result<Vec<u8>, String> {
    if framed_message.len() < 6 + 24 + 16 {
        return Err("SYNC_MESSAGE too short".to_string());
    }

    // Read and verify the outer header.
    let msg_type = u16::from_be_bytes([framed_message[0], framed_message[1]]);
    if msg_type != 0x0010 {
        return Err("SYNC_MESSAGE: unexpected type code".to_string());
    }
    let outer_length =
        u32::from_be_bytes([framed_message[2], framed_message[3], framed_message[4], framed_message[5]])
            as usize;
    if framed_message.len() != 6 + outer_length {
        return Err("SYNC_MESSAGE: length mismatch".to_string());
    }

    let outer_header = &framed_message[0..6];
    let nonce = &framed_message[6..30];
    let ciphertext = &framed_message[30..];

    let cipher = XChaCha20Poly1305::new_from_slice(session_key)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let plaintext = cipher
        .decrypt(
            xnonce,
            Payload {
                msg: ciphertext,
                aad: outer_header,
            },
        )
        .map_err(|_| "SYNC_MESSAGE: decryption failed".to_string())?;

    Ok(plaintext)
}
/// Parse and decrypt an enrollment package.
///
/// This is the shared package-parsing operation. It is the single
/// implementation used by both the production import command and
/// the E2-E6 behavioral tests. It performs no I/O and touches no
/// database: the file bytes and the trusted organization id are
/// supplied by the caller.
///
/// Inputs:
///   file            the complete package bytes
///   passphrase      the passphrase entered by the agent
///   trusted_org_id  the organization id from the local session
///
/// Output: the 32-byte organization key on success, or an error
/// string identifying the failure.
fn parse_enrollment_package(
    file: &[u8],
    passphrase: &str,
    trusted_org_id: &str,
) -> Result<[u8; 32], String> {
    // Verify minimum length: 63-byte header.
    if file.len() < 63 {
        return Err("Invalid package: file too short".to_string());
    }

    // Verify magic bytes.
    if &file[0..8] != b"GORKAEP\0" {
        return Err("Invalid package: bad magic bytes".to_string());
    }

    // Read format_version (u16 BE, bytes 8..10).
    let format_version = u16::from_be_bytes([file[8], file[9]]);
    if format_version != 0x0001 {
        return Err("Unsupported package version".to_string());
    }

    // Read the header fields.
    let argon2_memory_kib = u32::from_be_bytes([file[10], file[11], file[12], file[13]]);
    let argon2_iterations = u32::from_be_bytes([file[14], file[15], file[16], file[17]]);
    let argon2_parallelism = file[18];
    let argon2_salt = &file[19..35];
    let aead_nonce = &file[35..59];
    let encrypted_payload_len =
        u32::from_be_bytes([file[59], file[60], file[61], file[62]]) as usize;

    // Verify total length.
    if file.len() != 63 + encrypted_payload_len {
        return Err("Invalid package: length mismatch".to_string());
    }

    // Derive the package key with the header's parameters.
    let params = Params::new(
        argon2_memory_kib,
        argon2_iterations,
        argon2_parallelism as u32,
        Some(32),
    )
    .map_err(|e| format!("Key derivation failed: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut package_key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), argon2_salt, &mut package_key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    // Decrypt with the full header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(&package_key)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(aead_nonce);
    let plaintext = cipher
        .decrypt(
            xnonce,
            Payload {
                msg: &file[63..],
                aad: &file[0..63],
            },
        )
        .map_err(|_| "Wrong passphrase or corrupted package".to_string())?;

    // Parse the inner content: org_id_len (u32 BE) || org_id || org_key (32).
    if plaintext.len() < 4 {
        return Err("Invalid package: malformed inner content".to_string());
    }
    let org_id_len =
        u32::from_be_bytes([plaintext[0], plaintext[1], plaintext[2], plaintext[3]]) as usize;
    let expected_len = 4 + org_id_len + 32;
    if plaintext.len() != expected_len {
        return Err("Invalid package: malformed inner content".to_string());
    }
    let package_org_id = std::str::from_utf8(&plaintext[4..4 + org_id_len])
        .map_err(|_| "Invalid package: malformed inner content".to_string())?;
    let organization_key = &plaintext[4 + org_id_len..4 + org_id_len + 32];

    // Compare the package's organization id to the trusted id.
    if package_org_id != trusted_org_id {
        return Err("Organization mismatch".to_string());
    }

    let mut key_out = [0u8; 32];
    key_out.copy_from_slice(organization_key);
    Ok(key_out)
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
#[cfg(test)]
mod tests {
        use super::{build_enrollment_package, parse_enrollment_package, derive_session_key, compute_handshake_reply_tag, compute_handshake_confirm_tag, encode_tlv, encode_debtor_created_payload, encode_entity_updated_payload, encode_communication_logged_payload, encode_event_record, build_sync_message, parse_sync_message};

    #[test]
    fn e1_enrollment_package_creation() {
        let passphrase = "test-passphrase-001";
        let organization_id = "org-test-A";

        let organization_key = [0u8; 32];

        let salt: [u8; 16] = [0u8; 16];

        let nonce: [u8; 24] = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        ];

        let package = build_enrollment_package(
            passphrase,
            organization_id,
            &organization_key,
            &salt,
            &nonce,
        )
        .expect("E1: package construction failed");

        assert_eq!(&package[0..8], b"GORKAEP\0", "E1: magic");
        assert_eq!(
            u16::from_be_bytes([package[8], package[9]]),
            0x0001,
            "E1: format_version"
        );
        assert_eq!(
            u32::from_be_bytes([package[10], package[11], package[12], package[13]]),
            131072,
            "E1: argon2_memory_kib"
        );
        assert_eq!(
            u32::from_be_bytes([package[14], package[15], package[16], package[17]]),
            4,
            "E1: argon2_iterations"
        );
        assert_eq!(package[18], 1, "E1: argon2_parallelism");
        assert_eq!(&package[19..35], &salt, "E1: salt");
        assert_eq!(&package[35..59], &nonce, "E1: nonce");

        let encrypted_payload_len = u32::from_be_bytes([
            package[59], package[60], package[61], package[62],
        ]);
        assert_eq!(encrypted_payload_len, 62, "E1: encrypted_payload_len");
        assert_eq!(package.len(), 125, "E1: package length");

        let package2 = build_enrollment_package(
            passphrase,
            organization_id,
            &organization_key,
            &salt,
            &nonce,
        )
        .expect("E1: second construction failed");
        assert_eq!(package, package2, "E1: not deterministic");

        let hex: String = package.iter().map(|b| format!("{:02x}", b)).collect();
        println!("E1 package ({} bytes): {}", package.len(), hex);
        let expected_hex = "474f524b41455000000100020000000000040100000000000000000000000000000000000102030405060708090a0b0c0d0e0f10111213141516170000003e8b53b5c87375885d9e5f6f95417e98f37c49c7e3d6e3dbb0c22bd4e6290f03599957e698b8971885b9b94d24b35545642cbc7d0e6d0117b8380605945841";
        let expected = hex::decode(expected_hex).expect("E1: recorded hex is not valid");
        assert_eq!(expected.len(), 125, "E1: recorded hex is not 125 bytes");
        assert_eq!(package, expected, "E1: package differs from recorded vector");
    }


    fn e1_package() -> Vec<u8> {
        let hex = "474f524b41455000000100020000000000040100000000000000000000000000000000000102030405060708090a0b0c0d0e0f10111213141516170000003e8b53b5c87375885d9e5f6f95417e98f37c49c7e3d6e3dbb0c22bd4e6290f03599957e698b8971885b9b94d24b35545642cbc7d0e6d0117b8380605945841";
        hex::decode(hex).expect("E1 hex is not valid")
    }

    #[test]
    fn e2_import_correct_passphrase() {
        let package = e1_package();
        let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
        assert!(result.is_ok(), "E2: expected success, got {:?}", result.err());
        let key = result.unwrap();
        assert_eq!(key.len(), 32, "E2: key length");
        assert_eq!(key, [0u8; 32], "E2: E1 uses organization_key_zero");
    }

    #[test]
    fn e3_import_wrong_passphrase() {
        let package = e1_package();
        let result = parse_enrollment_package(&package, "wrong-passphrase", "org-test-A");
        assert!(result.is_err(), "E3: expected error, got {:?}", result);
        assert_eq!(
            result.unwrap_err(),
            "Wrong passphrase or corrupted package",
            "E3: error message"
        );
    }

    #[test]
    fn e4_import_tampered_payload() {
        let mut package = e1_package();
        // Flip one byte inside the ciphertext region (after the 63-byte header).
        package[70] ^= 0x01;
        let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
        assert!(result.is_err(), "E4: expected error, got {:?}", result);
        assert_eq!(
            result.unwrap_err(),
            "Wrong passphrase or corrupted package",
            "E4: error message"
        );
    }

    #[test]
    fn e5_import_organization_mismatch() {
        let package = e1_package();
        let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-B");
        assert!(result.is_err(), "E5: expected error, got {:?}", result);
        assert_eq!(result.unwrap_err(), "Organization mismatch", "E5: error message");
    }

    #[test]
    fn e6_import_wrong_magic() {
        let mut package = e1_package();
        // Corrupt the magic bytes.
        package[0] = 0x00;
        let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
        assert!(result.is_err(), "E6: expected error, got {:?}", result);
        assert_eq!(
            result.unwrap_err(),
            "Invalid package: bad magic bytes",
            "E6: error message"
        );
    }

    #[test]
    fn h1_session_key_derivation() {
        let organization_key = [0u8; 32];
        let initiator_nonce: [u8; 24] = [0u8; 24];
        let responder_nonce: [u8; 24] = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        ];
        let organization_id = "org-test-A";
        let initiator_device_id = "device-test-A";
        let responder_device_id = "device-test-B";

        // Byte-width assertions (spec §7).
        assert_eq!(
            (organization_id.len() as u16).to_be_bytes(),
            [0x00, 0x0A],
            "H1: org-test-A length prefix must be 00 0A"
        );

        let session_key = derive_session_key(
            &organization_key,
            &initiator_nonce,
            &responder_nonce,
            organization_id,
            initiator_device_id,
            responder_device_id,
        )
        .expect("H1: session key derivation failed");

        assert_eq!(session_key.len(), 32, "H1: session key length");

        let session_key2 = derive_session_key(
            &organization_key,
            &initiator_nonce,
            &responder_nonce,
            organization_id,
            initiator_device_id,
            responder_device_id,
        )
        .expect("H1: second derivation failed");
        assert_eq!(session_key, session_key2, "H1: not deterministic");

        let hex: String = session_key.iter().map(|b| format!("{:02x}", b)).collect();
        println!("H1 session key (32 bytes): {}", hex);
        let expected = hex::decode("09f86098b9d761d7ce69fba650ff46ec8be6ace240cde3034b4428d0c6d60530").expect("H1: recorded hex is not valid");
        assert_eq!(session_key, expected.as_slice(), "H1: session key differs from recorded vector");
    }

    #[test]
    fn h2_handshake_reply_tag() {
        let handshake_key = [0u8; 32];
        let protocol_version: u16 = 0x0001;
        let initiator_organization_id = "org-test-A";
        let initiator_device_id = "device-test-A";
        let initiator_nonce: [u8; 24] = [0u8; 24];
        let responder_organization_id = "org-test-B";
        let responder_device_id = "device-test-B";
        let responder_nonce: [u8; 24] = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        ];

        // Byte-width assertion (spec §7).
        assert_eq!(
            protocol_version.to_be_bytes(),
            [0x00, 0x01],
            "H2: protocol_version must be 00 01"
        );

        let tag = compute_handshake_reply_tag(
            &handshake_key,
            protocol_version,
            initiator_organization_id,
            initiator_device_id,
            &initiator_nonce,
            responder_organization_id,
            responder_device_id,
            &responder_nonce,
        )
        .expect("H2: proof tag failed");

        assert_eq!(tag.len(), 32, "H2: tag length");

        let tag2 = compute_handshake_reply_tag(
            &handshake_key,
            protocol_version,
            initiator_organization_id,
            initiator_device_id,
            &initiator_nonce,
            responder_organization_id,
            responder_device_id,
            &responder_nonce,
        )
        .expect("H2: second tag failed");
        assert_eq!(tag, tag2, "H2: not deterministic");

        let hex: String = tag.iter().map(|b| format!("{:02x}", b)).collect();
        println!("H2 REPLY tag (32 bytes): {}", hex);
        let expected = hex::decode("20e675fa720171aa1b49c530ed5e1c5e54cd1e41a89f4ab691a1980e88bbc9eb").expect("H2: recorded hex is not valid");
        assert_eq!(tag, expected.as_slice(), "H2: tag differs from recorded vector");
    }

    #[test]
    fn h3_handshake_confirm_tag() {
        let handshake_key = [0u8; 32];
        let protocol_version: u16 = 0x0001;
        let initiator_organization_id = "org-test-A";
        let initiator_device_id = "device-test-A";
        let initiator_nonce: [u8; 24] = [0u8; 24];
        let responder_organization_id = "org-test-B";
        let responder_device_id = "device-test-B";
        let responder_nonce: [u8; 24] = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        ];

        let confirm_tag = compute_handshake_confirm_tag(
            &handshake_key,
            protocol_version,
            initiator_organization_id,
            initiator_device_id,
            &initiator_nonce,
            responder_organization_id,
            responder_device_id,
            &responder_nonce,
        )
        .expect("H3: proof tag failed");

        // H3 independently constructs the H2 tag and checks they differ.
        let reply_tag = compute_handshake_reply_tag(
            &handshake_key,
            protocol_version,
            initiator_organization_id,
            initiator_device_id,
            &initiator_nonce,
            responder_organization_id,
            responder_device_id,
            &responder_nonce,
        )
        .expect("H3: H2 tag for comparison failed");

        assert_eq!(confirm_tag.len(), 32, "H3: tag length");
        assert_ne!(confirm_tag, reply_tag, "H3: tag must differ from H2 tag");

        let confirm_tag2 = compute_handshake_confirm_tag(
            &handshake_key,
            protocol_version,
            initiator_organization_id,
            initiator_device_id,
            &initiator_nonce,
            responder_organization_id,
            responder_device_id,
            &responder_nonce,
        )
        .expect("H3: second tag failed");
        assert_eq!(confirm_tag, confirm_tag2, "H3: not deterministic");

        let hex: String = confirm_tag.iter().map(|b| format!("{:02x}", b)).collect();
        println!("H3 CONFIRM tag (32 bytes): {}", hex);
        let expected = hex::decode("e37ba7454ebf9b85d12c9e0156d5ec7bc9dc3b2d7f2c10ca689b1e6b45891fd5").expect("H3: recorded hex is not valid");
        assert_eq!(confirm_tag, expected.as_slice(), "H3: tag differs from recorded vector");
    }
    #[test]
    fn m1_sync_message_encryption() {
        // Fixtures (spec section 11).
        let session_key = [0u8; 32];
        let nonce = [0u8; 24];
        // message_id = event_id_test_001, 16 bytes.
        let message_id: [u8; 16] = [
            0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
            0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
        ];
        let device_id = "device-test-A";
        let entity_id = "entity-test-001";
        let created_at_ms: u64 = 1_789_891_200_000; // 2026-09-20T00:00:00Z

        // Build the DEBTOR_CREATED payload (V1 fields).
        let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);

        // Build the event record.
        let event_id = message_id; // same bytes, per spec section 11
        let record = encode_event_record(
            &event_id,
            device_id.as_bytes(),
            1,
            1,
            0x0001, // DEBTOR_CREATED
            0x01,   // debtor
            entity_id.as_bytes(),
            created_at_ms,
            &payload,
        );

        // Build the framed, encrypted message.
        let framed = build_sync_message(&session_key, &nonce, &message_id, &[record.clone()])
            .expect("M1: build_sync_message failed");

        // Structural checks.
        assert_eq!(&framed[0..2], &[0x00, 0x10], "M1: outer type");
        let outer_length =
            u32::from_be_bytes([framed[2], framed[3], framed[4], framed[5]]) as usize;
        assert_eq!(framed.len(), 6 + outer_length, "M1: outer length");
        assert_eq!(&framed[6..30], &nonce, "M1: nonce");

        // Determinism.
        let framed2 = build_sync_message(&session_key, &nonce, &message_id, &[record])
            .expect("M1: second build failed");
        assert_eq!(framed, framed2, "M1: not deterministic");

        let hex: String = framed.iter().map(|b| format!("{:02x}", b)).collect();
        println!("M1 framed message ({} bytes): {}", framed.len(), hex);
        let expected = hex::decode("0010000000e9000000000000000000000000000000000000000000000000689f9689e5308cf0e7bb8fc5c5349f48ef18a13e418888afdadd97a7693a987e9e81ecd5c1d82affd1af49650d8021a8e04104a0db119aa3a9e8333903e2c0fea4937a85652313ccf9e84193bff5bd2aa17e97c33a2ad487f778f8dc6b032ba59cbe3be778ea2e50bb5908d8921c4fec2d93532e71892d17cba49060dec4d6c84c7a09e634d6362546dff5763d47ba8c8837090f06b4cb8ea0322e6a3965b70fc7b3e5b63f12ffb636ecf14f6947142f3112855b80a303f3cbe443f5fa2b77ebba8e126abff95d1b728e7a830570621147").expect("M1: recorded hex is not valid");
        assert_eq!(framed, expected, "M1: framed message differs from recorded vector");
    }

    #[test]
    fn m2_sync_message_decryption() {
        let session_key = [0u8; 32];
        let nonce = [0u8; 24];
        let message_id: [u8; 16] = [
            0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
            0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
        ];
        let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);
        let record = encode_event_record(
            &message_id,
            "device-test-A".as_bytes(),
            1,
            1,
            0x0001,
            0x01,
            "entity-test-001".as_bytes(),
            1_789_891_200_000,
            &payload,
        );

        let framed = build_sync_message(&session_key, &nonce, &message_id, &[record.clone()])
            .expect("M2: build_sync_message failed");
        let inner = parse_sync_message(&session_key, &framed)
            .expect("M2: parse_sync_message failed");

        // The decrypted inner content must re-serialize to the same bytes
        // that build_sync_message encrypted.
        let mut expected_inner = Vec::new();
        expected_inner.extend_from_slice(&encode_tlv(0x1001, &message_id));
        expected_inner.extend_from_slice(&encode_tlv(0x1002, &1u32.to_be_bytes()));
        expected_inner.extend_from_slice(&encode_tlv(0x1003, &record));

        assert_eq!(inner, expected_inner, "M2: inner content mismatch");

        let hex: String = inner.iter().map(|b| format!("{:02x}", b)).collect();
        println!("M2 inner content ({} bytes): {}", inner.len(), hex);
        let expected = hex::decode("100100000010018f3e5a7c00700080000000000000011002000000040000000110030000009b110100000010018f3e5a7c007000800000000000000111020000000d6465766963652d746573742d411103000000080000000000000001110400000008000000000000000111050000000200011106000000010111070000000f656e746974792d746573742d303031110800000008000001a0bdd4440011090000001e200100000008000000045465737420020000000a00000006446562746f72").expect("M2: recorded hex is not valid");
        assert_eq!(inner, expected, "M2: inner content differs from recorded vector");
    }

    #[test]
    fn v1_debtor_created_payload() {
        let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);

        // Structural check: two fields, types 0x2001 and 0x2002.
        assert_eq!(&payload[0..2], &[0x20, 0x01], "V1: first field type");
        let len1 = u32::from_be_bytes([payload[2], payload[3], payload[4], payload[5]]) as usize;
        assert_eq!(len1, 4 + 4, "V1: name TLV value length");
        let name_start = 6 + 4;
        assert_eq!(&payload[name_start..name_start + 4], b"Test", "V1: name");

        let second = name_start + 4;
        assert_eq!(&payload[second..second + 2], &[0x20, 0x02], "V1: second field type");

        let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
        println!("V1 payload ({} bytes): {}", payload.len(), hex);
        let expected = hex::decode("200100000008000000045465737420020000000a00000006446562746f72").expect("V1: recorded hex is not valid");
        assert_eq!(payload, expected, "V1: payload differs from recorded vector");
    }

    #[test]
    fn v4_entity_updated_payload() {
        let payload = encode_entity_updated_payload(&[("deleted", "false")]);

        // Structural check: outer 0x3001.
        assert_eq!(&payload[0..2], &[0x30, 0x01], "V4: outer type");
        // Inner: 0x3011 then 0x3012.
        let inner = &payload[6..];
        assert_eq!(&inner[0..2], &[0x30, 0x11], "V4: field_name type");

        let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
        println!("V4 payload ({} bytes): {}", payload.len(), hex);
        let expected = hex::decode("30010000002030110000000b0000000764656c657465643012000000090000000566616c7365").expect("V4: recorded hex is not valid");
        assert_eq!(payload, expected, "V4: payload differs from recorded vector");
    }

    #[test]
    fn v6_communication_logged_payload() {
        let payload = encode_communication_logged_payload(
            "entity-test-001", "CALL", "OUTBOUND", "Test call", Some("01"),
        );

        // Structural check: five fields, types 0x5001 through 0x5005.
        assert_eq!(&payload[0..2], &[0x50, 0x01], "V6: first field type");

        let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
        println!("V6 payload ({} bytes): {}", payload.len(), hex);
        let expected = hex::decode("5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c500500000006000000023031").expect("V6: recorded hex is not valid");
        assert_eq!(payload, expected, "V6: payload differs from recorded vector");
    }
}