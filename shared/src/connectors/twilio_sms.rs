// gorka-shared::connectors::twilio_sms
//
// Twilio SMS adapter. Implements ConnectorAdapter. All network
// calls go through the injected HttpClient; this module never opens
// a socket itself. Tests use MockHttpClient.
//
// Credential shape (CONNECTOR-MODEL.md Section 6.2):
//   value:         JSON {"accountSid": "AC...", "authToken": "..."}
//   configuration: JSON {"from": "+1234567890"}
//
// HTTP shape per Twilio REST API 2010-04-01. Endpoints and payload
// fields are stable and long-lived; fixtures below are reasonable
// defaults. First live send should confirm against the current
// Twilio docs.

use crate::connectors::http::{HttpClient, HttpErrorKind, HttpMethod, HttpRequest};
use crate::connectors::http_reqwest::ReqwestHttpClient;
use crate::connectors::{
    ConnectorAdapter, ConnectorCredential, ConnectorError, ConnectorErrorKind, SendRequest,
    SendResult,
};
use base64::Engine;
use serde::Deserialize;

const CATALOG_CODE: &str = "twilio-sms";

const API_BASE: &str = "https://api.twilio.com/2010-04-01";

#[derive(Deserialize)]
struct CredentialJson {
    #[serde(rename = "accountSid")]
    account_sid: String,
    #[serde(rename = "authToken")]
    auth_token: String,
}

#[derive(Deserialize)]
struct SendSuccess {
    sid: String,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Deserialize)]
struct ErrorBody {
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    code: Option<u32>,
    #[serde(default)]
    status: Option<u16>,
}

pub struct TwilioSmsAdapter {
    account_sid: String,
    auth_token: String,
    from: String,
    http: Box<dyn HttpClient>,
}

impl TwilioSmsAdapter {
    pub fn new(
        credential: ConnectorCredential,
        http: Box<dyn HttpClient>,
    ) -> Result<Self, ConnectorError> {
        let value_str = std::str::from_utf8(&credential.value).map_err(|_| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: "Twilio credential is not valid UTF-8".into(),
            provider_response: None,
        })?;

        let cred: CredentialJson = serde_json::from_str(value_str).map_err(|_| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: "Twilio credential JSON is malformed or missing 'accountSid'/'authToken'"
                .into(),
            provider_response: None,
        })?;

        if cred.account_sid.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Twilio credential has empty 'accountSid'".into(),
                provider_response: None,
            });
        }
        if cred.auth_token.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Twilio credential has empty 'authToken'".into(),
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
                message: "Twilio configuration is missing 'from'".into(),
                provider_response: None,
            })?;

        if from.trim().is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: "Twilio configuration has empty 'from'".into(),
                provider_response: None,
            });
        }

        Ok(Self {
            account_sid: cred.account_sid,
            auth_token: cred.auth_token,
            from,
            http,
        })
    }

    fn basic_auth_header(&self) -> String {
        let raw = format!("{}:{}", self.account_sid, self.auth_token);
        let encoded = base64::engine::general_purpose::STANDARD.encode(raw.as_bytes());
        format!("Basic {}", encoded)
    }

    fn build_send_request(&self, request: &SendRequest) -> HttpRequest {
        let form = serde_urlencoded::to_string([
            ("To", request.to.as_str()),
            ("From", self.from.as_str()),
            ("Body", request.body.as_str()),
        ])
        .unwrap_or_default();

        HttpRequest {
            method: HttpMethod::Post,
            url: format!(
                "{}/Accounts/{}/Messages.json",
                API_BASE, self.account_sid
            ),
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

    fn build_account_request(&self) -> HttpRequest {
        HttpRequest {
            method: HttpMethod::Get,
            url: format!("{}/Accounts/{}.json", API_BASE, self.account_sid),
            headers: vec![(
                "Authorization".to_string(),
                self.basic_auth_header(),
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
            400 => ConnectorErrorKind::InvalidRecipient,
            429 => ConnectorErrorKind::RateLimited,
            500..=599 => ConnectorErrorKind::ProviderTransientError,
            400..=499 => ConnectorErrorKind::ProviderPermanentError,
            _ => ConnectorErrorKind::ProviderPermanentError,
        };

        ConnectorError {
            kind,
            message: format!("Twilio returned HTTP {}: {}", status, provider_message),
            provider_response: None,
        }
    }
}

/// Build an adapter that talks to the real Twilio API through
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
    Ok(Box::new(TwilioSmsAdapter::new(credential, http)?))
}

impl ConnectorAdapter for TwilioSmsAdapter {
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
                    message: "Twilio success response was not valid JSON".into(),
                    provider_response: None,
                })?;
            return Ok(SendResult {
                success: true,
                provider_message_id: Some(parsed.sid),
                provider_status: parsed.status,
                provider_response: None,
            });
        }

        Err(Self::map_error_response(response.status, &response.body))
    }

    fn test_connection(&self) -> Result<(), ConnectorError> {
        let http_request = self.build_account_request();
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

    const SAMPLE_SID: &str = "ACtest_account_sid_do_not_use";
    const SAMPLE_TOKEN: &str = "test_auth_token_do_not_use";

    fn sample_credential() -> ConnectorCredential {
        ConnectorCredential {
            value: serde_json::json!({
                "accountSid": SAMPLE_SID,
                "authToken": SAMPLE_TOKEN,
            })
            .to_string()
            .into_bytes(),
            configuration: serde_json::json!({"from": "+15550000001"}),
        }
    }

    fn sample_request() -> SendRequest {
        SendRequest {
            to: "+15550000002".to_string(),
            body: "Hello from GORKA".to_string(),
            subject: None,
            from: "+15550000001".to_string(),
        }
    }

    fn ok(status: u16, body: &str) -> Result<HttpResponse, HttpError> {
        Ok(HttpResponse {
            status,
            body: body.as_bytes().to_vec(),
        })
    }

    fn expect_constructor_error(
        result: Result<TwilioSmsAdapter, ConnectorError>,
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
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock));
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().code(), CATALOG_CODE);
    }

    #[test]
    fn new_rejects_malformed_credential_json() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: b"not json at all".to_vec(),
            configuration: serde_json::json!({"from": "+15550000001"}),
        };
        let err = expect_constructor_error(TwilioSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_account_sid() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({"authToken": SAMPLE_TOKEN})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({"from": "+15550000001"}),
        };
        let err = expect_constructor_error(TwilioSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_missing_auth_token() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({"accountSid": SAMPLE_SID})
                .to_string()
                .into_bytes(),
            configuration: serde_json::json!({"from": "+15550000001"}),
        };
        let err = expect_constructor_error(TwilioSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    #[test]
    fn new_rejects_empty_auth_token() {
        let (mock, _handle) = MockHttpClient::new(vec![]);
        let cred = ConnectorCredential {
            value: serde_json::json!({
                "accountSid": SAMPLE_SID,
                "authToken": "   ",
            })
            .to_string()
            .into_bytes(),
            configuration: serde_json::json!({"from": "+15550000001"}),
        };
        let err = expect_constructor_error(TwilioSmsAdapter::new(cred, Box::new(mock)));
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
                "accountSid": SAMPLE_SID,
                "authToken": SAMPLE_TOKEN,
            })
            .to_string()
            .into_bytes(),
            configuration: serde_json::json!({}),
        };
        let err = expect_constructor_error(TwilioSmsAdapter::new(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }

    // --- send: request shape ---

    #[test]
    fn send_builds_expected_request() {
        let (mock, handle) = MockHttpClient::new(vec![ok(
            201,
            r#"{"sid":"SM_test_1","status":"queued"}"#,
        )]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let _ = adapter.send(&sample_request());

        let received = handle.received();
        assert_eq!(received.len(), 1);
        let req = &received[0];
        assert_eq!(req.method, HttpMethod::Post);
        assert!(req.url.contains("/Accounts/"));
        assert!(req.url.contains("/Messages.json"));
        assert!(req
            .headers
            .iter()
            .any(|(k, v)| k == "Authorization" && v.starts_with("Basic ")));
        assert!(req
            .headers
            .iter()
            .any(|(k, v)| k.eq_ignore_ascii_case("Content-Type")
                && v == "application/x-www-form-urlencoded"));

        let body_str = std::str::from_utf8(&req.body).unwrap();
        assert!(body_str.contains("To=%2B15550000002"));
        assert!(body_str.contains("From=%2B15550000001"));
        assert!(body_str.contains("Body=Hello+from+GORKA"));
    }

    // --- send: response handling ---

    #[test]
    fn send_parses_success_response() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(
            201,
            r#"{"sid":"SM_abc","status":"queued"}"#,
        )]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let result = adapter.send(&sample_request()).unwrap();
        assert!(result.success);
        assert_eq!(result.provider_message_id.as_deref(), Some("SM_abc"));
        assert_eq!(result.provider_status.as_deref(), Some("queued"));
    }

    #[test]
    fn send_maps_http_401_to_authentication_failed() {
        let body = r#"{"code":20003,"message":"Authentication Error","status":401}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(401, body)]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::AuthenticationFailed));
    }

    #[test]
    fn send_maps_http_400_to_invalid_recipient() {
        let body = r#"{"code":21211,"message":"Invalid To number","status":400}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(400, body)]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::InvalidRecipient));
    }

    #[test]
    fn send_maps_http_429_to_rate_limited() {
        let body = r#"{"code":20429,"message":"Too many requests","status":429}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(429, body)]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::RateLimited));
    }

    #[test]
    fn send_maps_http_500_to_transient() {
        let body = r#"{"message":"Server error","status":500}"#;
        let (mock, _handle) = MockHttpClient::new(vec![ok(500, body)]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::ProviderTransientError
        ));
    }

    #[test]
    fn send_maps_transport_error_to_transport_error() {
        let (mock, _handle) = MockHttpClient::new(vec![Err(HttpError {
            kind: HttpErrorKind::Transport,
            message: "connection refused".into(),
        })]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();
        assert!(matches!(err.kind, ConnectorErrorKind::TransportError));
    }

    // --- test_connection ---

    #[test]
    fn test_connection_ok_on_account_200() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(
            200,
            r#"{"sid":"ACtest_account_sid_do_not_use","status":"active"}"#,
        )]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        assert!(adapter.test_connection().is_ok());
    }

    // --- mandatory credential-leak regression (CONNECTOR-MODEL.md Section 7.8) ---

    #[test]
    fn credential_never_appears_in_debug_or_display() {
        let (mock, _handle) = MockHttpClient::new(vec![ok(
            401,
            r#"{"code":20003,"message":"Authentication Error","status":401}"#,
        )]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();

        let err = adapter.send(&sample_request()).unwrap_err();

        let debug_str = format!("{:?}", err);
        let display_str = format!("{}", err);
        assert!(
            !debug_str.contains(SAMPLE_TOKEN),
            "auth token leaked via ConnectorError Debug"
        );
        assert!(
            !display_str.contains(SAMPLE_TOKEN),
            "auth token leaked via ConnectorError Display"
        );

        let (mock, _handle) = MockHttpClient::new(vec![ok(
            201,
            r#"{"sid":"SM_x","status":"queued"}"#,
        )]);
        let adapter = TwilioSmsAdapter::new(sample_credential(), Box::new(mock)).unwrap();
        let result = adapter.send(&sample_request()).unwrap();
        let result_debug = format!("{:?}", result);
        assert!(
            !result_debug.contains(SAMPLE_TOKEN),
            "auth token leaked via SendResult Debug"
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
            configuration: serde_json::json!({"from": "+15550000001"}),
        };
        let err = expect_factory_error(factory_with_http(cred, Box::new(mock)));
        assert!(matches!(
            err.kind,
            ConnectorErrorKind::LocalConfigurationError
        ));
    }
}