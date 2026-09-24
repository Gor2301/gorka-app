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

    // Derive the package encryption key with Argon2id at the frozen parameters.
    let params = Params::new(131072, 4, 1, Some(32))
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut package_key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), &salt, &mut package_key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    // Build the inner content: org_id_len (u32 BE) || org_id || org_key.
    let org_id_bytes = key_org_id.as_bytes();
    let mut inner = Vec::with_capacity(4 + org_id_bytes.len() + 32);
    inner.extend_from_slice(&(org_id_bytes.len() as u32).to_be_bytes());
    inner.extend_from_slice(org_id_bytes);
    inner.extend_from_slice(&key_material);

    // Ciphertext length = plaintext length + 16-byte Poly1305 tag.
    let encrypted_payload_len = (inner.len() + 16) as u32;

    // Build the 63-byte header exactly as it will be transmitted.
    let mut header = Vec::with_capacity(63);
    header.extend_from_slice(b"GORKAEP\0");
    header.extend_from_slice(&1u16.to_be_bytes());
    header.extend_from_slice(&131072u32.to_be_bytes());
    header.extend_from_slice(&4u32.to_be_bytes());
    header.push(1u8);
    header.extend_from_slice(&salt);
    header.extend_from_slice(&nonce_bytes);
    header.extend_from_slice(&encrypted_payload_len.to_be_bytes());

    if header.len() != 63 {
        return Err("Internal error: header length is not 63 bytes".to_string());
    }

    // Encrypt with XChaCha20-Poly1305, using the full header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(&package_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(&nonce_bytes);
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
    let org_id_len = u32::from_be_bytes([plaintext[0], plaintext[1], plaintext[2], plaintext[3]]) as usize;
    let expected_len = 4 + org_id_len + 32;
    if plaintext.len() != expected_len {
        return Err("Invalid package: malformed inner content".to_string());
    }
    let package_org_id = std::str::from_utf8(&plaintext[4..4 + org_id_len])
        .map_err(|_| "Invalid package: malformed inner content".to_string())?;
    let organization_key = &plaintext[4 + org_id_len..4 + org_id_len + 32];

    // Compare the package's organization id to the trusted id.
    if package_org_id != organization_id {
        return Err("Organization mismatch".to_string());
    }

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
        params![&package_org_id, organization_key, Utc::now().to_rfc3339()],
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