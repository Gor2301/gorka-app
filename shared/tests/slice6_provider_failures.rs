// shared/tests/slice6_provider_failures.rs
//
// Slice 6 acceptance: provider outcomes through the full
// orchestration. Every outcome is exercised via
// execute_send_with_adapter with a deterministic fake adapter.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 4.1-4.5, Section 24.
//
// Rows covered:
//   4.1 Err -> finalize_uncertain chain
//   4.2 Ok(false) -> finalize_failure chain
//   4.3 Ok(true) -> finalize_success chain
//   4.4 No auto-retry after uncertain
//   4.5 Second attempt blocked while state is unresolved

use std::cell::RefCell;

use chrono::{DateTime, Utc};
use gorka_shared::connectors::{
    ConnectorAdapter, ConnectorError, ConnectorErrorKind, SendRequest, SendResult,
};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::recommendation::{
    Channel as RecChannel, Priority, Recommendation, Timing, Tone,
};
use gorka_shared::recommendation_store::{insert_pending, mark_accepted};
use gorka_shared::send_orchestration::{
    execute_send_with_adapter, SendRecommendationInput,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG: &str = "org-6e";
const DEBTOR: &str = "debtor-6e-1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6e";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

// -----------------------------------------------------------------
// Mock adapter
// -----------------------------------------------------------------

#[derive(Clone, Copy)]
enum MockOutcome {
    Success,
    Failure,
    Error,
}

struct MockDeliveryAdapter {
    outcome: MockOutcome,
    calls: RefCell<Vec<SendRequest>>,
}

impl MockDeliveryAdapter {
    fn new(outcome: MockOutcome) -> Self {
        Self {
            outcome,
            calls: RefCell::new(Vec::new()),
        }
    }
    fn call_count(&self) -> usize {
        self.calls.borrow().len()
    }
}

impl ConnectorAdapter for MockDeliveryAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        self.calls.borrow_mut().push(SendRequest {
            to: request.to.clone(),
            body: request.body.clone(),
            subject: request.subject.clone(),
            from: request.from.clone(),
        });
        match self.outcome {
            MockOutcome::Success => Ok(SendResult {
                success: true,
                provider_message_id: Some("mock-msg".to_string()),
                provider_status: None,
                provider_response: None,
            }),
            MockOutcome::Failure => Ok(SendResult {
                success: false,
                provider_message_id: None,
                provider_status: None,
                provider_response: None,
            }),
            MockOutcome::Error => Err(ConnectorError {
                kind: ConnectorErrorKind::ProviderTransientError,
                message: "mock transport error".to_string(),
                provider_response: None,
            }),
        }
    }
    fn test_connection(&self) -> Result<(), ConnectorError> {
        Ok(())
    }
    fn code(&self) -> &'static str {
        "mock-delivery"
    }
}

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

fn seed_debtor(conn: &Connection) {
    conn.execute(
        "INSERT OR IGNORE INTO debtors (id, organization_id, name, surname, email, phone,
                              data, deleted, created_at, updated_at)
         VALUES (?1, ?2, 'Test', 'Sur', 'z@example.invalid', '+10000000000',
                 '{}', 'false', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR, ORG],
    )
    .expect("seed debtor");
}

fn seed_local_connector(conn: &Connection) {
    conn.execute(
        "INSERT OR IGNORE INTO local_connectors
            (id, connector_code, organization_id, tier, status,
             credential_value, configuration, source_device_id,
             created_at, updated_at, winning_logical_clock, winning_device_id, winning_sequence)
         VALUES (?1, ?2, ?3, 'TIER1', 'ENABLED',
                 X'7B226170694B6579223A2278227D', '{\"from\":\"a@b.invalid\"}',
                 'local', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 100, X'01', 1)",
        params!["lc-6e-1", CONNECTOR, ORG],
    )
    .expect("seed local_connector");
}

fn ai_outcome() -> StrategyOutcome {
    StrategyOutcome {
        source: StrategySource::Ai,
        recommendation: Recommendation {
            channel: RecChannel::Email,
            priority: Priority::High,
            tone: Tone::Urgent,
            timing: Timing::Within3Days,
        },
        draft_subject: Some("Reminder".to_string()),
        draft_body: "Please pay.".to_string(),
        rationale: Some("test rationale".to_string()),
        risk_flags: Vec::new(),
        prompt_version: "slice4-v1",
    }
}

fn accepted_recommendation(conn: &mut Connection) -> String {
    seed_debtor(conn);
    let id = insert_pending(conn, ORG, DEBTOR, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert_pending")
        .id;
    mark_accepted(conn, ORG, &id, now()).expect("mark_accepted");
    id
}

fn send_input(rec_id: &str) -> SendRecommendationInput {
    SendRecommendationInput {
        recommendation_id: rec_id.to_string(),
        connector_code: CONNECTOR.to_string(),
        to: "debtor@example.invalid".to_string(),
        subject: Some("Test subject".to_string()),
        draft_body: "Please pay.".to_string(),
    }
}

fn latest_attempt_state(conn: &Connection) -> Option<String> {
    conn.query_row(
        "SELECT state FROM send_attempts
         WHERE organization_id = ?1
         ORDER BY attempted_at DESC LIMIT 1",
        params![ORG],
        |r| r.get(0),
    )
    .ok()
}

fn latest_reservation(conn: &Connection) -> Option<(Option<String>, Option<String>)> {
    conn.query_row(
        "SELECT released_at, release_reason FROM send_reservations
         WHERE organization_id = ?1
         ORDER BY reserved_at DESC LIMIT 1",
        params![ORG],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .ok()
}

fn rec_status(conn: &Connection, rec_id: &str) -> String {
    conn.query_row(
        "SELECT status FROM recommendations WHERE organization_id = ?1 AND id = ?2",
        params![ORG, rec_id],
        |r| r.get(0),
    )
    .expect("rec status")
}

fn comm_count(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM communications WHERE debtor_id = ?1",
        params![DEBTOR],
        |r| r.get(0),
    )
    .expect("comm count")
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

#[test]
fn err_outcome_goes_to_uncertain() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Error);
    let result = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send returns Ok on uncertain");

    assert!(result.uncertain, "result.uncertain must be true");
    assert!(result.communication_id.is_none());
    assert_eq!(adapter.call_count(), 1);
    assert_eq!(latest_attempt_state(&conn).as_deref(), Some("UNCERTAIN"));
    assert_eq!(rec_status(&conn, &rec_id), "SEND_UNCERTAIN");

    // Reservation held (not released).
    let (released_at, _reason) = latest_reservation(&conn).expect("reservation");
    assert!(released_at.is_none(), "reservation must be held");

    // No communication written.
    assert_eq!(comm_count(&conn), 0);
}

#[test]
fn failure_outcome_goes_to_confirmed_failure() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Failure);
    let result = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send");

    assert!(!result.uncertain);
    assert!(result.communication_id.is_none());
    assert_eq!(adapter.call_count(), 1);
    assert_eq!(
        latest_attempt_state(&conn).as_deref(),
        Some("CONFIRMED_FAILURE")
    );
    assert_eq!(rec_status(&conn, &rec_id), "ACCEPTED");
    assert_eq!(comm_count(&conn), 0);

    // Reservation released with RELEASED.
    let (released_at, reason) = latest_reservation(&conn).expect("reservation");
    assert!(released_at.is_some(), "reservation must be released");
    assert_eq!(reason.as_deref(), Some("RELEASED"));
}

#[test]
fn success_outcome_writes_communication_and_recommendation_sent() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    let result = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send");

    assert!(!result.uncertain);
    assert!(result.communication_id.is_some());
    assert_eq!(adapter.call_count(), 1);
    assert_eq!(
        latest_attempt_state(&conn).as_deref(),
        Some("CONFIRMED_SUCCESS")
    );
    assert_eq!(rec_status(&conn, &rec_id), "SENT");
    assert_eq!(comm_count(&conn), 1);

    // Reservation converted.
    let (released_at, reason) = latest_reservation(&conn).expect("reservation");
    assert!(released_at.is_some());
    assert_eq!(reason.as_deref(), Some("CONVERTED"));
}

#[test]
fn adapter_called_exactly_once_on_err() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Error);
    let _ = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send");
    assert_eq!(
        adapter.call_count(),
        1,
        "no auto-retry on Err: exactly one provider call"
    );
}

#[test]
fn adapter_called_exactly_once_on_failure() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Failure);
    let _ = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send");
    assert_eq!(
        adapter.call_count(),
        1,
        "no auto-retry on Ok(false): exactly one provider call"
    );
}

#[test]
fn second_send_blocked_while_uncertain() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let first_adapter = MockDeliveryAdapter::new(MockOutcome::Error);
    let _ = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &first_adapter,
    )
    .expect("first execute_send");

    // Recommendation is now SEND_UNCERTAIN. Second send must fail
    // at begin_send without calling the adapter.
    let second_adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    let err = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &second_adapter,
    )
    .err().expect("second send must be blocked while uncertain");

    assert!(
        err.contains("RecommendationNotAccepted"),
        "unexpected err: {}",
        err
    );
    assert_eq!(
        second_adapter.call_count(),
        0,
        "provider must not be reached while uncertain"
    );

    // Attempt count: only the first attempt exists.
    let attempts: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM send_attempts WHERE organization_id = ?1",
            params![ORG],
            |r| r.get(0),
        )
        .expect("attempt count");
    assert_eq!(attempts, 1);
}

#[test]
fn retry_allowed_after_confirmed_failure() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let first_adapter = MockDeliveryAdapter::new(MockOutcome::Failure);
    let _ = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &first_adapter,
    )
    .expect("first execute_send");

    assert_eq!(rec_status(&conn, &rec_id), "ACCEPTED");

    // Second send must be allowed (CONFIRMED_FAILURE returns the
    // recommendation to ACCEPTED per Slice 5 spec Section 7.7).
    let second_adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    let result = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &second_adapter,
    )
    .expect("second execute_send after confirmed failure");

    assert_eq!(second_adapter.call_count(), 1);
    assert!(result.communication_id.is_some());
    assert_eq!(rec_status(&conn, &rec_id), "SENT");
}