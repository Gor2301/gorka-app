// shared/src/db.rs

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use std::path::PathBuf;
use uuid::Uuid;
use chrono::Utc;
use hex;
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use rand_core::OsRng;
use crate::storage::AppStorage;

pub fn get_db_path(storage: &AppStorage) -> PathBuf {
    let db_path = storage.db_path();
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create data directory");
    }
    db_path
}

/// Returns true if the local encrypted database file exists on disk.
///
/// The existence of the file is the authoritative signal that selects
/// between "set local password" (first run) and "enter local password"
/// (returning run). It is NOT a claim that the database is valid or
/// that the password is correct. The unlock operation is responsible
/// for determining that.
pub fn database_exists(storage: &AppStorage) -> bool {
    storage.db_path().exists()
}

pub fn get_files_dir(storage: &AppStorage) -> PathBuf {
    let files_dir = storage.debtor_files_dir();
    std::fs::create_dir_all(&files_dir).expect("Failed to create files directory");
    files_dir
}

pub fn get_debtor_files_dir(storage: &AppStorage, debtor_id: &str) -> Result<PathBuf, String> {
    Uuid::parse_str(debtor_id)
        .map_err(|_| format!("Invalid debtor_id format: {}", debtor_id))?;

    let files_dir = get_files_dir(storage);
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

pub fn init_db(storage: &AppStorage, key: &str) -> Result<Connection, String> {
    println!("🔍 [RUST] init_db: STARTED");
    
    let db_path = get_db_path(storage);
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

/// Open a fresh in-memory SQLite database and run migrations.
///
/// Used by integration tests. Not used by production code. The
/// returned connection is a plain in-memory SQLite, not SQLCipher.
/// That is acceptable for tests; the migrations themselves run
/// identically against SQLCipher in production.
pub fn open_in_memory_for_tests() -> Result<Connection, String> {
    let mut conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    run_migrations(&mut conn)?;
    Ok(conn)
}

pub fn verify_password(conn: &Connection) -> Result<(), String> {
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .map_err(|_| "Incorrect password".to_string())?;
    Ok(())
}


/// Returns true if the local database contains an organization
/// key row, i.e. this device has completed enrollment.
///
/// The organization_keys table has a single-row constraint
/// (id = 1). A row is present if and only if
/// import_enrollment_package has successfully committed.
///
/// This is a query, not an operation. It does not attempt to
/// import anything, does not read the enrollment package, and
/// does not change state.
pub fn is_enrolled(conn: &Connection) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM organization_keys WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
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

    if current_version < 4 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS organization_keys (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                organization_id TEXT NOT NULL,
                key_material BLOB NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 4", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 5 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "ALTER TABLE debtors ADD COLUMN photo_path TEXT",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 5", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 6 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS calendar_events (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                all_day BOOLEAN DEFAULT 0,
                event_type TEXT NOT NULL DEFAULT 'MANUAL',
                debtor_id TEXT,
                data JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE SET NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_date, end_date)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_calendar_events_debtor_id ON calendar_events(debtor_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 6", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 7 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "ALTER TABLE debtors ADD COLUMN role TEXT NOT NULL DEFAULT 'DEBTOR'",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS debtor_relations (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                debtor_id TEXT NOT NULL,
                related_debtor_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE,
                FOREIGN KEY (related_debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_debtor_relations_unique
                ON debtor_relations(debtor_id, related_debtor_id, relation_type)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_debtor_relations_debtor ON debtor_relations(debtor_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_debtor_relations_related ON debtor_relations(related_debtor_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 7", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    if current_version < 8 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Category A additions: the monotonic soft-delete marker
        // on the three synchronized entities (LOCAL-TABLES.md v1.2
        // amendment).
        tx.execute(
            "ALTER TABLE debtors ADD COLUMN deleted TEXT NOT NULL DEFAULT 'false'",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "ALTER TABLE actions ADD COLUMN deleted TEXT NOT NULL DEFAULT 'false'",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "ALTER TABLE communications ADD COLUMN deleted TEXT NOT NULL DEFAULT 'false'",
            [],
        ).map_err(|e| e.to_string())?;

        // D.1 sync_events: the append-only event log.
        // device_id is the raw 16-byte wire form (SYNC-ARCHITECTURE.md
        // Section 25.6.6). payload is the canonical wire serialization
        // of the event payload (Section 22.13).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS sync_events (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                device_id BLOB NOT NULL,
                event_type TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                payload BLOB NOT NULL,
                sequence INTEGER NOT NULL,
                logical_clock INTEGER NOT NULL,
                created_at DATETIME NOT NULL,
                local_received_at DATETIME NOT NULL,
                UNIQUE (device_id, sequence)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_events_org ON sync_events(organization_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_events_device ON sync_events(device_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_events_created ON sync_events(created_at)",
            [],
        ).map_err(|e| e.to_string())?;

        // D.2 sync_state: one row per local device. Holds the local
        // sequence counter and logical clock (SYNC-ARCHITECTURE.md
        // Sections 11.4, 12.3).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS sync_state (
                device_id BLOB PRIMARY KEY,
                organization_id TEXT NOT NULL,
                sequence_counter INTEGER NOT NULL DEFAULT 0,
                logical_clock INTEGER NOT NULL DEFAULT 0,
                updated_at DATETIME
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // D.3 sync_delivery: per (local_device, peer, origin) delivery
        // bookkeeping (SYNC-ARCHITECTURE.md Sections 17.5, 18.2).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS sync_delivery (
                local_device_id BLOB NOT NULL,
                peer_device_id BLOB NOT NULL,
                origin_device_id BLOB NOT NULL,
                organization_id TEXT NOT NULL,
                watermark INTEGER NOT NULL DEFAULT 0,
                gap_set TEXT NOT NULL DEFAULT '',
                updated_at DATETIME,
                PRIMARY KEY (local_device_id, peer_device_id, origin_device_id)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_delivery_pair ON sync_delivery(local_device_id, peer_device_id)",
            [],
        ).map_err(|e| e.to_string())?;

        // D.4 sync_peers: local cache of known peer devices
        // (SYNC-ARCHITECTURE.md Sections 3, 4, 26.2).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS sync_peers (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                peer_name TEXT,
                peer_type TEXT,
                role TEXT,
                status TEXT,
                last_seen_at DATETIME,
                last_successful_sync DATETIME,
                last_endpoint TEXT,
                is_trusted BOOLEAN DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_peers_org ON sync_peers(organization_id)",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_peers_status ON sync_peers(status)",
            [],
        ).map_err(|e| e.to_string())?;

        // D.6 history_records: losing values from reconciliation
        // (SYNC-ARCHITECTURE.md Sections 13.3, 25.7.1).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS history_records (
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                losing_value TEXT,
                losing_event_id TEXT NOT NULL,
                winning_event_id TEXT NOT NULL,
                reconciled_at DATETIME NOT NULL,
                PRIMARY KEY (entity_type, entity_id, field_name)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // D.7 pending_events: work queue for deferred application
        // (SYNC-ARCHITECTURE.md Sections 14.5, 25.7.5).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS pending_events (
                event_id TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                depends_on_entity_type TEXT NOT NULL,
                depends_on_entity_id TEXT NOT NULL,
                added_at DATETIME NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_pending_events_depends ON pending_events(depends_on_entity_type, depends_on_entity_id)",
            [],
        ).map_err(|e| e.to_string())?;

        // D.8 entity_field_state: current winner per field
        // (SYNC-ARCHITECTURE.md Sections 13, 25.9.9).
        tx.execute(
            "CREATE TABLE IF NOT EXISTS entity_field_state (
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                winning_event_id TEXT NOT NULL,
                winning_logical_clock INTEGER NOT NULL,
                winning_device_id BLOB NOT NULL,
                winning_sequence INTEGER NOT NULL,
                updated_at DATETIME,
                PRIMARY KEY (entity_type, entity_id, field_name)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        tx.execute("PRAGMA user_version = 8", [])
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
