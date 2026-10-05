// src-tauri/src/auth.rs

use tauri::Manager;
use tauri_plugin_store::StoreBuilder;
use serde_json::Value;
use rand::RngCore;
use crate::db;
use gorka_shared::auth_http;

pub async fn login(email: String, password: String, app: tauri::AppHandle) -> Result<String, String> {
    let result = auth_http::login(&email, &password).await?;

    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    store.set("auth_token", Value::String(result.token.clone()));
    store.set("organization_id", Value::String(result.organization_id));
    store.set("user_name", Value::String(result.name));
    store.set("user_email", Value::String(result.email));
    store.save().map_err(|e| e.to_string())?;

    let salt_exists = store.get("salt").is_some();
    if !salt_exists {
        let salt = db::generate_salt();
        let salt_hex = hex::encode(salt);
        store.set("salt", Value::String(salt_hex));
        store.save().map_err(|e| e.to_string())?;
    }

    Ok(result.token)
}

pub fn get_token(app: tauri::AppHandle) -> Result<String, String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    let token = store.get("auth_token")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("No token found")?;

    Ok(token)
}

pub fn get_organization_id(app: tauri::AppHandle) -> Result<String, String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    let org_id = store.get("organization_id")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("No organization ID found")?;

    Ok(org_id)
}

pub fn get_user_name(app: tauri::AppHandle) -> Result<String, String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    let name = store.get("user_name")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    Ok(name)
}

pub fn get_user_email(app: tauri::AppHandle) -> Result<String, String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    let email = store.get("user_email")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    Ok(email)
}

pub fn get_salt(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {
    let store = StoreBuilder::new(app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    let salt_hex = store.get("salt")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("No salt found")?;

    hex::decode(salt_hex).map_err(|e| e.to_string())
}

pub fn set_unlocked(app: &tauri::AppHandle, unlocked: bool) -> Result<(), String> {
    let store = StoreBuilder::new(app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    store.set("db_unlocked", Value::Bool(unlocked));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

pub fn is_unlocked(app: tauri::AppHandle) -> Result<bool, String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    Ok(store.get("db_unlocked")
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

pub fn logout(app: tauri::AppHandle) -> Result<(), String> {
    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    store.delete("auth_token");
    store.delete("organization_id");
    store.delete("db_unlocked");
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// The TCP port the Client's sync engine listens on. Development
/// mechanism for Phase 9.6; replaced by Control Plane discovery in
/// Phase 9.6b.
pub fn get_listen_port(app: &tauri::AppHandle) -> Result<Option<u16>, String> {
    let store = StoreBuilder::new(app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    Ok(store.get("listen_port").and_then(|v| v.as_u64()).map(|n| n as u16))
}

pub fn set_listen_port(app: &tauri::AppHandle, port: u16) -> Result<(), String> {
    let store = StoreBuilder::new(app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;

    store.set("listen_port", Value::Number(serde_json::Number::from(port as u64)));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}