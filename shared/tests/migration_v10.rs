// shared/tests/migration_v10.rs
//
// Tests MT1-MT9, MT11, MT12 from CONNECTOR-EVENT-ORDER-SPEC v1.0 §5.6.
// MT10 is a manual procedure documented in §9.4; not automatable here.
//
// These tests run against in-memory SQLite (not SQLCipher). The
// migration block is identical; SQLCipher-backed verification is a
// separate manual procedure.

use gorka_shared::db::{open_in_memory_for_tests, run_migrations_for_tests};
use gorka_shared::recover::{
    inspect, plan_for_row, repair_apply, RepairPlan, RecoverError,
};
use rusqlite::{params, Connection};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/// Build a v9-shaped DB. We run all migrations, then remove the
/// three v10 columns and reset user_version. This simulates a
/// device that was on v9 before the v10 block existed.
fn build_v9_db() -> Connection {
    let conn = open_in_memory_for_tests().unwrap();
    conn.execute("ALTER TABLE local_connectors DROP COLUMN winning_logical_clock", []).unwrap();
    conn.execute("ALTER TABLE local_connectors DROP COLUMN winning_device_id", []).unwrap();
    conn.execute("ALTER TABLE local_connectors DROP COLUMN winning_sequence", []).unwrap();
    conn.execute("PRAGMA user_version = 9", []).unwrap();
    conn
}

fn apply_v10(conn: &mut Connection) -> Result<(), String> {
    run_migrations_for_tests(conn)
}

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

fn insert_connector(
    conn: &Connection,
    id: &str, code: &str, org: &str, status: &str, tier: &str,
) {
    conn.execute(
        "INSERT INTO local_connectors
         (id, connector_code, organization_id, tier, status,
          credential_value, configuration, source_device_id,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, X'AA', '{}', 'dev-test',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, code, org, tier, status],
    ).unwrap();
}

fn insert_event(
    conn: &Connection,
    id: &str, org: &str, code: &str,
    event_type: &str, logical_clock: i64, seq: i64,
    device_id_hex: &str,
    payload: &[u8],
) {
    let sql = format!(
        "INSERT INTO sync_events
         (id, organization_id, device_id, event_type, entity_type,
          entity_id, payload, sequence, logical_clock,
          created_at, local_received_at)
         VALUES (?1, ?2, X'{}', ?3, 'connector', ?4, ?5, ?6, ?7,
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        device_id_hex
    );
    conn.execute(&sql, params![id, org, event_type, code, payload, seq, logical_clock]).unwrap();
}

// --- TLV helpers. Match the format the sync_parse reader expects. ---

fn push_str_tlv(out: &mut Vec<u8>, code: u16, s: &str) {
    let bytes = s.as_bytes();
    let n = bytes.len() as u32;
    out.extend_from_slice(&code.to_be_bytes());
    out.extend_from_slice(&(n + 4).to_be_bytes());
    out.extend_from_slice(&n.to_be_bytes());
    out.extend_from_slice(bytes);
}

fn push_bytes_tlv(out: &mut Vec<u8>, code: u16, b: &[u8]) {
    let n = b.len() as u32;
    out.extend_from_slice(&code.to_be_bytes());
    out.extend_from_slice(&(n + 4).to_be_bytes());
    out.extend_from_slice(&n.to_be_bytes());
    out.extend_from_slice(b);
}

fn push_u64_tlv(out: &mut Vec<u8>, code: u16, v: u64) {
    out.extend_from_slice(&code.to_be_bytes());
    out.extend_from_slice(&8u32.to_be_bytes());
    out.extend_from_slice(&v.to_be_bytes());
}

fn payload_enabled(code: &str, tier: &str, cred: &[u8], config: &str) -> Vec<u8> {
    let mut out = Vec::new();
    push_str_tlv(&mut out, 0x6001, code);
    push_str_tlv(&mut out, 0x6002, tier);
    push_bytes_tlv(&mut out, 0x6003, cred);
    push_str_tlv(&mut out, 0x6004, config);
    push_u64_tlv(&mut out, 0x6005, 1_700_000_000_000);
    out
}

fn payload_disabled(code: &str) -> Vec<u8> {
    let mut out = Vec::new();
    push_str_tlv(&mut out, 0x6001, code);
    push_u64_tlv(&mut out, 0x6006, 1_700_000_000_000);
    out
}

// ---------------------------------------------------------------
// MT1 - fresh DB gets v10
// ---------------------------------------------------------------

#[test]
fn mt1_fresh_db_gets_v10() {
    let conn = open_in_memory_for_tests().unwrap();
    assert_eq!(user_version(&conn), 10);
    assert!(column_exists(&conn, "local_connectors", "winning_logical_clock"));
    assert!(column_exists(&conn, "local_connectors", "winning_device_id"));
    assert!(column_exists(&conn, "local_connectors", "winning_sequence"));
}

// ---------------------------------------------------------------
// MT2 - existing v9, all rows matched, migration succeeds
// ---------------------------------------------------------------

#[test]
fn mt2_v9_to_v10_backfill_matches_protocol_latest() {
    let mut conn = build_v9_db();
    insert_connector(&conn, "r1", "resend-email", "org-A", "ENABLED", "TIER1");
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00000000000000000000000000000001",
        &payload_enabled("resend-email", "TIER1", &[0xAA], "{}"),
    );
    apply_v10(&mut conn).unwrap();

    assert_eq!(user_version(&conn), 10);
    let (clock, seq, dev): (i64, i64, Vec<u8>) = conn.query_row(
        "SELECT winning_logical_clock, winning_sequence, winning_device_id
         FROM local_connectors WHERE id='r1'",
        [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();
    assert_eq!(clock, 100);
    assert_eq!(seq, 10);
    let mut expected = vec![0u8; 16];
    expected[15] = 1;
    assert_eq!(dev, expected);
}

// ---------------------------------------------------------------
// MT3 - one unmatched row, migration fails at Check 1, rolls back
// ---------------------------------------------------------------

#[test]
fn mt3_unmatched_row_rolls_back() {
    let mut conn = build_v9_db();
    insert_connector(&conn, "r1", "resend-email", "org-A", "ENABLED", "TIER1");
    // No matching sync_event inserted.

    let err = apply_v10(&mut conn).unwrap_err();
    assert!(err.contains("no matching event"), "unexpected error: {}", err);
    assert_eq!(user_version(&conn), 9);
    assert!(!column_exists(&conn, "local_connectors", "winning_logical_clock"));
    assert!(!column_exists(&conn, "local_connectors", "winning_device_id"));
    assert!(!column_exists(&conn, "local_connectors", "winning_sequence"));
}

// ---------------------------------------------------------------
// MT4 - rerun is idempotent
// ---------------------------------------------------------------

#[test]
fn mt4_rerun_is_idempotent() {
    let mut conn = build_v9_db();
    insert_connector(&conn, "r1", "resend-email", "org-A", "ENABLED", "TIER1");
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00000000000000000000000000000001",
        &payload_enabled("resend-email", "TIER1", &[0xAA], "{}"),
    );
    apply_v10(&mut conn).unwrap();

    let t1: (i64, i64, Vec<u8>) = conn.query_row(
        "SELECT winning_logical_clock, winning_sequence, winning_device_id
         FROM local_connectors WHERE id='r1'",
        [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();

    apply_v10(&mut conn).unwrap();

    let t2: (i64, i64, Vec<u8>) = conn.query_row(
        "SELECT winning_logical_clock, winning_sequence, winning_device_id
         FROM local_connectors WHERE id='r1'",
        [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();

    assert_eq!(t1, t2);
    assert_eq!(user_version(&conn), 10);
}

// ---------------------------------------------------------------
// MT5 - equal clock, different devices; byte-level comparator
// ---------------------------------------------------------------

#[test]
fn mt5_equal_clock_different_devices_byte_level_winner() {
    let mut conn = build_v9_db();
    insert_connector(&conn, "r1", "resend-email", "org-A", "ENABLED", "TIER1");
    // Same clock, same sequence. Device A ends 01, device B ends 02.
    insert_event(
        &conn, "eA", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 5, "00000000000000000000000000000001",
        &payload_enabled("resend-email", "TIER1", &[0xAA], "{}"),
    );
    insert_event(
        &conn, "eB", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 5, "00000000000000000000000000000002",
        &payload_enabled("resend-email", "TIER1", &[0xBB], "{}"),
    );
    apply_v10(&mut conn).unwrap();

    let dev: Vec<u8> = conn.query_row(
        "SELECT winning_device_id FROM local_connectors WHERE id='r1'",
        [], |r| r.get(0),
    ).unwrap();
    assert_eq!(dev.last().copied(), Some(2), "device B (...02) wins");
}

// ---------------------------------------------------------------
// MT6 - SQLite BLOB ordering matches Rust byte comparison
// ---------------------------------------------------------------

#[test]
fn mt6_sqlite_blob_order_matches_rust() {
    let conn = open_in_memory_for_tests().unwrap();
    conn.execute(
        "INSERT INTO sync_events
         (id, organization_id, device_id, event_type, entity_type, entity_id,
          payload, sequence, logical_clock, created_at, local_received_at)
         VALUES ('x', 'org', X'01', 'CONNECTOR_ENABLED', 'connector', 'c',
                 X'00', 1, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    ).unwrap();
    conn.execute(
        "INSERT INTO sync_events
         (id, organization_id, device_id, event_type, entity_type, entity_id,
          payload, sequence, logical_clock, created_at, local_received_at)
         VALUES ('y', 'org', X'02', 'CONNECTOR_ENABLED', 'connector', 'c',
                 X'00', 1, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    ).unwrap();

    let sql_max: Vec<u8> = conn.query_row(
        "SELECT device_id FROM sync_events WHERE organization_id='org'
         ORDER BY logical_clock DESC, device_id DESC, sequence DESC LIMIT 1",
        [], |r| r.get(0),
    ).unwrap();

    let rust_max: Vec<u8> = vec![2];
    assert_eq!(sql_max, rust_max);
}

// ---------------------------------------------------------------
// MT7 - status mismatch, migration fails at Check 2, rolls back
// ---------------------------------------------------------------

#[test]
fn mt7_status_mismatch_rolls_back() {
    let mut conn = build_v9_db();
    // Row says DISABLED, but the latest event is CONNECTOR_ENABLED.
    insert_connector(&conn, "r1", "resend-email", "org-A", "DISABLED", "");
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00000000000000000000000000000001",
        &payload_enabled("resend-email", "TIER1", &[0xAA], "{}"),
    );

    let err = apply_v10(&mut conn).unwrap_err();
    assert!(err.contains("status inconsistent"), "unexpected error: {}", err);
    assert_eq!(user_version(&conn), 9);
    assert!(!column_exists(&conn, "local_connectors", "winning_logical_clock"));
}

// ---------------------------------------------------------------
// MT8 - status-consistent but tier/config disagree; migration
// succeeds because Check 2 inspects only status.
// ---------------------------------------------------------------

#[test]
fn mt8_status_only_check_succeeds_on_content_mismatch() {
    let mut conn = build_v9_db();
    // Row says TIER2, event payload declares TIER1. Status matches.
    insert_connector(&conn, "r1", "resend-email", "org-A", "ENABLED", "TIER2");
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00000000000000000000000000000001",
        &payload_enabled("resend-email", "TIER1", &[0xAA], "{}"),
    );

    apply_v10(&mut conn).unwrap();
    assert_eq!(user_version(&conn), 10);

    // Row's tier is unchanged; only winning_* was written.
    let tier: String = conn.query_row(
        "SELECT tier FROM local_connectors WHERE id='r1'",
        [], |r| r.get(0),
    ).unwrap();
    assert_eq!(tier, "TIER2");
}

// ---------------------------------------------------------------
// MT9 - sentinel never appears in any safe output
// ---------------------------------------------------------------

#[test]
fn mt9_sentinel_never_appears_in_safe_output() {
    let conn = open_in_memory_for_tests().unwrap();

    // Row carries a sentinel credential and a sentinel config.
    conn.execute(
        "INSERT INTO local_connectors
         (id, connector_code, organization_id, tier, status,
          credential_value, configuration, source_device_id,
          created_at, updated_at,
          winning_logical_clock, winning_device_id, winning_sequence)
         VALUES ('r1', 'resend-email', 'org-A', 'TIER1', 'ENABLED',
                 X'53454E54494E454C5F43524544',
                 '{\"k\":\"SENTINEL_CONFIG\"}',
                 'dev-test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 100, X'00', 10)",
        [],
    ).unwrap();

    // Matching event.
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00",
        &payload_enabled("resend-email", "TIER1", b"SENTINEL_CRED", "{\"k\":\"SENTINEL_CONFIG\"}"),
    );

    let lines = inspect(&conn, "org-A").unwrap();
    let dbg = format!("{:?}", lines);
    assert!(!dbg.contains("SENTINEL"), "sentinel leaked into Debug: {}", dbg);

    let json = serde_json::to_string(&lines).unwrap();
    assert!(!json.contains("SENTINEL"), "sentinel leaked into JSON: {}", json);
}

// ---------------------------------------------------------------
// MT11 - malformed payload; repair aborts; DB unchanged
// ---------------------------------------------------------------

#[test]
fn mt11_malformed_payload_aborts_without_writing() {
    let mut conn = open_in_memory_for_tests().unwrap();

    conn.execute(
        "INSERT INTO local_connectors
         (id, connector_code, organization_id, tier, status,
          credential_value, configuration, source_device_id,
          created_at, updated_at,
          winning_logical_clock, winning_device_id, winning_sequence)
         VALUES ('r1', 'resend-email', 'org-A', 'TIER1', 'ENABLED',
                 X'AA', '{}', 'dev', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 -1, X'', -1)",
        [],
    ).unwrap();

    // Malformed payload: garbage bytes that will fail TLV decode.
    insert_event(
        &conn, "e1", "org-A", "resend-email", "CONNECTOR_ENABLED",
        100, 10, "00",
        &[0xFF, 0xFF, 0xFF],
    );

    // Snapshot before.
    let before: (i64, i64, Vec<u8>) = conn.query_row(
        "SELECT winning_logical_clock, winning_sequence, credential_value
         FROM local_connectors WHERE id='r1'",
        [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();

    let err = repair_apply(&mut conn, "org-A").unwrap_err();
    match err {
        RecoverError::DecodeFailed { .. } => {}
        other => panic!("expected DecodeFailed, got {:?}", other),
    }

    // Snapshot after.
    let after: (i64, i64, Vec<u8>) = conn.query_row(
        "SELECT winning_logical_clock, winning_sequence, credential_value
         FROM local_connectors WHERE id='r1'",
        [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();
    assert_eq!(before, after);

    // DB still openable and queryable.
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM local_connectors", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1);
}

// ---------------------------------------------------------------
// MT12 - utility uses protocol_order_less, not SQL row order
// ---------------------------------------------------------------

#[test]
fn mt12_utility_uses_protocol_order_not_sql_order() {
    let mut conn = open_in_memory_for_tests().unwrap();

    conn.execute(
        "INSERT INTO local_connectors
         (id, connector_code, organization_id, tier, status,
          credential_value, configuration, source_device_id,
          created_at, updated_at,
          winning_logical_clock, winning_device_id, winning_sequence)
         VALUES ('r1', 'c', 'org-A', 'TIER1', 'ENABLED',
                 X'AA', '{}', 'dev', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
                 -1, X'', -1)",
        [],
    ).unwrap();

    // Insert in an order that does NOT match protocol order:
    // mid (clock 100) first, then low (clock 50), then high (clock 200).
    insert_event(
        &conn, "e_mid", "org-A", "c", "CONNECTOR_ENABLED", 100, 10,
        "01000000000000000000000000000000",
        &payload_enabled("c", "TIER1", &[0x11], "{}"),
    );
    insert_event(
        &conn, "e_low", "org-A", "c", "CONNECTOR_ENABLED", 50, 5,
        "02000000000000000000000000000000",
        &payload_enabled("c", "TIER1", &[0x22], "{}"),
    );
    insert_event(
        &conn, "e_high", "org-A", "c", "CONNECTOR_ENABLED", 200, 20,
        "03000000000000000000000000000000",
        &payload_enabled("c", "TIER1", &[0x33], "{}"),
    );

    // Inspect: latest must be e_high.
    let lines = inspect(&conn, "org-A").unwrap();
    assert_eq!(lines.len(), 1);
    let ev = lines[0].latest_event.as_ref().unwrap();
    assert_eq!(ev.id, "e_high");

    // plan_for_row: must be a RebuildEnabled from e_high.
    let plan = plan_for_row(&conn, "org-A", "c").unwrap();
    match plan {
        RepairPlan::RebuildEnabled { logical_clock, .. } => assert_eq!(logical_clock, 200),
        other => panic!("expected RebuildEnabled with clock 200, got {:?}", other),
    }
}