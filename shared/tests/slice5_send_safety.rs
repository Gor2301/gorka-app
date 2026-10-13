// shared/tests/slice5_send_safety.rs
//
// Slice 5b integration tests — send safety and orchestration.
// Authority: SLICE 5b — MINI SPEC v1.0 (FROZEN), §12.1.
//
// All tests use in-memory SQLite via open_in_memory_for_tests, except
// the two-connection lock-contention tests which use open_file_for_tests.

use chrono::{DateTime, Duration, Utc};
use gorka_shared::compliance::Channel;
use gorka_shared::db::{open_file_for_tests, open_in_memory_for_tests};
use gorka_shared::recommendation::{Channel as RecChannel, Priority, Recommendation, Timing, Tone};
use gorka_shared::recommendation_store::{insert_pending, mark_accepted};
use gorka_shared::send_safety::{
    begin_send, check_contact_limit, confirm_delivered, confirm_not_delivered,
    finalize_failure, finalize_success, finalize_uncertain, read_snapshot,
    recover_at_startup, AttemptState, SafetyError, SendAttemptSnapshot,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG: &str = "org-5b";
const OTHER_ORG: &str = "org-5b-other";
const DEBTOR: &str = "debtor-5b-1";
const OTHER_DEBTOR: &str = "debtor-5b-2";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-5b";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

fn hours_from_now(h: i64) -> DateTime<Utc> {
    now() + Duration::hours(h)
}

// -----------------------------------------------------------------
// Helpers
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
        params!["lc-1", CONNECTOR, ORG],
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
        rationale: Some("AI explanation — unverified: reason".to_string()),
        risk_flags: Vec::new(),
        prompt_version: "slice4-v1",
    }
}

fn seed_recommendation(conn: &mut Connection) -> String {
    seed_debtor(conn);
    insert_pending(conn, ORG, DEBTOR, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert_pending")
        .id
}

fn accepted_recommendation(conn: &mut Connection) -> String {
    let id = seed_recommendation(conn);
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

fn begin_ok(conn: &mut Connection, rec_id: &str) -> (String, String) {
    let snap = valid_snapshot(rec_id);
    let (attempt, reservation_id) = begin_send(
        conn, ORG, DEBTOR, rec_id, CONNECTOR, &snap, now(),
    )
    .expect("begin_send");
    (attempt.id, reservation_id)
}

fn set_contact_limit(conn: &Connection, enabled: i64, count: Option<i64>, period: Option<&str>) {
    conn.execute(
        "INSERT INTO compliance_rules (id, organization_id, contact_limit_enabled,
                                       contact_limit_count, contact_limit_period, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, '2026-01-01T00:00:00Z')
         ON CONFLICT(id) DO UPDATE SET
             contact_limit_enabled = excluded.contact_limit_enabled,
             contact_limit_count = excluded.contact_limit_count,
             contact_limit_period = excluded.contact_limit_period",
        params![ORG, enabled, count, period],
    )
    .expect("set compliance_rules");
}

fn seed_held_reservation(conn: &Connection, id: &str, when: DateTime<Utc>) {
    conn.execute(
        "INSERT INTO send_reservations
            (id, organization_id, debtor_id, connector_code, channel,
             reserved_at, released_at, release_reason)
         VALUES (?1, ?2, ?3, ?4, 'email', ?5, NULL, NULL)",
        params![id, ORG, DEBTOR, CONNECTOR, when.to_rfc3339()],
    )
    .expect("seed reservation");
}

fn seed_converted_reservation(conn: &Connection, id: &str, when: DateTime<Utc>) {
    conn.execute(
        "INSERT INTO send_reservations
            (id, organization_id, debtor_id, connector_code, channel,
             reserved_at, released_at, release_reason)
         VALUES (?1, ?2, ?3, ?4, 'email', ?5, ?6, 'CONVERTED')",
        params![id, ORG, DEBTOR, CONNECTOR, when.to_rfc3339(), when.to_rfc3339()],
    )
    .expect("seed converted reservation");
}

fn seed_released_reservation(conn: &Connection, id: &str, when: DateTime<Utc>) {
    conn.execute(
        "INSERT INTO send_reservations
            (id, organization_id, debtor_id, connector_code, channel,
             reserved_at, released_at, release_reason)
         VALUES (?1, ?2, ?3, ?4, 'email', ?5, ?6, 'RELEASED')",
        params![id, ORG, DEBTOR, CONNECTOR, when.to_rfc3339(), when.to_rfc3339()],
    )
    .expect("seed released reservation");
}

// -----------------------------------------------------------------
// Contact limit
// -----------------------------------------------------------------

#[test]
fn contact_limit_disabled_returns_ok() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 0, None, None);
    check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap();
}

#[test]
fn contact_limit_absent_row_returns_ok() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    // No compliance_rules row inserted.
    check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap();
}

#[test]
fn contact_limit_below_limit_returns_ok() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(3), Some("DAY"));
    seed_held_reservation(&conn, "r1", hours_from_now(-1));
    check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap();
}

#[test]
fn contact_limit_at_limit_returns_error() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(2), Some("DAY"));
    seed_held_reservation(&conn, "r1", hours_from_now(-1));
    seed_held_reservation(&conn, "r2", hours_from_now(-2));
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    match err {
        SafetyError::ContactLimitExceeded { limit, current, .. } => {
            assert_eq!(limit, 2);
            assert_eq!(current, 2);
        }
        other => panic!("expected ContactLimitExceeded, got {:?}", other),
    }
}

#[test]
fn contact_limit_week_window() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(2), Some("WEEK"));
    seed_held_reservation(&conn, "r1", hours_from_now(-100));
    seed_held_reservation(&conn, "r2", hours_from_now(-150));
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    assert!(matches!(err, SafetyError::ContactLimitExceeded { .. }));
}

#[test]
fn contact_limit_converted_counts() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(2), Some("DAY"));
    seed_converted_reservation(&conn, "r1", hours_from_now(-1));
    seed_converted_reservation(&conn, "r2", hours_from_now(-2));
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    assert!(matches!(err, SafetyError::ContactLimitExceeded { .. }));
}

#[test]
fn contact_limit_released_does_not_count() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(2), Some("DAY"));
    seed_released_reservation(&conn, "r1", hours_from_now(-1));
    seed_released_reservation(&conn, "r2", hours_from_now(-2));
    check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap();
}

#[test]
fn contact_limit_malformed_null_count_fails_closed() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, None, Some("DAY"));
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    assert!(matches!(err, SafetyError::DbError(_)), "got {:?}", err);
}

#[test]
fn contact_limit_malformed_null_period_fails_closed() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(5), None);
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    assert!(matches!(err, SafetyError::DbError(_)), "got {:?}", err);
}

#[test]
fn contact_limit_unknown_period_fails_closed() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(5), Some("YEAR"));
    let err = check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap_err();
    assert!(matches!(err, SafetyError::DbError(_)), "got {:?}", err);
}

#[test]
fn contact_limit_other_org_reservation_does_not_count() {
    let conn = open_in_memory_for_tests().unwrap();
    seed_debtor(&conn);
    set_contact_limit(&conn, 1, Some(1), Some("DAY"));
    conn.execute(
        "INSERT INTO send_reservations
            (id, organization_id, debtor_id, connector_code, channel, reserved_at)
         VALUES ('r-other', ?1, ?2, ?3, 'email', ?4)",
        params![OTHER_ORG, DEBTOR, CONNECTOR, hours_from_now(-1).to_rfc3339()],
    )
    .unwrap();
    check_contact_limit(&conn, ORG, DEBTOR, Channel::Email, now()).unwrap();
}

// -----------------------------------------------------------------
// begin_send — Phase 1
// -----------------------------------------------------------------

#[test]
fn begin_send_requires_accepted() {
    let mut conn = open_in_memory_for_tests().unwrap();
    seed_local_connector(&conn);
    let rec_id = seed_recommendation(&mut conn); // PENDING, not accepted
    let snap = valid_snapshot(&rec_id);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();
    assert!(matches!(err, SafetyError::RecommendationNotAccepted));
}

#[test]
fn begin_send_refuses_opt_out() {
    let mut conn = open_in_memory_for_tests().unwrap();
    // Set opt_out BEFORE insert_pending so the snapshot hash reflects
    // it. Otherwise Phase 1 sees the changed hash and returns
    // RecommendationExpired before Phase 2 reaches the opt-out check.
    conn.execute(
        "INSERT OR IGNORE INTO debtors (id, organization_id, name, surname, email, phone,
                                        data, deleted, created_at, updated_at)
         VALUES (?1, ?2, 'X', 'Y', 'x@example.invalid', '+1',
                 ?3, 'false', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR, ORG, r#"{"opt_out":{"email":true,"sms":false,"voice":false}}"#],
    )
    .unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let snap = valid_snapshot(&rec_id);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();
    assert!(matches!(err, SafetyError::OptOut { .. }));
}

#[test]
fn begin_send_refuses_connector_not_enabled() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    // No local_connector seeded.
    let snap = valid_snapshot(&rec_id);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();
    assert!(matches!(err, SafetyError::ConnectorNotEnabled));
}

#[test]
fn begin_send_refuses_contact_limit() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    set_contact_limit(&conn, 1, Some(1), Some("DAY"));
    seed_held_reservation(&conn, "r1", hours_from_now(-1));
    let snap = valid_snapshot(&rec_id);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();
    assert!(matches!(err, SafetyError::ContactLimitExceeded { .. }));
}

#[test]
fn begin_send_phase_1_marks_expired_and_returns_error() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    // Change a debt after the recommendation was created, making
    // the snapshot stale.
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES ('d1', ?1, 100.0, 'USD', 'ACTIVE', NULL, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR],
    )
    .unwrap();
    let snap = valid_snapshot(&rec_id);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();
    assert!(matches!(err, SafetyError::RecommendationExpired));

    // After Phase 1, the recommendation is not ACCEPTED.
    let status: String = conn
        .query_row(
            "SELECT status FROM recommendations WHERE id = ?1",
            params![rec_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "EXPIRED");
}

#[test]
fn begin_send_phase_1_72_hour_boundary_is_strict() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    // Exactly 72 hours: not expired.
    let at_72 = now() + Duration::hours(72);
    let snap = valid_snapshot(&rec_id);
    begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, at_72).unwrap();

    // Fresh attempt after 72h+1s: expired.
    let rec2 = accepted_recommendation(&mut conn);
    let after = at_72 + Duration::seconds(1);
    let snap2 = valid_snapshot(&rec2);
    let err = begin_send(&mut conn, ORG, DEBTOR, &rec2, CONNECTOR, &snap2, after).unwrap_err();
    assert!(matches!(err, SafetyError::RecommendationExpired));
}

// -----------------------------------------------------------------
// begin_send — Phase 2
// -----------------------------------------------------------------

#[test]
fn begin_send_happy_path_creates_reservation_and_attempt() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id);

    let (state, snap_len): (String, i64) = conn
        .query_row(
            "SELECT state, length(payload_snapshot) FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "IN_PROGRESS");
    assert!(snap_len > 0);

    let released: Option<String> = conn
        .query_row(
            "SELECT released_at FROM send_reservations WHERE id = ?1",
            params![reservation_id],
            |r| r.get(0),
        )
        .unwrap();
    assert!(released.is_none());
}

#[test]
fn begin_send_phase_2_failure_leaves_no_rows() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    // No local connector.
    let snap = valid_snapshot(&rec_id);
    let _ = begin_send(&mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now()).unwrap_err();

    let attempts: i64 = conn
        .query_row("SELECT COUNT(*) FROM send_attempts", [], |r| r.get(0))
        .unwrap();
    let reservations: i64 = conn
        .query_row("SELECT COUNT(*) FROM send_reservations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(attempts, 0);
    assert_eq!(reservations, 0);
}

// -----------------------------------------------------------------
// finalize_success
// -----------------------------------------------------------------

#[test]
fn finalize_success_full_path() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id);

    let comm_id = finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
    assert!(!comm_id.is_empty());

    let (state, snap_null): (String, Option<Vec<u8>>) = conn
        .query_row(
            "SELECT state, payload_snapshot FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "CONFIRMED_SUCCESS");
    assert!(snap_null.is_none());

    let (released, reason): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT released_at, release_reason FROM send_reservations WHERE id = ?1",
            params![reservation_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert!(released.is_some());
    assert_eq!(reason.as_deref(), Some("CONVERTED"));

    let rec_status: String = conn
        .query_row(
            "SELECT status FROM recommendations WHERE id = ?1",
            params![rec_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rec_status, "SENT");

    let (conn_code, attempt_ref): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT connector_code, send_attempt_id FROM communications WHERE id = ?1",
            params![comm_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(conn_code.as_deref(), Some(CONNECTOR));
    assert_eq!(attempt_ref.as_deref(), Some(attempt_id.as_str()));
}

#[test]
fn finalize_success_idempotent_returns_same_comm() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    let first = finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
    let second = finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
    assert_eq!(first, second);
}

#[test]
fn finalize_success_on_in_progress_ok_on_uncertain_fails() {
    // confirm_delivered requires UNCERTAIN.
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    let err = confirm_delivered(&mut conn, ORG, &attempt_id, USER, now()).unwrap_err();
    assert!(matches!(err, SafetyError::InconsistentFinalizedState { .. }));

    // finalize_success works on IN_PROGRESS.
    finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
}

#[test]
fn finalize_success_wrong_org_is_attempt_not_found() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    let err = finalize_success(&mut conn, OTHER_ORG, &attempt_id, USER, now()).unwrap_err();
    assert!(matches!(err, SafetyError::AttemptNotFound));
}

// -----------------------------------------------------------------
// finalize_failure
// -----------------------------------------------------------------

#[test]
fn finalize_failure_releases_reservation_and_no_comm() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id);

    finalize_failure(&mut conn, ORG, &attempt_id, now()).unwrap();

    let (state, snap_null): (String, Option<Vec<u8>>) = conn
        .query_row(
            "SELECT state, payload_snapshot FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "CONFIRMED_FAILURE");
    assert!(snap_null.is_none());

    let reason: Option<String> = conn
        .query_row(
            "SELECT release_reason FROM send_reservations WHERE id = ?1",
            params![reservation_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(reason.as_deref(), Some("RELEASED"));

    let comms: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM communications WHERE send_attempt_id = ?1",
            params![attempt_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(comms, 0);

    let (rec_status, decided_at): (String, Option<String>) = conn
        .query_row(
            "SELECT status, decided_at FROM recommendations WHERE id = ?1",
            params![rec_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(rec_status, "ACCEPTED");
    // decided_at preserved from mark_accepted — not overwritten by finalize_failure.
    let expected = now().to_rfc3339();
    assert_eq!(decided_at.as_deref(), Some(expected.as_str()));
}

#[test]
fn finalize_failure_idempotent() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    finalize_failure(&mut conn, ORG, &attempt_id, now()).unwrap();
    finalize_failure(&mut conn, ORG, &attempt_id, now()).unwrap();
}

// -----------------------------------------------------------------
// finalize_uncertain
// -----------------------------------------------------------------

#[test]
fn finalize_uncertain_holds_reservation_and_keeps_snapshot() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id);

    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();

    let (state, snap_len): (String, i64) = conn
        .query_row(
            "SELECT state, length(payload_snapshot) FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "UNCERTAIN");
    assert!(snap_len > 0);

    let released: Option<String> = conn
        .query_row(
            "SELECT released_at FROM send_reservations WHERE id = ?1",
            params![reservation_id],
            |r| r.get(0),
        )
        .unwrap();
    assert!(released.is_none());

    let rec_status: String = conn
        .query_row(
            "SELECT status FROM recommendations WHERE id = ?1",
            params![rec_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rec_status, "SEND_UNCERTAIN");
}

#[test]
fn finalize_uncertain_is_idempotent() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();
    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();
}

#[test]
fn finalize_uncertain_requires_in_progress_or_uncertain() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);
    finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();

    let err = finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap_err();
    assert!(matches!(err, SafetyError::InconsistentFinalizedState { .. }));
}

// -----------------------------------------------------------------
// confirm_delivered / confirm_not_delivered
// -----------------------------------------------------------------

#[test]
fn confirm_delivered_from_uncertain() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);
    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();

    let comm_id = confirm_delivered(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
    assert!(!comm_id.is_empty());
}

#[test]
fn confirm_not_delivered_from_uncertain() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, reservation_id) = begin_ok(&mut conn, &rec_id);
    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();

    confirm_not_delivered(&mut conn, ORG, &attempt_id, now()).unwrap();

    let (state, reason): (String, Option<String>) = conn
        .query_row(
            "SELECT a.state, r.release_reason
               FROM send_attempts a
               INNER JOIN send_reservations r ON r.id = a.reservation_id
              WHERE a.id = ?1",
            params![attempt_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "CONFIRMED_FAILURE");
    assert_eq!(reason.as_deref(), Some("RELEASED"));
    let _ = reservation_id;
}

#[test]
fn read_snapshot_only_on_uncertain() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    // IN_PROGRESS: not confirmable.
    let err = read_snapshot(&conn, ORG, &attempt_id).unwrap_err();
    assert!(matches!(err, SafetyError::AttemptNotConfirmable));

    finalize_uncertain(&mut conn, ORG, &attempt_id, now()).unwrap();
    let bytes = read_snapshot(&conn, ORG, &attempt_id).unwrap();
    assert!(bytes.len() > 0);

    // After successful confirm, snapshot is gone.
    finalize_success(&mut conn, ORG, &attempt_id, USER, now()).unwrap();
    let err = read_snapshot(&conn, ORG, &attempt_id).unwrap_err();
    assert!(matches!(err, SafetyError::AttemptNotConfirmable));
}

// -----------------------------------------------------------------
// recover_at_startup
// -----------------------------------------------------------------

#[test]
fn recover_at_startup_flips_in_progress() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let (attempt_id, _) = begin_ok(&mut conn, &rec_id);

    let n = recover_at_startup(&mut conn, now()).unwrap();
    assert_eq!(n, 1);

    let state: String = conn
        .query_row(
            "SELECT state FROM send_attempts WHERE id = ?1",
            params![attempt_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "UNCERTAIN");

    let rec_status: String = conn
        .query_row(
            "SELECT status FROM recommendations WHERE id = ?1",
            params![rec_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rec_status, "SEND_UNCERTAIN");
}

#[test]
fn recover_at_startup_is_idempotent() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);
    let _ = begin_ok(&mut conn, &rec_id);

    let first = recover_at_startup(&mut conn, now()).unwrap();
    let second = recover_at_startup(&mut conn, now()).unwrap();
    assert_eq!(first, 1);
    assert_eq!(second, 0);
}

#[test]
fn recover_at_startup_empty_returns_zero() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let n = recover_at_startup(&mut conn, now()).unwrap();
    assert_eq!(n, 0);
}

// -----------------------------------------------------------------
// Cross-record validation
// -----------------------------------------------------------------

#[test]
fn finalize_success_rejects_snapshot_with_wrong_connector() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let mut snap = SendAttemptSnapshot {
        to: "x@example.invalid".to_string(),
        subject: None,
        from: "s@example.invalid".to_string(),
        final_body: "B".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.clone(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    snap.connector_code = "wrong-code".to_string();
    let bytes = snap.to_json().unwrap();

    let (attempt, _) = begin_send(
        &mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &bytes, now(),
    )
    .unwrap();
    let err = finalize_success(&mut conn, ORG, &attempt.id, USER, now()).unwrap_err();
    assert!(matches!(err, SafetyError::SnapshotInvalid));
}

#[test]
fn finalize_success_rejects_wrong_debtor_in_snapshot() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let mut snap = SendAttemptSnapshot {
        to: "x@example.invalid".to_string(),
        subject: None,
        from: "s@example.invalid".to_string(),
        final_body: "B".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.clone(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    snap.debtor_id = "wrong-debtor".to_string();
    let bytes = snap.to_json().unwrap();

    let (attempt, _) = begin_send(
        &mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &bytes, now(),
    )
    .unwrap();
    let err = finalize_success(&mut conn, ORG, &attempt.id, USER, now()).unwrap_err();
    assert!(matches!(err, SafetyError::SnapshotInvalid));
}

#[test]
fn finalize_success_rejects_channel_mismatch_in_snapshot() {
    let mut conn = open_in_memory_for_tests().unwrap();
    let rec_id = accepted_recommendation(&mut conn);
    seed_local_connector(&conn);

    let mut snap = SendAttemptSnapshot {
        to: "x@example.invalid".to_string(),
        subject: None,
        from: "s@example.invalid".to_string(),
        final_body: "B".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.clone(),
        debtor_id: DEBTOR.to_string(),
        created_at: now().to_rfc3339(),
    };
    snap.channel = "sms".to_string();
    let bytes = snap.to_json().unwrap();

    let (attempt, _) = begin_send(
        &mut conn, ORG, DEBTOR, &rec_id, CONNECTOR, &bytes, now(),
    )
    .unwrap();
    let err = finalize_success(&mut conn, ORG, &attempt.id, USER, now()).unwrap_err();
    assert!(matches!(err, SafetyError::SnapshotInvalid));
}

// -----------------------------------------------------------------
// Two-connection lock contention
// -----------------------------------------------------------------

#[test]
fn begin_send_phase_1_succeeds_when_lock_released_within_timeout() {
    let dir = std::env::temp_dir();
    let path = dir.join(format!("slice5b_lock_a_{}.db", uuid::Uuid::new_v4()));
    let _ = std::fs::remove_file(&path);

    let mut conn_a = open_file_for_tests(&path).expect("conn_a");
    let mut conn_b = open_file_for_tests(&path).expect("conn_b");

    // Seed on conn_a.
    let rec_id = accepted_recommendation(&mut conn_a);
    seed_local_connector(&conn_a);

    // conn_a holds BEGIN IMMEDIATE briefly in a thread.
    let path_clone = path.clone();
    let handle = std::thread::spawn(move || {
        let mut c = open_file_for_tests(&path_clone).unwrap();
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(200));
        drop(tx);
    });

    std::thread::sleep(std::time::Duration::from_millis(50));
    let snap = valid_snapshot(&rec_id);
    // conn_b waits, then succeeds.
    let result = begin_send(&mut conn_b, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now());
    handle.join().unwrap();
    assert!(result.is_ok(), "expected Ok, got {:?}", result.err());

    let _ = std::fs::remove_file(&path);
}

#[test]
#[ignore]
fn begin_send_phase_1_returns_db_error_when_lock_held_beyond_timeout() {
    // Not executed by default: this test holds a write lock for
    // longer than the busy_timeout, which the standard test suite
    // does not run because it slows the suite by ~5 seconds.
    // Runs when --ignored is passed. Records the intended behavior.
    let dir = std::env::temp_dir();
    let path = dir.join(format!("slice5b_lock_b_{}.db", uuid::Uuid::new_v4()));
    let _ = std::fs::remove_file(&path);

    let mut conn_a = open_file_for_tests(&path).expect("conn_a");
    let mut conn_b = open_file_for_tests(&path).expect("conn_b");

    let rec_id = accepted_recommendation(&mut conn_a);
    seed_local_connector(&conn_a);

    // conn_a holds write lock for 6s (> 5s busy_timeout).
    let tx_a = conn_a
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .unwrap();
    // Set up the lock on conn_a. The transaction is held in scope.
    let snap = valid_snapshot(&rec_id);
    let start = std::time::Instant::now();
    let result = begin_send(&mut conn_b, ORG, DEBTOR, &rec_id, CONNECTOR, &snap, now());
    let elapsed = start.elapsed();
    drop(tx_a);
    // After ~5s, conn_b returns DbError.
    assert!(matches!(result, Err(SafetyError::DbError(_))), "got {:?}", result);
    assert!(elapsed.as_secs() >= 4, "elapsed {:?}", elapsed);

    let _ = std::fs::remove_file(&path);
}