// shared/tests/slice3a_boundary.rs
//
// Slice 3a acceptance tests: AI boundary layer.
// Authority: SLICE 3a — SELF-CONTAINED SECTION 4, tests 3a-1 .. 3a-22,
//            plus §4.4.1 (JCS reference-vector requirement).
//
// Pure Rust. No database. No HTTP. No credentials.
// All tests go through the public parse_and_validate entry point.
// validate_typed is not called from this file.

use serde_json::{json, Value};

use gorka_shared::connectors::ai_boundary::{
    parse_and_validate, BoundaryBlock, CanonicalAiRequest,
};
use gorka_shared::connectors::ai_mapping::{
    verify_semantic_identity, FieldLocation, FieldMapping, FixedConstant,
    ProviderEnvelopeMapping,
};
use gorka_shared::connectors::SendRequest;

// JCS crate used by the boundary. If the crate is switched during
// §4.4.1 verification, this single import changes.
use serde_jcs::to_string as jcs_to_string;

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

fn valid_raw_value() -> Value {
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
}

fn valid_raw() -> String {
    valid_raw_value().to_string()
}

fn set_top(v: &mut Value, key: &str, val: Value) {
    v.as_object_mut().unwrap().insert(key.into(), val);
}

fn set_options(v: &mut Value, key: &str, val: Value) {
    v.get_mut("request_options")
        .unwrap()
        .as_object_mut()
        .unwrap()
        .insert(key.into(), val);
}

fn set_context(v: &mut Value, key: &str, val: Value) {
    v.get_mut("context")
        .unwrap()
        .as_object_mut()
        .unwrap()
        .insert(key.into(), val);
}

fn set_debtor(v: &mut Value, key: &str, val: Value) {
    v.get_mut("context")
        .unwrap()
        .get_mut("debtor")
        .unwrap()
        .as_object_mut()
        .unwrap()
        .insert(key.into(), val);
}

// ---------------------------------------------------------------------
// 3a-1 .. 3a-7  —  parse shape
// ---------------------------------------------------------------------

#[test]
fn valid_minimal_request_validates() {
    let out = parse_and_validate(&valid_raw()).expect("valid request must validate");
    assert_eq!(out.system_prompt, "You are a helpful assistant.");
    assert_eq!(out.user_message, "Suggest the next best action.");
    assert_eq!(out.model, "gemini-2.5-flash");
    assert!(!out.context_json.is_empty());
    assert!(!out.options_json.is_empty());
}

#[test]
fn unknown_top_level_field_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "top_k", json!(5));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::UnknownField { path }) => {
            assert_eq!(path, "top_k");
        }
        other => panic!("expected UnknownField{{top_k}}, got {:?}", other),
    }
}

#[test]
fn unknown_request_option_key_blocks() {
    let mut v = valid_raw_value();
    set_options(&mut v, "top_k", json!(5));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::DisallowedOption { name }) => {
            assert_eq!(name, "top_k");
        }
        other => panic!("expected DisallowedOption{{top_k}}, got {:?}", other),
    }
}

#[test]
fn wrong_type_on_system_prompt_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "system_prompt", json!(123));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::TypeMismatch { path, .. }) => {
            assert_eq!(path, "system_prompt");
        }
        other => panic!("expected TypeMismatch{{system_prompt}}, got {:?}", other),
    }
}

#[test]
fn wrong_type_on_model_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "model", json!(["gemini-2.5-flash"]));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::TypeMismatch { path, .. }) => {
            assert_eq!(path, "model");
        }
        other => panic!("expected TypeMismatch{{model}}, got {:?}", other),
    }
}

#[test]
fn context_with_unknown_field_blocks() {
    let mut v = valid_raw_value();
    set_context(&mut v, "extraKey", json!("anything"));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::UnknownField { path }) => {
            assert_eq!(path, "context.extraKey");
        }
        other => panic!("expected UnknownField{{context.extraKey}}, got {:?}", other),
    }
}

#[test]
fn context_with_wrong_type_on_nested_field_blocks() {
    let mut v = valid_raw_value();
    set_debtor(&mut v, "amountRange", json!(42));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::TypeMismatch { path, .. }) => {
            assert_eq!(path, "context.debtor.amountRange");
        }
        other => panic!(
            "expected TypeMismatch{{context.debtor.amountRange}}, got {:?}",
            other
        ),
    }
}

// ---------------------------------------------------------------------
// 3a-8 .. 3a-11  —  identifier scans
// ---------------------------------------------------------------------

#[test]
fn email_shaped_string_in_user_message_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "user_message", json!("Contact john@example.com about it."));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::IdentifierDetected { category, field }) => {
            assert_eq!(category, "email");
            assert_eq!(field, "user_message");
        }
        other => panic!("expected IdentifierDetected{{email, user_message}}, got {:?}", other),
    }
}

#[test]
fn phone_shaped_string_in_system_prompt_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "system_prompt", json!("Reach the debtor at +1 555 123 4567."));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::IdentifierDetected { category, field }) => {
            assert_eq!(category, "phone");
            assert_eq!(field, "system_prompt");
        }
        other => panic!("expected IdentifierDetected{{phone, system_prompt}}, got {:?}", other),
    }
}

#[test]
fn currency_amount_string_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "user_message", json!("The balance is $4,500 today."));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::IdentifierDetected { category, .. }) => {
            assert_eq!(category, "currency");
        }
        other => panic!("expected IdentifierDetected{{currency, ..}}, got {:?}", other),
    }
}

#[test]
fn invoice_shaped_token_blocks() {
    let mut v = valid_raw_value();
    set_top(&mut v, "user_message", json!("Reference INV-2026-0042 for this account."));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::IdentifierDetected { category, .. }) => {
            assert_eq!(category, "invoice");
        }
        other => panic!("expected IdentifierDetected{{invoice, ..}}, got {:?}", other),
    }
}

// ---------------------------------------------------------------------
// 3a-12 .. 3a-13  —  range checks
// ---------------------------------------------------------------------

#[test]
fn temperature_out_of_range_blocks() {
    let mut v = valid_raw_value();
    set_options(&mut v, "temperature", json!(3.0));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::TypeMismatch { path, .. }) => {
            assert_eq!(path, "request_options.temperature");
        }
        other => panic!("expected TypeMismatch on temperature=3.0, got {:?}", other),
    }

    let mut v = valid_raw_value();
    set_options(&mut v, "temperature", json!(-0.1));
    match parse_and_validate(&v.to_string()) {
        Err(BoundaryBlock::TypeMismatch { path, .. }) => {
            assert_eq!(path, "request_options.temperature");
        }
        other => panic!("expected TypeMismatch on temperature=-0.1, got {:?}", other),
    }
}

#[test]
fn temperature_in_range_accepted() {
    for t in [0.0_f64, 1.0, 2.0] {
        let mut v = valid_raw_value();
        set_options(&mut v, "temperature", json!(t));
        assert!(
            parse_and_validate(&v.to_string()).is_ok(),
            "temperature {} must be accepted",
            t
        );
    }
}

// ---------------------------------------------------------------------
// 3a-14 .. 3a-17  —  JCS canonicalization
// ---------------------------------------------------------------------

#[test]
fn canonical_json_keys_ordered_and_numbers_canonical() {
    // --- §4.4.1: at least three RFC 8785 reference vectors, direct to the crate.

    // Vector 1 — key sort + float 1.0 -> 1.
    assert_eq!(
        jcs_to_string(&json!({"b": 1.0, "a": 2.5})).unwrap(),
        "{\"a\":2.5,\"b\":1}"
    );

    // Vector 2 — integer stays integer, distinct from float.
    assert_eq!(
        jcs_to_string(&json!({"x": 1024, "y": 0.5})).unwrap(),
        "{\"x\":1024,\"y\":0.5}"
    );

    // Vector 3 — RFC 8785 short escape for U+0008.
    assert_eq!(
        jcs_to_string(&json!({"s": "\u{0008}"})).unwrap(),
        "{\"s\":\"\\b\"}"
    );

    // --- Boundary path: float canonicalization via temperature.

    let mut v = valid_raw_value();
    set_options(&mut v, "temperature", json!(1.0));
    let out = parse_and_validate(&v.to_string()).unwrap();
    assert!(
        out.options_json.contains("\"temperature\":1"),
        "expected 1.0 -> 1 in options_json, got: {}",
        out.options_json
    );
    assert!(
        !out.options_json.contains("\"temperature\":1.0"),
        "1.0 must not appear as 1.0 in options_json, got: {}",
        out.options_json
    );

    let mut v = valid_raw_value();
    set_options(&mut v, "temperature", json!(0.5));
    let out = parse_and_validate(&v.to_string()).unwrap();
    assert!(
        out.options_json.contains("\"temperature\":0.5"),
        "expected 0.5 in options_json, got: {}",
        out.options_json
    );

    let mut v = valid_raw_value();
    set_options(&mut v, "temperature", json!(0.1));
    let out = parse_and_validate(&v.to_string()).unwrap();
    assert!(
        out.options_json.contains("\"temperature\":0.1"),
        "expected 0.1 in options_json, got: {}",
        out.options_json
    );

    // --- Integer in options_json stays an integer.

    let out = parse_and_validate(&valid_raw()).unwrap();
    assert!(
        out.options_json.contains("\"max_output_tokens\":1024"),
        "expected integer 1024 in options_json, got: {}",
        out.options_json
    );
    assert!(
        !out.options_json.contains("\"max_output_tokens\":1024.0"),
        "max_output_tokens must not serialize as 1024.0, got: {}",
        out.options_json
    );

    // --- context_json keys sorted lexicographically at the top level.
    // Order: communicationHistory < debtor < debts < indicators.
    let out = parse_and_validate(&valid_raw()).unwrap();
    let pos_comm = out.context_json.find("\"communicationHistory\"").unwrap();
    let pos_debtor = out.context_json.find("\"debtor\"").unwrap();
    let pos_debts = out.context_json.find("\"debts\"").unwrap();
    let pos_ind = out.context_json.find("\"indicators\"").unwrap();
    assert!(pos_comm < pos_debtor, "communicationHistory must precede debtor");
    assert!(pos_debtor < pos_debts, "debtor must precede debts");
    assert!(pos_debts < pos_ind, "debts must precede indicators");

    // --- to_json: outer keys sorted lexicographically at every level.
    // Order: context_json < model < options_json < system_prompt < user_message.
    let blob = out.to_json();
    let p_ctx = blob.find("\"context_json\"").unwrap();
    let p_mod = blob.find("\"model\"").unwrap();
    let p_opt = blob.find("\"options_json\"").unwrap();
    let p_sys = blob.find("\"system_prompt\"").unwrap();
    let p_usr = blob.find("\"user_message\"").unwrap();
    assert!(p_ctx < p_mod, "context_json must precede model");
    assert!(p_mod < p_opt, "model must precede options_json");
    assert!(p_opt < p_sys, "options_json must precede system_prompt");
    assert!(p_sys < p_usr, "system_prompt must precede user_message");

    // --- No whitespace between tokens.
    assert!(!out.context_json.contains(": "));
    assert!(!out.options_json.contains(": "));
    assert!(!blob.contains(": "));
}

#[test]
fn to_json_deterministic() {
    let out = parse_and_validate(&valid_raw()).unwrap();
    let a = out.to_json();
    let b = out.to_json();
    assert_eq!(a, b);
}

#[test]
fn from_json_to_json_round_trips() {
    let out = parse_and_validate(&valid_raw()).unwrap();
    let s = out.to_json();
    let parsed = CanonicalAiRequest::from_json(&s).expect("round-trip parse");
    assert_eq!(parsed, out);
    assert_eq!(parsed.to_json(), s);
}

#[test]
fn from_json_accepts_non_canonical_and_normalizes() {
    let out = parse_and_validate(&valid_raw()).unwrap();

    // Build a non-canonical form: outer keys in a non-sorted order.
    // All five CanonicalAiRequest fields are strings.
    let non_canonical = json!({
        "model": out.model,
        "system_prompt": out.system_prompt,
        "user_message": out.user_message,
        "options_json": out.options_json,
        "context_json": out.context_json,
    })
    .to_string();

    let parsed = CanonicalAiRequest::from_json(&non_canonical)
        .expect("non-canonical JSON must parse");
    assert_eq!(parsed, out);
    assert_eq!(parsed.to_json(), out.to_json());
}

// ---------------------------------------------------------------------
// 3a-18  —  shape test
// ---------------------------------------------------------------------

#[test]
fn empty_to_subject_from_not_rejected() {
    let req = SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: String::new(),
    };
    assert!(req.to.is_empty());
    assert!(req.subject.is_none());
    assert!(req.from.is_empty());
    assert!(req.body.is_empty());
}

// ---------------------------------------------------------------------
// 3a-19  —  no credential-shaped substring in canonical output
// ---------------------------------------------------------------------

#[test]
fn canonical_bytes_contain_no_credential_pattern() {
    let out = parse_and_validate(&valid_raw()).unwrap();
    let blob = out.to_json();
    for forbidden in ["apiKey", "sk-", "re_", "Authorization", "Bearer"] {
        assert!(
            !blob.contains(forbidden),
            "canonical bytes must not contain {:?}; blob = {}",
            forbidden,
            blob
        );
    }
}

// ---------------------------------------------------------------------
// 3a-20 .. 3a-22  —  mapping walker
// ---------------------------------------------------------------------

struct SyntheticMapping;

impl ProviderEnvelopeMapping for SyntheticMapping {
    fn map_fields() -> Vec<FieldMapping> {
        vec![
            FieldMapping {
                canonical_field: "system_prompt",
                location: FieldLocation::Body(vec!["system_prompt"]),
            },
            FieldMapping {
                canonical_field: "user_message",
                location: FieldLocation::Body(vec!["user_message"]),
            },
            FieldMapping {
                canonical_field: "context_json",
                location: FieldLocation::Body(vec!["context_json"]),
            },
            FieldMapping {
                canonical_field: "model",
                location: FieldLocation::Body(vec!["model"]),
            },
            FieldMapping {
                canonical_field: "options_json.temperature",
                location: FieldLocation::Body(vec!["options", "temperature"]),
            },
        ]
    }

    fn fixed_constants() -> Vec<FixedConstant> {
        Vec::new()
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

fn synthetic_body_from(canonical: &CanonicalAiRequest) -> Value {
    let opts: Value =
        serde_json::from_str(&canonical.options_json).expect("options_json parses");
    let temp = opts.get("temperature").cloned();

    let mut options = serde_json::Map::new();
    if let Some(t) = temp {
        options.insert("temperature".into(), t);
    }

    json!({
        "system_prompt": canonical.system_prompt,
        "user_message": canonical.user_message,
        "context_json": canonical.context_json,
        "model": canonical.model,
        "options": Value::Object(options),
    })
}

#[test]
fn mapping_walker_positive_on_synthetic_adapter() {
    let canonical = parse_and_validate(&valid_raw()).unwrap();
    let body = synthetic_body_from(&canonical);
    let url_path: Vec<&str> = Vec::new();
    verify_semantic_identity::<SyntheticMapping>(&body, &url_path, &canonical)
        .expect("positive mapping must pass");
}

#[test]
fn mapping_walker_rejects_injected_extra_leaf() {
    let canonical = parse_and_validate(&valid_raw()).unwrap();
    let mut body = synthetic_body_from(&canonical);
    body.as_object_mut()
        .unwrap()
        .insert("injected".into(), json!("surprise"));
    let url_path: Vec<&str> = Vec::new();
    let err = verify_semantic_identity::<SyntheticMapping>(&body, &url_path, &canonical)
        .expect_err("injected leaf must be rejected");
    assert!(
        err.contains("injected"),
        "error should name the extra leaf, got: {}",
        err
    );
}

#[test]
fn mapping_walker_rejects_misplaced_value() {
    let canonical = parse_and_validate(&valid_raw()).unwrap();
    let mut body = synthetic_body_from(&canonical);
    let moved = body
        .as_object_mut()
        .unwrap()
        .remove("user_message")
        .unwrap();
    body.as_object_mut()
        .unwrap()
        .insert("user_message_relocated".into(), moved);
    let url_path: Vec<&str> = Vec::new();
    verify_semantic_identity::<SyntheticMapping>(&body, &url_path, &canonical)
        .expect_err("misplaced value must be rejected");
}