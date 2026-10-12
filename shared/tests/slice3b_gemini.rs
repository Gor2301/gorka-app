// shared/tests/slice3b_gemini.rs
//
// Slice 3b acceptance tests: Gemini adapter.
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.2, §5.5.1, §5.5.3,
//            §5.5.4, §5.6, §5.7, §5.8.
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
use gorka_shared::connectors::base_url::validate_static;
use gorka_shared::connectors::gemini_ai::{
    factory as gemini_production_factory, factory_with_provider as gemini_test_factory,
    CATALOG_CODE,
};
use gorka_shared::connectors::http::testing::MockHttpClient;
use gorka_shared::connectors::http::{HttpError, HttpErrorKind, HttpResponse};
use gorka_shared::connectors::transport::test_support::MockHttpClientProvider;
use gorka_shared::connectors::transport::HttpClientProvider;
use gorka_shared::connectors::{
    ConnectorAdapter, ConnectorCredential, ConnectorError, ConnectorErrorKind, SendRequest,
};

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

const FAKE_KEY: &str = "AIza_FAKE_KEY_FOR_TESTS_12345";
const FAKE_MODEL: &str = "gemini-2.5-flash";
const EXPECTED_HOST: &str = "generativelanguage.googleapis.com";

fn cred() -> ConnectorCredential {
    ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({ "model": FAKE_MODEL }),
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
        "model": "gemini-2.5-flash",
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

fn make_adapter(responses: Vec<Result<HttpResponse, HttpError>>)
    -> (Box<dyn ConnectorAdapter>, gorka_shared::connectors::http::testing::MockHandle)
{
    let (mock, handle) = MockHttpClient::new(responses);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    let adapter = gemini_test_factory(cred(), provider).expect("factory ok");
    (adapter, handle)
}

fn gemini_success_body(answer: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "candidates": [
            { "content": { "parts": [ { "text": answer } ] } }
        ]
    }))
    .unwrap()
}

fn send_request_empty_recipient() -> SendRequest {
    SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical_body(),
    }
}

fn url_path_segments(url: &str) -> Vec<String> {
    let u = reqwest::Url::parse(url).expect("parse url");
    u.path_segments()
        .unwrap()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

// ---------------------------------------------------------------------
// Gemini mapping — implements ProviderEnvelopeMapping (from 3a)
// ---------------------------------------------------------------------

struct GeminiMapping;

impl ProviderEnvelopeMapping for GeminiMapping {
    fn map_fields() -> Vec<FieldMapping> {
        vec![
            FieldMapping {
                canonical_field: "system_prompt",
                location: FieldLocation::Body(vec![
                    "systemInstruction",
                    "parts",
                    "0",
                    "text",
                ]),
            },
            FieldMapping {
                canonical_field: "user_message",
                location: FieldLocation::Body(vec![
                    "contents",
                    "0",
                    "parts",
                    "0",
                    "text",
                ]),
            },
            FieldMapping {
                canonical_field: "context_json",
                location: FieldLocation::Body(vec![
                    "contents",
                    "1",
                    "parts",
                    "0",
                    "text",
                ]),
            },
            FieldMapping {
                canonical_field: "model",
                location: FieldLocation::UrlPathSegment {
                    segment_name: "models",
                    following_segment: true,
                },
            },
            FieldMapping {
                canonical_field: "options_json.temperature",
                location: FieldLocation::Body(vec!["generationConfig", "temperature"]),
            },
            FieldMapping {
                canonical_field: "options_json.max_output_tokens",
                location: FieldLocation::Body(vec!["generationConfig", "maxOutputTokens"]),
            },
        ]
    }

    fn fixed_constants() -> Vec<FixedConstant> {
        vec![
            FixedConstant {
                location: vec!["contents", "0", "role"],
                value: json!("user"),
            },
            FixedConstant {
                location: vec!["contents", "1", "role"],
                value: json!("user"),
            },
        ]
    }

    fn extract_value<'a>(body: &'a Value, path: &[&str]) -> Option<&'a Value> {
        let mut cur = body;
        for seg in path {
            cur = if let Some(map) = cur.as_object() {
                map.get(*seg)?
            } else if let Some(arr) = cur.as_array() {
                let idx: usize = seg.parse().ok()?;
                arr.get(idx)?
            } else {
                return None;
            };
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
// 3b-1 .. 3b-3  —  constructor
// ---------------------------------------------------------------------

#[test]
fn constructor_rejects_missing_api_key() {
    let cred = ConnectorCredential {
        value: serde_json::to_vec(&json!({})).unwrap(),
        configuration: json!({ "model": FAKE_MODEL }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match gemini_test_factory(cred, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error"),
    }
}

#[test]
fn constructor_rejects_missing_model() {
    let cred = ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": FAKE_KEY })).unwrap(),
        configuration: json!({}),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    match gemini_test_factory(cred, provider) {
        Err(e) => assert_eq!(e.kind, ConnectorErrorKind::LocalConfigurationError),
        Ok(_) => panic!("expected constructor error"),
    }
}

#[test]
fn constructor_rejects_invalid_base_url() {
    // Gemini's base URL is a fixed constant; this is a defense-in-depth
    // check on validate_static itself.
    assert!(validate_static("http://example.com").is_err());
    assert!(validate_static("https://127.0.0.1").is_err());
    assert!(validate_static("https://user:pw@example.com").is_err());
    assert!(validate_static("https://example.com?x=1").is_err());
    assert!(validate_static("https://example.com#frag").is_err());
    assert!(validate_static("https://generativelanguage.googleapis.com").is_ok());
}

// ---------------------------------------------------------------------
// 3b-4 .. 3b-6  —  envelope and response shape
// ---------------------------------------------------------------------

#[test]
fn send_formats_correct_envelope() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let req = send_request_empty_recipient();
    adapter.send(&req).expect("send ok");

    let received = handle.received();
    assert_eq!(received.len(), 1);
    let r = &received[0];
    assert_eq!(r.method, gorka_shared::connectors::http::HttpMethod::Post);
    assert!(r.url.starts_with(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    ));

    let body: Value = serde_json::from_slice(&r.body).unwrap();
    assert_eq!(body["contents"][0]["role"], "user");
    assert_eq!(body["contents"][1]["role"], "user");
    assert!(body["systemInstruction"]["parts"][0]["text"].is_string());
    assert!(body["contents"][0]["parts"][0]["text"].is_string());
    assert!(body["contents"][1]["parts"][0]["text"].is_string());
    assert!(body["generationConfig"]["temperature"].is_number());
    assert!(body["generationConfig"]["maxOutputTokens"].is_number());
}

#[test]
fn api_key_in_header_not_url() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let req = send_request_empty_recipient();
    adapter.send(&req).unwrap();

    let received = handle.received();
    let r = &received[0];
    assert!(!r.url.contains(FAKE_KEY), "api key must not be in URL");
    let mut found = false;
    for (k, v) in &r.headers {
        if k.eq_ignore_ascii_case("x-goog-api-key") {
            assert_eq!(v, FAKE_KEY);
            found = true;
        }
        assert!(!k.contains(FAKE_KEY));
        if k.eq_ignore_ascii_case("x-goog-api-key") {
            // ok
        } else {
            assert!(
                !v.contains(FAKE_KEY),
                "api key must only appear in x-goog-api-key header; found in {}",
                k
            );
        }
    }
    assert!(found, "x-goog-api-key header missing");
}

#[test]
fn parses_success_into_answer_only() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("hello from gemini"),
    })]);
    let req = send_request_empty_recipient();
    let result = adapter.send(&req).expect("send ok");

    assert!(result.success);
    assert_eq!(result.provider_status.as_deref(), Some("completed"));
    assert!(result.provider_message_id.is_none());

    let pr = result.provider_response.expect("provider_response");
    let obj = pr.as_object().unwrap();
    assert_eq!(obj.len(), 1);
    assert_eq!(obj.get("answer").and_then(|v| v.as_str()), Some("hello from gemini"));
}

// ---------------------------------------------------------------------
// 3b-7 .. 3b-10  —  error mapping
// ---------------------------------------------------------------------

#[test]
fn maps_401_to_authentication_failed() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse { status: 401, body: vec![] })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::AuthenticationFailed);
}

#[test]
fn maps_429_to_rate_limited() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse { status: 429, body: vec![] })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::RateLimited);
}

#[test]
fn maps_500_to_provider_transient_error() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse { status: 500, body: vec![] })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::ProviderTransientError);
}

#[test]
fn maps_transport_error() {
    let (adapter, _h) = make_adapter(vec![Err(HttpError {
        kind: HttpErrorKind::Transport,
        message: "boom".into(),
    })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

// ---------------------------------------------------------------------
// 3b-11 .. 3b-13  —  semantic identity
// ---------------------------------------------------------------------

#[test]
fn semantic_identity_positive() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let canonical = parse_and_validate(&valid_raw_json()).unwrap();
    adapter.send(&send_request_empty_recipient()).unwrap();

    let received = handle.received();
    let r = &received[0];
    let body: Value = serde_json::from_slice(&r.body).unwrap();
    let owned = url_path_segments(&r.url);
    let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();

    verify_semantic_identity::<GeminiMapping>(&body, &refs, &canonical)
        .expect("positive semantic identity must pass");
}

#[test]
fn semantic_identity_injection_caught() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let canonical = parse_and_validate(&valid_raw_json()).unwrap();
    adapter.send(&send_request_empty_recipient()).unwrap();

    let received = handle.received();
    let r = &received[0];
    let mut body: Value = serde_json::from_slice(&r.body).unwrap();
    body["injected_field"] = json!("surprise");
    let owned = url_path_segments(&r.url);
    let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();

    let err = verify_semantic_identity::<GeminiMapping>(&body, &refs, &canonical)
        .expect_err("injected leaf must be caught");
    assert!(err.contains("injected_field"), "got: {}", err);
}

#[test]
fn semantic_identity_misplaced_value_caught() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let canonical = parse_and_validate(&valid_raw_json()).unwrap();
    adapter.send(&send_request_empty_recipient()).unwrap();

    let received = handle.received();
    let r = &received[0];
    let mut body: Value = serde_json::from_slice(&r.body).unwrap();
    // Move system_prompt content out of its designated path.
    let text = body["systemInstruction"]["parts"][0]["text"].clone();
    body["systemInstruction"]["parts"][0]["text"] = json!("replaced");
    body["stray"] = text;
    let owned = url_path_segments(&r.url);
    let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();

    verify_semantic_identity::<GeminiMapping>(&body, &refs, &canonical)
        .expect_err("misplaced value must be caught");
}

// ---------------------------------------------------------------------
// 3b-14  —  credential-leak regression
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
        body: gemini_success_body("ok"),
    })]);
    let result = adapter.send(&send_request_empty_recipient()).unwrap();
    check(&format!("{:?}", result), "SendResult debug");
    check(
        &serde_json::to_string(&result.provider_response).unwrap(),
        "provider_response JSON",
    );

    // AuthenticationFailed error.
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse { status: 401, body: vec![] })]);
    let err = adapter.send(&send_request_empty_recipient()).unwrap_err();
    check(&format!("{:?}", err), "AuthFailed debug");
    check(&format!("{}", err), "AuthFailed display");

    // LocalConfigurationError from constructor.
    let bad_cred = ConnectorCredential {
        value: serde_json::to_vec(&json!({})).unwrap(),
        configuration: json!({ "model": FAKE_MODEL }),
    };
    let (mock, _h) = MockHttpClient::new(vec![]);
    let provider = Box::new(MockHttpClientProvider::new(Arc::new(mock)));
    let err = gemini_test_factory(bad_cred, provider).err().unwrap();
    check(&format!("{:?}", err), "ConfigErr debug");
    check(&format!("{}", err), "ConfigErr display");

    // TransportError from provider build. A deterministic failing
    // resolver forces the production provider path without any socket.
    {
        use gorka_shared::connectors::base_url::{validate_static, DnsResolver};
        use gorka_shared::connectors::transport::PinnedReqwestProvider;
        struct FailResolver;
        impl DnsResolver for FailResolver {
            fn resolve(&self, _host: &str) -> Result<Vec<std::net::IpAddr>, ConnectorError> {
                Err(ConnectorError {
                    kind: ConnectorErrorKind::TransportError,
                    message: "injected resolver failure".into(),
                    provider_response: None,
                })
            }
        }
        let base = validate_static("https://example.com").unwrap();
        let provider = PinnedReqwestProvider { resolver: Box::new(FailResolver) };
        let err = provider.build(&base).err().unwrap();
        check(&format!("{:?}", err), "TransportErr debug");
        check(&format!("{}", err), "TransportErr display");
    }

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
// 3b-15 .. 3b-16
// ---------------------------------------------------------------------

#[test]
fn empty_to_subject_from_accepted() {
    let (adapter, _h) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    let req = SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical_body(),
    };
    assert!(adapter.send(&req).is_ok());
}

#[test]
fn model_in_url_path_correct() {
    let (adapter, handle) = make_adapter(vec![Ok(HttpResponse {
        status: 200,
        body: gemini_success_body("ok"),
    })]);
    adapter.send(&send_request_empty_recipient()).unwrap();

    let received = handle.received();
    let url = &received[0].url;
    let segments = url_path_segments(url);
    let idx = segments.iter().position(|s| s == "models")
        .expect("'models' segment present");
    let next = segments.get(idx + 1).expect("segment after models");
    let model = next.split(':').next().unwrap();
    assert_eq!(model, FAKE_MODEL);
    assert!(next.ends_with(":generateContent"));
}

// ---------------------------------------------------------------------
// 3b-17 .. 3b-18  —  production refusal
// ---------------------------------------------------------------------

