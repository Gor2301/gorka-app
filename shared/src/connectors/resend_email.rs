// gorka-shared::connectors::resend_email
//
// Resend email adapter. Implements ConnectorAdapter. All network
// calls go through the injected HttpClient; this module never opens
// a socket itself. Tests use MockHttpClient.
//
// Credential shape (CONNECTOR-MODEL.md Section 3.5.2, 6.2):
//   value:         JSON {"apiKey": "re_..."}
//   configuration: JSON {"from": "sender@example.com"}
//
// HTTP shape verified against the live Resend API in Phase 3.
// Fixtures below are reasonable defaults, not yet confirmed live.

use crate::connectors::http::{HttpClient, HttpErrorKind, HttpMethod, HttpRequest};
use crate::connectors::{
    ConnectorAdapter, ConnectorCredential, ConnectorError, ConnectorErrorKind, SendRequest,
    SendResult,
};
use serde::Deserialize;

const CATALOG_CODE: &str = "resend-email";

const SEND_URL: &str = "https://api.resend.com/emails";
const DOMAINS_URL: &str = "https://api.resend.com/domains";

#[derive(Deserialize)]
struct CredentialJson {
    #[serde(rename = "apiKey")]
    api_key: String,
}

#[derive(Deserialize)]
struct SendSuccess {
    id: String,
}

#[derive(Deserialize)]
struct ErrorBody {
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default, rename = "statusCode")]
    status_code: Option<u16>,
}

pub struct ResendEmailAdapter {
    api_key: String,
    from: String,
    http: Box<dyn HttpClient>,
}

impl ResendEmailAdapter {
    pub fn new(
        credential: ConnectorCredential,
        http: Box<dyn HttpClient>,
    ) -> Result<Self, ConnectorError> {
        let value_str = std::str::from_utf8(&credential.value).map_err(|_| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: "Resend credential is not valid UTF-8".into(),
            provider_response: None,
        })?;

        let cred: CredentialJson =
            serde_json::from_str(value_str).map_err(|_| ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Resend credential JSON is malformed or missing 'apiKey'".into(),
                provider_response: None,
            })?;

        let from = credential
            .configuration
            .get("from")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Resend configuration is missing 'from'".into(),
                provider_response: None,
            })?;

        Ok(Self {
            api_key: cred.api_key,
            from,
            http,
        })
    }

    fn build_send_request(&self, request: &SendRequest) -> HttpRequest {
        let mut payload = serde_json::json!({
            "from": self.from,
            "to": [request.to],
            "text": request.body,
        });
        if let Some(subject) = &request.subject {
            payload["subject"] = serde_json::Value::String(subject.clone());
        }
        HttpRequest {
            method: HttpMethod::Post,
            url: SEND_URL.to_string(),
            headers: vec![
                (
                    "Authorization".to_string(),
                    format!("Bearer {}", self.api_key),
                ),
                ("Content-Type".to_string(), "application/json".to_string()),
            ],
            body: serde_json::to_vec(&payload).unwrap_or_default(),
        }
    }

    fn build_domains_request(&self) -> HttpRequest {
        HttpRequest {
            method: HttpMethod::Get,
            url: DOMAINS_URL.to_string(),
            headers: vec![(
                "Authorization".to_string(),
                format!("Bearer {}", self.api_key),
            )],
            body: Vec::new(),
        }
    }

    fn map_http_error(e: crate::connectors::http::HttpError) -> ConnectorError {
        let kind = match e.kind {
            HttpErrorKind::Transport => ConnectorErrorKind::TransportError,
            HttpErrorKind::Timeout => ConnectorErrorKind::TransportError,
        };
        ConnectorError {
            kind,
            message: format!("HTTP transport error: {}", e.message),
            provider_response: None,
        }
    }

    fn map_error_response(status: u16, body: &[u8]) -> ConnectorError {
        let parsed: Option<ErrorBody> = serde_json::from_slice(body).ok();
        let provider_message = parsed
            .as_ref()
            .and_then(|e| e.message.clone())
            .unwrap_or_else(|| "<no message>".to_string());

        let kind = match status {
            401 | 403 => ConnectorErrorKind::AuthenticationFailed,
            422 => ConnectorErrorKind::InvalidRecipient,
            429 => ConnectorErrorKind::RateLimited,
            500..=599 => ConnectorErrorKind::ProviderTransientError,
            400..=499 => ConnectorErrorKind::ProviderPermanentError,
            _ => ConnectorErrorKind::ProviderPermanentError,
        };

        ConnectorError {
            kind,
            message: format!("Resend returned HTTP {}: {}", status, provider_message),
            provider_response: None,
        }
    }
}

impl ConnectorAdapter for ResendEmailAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        let http_request = self.build_send_request(request);
        let response = self
            .http
            .execute(&http_request)
            .map_err(Self::map_http_error)?;

        if response.status == 200 || response.status == 201 {
            let parsed: SendSuccess =
                serde_json::from_slice(&response.body).map_err(|_| ConnectorError {
                    kind: ConnectorErrorKind::ResponseParseError,
                    message: "Resend success response was not valid JSON".into(),
                    provider_response: None,
                })?;
            return Ok(SendResult {
                success: true,
                provider_message_id: Some(parsed.id),
                provider_status: None,
                provider_response: None,
            });
        }

        Err(Self::map_error_response(response.status, &response.body))
    }

    fn test_connection(&self) -> Result<(), ConnectorError> {
        let http_request = self.build_domains_request();
        let response = self
            .http
            .execute(&http_request)
            .map_err(Self::map_http_error)?;

        if response.status == 200 {
            Ok(())
        } else {
            Err(Self::map_error_response(response.status, &response.body))
        }
    }

    fn code(&self) -> &'static str {
        CATALOG_CODE
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connectors::http::testing::MockHttpClient;
    use crate::connectors::http::{HttpError, HttpErrorKind, HttpResponse};

    const SAMPLE_API_KEY: &str = "re_test_key_do_not_use";

    fn sample_credential() -> ConnectorCredential {
        ConnectorCredential {
            value: serde_json::json!({"apiKey": SAMPLE_API_KEY})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({"from": "sender@example.com"}),
        }
    }

    fn sample_request() -> SendRequest {
        SendRequest {
            to: "recipient@example.com".to_string(),
            body: "Hello from GORKA".to_string(),
            subject: Some("Test subject".to_string()),
            from: "sender@example.com".to_string(),
        }
    }

    fn ok(status: u16, body: &str) -> Result<HttpResponse, HttpError> {
        Ok(HttpResponse {
            status,
            body: body.as_bytes().to_vec(),
        })
    }

    // --- constructor ---

    #[test]
    fn new_accepts_valid_credential_and_configuration() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let adapter = ResendEmailAdapter::new(sample_credential(), Box::new(mock));
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().code(), CATALOG_CODE);
    }

    #[test]
    fn new_rejects_malformed_credential_json() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: b"not json at all".to_vec(),
            configuration: serde_json::json!({"from": "sender@example.com"}),
        };
        let err = ResendEmailAdapter::new(cred, Box::new(mock)).unwrap_err();
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_api_key() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: b"{}".to_vec(),
            configuration: serde_json::json!({"from": "sender@example.com"}),
        };
        let err = ResendEmailAdapter::new(cred, Box::new(mock)).unwrap_err();
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_from() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({"apiKey": SAMPLE_API_KEY})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({}),
        };
        let err = ResendEmailAdapter::new(cred, Box::new(mock)).unwrap_err();
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    // --- send: request shape ---

    #[test]
    fn send_builds_expected_request() {
        let (mock, handle) = MockHttpClient::new(vec![ok(200, r#"{"id":"msg_1"}"#)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let _ = adapter.send(&sample_request());

        let received = handle.received();
        assert_eq!(received.len(), 1);
        let req = &received[0];
        assert_eq!(req.method, HttpMethod::Post);
        assert_eq!(req.url, SEND_URL);
        assert!(req.headers.iter().any(|(k, _)| k == "Authorization"));
        assert!(req
            .headers
            .iter()
            .any(|(k, _)| k.eq_ignore_ascii_case("Content-Type")));

        let body: serde_json::Value = serde_json::from_slice(&req.body).unwrap();
        assert_eq!(body["from"], "sender@example.com");
        assert_eq!(body["to"][0], "recipient@example.com");
        assert_eq!(body["subject"], "Test subject");
        assert_eq!(body["text"], "Hello from GORKA");
    }

    // --- send: response handling ---

    #[test]
    fn send_parses_success_response() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(200, r#"{"id":"msg_abc"}"#)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let result = adapter.send(&sample_request()).unwrap();
        assert!(result.success);
        assert_eq!(result.provider_message_id.as_deref(), Some("msg_abc"));
    }

    #[test]
    fn send_maps_http_401_to_authentication_failed() {
        let body = r#"{"statusCode":401,"message":"Invalid API key"}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(401, body)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::AuthenticationFailed));
    }

    #[test]
    fn send_maps_http_422_to_invalid_recipient() {
        let body = r#"{"statusCode":422,"message":"Invalid recipient email"}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(422, body)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::InvalidRecipient));
    }

    #[test]
    fn send_maps_http_429_to_rate_limited() {
        let body = r#"{"statusCode":429,"message":"Too many requests"}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(429, body)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::RateLimited));
    }

    #[test]
    fn send_maps_transport_error_to_transport_error() {
        let (mock, _handle) = MockHttpClient::new(vec![Err(HttpError {
            kind: HttpErrorKind::Transport,
            message: "connection refused".into(),
        })]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::TransportError));
    }

    // --- test_connection ---

    #[test]
    fn test_connection_ok_on_domains_200() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(200, r#"{"data":[]}"#)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        assert!(adapter.test_connection().is_ok());
    }

    // --- mandatory credential-leak regression (CONNECTOR-MODEL.md Section 7.8) ---

    #[test]
    fn credential_never_appears_in_debug_or_display() {
        let (mock, _handle) = MockHttpClient::new(vec![
            ok(401, r#"{"statusCode":401,"message":"Invalid API key"}"#),
        ]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();

        let debug_str = format!("{:?}", err);
        let display_str = format!("{}", err);
        assert!(
            !debug_str.contains(SAMPLE_API_KEY),
            "api key leaked via ConnectorError Debug"
        );
        assert!(
            !display_str.contains(SAMPLE_API_KEY),
            "api key leaked via ConnectorError Display"
        );

        // SendResult on the success path.
        let (mock, _handle) = MockHttpClient::new(vec![ok(200, r#"{"id":"msg_x"}"#)]);
        let adapter =
            ResendEmailAdapter::new(sample_credential(), Box::new(mock)).unwrap();
        let result = adapter.send(&sample_request()).unwrap();
        let result_debug = format!("{:?}", result);
        assert!(
            !result_debug.contains(SAMPLE_API_KEY),
            "api key leaked via SendResult Debug"
        );
    }
}