// src-tauri/src/auth.rs

use tauri::Manager;
use tauri_plugin_store::StoreBuilder;
use serde_json::{json, Value};
use serde::Deserialize;
use rand::RngCore;
use crate::db;

#[derive(Debug, Deserialize)]
struct LoginResponse {
    success: bool,
    data: Option<LoginData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LoginData {
    user: UserData,
    redirectUrl: Option<String>,
    token: String,
}

#[derive(Debug, Deserialize)]
struct UserData {
    id: String,
    email: String,
    name: String,
    role: String,
    #[serde(rename = "organizationId")]
    organization_id: String,
}

pub async fn login(email: String, password: String, app: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post("http://localhost:3000/api/auth/login")
        .json(&json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Login failed: {} - {}", status, text));
    }

    let data: LoginResponse = response.json().await.map_err(|e| e.to_string())?;
    
    if !data.success {
        return Err(data.error.unwrap_or("Login failed".to_string()));
    }

    let login_data = data.data.ok_or("No data in response")?;
    let token = login_data.token.clone();
    let org_id = login_data.user.organization_id;

    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| e.to_string())?;
    
    store.set("auth_token", Value::String(token.clone()));
    store.set("organization_id", Value::String(org_id));
    
    store.save().map_err(|e| e.to_string())?;

    let salt_exists = store.get("salt").is_some();
    if !salt_exists {
        let salt = db::generate_salt();
        let salt_hex = hex::encode(salt);
        store.set("salt", Value::String(salt_hex));
        store.save().map_err(|e| e.to_string())?;
    }

    Ok(token)
}

pub fn get_token(app: tauri::AppHandle) -> Result<String, String> {
    println!("========== GET TOKEN DEBUG ==========");
    println!("🔍 get_token() called");

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| {
            println!("❌ app_data_dir() failed: {}", e);
            e.to_string()
        })?;

    println!("📁 App data directory: {:?}", app_data_dir);

    let store_path = app_data_dir.join("settings.dat");
    println!("📄 Expected store path: {:?}", store_path);
    println!("📄 Store exists: {}", store_path.exists());

    let store = StoreBuilder::new(&app, "settings.dat")
        .build()
        .map_err(|e| {
            println!("❌ Store build failed: {}", e);
            e.to_string()
        })?;

    println!("✅ Store built successfully");
    println!("🔍 Reading auth_token...");

    match store.get("auth_token") {
        Some(value) => {
            println!("✅ auth_token FOUND");
            println!("🔎 Raw value: {:?}", value);

            match value.as_str() {
                Some(token) => {
                    println!("✅ auth_token is a string");
                    println!("🔐 Token length: {}", token.len());
                    println!("=====================================");
                    Ok(token.to_string())
                }
                None => {
                    println!("❌ auth_token exists but is NOT a string");
                    println!("=====================================");
                    Err("auth_token is not a string".to_string())
                }
            }
        }
        None => {
            println!("❌ auth_token NOT FOUND");
            println!("🔍 Checking other expected keys...");
            println!("   organization_id = {:?}", store.get("organization_id"));
            println!("   salt = {:?}", store.get("salt"));
            println!("   db_unlocked = {:?}", store.get("db_unlocked"));
            println!("=====================================");
            Err("No token found".to_string())
        }
    }
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