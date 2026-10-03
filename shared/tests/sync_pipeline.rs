// shared/tests/sync_pipeline.rs
//
// Integration tests for the receiving pipeline.
//
// Each test builds a SYNC_MESSAGE with one or more events, frames
// it with a session key, and feeds it to process_sync_message
// against a fresh in-memory database.

use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::sync::{
    encode_debtor_created_payload,
    encode_entity_updated_payload,
    encode_action_created_payload,
    encode_event_record,
    build_sync_message,
};
use gorka_shared::sync_handshake::AckOutcome;
use gorka_shared::sync_pipeline::process_sync_message;

const ORG_ID: &str = "org-test-A";
const DEVICE_A: &[u8] = b"device-test-A";
const DEVICE_B: &[u8] = b"device-test-B";
const SESSION_KEY: [u8; 32] = [0u8; 32];
const NONCE: [u8; 24] = [0u8; 24];

fn message_id() -> [u8; 16] {
    [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]
}

fn event_id_a() -> [u8; 16] {
    [
        0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]
}

fn event_id_b() -> [u8; 16] {
    [
        0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]
}

#[test]
fn debtor_created_accepted_and_applied() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    let payload = encode_debtor_created_payload(
        "Test",
        "Debtor",
        Some("t@example.invalid"),
        None,
        None,
    );
    let record = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        1,
        0x0001, // DEBTOR_CREATED
        0x01,   // debtor
        b"entity-test-001",
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[record])
        .expect("build");

    let result = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed)
        .expect("process");

    assert_eq!(result.outcomes.len(), 1);
    assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);

    // Verify the debtor row exists.
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM debtors WHERE id = 'entity-test-001'",
            [],
            |row| row.get(0),
        )
        .expect("query");
    assert_eq!(count, 1);

    // Verify the sync_events row.
    let event_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_events", [], |row| row.get(0))
        .expect("query");
    assert_eq!(event_count, 1);
}

#[test]
fn duplicate_event_returns_duplicate_outcome() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);
    let record = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        1,
        0x0001,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &payload,
    );

    let framed1 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[record.clone()])
        .expect("build 1");
    let r1 = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed1)
        .expect("process 1");
    assert_eq!(r1.outcomes[0].outcome, AckOutcome::Accepted);

    let framed2 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[record])
        .expect("build 2");
    let r2 = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed2)
        .expect("process 2");
    assert_eq!(r2.outcomes[0].outcome, AckOutcome::Duplicate);

    // Only one debtor row, one sync_events row.
    let d: i64 = conn
        .query_row("SELECT COUNT(*) FROM debtors", [], |row| row.get(0))
        .expect("q");
    let e: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_events", [], |row| row.get(0))
        .expect("q");
    assert_eq!(d, 1);
    assert_eq!(e, 1);
}

#[test]
fn entity_updated_deleted_false_is_rejected() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    let payload = encode_entity_updated_payload(&[("deleted", Some("false"))]);
    let record = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        1,
        0x0002, // ENTITY_UPDATED
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[record])
        .expect("build");

    let result = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed)
        .expect("process");

    assert_eq!(result.outcomes[0].outcome, AckOutcome::Rejected);

    // Nothing written: no sync_events row, no state change.
    let e: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_events", [], |row| row.get(0))
        .expect("q");
    assert_eq!(e, 0);
}

#[test]
fn action_created_without_debtor_becomes_pending() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    let payload = encode_action_created_payload(
        "missing-debtor",
        "CALL",
        "PENDING",
        None,
        None,
        None,
        "{}",
    );
    let record = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        1,
        0x0003, // ACTION_CREATED
        0x03,
        b"action-001",
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[record])
        .expect("build");

    let result = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed)
        .expect("process");

    assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);

    // sync_events row exists, but no actions row, and a pending_events row.
    let ev: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_events", [], |row| row.get(0))
        .expect("q");
    let ac: i64 = conn
        .query_row("SELECT COUNT(*) FROM actions", [], |row| row.get(0))
        .expect("q");
    let pe: i64 = conn
        .query_row("SELECT COUNT(*) FROM pending_events", [], |row| row.get(0))
        .expect("q");
    assert_eq!(ev, 1);
    assert_eq!(ac, 0);
    assert_eq!(pe, 1);
}

#[test]
fn entity_updated_with_newer_clock_wins() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    // First, DEBTOR_CREATED at logical_clock 1.
    let p1 = encode_debtor_created_payload("Old", "Name", None, None, None);
    let r1 = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        1,
        0x0001,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &p1,
    );
    let f1 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[r1]).expect("build 1");
    process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &f1).expect("p1");

    // Then, ENTITY_UPDATED at logical_clock 2, name = "New".
    let p2 = encode_entity_updated_payload(&[("name", Some("New"))]);
    let r2 = encode_event_record(
        &event_id_b(),
        DEVICE_B,
        1,
        2,
        0x0002,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &p2,
    );
    let f2 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[r2]).expect("build 2");
    let res = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &f2).expect("p2");
    assert_eq!(res.outcomes[0].outcome, AckOutcome::Accepted);

    let name: String = conn
        .query_row(
            "SELECT name FROM debtors WHERE id = 'entity-test-001'",
            [],
            |row| row.get(0),
        )
        .expect("q");
    assert_eq!(name, "New");

    // history_records should contain one row for the name change.
    let h: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM history_records WHERE field_name = 'name'",
            [],
            |row| row.get(0),
        )
        .expect("q");
    assert_eq!(h, 1);
}

#[test]
fn entity_updated_with_older_clock_loses() {
    let mut conn = open_in_memory_for_tests().expect("db init");

    // DEBTOR_CREATED at clock 5.
    let p1 = encode_debtor_created_payload("Keep", "This", None, None, None);
    let r1 = encode_event_record(
        &event_id_a(),
        DEVICE_A,
        1,
        5,
        0x0001,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &p1,
    );
    let f1 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[r1]).expect("build 1");
    process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &f1).expect("p1");

    // ENTITY_UPDATED at clock 3 (older), name = "Should not win".
    let p2 = encode_entity_updated_payload(&[("name", Some("Should not win"))]);
    let r2 = encode_event_record(
        &event_id_b(),
        DEVICE_B,
        1,
        3,
        0x0002,
        0x01,
        b"entity-test-001",
        1_789_891_200_000,
        &p2,
    );
    let f2 = build_sync_message(&SESSION_KEY, &NONCE, &message_id(), &[r2]).expect("build 2");
    let res = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &f2).expect("p2");
    assert_eq!(res.outcomes[0].outcome, AckOutcome::Accepted);

    let name: String = conn
        .query_row(
            "SELECT name FROM debtors WHERE id = 'entity-test-001'",
            [],
            |row| row.get(0),
        )
        .expect("q");
    assert_eq!(name, "Keep");

    // The losing value should be recorded.
    let losing: Option<String> = conn
        .query_row(
            "SELECT losing_value FROM history_records WHERE field_name = 'name'",
            [],
            |row| row.get(0),
        )
        .ok();
    assert_eq!(losing.as_deref(), Some("Should not win"));
}