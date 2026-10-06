// shared/tests/connector_tables.rs
//
// Asserts that migration 9 created the four connector and
// compliance tables specified in LOCAL-TABLES.md B.1, B.2, B.3, F.1.
// Uses the in-memory test DB helper from db.rs.

use gorka_shared::db::open_in_memory_for_tests;
use rusqlite::Connection;

fn table_exists(conn: &Connection, name: &str) -> bool {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
            [name],
            |row| row.get(0),
        )
        .unwrap();
    count > 0
}

fn index_exists(conn: &Connection, name: &str) -> bool {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?1",
            [name],
            |row| row.get(0),
        )
        .unwrap();
    count > 0
}

#[test]
fn migration_9_creates_all_four_tables() {
    let conn = open_in_memory_for_tests().unwrap();
    assert!(table_exists(&conn, "local_connectors"));
    assert!(table_exists(&conn, "local_connector_usage"));
    assert!(table_exists(&conn, "connector_sync_state"));
    assert!(table_exists(&conn, "compliance_rules"));
}

#[test]
fn migration_9_creates_local_connectors_indexes() {
    let conn = open_in_memory_for_tests().unwrap();
    assert!(index_exists(&conn, "idx_local_connectors_org_code"));
    assert!(index_exists(&conn, "idx_local_connectors_status"));
}

#[test]
fn compliance_rules_enforces_single_row() {
    let conn = open_in_memory_for_tests().unwrap();
    conn.execute(
        "INSERT INTO compliance_rules (id, organization_id, updated_at)
         VALUES (1, 'org-1', '2026-10-07T00:00:00Z')",
        [],
    ).unwrap();
    // A second row with any id other than 1 is rejected by the CHECK.
    let result = conn.execute(
        "INSERT INTO compliance_rules (id, organization_id, updated_at)
         VALUES (2, 'org-1', '2026-10-07T00:00:00Z')",
        [],
    );
    assert!(result.is_err());
}

#[test]
fn local_connectors_accepts_a_row() {
    let conn = open_in_memory_for_tests().unwrap();
    conn.execute(
        "INSERT INTO local_connectors
         (id, connector_code, organization_id, tier, status,
          credential_value, configuration, source_device_id,
          created_at, updated_at)
         VALUES
         ('c1', 'resend-email', 'org-1', 'TIER2', 'ENABLED',
          X'00', '{}', 'dev-1',
          '2026-10-07T00:00:00Z', '2026-10-07T00:00:00Z')",
        [],
    ).unwrap();
}