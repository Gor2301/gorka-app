// shared/tests/slice2_fallback.rs
//
// Slice 2 acceptance tests: the deterministic fallback.
// Authority: SLICE-2-MINI-SPEC v1.1 §5, §6, §9.3, §9.4.
//
// The fallback is a pure function of (days_overdue, response_rate).
// No database, no network, no clock.

use gorka_shared::context::{build_context, build_fallback_input};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::recommendation::{
    fallback, Channel, Priority, Recommendation, Timing, Tone,
};
use chrono::{DateTime, Utc};
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
         VALUES (?1, ?2, 'Test', 'Debtor', NULL, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![DEBTOR_ID, ORG_ID],
    )
    .expect("seed debtor");
}

fn seed_debt(
    conn: &rusqlite::Connection,
    id: &str,
    amount: f64,
    status: &str,
    due_date: Option<&str>,
) {
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'USD', ?4, ?5, NULL, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, DEBTOR_ID, amount, status, due_date],
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
// 2b-1 through 2b-9 — pure fallback rules
// ---------------------------------------------------------------------

fn expect_rec(
    days_overdue: i64,
    response_rate: f64,
    priority: Priority,
    tone: Tone,
) {
    let r: Recommendation = fallback(days_overdue, response_rate);
    assert_eq!(r.channel, Channel::Email, "channel is always Email in MVP");
    assert_eq!(r.timing, Timing::Within3Days, "timing is always Within3Days");
    assert_eq!(
        r.priority, priority,
        "days={} rate={} expected priority {:?}",
        days_overdue, response_rate, priority
    );
    assert_eq!(
        r.tone, tone,
        "days={} rate={} expected tone {:?}",
        days_overdue, response_rate, tone
    );
}

#[test]
fn b1_90_days_low_response_is_urgent_high() {
    expect_rec(90, 0.1, Priority::High, Tone::Urgent);
}

#[test]
fn b2_90_days_high_response_is_firm_normal() {
    expect_rec(90, 0.5, Priority::Normal, Tone::Firm);
}

#[test]
fn b3_45_days_low_response_is_firm_normal() {
    expect_rec(45, 0.1, Priority::Normal, Tone::Firm);
}

#[test]
fn b4_10_days_is_friendly_normal() {
    expect_rec(10, 0.5, Priority::Normal, Tone::Friendly);
}

#[test]
fn b5_zero_days_is_friendly_normal() {
    expect_rec(0, 0.0, Priority::Normal, Tone::Friendly);
}

#[test]
fn b6_boundary_60_days_not_urgent() {
    // 60 is NOT > 60, so FIRM branch.
    expect_rec(60, 0.1, Priority::Normal, Tone::Firm);
}

#[test]
fn b7_boundary_30_days_not_firm() {
    // 30 is NOT > 30, so FRIENDLY branch.
    expect_rec(30, 0.1, Priority::Normal, Tone::Friendly);
}

#[test]
fn b8_boundary_rate_020_not_urgent() {
    // 0.2 is NOT < 0.2, so FIRM branch (days 90).
    expect_rec(90, 0.2, Priority::Normal, Tone::Firm);
}

#[test]
fn b9_61_days_019_rate_is_urgent_high() {
    // 61 > 60 and 0.19 < 0.2, so URGENT branch.
    expect_rec(61, 0.19, Priority::High, Tone::Urgent);
}

// ---------------------------------------------------------------------
// 2c-1 — cross-slice: context + fallback from the same fixture
// ---------------------------------------------------------------------

#[test]
fn c1_context_and_fallback_from_same_facts() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    // PAID: 5000 USD
    seed_debt(&conn, "d1", 5000.0, "PAID", Some("2026-06-01T00:00:00Z"));
    // Unpaid, 90 days overdue
    seed_debt(&conn, "d2", 2000.0, "ACTIVE", Some("2026-07-14T00:00:00Z"));
    // 5 outbound, 1 inbound EMAIL
    for i in 0..5 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }
    seed_comm(&conn, "i1", "EMAIL", "INBOUND");

    let ctx = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build ctx");
    let f = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("build input");
    let rec = fallback(f.days_overdue, f.response_rate);

    // Context assertions (hand-computed).
    assert_eq!(ctx.debts.total_count, 2);
    assert_eq!(ctx.debts.paid_count, 1);
    assert_eq!(ctx.debts.overdue_count, 1);
    assert_eq!(ctx.indicators.payment_reliability, "FAIR"); // 1/2 = 0.5
    assert_eq!(ctx.debtor.days_overdue_range, "61-90");

    // Fallback input assertions (hand-computed).
    assert_eq!(f.days_overdue, 90);
    assert!((f.response_rate - 0.2).abs() < 1e-9); // 1/5

    // Fallback output (90 > 60 but 0.2 is NOT < 0.2 -> FIRM).
    assert_eq!(rec.channel, Channel::Email);
    assert_eq!(rec.priority, Priority::Normal);
    assert_eq!(rec.tone, Tone::Firm);
    assert_eq!(rec.timing, Timing::Within3Days);
}

// ---------------------------------------------------------------------
// 2c-2 — determinism: same fixture, byte-identical outputs
// ---------------------------------------------------------------------

#[test]
fn c2_determinism_same_fixture_same_output() {
    let conn = open_in_memory_for_tests().expect("db init");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 3000.0, "USD", "ACTIVE", Some("2026-08-28T00:00:00Z"));
    seed_debt(&conn, "d2", 500.0, "USD", "ACTIVE", Some("2026-09-15T00:00:00Z"));
    for i in 0..3 {
        seed_comm(&conn, &format!("o{}", i), "EMAIL", "OUTBOUND");
    }
    seed_comm(&conn, "i1", "EMAIL", "INBOUND");

    let ctx1 = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("ctx1");
    let ctx2 = build_context(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("ctx2");
    let json1 = serde_json::to_string(&ctx1).expect("serialize 1");
    let json2 = serde_json::to_string(&ctx2).expect("serialize 2");

    assert_eq!(json1, json2, "context serialization must be deterministic");

    let f1 = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("f1");
    let f2 = build_fallback_input(&conn, ORG_ID, DEBTOR_ID, ref_time()).expect("f2");
    assert_eq!(f1.days_overdue, f2.days_overdue);
    assert_eq!(f1.response_rate, f2.response_rate);
}