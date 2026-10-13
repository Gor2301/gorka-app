// shared/tests/slice5_recommendation_store.rs
//
// Slice 5a integration tests — public API surface only.
//
// Authority: SLICE 5a — MINI SPEC v1.2 (FINAL DRAFT), §9.1.
//
// Class B (pub(crate)) tests live in recommendation_store.rs's in-module
// #[cfg(test)] mod tests. They cannot be reached from this integration
// crate.
//
// Deviation from §9.1 test 13: the spec reads "Add a debt in a non-primary
// currency -> hash unchanged." That test cannot pass: the snapshot's
// debt_status_counts is unfiltered by currency, so adding any debt changes
// the map. The test below asserts the correct behavior — any debt addition
// changes the hash.

use chrono::{DateTime, Utc};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::recommendation::{Channel, Priority, Recommendation, Timing, Tone};
use gorka_shared::recommendation_store::{
    check_freshness, compute_snapshot_hash, get, insert_pending, list_for_debtor,
    mark_accepted, mark_rejected, RecommendationStatus, StoreError,
    EXPIRATION_WINDOW_HOURS,
};
use gorka_shared::strategy::{StrategyOutcome, StrategySource};
use rusqlite::params;

const ORG_ID: &str = "org-s5a";
const OTHER_ORG_ID: &str = "org-s5a-other";
const DEBTOR_ID: &str = "debtor-s5a-1";
const OTHER_DEBTOR_ID: &str = "debtor-s5a-2";
const AI_CODE: &str = "gemini-ai";
const USER_ID: &str = "user-s5a";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-13T12:00:00Z")
        .expect("parse")
        .with_timezone(&Utc)
}

fn seed_debtor(conn: &rusqlite::Connection) {
    seed_debtor_with(conn, DEBTOR_ID, ORG_ID, "{}", false);
}

fn seed_debtor_with(
    conn: &rusqlite::Connection,
    debtor_id: &str,
    org_id: &str,
    data: &str,
    deleted: bool,
) {
    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone,
                              data, deleted, created_at, updated_at)
         VALUES (?1, ?2, 'ZZZTest', 'ZZZSur', 'z@example.invalid',
                 '+10000000000', ?3, ?4,
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![
            debtor_id,
            org_id,
            data,
            if deleted { "true" } else { "false" }
        ],
    )
    .expect("seed debtor");
}

fn seed_debt(
    conn: &rusqlite::Connection,
    id: &str,
    debtor_id: &str,
    amount: f64,
    currency: &str,
    status: &str,
) {
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, debtor_id, amount, currency, status],
    )
    .expect("seed debt");
}

fn seed_comm(conn: &rusqlite::Connection, id: &str, debtor_id: &str) {
    conn.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content,
                                     duration, created_by, data, created_at)
         VALUES (?1, ?2, 'NOTE', 'OUTBOUND', NULL, NULL, NULL, '{}',
                 '2026-09-01T00:00:00Z')",
        params![id, debtor_id],
    )
    .expect("seed comm");
}

fn ai_outcome() -> StrategyOutcome {
    StrategyOutcome {
        source: StrategySource::Ai,
        recommendation: Recommendation {
            channel: Channel::Email,
            priority: Priority::High,
            tone: Tone::Urgent,
            timing: Timing::Within3Days,
        },
        draft_subject: Some("Payment reminder".to_string()),
        draft_body: "Please arrange payment.".to_string(),
        rationale: Some("AI explanation \u{2014} unverified: reason".to_string()),
        risk_flags: vec!["flag-one".to_string(), "flag-two".to_string()],
        prompt_version: "slice4-v1",
    }
}

fn fallback_outcome() -> StrategyOutcome {
    StrategyOutcome {
        source: StrategySource::Fallback,
        recommendation: Recommendation {
            channel: Channel::Email,
            priority: Priority::Normal,
            tone: Tone::Friendly,
            timing: Timing::Within3Days,
        },
        draft_subject: None,
        draft_body: String::new(),
        rationale: None,
        risk_flags: Vec::new(),
        prompt_version: "slice4-v1",
    }
}

fn insert_one(conn: &mut rusqlite::Connection) -> String {
    seed_debtor(conn);
    insert_pending(
        conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert")
    .id
}

fn is_lowercase_hex_64(s: &str) -> bool {
    s.len() == 64
        && s.chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

// ---------------------------------------------------------------------
// Persistence and round-trip
// ---------------------------------------------------------------------

#[test]
fn insert_pending_round_trips_all_fields() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert");

    assert_eq!(row.organization_id, ORG_ID);
    assert_eq!(row.debtor_id, DEBTOR_ID);
    assert_eq!(row.ai_connector_code, AI_CODE);
    assert_eq!(row.created_by, USER_ID);
    assert_eq!(row.status, RecommendationStatus::Pending);
    assert!(row.decided_at.is_none());
    assert!(row.superseded_by.is_none());

    let loaded = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(loaded, row);
}

#[test]
fn fallback_source_has_no_rationale_and_empty_risk_flags() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID,
        &fallback_outcome(), now(),
    )
    .expect("insert");

    assert_eq!(row.source, StrategySource::Fallback);
    assert!(row.rationale.is_none());
    assert!(row.risk_flags.is_empty());
}

#[test]
fn ai_source_preserves_rationale_and_risk_flags() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert");

    assert_eq!(row.source, StrategySource::Ai);
    assert!(row.rationale.is_some());
    assert_eq!(row.risk_flags.len(), 2);
    assert_eq!(row.risk_flags[0], "flag-one");
}

#[test]
fn insert_pending_on_fresh_debtor_with_no_debts_succeeds() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert");
    assert!(!row.snapshot_hash.is_empty());
}

#[test]
fn prompt_version_round_trips_verbatim() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert");
    assert_eq!(row.prompt_version, "slice4-v1");
}

#[test]
fn created_by_round_trips_verbatim() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, "user-abc",
        &ai_outcome(), now(),
    )
    .expect("insert");
    assert_eq!(row.created_by, "user-abc");
}

// ---------------------------------------------------------------------
// Snapshot hash
// ---------------------------------------------------------------------

#[test]
fn snapshot_hash_is_64_char_lowercase_hex() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("hash");
    assert!(is_lowercase_hex_64(&h), "hash = {}", h);
}

#[test]
fn snapshot_hash_is_stable_across_calls() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_eq!(h1, h2);
}

#[test]
fn snapshot_hash_changes_when_debt_amount_changes() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", DEBTOR_ID, 500.0, "USD", "ACTIVE");
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    conn.execute("UPDATE debts SET amount = 600.0 WHERE id = 'd1'", [])
        .expect("update");
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_ne!(h1, h2);
}

#[test]
fn snapshot_hash_changes_when_debt_status_changes() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", DEBTOR_ID, 500.0, "USD", "ACTIVE");
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    conn.execute("UPDATE debts SET status = 'PAID' WHERE id = 'd1'", [])
        .expect("update");
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_ne!(h1, h2);
}

#[test]
fn snapshot_hash_changes_when_communication_added() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    seed_comm(&conn, "c1", DEBTOR_ID);
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_ne!(h1, h2);
}

#[test]
fn snapshot_hash_changes_when_opt_out_flips() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "{}", false);
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    conn.execute(
        "UPDATE debtors SET data = '{\"opt_out\":{\"email\":true}}' WHERE id = ?1",
        params![DEBTOR_ID],
    )
    .expect("update");
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_ne!(h1, h2);
}

#[test]
fn snapshot_hash_changes_when_any_debt_added() {
    // Deviation from §9.1 test 13. See file header.
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", DEBTOR_ID, 500.0, "USD", "ACTIVE");
    let h1 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h1");
    seed_debt(&conn, "d2", DEBTOR_ID, 100.0, "EUR", "ACTIVE");
    let h2 = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h2");
    assert_ne!(h1, h2);
}

#[test]
fn snapshot_hash_rejects_overflow_amount() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", DEBTOR_ID, 1.0e13, "USD", "ACTIVE");
    let err = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).unwrap_err();
    match err {
        StoreError::DbError(msg) => {
            assert_eq!(msg, "debt amount outside supported range");
            assert!(!msg.contains("10000000000000"));
            assert!(!msg.contains("1e13"));
        }
        other => panic!("expected DbError, got {:?}", other),
    }
}

#[test]
fn snapshot_hash_malformed_data_not_json() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "not json", false);
    let h_malformed = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h_malformed");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h_malformed, h_valid);
}

#[test]
fn snapshot_hash_malformed_data_top_level_array() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "[]", false);
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h, h_valid);
}

#[test]
fn snapshot_hash_malformed_opt_out_not_object() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, r#"{"opt_out":"yes"}"#, false);
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h, h_valid);
}

#[test]
fn snapshot_hash_malformed_known_key_null() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(
        &conn, DEBTOR_ID, ORG_ID, r#"{"opt_out":{"email":null}}"#, false,
    );
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h, h_valid);
}

#[test]
fn snapshot_hash_malformed_known_key_string() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(
        &conn, DEBTOR_ID, ORG_ID, r#"{"opt_out":{"email":"true"}}"#, false,
    );
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h, h_valid);
}

#[test]
fn snapshot_hash_unknown_boolean_key_is_ignored() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(
        &conn, DEBTOR_ID, ORG_ID,
        r#"{"opt_out":{"email":true,"unknown_boolean":true}}"#,
        false,
    );
    let h_ignored = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h_ignored");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(
        &conn2, DEBTOR_ID, ORG_ID, r#"{"opt_out":{"email":true}}"#, false,
    );
    let h_simple = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_simple");

    assert_eq!(h_ignored, h_simple);
}

#[test]
fn snapshot_hash_unknown_non_boolean_key_is_malformed() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(
        &conn, DEBTOR_ID, ORG_ID,
        r#"{"opt_out":{"unknown_non_boolean":0}}"#,
        false,
    );
    let h = compute_snapshot_hash(&conn, ORG_ID, DEBTOR_ID).expect("h");

    let conn2 = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn2, DEBTOR_ID, ORG_ID, "{}", false);
    let h_valid = compute_snapshot_hash(&conn2, ORG_ID, DEBTOR_ID).expect("h_valid");

    assert_ne!(h, h_valid);
}

// ---------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------

#[test]
fn insert_pending_rejects_mismatched_org() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "{}", false);
    let err = insert_pending(
        &mut conn, OTHER_ORG_ID, DEBTOR_ID, AI_CODE, USER_ID,
        &ai_outcome(), now(),
    )
    .unwrap_err();
    assert!(matches!(err, StoreError::NotFound));

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM recommendations", [], |r| r.get(0))
        .expect("count");
    assert_eq!(count, 0);
}

#[test]
fn compute_snapshot_hash_rejects_mismatched_org() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "{}", false);
    let err = compute_snapshot_hash(&conn, OTHER_ORG_ID, DEBTOR_ID).unwrap_err();
    assert!(matches!(err, StoreError::NotFound));
}

#[test]
fn insert_pending_rejects_deleted_debtor() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "{}", true);
    let err = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .unwrap_err();
    assert!(matches!(err, StoreError::NotFound));
}

// ---------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------

#[test]
fn mark_accepted_pending_to_accepted() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    mark_accepted(&mut conn, ORG_ID, &id, now()).expect("accept");
    let row = get(&conn, ORG_ID, &id).expect("get");
    assert_eq!(row.status, RecommendationStatus::Accepted);
    assert!(row.decided_at.is_some());
}

#[test]
fn mark_accepted_on_accepted_row_is_wrong_status() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    mark_accepted(&mut conn, ORG_ID, &id, now()).expect("accept");
    let err = mark_accepted(&mut conn, ORG_ID, &id, now()).unwrap_err();
    match err {
        StoreError::WrongStatus { current, expected } => {
            assert_eq!(current, RecommendationStatus::Accepted);
            assert_eq!(expected, RecommendationStatus::Pending);
        }
        other => panic!("expected WrongStatus, got {:?}", other),
    }
}

#[test]
fn mark_rejected_pending_to_rejected() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    mark_rejected(&mut conn, ORG_ID, &id, now()).expect("reject");
    let row = get(&conn, ORG_ID, &id).expect("get");
    assert_eq!(row.status, RecommendationStatus::Rejected);
}

#[test]
fn mark_rejected_on_accepted_row_is_wrong_status() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    mark_accepted(&mut conn, ORG_ID, &id, now()).expect("accept");
    let err = mark_rejected(&mut conn, ORG_ID, &id, now()).unwrap_err();
    assert!(matches!(err, StoreError::WrongStatus { .. }));
}

#[test]
fn class_a_transitions_refuse_superseded_row() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let first = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("first");
    let second = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("second");

    let err = mark_accepted(&mut conn, ORG_ID, &first.id, now()).unwrap_err();
    match err {
        StoreError::Superseded(id) => assert_eq!(id, second.id),
        other => panic!("expected Superseded, got {:?}", other),
    }

    let err = mark_rejected(&mut conn, ORG_ID, &first.id, now()).unwrap_err();
    assert!(matches!(err, StoreError::Superseded(_)));
}

#[test]
fn transitions_wrong_org_return_not_found() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    assert!(matches!(
        mark_accepted(&mut conn, OTHER_ORG_ID, &id, now()).unwrap_err(),
        StoreError::NotFound
    ));
    assert!(matches!(
        mark_rejected(&mut conn, OTHER_ORG_ID, &id, now()).unwrap_err(),
        StoreError::NotFound
    ));
}

#[test]
fn mark_rejected_happy_path_no_send_attempts_table_probe() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    // The send_attempts table does not exist. mark_rejected must succeed
    // without probing for it. Slice 5a's mark_rejected is PENDING-only.
    mark_rejected(&mut conn, ORG_ID, &id, now()).expect("reject");
    let row = get(&conn, ORG_ID, &id).expect("get");
    assert_eq!(row.status, RecommendationStatus::Rejected);
}

// ---------------------------------------------------------------------
// Supersession
// ---------------------------------------------------------------------

#[test]
fn insert_pending_supersedes_prior_pending() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let first = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("first");
    let second = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("second");

    let first_after = get(&conn, ORG_ID, &first.id).expect("get first");
    assert_eq!(first_after.status, RecommendationStatus::Rejected);
    assert_eq!(first_after.superseded_by.as_deref(), Some(second.id.as_str()));

    let second_after = get(&conn, ORG_ID, &second.id).expect("get second");
    assert_eq!(second_after.status, RecommendationStatus::Pending);
    assert!(second_after.superseded_by.is_none());
}

#[test]
fn insert_pending_supersedes_prior_accepted() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let first = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("first");
    mark_accepted(&mut conn, ORG_ID, &first.id, now()).expect("accept");

    let second = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("second");

    let first_after = get(&conn, ORG_ID, &first.id).expect("get");
    assert_eq!(first_after.status, RecommendationStatus::Rejected);
    assert_eq!(first_after.superseded_by.as_deref(), Some(second.id.as_str()));
}

#[test]
fn insert_pending_does_not_supersede_rejected() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let first = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("first");
    mark_rejected(&mut conn, ORG_ID, &first.id, now()).expect("reject");

    let _second = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("second");

    let first_after = get(&conn, ORG_ID, &first.id).expect("get");
    assert_eq!(first_after.status, RecommendationStatus::Rejected);
    assert!(first_after.superseded_by.is_none());
}

#[test]
fn insert_pending_for_other_debtor_does_not_supersede() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor_with(&conn, DEBTOR_ID, ORG_ID, "{}", false);
    seed_debtor_with(&conn, OTHER_DEBTOR_ID, ORG_ID, "{}", false);

    let first = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("first");
    let _second = insert_pending(
        &mut conn, ORG_ID, OTHER_DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("second");

    let first_after = get(&conn, ORG_ID, &first.id).expect("get");
    assert_eq!(first_after.status, RecommendationStatus::Pending);
    assert!(first_after.superseded_by.is_none());
}

// ---------------------------------------------------------------------
// Freshness
// ---------------------------------------------------------------------

#[test]
fn check_freshness_passes_on_unchanged_state() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    check_freshness(&mut conn, ORG_ID, &id, now()).expect("fresh");
    let row = get(&conn, ORG_ID, &id).expect("get");
    assert_eq!(row.status, RecommendationStatus::Pending);
}

#[test]
fn check_freshness_expires_on_amount_change() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", DEBTOR_ID, 500.0, "USD", "ACTIVE");
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
    )
    .expect("insert");

    conn.execute("UPDATE debts SET amount = 600.0 WHERE id = 'd1'", [])
        .expect("update");

    let err = check_freshness(&mut conn, ORG_ID, &row.id, now()).unwrap_err();
    assert!(matches!(err, StoreError::Expired));

    let after = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(after.status, RecommendationStatus::Expired);
}

#[test]
fn check_freshness_boundary_just_before_72h() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let created = now();
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), created,
    )
    .expect("insert");

    let at = created
        + chrono::Duration::hours(EXPIRATION_WINDOW_HOURS)
        - chrono::Duration::seconds(1);
    check_freshness(&mut conn, ORG_ID, &row.id, at).expect("not expired yet");
    let after = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(after.status, RecommendationStatus::Pending);
}

#[test]
fn check_freshness_boundary_exactly_72h() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let created = now();
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), created,
    )
    .expect("insert");

    let at = created + chrono::Duration::hours(EXPIRATION_WINDOW_HOURS);
    check_freshness(&mut conn, ORG_ID, &row.id, at).expect("boundary is not expired");
    let after = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(after.status, RecommendationStatus::Pending);
}

#[test]
fn check_freshness_boundary_just_after_72h() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let created = now();
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), created,
    )
    .expect("insert");

    let at = created
        + chrono::Duration::hours(EXPIRATION_WINDOW_HOURS)
        + chrono::Duration::seconds(1);
    let err = check_freshness(&mut conn, ORG_ID, &row.id, at).unwrap_err();
    assert!(matches!(err, StoreError::Expired));
    let after = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(after.status, RecommendationStatus::Expired);
}

#[test]
fn check_freshness_on_already_expired_row() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let created = now();
    let row = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), created,
    )
    .expect("insert");

    let at = created
        + chrono::Duration::hours(EXPIRATION_WINDOW_HOURS)
        + chrono::Duration::seconds(1);
    let _ = check_freshness(&mut conn, ORG_ID, &row.id, at).unwrap_err();

    let err = check_freshness(&mut conn, ORG_ID, &row.id, at).unwrap_err();
    assert!(matches!(err, StoreError::Expired));
    let after = get(&conn, ORG_ID, &row.id).expect("get");
    assert_eq!(after.status, RecommendationStatus::Expired);
}

// ---------------------------------------------------------------------
// Scoping, listing, constraints
// ---------------------------------------------------------------------

#[test]
fn get_wrong_org_returns_not_found() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let id = insert_one(&mut conn);
    let err = get(&conn, OTHER_ORG_ID, &id).unwrap_err();
    assert!(matches!(err, StoreError::NotFound));
}

#[test]
fn deleting_debtor_cascades_recommendations() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let _id = insert_one(&mut conn);
    conn.execute("PRAGMA foreign_keys = ON", []).expect("pragma");
    conn.execute("DELETE FROM debtors WHERE id = ?1", params![DEBTOR_ID])
        .expect("delete");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM recommendations", [], |r| r.get(0))
        .expect("count");
    assert_eq!(count, 0);
}

#[test]
fn list_for_debtor_limit_zero_returns_empty() {
    let mut conn = open_in_memory_for_tests().expect("db");
    let _id = insert_one(&mut conn);
    let rows = list_for_debtor(&conn, ORG_ID, DEBTOR_ID, 0).expect("list");
    assert!(rows.is_empty());
}

#[test]
fn list_for_debtor_returns_all_inserted_rows() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let t = now();
    let a = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), t,
    )
    .expect("a");
    let b = insert_pending(
        &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), t,
    )
    .expect("b");
    let rows = list_for_debtor(&conn, ORG_ID, DEBTOR_ID, 10).expect("list");
    assert_eq!(rows.len(), 2);
    let ids: Vec<&str> = rows.iter().map(|r| r.id.as_str()).collect();
    assert!(ids.contains(&a.id.as_str()));
    assert!(ids.contains(&b.id.as_str()));
}

#[test]
fn list_for_debtor_clamps_high_limit_to_200() {
    let mut conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    // 205 inserts. Each supersedes the prior; all rows are retained as
    // REJECTED except the last, which is PENDING. Total row count is 205.
    for _ in 0..205 {
        let _ = insert_pending(
            &mut conn, ORG_ID, DEBTOR_ID, AI_CODE, USER_ID, &ai_outcome(), now(),
        )
        .expect("insert");
    }
    let rows = list_for_debtor(&conn, ORG_ID, DEBTOR_ID, 10_000).expect("list");
    assert_eq!(rows.len(), 200);
}