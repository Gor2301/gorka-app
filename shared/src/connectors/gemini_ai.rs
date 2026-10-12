// gorka-shared::connectors::gemini_ai
//
// Slice 3b. Gemini AI adapter.
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.2, §5.5.1, §5.5.3, §5.5.4,
//            §5.6, §5.7.
//
// In 3b, the production transport path refuses to open a socket. The
// adapter's send() calls http_provider.build(host)? before touching
// any network primitive. In production, PinnedReqwestProvider
// validates the destination and pins the IP. Automated tests inject
// MockHttpClientProvider.
//
// Credential value:      {"apiKey": "AIza..."}
// Configuration:         {"model": "gemini-2.5-flash"}

use serde::Deserialize;
use serde_json::{json, Value};

use crate::connectors::ai_boundary::CanonicalAiRequest;
use crate::connectors::base_url::{self, ValidatedBaseUrl};
use crate::connectors::http::{HttpMethod, HttpRequest, HttpResponse};
use crate::connectors::transport::{HttpClientProvider, PinnedReqwestProvider};
use crate::connectors::{
    ConnectorAdapter, ConnectorCredential, ConnectorError, ConnectorErrorKind, SendRequest,
    SendResult,
};

pub const CATALOG_CODE: &str = "gemini-ai";

const BASE_URL: &str = "https://generativelanguage.googleapis.com";
const API_VERSION_PATH: &str = "v1beta";

// ---------------------------------------------------------------------
// Credential shapes
// ---------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GeminiCredentialJson {
    #[serde(rename = "apiKey")]
    api_key: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GeminiConfigurationJson {
    model: String,
}

// ---------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------

pub struct GeminiAiAdapter {
    api_key: String,
    model: String,
    validated_base: ValidatedBaseUrl,
    http_provider: Box<dyn HttpClientProvider>,
}

impl GeminiAiAdapter {
    fn build(
        credential: ConnectorCredential,
        http_provider: Box<dyn HttpClientProvider>,
    ) -> Result<Self, ConnectorError> {
        let value_str = std::str::from_utf8(&credential.value).map_err(|_| {
            config_err("credential value is not valid UTF-8")
        })?;
        let cred: GeminiCredentialJson = serde_json::from_str(value_str)
            .map_err(|_| config_err("credential value must be JSON {\"apiKey\": \"...\"}"))?;
        if cred.api_key.is_empty() {
            return Err(config_err("apiKey is empty"));
        }

        let cfg: GeminiConfigurationJson = serde_json::from_value(
            credential.configuration.clone(),
        )
        .map_err(|_| config_err("configuration must be JSON {\"model\": \"...\"}"))?;
        if cfg.model.is_empty() {
            return Err(config_err("model is empty"));
        }

        let validated_base = base_url::validate_static(BASE_URL)?;

        Ok(Self {
            api_key: cred.api_key,
            model: cfg.model,
            validated_base,
            http_provider,
        })
    }

    fn build_request_url(&self) -> String {
        format!(
            "{}/{}/models/{}:generateContent",
            self.validated_base.as_str(),
            API_VERSION_PATH,
            self.model,
        )
    }
}

impl ConnectorAdapter for GeminiAiAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        let canonical = CanonicalAiRequest::from_json(&request.body).map_err(|e| {
            ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: format!("canonical AI request malformed: {}", e),
                provider_response: None,
            }
        })?;

        let body = build_gemini_body(&canonical)?;
        let body_bytes = serde_json::to_vec(&body).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: format!("gemini body serialization failed: {}", e),
            provider_response: None,
        })?;

        let client = self.http_provider.build(&self.validated_base)?;

        let http_req = HttpRequest {
            method: HttpMethod::Post,
            url: self.build_request_url(),
            headers: vec![
                ("content-type".into(), "application/json".into()),
                ("x-goog-api-key".into(), self.api_key.clone()),
            ],
            body: body_bytes,
        };

        let resp = client.execute(&http_req).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("gemini transport error: {}", e.message),
            provider_response: None,
        })?;

        parse_gemini_response(resp)
    }

    fn test_connection(&self) -> Result<(), ConnectorError> {
        let client = self.http_provider.build(&self.validated_base)?;

        let http_req = HttpRequest {
            method: HttpMethod::Get,
            url: format!(
                "{}/{}/models",
                self.validated_base.as_str(),
                API_VERSION_PATH,
            ),
            headers: vec![("x-goog-api-key".into(), self.api_key.clone())],
            body: Vec::new(),
        };

        let resp = client.execute(&http_req).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("gemini transport error: {}", e.message),
            provider_response: None,
        })?;

        if resp.status >= 400 {
            return Err(map_status_error(resp.status));
        }
        Ok(())
    }

    fn code(&self) -> &'static str {
        CATALOG_CODE
    }
}

// ---------------------------------------------------------------------
// Production factory
// ---------------------------------------------------------------------

pub fn factory(
    credential: ConnectorCredential,
) -> Result<Box<dyn ConnectorAdapter>, ConnectorError> {
    Ok(Box::new(GeminiAiAdapter::build(
        credential,
        Box::new(PinnedReqwestProvider::system()),
    )?))
}

// ---------------------------------------------------------------------
// Test-only factory. Reached only when the crate is compiled with the
// test-mock-provider feature (set as a dev-dependency on self).
// ---------------------------------------------------------------------

#[cfg(any(test, feature = "test-mock-provider"))]
pub fn factory_with_provider(
    credential: ConnectorCredential,
    http_provider: Box<dyn HttpClientProvider>,
) -> Result<Box<dyn ConnectorAdapter>, ConnectorError> {
    Ok(Box::new(GeminiAiAdapter::build(credential, http_provider)?))
}

// ---------------------------------------------------------------------
// Body construction
// ---------------------------------------------------------------------

fn build_gemini_body(canonical: &CanonicalAiRequest) -> Result<Value, ConnectorError> {
    let opts: Value =
        serde_json::from_str(&canonical.options_json).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: format!("options_json is not JSON: {}", e),
            provider_response: None,
        })?;

    let temperature = opts.get("temperature").cloned();
    let max_output_tokens = opts.get("max_output_tokens").cloned();

    let mut gen_cfg = serde_json::Map::new();
    if let Some(t) = temperature {
        gen_cfg.insert("temperature".into(), t);
    }
    if let Some(m) = max_output_tokens {
        gen_cfg.insert("maxOutputTokens".into(), m);
    }

    let mut body = serde_json::Map::new();
    body.insert(
        "systemInstruction".into(),
        json!({ "parts": [{ "text": canonical.system_prompt }] }),
    );
    body.insert(
        "contents".into(),
        json!([
            { "role": "user", "parts": [{ "text": canonical.user_message }] },
            { "role": "user", "parts": [{ "text": canonical.context_json }] }
        ]),
    );
    if !gen_cfg.is_empty() {
        body.insert("generationConfig".into(), Value::Object(gen_cfg));
    }

    Ok(Value::Object(body))
}

// ---------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------

fn parse_gemini_response(resp: HttpResponse) -> Result<SendResult, ConnectorError> {
    if resp.status >= 400 {
        return Err(map_status_error(resp.status));
    }

    let v: Value =
        serde_json::from_slice(&resp.body).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::ResponseParseError,
            message: format!("gemini response is not JSON: {}", e),
            provider_response: None,
        })?;

    let text = v
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| ConnectorError {
            kind: ConnectorErrorKind::ResponseParseError,
            message: "gemini response missing candidates[0].content.parts[0].text".into(),
            provider_response: None,
        })?;

    Ok(SendResult {
        success: true,
        provider_message_id: None,
        provider_status: Some("completed".into()),
        provider_response: Some(json!({ "answer": text })),
    })
}

fn map_status_error(status: u16) -> ConnectorError {
    let kind = match status {
        401 | 403 => ConnectorErrorKind::AuthenticationFailed,
        429 => ConnectorErrorKind::RateLimited,
        s if s >= 500 => ConnectorErrorKind::ProviderTransientError,
        _ => ConnectorErrorKind::ProviderPermanentError,
    };
    ConnectorError {
        kind,
        message: format!("gemini returned HTTP {}", status),
        provider_response: None,
    }
}

fn config_err<S: Into<String>>(msg: S) -> ConnectorError {
    ConnectorError {
        kind: ConnectorErrorKind::LocalConfigurationError,
        message: msg.into(),
        provider_response: None,
    }
}