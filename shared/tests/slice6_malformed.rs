// shared/tests/slice6_malformed.rs
//
// Slice 6 acceptance: malformed snapshot handling with rollback
// guarantees. Every test asserts BOTH the returned error AND the
// resulting database state. Section 13: error alone is insufficient.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 5.1-5.5, Section 13.
//
// Rows covered:
//   5.1 Malformed bytes on finalize_success -> SnapshotInvalid,
//       rollback (attempt stays IN_PROGRESS, no communication).
//   5.2 Malformed bytes on finalize_failure -> SnapshotInvalid,
//       rollback (attempt stays IN_PROGRESS, reservation held).
//   5.3 NULL snapshot on finalize_success -> SnapshotMissing.
//   5.4 Valid JSON missing a required field -> SnapshotInvalid.
//   5.5 Cross-record mismatch (wrong connector) -> SnapshotInvalid
//       with database state assertion.

use chrono::{DateTime, Utc};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::recommendation::{
    Channel as RecChannel, Priority, Recommendation, Timing, Tone,
};
use gorka_shared::recommendation_store::{insert_pending, mark_accepted};
use gorka_shared::send_safety::{
    begin_send, finalize_failure, finalize_success, SafetyError, SendAttemptSnapshot,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG: &str = "org-6g";
const DEBTOR: &str = "debtor-6g-1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6g";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
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
        params!["lc-6g-1", CONNECTOR, ORG],
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

fn valid_snapshot(rec_id: &str) -> Vec<u8> {
    let snap = SendAttemptSnapshot {
        to: "debtor@example.invalid".to_string(),
        subject: Some("Test subject".to_string()),
        from: "sender@example.invalid".to_string(),
        final_body: "Test body".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.to_string(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    snap.to_json().expect("snapshot json")
}

fn begin_ok(conn: &mut Connection, rec_id: &str, bytes: &[u8]) -> (String, String) {
    let (attempt, reservation_id) = begin_send(
        conn, ORG, DEBTOR, rec_id, CONNECTOR, bytes, now(),
    )
    .expect("begin_send");
    (attempt.id, reservation_id)
}

fn attempt_state(conn: &Connection, attempt_id: &str) -> String {
    conn.query_row(
        "SELECT state FROM send_attempts WHERE id = ?1",
        params![attempt_id],
        |r| r.get(0),
    )
    .expect("attempt state")
}

fn attempt_snapshot_len(conn: &Connection, attempt_id: &str) -> i64 {
    conn.query_row(
        "SELECT COALESCE(LENGTH(payload_snapshot), 0) FROM send_attempts WHERE id = ?1",
        params![attempt_id],
        |r| r.get(0),
    )
    .expect("snapshot length")
}

fn comm_count(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM communications WHERE debtor_id = ?1",
        params![DEBTOR],
        |r| r.get(0),
    )
    .expect("comm count")
}

fn reservation_state(conn: &Connection, reservation_id: &str) -> (Option<String>, Option<String>) {
    conn.query_row(
        "SELECT released_at, release_reason FROM send_reservations WHERE id = ?1",
        params![reservation_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .expect("reservation")
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

#[test]
fn malformed_bytes_finalize_success_rolls_back() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Bytes that are not valid UTF-8 JSON.
    let junk: Vec<u8> = vec![0xFF, 0xFE, 0xFD, 0xFC];
    let (attempt_id, _res) = begin_ok(&mut conn, &rec_id, &junk);

    let err = finalize_success(&mut conn, ORG, &attempt_id, USER, now())
        .expect_err("malformed snapshot must reject");
    assert!(matches!(err, SafetyError::SnapshotInvalid));

    // Rollback: attempt still IN_PROGRESS, snapshot bytes retained,
    // no communication written.
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    assert_eq!(attempt_snapshot_len(&conn, &attempt_id), 4);
    assert_eq!(comm_count(&conn), 0);
}

#[test]
fn malformed_bytes_finalize_failure_rolls_back() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let junk: Vec<u8> = vec![0x00, 0x01, 0x02];
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id, &junk);

    let err = finalize_failure(&mut conn, ORG, &attempt_id, now())
        .expect_err("malformed snapshot must reject");
    assert!(matches!(err, SafetyError::SnapshotInvalid));

    // Rollback: attempt still IN_PROGRESS, snapshot retained,
    // reservation still held, no communication written.
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    assert_eq!(attempt_snapshot_len(&conn, &attempt_id), 3);
    let (released_at, reason) = reservation_state(&conn, &reservation_id);
    assert!(released_at.is_none(), "reservation must stay held");
    assert!(reason.is_none());
    assert_eq!(comm_count(&conn), 0);
}

#[test]
fn null_snapshot_finalize_success_returns_missing() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let snap = valid_snapshot(&rec_id);
    let (attempt_id, _res) = begin_ok(&mut conn, &rec_id, &snap);

    // Force the snapshot to NULL to simulate a state that a
    // corrupted write or manual cleanup could produce.
    conn.execute(
        "UPDATE send_attempts SET payload_snapshot = NULL WHERE id = ?1",
        params![attempt_id],
    )
    .expect("null snapshot");

    let err = finalize_success(&mut conn, ORG, &attempt_id, USER, now())
        .expect_err("null snapshot must reject");
    assert!(matches!(err, SafetyError::SnapshotMissing));

    // Rollback: attempt still IN_PROGRESS, no communication written.
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    assert_eq!(comm_count(&conn), 0);
}

#[test]
fn missing_field_finalize_success_returns_invalid() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Valid JSON, but `to` is missing. deny_unknown_fields plus the
    // struct definition make this a SnapshotInvalid.
    let incomplete = format!(
        "{{\"subject\":null,\"from\":\"s@x.invalid\",\
           \"final_body\":\"b\",\"connector_code\":\"{}\",\
           \"channel\":\"email\",\"recommendation_id\":\"{}\",\
           \"debtor_id\":\"{}\",\"created_at\":\"2026-01-01T00:00:00Z\"}}",
        CONNECTOR, rec_id, DEBTOR
    );
    let bytes = incomplete.into_bytes();

    let (attempt_id, _res) = begin_ok(&mut conn, &rec_id, &bytes);

    let err = finalize_success(&mut conn, ORG, &attempt_id, USER, now())
        .expect_err("missing field must reject");
    assert!(matches!(err, SafetyError::SnapshotInvalid));

    // Rollback: attempt still IN_PROGRESS, no communication written.
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    assert_eq!(comm_count(&conn), 0);
}

#[test]
fn cross_record_mismatch_rolls_back() {
    let mut conn = open_in_memory_for_tests().expect("open");
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Build a snapshot whose connector_code disagrees with the
    // attempt. This mirrors the existing slice5 cross-record test,
    // but adds the database-state assertion required by Section 13.
    let mut snap = SendAttemptSnapshot {
        to: "debtor@example.invalid".to_string(),
        subject: None,
        from: "s@x.invalid".to_string(),
        final_body: "b".to_string(),
        connector_code: "wrong-code".to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.clone(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    // The snapshot is stored with bytes that will parse, but the
    // bytes on disk disagree with the attempt's connector_code.
    // Ensure the stored bytes carry the wrong code.
    snap.connector_code = "wrong-code".to_string();
    let bytes = snap.to_json().expect("snapshot json");

    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id, &bytes);

    let err = finalize_success(&mut conn, ORG, &attempt_id, USER, now())
        .expect_err("mismatched snapshot must reject");
    assert!(matches!(err, SafetyError::SnapshotInvalid));

    // Rollback: attempt still IN_PROGRESS, snapshot retained,
    // reservation still held, no communication written.
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    assert!(attempt_snapshot_len(&conn, &attempt_id) > 0);
    let (released_at, _reason) = reservation_state(&conn, &reservation_id);
    assert!(released_at.is_none());
    assert_eq!(comm_count(&conn), 0);
}