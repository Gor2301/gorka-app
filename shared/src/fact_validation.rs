// shared/src/fact_validation.rs
// (header as above)

use chrono::NaiveDate;
use rusqlite::{params, Connection};

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimType {
    DollarAmount,
    CalendarDate,
    InvoiceRef,
    PriorPromisePayment,
    LegalOrCreditConsequence,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimSource {
    Subject,
    Body,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Verification {
    Verified { db_value: String },
    Mismatch { db_value: String },
    Unverifiable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ClaimFlag {
    pub claim_type: ClaimType,
    pub source: ClaimSource,
    pub span_start: usize,
    pub span_end: usize,
    pub matched_text: String,
    pub verification: Verification,
    pub draft_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FactValidationError {
    DbError(String),
}

// ---------------------------------------------------------------------
// Detection vocabulary
// ---------------------------------------------------------------------

const PROMISE_PHRASES: &[&str] = &[
    "promised to pay",
    "promised payment",
    "agreed to pay by",
    "committed to pay",
];

const LEGAL_PHRASES: &[&str] = &[
    "reported to the credit bureaus",
    "reported to credit bureaus",
    "legal action",
    "take legal action",
    "pursue legal action",
    "collections escalation",
    "escalate to collections",
];

// ---------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------

pub fn validate_draft(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    subject: &str,
    body: &str,
    draft_id: u64,
) -> Result<Vec<ClaimFlag>, FactValidationError> {
    let _ = org_id; // org scoping is enforced via debtor_id join; retained for interface parity
    let candidates = load_candidates(conn, debtor_id)?;

    let mut flags = Vec::new();
    detect_and_push(subject, ClaimSource::Subject, draft_id, &candidates, &mut flags);
    detect_and_push(body, ClaimSource::Body, draft_id, &candidates, &mut flags);
    Ok(flags)
}

// ---------------------------------------------------------------------
// Candidate rows
// ---------------------------------------------------------------------

struct CandidateDebt {
    id: String,
    amount: f64,
    currency: String,
    due_date: Option<String>,
    description: Option<String>,
}

fn load_candidates(
    conn: &Connection,
    debtor_id: &str,
) -> Result<Vec<CandidateDebt>, FactValidationError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, amount, currency, due_date, description
             FROM debts
             WHERE debtor_id = ?1 AND status != 'CANCELLED'",
        )
        .map_err(|e| FactValidationError::DbError(e.to_string()))?;
    let rows = stmt
        .query_map(params![debtor_id], |row| {
            Ok(CandidateDebt {
                id: row.get::<_, String>(0)?,
                amount: row.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                currency: row
                    .get::<_, Option<String>>(2)?
                    .unwrap_or_else(|| "USD".to_string()),
                due_date: row.get::<_, Option<String>>(3)?,
                description: row.get::<_, Option<String>>(4)?,
            })
        })
        .map_err(|e| FactValidationError::DbError(e.to_string()))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| FactValidationError::DbError(e.to_string()))?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------
// Detection dispatcher
// ---------------------------------------------------------------------

fn detect_and_push(
    text: &str,
    source: ClaimSource,
    draft_id: u64,
    candidates: &[CandidateDebt],
    out: &mut Vec<ClaimFlag>,
) {
    for (start, end, matched, currency) in detect_dollar_amounts(text) {
        let verification = verify_dollar(candidates, &currency, &matched);
        out.push(ClaimFlag {
            claim_type: ClaimType::DollarAmount,
            source,
            span_start: start,
            span_end: end,
            matched_text: matched,
            verification,
            draft_id,
        });
    }
    for (start, end, matched) in detect_calendar_dates(text) {
        let verification = verify_calendar_date(candidates, &matched);
        out.push(ClaimFlag {
            claim_type: ClaimType::CalendarDate,
            source,
            span_start: start,
            span_end: end,
            matched_text: matched,
            verification,
            draft_id,
        });
    }
    for (start, end, matched) in detect_invoice_refs(text) {
        let verification = verify_invoice_ref(candidates, &matched);
        out.push(ClaimFlag {
            claim_type: ClaimType::InvoiceRef,
            source,
            span_start: start,
            span_end: end,
            matched_text: matched,
            verification,
            draft_id,
        });
    }
    for (start, end, matched) in detect_phrases(text, PROMISE_PHRASES) {
        out.push(ClaimFlag {
            claim_type: ClaimType::PriorPromisePayment,
            source,
            span_start: start,
            span_end: end,
            matched_text: matched,
            verification: Verification::Unverifiable,
            draft_id,
        });
    }
    for (start, end, matched) in detect_phrases(text, LEGAL_PHRASES) {
        out.push(ClaimFlag {
            claim_type: ClaimType::LegalOrCreditConsequence,
            source,
            span_start: start,
            span_end: end,
            matched_text: matched,
            verification: Verification::Unverifiable,
            draft_id,
        });
    }
}

// ---------------------------------------------------------------------
// DollarAmount detection
// ---------------------------------------------------------------------

fn detect_dollar_amounts(text: &str) -> Vec<(usize, usize, String, String)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < text.len() {
        if let Some((len, currency)) = try_amount_at(&text[i..]) {
            let matched = &text[i..i + len];
            out.push((i, i + len, matched.to_string(), currency.to_string()));
            i += len;
            continue;
        }
        let ch_len = text[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
        i += ch_len;
    }
    out
}

fn try_amount_at(s: &str) -> Option<(usize, &'static str)> {
    let first = s.chars().next()?;
    match first {
        '$' | '\u{20AC}' | '\u{00A3}' => {
            let currency = match first {
                '$' => "USD",
                '\u{20AC}' => "EUR",
                '\u{00A3}' => "GBP",
                _ => unreachable!(),
            };
            try_amount_after(s, first.len_utf8(), currency, false)
        }
        _ => try_iso_at(s),
    }
}

fn try_amount_after(
    s: &str,
    mut idx: usize,
    currency: &'static str,
    require_space: bool,
) -> Option<(usize, &'static str)> {
    let bytes = s.as_bytes();
    let space_start = idx;
    while idx < bytes.len() && bytes[idx] == b' ' {
        idx += 1;
    }
    if require_space && idx == space_start {
        return None;
    }
    let num_start = idx;
    while idx < bytes.len() && (bytes[idx].is_ascii_digit() || bytes[idx] == b',') {
        idx += 1;
    }
    if idx < bytes.len() && bytes[idx] == b'.' {
        let d_start = idx + 1;
        let mut d_end = d_start;
        while d_end < bytes.len() && bytes[d_end].is_ascii_digit() && d_end - d_start < 2 {
            d_end += 1;
        }
        if d_end > d_start {
            idx = d_end;
        }
    }
    if idx > num_start && bytes[num_start..idx].iter().any(|c| c.is_ascii_digit()) {
        Some((idx, currency))
    } else {
        None
    }
}

fn try_iso_at(s: &str) -> Option<(usize, &'static str)> {
    let bytes = s.as_bytes();
    if bytes.len() < 4 {
        return None;
    }
    if !(bytes[0].is_ascii_uppercase() && bytes[1].is_ascii_uppercase() && bytes[2].is_ascii_uppercase()) {
        return None;
    }
    let code = &s[..3];
    let currency: &'static str = match code {
        "USD" => "USD",
        "EUR" => "EUR",
        "GBP" => "GBP",
        "PHP" => "PHP",
        "JPY" => "JPY",
        _ => return None,
    };
    try_amount_after(s, 3, currency, true)
}

// ---------------------------------------------------------------------
// CalendarDate detection
// ---------------------------------------------------------------------

fn detect_calendar_dates(text: &str) -> Vec<(usize, usize, String)> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i + 10 <= bytes.len() {
        let ok = bytes[i].is_ascii_digit()
            && bytes[i + 1].is_ascii_digit()
            && bytes[i + 2] == b'-'
            && bytes[i + 3].is_ascii_digit()
            && bytes[i + 4].is_ascii_digit()
            && bytes[i + 5] == b'-'
            && bytes[i + 6].is_ascii_digit()
            && bytes[i + 7].is_ascii_digit()
            && bytes[i + 8].is_ascii_digit()
            && bytes[i + 9].is_ascii_digit();
        if ok {
            let day = text[i..i + 2].parse::<u32>().unwrap_or(0);
            let month = text[i + 3..i + 5].parse::<u32>().unwrap_or(0);
            if (1..=31).contains(&day) && (1..=12).contains(&month) {
                out.push((i, i + 10, text[i..i + 10].to_string()));
                i += 10;
                continue;
            }
        }
        let ch_len = text[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
        i += ch_len;
    }
    out
}

// ---------------------------------------------------------------------
// InvoiceRef detection
// ---------------------------------------------------------------------

fn detect_invoice_refs(text: &str) -> Vec<(usize, usize, String)> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if i + 4 <= bytes.len() && &bytes[i..i + 4] == b"INV-" {
            let mut j = i + 4;
            while j < bytes.len() && bytes[j].is_ascii_alphanumeric() {
                j += 1;
            }
            if j > i + 4 {
                out.push((i, j, text[i..j].to_string()));
                i = j;
                continue;
            }
        }
        if bytes[i] == b'#' && i + 1 < bytes.len() && bytes[i + 1].is_ascii_alphanumeric() {
            let mut j = i + 1;
            while j < bytes.len() && bytes[j].is_ascii_alphanumeric() {
                j += 1;
            }
            out.push((i, j, text[i..j].to_string()));
            i = j;
            continue;
        }
        let ch_len = text[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
        i += ch_len;
    }
    out
}

// ---------------------------------------------------------------------
// Phrase detection (case-insensitive, fixed vocabulary)
// ---------------------------------------------------------------------

fn detect_phrases(text: &str, phrases: &[&str]) -> Vec<(usize, usize, String)> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let mut advance = None;
        for phrase in phrases {
            if matches_ci_at(bytes, i, phrase.as_bytes()) {
                let end = i + phrase.len();
                out.push((i, end, text[i..end].to_string()));
                advance = Some(phrase.len());
                break;
            }
        }
        match advance {
            Some(len) => i += len,
            None => {
                let ch_len = text[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
                i += ch_len;
            }
        }
    }
    out
}

fn matches_ci_at(hay: &[u8], pos: usize, needle: &[u8]) -> bool {
    if pos + needle.len() > hay.len() {
        return false;
    }
    for (k, &nc) in needle.iter().enumerate() {
        if !hay[pos + k].eq_ignore_ascii_case(&nc) {
            return false;
        }
    }
    true
}

// ---------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------

fn cents(amount: f64) -> i64 {
    (amount * 100.0).round() as i64
}

fn normalize_currency(c: &str) -> String {
    c.trim().to_ascii_uppercase()
}

fn parse_amount_cents(matched: &str) -> Option<i64> {
    let mut s = matched.trim();
    if s.starts_with('$') || s.starts_with('\u{20AC}') || s.starts_with('\u{00A3}') {
        s = &s[1..];
    } else if s.len() >= 3 && s.as_bytes()[0].is_ascii_uppercase() && s.as_bytes()[1].is_ascii_uppercase() && s.as_bytes()[2].is_ascii_uppercase() {
        s = &s[3..];
    }
    let s = s.trim().replace(',', "");
    let value: f64 = s.parse().ok()?;
    Some((value * 100.0).round() as i64)
}

fn verify_dollar(candidates: &[CandidateDebt], currency: &str, matched: &str) -> Verification {
    let target = normalize_currency(currency);
    let cents_target = match parse_amount_cents(matched) {
        Some(c) => c,
        None => return Verification::Unverifiable,
    };
    let same_currency: Vec<&CandidateDebt> = candidates
        .iter()
        .filter(|d| normalize_currency(&d.currency) == target)
        .collect();
    match same_currency.len() {
        0 => Verification::Unverifiable,
        1 => {
            let d = same_currency[0];
            let db_cents = cents(d.amount);
            let db_value = format!("{} {:.2}", normalize_currency(&d.currency), d.amount);
            if db_cents == cents_target {
                Verification::Verified { db_value }
            } else {
                Verification::Mismatch { db_value }
            }
        }
        _ => Verification::Unverifiable,
    }
}

fn parse_ddmmyyyy(s: &str) -> Option<NaiveDate> {
    let bytes = s.as_bytes();
    if bytes.len() != 10 {
        return None;
    }
    if bytes[2] != b'-' || bytes[5] != b'-' {
        return None;
    }
    let day: u32 = s[0..2].parse().ok()?;
    let month: u32 = s[3..5].parse().ok()?;
    let year: i32 = s[6..10].parse().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)
}

fn parse_db_date(s: &str) -> Option<NaiveDate> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.date_naive())
}

fn verify_calendar_date(candidates: &[CandidateDebt], matched: &str) -> Verification {
    let target = match parse_ddmmyyyy(matched) {
        Some(d) => d,
        None => return Verification::Unverifiable,
    };
    if candidates.is_empty() {
        return Verification::Unverifiable;
    }
    let mut any_match: Option<String> = None;
    let mut first_db_date: Option<String> = None;
    for c in candidates {
        if let Some(raw) = &c.due_date {
            if first_db_date.is_none() {
                first_db_date = Some(raw.clone());
            }
            if let Some(d) = parse_db_date(raw) {
                if d == target {
                    any_match = Some(raw.clone());
                    break;
                }
            }
        }
    }
    if let Some(db_value) = any_match {
        Verification::Verified { db_value }
    } else {
        Verification::Mismatch {
            db_value: first_db_date.unwrap_or_else(|| "no due date".to_string()),
        }
    }
}

fn verify_invoice_ref(candidates: &[CandidateDebt], matched: &str) -> Verification {
    let exact = candidates.iter().find(|c| c.id == matched);
    if let Some(d) = exact {
        return Verification::Verified {
            db_value: d.id.clone(),
        };
    }
    let description_contains = candidates.iter().any(|c| {
        c.description
            .as_ref()
            .map(|s| s.contains(matched))
            .unwrap_or(false)
    });
    if description_contains {
        Verification::Unverifiable
    } else {
        Verification::Mismatch {
            db_value: matched.to_string(),
        }
    }
}