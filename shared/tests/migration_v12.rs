// shared/tests/migration_v12.rs
//
// Tests for migration v12 (SLICE 5b): send_reservations, send_attempts,
// communications.connector_code, communications.send_attempt_id,
// idx_communications_send_attempt.
//
// These tests run against in-memory SQLite (not SQLCipher). The
// migration block is identical; SQLCipher-backed verification is a
// separate manual procedure.
//
// The forced-failure-after-first-ALTER rollback case from SLICE 5b
// MINI SPEC v1.0 §12.1 is not exercised here: rusqlite does not
// expose a fault-injection seam at the statement level, and a
// hand-constructed failure would test the test harness, not the
// migration. It is recorded in §12.2 as a code-inspection item.

use gorka_shared::db::{open_in_memory_for_tests, run_migrations_for_tests};
use rusqlite::Connection;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

fn user_version(conn: &Connection) -> i32 {
    conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap()
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table)).unwrap();
    let cols: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    cols.iter().any(|c| c == column)
}

fn table_exists(conn: &Connection, table: &str) -> bool {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
            [table],
            |r| r.get(0),
        )
        .unwrap();
    count > 0
}

fn index_exists(conn: &Connection, index: &str) -> bool {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?1",
            [index],
            |r| r.get(0),
        )
        .unwrap();
    count > 0
}

fn communications_columns(conn: &Connection) -> Vec<String> {
    let mut stmt = conn.prepare("PRAGMA table_info(communications)").unwrap();
    stmt.query_map([], |r| r.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

/// Build a DB that has all v12 objects and columns present, but
/// user_version is reset to 11. Re-running migrations exercises the
/// column_exists_tx guard: without it, the two ALTER TABLE
/// statements on communications would fail with "duplicate column
/// name".
fn build_v11_with_v12_columns_already_present() -> Connection {
    let conn = open_in_memory_for_tests().unwrap();
    conn.execute("PRAGMA user_version = 11", []).unwrap();
    conn
}

fn apply_v12(conn: &mut Connection) -> Result<(), String> {
    run_migrations_for_tests(conn)
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

#[test]
fn v12_fresh_db_sets_user_version_to_12() {
    let conn = open_in_memory_for_tests().unwrap();
    assert_eq!(user_version(&conn), 12);
}

#[test]
fn v12_creates_send_reservations_table_with_expected_columns() {
    let conn = open_in_memory_for_tests().unwrap();
    assert!(table_exists(&conn, "send_reservations"));

    let expected = [
        "id",
        "organization_id",
        "debtor_id",
        "connector_code",
        "channel",
        "reserved_at",
        "released_at",
        "release_reason",
    ];
    let mut stmt = conn.prepare("PRAGMA table_info(send_reservations)").unwrap();
    let cols: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    for name in expected {
        assert!(cols.iter().any(|c| c == name), "missing column: {}", name);
    }
}

#[test]
fn v12_creates_send_attempts_table_with_expected_columns() {
    let conn = open_in_memory_for_tests().unwrap();
    assert!(table_exists(&conn, "send_attempts"));

    let expected = [
        "id",
        "recommendation_id",
        "reservation_id",
        "debtor_id",
        "organization_id",
        "connector_code",
        "attempted_at",
        "state",
        "finalized_at",
        "payload_snapshot",
    ];
    let mut stmt = conn.prepare("PRAGMA table_info(send_attempts)").unwrap();
    let cols: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    for name in expected {
        assert!(cols.iter().any(|c| c == name), "missing column: {}", name);
    }
}

#[test]
fn v12_creates_all_indexes() {
    let conn = open_in_memory_for_tests().unwrap();
    assert!(index_exists(&conn, "idx_send_reservations_window"));
    assert!(index_exists(&conn, "idx_send_reservations_active"));
    assert!(index_exists(&conn, "idx_send_attempts_state"));
    assert!(index_exists(&conn, "idx_send_attempts_recommendation"));
    assert!(index_exists(&conn, "idx_communications_send_attempt"));
}

#[test]
fn v12_adds_communications_columns() {
    let conn = open_in_memory_for_tests().unwrap();
    let cols = communications_columns(&conn);
    assert!(cols.iter().any(|c| c == "connector_code"));
    assert!(cols.iter().any(|c| c == "send_attempt_id"));
}

#[test]
fn v12_rerun_is_noop() {
    let mut conn = open_in_memory_for_tests().unwrap();
    assert_eq!(user_version(&conn), 12);

    // Re-run the full migration sequence. Version gate skips all
    // blocks; nothing should change and nothing should error.
    apply_v12(&mut conn).unwrap();

    assert_eq!(user_version(&conn), 12);
    assert!(table_exists(&conn, "send_reservations"));
    assert!(table_exists(&conn, "send_attempts"));
    let cols = communications_columns(&conn);
    assert!(cols.iter().any(|c| c == "connector_code"));
    assert!(cols.iter().any(|c| c == "send_attempt_id"));
}

#[test]
fn v12_skips_alter_when_columns_already_present() {
    // user_version is 11, but the v12 tables and columns are
    // already there (simulated by opening fresh and resetting the
    // version). The ALTER guard must skip both ADD COLUMN
    // statements. Without the guard, this test fails with
    // "duplicate column name: connector_code".
    let mut conn = build_v11_with_v12_columns_already_present();

    apply_v12(&mut conn).unwrap();

    assert_eq!(user_version(&conn), 12);
    let cols = communications_columns(&conn);
    assert!(cols.iter().any(|c| c == "connector_code"));
    assert!(cols.iter().any(|c| c == "send_attempt_id"));

    // Exactly one of each column — no duplicates from a double-ALTER.
    let connector_code_count = cols.iter().filter(|c| c.as_str() == "connector_code").count();
    let send_attempt_id_count = cols.iter().filter(|c| c.as_str() == "send_attempt_id").count();
    assert_eq!(connector_code_count, 1);
    assert_eq!(send_attempt_id_count, 1);
}

#[test]
fn v12_send_attempts_foreign_keys_reference_recommendations_and_reservations() {
    let conn = open_in_memory_for_tests().unwrap();
    let mut stmt = conn.prepare("PRAGMA foreign_key_list(send_attempts)").unwrap();
    // Columns: id, seq, table, from, to, on_update, on_delete, match
    let fks: Vec<(String, String, String)> = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(2)?, // table
                r.get::<_, String>(3)?, // from
                r.get::<_, String>(6)?, // on_delete
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let has_rec = fks
        .iter()
        .any(|(t, f, od)| t == "recommendations" && f == "recommendation_id" && od == "RESTRICT");
    let has_res = fks
        .iter()
        .any(|(t, f, od)| t == "send_reservations" && f == "reservation_id" && od == "RESTRICT");

    assert!(has_rec, "missing FK send_attempts.recommendation_id -> recommendations (RESTRICT)");
    assert!(has_res, "missing FK send_attempts.reservation_id -> send_reservations (RESTRICT)");
}