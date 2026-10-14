// shared/tests/slice6_crash_recovery.rs
//
// Slice 6 acceptance: crash-state recovery semantics via
// recover_at_startup. Synthetic injection, not a literal subprocess
// crash (see Part III Section 19 Q3).
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 12.1-12.6.
//
// Rows covered:
//   12.1 Multi-org scan: recover_at_startup reaches attempts in
//        multiple organizations in one call.
//   12.2 Missing recommendation: InconsistentFinalizedState,
//        rollback, no partial write.
//   12.3 Superseded recommendation: attempt flips to UNCERTAIN;
//        recommendation status untouched (stays REJECTED).
//   12.4 Snapshot retained post-recovery.
//   12.5 (covered) Idempotent second call returns 0.
//   12.6 confirm_delivered after recovery writes the communication
//        from the retained snapshot.

use chrono::{DateTime, Utc};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::recommendation::{
    Channel as RecChannel, Priority, Recommendation, Timing, Tone,
};
use gorka_shared::recommendation_store::{insert_pending, mark_accepted};
use gorka_shared::send_safety::{
    begin_send, confirm_delivered, read_snapshot, recover_at_startup, SafetyError,
    SendAttemptSnapshot,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::{params, Connection};

const ORG_A: &str = "org-6i-a";
const ORG_B: &str = "org-6i-b";
const DEBTOR_A: &str = "debtor-6i-a1";
const DEBTOR_B: &str = "debtor-6i-b1";
const AI_CODE: &str = "gemini-ai";
const CONNECTOR: &str = "resend-email";
const USER: &str = "user-6i";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-14T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

fn seed_debtor(conn: &Connection, org: &str, debtor: &str) {
    conn.execute(
        "INSERT OR IGNORE INTO debtors (id, organization_id, name, surname, email, phone,
                              data, deleted, created_at, updated_at)
         VALUES (?1, ?2, 'Test', 'Sur', 'z@example.invalid', '+10000000000',
                 '{}', 'false', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![debtor, org],
    )
    .expect("seed debtor");
}

fn seed_local_connector(conn: &Connection, org: &str, id: &str) {
    conn.execute(
        "INSERT OR IGNORE INTO local_connectors
            (id, connector_code, organization_id, tier, status,
             credential_value, configuration, source_device_id,
             created_at, updated_at, winning_logical_clock, winning_device_id, winning_sequence)
         VALUES (?1, ?2, ?3, 'TIER1', 'ENABLED',
                 X'7B226170694B6579223A2278227D', '{\"from\":\"a@b.invalid\"}',
                 'local', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 100, X'01', 1)",
        params![id, CONNECTOR, org],
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

fn accepted_rec(conn: &mut Connection, org: &str, debtor: &str) -> String {
    seed_debtor(conn, org, debtor);
    let id = insert_pending(conn, org, debtor, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert_pending")
        .id;
    mark_accepted(conn, org, &id, now()).expect("mark_accepted");
    id
}

fn valid_snapshot(rec_id: &str, org: &str, debtor: &str) -> Vec<u8> {
    let snap = SendAttemptSnapshot {
        to: "debtor@example.invalid".to_string(),
        subject: Some("Test subject".to_string()),
        from: "sender@example.invalid".to_string(),
        final_body: "snapshot-marker-6i".to_string(),
        connector_code: CONNECTOR.to_string(),
        channel: "email".to_string(),
        recommendation_id: rec_id.to_string(),
        debtor_id: debtor.to_string(),
        created_at: now().to_rfc3339(),
    };
    let _ = org;
    snap.to_json().expect("snapshot json")
}

fn begin_ok(conn: &mut Connection, org: &str, debtor: &str, rec_id: &str) -> String {
    let snap = valid_snapshot(rec_id, org, debtor);
    let (attempt, _) = begin_send(conn, org, debtor, rec_id, CONNECTOR, &snap, now())
        .expect("begin_send");
    attempt.id
}

fn attempt_state(conn: &Connection, attempt_id: &str) -> String {
    conn.query_row(
        "SELECT state FROM send_attempts WHERE id = ?1",
        params![attempt_id],
        |r| r.get(0),
    )
    .expect("attempt state")
}

fn attempt_snap_len(conn: &Connection, attempt_id: &str) -> i64 {
    conn.query_row(
        "SELECT COALESCE(LENGTH(payload_snapshot), 0) FROM send_attempts WHERE id = ?1",
        params![attempt_id],
        |r| r.get(0),
    )
    .expect("snap len")
}

fn rec_status(conn: &Connection, org: &str, rec_id: &str) -> String {
    conn.query_row(
        "SELECT status FROM recommendations WHERE organization_id = ?1 AND id = ?2",
        params![org, rec_id],
        |r| r.get(0),
    )
    .expect("rec status")
}

// -----------------------------------------------------------------
// Row 12.1: multi-org scan
// -----------------------------------------------------------------

#[test]
fn multi_org_scan() {
    let mut conn = open_in_memory_for_tests().expect("open");

    let rec_a = accepted_rec(&mut conn, ORG_A, DEBTOR_A);
    let rec_b = accepted_rec(&mut conn, ORG_B, DEBTOR_B);
    seed_local_connector(&conn, ORG_A, "lc-6i-a");
    seed_local_connector(&conn, ORG_B, "lc-6i-b");

    let att_a = begin_ok(&mut conn, ORG_A, DEBTOR_A, &rec_a);
    let att_b = begin_ok(&mut conn, ORG_B, DEBTOR_B, &rec_b);

    let n = recover_at_startup(&mut conn, now()).expect("recover");
    assert_eq!(n, 2, "both orgs' IN_PROGRESS attempts must transition");

    assert_eq!(attempt_state(&conn, &att_a), "UNCERTAIN");
    assert_eq!(attempt_state(&conn, &att_b), "UNCERTAIN");
    assert_eq!(rec_status(&conn, ORG_A, &rec_a), "SEND_UNCERTAIN");
    assert_eq!(rec_status(&conn, ORG_B, &rec_b), "SEND_UNCERTAIN");
}

// -----------------------------------------------------------------
// Row 12.2: missing recommendation -> rollback, no partial write
// -----------------------------------------------------------------

#[test]
fn missing_recommendation_rollback() {
    let mut conn = open_in_memory_for_tests().expect("open");

    let rec = accepted_rec(&mut conn, ORG_A, DEBTOR_A);
    seed_local_connector(&conn, ORG_A, "lc-6i-a2");
    let attempt_id = begin_ok(&mut conn, ORG_A, DEBTOR_A, &rec);

    // Simulate integrity violation: the recommendation row is gone
    // while its attempt remains. FK is RESTRICT so direct DELETE
    // fails; toggle FK enforcement off, delete, restore.
    conn.execute("PRAGMA foreign_keys = OFF", []).ok();
    conn.execute(
        "DELETE FROM recommendations WHERE organization_id = ?1 AND id = ?2",
        params![ORG_A, rec],
    )
    .expect("delete rec");
    conn.execute("PRAGMA foreign_keys = ON", []).ok();

    // Sanity: recommendation is gone.
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM recommendations WHERE id = ?1",
            params![rec],
            |r| r.get(0),
        )
        .expect("count rec");
    assert_eq!(exists, 0);

    // Recovery must return InconsistentFinalizedState and roll back.
    let err = recover_at_startup(&mut conn, now()).err().expect("must reject");
    assert!(
        matches!(err, SafetyError::InconsistentFinalizedState { .. }),
        "unexpected err: {:?}",
        err
    );

    // Rollback: attempt still IN_PROGRESS. (Not flipped to UNCERTAIN.)
    assert_eq!(attempt_state(&conn, &attempt_id), "IN_PROGRESS");
    // Snapshot untouched.
    assert!(attempt_snap_len(&conn, &attempt_id) > 0);
}

// -----------------------------------------------------------------
// Row 12.3 + 12.4: superseded recommendation, snapshot retained
// -----------------------------------------------------------------

#[test]
fn superseded_recommendation_untouched() {
    let mut conn = open_in_memory_for_tests().expect("open");

    let rec1 = accepted_rec(&mut conn, ORG_A, DEBTOR_A);
    seed_local_connector(&conn, ORG_A, "lc-6i-a3");
    let attempt_id = begin_ok(&mut conn, ORG_A, DEBTOR_A, &rec1);
    let snap_before = attempt_snap_len(&conn, &attempt_id);
    assert!(snap_before > 0);

    // Supersede rec1 with a fresh pending recommendation.
    let rec2 = insert_pending(&mut conn, ORG_A, DEBTOR_A, AI_CODE, USER, &ai_outcome(), now())
        .expect("insert rec2")
        .id;
    assert_eq!(rec_status(&conn, ORG_A, &rec1), "REJECTED");
    assert_ne!(rec1, rec2);

    // Recovery: attempt flips, rec1 stays REJECTED (superseded).
    let n = recover_at_startup(&mut conn, now()).expect("recover");
    assert_eq!(n, 1);

    assert_eq!(attempt_state(&conn, &attempt_id), "UNCERTAIN");
    assert_eq!(
        rec_status(&conn, ORG_A, &rec1),
        "REJECTED",
        "superseded rec must stay REJECTED"
    );
    // 12.4: snapshot retained.
    assert_eq!(attempt_snap_len(&conn, &attempt_id), snap_before);
}

// -----------------------------------------------------------------
// Row 12.6: confirm_delivered after recovery writes comm from snapshot
// -----------------------------------------------------------------

#[test]
fn confirm_after_recovery_uses_snapshot() {
    let mut conn = open_in_memory_for_tests().expect("open");

    let rec = accepted_rec(&mut conn, ORG_A, DEBTOR_A);
    seed_local_connector(&conn, ORG_A, "lc-6i-a4");
    let attempt_id = begin_ok(&mut conn, ORG_A, DEBTOR_A, &rec);

    recover_at_startup(&mut conn, now()).expect("recover");
    assert_eq!(attempt_state(&conn, &attempt_id), "UNCERTAIN");

    // Read snapshot content before confirm.
    let snap_bytes = read_snapshot(&conn, ORG_A, &attempt_id).expect("read snapshot");
    let snap = SendAttemptSnapshot::from_json(&snap_bytes).expect("parse");
    let expected_body = snap.final_body.clone();

    let comm_id = confirm_delivered(&mut conn, ORG_A, &attempt_id, USER, now())
        .expect("confirm_delivered");
    assert!(!comm_id.is_empty());

    let comm_body: String = conn
        .query_row(
            "SELECT content FROM communications WHERE id = ?1",
            params![comm_id],
            |r| r.get(0),
        )
        .expect("read comm");
    assert_eq!(comm_body, expected_body, "comm body must come from snapshot");

    // Attempt now CONFIRMED_SUCCESS, snapshot NULL.
    assert_eq!(attempt_state(&conn, &attempt_id), "CONFIRMED_SUCCESS");
    assert_eq!(attempt_snap_len(&conn, &attempt_id), 0);
}