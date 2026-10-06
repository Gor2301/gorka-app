// gorka-shared::connectors::http_reqwest
//
// Real HTTP client backed by reqwest::blocking. Style mirrors
// sync_discovery.rs, which uses the same blocking client for the
// Control Plane discovery calls.
//
// The client is constructed once and reused for every request;
// reqwest::blocking::Client maintains an internal connection pool.
// Request bodies and header values are never logged.
//
// See CONNECTOR-MODEL.md Section 7.

use std::time::Duration;

use super::http::{HttpClient, HttpError, HttpErrorKind, HttpMethod, HttpRequest, HttpResponse};

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