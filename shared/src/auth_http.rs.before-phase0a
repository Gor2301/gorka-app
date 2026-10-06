// gorka-shared::auth_http
//
// HTTP half of the login flow. Moved from the Client Dashboard's
// auth module in Phase 9.5, Item 2 (auth boundary).
//
// This module contains the parts of login that are Tauri-free:
// the response types and the POST to the auth endpoint. The
// store half of login (writing auth_token, organization_id, and
// salt to settings.dat) stays in each binary, because
// tauri-plugin-store is Tauri-specific and has no Tauri-free
// side.
//
// The endpoint URL is a single hardcoded value here. When the
// production endpoint is configured, this is the one place to
// change it. Both binaries pick it up.
//
// Nothing here is Tauri-specific.

use serde::Deserialize;
use serde_json::json;

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

pub struct LoginResult {
    pub token: String,
    pub organization_id: String,
    pub name: String,
    pub email: String,
}

pub async fn login(email: &str, password: &str) -> Result<LoginResult, String> {
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

    Ok(LoginResult {
        token: login_data.token,
        organization_id: login_data.user.organization_id,
        name: login_data.user.name,
        email: login_data.user.email,
    })
}