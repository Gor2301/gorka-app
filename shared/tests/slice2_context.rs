// shared/tests/slice2_context.rs
//
// Slice 2 acceptance tests: the Context Engine.
// Authority: SLICE-2-MINI-SPEC v1.1 §4, §9.1, §9.2.
//
// Every time-dependent test injects reference_time = 2026-10-12T00:00:00Z.
// No test depends on the machine clock.

use chrono::{DateTime, Utc};
use gorka_shared::context::{build_context, build_fallback_input};
use gorka_shared::db::open_in_memory_for_tests;
use rusqlite::params;

const ORG_ID: &str = "org-test-A";
const DEBTOR_ID: &str = "debtor-test-001";

fn ref_time() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-12T00:00:00Z")
        .expect("parse ref time")
        .with_timezone(&Utc)
}

fn seed_debtor(conn: &rusqlite::Connection) {
    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone,
                              data, created_at, updated_at)
         VALUES (?1, ?2, 'ZZZTestName', 'ZZZSurname', 'z@example.invalid',
                 '+10000000000', '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR_ID, ORG_ID],
    )
    .expect("seed debtor");
}

fn seed_debt(
    conn: &rusqlite::Connection,
    id: &str,
    amount: f64,
    currency: &str,
    status: &str,
    due_date: Option<&str>,
) {
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, DEBTOR_ID, amount, currency, status, due_date],
    )
    .expect("seed debt");
}

fn seed_comm(conn: &rusqlite::Connection, id: &str, comm_type: &str, direction: &str) {
    conn.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content,
                                     duration, created_by, data, created_at)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, '{}',
                 '2026-09-01T00:00:00Z')",
        params![id, DEBTOR_ID, comm_type, direction],
    )
    .expect("seed comm");
}

// ---------------------------------------------------------------------
// 2a-1 through 2a-4 — debt counts and payment reliability
// ---------------------------------------------------------------------

#[test]
fn a1_no_data() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debtor.amount_range, "0-1000");
    assert_eq!(ctx.debtor.days_overdue_range, "0");
    assert_eq!(ctx.debts.total_count, 0);
    assert_eq!(ctx.debts.paid_count, 0);
    assert_eq!(ctx.debts.overdue_count, 0);
    assert_eq!(ctx.indicators.payment_reliability, "NO_DATA");
    assert_eq!(ctx.indicators.engagement_level, "LOW");
    assert_eq!(ctx.communication_history.response_rate_band, "NONE");
    assert!(ctx.indicators.communication_preference.is_none());
}

#[test]
fn a2_one_debt_45_days_overdue() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // 2026-10-12 - 45 days = 2026-08-28
    seed_debt(&conn, "d1", 6000.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debtor.amount_range, "5000-7500");
    assert_eq!(ctx.debtor.days_overdue_range, "31-60");
    assert_eq!(ctx.debts.total_count, 1);
    assert_eq!(ctx.debts.paid_count, 0);
    assert_eq!(ctx.debts.overdue_count, 1);
    assert_eq!(ctx.indicators.payment_reliability, "POOR");
}

#[test]
fn a3_three_debts_one_paid_ratio_is_fair() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // PAID: 5000 USD
    seed_debt(&conn, "d1", 5000.0, "USD", "PAID", Some("2026-06-01T00:00:00Z"));
    // unpaid, not yet due
    seed_debt(&conn, "d2", 1000.0, "USD", "ACTIVE", Some("2026-12-01T00:00:00Z"));
    // unpaid, 90 days overdue (2026-10-12 - 90 = 2026-07-14)
    seed_debt(&conn, "d3", 2000.0, "USD", "ACTIVE", Some("2026-07-14T00:00:00Z"));

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debts.total_count, 3);
    assert_eq!(ctx.debts.paid_count, 1);
    assert_eq!(ctx.debts.overdue_count, 1);
    assert_eq!(ctx.indicators.payment_reliability, "FAIR"); // 1/3 ≈ 0.333
    assert_eq!(ctx.debtor.days_overdue_range, "61-90");
    // Unpaid sum: 1000 + 2000 = 3000 -> "2500-5000"
    assert_eq!(ctx.debtor.amount_range, "2500-5000");
}

#[test]
fn a4_all_paid() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 1000.0, "USD", "PAID", Some("2026-06-01T00:00:00Z"));
    seed_debt(&conn, "d2", 2000.0, "USD", "PAID", Some("2026-06-15T00:00:00Z"));
    seed_debt(&conn, "d3", 3000.0, "USD", "PAID", Some("2026-06-30T00:00:00Z"));

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debts.total_count, 3);
    assert_eq!(ctx.debts.paid_count, 3);
    assert_eq!(ctx.debts.overdue_count, 0);
    assert_eq!(ctx.indicators.payment_reliability, "GOOD");
    assert_eq!(ctx.debtor.days_overdue_range, "0");
    assert_eq!(ctx.debtor.amount_range, "0-1000");
}

// ---------------------------------------------------------------------
// 2a-5 through 2a-9 — communications, response rate, engagement, preference
// ---------------------------------------------------------------------

#[test]
fn a5_five_out_three_in_email() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    for i in 0..5 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }
    for i in 0..3 {
        seed_comm(&conn, &format!("i{}", i), "EMAIL", "INBOUND");
    }

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.communication_history.total_count, 8);
    assert_eq!(ctx.communication_history.email_count, 8);
    assert_eq!(ctx.communication_history.response_rate_band, "HIGH"); // 3/5=0.6
    assert_eq!(ctx.indicators.engagement_level, "MEDIUM"); // 3/8=0.375
}

#[test]
fn a6_five_out_zero_in() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    for i in 0..5 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.communication_history.response_rate_band, "LOW"); // 0/5=0.0
    assert_eq!(ctx.indicators.engagement_level, "LOW"); // 0/5=0.0
}

#[test]
fn a7_zero_out_two_in() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_comm(&conn, "i1", "EMAIL", "INBOUND");
    seed_comm(&conn, "i2", "EMAIL", "INBOUND");

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.communication_history.response_rate_band, "NONE");
    assert_eq!(ctx.indicators.engagement_level, "HIGH"); // 2/2=1.0
}

#[test]
fn a8_preference_sms_wins() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_comm(&conn, "e1", "EMAIL", "OUTBOUND");
    seed_comm(&conn, "e2", "EMAIL", "OUTBOUND");
    seed_comm(&conn, "s1", "SMS", "OUTBOUND");
    seed_comm(&conn, "s2", "SMS", "OUTBOUND");
    seed_comm(&conn, "s3", "SMS", "OUTBOUND");

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.indicators.communication_preference.as_deref(), Some("SMS"));
}

#[test]
fn a9_preference_tie_breaks_alphabetically() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    for i in 0..5 {
        seed_comm(&conn, &format!("e{}", i), "EMAIL", "OUTBOUND");
        seed_comm(&conn, &format!("s{}", i), "SMS", "OUTBOUND");
    }

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.indicators.communication_preference.as_deref(), Some("EMAIL"));
}

// ---------------------------------------------------------------------
// 2a-10 through 2a-16 — days overdue boundaries
// ---------------------------------------------------------------------

fn ctx_days_range(due_date: &str) -> String {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 100.0, "USD", "ACTIVE", Some(due_date));
    build_context(&conn, ORG_ID, DEBTOR_ID, ref_time())
        .expect("build")
        .debtor
        .days_overdue_range
}

#[test]
fn a10_exactly_30_days() {
    assert_eq!(ctx_days_range("2026-09-12T00:00:00Z"), "1-30");
}

#[test]
fn a11_exactly_31_days() {
    assert_eq!(ctx_days_range("2026-09-11T00:00:00Z"), "31-60");
}

#[test]
fn a12_exactly_60_days() {
    assert_eq!(ctx_days_range("2026-08-13T00:00:00Z"), "31-60");
}

#[test]
fn a13_exactly_61_days() {
    assert_eq!(ctx_days_range("2026-08-12T00:00:00Z"), "61-90");
}

#[test]
fn a14_exactly_260_days() {
    assert_eq!(ctx_days_range("2026-01-25T00:00:00Z"), "181-260");
}

#[test]
fn a15_exactly_261_days() {
    assert_eq!(ctx_days_range("2026-01-24T00:00:00Z"), "261+");
}

#[test]
fn a16_oldest_wins() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // 45 days overdue
    seed_debt(&conn, "d1", 100.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));
    // 90 days overdue
    seed_debt(&conn, "d2", 100.0, "USD", "ACTIVE", Some("2026-07-14T00:00:00Z"));

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(ctx.debtor.days_overdue_range, "61-90");
}

// ---------------------------------------------------------------------
// 2a-17 — privacy: no identifiers in the serialized context
// ---------------------------------------------------------------------

#[test]
fn a17_serialized_context_has_no_identifiers() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-id-ZZZ-MARKER", 5678.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));
    // Comm with a body marker to check that message bodies do not leak.
    conn.execute(
        "INSERT INTO communications (id, debtor_id, type, direction, content,
                                     duration, created_by, data, created_at)
         VALUES ('comm-ZZZ-MARKER', ?1, 'EMAIL', 'OUTBOUND',
                 'UNIQUE_BODY_MARKER_ZZZ', NULL, NULL, '{}',
                 '2026-09-01T00:00:00Z')",
        params![DEBTOR_ID],
    )
    .expect("seed comm");

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    let json = serde_json::to_string(&ctx).expect("serialize");

    // Forbidden substrings.
    for needle in [
        "ZZZTestName",
        "ZZZSurname",
        "z@example.invalid",
        "+10000000000",
        DEBTOR_ID,
        "debt-id-ZZZ-MARKER",
        "comm-ZZZ-MARKER",
        "UNIQUE_BODY_MARKER_ZZZ",
        "2026-08-28", // no exact due date
        "5678",       // no exact amount
    ] {
        assert!(
            !json.contains(needle),
            "serialized context must not contain {:?}\njson: {}",
            needle,
            json
        );
    }
}

// ---------------------------------------------------------------------
// 2a-18 — NOTE exclusion rules
// ---------------------------------------------------------------------

#[test]
fn a18_note_excluded_from_channel_counts_and_rates() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // 2 EMAIL out
    seed_comm(&conn, "e1", "EMAIL", "OUTBOUND");
    seed_comm(&conn, "e2", "EMAIL", "OUTBOUND");
    // 1 SMS out
    seed_comm(&conn, "s1", "SMS", "OUTBOUND");
    // 3 NOTE out
    seed_comm(&conn, "n1", "NOTE", "OUTBOUND");
    seed_comm(&conn, "n2", "NOTE", "OUTBOUND");
    seed_comm(&conn, "n3", "NOTE", "OUTBOUND");
    // 1 EMAIL in
    seed_comm(&conn, "i1", "EMAIL", "INBOUND");

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.communication_history.total_count, 7);
    assert_eq!(ctx.communication_history.email_count, 3);
    assert_eq!(ctx.communication_history.sms_count, 1);
    assert_eq!(ctx.communication_history.voice_count, 0);
    assert_eq!(ctx.communication_history.response_rate_band, "MEDIUM"); // 1/3 ≈ 0.333
    assert_eq!(ctx.indicators.engagement_level, "MEDIUM"); // 1/4 = 0.25
    assert_eq!(ctx.indicators.communication_preference.as_deref(), Some("EMAIL"));
}

// ---------------------------------------------------------------------
// 2a-19 through 2a-22 — currency, null due dates, CANCELLED
// ---------------------------------------------------------------------

#[test]
fn a19_primary_currency_is_most_common_unpaid() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 1000.0, "USD", "ACTIVE", None);
    seed_debt(&conn, "d2", 500.0, "EUR", "ACTIVE", None);
    seed_debt(&conn, "d3", 500.0, "USD", "ACTIVE", None);

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    // USD has 2 unpaid debts vs EUR 1 -> sum USD = 1500 -> "1000-2500"
    assert_eq!(ctx.debtor.amount_range, "1000-2500");
}

#[test]
fn a20_primary_currency_tie_breaks_alphabetically() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.0, "EUR", "ACTIVE", None);
    seed_debt(&conn, "d2", 500.0, "USD", "ACTIVE", None);

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    // EUR < USD alphabetically -> sum EUR = 500 -> "0-1000"
    assert_eq!(ctx.debtor.amount_range, "0-1000");
}

#[test]
fn a21_null_due_date_not_overdue() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.0, "USD", "ACTIVE", None);

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debts.overdue_count, 0);
    assert_eq!(ctx.debtor.days_overdue_range, "0");
    assert_eq!(ctx.debts.total_count, 1);
}

#[test]
fn a22_cancelled_excluded_from_everything() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // CANCELLED, 5000 USD, 90 days overdue
    seed_debt(&conn, "d1", 5000.0, "USD", "CANCELLED", Some("2026-07-14T00:00:00Z"));
    // ACTIVE, 100 USD, no due date
    seed_debt(&conn, "d2", 100.0, "USD", "ACTIVE", None);

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");

    assert_eq!(ctx.debts.total_count, 1, "CANCELLED excluded from totalCount");
    assert_eq!(ctx.debts.overdue_count, 0, "CANCELLED excluded from overdue");
    assert_eq!(ctx.debtor.amount_range, "0-1000", "only the 100 USD ACTIVE debt counts");
}

// ---------------------------------------------------------------------
// 2d-1 through 2d-5 — FallbackInput derivation
// ---------------------------------------------------------------------

#[test]
fn d1_no_facts() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);

    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(f.days_overdue, 0);
    assert_eq!(f.response_rate, 0.0);
}

#[test]
fn d2_overdue_and_response() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 5000.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));
    for i in 0..5 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }
    for i in 0..3 {
        seed_comm(&conn, &format!("i{}", i), "EMAIL", "INBOUND");
    }

    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(f.days_overdue, 45);
    assert!((f.response_rate - 0.6).abs() < 1e-9);
}

#[test]
fn d3_oldest_overdue_wins_zero_response() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 100.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));
    seed_debt(&conn, "d2", 100.0, "USD", "ACTIVE", Some("2026-07-14T00:00:00Z"));
    for i in 0..5 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }

    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(f.days_overdue, 90);
    assert_eq!(f.response_rate, 0.0);
}

#[test]
fn d4_note_only_comms_have_zero_response() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    for i in 0..10 {
        seed_comm(&conn, &format!("n{}", i), "NOTE", "OUTBOUND");
    }
    for i in 0..5 {
        seed_comm(&conn, &format!("m{}", i), "NOTE", "INBOUND");
    }

    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(f.response_rate, 0.0, "NOTE is excluded from both sides");
}

#[test]
fn d5_zero_outbound_non_note_is_zero_rate() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_comm(&conn, "i1", "EMAIL", "INBOUND");
    seed_comm(&conn, "i2", "EMAIL", "INBOUND");
    seed_comm(&conn, "i3", "EMAIL", "INBOUND");

    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build");
    assert_eq!(f.response_rate, 0.0);
}