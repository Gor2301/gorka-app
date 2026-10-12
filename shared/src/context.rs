// gorka-shared::context
//
// Slice 2 of the AI Copilot work.
// Authority: SLICE-2-MINI-SPEC v1.1 §4, §6.
//
// Two projections of the same local facts:
//   Context       — banded, serializable, never sent in Slice 2.
//   FallbackInput — exact numbers, local only, never serialized.
//
// No identifiers, amounts, dates, or message bodies appear in the
// serialized Context.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub debtor: DebtorContext,
    pub communication_history: CommunicationHistory,
    pub debts: DebtsSummary,
    pub indicators: Indicators,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtorContext {
    pub amount_range: String,
    pub days_overdue_range: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunicationHistory {
    pub total_count: i64,
    pub email_count: i64,
    pub sms_count: i64,
    pub voice_count: i64,
    pub response_rate_band: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtsSummary {
    pub total_count: i64,
    pub paid_count: i64,
    pub overdue_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Indicators {
    pub payment_reliability: String,
    pub engagement_level: String,
    pub communication_preference: Option<String>,
}

/// Exact numeric inputs to the fallback. Local only. Never serialized.
#[derive(Debug, Clone, Copy)]
pub struct FallbackInput {
    pub days_overdue: i64,
    pub response_rate: f64,
}

// ---------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------

pub fn build_context(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
    reference_time: DateTime<Utc>,
) -> Result<Context, String> {
    let facts = load_facts(conn, organization_id, debtor_id)?;
    Ok(project_context(&facts, reference_time))
}

pub fn build_fallback_input(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
    reference_time: DateTime<Utc>,
) -> Result<FallbackInput, String> {
    let facts = load_facts(conn, organization_id, debtor_id)?;
    Ok(project_fallback_input(&facts, reference_time))
}

// ---------------------------------------------------------------------
// Internal facts — one set of reads, two projections
// ---------------------------------------------------------------------

#[derive(Debug, Clone)]
struct DebtRow {
    amount: f64,
    currency: String,
    status: String,
    due_date: Option<String>,
}

#[derive(Debug, Clone)]
struct CommRow {
    comm_type: String,
    direction: String,
}

#[derive(Debug, Clone)]
struct DebtorFacts {
    debts: Vec<DebtRow>,
    comms: Vec<CommRow>,
}

fn load_facts(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<DebtorFacts, String> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM debtors
             WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            params![debtor_id, organization_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err(format!("Debtor {} not found in organization", debtor_id));
    }

    let mut debt_stmt = conn
        .prepare("SELECT amount, currency, status, due_date FROM debts WHERE debtor_id = ?1")
        .map_err(|e| e.to_string())?;
    let debt_iter = debt_stmt
        .query_map(params![debtor_id], |row| {
            Ok(DebtRow {
                amount: row.get::<_, Option<f64>>(0)?.unwrap_or(0.0),
                currency: row
                    .get::<_, Option<String>>(1)?
                    .unwrap_or_else(|| "USD".to_string()),
                status: row
                    .get::<_, Option<String>>(2)?
                    .unwrap_or_else(|| "ACTIVE".to_string()),
                due_date: row.get::<_, Option<String>>(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut debts = Vec::new();
    for r in debt_iter {
        debts.push(r.map_err(|e| e.to_string())?);
    }

    let mut comm_stmt = conn
        .prepare("SELECT type, direction FROM communications WHERE debtor_id = ?1")
        .map_err(|e| e.to_string())?;
    let comm_iter = comm_stmt
        .query_map(params![debtor_id], |row| {
            Ok(CommRow {
                comm_type: row.get::<_, String>(0)?,
                direction: row.get::<_, String>(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut comms = Vec::new();
    for r in comm_iter {
        comms.push(r.map_err(|e| e.to_string())?);
    }

    Ok(DebtorFacts { debts, comms })
}

// ---------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------

fn project_context(facts: &DebtorFacts, reference_time: DateTime<Utc>) -> Context {
    let debt_stats = compute_debt_stats(facts, reference_time);
    let comm_stats = compute_comm_stats(&facts.comms);

    let payment_reliability = if debt_stats.total_count == 0 {
        "NO_DATA".to_string()
    } else {
        let ratio = debt_stats.paid_count as f64 / debt_stats.total_count as f64;
        if ratio >= 0.7 {
            "GOOD"
        } else if ratio >= 0.3 {
            "FAIR"
        } else {
            "POOR"
        }
        .to_string()
    };

    let response_rate_band = if comm_stats.outbound == 0 {
        "NONE".to_string()
    } else {
        let rate = comm_stats.inbound as f64 / comm_stats.outbound as f64;
        if rate < 0.2 {
            "LOW"
        } else if rate < 0.5 {
            "MEDIUM"
        } else {
            "HIGH"
        }
        .to_string()
    };

    let engagement_level = {
        let denom = comm_stats.inbound + comm_stats.outbound;
        if denom == 0 {
            "LOW".to_string()
        } else {
            let ratio = comm_stats.inbound as f64 / denom as f64;
            if ratio < 0.2 {
                "LOW"
            } else if ratio < 0.5 {
                "MEDIUM"
            } else {
                "HIGH"
            }
            .to_string()
        }
    };

    let communication_preference = pick_communication_preference(&comm_stats);

    Context {
        debtor: DebtorContext {
            amount_range: band_amount(debt_stats.outstanding_amount).to_string(),
            days_overdue_range: band_days(debt_stats.oldest_overdue_days).to_string(),
        },
        communication_history: CommunicationHistory {
            total_count: comm_stats.total,
            email_count: comm_stats.email_count,
            sms_count: comm_stats.sms_count,
            voice_count: comm_stats.voice_count,
            response_rate_band,
        },
        debts: DebtsSummary {
            total_count: debt_stats.total_count,
            paid_count: debt_stats.paid_count,
            overdue_count: debt_stats.overdue_count,
        },
        indicators: Indicators {
            payment_reliability,
            engagement_level,
            communication_preference,
        },
    }
}

fn project_fallback_input(facts: &DebtorFacts, reference_time: DateTime<Utc>) -> FallbackInput {
    let debt_stats = compute_debt_stats(facts, reference_time);
    let comm_stats = compute_comm_stats(&facts.comms);

    let response_rate = if comm_stats.outbound == 0 {
        0.0
    } else {
        comm_stats.inbound as f64 / comm_stats.outbound as f64
    };

    FallbackInput {
        days_overdue: debt_stats.oldest_overdue_days,
        response_rate,
    }
}

// ---------------------------------------------------------------------
// Debt statistics
// ---------------------------------------------------------------------

struct DebtStats {
    total_count: i64,
    paid_count: i64,
    overdue_count: i64,
    oldest_overdue_days: i64,
    outstanding_amount: f64,
}

fn compute_debt_stats(facts: &DebtorFacts, reference_time: DateTime<Utc>) -> DebtStats {
    let mut total_count = 0i64;
    let mut paid_count = 0i64;
    let mut overdue_count = 0i64;
    let mut oldest_overdue_days = 0i64;
    let mut has_overdue = false;

    // Per-currency tallies for unpaid debts only.
    let mut currency_count: HashMap<String, i64> = HashMap::new();
    let mut currency_amount: HashMap<String, f64> = HashMap::new();

    for d in &facts.debts {
        if d.status == "CANCELLED" {
            continue;
        }
        total_count += 1;
        if d.status == "PAID" {
            paid_count += 1;
            continue;
        }
        // Unpaid, non-cancelled.
        *currency_count.entry(d.currency.clone()).or_insert(0) += 1;
        *currency_amount.entry(d.currency.clone()).or_insert(0.0) += d.amount;

        if let Some(due_str) = &d.due_date {
            if let Some(days) = days_before_reference(due_str, reference_time) {
                overdue_count += 1;
                if !has_overdue || days > oldest_overdue_days {
                    oldest_overdue_days = days;
                    has_overdue = true;
                }
            }
        }
    }

    // Primary currency: most common among unpaid, ties alphabetically.
    let mut primary: Option<(String, i64)> = None;
    for (curr, cnt) in currency_count.iter() {
        primary = match primary {
            None => Some((curr.clone(), *cnt)),
            Some((prev, prev_cnt)) => {
                if *cnt > prev_cnt || (*cnt == prev_cnt && curr.as_str() < prev.as_str()) {
                    Some((curr.clone(), *cnt))
                } else {
                    Some((prev, prev_cnt))
                }
            }
        };
    }

    let outstanding_amount = primary
        .as_ref()
        .and_then(|(c, _)| currency_amount.get(c))
        .copied()
        .unwrap_or(0.0);

    DebtStats {
        total_count,
        paid_count,
        overdue_count,
        oldest_overdue_days: if has_overdue { oldest_overdue_days } else { 0 },
        outstanding_amount,
    }
}

/// Days from due_date to reference_time. Returns None if due_date is
/// not parseable, or if due_date is on or after reference_time.
fn days_before_reference(due_str: &str, reference_time: DateTime<Utc>) -> Option<i64> {
    let due = DateTime::parse_from_rfc3339(due_str)
        .ok()?
        .with_timezone(&Utc);
    if due >= reference_time {
        return None;
    }
    Some((reference_time - due).num_days())
}

// ---------------------------------------------------------------------
// Communication statistics
// ---------------------------------------------------------------------

struct CommStats {
    total: i64,
    email_count: i64,
    sms_count: i64,
    voice_count: i64,
    outbound: i64,
    inbound: i64,
    email_out: i64,
    sms_out: i64,
    voice_out: i64,
}

fn compute_comm_stats(comms: &[CommRow]) -> CommStats {
    let mut s = CommStats {
        total: 0,
        email_count: 0,
        sms_count: 0,
        voice_count: 0,
        outbound: 0,
        inbound: 0,
        email_out: 0,
        sms_out: 0,
        voice_out: 0,
    };

    for c in comms {
        s.total += 1;
        if c.comm_type == "NOTE" {
            continue;
        }
        match c.comm_type.as_str() {
            "EMAIL" => s.email_count += 1,
            "SMS" => s.sms_count += 1,
            "CALL" => s.voice_count += 1,
            _ => {}
        }
        if c.direction == "OUTBOUND" {
            s.outbound += 1;
            match c.comm_type.as_str() {
                "EMAIL" => s.email_out += 1,
                "SMS" => s.sms_out += 1,
                "CALL" => s.voice_out += 1,
                _ => {}
            }
        } else if c.direction == "INBOUND" {
            s.inbound += 1;
        }
    }

    s
}

fn pick_communication_preference(s: &CommStats) -> Option<String> {
    let mut best: Option<(&'static str, i64)> = None;
    for (name, count) in [
        ("EMAIL", s.email_out),
        ("SMS", s.sms_out),
        ("VOICE", s.voice_out),
    ] {
        if count == 0 {
            continue;
        }
        best = match best {
            None => Some((name, count)),
            Some((prev_name, prev_cnt)) => {
                if count > prev_cnt || (count == prev_cnt && name < prev_name) {
                    Some((name, count))
                } else {
                    Some((prev_name, prev_cnt))
                }
            }
        };
    }
    best.map(|(n, _)| n.to_string())
}

// ---------------------------------------------------------------------
// Banding
// ---------------------------------------------------------------------

fn band_amount(amount: f64) -> &'static str {
    if amount < 1000.0 {
        "0-1000"
    } else if amount < 2500.0 {
        "1000-2500"
    } else if amount < 5000.0 {
        "2500-5000"
    } else if amount < 7500.0 {
        "5000-7500"
    } else if amount < 10000.0 {
        "7500-10000"
    } else {
        "10000+"
    }
}

fn band_days(days: i64) -> &'static str {
    if days <= 0 {
        "0"
    } else if days <= 30 {
        "1-30"
    } else if days <= 60 {
        "31-60"
    } else if days <= 90 {
        "61-90"
    } else if days <= 180 {
        "91-180"
    } else if days <= 260 {
        "181-260"
    } else {
        "261+"
    }
}