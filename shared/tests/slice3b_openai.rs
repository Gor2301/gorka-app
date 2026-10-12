// shared/tests/slice3b_openai.rs
//
// Slice 3b acceptance tests: OpenAI-compatible adapter and registry.
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.3, §5.5.2, §5.5.4,
//            §5.6, §5.7, §5.8, §5.4.
//
// No real network. Every HTTP call routes through MockHttpClient.
// No test constructs ReqwestHttpClient.

use std::sync::Arc;

use serde_json::{json, Value};

use gorka_shared::connectors::ai_boundary::parse_and_validate;
use gorka_shared::connectors::ai_mapping::{
    verify_semantic_identity, FieldLocation, FieldMapping, FixedConstant,
    ProviderEnvelopeMapping,
};
use gorka_shared::connectors::http::testing::MockHttpClient;
use gorka_shared::connectors::http::{HttpError, HttpErrorKind, HttpResponse};
use gorka_shared::connectors::openai_compatible::{
    factory_with_provider as openai_test_factory, CATALOG_CODE,
};
use gorka_shared::connectors::transport::test_support::MockHttpClientProvider;
use gorka_shared::connectors::{
    build_default_registry, ConnectorAdapter, ConnectorCredential, ConnectorErrorKind,
    ConnectorRegistry, SendRequest,
};

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

const FAKE_KEY: &str = "sk-FAKE-KEY-FOR-TESTS-12345";
const FAKE_MODEL: &str = "gpt-4o-mini";
const FAKE_BASE: &str = "https://api.openai.com/v1";
const EXPECTED_FINAL_URL: &str = "https://api.openai.com/v1/chat/completions";

fn cred() -> ConnectorCredential {
    ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({ "model": FAKE_MODEL, "base_url": FAKE_BASE }),
    }
}

fn valid_raw_json() -> String {
    json!({
        "system_prompt": "You are a helpful assistant.",
        "user_message": "Suggest the next best action.",
        "context": {
            "debtor": {
                "amountRange": "0-1000",
                "daysOverdueRange": "0"
            },
            "communicationHistory": {
                "totalCount": 0,
                "emailCount": 0,
                "smsCount": 0,
                "voiceCount": 0,
                "responseRateBand": "NONE"
            },
            "debts": {
                "totalCount": 0,
                "paidCount": 0,
                "overdueCount": 0
            },
            "indicators": {
                "paymentReliability": "NO_DATA",
                "engagementLevel": "LOW",
                "communicationPreference": null
            }
        },
        "model": "gpt-4o-mini",
        "request_options": {
            "temperature": 0.7,
            "max_output_tokens": 1024
        }
    })
    .to_string()
}

fn canonical_body() -> String {
    parse_and_validate(&valid_raw_json()).unwrap().to_json()
}

fn make_adapter(
    responses: Vec<Result<HttpResponse, HttpError>>,
) -> (
    Box<dyn ConnectorAdapter>,
    gorka_shared::connectors::http::testing::MockHandle,
) {
    let (mock, handle) = MockHttpClient::new(responses);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    let adapter = openai_test_factory(cred(), provider).expect("factory ok");
    (adapter, handle)
}

fn openai_success_body(answer: &str, id: Option<&str>) -> Vec<u8> {
    let mut obj = json!({
        "choices": [ { "message": { "content": answer } } ]
    });
    if let Some(i) = id {
        obj["id"] = json!(i);
    }
    serde_json::to_vec(&obj).unwrap()
}

fn send_request_empty_recipient() -> SendRequest {
    SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical_body(),
    }
}

// ---------------------------------------------------------------------
// OpenAI mapping
// ---------------------------------------------------------------------

struct OpenAiMapping;

impl ProviderEnvelopeMapping for OpenAiMapping {
    fn map_fields() -> Vec<FieldMapping> {
        vec![
            FieldMapping {
                canonical_field: "system_prompt",
                location: FieldLocation::Body(vec!["messages", "0", "content"]),
            },
            FieldMapping {
                canonical_field: "user_message",
                location: FieldLocation::Body(vec!["messages", "1", "content"]),
            },
            FieldMapping {
                canonical_field: "context_json",
                location: FieldLocation::Body(vec!["messages", "2", "content"]),
            },
            FieldMapping {
                canonical_field: "model",
                location: FieldLocation::Body(vec!["model"]),
            },
            FieldMapping {
                canonical_field: "options_json.temperature",
                location: FieldLocation::Body(vec!["temperature"]),
            },
            FieldMapping {
                canonical_field: "options_json.max_output_tokens",
                location: FieldLocation::Body(vec!["max_tokens"]),
            },
        ]
    }

    fn fixed_constants() -> Vec<FixedConstant> {
        vec![
            FixedConstant {
                location: vec!["messages", "0", "role"],
                value: json!("system"),
            },
            FixedConstant {
                location: vec!["messages", "1", "role"],
                value: json!("user"),
            },
            FixedConstant {
                location: vec!["messages", "2", "role"],
                value: json!("user"),
            },
        ]
    }

    fn extract_value<'a>(body: &'a Value, path: &[&str]) -> Option<&'a Value> {
        let mut cur = body;
        for seg in path {
            cur = cur.get(*seg)?;
        }
        Some(cur)
    }

    fn all_leaf_paths(body: &Value) -> Vec<Vec<String>> {
        fn walk(v: &Value, prefix: &mut Vec<String>, out: &mut Vec<Vec<String>>) {
            match v {
                Value::Object(map) => {
                    if map.is_empty() {
                        out.push(prefix.clone());
                    } else {
                        for (k, val) in map {
                            prefix.push(k.clone());
                            walk(val, prefix, out);
                            prefix.pop();
                        }
                    }
                }
                Value::Array(arr) => {
                    for (i, val) in arr.iter().enumerate() {
                        prefix.push(i.to_string());
                        walk(val, prefix, out);
                        prefix.pop();
                    }
                }
                _ => out.push(prefix.clone()),
            }
        }
        let mut out = Vec::new();
        let mut p = Vec::new();
        walk(body, &mut p, &mut out);
        out
    }
}

// ---------------------------------------------------------------------
// 3b-19 .. 3b-22  —  constructor
// ---------------------------------------------------------------------

#[test]
fn constructor_rejects_missing_api_key() {
    let c = ConnectorCredential {
        value: serde_json::to_vec(&json!({})).unwrap(),
        configuration: json!({ "model": FAKE_MODEL, "base_url": FAKE_BASE }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match openai_test_factory(c, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error"),
    }
}

#[test]
fn constructor_rejects_missing_model() {
    let c = ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({ "base_url": FAKE_BASE }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match openai_test_factory(c, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error"),
    }
}

#[test]
fn constructor_rejects_missing_base_url() {
    let c = ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({ "model": FAKE_MODEL }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match openai_test_factory(c, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error"),
    }
}

#[test]
fn constructor_rejects_http_base_url() {
    let c = ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({ "model": FAKE_MODEL, "base_url": "http://api.openai.com/v1" }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match openai_test_factory(c, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error for http scheme"),
    }
}

// ---------------------------------------------------------------------
// 3b-23 .. 3b-24  —  envelope and response
// ---------------------------------------------------------------------

#[test]
fn send_formats_correct_envelope() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", Some("chatcmpl-1")),
    })]);
    adapter.send(&send_request_empty_recipient()).unwrap();

    let received = handle.received();
    assert_eq!(received.len(), 1);
    let r = &received[0];
    assert_eq!(r.url, EXPECTED_FINAL_URL);

    let body: Value = serde_json::from_slice(&r.body).unwrap();
    assert_eq!(body["model"], FAKE_MODEL);
    assert_eq!(body["messages"][0]["role"], "system");
    assert_eq!(body["messages"][1]["role"], "user");
    assert_eq!(body["messages"][2]["role"], "user");
    assert!(body["messages"][0]["content"].is_string());
    assert!(body["messages"][1]["content"].is_string());
    assert!(body["messages"][2]["content"].is_string());
    assert!(body["temperature"].is_number());
    assert!(body["max_tokens"].is_number());
}

#[test]
fn parses_success_into_answer_only() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("hello from openai", Some("chatcmpl-42")),
    })]);
    let result = adapter.send(&send_request_empty_recipient()).unwrap();

    assert!(result.success);
    assert_eq!(result.provider_status.as_deref(), Some("completed"));
    assert_eq!(result.provider_message_id.as_deref(), Some("chatcmpl-42"));

    let pr = result.provider_response.expect("provider_response");
    let obj = pr.as_object().unwrap();
    assert_eq!(obj.len(), 1);
    assert_eq!(obj.get("answer").and_then(|v| v.as_str()), Some("hello from openai"));
}

// ---------------------------------------------------------------------
// 3b-25  —  error mapping (all four kinds)
// ---------------------------------------------------------------------

#[test]
fn maps_401_429_500_transport() {
    let (a, _h) = make_adapter(vec![Ok(HttpResponse { status: 401, body: vec![] })]);
    assert_eq!(
        a.send(&send_request_empty_recipient()).unwrap_err().kind,
        ConnectorErrorKind::AuthenticationFailed
    );

    let (a, _h) = make_adapter(vec![Ok(HttpResponse { status: 429, body: vec![] })]);
    assert_eq!(
        a.send(&send_request_empty_recipient()).unwrap_err().kind,
        ConnectorErrorKind::RateLimited
    );

    let (a, _h) = make_adapter(vec![Ok(HttpResponse { status: 500, body: vec![] })]);
    assert_eq!(
        a.send(&send_request_empty_recipient()).unwrap_err().kind,
        ConnectorErrorKind::ProviderTransientError
    );

    let (a, _h) = make_adapter(vec![Err(HttpError {
        kind: HttpErrorKind::Transport,
        message: "boom".into(),
    })]);
    assert_eq!(
        a.send(&send_request_empty_recipient()).unwrap_err().kind,
        ConnectorErrorKind::TransportError
    );
}

// ---------------------------------------------------------------------
// 3b-26 .. 3b-27  —  semantic identity
// ---------------------------------------------------------------------

#[test]
fn semantic_identity_positive() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", None),
    })]);
    let canonical = parse_and_validate(&valid_raw_json()).unwrap();
    adapter.send(&send_request_empty_recipient()).unwrap();

    let r = &handle.received()[0];
    let body: Value = serde_json::from_slice(&r.body).unwrap();
    let refs: Vec<&str> = Vec::new();

    verify_semantic_identity::<OpenAiMapping>(&body, &refs, &canonical)
        .expect("positive semantic identity must pass");
}

#[test]
fn semantic_identity_injection_caught() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", None),
    })]);
    let canonical = parse_and_validate(&valid_raw_json()).unwrap();
    adapter.send(&send_request_empty_recipient()).unwrap();

    let r = &handle.received()[0];
    let mut body: Value = serde_json::from_slice(&r.body).unwrap();
    body["stray_field"] = json!("surprise");
    let refs: Vec<&str> = Vec::new();

    let err = verify_semantic_identity::<OpenAiMapping>(&body, &refs, &canonical)
        .expect_err("injected leaf must be caught");
    assert!(err.contains("stray_field"), "got: {}", err);
}

// ---------------------------------------------------------------------
// 3b-28  —  credential-leak regression
// ---------------------------------------------------------------------

#[test]
fn credential_leak_regression() {
    fn check(s: &str, label: &str) {
        assert!(
            !s.contains(FAKE_KEY),
            "credential leaked in {}: {}",
            label,
            s
        );
    }

    // Successful SendResult.
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", Some("chatcmpl-1")),
    })]);
    let result = adapter.send(&send_request_empty_recipient()).unwrap();
    check(&format!("{:?}", result), "SendResult debug");
    check(
        &serde_json::to_string(&result.provider_response).unwrap(),
        "provider_response JSON",
    );

    // Auth error.
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse { status: 401, body: vec![] })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    check(&format!("{:?}", err), "AuthFailed debug");
    check(&format!("{}", err), "AuthFailed display");

    // URL check.
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", None),
    })]);
    adapter.send(&send_request_empty_recipient()).unwrap();
    let r = &handle.received()[0];
    assert!(!r.url.contains(FAKE_KEY), "api key must not be in URL");

    // Auth header check: only Authorization should carry the key.
    let mut auth_seen = false;
    for (k, v) in &r.headers {
        if k.eq_ignore_ascii_case("authorization") {
            assert_eq!(v, &format!("Bearer {}", FAKE_KEY));
            auth_seen = true;
        } else {
            assert!(
                !v.contains(FAKE_KEY),
                "api key must only appear in Authorization header; found in {}",
                k
            );
        }
    }
    assert!(auth_seen, "authorization header missing");

    // Parse error.
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: b"not json".to_vec(),
    })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    check(&format!("{:?}", err), "ParseErr debug");
    check(&format!("{}", err), "ParseErr display");
}

// ---------------------------------------------------------------------
// 3b-29  —  shape
// ---------------------------------------------------------------------

#[test]
fn empty_to_subject_from_accepted() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: openai_success_body("ok", None),
    })]);
    let req = SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical_body(),
    };
    assert!(adapter.send(&req).is_ok());
}

// ---------------------------------------------------------------------
// 3b-30 .. 3b-32  —  registry
// ---------------------------------------------------------------------

#[test]
fn registry_returns_gemini_factory() {
    let reg = build_default_registry();
    assert!(reg.factory("gemini-ai").is_some());
    let _ = CATALOG_CODE; // silences unused-import in some build configs
}

#[test]
fn registry_returns_openai_factory() {
    let reg = build_default_registry();
    assert!(reg.factory("openai-compatible").is_some());
}

#[test]
fn registry_holds_factories_only() {
    // A registry is a map of factory functions. It cannot hold a
    // constructed adapter. This test proves the shape: an empty
    // registry has no factory; a populated registry's factory can
    // be called to produce an adapter on demand.
    let empty = ConnectorRegistry::new();
    assert!(empty.factory("gemini-ai").is_none());

    let reg = build_default_registry();
    assert!(reg.factory("gemini-ai").is_some());
    assert!(reg.factory("openai-compatible").is_some());
}