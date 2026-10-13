// gorka-shared::recommendation_store
//
// Slice 5a. Recommendation persistence and lifecycle.
//
// Authority: SLICE 5a — MINI SPEC v1.2 (FINAL DRAFT), §5.
// Depends on: Slice 4 (frozen), Slice 1 (frozen), Slice 2 (frozen).
//
// Class A vs Class B:
//   Class A — user-driven transitions (mark_accepted, mark_rejected).
//             These check superseded_by and refuse a superseded row.
//   Class B — attempt finalization primitives (mark_sent,
//             mark_send_uncertain). pub(crate). They transition status
//             without consulting superseded_by; the obligation to
//             preserve a superseded recommendation's REJECTED status
//             lives in the Slice 5b send_safety caller.
//
// Snapshot:
//   Canonical JSON (keys sorted at every level via serde_jcs), SHA-256,
//   hex lowercase. The opt_out field uses a {"_malformed": true} sentinel
//   for any unreadable or invalid shape; this is a freshness mechanism,
//   not an authorization decision. Slice 1's compliance::check_opt_out
//   remains the sole authorization authority at send time.
//
// Ownership:
//   insert_pending and compute_snapshot_hash both verify the debtor
//   belongs to the supplied organization before reading or writing.
//   Ownership failure → StoreError::NotFound.
//
// Transaction behavior:
//   insert_pending, check_freshness, and every transition helper open
//   their transaction with TransactionBehavior::Immediate. This acquires
//   the write reservation before the initial read and avoids deferred-
//   upgrade busy errors under concurrent writers.
//
// Class B tests:
//   mark_sent and mark_send_uncertain are pub(crate) and cannot be reached
//   from the integration test crate shared/tests/slice5_recommendation_store.rs.
//   They are tested in the in-module #[cfg(test)] mod tests at the bottom
//   of this file.

use std::collections::BTreeMap;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use uuid::Uuid;

use crate::recommendation::{Channel, Priority, Timing, Tone};
use crate::strategy::{StrategyOutcome, StrategySource};

pub const EXPIRATION_WINDOW_HOURS: i64 = 72;

const MAX_ABS_AMOUNT: f64 = 1_000_000_000_000.0;
const LIST_LIMIT_MAX: usize = 200;

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecommendationStatus {
    Pending,
    Accepted,
    Rejected,
    Sent,
    Expired,
    SendUncertain,
}

impl RecommendationStatus {
    pub(crate) fn as_db_str(&self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Accepted => "ACCEPTED",
            Self::Rejected => "REJECTED",
            Self::Sent => "SENT",
            Self::Expired => "EXPIRED",
            Self::SendUncertain => "SEND_UNCERTAIN",
        }
    }
}

fn status_from_db(s: &str) -> Result<RecommendationStatus, StoreError> {
    match s {
        "PENDING" => Ok(RecommendationStatus::Pending),
        "ACCEPTED" => Ok(RecommendationStatus::Accepted),
        "REJECTED" => Ok(RecommendationStatus::Rejected),
        "SENT" => Ok(RecommendationStatus::Sent),
        "EXPIRED" => Ok(RecommendationStatus::Expired),
        "SEND_UNCERTAIN" => Ok(RecommendationStatus::SendUncertain),
        other => Err(StoreError::DbError(format!(
            "unknown recommendation status: {}",
            other
        ))),
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecommendationRow {
    pub id: String,
    pub organization_id: String,
    pub debtor_id: String,
    pub ai_connector_code: String,
    pub created_by: String,
    pub source: StrategySource,
    pub channel: Channel,
    pub priority: Priority,
    pub tone: Tone,
    pub timing: Timing,
    pub draft_subject: Option<String>,
    pub draft_body: String,
    pub rationale: Option<String>,
    pub risk_flags: Vec<String>,
    pub prompt_version: String,
    pub status: RecommendationStatus,
    pub created_at: DateTime<Utc>,
    pub decided_at: Option<DateTime<Utc>>,
    pub superseded_by: Option<String>,
    pub snapshot_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoreError {
    NotFound,
    Superseded(String),
    Expired,
    WrongStatus {
        current: RecommendationStatus,
        expected: RecommendationStatus,
    },
    DbError(String),
}

// ---------------------------------------------------------------------
// Enum <-> db string mappings
// ---------------------------------------------------------------------

fn source_to_db(s: &StrategySource) -> &'static str {
    match s {
        StrategySource::Ai => "AI",
        StrategySource::Fallback => "FALLBACK",
    }
}

fn source_from_db(s: &str) -> Result<StrategySource, StoreError> {
    match s {
        "AI" => Ok(StrategySource::Ai),
        "FALLBACK" => Ok(StrategySource::Fallback),
        other => Err(StoreError::DbError(format!("unknown source: {}", other))),
    }
}

fn channel_to_db(c: Channel) -> &'static str {
    match c {
        Channel::Email => "EMAIL",
    }
}

fn channel_from_db(s: &str) -> Result<Channel, StoreError> {
    match s {
        "EMAIL" => Ok(Channel::Email),
        other => Err(StoreError::DbError(format!("unknown channel: {}", other))),
    }
}

fn priority_to_db(p: Priority) -> &'static str {
    match p {
        Priority::Low => "LOW",
        Priority::Normal => "NORMAL",
        Priority::High => "HIGH",
    }
}

fn priority_from_db(s: &str) -> Result<Priority, StoreError> {
    match s {
        "LOW" => Ok(Priority::Low),
        "NORMAL" => Ok(Priority::Normal),
        "HIGH" => Ok(Priority::High),
        other => Err(StoreError::DbError(format!("unknown priority: {}", other))),
    }
}

fn tone_to_db(t: Tone) -> &'static str {
    match t {
        Tone::Friendly => "FRIENDLY",
        Tone::Firm => "FIRM",
        Tone::Urgent => "URGENT",
        Tone::FinalNotice => "FINAL_NOTICE",
    }
}

fn tone_from_db(s: &str) -> Result<Tone, StoreError> {
    match s {
        "FRIENDLY" => Ok(Tone::Friendly),
        "FIRM" => Ok(Tone::Firm),
        "URGENT" => Ok(Tone::Urgent),
        "FINAL_NOTICE" => Ok(Tone::FinalNotice),
        other => Err(StoreError::DbError(format!("unknown tone: {}", other))),
    }
}

fn timing_to_db(t: Timing) -> &'static str {
    match t {
        Timing::Within24Hours => "WITHIN_24_HOURS",
        Timing::Within3Days => "WITHIN_3_DAYS",
        Timing::Within7Days => "WITHIN_7_DAYS",
    }
}

fn timing_from_db(s: &str) -> Result<Timing, StoreError> {
    match s {
        "WITHIN_24_HOURS" => Ok(Timing::Within24Hours),
        "WITHIN_3_DAYS" => Ok(Timing::Within3Days),
        "WITHIN_7_DAYS" => Ok(Timing::Within7Days),
        other => Err(StoreError::DbError(format!("unknown timing: {}", other))),
    }
}

// ---------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------

pub fn insert_pending(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    ai_connector_code: &str,
    created_by: &str,
    outcome: &StrategyOutcome,
    now: DateTime<Utc>,
) -> Result<RecommendationRow, StoreError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    check_ownership(&tx, org_id, debtor_id)?;

    let new_id = Uuid::new_v4().to_string();
    let snapshot_hash = compute_snapshot_hash(&tx, org_id, debtor_id)?;

    // Supersession UPDATE runs before the INSERT, in the same transaction.
    tx.execute(
        "UPDATE recommendations
            SET status = 'REJECTED', decided_at = ?1, superseded_by = ?2
          WHERE organization_id = ?3
            AND debtor_id = ?4
            AND id != ?2
            AND status IN ('PENDING', 'ACCEPTED')",
        params![now.to_rfc3339(), new_id, org_id, debtor_id],
    )
    .map_err(|e| StoreError::DbError(e.to_string()))?;

    let risk_flags_json = serde_json::to_string(&outcome.risk_flags)
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    tx.execute(
        "INSERT INTO recommendations (
            id, organization_id, debtor_id, ai_connector_code, created_by,
            source, channel, priority, tone, timing,
            draft_subject, draft_body, rationale, risk_flags, prompt_version,
            status, created_at, decided_at, superseded_by, snapshot_hash
         ) VALUES (?1, ?2, ?3, ?4, ?5,
                   ?6, ?7, ?8, ?9, ?10,
                   ?11, ?12, ?13, ?14, ?15,
                   'PENDING', ?16, NULL, NULL, ?17)",
        params![
            new_id,
            org_id,
            debtor_id,
            ai_connector_code,
            created_by,
            source_to_db(&outcome.source),
            channel_to_db(outcome.recommendation.channel),
            priority_to_db(outcome.recommendation.priority),
            tone_to_db(outcome.recommendation.tone),
            timing_to_db(outcome.recommendation.timing),
            outcome.draft_subject,
            outcome.draft_body,
            outcome.rationale,
            risk_flags_json,
            outcome.prompt_version,
            now.to_rfc3339(),
            snapshot_hash,
        ],
    )
    .map_err(|e| StoreError::DbError(e.to_string()))?;

    tx.commit().map_err(|e| StoreError::DbError(e.to_string()))?;

    get(conn, org_id, &new_id)
}

pub fn get(conn: &Connection, org_id: &str, id: &str) -> Result<RecommendationRow, StoreError> {
    let raw: RawRow = conn
        .query_row(
            "SELECT id, organization_id, debtor_id, ai_connector_code, created_by,
                    source, channel, priority, tone, timing,
                    draft_subject, draft_body, rationale, risk_flags, prompt_version,
                    status, created_at, decided_at, superseded_by, snapshot_hash
             FROM recommendations
             WHERE organization_id = ?1 AND id = ?2",
            params![org_id, id],
            raw_row,
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => StoreError::NotFound,
            other => StoreError::DbError(other.to_string()),
        })?;
    raw_to_row(raw)
}

pub fn list_for_debtor(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    limit: usize,
) -> Result<Vec<RecommendationRow>, StoreError> {
    if limit == 0 {
        return Ok(Vec::new());
    }
    let limit = limit.min(LIST_LIMIT_MAX) as i64;

    let mut stmt = conn
        .prepare(
            "SELECT id, organization_id, debtor_id, ai_connector_code, created_by,
                    source, channel, priority, tone, timing,
                    draft_subject, draft_body, rationale, risk_flags, prompt_version,
                    status, created_at, decided_at, superseded_by, snapshot_hash
             FROM recommendations
             WHERE organization_id = ?1 AND debtor_id = ?2
             ORDER BY created_at DESC, id DESC
             LIMIT ?3",
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let iter = stmt
        .query_map(params![org_id, debtor_id, limit], raw_row)
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let mut out = Vec::new();
    for r in iter {
        let raw = r.map_err(|e| StoreError::DbError(e.to_string()))?;
        out.push(raw_to_row(raw)?);
    }
    Ok(out)
}

// Class A
pub fn mark_accepted(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    conditional_transition(
        conn,
        org_id,
        id,
        RecommendationStatus::Pending,
        RecommendationStatus::Accepted,
        now,
        true,
    )
}

// Class A
pub fn mark_rejected(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    // PENDING-only. No in-flight guard. begin_send (Slice 5b) requires
    // ACCEPTED, so a PENDING row cannot have a linked IN_PROGRESS attempt.
    // Discard-from-ACCEPTED is not offered in Slice 5.
    conditional_transition(
        conn,
        org_id,
        id,
        RecommendationStatus::Pending,
        RecommendationStatus::Rejected,
        now,
        true,
    )
}

// Class B. pub(crate). For Slice 5b send_safety.
pub(crate) fn mark_sent(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    conditional_transition(
        conn,
        org_id,
        id,
        RecommendationStatus::Accepted,
        RecommendationStatus::Sent,
        now,
        false,
    )
}

// Class B. pub(crate). For Slice 5b send_safety.
pub(crate) fn mark_send_uncertain(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    conditional_transition(
        conn,
        org_id,
        id,
        RecommendationStatus::Accepted,
        RecommendationStatus::SendUncertain,
        now,
        false,
    )
}

pub fn check_freshness(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let row: Option<(String, String, String, String)> = tx
        .query_row(
            "SELECT status, created_at, snapshot_hash, debtor_id
             FROM recommendations
             WHERE organization_id = ?1 AND id = ?2",
            params![org_id, id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let (status_str, created_at_str, stored_hash, debtor_id) = match row {
        None => {
            let _ = tx.rollback();
            return Err(StoreError::NotFound);
        }
        Some(t) => t,
    };

    let status = status_from_db(&status_str)?;
    if status == RecommendationStatus::Expired {
        let _ = tx.rollback();
        return Err(StoreError::Expired);
    }
    if status != RecommendationStatus::Pending && status != RecommendationStatus::Accepted {
        let _ = tx.rollback();
        return Ok(());
    }

    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map_err(|e| StoreError::DbError(format!("created_at parse: {}", e)))?
        .with_timezone(&Utc);

    let current_hash = compute_snapshot_hash(&tx, org_id, &debtor_id)?;

    let age_boundary = created_at + ChronoDuration::hours(EXPIRATION_WINDOW_HOURS);
    let stale = current_hash != stored_hash || now > age_boundary;

    if !stale {
        let _ = tx.rollback();
        return Ok(());
    }

    let affected = tx
        .execute(
            "UPDATE recommendations
                SET status = 'EXPIRED', decided_at = ?1
              WHERE organization_id = ?2 AND id = ?3
                AND status IN ('ACCEPTED', 'PENDING')",
            params![now.to_rfc3339(), org_id, id],
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    if affected == 1 {
        tx.commit().map_err(|e| StoreError::DbError(e.to_string()))?;
        return Err(StoreError::Expired);
    }

    // Defensive branch. Unreachable under the &mut Connection model
    // without fault injection. Retained as an invariant check: never
    // report an expiration this call did not establish.
    let _ = tx.rollback();

    let reread: Option<String> = conn
        .query_row(
            "SELECT status FROM recommendations
             WHERE organization_id = ?1 AND id = ?2",
            params![org_id, id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    match reread {
        None => Err(StoreError::NotFound),
        Some(s) => {
            let status = status_from_db(&s)?;
            if status == RecommendationStatus::Expired {
                Err(StoreError::Expired)
            } else if status != RecommendationStatus::Pending
                && status != RecommendationStatus::Accepted
            {
                Ok(())
            } else {
                Err(StoreError::DbError(
                    "freshness update did not establish expiration on an otherwise sendable row"
                        .to_string(),
                ))
            }
        }
    }
}

pub fn compute_snapshot_hash(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
) -> Result<String, StoreError> {
    check_ownership(conn, org_id, debtor_id)?;

    // All debts for the debtor.
    let mut stmt = conn
        .prepare("SELECT amount, currency, status FROM debts WHERE debtor_id = ?1")
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let iter = stmt
        .query_map(params![debtor_id], |r| {
            Ok((
                r.get::<_, Option<f64>>(0)?.unwrap_or(0.0),
                r.get::<_, Option<String>>(1)?
                    .unwrap_or_else(|| "USD".to_string()),
                r.get::<_, Option<String>>(2)?
                    .unwrap_or_else(|| "ACTIVE".to_string()),
            ))
        })
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let mut all_debts: Vec<(f64, String, String)> = Vec::new();
    for r in iter {
        all_debts.push(r.map_err(|e| StoreError::DbError(e.to_string()))?);
    }
    drop(stmt);

    // Primary currency: most common among unpaid (non-PAID, non-CANCELLED);
    // ties broken alphabetically.
    let mut currency_count: BTreeMap<String, i64> = BTreeMap::new();
    for (_, curr, status) in &all_debts {
        if status == "PAID" || status == "CANCELLED" {
            continue;
        }
        *currency_count.entry(curr.clone()).or_insert(0) += 1;
    }

    let primary_currency: Option<String> = {
        let mut best: Option<(String, i64)> = None;
        for (curr, count) in currency_count.iter() {
            best = match best {
                None => Some((curr.clone(), *count)),
                Some((prev, prev_count)) => {
                    if *count > prev_count
                        || (*count == prev_count && curr.as_str() < prev.as_str())
                    {
                        Some((curr.clone(), *count))
                    } else {
                        Some((prev, prev_count))
                    }
                }
            };
        }
        best.map(|(c, _)| c)
    };

    // amount_cents_total: sum of unpaid non-cancelled debts in primary
    // currency, converted to cents with checked_add.
    let mut amount_cents_total: i64 = 0;
    if let Some(primary) = &primary_currency {
        for (amount, curr, status) in &all_debts {
            if status == "PAID" || status == "CANCELLED" {
                continue;
            }
            if curr != primary {
                continue;
            }
            let c = to_cents(*amount)?;
            amount_cents_total = amount_cents_total
                .checked_add(c)
                .ok_or_else(|| StoreError::DbError("snapshot amount overflow".to_string()))?;
        }
    }

    // debt_status_counts: every debt, all statuses.
    let mut debt_status_counts: BTreeMap<String, i64> = BTreeMap::new();
    for (_, _, status) in &all_debts {
        *debt_status_counts.entry(status.clone()).or_insert(0) += 1;
    }

    // communication_count: every communication, all types.
    let communication_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM communications WHERE debtor_id = ?1",
            params![debtor_id],
            |r| r.get(0),
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    // opt_out extraction from debtors.data.
    let data_str: String = conn
        .query_row(
            "SELECT data FROM debtors
             WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            params![debtor_id, org_id],
            |r| r.get(0),
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;
    let opt_out = extract_opt_out(&data_str);

    // Build canonical JSON.
    let status_counts_json: serde_json::Value = {
        let mut m = serde_json::Map::new();
        for (k, v) in debt_status_counts {
            m.insert(k, serde_json::Value::Number(v.into()));
        }
        serde_json::Value::Object(m)
    };

    let canonical = serde_json::json!({
        "amount_cents_total": amount_cents_total,
        "communication_count": communication_count,
        "debt_status_counts": status_counts_json,
        "debtor_id": debtor_id,
        "opt_out": opt_out,
    });

    let jcs = serde_jcs::to_string(&canonical)
        .map_err(|e| StoreError::DbError(format!("jcs failed: {}", e)))?;

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(jcs.as_bytes());
    let digest = hasher.finalize();
    Ok(hex_lower(digest.as_slice()))
}

// ---------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------

fn check_ownership(conn: &Connection, org_id: &str, debtor_id: &str) -> Result<(), StoreError> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM debtors
             WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            params![debtor_id, org_id],
            |r| r.get(0),
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;
    if count == 0 {
        return Err(StoreError::NotFound);
    }
    Ok(())
}

fn to_cents(amount: f64) -> Result<i64, StoreError> {
    if !amount.is_finite() || amount.abs() > MAX_ABS_AMOUNT {
        return Err(StoreError::DbError(
            "debt amount outside supported range".to_string(),
        ));
    }
    Ok((amount * 100.0).round() as i64)
}

fn extract_opt_out(data_str: &str) -> serde_json::Value {
    let data: serde_json::Value = match serde_json::from_str(data_str) {
        Ok(v) => v,
        Err(_) => return serde_json::json!({ "_malformed": true }),
    };
    let obj = match data.as_object() {
        Some(o) => o,
        None => return serde_json::json!({ "_malformed": true }),
    };
    let opt_out_value = match obj.get("opt_out") {
        Some(v) => v,
        None => {
            return serde_json::json!({
                "email": false,
                "sms": false,
                "voice": false,
            });
        }
    };
    let opt_out_obj = match opt_out_value.as_object() {
        Some(o) => o,
        None => return serde_json::json!({ "_malformed": true }),
    };

    let mut email = false;
    let mut sms = false;
    let mut voice = false;

    for (key, value) in opt_out_obj.iter() {
        match key.as_str() {
            "email" | "sms" | "voice" => match value.as_bool() {
                Some(b) => match key.as_str() {
                    "email" => email = b,
                    "sms" => sms = b,
                    "voice" => voice = b,
                    _ => unreachable!(),
                },
                None => return serde_json::json!({ "_malformed": true }),
            },
            _ => {
                if !value.is_boolean() {
                    return serde_json::json!({ "_malformed": true });
                }
                // Boolean unknown key: ignored.
            }
        }
    }

    serde_json::json!({ "email": email, "sms": sms, "voice": voice })
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

struct RawRow {
    id: String,
    organization_id: String,
    debtor_id: String,
    ai_connector_code: String,
    created_by: String,
    source: String,
    channel: String,
    priority: String,
    tone: String,
    timing: String,
    draft_subject: Option<String>,
    draft_body: String,
    rationale: Option<String>,
    risk_flags: String,
    prompt_version: String,
    status: String,
    created_at: String,
    decided_at: Option<String>,
    superseded_by: Option<String>,
    snapshot_hash: String,
}

fn raw_row(r: &rusqlite::Row) -> rusqlite::Result<RawRow> {
    Ok(RawRow {
        id: r.get(0)?,
        organization_id: r.get(1)?,
        debtor_id: r.get(2)?,
        ai_connector_code: r.get(3)?,
        created_by: r.get(4)?,
        source: r.get(5)?,
        channel: r.get(6)?,
        priority: r.get(7)?,
        tone: r.get(8)?,
        timing: r.get(9)?,
        draft_subject: r.get(10)?,
        draft_body: r.get(11)?,
        rationale: r.get(12)?,
        risk_flags: r.get(13)?,
        prompt_version: r.get(14)?,
        status: r.get(15)?,
        created_at: r.get(16)?,
        decided_at: r.get(17)?,
        superseded_by: r.get(18)?,
        snapshot_hash: r.get(19)?,
    })
}

fn raw_to_row(raw: RawRow) -> Result<RecommendationRow, StoreError> {
    let created_at = DateTime::parse_from_rfc3339(&raw.created_at)
        .map_err(|e| StoreError::DbError(format!("created_at parse: {}", e)))?
        .with_timezone(&Utc);
    let decided_at = match raw.decided_at {
        Some(s) => Some(
            DateTime::parse_from_rfc3339(&s)
                .map_err(|e| StoreError::DbError(format!("decided_at parse: {}", e)))?
                .with_timezone(&Utc),
        ),
        None => None,
    };
    let risk_flags: Vec<String> = serde_json::from_str(&raw.risk_flags)
        .map_err(|e| StoreError::DbError(format!("risk_flags parse: {}", e)))?;

    Ok(RecommendationRow {
        id: raw.id,
        organization_id: raw.organization_id,
        debtor_id: raw.debtor_id,
        ai_connector_code: raw.ai_connector_code,
        created_by: raw.created_by,
        source: source_from_db(&raw.source)?,
        channel: channel_from_db(&raw.channel)?,
        priority: priority_from_db(&raw.priority)?,
        tone: tone_from_db(&raw.tone)?,
        timing: timing_from_db(&raw.timing)?,
        draft_subject: raw.draft_subject,
        draft_body: raw.draft_body,
        rationale: raw.rationale,
        risk_flags,
        prompt_version: raw.prompt_version,
        status: status_from_db(&raw.status)?,
        created_at,
        decided_at,
        superseded_by: raw.superseded_by,
        snapshot_hash: raw.snapshot_hash,
    })
}

fn conditional_transition(
    conn: &mut Connection,
    org_id: &str,
    id: &str,
    expected: RecommendationStatus,
    new_status: RecommendationStatus,
    now: DateTime<Utc>,
    check_superseded: bool,
) -> Result<(), StoreError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let sql = if check_superseded {
        "UPDATE recommendations
            SET status = ?1, decided_at = ?2
          WHERE organization_id = ?3
            AND id = ?4
            AND status = ?5
            AND superseded_by IS NULL"
    } else {
        "UPDATE recommendations
            SET status = ?1, decided_at = ?2
          WHERE organization_id = ?3
            AND id = ?4
            AND status = ?5"
    };

    let affected = tx
        .execute(
            sql,
            params![
                new_status.as_db_str(),
                now.to_rfc3339(),
                org_id,
                id,
                expected.as_db_str(),
            ],
        )
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    if affected == 1 {
        tx.commit().map_err(|e| StoreError::DbError(e.to_string()))?;
        return Ok(());
    }

    // Affected rows == 0: determine cause.
    let found: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT status, superseded_by FROM recommendations
             WHERE organization_id = ?1 AND id = ?2",
            params![org_id, id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| StoreError::DbError(e.to_string()))?;

    let _ = tx.rollback();

    match found {
        None => Err(StoreError::NotFound),
        Some((status_str, superseded_by)) => {
            if check_superseded {
                if let Some(sup) = superseded_by {
                    return Err(StoreError::Superseded(sup));
                }
            }
            let current = status_from_db(&status_str)?;
            Err(StoreError::WrongStatus {
                current,
                expected,
            })
        }
    }
}

// ---------------------------------------------------------------------
// In-module tests for Class B (pub(crate)) helpers.
// ---------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_for_tests;
    use crate::recommendation::{Channel, Priority, Recommendation, Timing, Tone};
    use crate::strategy::{StrategyOutcome, StrategySource};

    const ORG: &str = "org-inmod";
    const OTHER_ORG: &str = "org-inmod-other";
    const D_ID: &str = "debtor-inmod-1";
    const USER: &str = "user-inmod";

    fn t0() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-13T12:00:00Z")
            .expect("parse")
            .with_timezone(&Utc)
    }

    fn seed_debtor(conn: &Connection) {
        conn.execute(
            "INSERT INTO debtors (id, organization_id, name, surname, email, phone,
                                  data, deleted, created_at, updated_at)
             VALUES (?1, ?2, 'Z', 'Z', NULL, NULL, '{}', 'false',
                     '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![D_ID, ORG],
        )
        .expect("seed debtor");
    }

    fn outcome() -> StrategyOutcome {
        StrategyOutcome {
            source: StrategySource::Ai,
            recommendation: Recommendation {
                channel: Channel::Email,
                priority: Priority::High,
                tone: Tone::Urgent,
                timing: Timing::Within3Days,
            },
            draft_subject: Some("s".to_string()),
            draft_body: "b".to_string(),
            rationale: Some("r".to_string()),
            risk_flags: vec![],
            prompt_version: "slice4-v1",
        }
    }

    fn insert_pending_row(conn: &mut Connection) -> String {
        seed_debtor(conn);
        insert_pending(conn, ORG, D_ID, "gemini-ai", USER, &outcome(), t0())
            .expect("insert")
            .id
    }

    #[test]
    fn mark_sent_accepted_to_sent() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        mark_accepted(&mut conn, ORG, &id, t0()).expect("accept");
        mark_sent(&mut conn, ORG, &id, t0()).expect("sent");
        let row = get(&conn, ORG, &id).expect("get");
        assert_eq!(row.status, RecommendationStatus::Sent);
    }

    #[test]
    fn mark_send_uncertain_accepted_to_uncertain() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        mark_accepted(&mut conn, ORG, &id, t0()).expect("accept");
        mark_send_uncertain(&mut conn, ORG, &id, t0()).expect("uncertain");
        let row = get(&conn, ORG, &id).expect("get");
        assert_eq!(row.status, RecommendationStatus::SendUncertain);
    }

    #[test]
    fn mark_sent_on_pending_is_wrong_status() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        let err = mark_sent(&mut conn, ORG, &id, t0()).unwrap_err();
        match err {
            StoreError::WrongStatus { current, expected } => {
                assert_eq!(current, RecommendationStatus::Pending);
                assert_eq!(expected, RecommendationStatus::Accepted);
            }
            other => panic!("expected WrongStatus, got {:?}", other),
        }
    }

    #[test]
    fn mark_send_uncertain_on_pending_is_wrong_status() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        let err = mark_send_uncertain(&mut conn, ORG, &id, t0()).unwrap_err();
        assert!(matches!(err, StoreError::WrongStatus { .. }));
    }

    #[test]
    fn mark_sent_on_rejected_is_wrong_status() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        mark_rejected(&mut conn, ORG, &id, t0()).expect("reject");
        let err = mark_sent(&mut conn, ORG, &id, t0()).unwrap_err();
        match err {
            StoreError::WrongStatus { current, expected } => {
                assert_eq!(current, RecommendationStatus::Rejected);
                assert_eq!(expected, RecommendationStatus::Accepted);
            }
            other => panic!("expected WrongStatus, got {:?}", other),
        }
    }

    #[test]
    fn mark_sent_wrong_org_is_not_found() {
        let mut conn = open_in_memory_for_tests().expect("db");
        let id = insert_pending_row(&mut conn);
        mark_accepted(&mut conn, ORG, &id, t0()).expect("accept");
        let err = mark_sent(&mut conn, OTHER_ORG, &id, t0()).unwrap_err();
        assert!(matches!(err, StoreError::NotFound));
    }

    #[test]
    fn class_b_helpers_refuse_superseded_row_via_status() {
        // Class B helpers do not separately check superseded_by. A
        // superseded recommendation is already REJECTED, so the helper
        // refuses on its status precondition. The effect is the same:
        // a superseded row cannot be transitioned by a Class B helper.
        let mut conn = open_in_memory_for_tests().expect("db");
        seed_debtor(&conn);
        let first = insert_pending(&mut conn, ORG, D_ID, "gemini-ai", USER, &outcome(), t0())
            .expect("first");
        mark_accepted(&mut conn, ORG, &first.id, t0()).expect("accept");
        let _second = insert_pending(&mut conn, ORG, D_ID, "gemini-ai", USER, &outcome(), t0())
            .expect("second");

        // The first row is now REJECTED and superseded_by = second.id.
        let before = get(&conn, ORG, &first.id).expect("get before");
        assert_eq!(before.status, RecommendationStatus::Rejected);
        assert!(before.superseded_by.is_some());

        // Class B helper called directly refuses on status: the row is
        // REJECTED, not ACCEPTED.
        let err = mark_sent(&mut conn, ORG, &first.id, t0()).unwrap_err();
        match err {
            StoreError::WrongStatus { current, expected } => {
                assert_eq!(current, RecommendationStatus::Rejected);
                assert_eq!(expected, RecommendationStatus::Accepted);
            }
            other => panic!("expected WrongStatus, got {:?}", other),
        }

        // Status unchanged.
        let after = get(&conn, ORG, &first.id).expect("get after");
        assert_eq!(after.status, RecommendationStatus::Rejected);
    }