// shared/tests/slice4_strategy.rs
//
// Slice 4 acceptance tests: the Strategy Engine.
// Authority: SLICE 4 — MINI SPEC v1.0 (FROZEN), §6, §9.
//
// Unreachable under current interfaces (per §9 reachability note):
//
//   - "Context build failure → Ok(Fallback)": build_fallback_input and
//     build_context share load_facts in context.rs, so if one succeeds
//     the other cannot independently fail. Reaching that branch would
//     require an injectable failure point in context.rs; Slice 4 does
//     not add one (context.rs is in the Not-touched list, §3).
//
//   - "Boundary rejection via analyze → Ok(Fallback)": analyze builds
//     the RawOutboundAiRequest internally from fixed prompt constants
//     and a serializable Context. No caller-supplied input can trigger
//     a BoundaryBlock through the analyze signature. Boundary rejection
//     is covered by slice3a_boundary.rs against parse_and_validate.
//
//   - "Fallback path: zero adapter.send calls": the earliest reachable
//     AI-path failure is the adapter itself. Any fallback caused by an
//     AI-side failure occurs after send() is called at least once.
//     The one-call expectation on the AI path is covered by
//     strategy_ai_path_calls_adapter_exactly_once.

use std::cell::RefCell;

use chrono::{DateTime, Utc};
use gorka_shared::connectors::{
    ConnectorAdapter, ConnectorError, ConnectorErrorKind, SendRequest, SendResult,
};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::prompts::PROMPT_VERSION;
use gorka_shared::recommendation::{Channel, Priority, Timing, Tone};
use gorka_shared::strategy::{
    analyze, StrategyError, StrategySource, MAX_BODY_LEN, MAX_RESPONSE_BYTES,
};
use rusqlite::params;
use serde_json::json;

const ORG_ID: &str = "org-s4";
const DEBTOR_ID: &str = "debtor-s4-1";
const MODEL: &str = "test-model-xyz";

fn ref_time() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-13T00:00:00Z")
        .expect("parse ref time")
        .with_timezone(&Utc)
}

fn seed_debtor(conn: &rusqlite::Connection) {
    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone,
                              data, created_at, updated_at)
         VALUES (?1, ?2, 'ZZZTest', 'ZZZSur', 'z@example.invalid',
                 '+10000000000', '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR_ID, ORG_ID],
    )
    .expect("seed debtor");
}

#[derive(Clone)]
enum MockBehavior {
    Error(ConnectorErrorKind),
    RawAnswer(String),
    NoAnswerField,
    NoProviderResponse,
    NonStringAnswer,
}

struct MockConnectorAdapter {
    behavior: MockBehavior,
    calls: RefCell<Vec<SendRequest>>,
}

impl MockConnectorAdapter {
    fn new(behavior: MockBehavior) -> Self {
        Self {
            behavior,
            calls: RefCell::new(Vec::new()),
        }
    }
    fn call_count(&self) -> usize {
        self.calls.borrow().len()
    }
    fn last_body(&self) -> Option<String> {
        self.calls.borrow().last().map(|r| r.body.clone())
    }
}

impl ConnectorAdapter for MockConnectorAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        self.calls.borrow_mut().push(SendRequest {
            to: request.to.clone(),
            body: request.body.clone(),
            subject: request.subject.clone(),
            from: request.from.clone(),
        });
        match &self.behavior {
            MockBehavior::Error(kind) => Err(ConnectorError {
                kind: *kind,
                message: "mock error".to_string(),
                provider_response: None,
            }),
            MockBehavior::RawAnswer(s) => Ok(SendResult {
                success: true,
                provider_message_id: None,
                provider_status: None,
                provider_response: Some(json!({ "answer": s })),
            }),
            MockBehavior::NoAnswerField => Ok(SendResult {
                success: true,
                provider_message_id: None,
                provider_status: None,
                provider_response: Some(json!({ "other": "value" })),
            }),
            MockBehavior::NoProviderResponse => Ok(SendResult {
                success: true,
                provider_message_id: None,
                provider_status: None,
                provider_response: None,
            }),
            MockBehavior::NonStringAnswer => Ok(SendResult {
                success: true,
                provider_message_id: None,
                provider_status: None,
                provider_response: Some(json!({ "answer": 42 })),
            }),
        }
    }
    fn test_connection(&self) -> Result<(), ConnectorError> {
        Ok(())
    }
    fn code(&self) -> &'static str {
        "mock"
    }
}

fn valid_response_json() -> String {
    json!({
        "recommendation": {
            "channel": "EMAIL",
            "priority": "HIGH",
            "tone": "URGENT",
            "timing": "WITHIN_3_DAYS",
            "rationale": "reason for recommendation"
        },
        "draft": {
            "subject": "Payment reminder",
            "body": "Please arrange payment."
        },
        "riskFlags": ["flag-one"]
    })
    .to_string()
}

fn oversized_body_response() -> String {
    let body = "b".repeat(MAX_BODY_LEN + 1);
    json!({
        "recommendation": {
            "channel": "EMAIL",
            "priority": "NORMAL",
            "tone": "FRIENDLY",
            "timing": "WITHIN_3_DAYS",
            "rationale": "r"
        },
        "draft": { "subject": "S", "body": body },
        "riskFlags": []
    })
    .to_string()
}

fn unknown_enum_response() -> String {
    json!({
        "recommendation": {
            "channel": "EMAIL",
            "priority": "SUPER_HIGH",
            "tone": "URGENT",
            "timing": "WITHIN_3_DAYS",
            "rationale": "r"
        },
        "draft": { "subject": "S", "body": "B" },
        "riskFlags": []
    })
    .to_string()
}

fn extra_field_response() -> String {
    json!({
        "recommendation": {
            "channel": "EMAIL",
            "priority": "HIGH",
            "tone": "URGENT",
            "timing": "WITHIN_3_DAYS",
            "rationale": "r"
        },
        "draft": { "subject": "S", "body": "B" },
        "riskFlags": [],
        "extra_field": "not allowed"
    })
    .to_string()
}

fn missing_recommendation_response() -> String {
    json!({
        "draft": { "subject": "S", "body": "B" },
        "riskFlags": []
    })
    .to_string()
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

#[test]
fn strategy_fallback_input_failure_returns_err() {
    let conn = open_in_memory_for_tests().expect("db");
    // Deliberately do NOT seed the debtor.
    let mock = MockConnectorAdapter::new(MockBehavior::Error(ConnectorErrorKind::TransportError));
    let err = analyze(
        &conn,
        ORG_ID,
        "debtor-does-not-exist",
        ref_time(),
        MODEL,
        &mock,
    )
    .unwrap_err();
    assert!(matches!(err, StrategyError::ContextInvalid(_)));
    assert_eq!(mock.call_count(), 0);
}

#[test]
fn strategy_adapter_transport_error_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::Error(ConnectorErrorKind::TransportError));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_adapter_auth_failed_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock =
        MockConnectorAdapter::new(MockBehavior::Error(ConnectorErrorKind::AuthenticationFailed));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_non_json_answer_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer("not json".to_string()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_empty_or_whitespace_answer_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    for bad in ["", "   ", "\n\t"] {
        let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(bad.to_string()));
        let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
        assert_eq!(
            outcome.source,
            StrategySource::Fallback,
            "expected fallback for answer {:?}",
            bad
        );
    }
}

#[test]
fn strategy_missing_recommendation_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(missing_recommendation_response()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_unknown_enum_string_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(unknown_enum_response()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_extra_field_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(extra_field_response()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_answer_exceeds_max_bytes_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let huge = "x".repeat(MAX_RESPONSE_BYTES + 10);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(huge));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_body_exceeds_max_len_returns_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(oversized_body_response()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
}

#[test]
fn strategy_valid_response_returns_ai() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(valid_response_json()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();

    assert_eq!(outcome.source, StrategySource::Ai);
    assert_eq!(outcome.recommendation.channel, Channel::Email);
    assert_eq!(outcome.recommendation.priority, Priority::High);
    assert_eq!(outcome.recommendation.tone, Tone::Urgent);
    assert_eq!(outcome.recommendation.timing, Timing::Within3Days);
    assert_eq!(outcome.draft_subject.as_deref(), Some("Payment reminder"));
    assert_eq!(outcome.draft_body, "Please arrange payment.");
    assert_eq!(outcome.risk_flags, vec!["flag-one".to_string()]);
}

#[test]
fn strategy_ai_path_calls_adapter_exactly_once() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(valid_response_json()));
    let _ = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(mock.call_count(), 1);
}

#[test]
fn strategy_prompt_version_matches_on_ai_and_fallback() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);

    let ai_mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(valid_response_json()));
    let ai_outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &ai_mock).unwrap();
    assert_eq!(ai_outcome.prompt_version, PROMPT_VERSION);

    let fb_mock = MockConnectorAdapter::new(MockBehavior::Error(ConnectorErrorKind::TransportError));
    let fb_outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &fb_mock).unwrap();
    assert_eq!(fb_outcome.prompt_version, PROMPT_VERSION);
}

#[test]
fn strategy_rationale_prefixed_on_ai_outcome() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(valid_response_json()));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();

    let r = outcome.rationale.as_ref().expect("rationale present");
    assert!(
        r.starts_with("AI explanation \u{2014} unverified: "),
        "rationale missing prefix: {:?}",
        r
    );
}

#[test]
fn strategy_rationale_none_on_fallback_outcome() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::Error(ConnectorErrorKind::TransportError));
    let outcome = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();
    assert_eq!(outcome.source, StrategySource::Fallback);
    assert!(outcome.rationale.is_none());
    assert!(outcome.risk_flags.is_empty());
    assert!(outcome.draft_subject.is_none());
    assert_eq!(outcome.draft_body, "");
}

#[test]
fn strategy_model_argument_used_in_request_body() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let mock = MockConnectorAdapter::new(MockBehavior::RawAnswer(valid_response_json()));
    let _ = analyze(&conn, ORG_ID, DEBTOR_ID, ref_time(), MODEL, &mock).unwrap();

    let body = mock.last_body().expect("captured send request");
    assert!(
        body.contains(MODEL),
        "model argument {:?} not found in request body",
        MODEL
    );
}