// src-tauri-agent/src/main.rs
//
// GORKA Agent Dashboard. Phase 9.5 scaffold.
//
// This binary exists to prove:
//   - the workspace produces a second Tauri application
//   - the second binary consumes the same Tauri-free gorka-shared crate
//   - the Agent has its own bundle identifier, app data folder,
//     settings file, and database filename
//   - the Agent registers its own command list
//
// It does NOT yet implement:
//   - the three-step entry flow (Login, Unlock, Enroll)
//   - debtor, debt, communication, action, or document commands
//   - the plan view, the debtor profile, or the communication tools
//
// Those are Phase 9.5 implementation work, not part of the scaffold.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;
use gorka_shared::storage::AppStorage;

/// Application state for the Agent binary.
///
/// The scaffold holds only an empty database slot. Real commands will
/// use it once the Agent's entry flow and local schema work exist.
struct AgentState {
    #[allow(dead_code)]
    db: Mutex<Option<()>>,
}

/// A trivial command, so that the Agent registers a real
/// generate_handler! entry. Proves the command boundary is
/// per-binary.
#[tauri::command]
fn agent_ping() -> &'static str {
    "pong"
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AgentState {
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

            app.manage(storage);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            agent_ping,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}