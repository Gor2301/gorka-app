// shared/tests/slice6_offline_stale.rs
//
// Slice 6 acceptance: offline/stale rules. Opt-out propagation
// through the real sync pipeline; unrelated key preservation; loser
// retention in history_records; empty-blob round-trip; clear-flag
// unblocks.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 1.1-1.5.
//
// Replica simulation: one in-memory DB acts as the Agent. Events are
// built with the real encoders and fed to process_sync_message, so
// this exercises the actual receiving pipeline, not an SQL
// equivalent. Two replicas are not required for these rows; the
// "second device" is represented by a distinct event device_id.

use gorka_shared::compliance::{check_opt_out, Channel, ComplianceBlock};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::sync::{
    build_sync_message, encode_debtor_created_payload, encode_entity_updated_payload,
    encode_event_record,
};
use gorka_shared::sync_events::ENTITY_DEBTOR;
use gorka_shared::sync_handshake::AckOutcome;
use gorka_shared::sync_pipeline::process_sync_message;
use rusqlite::params;

const ORG_ID: &str = "org-6j";
const DEBTOR: &str = "debtor-6j-1";
const DEVICE_A: &[u8] = b"device-6j-a";
const DEVICE_B: &[u8] = b"device-6j-b";
const SESSION_KEY: [u8; 32] = [0u8; 32];
const NONCE: [u8; 24] = [0u8; 24];

// Event type codes matching sync_pipeline.rs constants.
const EVT_DEBTOR_CREATED: u16 = 0x0001;
const EVT_ENTITY_UPDATED: u16 = 0x0002;
const ETYPE_DEBTOR: u8 = 0x01;
const EVENT_ENTITY_UPDATED_STR: &str = "ENTITY_UPDATED";

fn msg_id(n: u8) -> [u8; 16] {
    let mut m = [0u8; 16];
    m[0] = n;
    m[15] = 0x01;
    m
}

fn evt_id(n: u8) -> [u8; 16] {
    let mut m = [0u8; 16];
    for b in m.iter_mut() {
        *b = n;
    }
    m[6] = 0x70;
    m[7] = 0x00;
    m[8] = 0x80;
    m[15] = 0x01;
    m
}

fn seed_via_sync_debtor_created(conn: &mut rusqlite::Connection) {
    let payload = encode_debtor_created_payload(
        "Test",
        "Debtor",
        Some("z@example.invalid"),
        Some("+10000000000"),
        None,
    );
    let record = encode_event_record(
        &evt_id(1),
        DEVICE_A,
        100,
        1,
        EVT_DEBTOR_CREATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(1), &[record]).expect("build");
    let result = process_sync_message(conn, ORG_ID, &SESSION_KEY, &framed).expect("process");
    assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);
}

fn read_data(conn: &rusqlite::Connection) -> String {
    conn.query_row(
        "SELECT data FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![DEBTOR, ORG_ID],
        |r| r.get(0),
    )
    .expect("read data")
}

fn count_history(conn: &rusqlite::Connection) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM history_records
         WHERE entity_type = 'debtor' AND entity_id = ?1",
        params![DEBTOR],
        |r| r.get(0),
    )
    .expect("count history")
}

// -----------------------------------------------------------------
// Row 1.1: opt-out reaches agent through the real sync path
// -----------------------------------------------------------------

#[test]
fn client_opt_out_reaches_agent_and_blocks() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_via_sync_debtor_created(&mut conn);

    let new_data = r#"{"opt_out":{"email":true}}"#;
    let payload = encode_entity_updated_payload(&[("data_json", Some(new_data))]);
    let record = encode_event_record(
        &evt_id(2),
        DEVICE_A,
        101,
        2,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_260_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(2), &[record]).expect("build");
    let result = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed).expect("process");
    assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);

    // Data blob updated.
    let data = read_data(&conn);
    assert!(data.contains("\"email\":true"), "data={}", data);

    // check_opt_out blocks for email.
    let r = check_opt_out(&conn, ORG_ID, DEBTOR, "resend-email");
    assert!(r.is_err(), "email must be blocked after sync");
    assert!(matches!(r.unwrap_err(), ComplianceBlock::OptOut { channel: Channel::Email }));
}

// -----------------------------------------------------------------
// Row 1.2: unrelated key preserved through ENTITY_UPDATED
// -----------------------------------------------------------------

#[test]
fn unrelated_key_survives_entity_updated() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_via_sync_debtor_created(&mut conn);

    let new_data = r#"{"opt_out":{"email":true},"note":"keep-me"}"#;
    let payload = encode_entity_updated_payload(&[("data_json", Some(new_data))]);
    let record = encode_event_record(
        &evt_id(3),
        DEVICE_A,
        102,
        3,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_320_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(3), &[record]).expect("build");
    process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed).expect("process");

    let data = read_data(&conn);
    assert!(data.contains("\"note\":\"keep-me\""), "note missing: {}", data);
    assert!(data.contains("\"email\":true"), "email missing: {}", data);
}

// -----------------------------------------------------------------
// Row 1.3: stale event loses; loser recorded in history_records
// -----------------------------------------------------------------

#[test]
fn protocol_order_loser_recorded_in_history() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_via_sync_debtor_created(&mut conn);

    // Winner: clock 200.
    let winner_data = r#"{"winner":"yes"}"#;
    let payload_w = encode_entity_updated_payload(&[("data_json", Some(winner_data))]);
    let record_w = encode_event_record(
        &evt_id(4),
        DEVICE_A,
        200,
        4,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_400_000,
        &payload_w,
    );
    let framed_w = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(4), &[record_w]).expect("build");
    let res_w = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed_w).expect("process winner");
    assert_eq!(res_w.outcomes[0].outcome, AckOutcome::Accepted);

    // Loser: clock 150, different device.
    let loser_data = r#"{"winner":"no"}"#;
    let payload_l = encode_entity_updated_payload(&[("data_json", Some(loser_data))]);
    let record_l = encode_event_record(
        &evt_id(5),
        DEVICE_B,
        150,
        5,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_350_000,
        &payload_l,
    );
    let framed_l = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(5), &[record_l]).expect("build");
    let res_l = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed_l).expect("process loser");
    assert_eq!(res_l.outcomes[0].outcome, AckOutcome::Accepted);

    // Winner data intact.
    let data = read_data(&conn);
    assert!(data.contains("\"winner\":\"yes\""), "winner overwritten: {}", data);

    // history_records now holds the losing value.
    let history_count = count_history(&conn);
    assert!(history_count >= 1, "expected at least one history row");

    let losing_val: String = conn
        .query_row(
            "SELECT losing_value FROM history_records
             WHERE entity_type = 'debtor' AND entity_id = ?1 AND field_name = 'data_json'",
            params![DEBTOR],
            |r| r.get(0),
        )
        .expect("read losing value");
    assert!(
        losing_val.contains("\"winner\":\"no\""),
        "history must contain the losing value: {}",
        losing_val
    );
}

// -----------------------------------------------------------------
// Row 1.4: empty-blob round-trip
// -----------------------------------------------------------------

#[test]
fn empty_blob_round_trip() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_via_sync_debtor_created(&mut conn);

    let payload = encode_entity_updated_payload(&[("data_json", Some("{}"))]);
    let record = encode_event_record(
        &evt_id(6),
        DEVICE_A,
        110,
        6,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_440_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(6), &[record]).expect("build");
    let result = process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &framed).expect("process");
    assert_eq!(result.outcomes[0].outcome, AckOutcome::Accepted);

    let data = read_data(&conn);
    assert_eq!(data.trim(), "{}");
}

// -----------------------------------------------------------------
// Row 1.5: clear opt-out through sync unblocks
// -----------------------------------------------------------------

#[test]
fn clear_opt_out_after_sync_unblocks() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_via_sync_debtor_created(&mut conn);

    // First: set opt-out.
    let set_payload = encode_entity_updated_payload(&[(
        "data_json",
        Some(r#"{"opt_out":{"email":true}}"#),
    )]);
    let set_record = encode_event_record(
        &evt_id(7),
        DEVICE_A,
        120,
        7,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_500_000,
        &set_payload,
    );
    let set_framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(7), &[set_record]).expect("build");
    process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &set_framed).expect("set");

    assert!(
        check_opt_out(&conn, ORG_ID, DEBTOR, "resend-email").is_err(),
        "must block after set"
    );

    // Second: clear opt-out (higher clock).
    let clear_payload = encode_entity_updated_payload(&[(
        "data_json",
        Some(r#"{"opt_out":{"email":false}}"#),
    )]);
    let clear_record = encode_event_record(
        &evt_id(8),
        DEVICE_A,
        121,
        8,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        DEBTOR.as_bytes(),
        1_789_891_560_000,
        &clear_payload,
    );
    let clear_framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(8), &[clear_record]).expect("build");
    process_sync_message(&mut conn, ORG_ID, &SESSION_KEY, &clear_framed).expect("clear");

    assert!(
        check_opt_out(&conn, ORG_ID, DEBTOR, "resend-email").is_ok(),
        "must allow after clear"
    );
}

// Silence unused-import warnings: EVENT_ENTITY_UPDATED_STR is a
// reference constant; keep it visible so the mapping is documented.
#[test]
fn event_type_string_matches_constant() {
    assert_eq!(EVENT_ENTITY_UPDATED_STR, "ENTITY_UPDATED");
    assert_eq!(ENTITY_DEBTOR, "debtor");
}