// gorka-shared::connectors::http_reqwest
//
// Real HTTP client backed by reqwest::blocking. Style mirrors
// sync_discovery.rs, which uses the same blocking client for the
// Control Plane discovery calls.
//
// Slice 3c adds pinned(): a client that resolves a host to a
// specific IP and connects there, with redirects disabled and
// proxies bypassed. TLS verification is preserved (SNI and
// hostname verification use the original hostname).
//
// See CONNECTOR-MODEL.md Section 7.

use std::time::Duration;

use super::http::{HttpClient, HttpError, HttpErrorKind, HttpMethod, HttpRequest, HttpResponse};
use crate::connectors::{ConnectorError, ConnectorErrorKind};

const CONNECT_TIMEOUT_SECS: u64 = 30;
const READ_TIMEOUT_SECS: u64 = 60;

pub struct ReqwestHttpClient {
    client: reqwest::blocking::Client,
}

impl ReqwestHttpClient {
    pub fn new() -> Self {
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
            .timeout(Duration::from_secs(READ_TIMEOUT_SECS))
            .build()
            .expect("failed to build reqwest blocking client");
        Self { client }
    }

    /// Build a client that resolves `host` to `ip` and connects there.
    /// All other client configuration preserved: no proxy, no redirects,
    /// TLS verification intact, timeouts unchanged.
    ///
    /// Returns Result rather than panicking: a builder failure is a
    /// credential-free TransportError.
    pub fn pinned(
        host: &str,
        ip: std::net::IpAddr,
        port: u16,
    ) -> Result<Self, ConnectorError> {
        let addr = std::net::SocketAddr::new(ip, port);
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
            .timeout(Duration::from_secs(READ_TIMEOUT_SECS))
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .resolve(host, addr)
            .build()
            .map_err(|e| ConnectorError {
                kind: ConnectorErrorKind::TransportError,
                message: format!("pinned client builder failed: {}", e),
                provider_response: None,
            })?;
        Ok(Self { client })
    }
}

impl Default for ReqwestHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpClient for ReqwestHttpClient {
    fn execute(&self, request: &HttpRequest) -> Result<HttpResponse, HttpError> {
        let mut builder = match request.method {
            HttpMethod::Get => self.client.get(&request.url),
            HttpMethod::Post => self.client.post(&request.url),
        };

        for (name, value) in &request.headers {
            builder = builder.header(name.as_str(), value.as_str());
        }

        if !request.body.is_empty() {
            builder = builder.body(request.body.clone());
        }

        let response = builder.send().map_err(|e| {
            let kind = if e.is_timeout() {
                HttpErrorKind::Timeout
            } else {
                HttpErrorKind::Transport
            };
            HttpError {
                kind,
                message: format!("reqwest error: {}", e),
            }
        })?;

        let status = response.status().as_u16();
        let body = response.bytes().map_err(|e| HttpError {
            kind: HttpErrorKind::Transport,
            message: format!("failed to read response body: {}", e),
        })?;

        Ok(HttpResponse {
            status,
            body: body.to_vec(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_does_not_panic() {
        let _ = ReqwestHttpClient::new();
    }

    #[test]
    fn execute_maps_connection_failure_to_transport_error() {
        // Port 1 on loopback: no listener. Connection refused.
        let client = ReqwestHttpClient::new();
        let request = HttpRequest {
            method: HttpMethod::Get,
            url: "http://127.0.0.1:1/".to_string(),
            headers: vec![],
            body: vec![],
        };
        let err = client.execute(&request).unwrap_err();
        assert!(matches!(
            err.kind,
            HttpErrorKind::Transport | HttpErrorKind::Timeout
        ));
    }

    #[test]
    fn execute_maps_invalid_url_to_transport_error() {
        let client = ReqwestHttpClient::new();
        let request = HttpRequest {
            method: HttpMethod::Get,
            url: "not a url".to_string(),
            headers: vec![],
            body: vec![],
        };
        let err = client.execute(&request).unwrap_err();
        assert!(matches!(err.kind, HttpErrorKind::Transport));
    }
}