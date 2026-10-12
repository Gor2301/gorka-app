// shared/tests/slice4_fact_validation.rs
//
// Slice 4 acceptance tests: fact validation and claim resolution.
// Authority: SLICE 4 — MINI SPEC v1.0 (FROZEN), §7, §8, §9.
//
// Detection vocabulary, frozen for this test file:
//   DollarAmount           [$€£] then optional space then digits
//                          with optional comma groups and optional
//                          .dd. Currency determined from the symbol.
//   CalendarDate           DD-MM-YYYY, day 01-31, month 01-12.
//                          YYYY-MM-DD is not detected.
//   InvoiceRef             INV-<alnum>+ or #<alnum>+.
//   PriorPromisePayment    fixed phrase list ("promised to pay",
//                          "promised payment", "agreed to pay by",
//                          "committed to pay").
//   LegalOrCreditConsequence
//                          fixed phrase list of 7 literal sentences.
//
// db_value format is not asserted exactly (implementation detail).

use chrono::{DateTime, Utc};
use gorka_shared::claim_resolution::{resolve_claim, ResolutionChoice, ResolutionError};
use gorka_shared::db::open_in_memory_for_tests;
use gorka_shared::fact_validation::{
    validate_draft, ClaimFlag, ClaimSource, ClaimType, Verification,
};
use rusqlite::params;

const ORG_ID: &str = "org-fv";
const DEBTOR_ID: &str = "debtor-fv-1";

fn ref_time() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-13T00:00:00Z")
        .expect("parse ref time")
        .with_timezone(&Utc)
}

fn seed_debtor(conn: &rusqlite::Connection) {
    conn.execute(
        "INSERT INTO debtors (id, organization_id, name, surname, email, phone,
                              data, created_at, updated_at)
         VALUES (?1, ?2, 'ZZZTest', 'ZZZSur', 'z@example.invalid',
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
    description: Option<&str>,
) {
    conn.execute(
        "INSERT INTO debts (id, debtor_id, amount, currency, status, due_date,
                            description, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '{}',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, DEBTOR_ID, amount, currency, status, due_date, description],
    )
    .expect("seed debt");
}

fn flags_of_type(flags: &[ClaimFlag], t: ClaimType) -> Vec<&ClaimFlag> {
    flags.iter().filter(|f| f.claim_type == t).collect()
}

// ---------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------

#[test]
fn detect_dollar_amount_present() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Amount $500.00 due.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    assert_eq!(da[0].matched_text, "$500.00");
    assert_eq!(da[0].source, ClaimSource::Body);
}

#[test]
fn detect_dollar_amount_absent() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "No currency here.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::DollarAmount).is_empty());
}

#[test]
fn detect_calendar_date_present() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Due by 15-11-2026.", 1).unwrap();
    let cd = flags_of_type(&flags, ClaimType::CalendarDate);
    assert_eq!(cd.len(), 1);
    assert_eq!(cd[0].matched_text, "15-11-2026");
}

#[test]
fn detect_calendar_date_absent() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "No date here.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::CalendarDate).is_empty());
}

#[test]
fn detect_invoice_ref_present() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Ref INV-001 please.", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert_eq!(ir[0].matched_text, "INV-001");
}

#[test]
fn detect_invoice_ref_absent() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "No ref here.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::InvoiceRef).is_empty());
}

#[test]
fn detect_prior_promise_payment_present() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        "",
        "You promised to pay last week.",
        1,
    )
    .unwrap();
    let pp = flags_of_type(&flags, ClaimType::PriorPromisePayment);
    assert_eq!(pp.len(), 1);
}

#[test]
fn detect_prior_promise_payment_absent() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Nothing here.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::PriorPromisePayment).is_empty());
}

#[test]
fn detect_legal_consequence_present() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        "",
        "This will be reported to the credit bureaus.",
        1,
    )
    .unwrap();
    let lc = flags_of_type(&flags, ClaimType::LegalOrCreditConsequence);
    assert_eq!(lc.len(), 1);
}

#[test]
fn detect_legal_consequence_absent() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Nothing legal.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::LegalOrCreditConsequence).is_empty());
}

// ---------------------------------------------------------------------
// Source and span
// ---------------------------------------------------------------------

#[test]
fn claim_in_subject_has_source_subject() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "Ref INV-001", "Body.", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert_eq!(ir[0].source, ClaimSource::Subject);
}

#[test]
fn claim_in_body_has_source_body() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "Subject.", "Ref INV-001", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert_eq!(ir[0].source, ClaimSource::Body);
}

#[test]
fn span_matches_text_and_is_valid_utf8_boundary() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let body = "Please pay $500.00 today.";
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", body, 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    let f = da[0];
    assert!(f.span_start < f.span_end);
    assert!(f.span_end <= body.len());
    assert!(body.is_char_boundary(f.span_start));
    assert!(body.is_char_boundary(f.span_end));
    assert_eq!(&body[f.span_start..f.span_end], f.matched_text);
}

#[test]
fn span_correct_after_non_ascii_prefix() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    // "é" is 2 bytes in UTF-8; the $ span must be a valid boundary.
    let body = "caf\u{e9} $500.00 due";
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", body, 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    let f = da[0];
    assert!(body.is_char_boundary(f.span_start));
    assert!(body.is_char_boundary(f.span_end));
    assert_eq!(&body[f.span_start..f.span_end], f.matched_text);
    assert_eq!(f.matched_text, "$500.00");
}

#[test]
fn multiple_claims_same_field_produce_multiple_flags() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let body = "First $500.00 then $700.00.";
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", body, 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 2);
    let texts: Vec<&str> = da.iter().map(|f| f.matched_text.as_str()).collect();
    assert!(texts.contains(&"$500.00"));
    assert!(texts.contains(&"$700.00"));
}

#[test]
fn claims_in_both_subject_and_body() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        "Ref INV-001",
        "Please pay $500.00.",
        1,
    )
    .unwrap();
    let sources: Vec<(ClaimSource, ClaimType)> =
        flags.iter().map(|f| (f.source, f.claim_type)).collect();
    assert!(sources.contains(&(ClaimSource::Subject, ClaimType::InvoiceRef)));
    assert!(sources.contains(&(ClaimSource::Body, ClaimType::DollarAmount)));
}

// ---------------------------------------------------------------------
// DollarAmount verification
// ---------------------------------------------------------------------

#[test]
fn dollar_amount_single_matching_debt_verified() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.00, "USD", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "You owe $500.00.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    assert!(matches!(da[0].verification, Verification::Verified { .. }));
}

#[test]
fn dollar_amount_single_matching_debt_different_cents_mismatch() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 499.99, "USD", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "You owe $500.00.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    assert!(matches!(da[0].verification, Verification::Mismatch { .. }));
}

#[test]
fn dollar_amount_no_debts_same_currency_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.00, "EUR", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "You owe $500.00.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    assert!(matches!(da[0].verification, Verification::Unverifiable));
}

#[test]
fn dollar_amount_multiple_same_currency_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.00, "USD", "ACTIVE", None, None);
    seed_debt(&conn, "d2", 500.00, "USD", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "You owe $500.00.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    assert!(matches!(da[0].verification, Verification::Unverifiable));
}

#[test]
fn dollar_amount_cancelled_debt_excluded() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "d1", 500.00, "USD", "CANCELLED", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "You owe $500.00.", 1).unwrap();
    let da = flags_of_type(&flags, ClaimType::DollarAmount);
    assert_eq!(da.len(), 1);
    // Cancelled debt is not a candidate at all, so we have zero candidates.
    assert!(matches!(da[0].verification, Verification::Unverifiable));
}

// ---------------------------------------------------------------------
// CalendarDate verification
// ---------------------------------------------------------------------

#[test]
fn calendar_date_matches_due_date_verified() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(
        &conn,
        "d1",
        500.0,
        "USD",
        "ACTIVE",
        Some("2026-11-15T00:00:00Z"),
        None,
    );
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Due by 15-11-2026.", 1).unwrap();
    let cd = flags_of_type(&flags, ClaimType::CalendarDate);
    assert_eq!(cd.len(), 1);
    assert!(matches!(cd[0].verification, Verification::Verified { .. }));
}

#[test]
fn calendar_date_candidates_exist_none_match_mismatch() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(
        &conn,
        "d1",
        500.0,
        "USD",
        "ACTIVE",
        Some("2026-12-01T00:00:00Z"),
        None,
    );
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Due by 15-11-2026.", 1).unwrap();
    let cd = flags_of_type(&flags, ClaimType::CalendarDate);
    assert_eq!(cd.len(), 1);
    assert!(matches!(cd[0].verification, Verification::Mismatch { .. }));
}

#[test]
fn calendar_date_no_candidates_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Due by 15-11-2026.", 1).unwrap();
    let cd = flags_of_type(&flags, ClaimType::CalendarDate);
    assert_eq!(cd.len(), 1);
    assert!(matches!(cd[0].verification, Verification::Unverifiable));
}

// ---------------------------------------------------------------------
// InvoiceRef verification
// ---------------------------------------------------------------------

#[test]
fn invoice_ref_exact_id_match_verified() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "INV-001", 500.0, "USD", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Ref INV-001.", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert!(matches!(ir[0].verification, Verification::Verified { .. }));
}

#[test]
fn invoice_ref_no_exact_match_description_contains_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(
        &conn,
        "debt-xyz",
        500.0,
        "USD",
        "ACTIVE",
        None,
        Some("Payment for INV-001"),
    );
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Ref INV-001.", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert!(matches!(ir[0].verification, Verification::Unverifiable));
}

#[test]
fn invoice_ref_no_exact_no_description_mismatch() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "debt-xyz", 500.0, "USD", "ACTIVE", None, None);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Ref INV-001.", 1).unwrap();
    let ir = flags_of_type(&flags, ClaimType::InvoiceRef);
    assert_eq!(ir.len(), 1);
    assert!(matches!(ir[0].verification, Verification::Mismatch { .. }));
}

// ---------------------------------------------------------------------
// Always-Unverifiable types
// ---------------------------------------------------------------------

#[test]
fn prior_promise_payment_detected_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        "",
        "You promised to pay last week.",
        1,
    )
    .unwrap();
    let pp = flags_of_type(&flags, ClaimType::PriorPromisePayment);
    assert_eq!(pp.len(), 1);
    assert!(matches!(pp[0].verification, Verification::Unverifiable));
}

#[test]
fn legal_consequence_template_match_unverifiable() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        "",
        "This will be reported to the credit bureaus.",
        1,
    )
    .unwrap();
    let lc = flags_of_type(&flags, ClaimType::LegalOrCreditConsequence);
    assert_eq!(lc.len(), 1);
    assert!(matches!(lc[0].verification, Verification::Unverifiable));
}

#[test]
fn legal_consequence_no_template_no_flag() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let flags = validate_draft(&conn, ORG_ID, DEBTOR_ID, "", "Just a friendly note.", 1).unwrap();
    assert!(flags_of_type(&flags, ClaimType::LegalOrCreditConsequence).is_empty());
}

// ---------------------------------------------------------------------
// resolve_claim
// ---------------------------------------------------------------------

#[test]
fn resolve_edit_removed_claim_still_present_err() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let body = "You owe $500.00 today.";
    let matched = "$500.00";
    let start = body.find(matched).expect("claim present");
    let flag = ClaimFlag {
        claim_type: ClaimType::DollarAmount,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Unverifiable,
        draft_id: 5,
    };
    let err = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::EditRemoved,
        "user-1",
        ref_time(),
    )
    .unwrap_err();
    assert!(matches!(err, ResolutionError::ClaimStillPresent));
}

#[test]
fn resolve_edit_removed_claim_removed_ok() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    let original = "Dear Sir, $500.00 due.";
    let matched = "$500.00";
    let start = original.find(matched).expect("claim present");
    // Edited draft: claim removed; same byte length as original.
    let edited = "Dear Sir, nothing due.";
    assert_eq!(original.len(), edited.len());
    let flag = ClaimFlag {
        claim_type: ClaimType::DollarAmount,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Unverifiable,
        draft_id: 3,
    };
    let rec = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        edited,
        &flag,
        ResolutionChoice::EditRemoved,
        "user-1",
        ref_time(),
    )
    .unwrap();
    assert_eq!(rec.draft_id, 5);
    assert_eq!(rec.claim_type, ClaimType::DollarAmount);
    assert!(matches!(rec.choice, ResolutionChoice::EditRemoved));
}

#[test]
fn resolve_selected_db_value_invoice_ref_matching_ok() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "INV-001", 500.0, "USD", "ACTIVE", None, None);
    let body = "Reference INV-001 for details.";
    let matched = "INV-001";
    let start = body.find(matched).expect("claim present");
    let flag = ClaimFlag {
        claim_type: ClaimType::InvoiceRef,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Verified {
            db_value: "INV-001".to_string(),
        },
        draft_id: 5,
    };
    let rec = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::SelectedDbValue {
            value: "INV-001".to_string(),
            source_row_id: "INV-001".to_string(),
        },
        "user-1",
        ref_time(),
    )
    .unwrap();
    assert!(matches!(rec.choice, ResolutionChoice::SelectedDbValue { .. }));
}

#[test]
fn resolve_selected_db_value_invoice_ref_no_match_err() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    // No matching debt row.
    let body = "Reference INV-999 for details.";
    let matched = "INV-999";
    let start = body.find(matched).expect("claim present");
    let flag = ClaimFlag {
        claim_type: ClaimType::InvoiceRef,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Unverifiable,
        draft_id: 5,
    };
    let err = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::SelectedDbValue {
            value: "INV-999".to_string(),
            source_row_id: "INV-999".to_string(),
        },
        "user-1",
        ref_time(),
    )
    .unwrap_err();
    assert!(matches!(err, ResolutionError::ValueNotInDb(_)));
}

#[test]
fn resolve_flag_future_draft_id_err() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "INV-001", 500.0, "USD", "ACTIVE", None, None);
    let body = "Reference INV-001 for details.";
    let matched = "INV-001";
    let start = body.find(matched).expect("claim present");
    let flag = ClaimFlag {
        claim_type: ClaimType::InvoiceRef,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Unverifiable,
        draft_id: 7, // newer than current
    };
    let err = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::SelectedDbValue {
            value: "INV-001".to_string(),
            source_row_id: "INV-001".to_string(),
        },
        "user-1",
        ref_time(),
    )
    .unwrap_err();
    match err {
        ResolutionError::StaleFlag {
            flag_draft_id,
            current_draft_id,
        } => {
            assert_eq!(flag_draft_id, 7);
            assert_eq!(current_draft_id, 5);
        }
        other => panic!("expected StaleFlag, got {:?}", other),
    }
}

#[test]
fn resolve_selected_db_value_on_legal_consequence_err() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "INV-001", 500.0, "USD", "ACTIVE", None, None);
    let body = "This will be reported to the credit bureaus.";
    let matched = "reported to the credit bureaus";
    let start = body.find(matched).expect("phrase present");
    let flag = ClaimFlag {
        claim_type: ClaimType::LegalOrCreditConsequence,
        source: ClaimSource::Body,
        span_start: start,
        span_end: start + matched.len(),
        matched_text: matched.to_string(),
        verification: Verification::Unverifiable,
        draft_id: 5,
    };
    let err = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::SelectedDbValue {
            value: "INV-001".to_string(),
            source_row_id: "INV-001".to_string(),
        },
        "user-1",
        ref_time(),
    )
    .unwrap_err();
    assert!(matches!(
        err,
        ResolutionError::ClaimTypeNotResolvable(ClaimType::LegalOrCreditConsequence)
    ));
}

#[test]
fn resolve_span_out_of_range_err() {
    let conn = open_in_memory_for_tests().expect("db");
    seed_debtor(&conn);
    seed_debt(&conn, "INV-001", 500.0, "USD", "ACTIVE", None, None);
    let body = "Reference INV-001 for details.";
    let flag = ClaimFlag {
        claim_type: ClaimType::InvoiceRef,
        source: ClaimSource::Body,
        span_start: 1000,
        span_end: 1010,
        matched_text: "whatever".to_string(),
        verification: Verification::Unverifiable,
        draft_id: 5,
    };
    let err = resolve_claim(
        &conn,
        ORG_ID,
        DEBTOR_ID,
        5,
        "",
        body,
        &flag,
        ResolutionChoice::SelectedDbValue {
            value: "INV-001".to_string(),
            source_row_id: "INV-001".to_string(),
        },
        "user-1",
        ref_time(),
    )
    .unwrap_err();
    assert!(matches!(err, ResolutionError::SpanOutOfRange));
}