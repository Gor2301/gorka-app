// gorka-shared::connectors::mocean_sms
//
// Mocean SMS adapter. Implements ConnectorAdapter. All network
// calls go through the injected HttpClient; this module never opens
// a socket itself. Tests use MockHttpClient.
//
// Credential shape (CONNECTOR-MODEL.md Section 6.2):
//   value:         JSON {"apiKey": "...", "apiSecret": "..."}
//   configuration: JSON {"from": "GORKA"}
//
// HTTP shape per Mocean REST 2. Endpoints and payload fields below
// are reasonable defaults written from general knowledge of the
// Mocean API, NOT yet confirmed against Mocean's current docs.
// Same caveat as the original Resend adapter carried when it first
// landed. Confirm against Mocean's documentation before the first
// live send. A wrong shape will not fail the unit tests (they test
// our code with a mocked transport); it will surface at first live
// send.

use crate::connectors::http::{HttpClient, HttpErrorKind, HttpMethod, HttpRequest};
use crate::connectors::http_reqwest::ReqwestHttpClient;
use crate::connectors::{
    ConnectorAdapter, ConnectorCredential, ConnectorError, ConnectorErrorKind, SendRequest,
    SendResult,
};
use base64::Engine;
use serde::Deserialize;

const CATALOG_CODE: &str = "mocean-sms";

const SEND_URL: &str = "https://rest.moceanapi.com/rest/2/sms";
const BALANCE_URL: &str = "https://rest.moceanapi.com/rest/2/account/balance";

#[derive(Deserialize)]
struct CredentialJson {
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(rename = "apiSecret")]
    api_secret: String,
}

#[derive(Deserialize)]
struct SendEnvelope {
    #[serde(default)]
    messages: Vec<SendMessage>,
}

#[derive(Deserialize)]
struct SendMessage {
    #[serde(default)]
    status: Option<i32>,
    #[serde(default)]
    msgid: Option<String>,
    #[serde(default)]
    err_msg: Option<String>,
}

pub struct MoceanSmsAdapter {
    api_key: String,
    api_secret: String,
    from: String,
    http: Box<dyn HttpClient>,
}

impl MoceanSmsAdapter {
    pub fn new(
        credential: ConnectorCredential,
        http: Box<dyn HttpClient>,
    ) -> Result<Self, ConnectorError> {
        let value_str = std::str::from_utf8(&credential.value).map_err(|_| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: "Mocean credential is not valid UTF-8".into(),
            provider_response: None,
        })?;

        let cred: CredentialJson = serde_json::from_str(value_str).map_err(|_| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: "Mocean credential JSON is malformed or missing 'apiKey'/'apiSecret'".into(),
            provider_response: None,
        })?;

        if cred.api_key.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Mocean credential has empty 'apiKey'".into(),
                provider_response: None,
            });
        }
        if cred.api_secret.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Mocean credential has empty 'apiSecret'".into(),
                provider_response: None,
            });
        }

        let from = credential
            .configuration
            .get("from")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Mocean configuration is missing 'from'".into(),
                provider_response: None,
            })?;

        if from.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Mocean configuration has empty 'from'".into(),
                provider_response: None,
            });
        }

        Ok(Self {
            api_key: cred.api_key,
            api_secret: cred.api_secret,
            from,
            http,
        })
    }

    fn basic_auth_header(&self) -> String {
        let raw = format!("{}:{}", self.api_key, self.api_secret);
        let encoded = base64::engine::general_purpose::STANDARD.encode(raw.as_bytes());
        format!("Basic {}", encoded)
    }

    fn build_send_request(&self, request: &SendRequest) -> HttpRequest {
        let form = serde_urlencoded::to_string([
            ("mocean-to", request.to.as_str()),
            ("mocean-from", self.from.as_str()),
            ("mocean-text", request.body.as_str()),
            ("mocean-resp-format", "json"),
        ])
        .unwrap_or_default();

        HttpRequest {
            method: HttpMethod::Post,
            url: SEND_URL.to_string(),
            headers: vec![
                ("Authorization".to_string(), self.basic_auth_header()),
                (
                    "Content-Type".to_string(),
                    "application/x-www-form-urlencoded".to_string(),
                ),
            ],
            body: form.into_bytes(),
        }
    }

    fn build_balance_request(&self) -> HttpRequest {
        HttpRequest {
            method: HttpMethod::Post,
            url: BALANCE_URL.to_string(),
            headers: vec![
                ("Authorization".to_string(), self.basic_auth_header()),
                (
                    "Content-Type".to_string(),
                    "application/x-www-form-urlencoded".to_string(),
                ),
            ],
            body: b"mocean-resp-format=json".to_vec(),
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
        // Mocean returns JSON; use err_msg if present, otherwise raw body snippet.
        let parsed: Option<SendEnvelope> = serde_json::from_slice(body).ok();
        let provider_message = parsed
            .as_ref()
            .and_then(|env| env.messages.first())
            .and_then(|m| m.err_msg.clone())
            .unwrap_or_else(|| {
                let s = String::from_utf8_lossy(body);
                let short: String = s.chars().take(200).collect();
                if short.is_empty() {
                    "<no message>".to_string()
                } else {
                    short
                }
            });

        let kind = match status {
            401 | 403 => ConnectorErrorKind::AuthenticationFailed,
            400 => ConnectorErrorKind::InvalidRecipient,
            429 => ConnectorErrorKind::RateLimited,
            500..=599 => ConnectorErrorKind::ProviderTransientError,
            400..=499 => ConnectorErrorKind::ProviderPermanentError,
            _ => ConnectorErrorKind::ProviderPermanentError,
        };

        ConnectorError {
            kind,
            message: format!("Mocean returned HTTP {}: {}", status, provider_message),
            provider_response: None,
        }
    }
}

/// Build an adapter that talks to the real Mocean API through
/// ReqwestHttpClient. Intended for the registry and for application
/// code.
pub fn factory(
    credential: ConnectorCredential,
) -> Result<Box<dyn ConnectorAdapter>, ConnectorError> {
    factory_with_http(credential, Box::new(ReqwestHttpClient::new()))
}

/// Build an adapter with a caller-supplied HttpClient. Used by tests
/// and by any caller that wants to control the transport.
pub fn factory_with_http(
    credential: ConnectorCredential,
    http: Box<dyn HttpClient>,
) -> Result<Box<dyn ConnectorAdapter>, ConnectorError> {
    Ok(Box::new(MoceanSmsAdapter::new(credential, http)?))
}

impl ConnectorAdapter for MoceanSmsAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        let http_request = self.build_send_request(request);
        let response = self
            .http
            .execute(&http_request)
            .map_err(Self::map_http_error)?;

        if response.status == 200 {
            let envelope: SendEnvelope =
                serde_json::from_slice(&response.body).map_err(|_| ConnectorError {
                    kind: ConnectorErrorKind::ResponseParseError,
                    message: "Mocean success response was not valid JSON".into(),
                    provider_response: None,
                })?;

            let first = envelope.messages.into_iter().next().ok_or_else(|| ConnectorError {
                kind: ConnectorErrorKind::ResponseParseError,
                message: "Mocean success response contained no messages".into(),
                provider_response: None,
            })?;

            let accepted = matches!(first.status, Some(0));
            if !accepted {
                let msg = first
                    .err_msg
                    .clone()
                    .unwrap_or_else(|| "Mocean rejected the message".to_string());
                return Err(ConnectorError {
                    kind: ConnectorErrorKind::ProviderPermanentError,
                    message: format!("Mocean rejected the message: {}", msg),
                    provider_response: None,
                });
            }

            return Ok(SendResult {
                success: true,
                provider_message_id: first.msgid,
                provider_status: first.status.map(|s| s.to_string()),
                provider_response: None,
            });
        }

        Err(Self::map_error_response(response.status, &response.body))
    }

    fn test_connection(&self) -> Result<(), ConnectorError> {
        let http_request = self.build_balance_request();
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

    const SAMPLE_KEY: &str = "mocean_api_key_do_not_use";
    const SAMPLE_SECRET: &str = "mocean_api_secret_do_not_use";

    fn sample_credential() -> ConnectorCredential {
        ConnectorCredential {
            value: serde_json::json!({
                "apiKey": SAMPLE_KEY,
                "apiSecret": SAMPLE_SECRET,
            })
            .to_string()
            .into_bytes(),
            configuration: serde_json::json!({"from": "GORKA"}),
        }
    }

    fn sample_request() -> SendRequest {
        SendRequest {
            to: "+15550000002".to_string(),
            body: "Hello from GORKA".to_string(),
            subject: None,
            from: "GORKA".to_string(),
        }
    }

    fn ok(status: u16, body: &str) -> Result<HttpResponse, HttpError> {
        Ok(HttpResponse {
            status,
            body: body.as_bytes().to_vec(),
        })
    }

    fn expect_constructor_error(
        result: Result<MoceanSmsAdapter, ConnectorError>,
    ) -> ConnectorError {
        match result {
            Ok(_) => panic!("expected constructor error, got Ok"),
            Err(e) => e,
        }
    }

    fn expect_factory_error(
        result: Result<Box<dyn ConnectorAdapter>, ConnectorError>,
    ) -> ConnectorError {
        match result {
            Ok(_) => panic!("expected factory error, got Ok"),
            Err(e) => e,
        }
    }

    // --- constructor ---

    #[test]
    fn new_accepts_valid_credential_and_configuration() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock));
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().code(), CATALOG_CODE);
    }

    #[test]
    fn new_rejects_malformed_credential_json() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: b"not json at all".to_vec(),
            configuration: serde_json::json!({"from": "GORKA"}),
        };
        let err = expect_constructor_error(MoceanSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_api_key() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({"apiSecret": SAMPLE_SECRET})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({"from": "GORKA"}),
        };
        let err = expect_constructor_error(MoceanSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_api_secret() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({"apiKey": SAMPLE_KEY})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({"from": "GORKA"}),
        };
        let err = expect_constructor_error(MoceanSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_from() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({
                "apiKey": SAMPLE_KEY,
                "apiSecret": SAMPLE_SECRET,
            })
            .to_string()
            .into_bytes(),
            configuration: serde_json::json!({}),
        };
        let err = expect_constructor_error(MoceanSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    // --- send: request shape ---

    #[test]
    fn send_builds_expected_request() {
        let (mock, handle) = MockHttpClient::new(vec![ok(
            200,
            r#"{"messages":[{"status":0,"msgid":"m_1"}]}"#,
        )]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let _ = adapter.send(&sample_request());

        let received = handle.received();
        assert_eq!(received.len(), 1);
        let req = &received[0];
        assert_eq!(req.method, HttpMethod::Post);
        assert_eq!(req.url, SEND_URL);
        assert!(req
            .headers
            .iter()
            .any(|(k, v)| k == "Authorization" && v.starts_with("Basic ")));

        let body_str = std::str::from_utf8(&req.body).unwrap();
        assert!(body_str.contains("mocean-to=%2B15550000002"));
        assert!(body_str.contains("mocean-from=GORKA"));
        assert!(body_str.contains("mocean-text=Hello+from+GORKA"));
        assert!(body_str.contains("mocean-resp-format=json"));
    }

    // --- send: response handling ---

    #[test]
    fn send_parses_success_response() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(
            200,
            r#"{"messages":[{"status":0,"msgid":"m_abc"}]}"#,
        )]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let result = adapter.send(&sample_request()).unwrap();
        assert!(result.success);
        assert_eq!(result.provider_message_id.as_deref(), Some("m_abc"));
        assert_eq!(result.provider_status.as_deref(), Some("0"));
    }

    #[test]
    fn send_rejects_message_with_nonzero_status() {
        let body = r#"{"messages":[{"status":2,"err_msg":"Invalid recipient"}]}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(200, body)]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::ProviderPermanentError
        ));
    }

    #[test]
    fn send_maps_http_401_to_authentication_failed() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(401, r#"{"err_msg":"Unauthorized"}"#)]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::AuthenticationFailed));
    }

    #[test]
    fn send_maps_http_400_to_invalid_recipient() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(
            400,
            r#"{"messages":[{"status":2,"err_msg":"Invalid recipient"}]}"#,
        )]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::InvalidRecipient));
    }

    #[test]
    fn send_maps_http_429_to_rate_limited() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(429, r#"{"err_msg":"Rate limited"}"#)]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::RateLimited));
    }

    #[test]
    fn send_maps_transport_error_to_transport_error() {
        let (mock, _handle) = MockHttpClient::new(vec![Err(HttpError {
            kind: HttpErrorKind::Transport,
            message: "connection refused".into(),
        })]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::TransportError));
    }

    // --- test_connection ---

    #[test]
    fn test_connection_ok_on_balance_200() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(200, r#"{"balance":100.0}"#)]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        assert!(adapter.test_connection().is_ok());
    }

    // --- mandatory credential-leak regression (CONNECTOR-MODEL.md Section 7.8) ---

    #[test]
    fn credential_never_appears_in_debug_or_display() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(401, r#"{"err_msg":"Unauthorized"}"#)]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();

        let debug_str = format!("{:?}", err);
        let display_str = format!("{}", err);
        assert!(
            !debug_str.contains(SAMPLE_SECRET),
            "api secret leaked via ConnectorError Debug"
        );
        assert!(
            !display_str.contains(SAMPLE_SECRET),
            "api secret leaked via ConnectorError Display"
        );

        let (mock, _handle) = MockHttpClient::new(vec![ok(
            200,
            r#"{"messages":[{"status":0,"msgid":"m_x"}]}"#,
        )]);
        let adapter = MoceanSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();
        let result = adapter.send(&sample_request()).unwrap();
        let result_debug = format!("{:?}", result);
        assert!(
            !result_debug.contains(SAMPLE_SECRET),
            "api secret leaked via SendResult Debug"
        );
    }

    #[test]
    fn factory_with_http_succeeds_on_valid_credential() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let result = factory_with_http(sample_credential(), Box::new(mock));
        assert!(result.is_ok());
        assert_eq!(result.unwrap().code(), CATALOG_CODE);
    }

    #[test]
    fn factory_with_http_propagates_constructor_error() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: b"not json at all".to_vec(),
            configuration: serde_json::json!({"from": "GORKA"}),
        };
        let err = expect_factory_error(factory_with_http(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }
}