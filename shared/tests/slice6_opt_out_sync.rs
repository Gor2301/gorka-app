// shared/tests/slice6_opt_out_sync.rs
//
// Slice 6 acceptance: opt-out changes through sync.
// Authority: PART III - SLICE 6 MINI SPEC v1.0, Section 5 rows
// 2.1-2.4.
//
// Rows covered:
//   2.1 Multi-key blob preserved through ENTITY_UPDATED.
//   2.2 Re-apply idempotent.
//   2.3 Cross-org scoping.
//   2.4 Per-channel independence through sync.

use gorka_shared::compliance::{check_opt_out, get_opt_out, Channel, ComplianceBlock};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::sync::{
    build_sync_message, encode_debtor_created_payload, encode_entity_updated_payload,
    encode_event_record,
};
use gorka_shared::sync_handshake::AckOutcome;
use gorka_shared::sync_pipeline::process_sync_message;
use rusqlite::params;
use serde_json::json;

const ORG_A: &str = "org-6k-a";
const ORG_B: &str = "org-6k-b";
const DEBTOR_A: &str = "debtor-6k-a1";
const DEBTOR_B: &str = "debtor-6k-b1";
const DEVICE_A: &[u8] = b"device-6k-a";
const SESSION_KEY: [u8; 32] = [0u8; 32];
const NONCE: [u8; 24] = [0u8; 24];

const EVT_DEBTOR_CREATED: u16 = 0x0001;
const EVT_ENTITY_UPDATED: u16 = 0x0002;
const ETYPE_DEBTOR: u8 = 0x01;

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

fn seed_debtor(conn: &mut rusqlite::Connection, org: &str, debtor: &str, seed: u8) {
    let payload = encode_debtor_created_payload(
        "Test",
        "Debtor",
        Some("z@example.invalid"),
        None,
        None,
    );
    let record = encode_event_record(
        &evt_id(seed),
        DEVICE_A,
        seed as u64,
        100,
        EVT_DEBTOR_CREATED,
        ETYPE_DEBTOR,
        debtor.as_bytes(),
        1_789_891_200_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(seed), &[record]).expect("build");
    let res = process_sync_message(conn, org, &SESSION_KEY, &framed).expect("process");
    assert_eq!(res.outcomes[0].outcome, AckOutcome::Accepted);
}

fn apply_data_update(
    conn: &mut rusqlite::Connection,
    org: &str,
    debtor: &str,
    data: &str,
    clock: u64,
    seq: u64,
    seed: u8,
) -> AckOutcome {
    let payload = encode_entity_updated_payload(&[("data_json", Some(data))]);
    let record = encode_event_record(
        &evt_id(seed),
        DEVICE_A,
        seq,
        clock,
        EVT_ENTITY_UPDATED,
        ETYPE_DEBTOR,
        debtor.as_bytes(),
        1_789_891_260_000,
        &payload,
    );
    let framed = build_sync_message(&SESSION_KEY, &NONCE, &msg_id(seed), &[record]).expect("build");
    let res = process_sync_message(conn, org, &SESSION_KEY, &framed).expect("process");
    res.outcomes[0].outcome
}

fn read_data(conn: &rusqlite::Connection, org: &str, debtor: &str) -> String {
    conn.query_row(
        "SELECT data FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![debtor, org],
        |r| r.get(0),
    )
    .expect("read data")
}

// -----------------------------------------------------------------
// Row 2.1: multi-key blob preserved through ENTITY_UPDATED
// -----------------------------------------------------------------

#[test]
fn multi_key_blob_preserved() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&mut conn, ORG_A, DEBTOR_A, 1);

    let data = r#"{"opt_out":{"email":true,"sms":false},"note":"alpha","tag":"beta"}"#;
    let outcome = apply_data_update(&mut conn, ORG_A, DEBTOR_A, data, 200, 2, 2);
    assert_eq!(outcome, AckOutcome::Accepted);

    let stored = read_data(&conn, ORG_A, DEBTOR_A);
    let v: serde_json::Value = serde_json::from_str(&stored).expect("parse");
    assert_eq!(v["note"], "alpha");
    assert_eq!(v["tag"], "beta");
    assert_eq!(v["opt_out"]["email"], true);
    assert_eq!(v["opt_out"]["sms"], false);
}

// -----------------------------------------------------------------
// Row 2.2: re-apply idempotent (same clock, same device, same seq)
// -----------------------------------------------------------------

#[test]
fn reapply_is_idempotent() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&mut conn, ORG_A, DEBTOR_A, 3);

    let data = r#"{"opt_out":{"email":true}}"#;
    let out1 = apply_data_update(&mut conn, ORG_A, DEBTOR_A, data, 300, 4, 4);
    assert_eq!(out1, AckOutcome::Accepted);
    let after_first = read_data(&conn, ORG_A, DEBTOR_A);

    // Same event again: same event_id -> Duplicate outcome. The
    // data blob must be unchanged.
    let out2 = apply_data_update(&mut conn, ORG_A, DEBTOR_A, data, 300, 4, 4);
    assert!(
        matches!(out2, AckOutcome::Duplicate),
        "second identical event must be Duplicate, got {:?}",
        out2
    );

    let after_second = read_data(&conn, ORG_A, DEBTOR_A);
    assert_eq!(after_first, after_second);
}

// -----------------------------------------------------------------
// Row 2.3: cross-org scoping
// -----------------------------------------------------------------

#[test]
fn cross_org_scoped() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&mut conn, ORG_A, DEBTOR_A, 5);
    seed_debtor(&mut conn, ORG_B, DEBTOR_B, 6);

    // Update DEBTOR_A's opt-out in ORG_A.
    let outcome = apply_data_update(
        &mut conn,
        ORG_A,
        DEBTOR_A,
        r#"{"opt_out":{"email":true}}"#,
        400,
        7,
        7,
    );
    assert_eq!(outcome, AckOutcome::Accepted);

    // ORG_A blocked.
    assert!(check_opt_out(&conn, ORG_A, DEBTOR_A, "resend-email").is_err());

    // ORG_B debtor unaffected.
    assert!(check_opt_out(&conn, ORG_B, DEBTOR_B, "resend-email").is_ok());
}

// -----------------------------------------------------------------
// Row 2.4: per-channel independence through sync
// -----------------------------------------------------------------

#[test]
fn per_channel_independence_through_sync() {
    let mut conn = open_in_memory_for_tests().expect("open");
    seed_debtor(&mut conn, ORG_A, DEBTOR_A, 8);

    // Email opted out, sms and voice not.
    let data = r#"{"opt_out":{"email":true,"sms":false,"voice":false}}"#;
    let outcome = apply_data_update(&mut conn, ORG_A, DEBTOR_A, data, 500, 9, 9);
    assert_eq!(outcome, AckOutcome::Accepted);

    // Email blocked.
    let r_email = check_opt_out(&conn, ORG_A, DEBTOR_A, "resend-email");
    assert!(r_email.is_err(), "email must block");
    assert!(matches!(r_email.unwrap_err(), ComplianceBlock::OptOut { channel: Channel::Email }));

    // SMS allowed.
    assert!(
        check_opt_out(&conn, ORG_A, DEBTOR_A, "twilio-sms").is_ok(),
        "sms must be allowed"
    );

    // Verify get_opt_out read of the synced blob.
    let stored = read_data(&conn, ORG_A, DEBTOR_A);
    let v: serde_json::Value = serde_json::from_str(&stored).expect("parse");
    let opt = get_opt_out(&v, Channel::Email).expect("read");
    assert!(opt);
    let opt_sms = get_opt_out(&v, Channel::Sms).expect("read");
    assert!(!opt_sms);

    // Suppress unused json import: reference it once.
    let _ = json!({});
}