// shared/tests/slice6_credential_leak.rs
//
// Slice 6 acceptance: credential leakage across orchestration paths.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 8.1-8.7, Section 10, Section 24.4.
//
// Sentinel-based. The credential value stored in local_connectors
// contains a sentinel string. After execute_send_with_adapter runs,
// the sentinel must not appear in:
//
//   8.1 send_attempts.payload_snapshot bytes
//   8.2 any column of communications
//   8.3 audit_log rows written by the block path (SEND_BLOCKED)
//   8.4 audit_log rows written by the INSERT_COMM path
//   8.5 any Err string returned from execute_send_with_adapter
//   8.6 list_local_connectors output
//   8.7 (positive control) local_connectors.credential_value
//
// The fake adapter makes no network calls. Section 24.4 separates
// orchestration-level credential tests from real-adapter HTTP-boundary
// tests, which remain in slice3b_gemini.rs and slice3b_openai.rs.

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

const ORG: &str = "org-6c";
const DEBTOR: &str = "debtor-6c-1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6c";
const SENTINEL: &str = "SENTINEL_CREDENTIAL_DO_NOT_PRINT_6C";

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
                provider_message_id: Some("mock-msg-id".to_string()),
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

fn seed_local_connector_with_sentinel(conn: &Connection) {
    let cred_json = format!("{{\"apiKey\":\"{}\"}}", SENTINEL);
    let cred_bytes: Vec<u8> = cred_json.into_bytes();
    conn.execute(
        "INSERT OR IGNORE INTO local_connectors
            (id, connector_code, organization_id, tier, status,
             credential_value, configuration, source_device_id,
             created_at, updated_at, winning_logical_clock, winning_device_id, winning_sequence)
         VALUES (?1, ?2, ?3, 'TIER1', 'ENABLED',
                 ?4, '{\"from\":\"a@b.invalid\"}',
                 'local', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 100, X'01', 1)",
        params!["lc-6c-1", CONNECTOR, ORG, cred_bytes],
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
        draft_body: "Test body".to_string(),
    }
}

// -----------------------------------------------------------------
// Sentinel scanners
// -----------------------------------------------------------------

fn snapshot_bytes_contain_sentinel(conn: &Connection) -> bool {
    let mut stmt = conn
        .prepare(
            "SELECT payload_snapshot FROM send_attempts
             WHERE organization_id = ?1 AND payload_snapshot IS NOT NULL",
        )
        .expect("prepare snapshot scan");
    let mut rows = stmt.query(params![ORG]).expect("query snapshot scan");
    while let Some(row) = rows.next().expect("row") {
        let bytes: Vec<u8> = row.get(0).expect("snapshot bytes");
        if std::str::from_utf8(&bytes)
            .map(|s| s.contains(SENTINEL))
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

fn communications_contain_sentinel(conn: &Connection) -> bool {
    let sql = "SELECT
                 COALESCE(id,'') || '|' || COALESCE(debtor_id,'') || '|' ||
                 COALESCE(type,'') || '|' || COALESCE(direction,'') || '|' ||
                 COALESCE(content,'') || '|' || COALESCE(created_by,'') || '|' ||
                 COALESCE(data,'') || '|' || COALESCE(created_at,'') || '|' ||
                 COALESCE(connector_code,'') || '|' || COALESCE(send_attempt_id,'')
               FROM communications WHERE debtor_id = ?1";
    let mut stmt = conn.prepare(sql).expect("prepare comm scan");
    let mut rows = stmt.query(params![DEBTOR]).expect("query comm scan");
    while let Some(row) = rows.next().expect("row") {
        let joined: String = row.get(0).expect("joined");
        if joined.contains(SENTINEL) {
            return true;
        }
    }
    false
}

fn audit_log_contains_sentinel(conn: &Connection, action_filter: Option<&str>) -> bool {
    let mut sql = String::from(
        "SELECT COALESCE(id,'') || '|' || COALESCE(action,'') || '|' ||
                COALESCE(details,'') || '|' || COALESCE(debtor_id,'') || '|' ||
                COALESCE(created_at,'')
         FROM audit_log",
    );
    let use_filter = action_filter.is_some();
    if use_filter {
        sql.push_str(" WHERE action = ?1");
    }
    let mut stmt = conn.prepare(&sql).expect("prepare audit scan");
    let mut rows = if let Some(a) = action_filter {
        stmt.query(params![a]).expect("query audit scan")
    } else {
        stmt.query([]).expect("query audit scan")
    };
    while let Some(row) = rows.next().expect("row") {
        let joined: String = row.get(0).expect("joined");
        if joined.contains(SENTINEL) {
            return true;
        }
    }
    false
}

fn list_local_connectors_contains_sentinel(conn: &Connection) -> bool {
    let rows = gorka_shared::connectors::local_record::list_local_connectors(conn, ORG)
        .expect("list_local_connectors");
    for r in rows {
        let s = serde_json::to_string(&r).unwrap_or_default();
        if s.contains(SENTINEL) {
            return true;
        }
    }
    false
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

#[test]
fn sentinel_absent_from_snapshot() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector_with_sentinel(&conn);

    // Error outcome retains the snapshot (finalize_uncertain).
    let adapter = MockDeliveryAdapter::new(MockOutcome::Error);
    execute_send_with_adapter(&mut conn, ORG, USER, send_input(&rec_id), now(), &adapter)
        .expect("execute_send");
    assert_eq!(adapter.call_count(), 1);
    assert!(
        !snapshot_bytes_contain_sentinel(&conn),
        "sentinel found in payload_snapshot"
    );
}

#[test]
fn sentinel_absent_from_communication() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector_with_sentinel(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    execute_send_with_adapter(&mut conn, ORG, USER, send_input(&rec_id), now(), &adapter)
        .expect("execute_send");
    assert!(!communications_contain_sentinel(&conn));
}

#[test]
fn sentinel_absent_from_blocked_send_audit() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector_with_sentinel(&conn);

    conn.execute(
        "UPDATE debtors SET data = '{\"opt_out\":{\"email\":true}}'
         WHERE id = ?1 AND organization_id = ?2",
        params![DEBTOR, ORG],
    )
    .expect("set opt-out");

    let adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    let err = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .err().expect("opt-out must block");
    assert!(!err.contains(SENTINEL), "sentinel in Err: {}", err);
    assert!(!audit_log_contains_sentinel(&conn, Some("SEND_BLOCKED")));
    assert_eq!(adapter.call_count(), 0);
}

#[test]
fn sentinel_absent_from_insert_comm_audit() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector_with_sentinel(&conn);

    let adapter = MockDeliveryAdapter::new(MockOutcome::Success);
    execute_send_with_adapter(&mut conn, ORG, USER, send_input(&rec_id), now(), &adapter)
        .expect("execute_send");
    assert!(!audit_log_contains_sentinel(&conn, Some("INSERT_COMM")));
}

#[test]
fn sentinel_absent_from_err_strings() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector_with_sentinel(&conn);

    // Path 1: adapter returns Err. The failure_reason field on the
    // Ok result must not contain the sentinel.
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
    if let Some(reason) = &result.failure_reason {
        assert!(!reason.contains(SENTINEL), "sentinel in failure_reason");
    }

    // Path 2: unknown connector. The returned Err must not contain
    // the sentinel.
    let mut input = send_input(&rec_id);
    input.connector_code = "not-a-connector".to_string();
    let err = execute_send_with_adapter(&mut conn, ORG, USER, input, now(), &adapter)
        .err().expect("unknown connector must Err");
    assert!(!err.contains(SENTINEL), "sentinel in Err: {}", err);
}

#[test]
fn sentinel_absent_from_list_local_connectors() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_local_connector_with_sentinel(&conn);
    assert!(!list_local_connectors_contains_sentinel(&conn));
}

#[test]
fn positive_control_sentinel_present_in_credential_store() {
    let conn = open_in_memory_for_tests().expect("open");
    seed_local_connector_with_sentinel(&conn);

    let bytes: Vec<u8> = conn
        .query_row(
            "SELECT credential_value FROM local_connectors WHERE id = ?1",
            params!["lc-6c-1"],
            |row| row.get(0),
        )
        .expect("read credential");
    let s = std::str::from_utf8(&bytes).expect("utf8");
    assert!(
        s.contains(SENTINEL),
        "sentinel must be present in local_connectors.credential_value"
    );
}