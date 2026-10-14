// shared/tests/slice6_altered_drafts.rs
//
// Slice 6 acceptance: altered drafts, validation order, rejected
// drafts never reaching begin_send or the provider.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 6.1-6.5, Section 8, Section 24.2.
//
// Fixture ordering note. The freshness snapshot is captured at
// insert_pending time and recomputed at begin_send time. Any debt
// the test wants counted in the snapshot must therefore be seeded
// BEFORE the recommendation is inserted. Seeding a debt after the
// recommendation invalidates the hash and begin_send returns
// RecommendationExpired. That is correct production behavior.

use std::cell::RefCell;

use chrono::{DateTime, Utc};
use gorka_shared::connectors::{
    ConnectorAdapter, ConnectorError, SendRequest, SendResult,
};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::fact_validation::{validate_draft, Verification};
use gorka_shared::recommendation::{
    Channel as RecChannel, Priority, Recommendation, Timing, Tone,
};
use gorka_shared::recommendation_store::{insert_pending, mark_accepted};
use gorka_shared::send_orchestration::{
    execute_send_with_adapter, SendRecommendationInput,
};
use gorka_shared::send_safety::SendAttemptSnapshot;
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG: &str = "org-6d";
const DEBTOR: &str = "debtor-6d-1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6d";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

// -----------------------------------------------------------------
// Mock adapter
// -----------------------------------------------------------------

struct MockDeliveryAdapter {
    calls: RefCell<Vec<SendRequest>>,
}

impl MockDeliveryAdapter {
    fn new() -> Self {
        Self {
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

impl ConnectorAdapter for MockDeliveryAdapter {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError> {
        self.calls.borrow_mut().push(SendRequest {
            to: request.to.clone(),
            body: request.body.clone(),
            subject: request.subject.clone(),
            from: request.from.clone(),
        });
        Ok(SendResult {
            success: true,
            provider_message_id: Some("mock-msg".to_string()),
            provider_status: None,
            provider_response: None,
        })
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

fn seed_debt(conn: &Connection, id: &str, amount: f64, status: &str) {
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'USD', ?4, NULL, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, DEBTOR, amount, status],
    )
    .expect("seed debt");
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
        params!["lc-6d-1", CONNECTOR, ORG],
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

fn send_input(rec_id: &str, body: &str) -> SendRecommendationInput {
    SendRecommendationInput {
        recommendation_id: rec_id.to_string(),
        connector_code: CONNECTOR.to_string(),
        to: "debtor@example.invalid".to_string(),
        subject: Some("Test subject".to_string()),
        draft_body: body.to_string(),
    }
}

fn count_rows(conn: &Connection, table: &str) -> i64 {
    let sql = format!(
        "SELECT COUNT(*) FROM {} WHERE organization_id = ?1",
        table
    );
    conn.query_row(&sql, params![ORG], |r| r.get(0))
        .unwrap_or(0)
}

fn read_snapshot_final_body(conn: &Connection) -> Option<String> {
    let bytes: Vec<u8> = conn
        .query_row(
            "SELECT payload_snapshot FROM send_attempts
             WHERE organization_id = ?1 AND payload_snapshot IS NOT NULL
             ORDER BY attempted_at DESC LIMIT 1",
            params![ORG],
            |row| row.get(0),
        )
        .ok()?;
    let snap = SendAttemptSnapshot::from_json(&bytes).ok()?;
    Some(snap.final_body)
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

#[test]
fn mismatch_blocks_before_begin_send() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-6d-1", 500.00, "UNPAID");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Draft says $999.99. Debt is $500.00. Mismatch.
    let adapter = MockDeliveryAdapter::new();
    let err = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id, "Please pay $999.99 immediately."),
        now(),
        &adapter,
    )
    .err()
    .expect("mismatch must block");
    assert!(
        err.contains("unresolved mismatch"),
        "unexpected err: {}",
        err
    );
    assert_eq!(adapter.call_count(), 0, "provider must not be reached");
    assert_eq!(count_rows(&conn, "send_attempts"), 0);
    assert_eq!(count_rows(&conn, "send_reservations"), 0);
}

#[test]
fn unverifiable_blocks_before_begin_send() {
    let mut conn = open_in_memory_for_tests().expect("open");
    // No debts: $500.00 is unverifiable.
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new();
    let err = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id, "Please pay $500.00."),
        now(),
        &adapter,
    )
    .err()
    .expect("unverifiable must block");
    assert!(err.contains("unverifiable"), "unexpected err: {}", err);
    assert_eq!(adapter.call_count(), 0);
    assert_eq!(count_rows(&conn, "send_attempts"), 0);
    assert_eq!(count_rows(&conn, "send_reservations"), 0);
}

#[test]
fn verified_proceeds() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-6d-2", 500.00, "UNPAID");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new();
    execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id, "Please pay $500.00."),
        now(),
        &adapter,
    )
    .expect("verified draft must send");
    assert_eq!(adapter.call_count(), 1);
    assert_eq!(count_rows(&conn, "send_attempts"), 1);
}

#[test]
fn frozen_order_validated_equals_sent() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-6d-3", 500.00, "UNPAID");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new();
    execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id, "Please pay $500.00 soon."),
        now(),
        &adapter,
    )
    .expect("send");

    let sent = adapter.last_body().expect("last body");
    let snap_body = read_snapshot_final_body(&conn).expect("snapshot body");
    assert_eq!(
        sent, snap_body,
        "sent body must equal the body stored in the snapshot \
         (which is the exact body that was validated)"
    );

    // Cross-check: revalidating the sent body must produce only
    // Verified flags. No Mismatch. No Unverifiable.
    let flags = validate_draft(&conn, ORG, DEBTOR, "", &sent, 0).expect("revalidate");
    for f in &flags {
        assert!(
            matches!(f.verification, Verification::Verified { .. }),
            "sent body must revalidate as Verified; found {:?}",
            f.verification
        );
    }
}

#[test]
fn rejected_leaves_zero_rows() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-6d-4", 500.00, "UNPAID");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockDeliveryAdapter::new();
    let _err = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id, "Please pay $999.99 immediately."),
        now(),
        &adapter,
    )
    .err()
    .expect("mismatch must block");

    assert_eq!(count_rows(&conn, "send_attempts"), 0);
    assert_eq!(count_rows(&conn, "send_reservations"), 0);
}