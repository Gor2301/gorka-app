// src-tauri/src/db.rs

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use std::path::PathBuf;
use directories::ProjectDirs;
use uuid::Uuid;
use chrono::Utc;
use hex;
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use rand_core::OsRng;

pub fn get_db_path() -> PathBuf {
    let proj_dirs = ProjectDirs::from("com", "gorka", "client")
        .expect("Failed to get project directories");
    let data_dir = proj_dirs.data_dir();
    std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");
    data_dir.join("gorka-client.db")
}

/// Returns true if the local encrypted database file exists on disk.
///
/// The existence of the file is the authoritative signal that selects
/// between "set local password" (first run) and "enter local password"
/// (returning run). It is NOT a claim that the database is valid or
/// that the password is correct. The unlock operation is responsible
/// for determining that.
///
/// Side effect note: this calls get_db_path(), which creates the data
/// directory if it does not exist. The directory existing is not the
/// same as the database file existing; this function checks the file.
pub fn database_exists() -> bool {
    get_db_path().exists()
}

pub fn get_files_dir() -> PathBuf {
    let proj_dirs = ProjectDirs::from("com", "gorka", "client")
        .expect("Failed to get project directories");
    let files_dir = proj_dirs.data_dir().join("files").join("debtors");
    std::fs::create_dir_all(&files_dir).expect("Failed to create files directory");
    files_dir
}

pub fn get_debtor_files_dir(debtor_id: &str) -> Result<PathBuf, String> {
    Uuid::parse_str(debtor_id)
        .map_err(|_| format!("Invalid debtor_id format: {}", debtor_id))?;
    
    let files_dir = get_files_dir();
    let debtor_dir = files_dir.join(debtor_id);
    std::fs::create_dir_all(&debtor_dir).expect("Failed to create debtor directory");
    Ok(debtor_dir)
}

pub fn derive_key(password: &str, salt: &[u8]) -> Result<String, String> {
    let salt = SaltString::encode_b64(salt)
        .map_err(|e| format!("Failed to encode salt: {}", e))?;
    
    let argon2 = Argon2::default();
    let mut key_bytes = [0u8; 32];
    
    argon2.hash_password_into(password.as_bytes(), salt.as_str().as_bytes(), &mut key_bytes)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    
    Ok(hex::encode(key_bytes))
}

pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 16];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

pub fn init_db(key: &str) -> Result<Connection, String> {
    println!("🔍 [RUST] init_db: STARTED");
    
    let db_path = get_db_path();
    println!("🔍 [RUST] db_path: {:?}", db_path);
    
    let conn = Connection::open(db_path).map_err(|e| {
        println!("❌ [RUST] Failed to open connection: {}", e);
        e.to_string()
    })?;
    println!("✅ [RUST] Connection opened");
    
    println!("🔍 [RUST] Setting PRAGMA key...");
    conn.query_row(&format!("PRAGMA key = '{}'", key), [], |row| row.get::<_, String>(0))
        .map_err(|e| {
            println!("❌ [RUST] PRAGMA key failed: {}", e);
            e.to_string()
        })?;
    println!("✅ [RUST] PRAGMA key set");
    
    println!("🔍 [RUST] Setting PRAGMA foreign_keys...");
conn.execute("PRAGMA foreign_keys = ON", [])
    .map_err(|e| {
        println!("❌ [RUST] PRAGMA foreign_keys failed: {}", e);
        e.to_string()
    })?;
    println!("✅ [RUST] PRAGMA foreign_keys set");
    
    println!("🔍 [RUST] Setting PRAGMA journal_mode...");
    conn.query_row("PRAGMA journal_mode = WAL", [], |row| row.get::<_, String>(0))
        .map_err(|e| {
            println!("❌ [RUST] PRAGMA journal_mode failed: {}", e);
            e.to_string()
        })?;
    println!("✅ [RUST] PRAGMA journal_mode set");
    
    println!("🔍 [RUST] Running migrations...");
    let mut conn_mut = conn;
    run_migrations(&mut conn_mut)?;
    println!("✅ [RUST] Migrations complete");
    
    Ok(conn_mut)
}

pub fn verify_password(conn: &Connection) -> Result<(), String> {
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .map_err(|_| "Incorrect password".to_string())?;
    Ok(())
}

fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    let current_version: i32 = conn.query_row(
        "PRAGMA user_version",
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    if current_version < 1 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        
        tx.execute(
            "CREATE TABLE IF NOT EXISTS debtors (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                surname TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                data JSON NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS debts (
                id TEXT PRIMARY KEY,
                debtor_id TEXT NOT NULL,
                amount REAL,
                currency TEXT DEFAULT 'USD',
                status TEXT DEFAULT 'ACTIVE',
                due_date DATETIME,
                description TEXT,
                data JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                category TEXT NOT NULL,
                description TEXT,
                uploaded_by TEXT,
                is_primary BOOLEAN DEFAULT 0,
                data JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (entity_id) REFERENCES debtors(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS communications (
                id TEXT PRIMARY KEY,
                debtor_id TEXT NOT NULL,
                type TEXT NOT NULL,
                direction TEXT NOT NULL,
                content TEXT,
                duration INTEGER,
                created_by TEXT,
                data JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                details TEXT,
                debtor_id TEXT,
                record_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_debtors_org ON debtors(organization_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_debtors_name ON debtors(name)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_debtors_surname ON debtors(surname)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_communications_debtor_id ON communications(debtor_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 1", [])
            .map_err(|e| e.to_string())?;
        
        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 2 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        
        tx.execute("PRAGMA user_version = 2", [])
            .map_err(|e| e.to_string())?;
        
        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 3 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS actions (
                id TEXT PRIMARY KEY,
                debtor_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                assigned_to TEXT,
                due_date DATETIME,
                description TEXT,
                data JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_actions_debtor_id ON actions(debtor_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 3", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn log_audit(
    conn: &Connection,
    action: &str,
    debtor_id: Option<&str>,
    record_count: i64,
    details: &str,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO audit_log (id, action, details, debtor_id, record_count, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            &id,
            action,
            details,
            debtor_id,
            record_count,
            &now,
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}