// gorka-shared::connectors::openai_compatible
//
// Slice 3b. OpenAI-compatible AI adapter.
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.3, §5.5.2, §5.5.4,
//            §5.6, §5.7, §6.5.
//
// In 3b, the production transport path refuses to open a socket. The
// adapter's send() calls http_provider.build(host)? before touching
// any network primitive. In production, PinnedReqwestProvider
// returns TransportError. Automated tests inject MockHttpClientProvider.
//
// Credential value:      {"apiKey": "sk-..."}
// Configuration:         {"model": "gpt-4o-mini", "base_url": "https://api.openai.com/v1"}
//
// base_url is user-supplied and must satisfy §6.5 path policy.
// Validated at construction (validate_static).

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

pub const CATALOG_CODE: &str = "openai-compatible";

const CHAT_COMPLETIONS_SUFFIX: &str = "/chat/completions";

// ---------------------------------------------------------------------
// Credential shapes
// ---------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenAiCredentialJson {
    #[serde(rename = "apiKey")]
    api_key: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenAiConfigurationJson {
    model: String,
    #[serde(rename = "base_url")]
    base_url: String,
}

// ---------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------

pub struct OpenAiCompatibleAdapter {
    api_key: String,
    model: String,
    validated_base: ValidatedBaseUrl,
    http_provider: Box<dyn HttpClientProvider>,
}

impl OpenAiCompatibleAdapter {
    fn build(
        credential: ConnectorCredential,
        http_provider: Box<dyn HttpClientProvider>,
    ) -> Result<Self, ConnectorError> {
        let value_str = std::str::from_utf8(&credential.value)
            .map_err(|_| config_err("credential value is not valid UTF-8"))?;
        let cred: OpenAiCredentialJson = serde_json::from_str(value_str).map_err(|_| {
            config_err("credential value must be JSON {\"apiKey\": \"...\"}")
        })?;
        if cred.api_key.is_empty() {
            return Err(config_err("apiKey is empty"));
        }

        let cfg: OpenAiConfigurationJson =
            serde_json::from_value(credential.configuration.clone()).map_err(|_| {
                config_err("configuration must be JSON {\"model\": \"...\", \"base_url\": \"...\"}")
            })?;
        if cfg.model.is_empty() {
            return Err(config_err("model is empty"));
        }
        if cfg.base_url.is_empty() {
            return Err(config_err("base_url is empty"));
        }

        let validated_base = base_url::validate_static(&cfg.base_url)?;

        // §6.5: reject if base path already ends with /chat/completions.
        let path = validated_base.path();
        if path.ends_with(CHAT_COMPLETIONS_SUFFIX) {
            return Err(config_err(format!(
                "base_url must not include the {} suffix",
                CHAT_COMPLETIONS_SUFFIX
            )));
        }

        Ok(Self {
            api_key: cred.api_key,
            model: cfg.model,
            validated_base,
            http_provider,
        })
    }

    fn build_request_url(&self) -> Result<String, ConnectorError> {
        self.validated_base.full_path_for(CHAT_COMPLETIONS_SUFFIX)
    }
}

impl ConnectorAdapter for OpenAiCompatibleAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        let canonical = CanonicalAiRequest::from_json(&request.body).map_err(|e| {
            ConnectorError {
                kind: ConnectorErrorKind::LocalConfigurationError,
                message: format!("canonical AI request malformed: {}", e),
                provider_response: None,
            }
        })?;

        let body = build_openai_body(&canonical)?;
        let body_bytes = serde_json::to_vec(&body).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: format!("openai body serialization failed: {}", e),
            provider_response: None,
        })?;

        let client = self.http_provider.build(&self.validated_base)?;

        let url = self.build_request_url()?;
        let http_req = HttpRequest {
            method: HttpMethod::Post,
            url,
            headers: vec![
                ("content-type".into(), "application/json".into()),
                (
                    "authorization".into(),
                    format!("Bearer {}", self.api_key),
                ),
            ],
            body: body_bytes,
        };

        let resp = client.execute(&http_req).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("openai transport error: {}", e.message),
            provider_response: None,
        })?;

        parse_openai_response(resp)
    }

    fn test_connection(&self) -> Result<(), ConnectorError> {
        let client = self.http_provider.build(&self.validated_base)?;

        let http_req = HttpRequest {
            method: HttpMethod::Get,
            url: format!("{}/models", self.validated_base.as_str()),
            headers: vec![(
                "authorization".into(),
                format!("Bearer {}", self.api_key),
            )],
            body: Vec::new(),
        };

        let resp = client.execute(&http_req).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("openai transport error: {}", e.message),
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
    Ok(Box::new(OpenAiCompatibleAdapter::build(
        credential,
        Box::new(PinnedReqwestProvider::system()),
    )?))
}

// ---------------------------------------------------------------------
// Test-only factory
// ---------------------------------------------------------------------

#[cfg(any(test, feature = "test-mock-provider"))]
pub fn factory_with_provider(
    credential: ConnectorCredential,
    http_provider: Box<dyn HttpClientProvider>,
) -> Result<Box<dyn ConnectorAdapter>, ConnectorError> {
    Ok(Box::new(OpenAiCompatibleAdapter::build(
        credential,
        http_provider,
    )?))
}

// ---------------------------------------------------------------------
// Body construction
// ---------------------------------------------------------------------

fn build_openai_body(canonical: &CanonicalAiRequest) -> Result<Value, ConnectorError> {
    let opts: Value =
        serde_json::from_str(&canonical.options_json).map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::LocalConfigurationError,
            message: format!("options_json is not JSON: {}", e),
            provider_response: None,
        })?;

    let mut body = serde_json::Map::new();
    body.insert("model".into(), Value::String(canonical.model.clone()));
    body.insert(
        "messages".into(),
        json!([
            { "role": "system", "content": canonical.system_prompt },
            { "role": "user",   "content": canonical.user_message },
            { "role": "user",   "content": canonical.context_json }
        ]),
    );

    if let Some(t) = opts.get("temperature") {
        body.insert("temperature".into(), t.clone());
    }
    if let Some(m) = opts.get("max_output_tokens") {
        body.insert("max_tokens".into(), m.clone());
    }

    Ok(Value::Object(body))
}

// ---------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------

fn parse_openai_response(resp: HttpResponse) -> Result<SendResult, ConnectorError> {
    if resp.status >= 400 {
        return Err(map_status_error(resp.status));
    }

    let v: Value = serde_json::from_slice(&resp.body).map_err(|e| ConnectorError {
        kind: ConnectorErrorKind::ResponseParseError,
        message: format!("openai response is not JSON: {}", e),
        provider_response: None,
    })?;

    let content = v
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| ConnectorError {
            kind: ConnectorErrorKind::ResponseParseError,
            message: "openai response missing choices[0].message.content".into(),
            provider_response: None,
        })?;

    let provider_id = v.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());

    Ok(SendResult {
        success: true,
        provider_message_id: provider_id,
        provider_status: Some("completed".into()),
        provider_response: Some(json!({ "answer": content })),
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
        message: format!("openai returned HTTP {}", status),
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