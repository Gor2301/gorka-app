// src-tauri/src/storage_migration.rs
//
// One-time storage-root migration for the GORKA Client Dashboard.
//
// Legacy location (ProjectDirs):
//     %APPDATA%\gorka\client\data\
//
// New location (Tauri app-data for bundle id com.gorka.client):
//     %APPDATA%\com.gorka.client\data\
//
// Properties:
//   - Client-only. The Agent App never runs this code.
//   - Runs at startup, before anything opens the database.
//   - Crash-safe: staging goes into data.migrating\ and is
//     promoted to data\ only after the copy has been verified.
//   - Non-destructive: OLD_ROOT is left untouched.
//
// The legacy path string appears ONLY in this file.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use sha2::{Digest, Sha256};
use tauri::Manager;

const CLIENT_DB_FILENAME: &str = "gorka-client.db";

/// Run the one-time storage migration if needed.
///
/// Must be called during Tauri setup, BEFORE any code path opens
/// the database. Subsequent calls are no-ops.
pub fn migrate_client_storage_if_needed(
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let old_root = legacy_root()?;
    let new_root = new_root(app)?;
    let tmp_root = tmp_root(app)?;

    // --- State machine ---

    if new_root.exists() {
        // Migration already complete. Discard any stale TMP_ROOT.
        if tmp_root.exists() {
            let _ = fs::remove_dir_all(&tmp_root);
            log_line("Discarded stale TMP_ROOT from a prior attempt.");
        }
        log_line("NEW_ROOT exists; migration not needed.");
        return Ok(());
    }

    if tmp_root.exists() {
        // Incomplete prior attempt. Discard and start over.
        fs::remove_dir_all(&tmp_root).map_err(|e| {
            format!("Failed to remove stale TMP_ROOT {:?}: {}", tmp_root, e)
        })?;
        log_line("Removed incomplete TMP_ROOT from a prior attempt.");
    }

    let old_db = old_root.join(CLIENT_DB_FILENAME);
    if !old_db.exists() {
        // Fresh install. Nothing to migrate.
        log_line("OLD_DB does not exist; assuming fresh install.");
        return Ok(());
    }

    // --- Migration ---

    log_line("Starting client storage migration.");
    log_line(&format!("  OLD_ROOT: {:?}", old_root));
    log_line(&format!("  NEW_ROOT: {:?}", new_root));
    log_line(&format!("  TMP_ROOT: {:?}", tmp_root));

    fs::create_dir_all(&tmp_root).map_err(|e| {
        format!("Failed to create TMP_ROOT {:?}: {}", tmp_root, e)
    })?;

    // DB
    let old_db_wal = old_root.join(format!("{}-wal", CLIENT_DB_FILENAME));
    let tmp_db = tmp_root.join(CLIENT_DB_FILENAME);
    copy_file(&old_db, &tmp_db)?;
    log_line(&format!("  Copied DB ({} bytes).", file_size(&old_db)?));

    // WAL, if present
    let tmp_wal = tmp_root.join(format!("{}-wal", CLIENT_DB_FILENAME));
    if old_db_wal.exists() {
        copy_file(&old_db_wal, &tmp_wal)?;
        log_line(&format!("  Copied WAL ({} bytes).", file_size(&old_db_wal)?));
    } else {
        log_line("  No WAL present; nothing to copy.");
    }
    // -shm is not copied. SQLite recreates it on first open.

    // files/, if present
    let old_files = old_root.join("files");
    if old_files.exists() {
        let tmp_files = tmp_root.join("files");
        copy_dir_recursive(&old_files, &tmp_files)?;
        log_line("  Copied files/ recursively.");
    } else {
        log_line("  No files/ present; nothing to copy.");
    }

    // --- Verify before promotion ---

    let old_hash = file_sha256(&old_db)?;
    let tmp_hash = file_sha256(&tmp_db)?;
    if old_hash != tmp_hash {
        return Err(format!(
            "Verification failed: OLD_DB hash {} != TMP_DB hash {}",
            old_hash, tmp_hash
        ));
    }
    log_line(&format!("  Verified DB hash: {}", old_hash));

    if old_db_wal.exists() {
        let old_wal_size = file_size(&old_db_wal)?;
        let tmp_wal_size = file_size(&tmp_wal)?;
        if old_wal_size != tmp_wal_size {
            return Err(format!(
                "WAL size mismatch: old {} != tmp {}",
                old_wal_size, tmp_wal_size
            ));
        }
        log_line(&format!("  Verified WAL size: {}", old_wal_size));
    }

    // --- Promote ---
    //
    // NEW_ROOT must not exist at promotion time. If it appeared
    // between the state-machine check and here (should be
    // impossible, single process), rename will fail loudly.

    fs::rename(&tmp_root, &new_root).map_err(|e| {
        format!(
            "Promotion failed: rename {:?} -> {:?}: {}",
            tmp_root, new_root, e
        )
    })?;
    log_line("Promotion complete. NEW_ROOT is now authoritative.");

    Ok(())
}

fn legacy_root() -> Result<PathBuf, String> {
    let proj_dirs = directories::ProjectDirs::from("com", "gorka", "client")
        .ok_or_else(|| "Failed to resolve legacy ProjectDirs root".to_string())?;
    Ok(proj_dirs.data_dir().to_path_buf())
}

fn new_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(app_data.join("data"))
}

fn tmp_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(app_data.join("data.migrating"))
}

fn copy_file(src: &Path, dst: &Path) -> Result<(), String> {
    fs::copy(src, dst)
        .map_err(|e| format!("Failed to copy {:?} -> {:?}: {}", src, dst, e))?;
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create dir {:?}: {}", dst, e))?;
    let entries =
        fs::read_dir(src).map_err(|e| format!("Failed to read dir {:?}: {}", src, e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name();
        let target = dst.join(&file_name);
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to get file type for {:?}: {}", path, e))?;
        if file_type.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            copy_file(&path, &target)?;
        }
    }
    Ok(())
}

fn file_size(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;
    Ok(meta.len())
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file =
        fs::File::open(path).map_err(|e| format!("Failed to open {:?}: {}", path, e))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn log_line(msg: &str) {
    println!("[storage-migration] {}", msg);
}