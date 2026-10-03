// gorka-shared::sync_discovery
//
// Control Plane discovery client.
//
// Three operations:
//   register_endpoint   announce this device's listen address
//   heartbeat           refresh lastSeenAt
//   discover_peer       ask for a peer's current address
//
// All three call the backend's /api/sync/* endpoints with the
// user's JWT. The wire device_id is passed as a hex string; the
// Control Plane treats it as an opaque label, not as identity.
//
// The endpoint registry on the Control Plane is ephemeral. Nothing
// here changes the sync protocol or the engine's session logic.
// It only replaces how the peer address is obtained.

use reqwest::Client;
use serde::{Deserialize, Serialize};

/// The Control Plane base URL for the discovery client. Same
/// constant the authentication HTTP path uses. Not a new
/// configuration mechanism.
pub const CONTROL_PLANE_BASE_URL: &str = "http://localhost:3000";

#[derive(Debug, Clone)]
pub struct DiscoveredPeer {
    pub wire_device_id_hex: String,
    pub listen_address: String,
}

#[derive(Debug, Serialize)]
struct RegisterRequest<'a> {
    #[serde(rename = "wireDeviceId")]
    wire_device_id: &'a str,
    #[serde(rename = "listenAddress")]
    listen_address: &'a str,
}

#[derive(Debug, Serialize)]
struct HeartbeatRequest<'a> {
    #[serde(rename = "wireDeviceId")]
    wire_device_id: &'a str,
    #[serde(rename = "listenAddress")]
    listen_address: &'a str,
}

#[derive(Debug, Serialize)]
struct UnregisterRequest<'a> {
    #[serde(rename = "wireDeviceId")]
    wire_device_id: &'a str,
}

#[derive(Debug, Deserialize)]
struct PeerEntry {
    #[serde(rename = "wireDeviceId")]
    wire_device_id: String,
    #[serde(rename = "listenAddress")]
    listen_address: String,
}

#[derive(Debug, Deserialize)]
struct PeersResponseData {
    peers: Vec<PeerEntry>,
}

#[derive(Debug, Deserialize)]
struct PeersResponse {
    success: bool,
    data: Option<PeersResponseData>,
}

fn hex_of(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

/// Register this device's listen address with the Control Plane.
pub fn register_endpoint(
    jwt: &str,
    wire_device_id: &[u8],
    listen_address: &str,
) -> Result<(), String> {
    let url = format!("{}/api/sync/register-endpoint", CONTROL_PLANE_BASE_URL);
    let body = RegisterRequest {
        wire_device_id: &hex_of(wire_device_id),
        listen_address,
    };
    let client = Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(jwt)
        .json(&body)
        .send()
        .map_err(|e| format!("register_endpoint request: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "register_endpoint: HTTP {}",
            resp.status().as_u16()
        ));
    }
    Ok(())
}

/// Refresh this device's lastSeenAt on the Control Plane.
pub fn heartbeat(
    jwt: &str,
    wire_device_id: &[u8],
    listen_address: &str,
) -> Result<(), String> {
    let url = format!("{}/api/sync/heartbeat", CONTROL_PLANE_BASE_URL);
    let body = HeartbeatRequest {
        wire_device_id: &hex_of(wire_device_id),
        listen_address,
    };
    let client = Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(jwt)
        .json(&body)
        .send()
        .map_err(|e| format!("heartbeat request: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("heartbeat: HTTP {}", resp.status().as_u16()));
    }
    Ok(())
}

/// Remove this device's endpoint from the Control Plane registry.
/// Called on graceful shutdown.
pub fn unregister_endpoint(jwt: &str, wire_device_id: &[u8]) -> Result<(), String> {
    let url = format!("{}/api/sync/unregister-endpoint", CONTROL_PLANE_BASE_URL);
    let body = UnregisterRequest {
        wire_device_id: &hex_of(wire_device_id),
    };
    let client = Client::new();
    let _ = client
        .post(&url)
        .bearer_auth(jwt)
        .json(&body)
        .send();
    Ok(())
}

/// Ask the Control Plane for a peer's current address.
///
/// Returns Ok(Some(peer)) if a peer is available, Ok(None) if no
/// eligible peer is currently registered, or Err on a Control
/// Plane communication failure.
pub fn discover_peer(
    jwt: &str,
    local_wire_device_id: &[u8],
) -> Result<Option<DiscoveredPeer>, String> {
    let url = format!(
        "{}/api/sync/peers?wireDeviceId={}",
        CONTROL_PLANE_BASE_URL,
        hex_of(local_wire_device_id)
    );
    let client = Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(jwt)
        .send()
        .map_err(|e| format!("discover_peer request: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("discover_peer: HTTP {}", resp.status().as_u16()));
    }
    let parsed: PeersResponse = resp
        .json()
        .map_err(|e| format!("discover_peer parse: {}", e))?;
    if !parsed.success {
        return Err("discover_peer: backend returned success=false".to_string());
    }
    let peers = parsed.data.map(|d| d.peers).unwrap_or_default();
    // The MVP has one eligible peer. Take the first.
    if let Some(p) = peers.into_iter().next() {
        Ok(Some(DiscoveredPeer {
            wire_device_id_hex: p.wire_device_id,
            listen_address: p.listen_address,
        }))
    } else {
        Ok(None)
    }
}