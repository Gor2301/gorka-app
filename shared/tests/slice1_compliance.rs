// shared/tests/slice1_compliance.rs
//
// Slice 1 acceptance tests: opt-out enforcement and disclosure text.
//
// Authority:
//   CONNECTOR-EVENT-ORDER-SPEC Part II §II.17.2
//   SLICE-1-MINI-SPEC v1.2 §6
//
// These tests exercise the shared Rust API and the local SQLCipher
// database. The Tauri command wrappers (send_connector_message, the
// opt-out toggle command, the disclosure reader used by the composer)
// are covered by the live test, not here.
//
// Coverage map (mini spec §6 test id -> test fn):
//   1a-3            opt_out_explicit_false_allows
//   1a-6            toggle_preserves_unrelated_data_keys
//   1a-9            toggle_true_then_false_round_trip
//   1a-10           toggle_creates_opt_out_key_when_absent
//   1a-11 (lib)     check_opt_out_unknown_connector_is_blocked
//   1a-12           check_opt_out_malformed_data_is_blocked
//   1a-13 (lib)     check_opt_out_voice_flag_blocks_without_adapter
//   1b-4            get_disclosure_text_returns_none_when_no_row
//   1b-5 (lib)      append_disclosure_idempotent_no_double_append
//   1b-8            append_disclosure_whitespace_only_is_noop
//   1b-10           get_disclosure_text_returns_none_when_no_row (same)
//   1c-1            toggle_originates_exactly_one_entity_updated
//   8.4 (lib)       channel_from_str_rejects_unknown

use gorka_shared::compliance::{
    append_disclosure_idempotent,
    channel_for_connector_code,
    check_opt_out,
    get_disclosure_text,
    get_opt_out,
    set_debtor_opt_out,
    Channel,
    ComplianceBlock,
};
use gorka_shared::db::open_in_memory_for_tests;
use rusqlite::params;
use serde_json::json;

const ORG_ID: &str = "org-test-A";
const OTHER_ORG_ID: &str = "org-test-B";
const DEBTOR_ID: &str = "debtor-test-001";

// ---------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------

fn seed_debtor(conn: &rusqlite::Connection, data_json: &str) {
    conn.execute(
        "INSERT INTO debtors
            (id, organization_id, name, surname, data, created_at, updated_at)
         VALUES (?1, ?2, 'Test', 'Debtor', ?3,
                 '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')",
        params![DEBTOR_ID, ORG_ID, data_json],
    )
    .expect("seed debtor");
}

fn clear_sync_events(conn: &rusqlite::Connection) {
    conn.execute("DELETE FROM sync_events", [])
        .expect("clear sync_events");
}

fn read_debtor_data(conn: &rusqlite::Connection) -> serde_json::Value {
    let raw: String = conn
        .query_row(
            "SELECT data FROM debtors WHERE id = ?1 AND organization_id = ?2",
            params![DEBTOR_ID, ORG_ID],
            |row| row.get(0),
        )
        .expect("read debtor data");
    serde_json::from_str(&raw).expect("data is valid JSON")
}

fn count_entity_updated(conn: &rusqlite::Connection) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM sync_events
         WHERE entity_id = ?1 AND event_type = 'ENTITY_UPDATED'",
        params![DEBTOR_ID],
        |row| row.get(0),
    )
    .expect("count events")
}

// ---------------------------------------------------------------------
// Pure helper tests (also cover the module's own #[cfg(test)] set)
// ---------------------------------------------------------------------

#[test]
fn channel_from_str_rejects_unknown() {
    assert!("email".parse::<Channel>().is_ok());
    assert!("sms".parse::<Channel>().is_ok());
    assert!("voice".parse::<Channel>().is_ok());
    assert!("whatsapp".parse::<Channel>().is_err());
    assert!("".parse::<Channel>().is_err());
    assert!("EMAIL".parse::<Channel>().is_err()); // case-sensitive
}

#[test]
fn channel_for_connector_code_recognizes_known_suffixes() {
    assert_eq!(channel_for_connector_code("resend-email"), Some(Channel::Email));
    assert_eq!(channel_for_connector_code("twilio-sms"), Some(Channel::Sms));
    assert_eq!(channel_for_connector_code("twilio-voice"), Some(Channel::Voice));
    assert_eq!(channel_for_connector_code("custom-api"), None);
    assert_eq!(channel_for_connector_code(""), None);
}

#[test]
fn get_opt_out_missing_key_is_false() {
    let data = json!({"notes": "keep me"});
    assert_eq!(get_opt_out(&data, Channel::Email).unwrap(), false);
}

#[test]
fn get_opt_out_explicit_false_is_false() {
    let data = json!({"opt_out": {"email": false}});
    assert_eq!(get_opt_out(&data, Channel::Email).unwrap(), false);
}

#[test]
fn get_opt_out_explicit_true_is_true() {
    let data = json!({"opt_out": {"email": true}});
    assert_eq!(get_opt_out(&data, Channel::Email).unwrap(), true);
}

#[test]
fn get_opt_out_other_channel_is_false() {
    let data = json!({"opt_out": {"email": true, "sms": false}});
    assert_eq!(get_opt_out(&data, Channel::Sms).unwrap(), false);
    assert_eq!(get_opt_out(&data, Channel::Voice).unwrap(), false);
}

#[test]
fn get_opt_out_non_bool_value_is_err() {
    let data = json!({"opt_out": {"email": "yes"}});
    assert!(get_opt_out(&data, Channel::Email).is_err());
}

#[test]
fn get_opt_out_non_object_opt_out_is_err() {
    let data = json!({"opt_out": "yes"});
    assert!(get_opt_out(&data, Channel::Email).is_err());
}

#[test]
fn get_opt_out_non_object_data_is_err() {
    let data = json!("not an object");
    assert!(get_opt_out(&data, Channel::Email).is_err());
}

#[test]
fn append_disclosure_idempotent_no_double_append() {
    let body = "Hello.\n\nPlease contact us.";
    let disclosure = "Please contact us.";
    assert_eq!(append_disclosure_idempotent(body, disclosure), body);
}

#[test]
fn append_disclosure_adds_with_newline_when_absent() {
    let body = "Hello.";
    let disclosure = "Please contact us.";
    let out = append_disclosure_idempotent(body, disclosure);
    assert_eq!(out, "Hello.\nPlease contact us.");
}

#[test]
fn append_disclosure_whitespace_only_is_noop() {
    assert_eq!(append_disclosure_idempotent("Hello.", ""), "Hello.");
    assert_eq!(append_disclosure_idempotent("Hello.", "   "), "Hello.");
    assert_eq!(append_disclosure_idempotent("Hello.", "\n\t "), "Hello.");
}

#[test]
fn append_disclosure_tolerates_trailing_whitespace() {
    let body = "Hello.\nPlease contact us.\n";
    let disclosure = "Please contact us.";
    assert_eq!(append_disclosure_idempotent(body, disclosure), body);
}

// ---------------------------------------------------------------------
// set_debtor_opt_out — DB and event shape
// ---------------------------------------------------------------------

#[test]
fn toggle_creates_opt_out_key_when_absent() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("toggle");

    let data = read_debtor_data(&conn);
    assert_eq!(data["opt_out"]["email"], json!(true));
}

#[test]
fn toggle_true_then_false_round_trip() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("set true");
    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, false)
        .expect("set false");

    let data = read_debtor_data(&conn);
    assert_eq!(data["opt_out"]["email"], json!(false));
}

#[test]
fn toggle_preserves_unrelated_data_keys() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"notes":"keep me","contacts":{"phone1":"+63..."}}"#);
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("toggle");

    let data = read_debtor_data(&conn);
    assert_eq!(data["notes"], json!("keep me"));
    assert_eq!(data["contacts"]["phone1"], json!("+63..."));
    assert_eq!(data["opt_out"]["email"], json!(true));
}

#[test]
fn toggle_only_one_channel() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("toggle email");

    let data = read_debtor_data(&conn);
    assert_eq!(data["opt_out"]["email"], json!(true));
    // Other channels are absent, not written as false.
    assert!(data["opt_out"].get("sms").is_none());
    assert!(data["opt_out"].get("voice").is_none());
}

#[test]
fn toggle_originates_exactly_one_entity_updated() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("toggle");

    let count = count_entity_updated(&conn);
    assert_eq!(count, 1, "exactly one ENTITY_UPDATED must be originated");
}

#[test]
fn toggle_originates_only_data_json_field() {
    let mut conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");
    clear_sync_events(&conn);

    set_debtor_opt_out(&mut conn, ORG_ID, DEBTOR_ID, Channel::Email, true)
        .expect("toggle");

    let payload: Vec<u8> = conn
        .query_row(
            "SELECT payload FROM sync_events
             WHERE entity_id = ?1 AND event_type = 'ENTITY_UPDATED'",
            params![DEBTOR_ID],
            |row| row.get(0),
        )
        .expect("read payload");

    let parsed = gorka_shared::sync_parse::parse_entity_updated_payload(&payload)
        .expect("parse entity_updated payload");

    let names: Vec<&str> = parsed
        .changes
        .iter()
        .map(|c| c.field_name.as_str())
        .collect();

    assert_eq!(names, vec!["data_json"],
        "the toggle must originate only data_json, not name/surname/email/phone");
}

// ---------------------------------------------------------------------
// check_opt_out — the guard
// ---------------------------------------------------------------------

#[test]
fn opt_out_explicit_false_allows() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"opt_out":{"email":false}}"#);

    check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect("explicit false must not block");
}

#[test]
fn opt_out_missing_key_allows() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");

    check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect("missing key must not block");
}

#[test]
fn opt_out_true_blocks_with_channel() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"opt_out":{"email":true}}"#);

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect_err("must block");
    match err {
        ComplianceBlock::OptOut { channel } => assert_eq!(channel, Channel::Email),
        other => panic!("expected OptOut, got {:?}", other),
    }
}

#[test]
fn opt_out_email_flag_does_not_block_sms() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"opt_out":{"email":true}}"#);

    check_opt_out(&conn, ORG_ID, DEBTOR_ID, "twilio-sms")
        .expect("email flag must not block sms");
}

#[test]
fn check_opt_out_unknown_connector_is_blocked() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "custom-api")
        .expect_err("unknown connector must be blocked, not skipped");
    match err {
        ComplianceBlock::UnknownConnector { connector_code } => {
            assert_eq!(connector_code, "custom-api");
        }
        other => panic!("expected UnknownConnector, got {:?}", other),
    }
}

#[test]
fn check_opt_out_voice_flag_blocks_without_adapter() {
    // Proves the guard's decision is observable independently of
    // whether a voice adapter exists in the registry.
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"opt_out":{"voice":true}}"#);

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "twilio-voice")
        .expect_err("voice flag must block");
    match err {
        ComplianceBlock::OptOut { channel } => assert_eq!(channel, Channel::Voice),
        other => panic!("expected OptOut voice, got {:?}", other),
    }
}

#[test]
fn check_opt_out_malformed_data_is_blocked() {
    let conn = open_in_memory_for_tests().expect("db init");
    // SQLite does not validate JSON columns; a non-JSON string is storable.
    seed_debtor(&conn, "not-json");

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect_err("malformed data must fail closed");
    assert!(matches!(err, ComplianceBlock::MalformedData),
        "expected MalformedData, got {:?}", err);
}

#[test]
fn check_opt_out_non_bool_flag_is_blocked() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, r#"{"opt_out":{"email":"yes"}}"#);

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect_err("non-bool flag must fail closed");
    assert!(matches!(err, ComplianceBlock::MalformedData),
        "expected MalformedData, got {:?}", err);
}

#[test]
fn check_opt_out_debtor_not_found_is_blocked() {
    let conn = open_in_memory_for_tests().expect("db init");
    // No seed — debtor absent.

    let err = check_opt_out(&conn, ORG_ID, DEBTOR_ID, "resend-email")
        .expect_err("missing debtor must fail closed");
    match err {
        ComplianceBlock::DebtorNotFound { debtor_id } => {
            assert_eq!(debtor_id, DEBTOR_ID);
        }
        other => panic!("expected DebtorNotFound, got {:?}", other),
    }
}

#[test]
fn check_opt_out_wrong_org_is_blocked() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn, "{}");

    // Same debtor id, different organization — must not be found.
    let err = check_opt_out(&conn, OTHER_ORG_ID, DEBTOR_ID, "resend-email")
        .expect_err("cross-org read must fail closed");
    assert!(matches!(err, ComplianceBlock::DebtorNotFound { .. }),
        "expected DebtorNotFound, got {:?}", err);
}

// ---------------------------------------------------------------------
// Disclosure text — DB read
// ---------------------------------------------------------------------

#[test]
fn get_disclosure_text_returns_none_when_no_row() {
    let conn = open_in_memory_for_tests().expect("db init");
    // compliance_rules is empty on a fresh install.
    let result = get_disclosure_text(&conn).expect("read must not error");
    assert!(result.is_none(), "no row means no disclosure text");
}

#[test]
fn get_disclosure_text_returns_value_when_row_exists() {
    let conn = open_in_memory_for_tests().expect("db init");
    conn.execute(
        "INSERT INTO compliance_rules
            (id, organization_id, disclosure_text, updated_at)
         VALUES (1, ?1, 'Please contact us.', '2026-10-11T00:00:00Z')",
        params![ORG_ID],
    )
    .expect("seed compliance_rules");

    let text = get_disclosure_text(&conn).expect("read");
    assert_eq!(text.as_deref(), Some("Please contact us."));
}

#[test]
fn get_disclosure_text_null_value_is_none() {
    let conn = open_in_memory_for_tests().expect("db init");
    conn.execute(
        "INSERT INTO compliance_rules
            (id, organization_id, disclosure_text, updated_at)
         VALUES (1, ?1, NULL, '2026-10-11T00:00:00Z')",
        params![ORG_ID],
    )
    .expect("seed");

    let text = get_disclosure_text(&conn).expect("read");
    assert!(text.is_none(), "NULL disclosure_text reads as None");
}