// shared/tests/slice6_uncertain.rs
//
// Slice 6 acceptance: the uncertain-outcome lifecycle end to end,
// including the superseded-recommendation paths.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 11.1-11.4, Section 12.
//
// Rows covered:
//   11.1 Full chain: execute_send -> Err -> finalize_uncertain ->
//        confirm_delivered; snapshot bytes -> communication body.
//   11.2 Communication body equals the snapshot final_body.
//   11.3 Superseded recommendation: confirm_delivered writes the
//        communication but the recommendation stays REJECTED.
//   11.4 Superseded recommendation: confirm_not_delivered releases
//        the reservation but the recommendation stays REJECTED.

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
use gorka_shared::send_safety::{
    begin_send, confirm_delivered, confirm_not_delivered, finalize_uncertain,
    read_snapshot, SendAttemptSnapshot,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG: &str = "org-6f";
const DEBTOR: &str = "debtor-6f-1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6f";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

// -----------------------------------------------------------------
// Mock adapter
// -----------------------------------------------------------------

struct MockErrAdapter;

impl ConnectorAdapter for MockErrAdapter {
    fn send(&self, _request: &SendRequest) -> Result<SendResult, ConnectorError> {
        Err(ConnectorError {
            kind: ConnectorErrorKind::ProviderTransientError,
            message: "mock transport error".to_string(),
            provider_response: None,
        })
    }
    fn test_connection(&self) -> Result<(), ConnectorError> {
        Ok(())
    }
    fn code(&self) -> &'static str {
        "mock-err"
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
        params!["lc-6f-1", CONNECTOR, ORG],
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
        prompt_version: "slice4-v1".to_string(),
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

fn valid_snapshot(rec_id: &str) -> Vec<u8> {
    let snap = SendAttemptSnapshot {
        to: "debtor@example.invalid".to_string(),
        subject: Some("Test subject".to_string()),
        from: "sender@example.invalid".to_string(),
        final_body: "snapshot-final-body-marker".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.to_string(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    snap.to_json().expect("snapshot json")
}

fn rec_status(conn: &Connection, rec_id: &str) -> String {
    conn.query_row(
        "SELECT status FROM recommendations WHERE organization_id = ?1 AND id = ?2",
        params![ORG, rec_id],
        |r| r.get(0),
    )
    .expect("rec status")
}

fn rec_superseded_by(conn: &Connection, rec_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT superseded_by FROM recommendations WHERE organization_id = ?1 AND id = ?2",
        params![ORG, rec_id],
        |r| r.get(0),
    )
    .expect("rec superseded_by")
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
fn full_chain_to_confirm_delivered() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let adapter = MockErrAdapter;
    let result = execute_send_with_adapter(
        &mut conn,
        ORG,
        USER,
        send_input(&rec_id),
        now(),
        &adapter,
    )
    .expect("execute_send");
    assert!(result.uncertain);
    let attempt_id = result.attempt_id.clone();
    assert_eq!(rec_status(&conn, &rec_id), "SEND_UNCERTAIN");

    // Snapshot is present.
    let snap_bytes = read_snapshot(&conn, ORG, &attempt_id).expect("read_snapshot");
    let snap = SendAttemptSnapshot::from_json(&snap_bytes).expect("parse snapshot");

    // Confirm delivery.
    let comm_id = confirm_delivered(&mut conn, ORG, &attempt_id, USER, now())
        .expect("confirm_delivered");
    assert!(!comm_id.is_empty());

    // 11.2: communication body equals the snapshot final_body.
    let comm_body: String = conn
        .query_row(
            "SELECT content FROM communications WHERE id = ?1",
            params![comm_id],
            |r| r.get(0),
        )
        .expect("read comm");
    assert_eq!(
        comm_body, snap.final_body,
        "communication body must equal the snapshot final_body"
    );

    // Attempt now CONFIRMED_SUCCESS, snapshot NULL.
    let (state, snap_after): (String, Option<Vec<u8>>) = conn
        .query_row(
            "SELECT state, payload_snapshot FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("read attempt");
    assert_eq!(state, "CONFIRMED_SUCCESS");
    assert!(snap_after.is_none(), "snapshot must be NULL after confirm");

    // Recommendation is SENT.
    assert_eq!(rec_status(&conn, &rec_id), "SENT");

    // Reservation converted.
    let (released_at, reason): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT released_at, release_reason FROM send_reservations
             WHERE organization_id = ?1 ORDER BY reserved_at DESC LIMIT 1",
            params![ORG],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("reservation");
    assert!(released_at.is_some());
    assert_eq!(reason.as_deref(), Some("CONVERTED"));
}

#[test]
fn superseded_confirm_delivered_keeps_rejected() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Begin an attempt directly so we can supersede rec1 while the
    // attempt is IN_PROGRESS.
    let snap = valid_snapshot(&rec_id);
    let (attempt, _) = begin_send(
        &mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now(),
    )
    .expect("begin_send");
    let attempt_id = attempt.id.clone();

    // Supersede rec1 by inserting a fresh pending recommendation for
    // the same (org, debtor).
    let rec2 = insert_pending(&mut conn, ORG, DEBTOR, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert_pending rec2")
        .id;
    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");
    assert_eq!(rec_superseded_by(&conn, &rec_id).as_deref(), Some(rec2.as_str()));

    // Move the attempt to UNCERTAIN.
    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).expect("finalize_uncertain");
    // rec1 stays REJECTED (superseded).
    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");

    // Confirm delivery. Communication is written; recommendation
    // stays REJECTED.
    let comm_id = confirm_delivered(&mut conn, ORG, &attempt_id, USER, now())
        .expect("confirm_delivered");
    assert!(!comm_id.is_empty());
    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");
    assert_eq!(comm_count(&conn), 1);
}

#[test]
fn superseded_confirm_not_delivered_keeps_rejected() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let snap = valid_snapshot(&rec_id);
    let (attempt, reservation_id) = begin_send(
        &mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now(),
    )
    .expect("begin_send");
    let attempt_id = attempt.id.clone();

    // Supersede rec1.
    let _rec2 = insert_pending(&mut conn, ORG, DEBTOR, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert_pending rec2")
        .id;
    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");

    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).expect("finalize_uncertain");
    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");

    // Confirm not delivered. Reservation released; recommendation
    // stays REJECTED; no communication written.
    confirm_not_delivered(&mut conn, ORG, &attempt_id, now())
        .expect("confirm_not_delivered");

    assert_eq!(rec_status(&conn, &rec_id), "REJECTED");
    assert_eq!(comm_count(&conn), 0);

    let (released_at, reason): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT released_at, release_reason FROM send_reservations WHERE id = ?1",
            params![reservation_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("reservation");
    assert!(released_at.is_some());
    assert_eq!(reason.as_deref(), Some("RELEASED"));
}