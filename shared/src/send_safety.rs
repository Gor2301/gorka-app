// shared/src/send_safety.rs
//
// Slice 5b. Send safety and orchestration.
// Authority: SLICE 5b — MINI SPEC v1.0 (FROZEN), §6.
//
// Contract:
//   - Every check-then-update operation uses BEGIN IMMEDIATE.
//   - Every conditional UPDATE inspects its affected-row count and
//     re-reads on zero, classifying the actual state. Zero rows is
//     not treated as success.
//   - The provider call happens only after begin_send has committed
//     both Phase 1 (freshness) and Phase 2 (reservation + attempt).
//     No auto-retry. Ever. For any outcome.
//   - recover_at_startup is idempotent, atomic, and treats a missing
//     linked recommendation as an integrity failure, not a skip.
//   - The recommendation side of finalize_failure performs no write
//     when the recommendation is ACCEPTED. decided_at preserves the
//     user's original acceptance time. A superseded recommendation
//     stays REJECTED. An EXPIRED recommendation stays EXPIRED.
//
// Class distinction from recommendation_store:
//   - recommendation_store Class A helpers are user-driven and check
//     superseded_by. They refuse a superseded row.
//   - send_safety is the Class B caller. It does not call the Class A
//     helpers. It performs its own status transitions inside the
//     reservation-then-attempt transaction, preserving REJECTED on a
//     superseded recommendation.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::compliance::{self, Channel};
use crate::recommendation_store;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttemptState {
    InProgress,
    ConfirmedSuccess,
    ConfirmedFailure,
    Uncertain,
}

impl AttemptState {
    pub fn as_str(&self) -> &'static str {
        match self {
            AttemptState::InProgress => "IN_PROGRESS",
            AttemptState::ConfirmedSuccess => "CONFIRMED_SUCCESS",
            AttemptState::ConfirmedFailure => "CONFIRMED_FAILURE",
            AttemptState::Uncertain => "UNCERTAIN",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "IN_PROGRESS" => Some(AttemptState::InProgress),
            "CONFIRMED_SUCCESS" => Some(AttemptState::ConfirmedSuccess),
            "CONFIRMED_FAILURE" => Some(AttemptState::ConfirmedFailure),
            "UNCERTAIN" => Some(AttemptState::Uncertain),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AttemptRow {
    pub id: String,
    pub recommendation_id: String,
    pub reservation_id: String,
    pub debtor_id: String,
    pub organization_id: String,
    pub connector_code: String,
    pub attempted_at: DateTime<Utc>,
    pub state: AttemptState,
    pub finalized_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SafetyError {
    ContactLimitExceeded { limit: i64, window_hours: i64, current: i64 },
    RecommendationNotAccepted,
    RecommendationExpired,
    RecommendationSuperseded(String),
    OptOut { channel: Channel },
    ConnectorNotEnabled,
    AttemptNotConfirmable,
    AttemptNotFound,
    SnapshotMissing,
    SnapshotInvalid,
    InconsistentFinalizedState { attempt_id: String },
    DbError(String),
}

impl std::fmt::Display for SafetyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SafetyError::ContactLimitExceeded { limit, window_hours, current } => write!(
                f,
                "contact limit exceeded: {} in the last {}h (limit {})",
                current, window_hours, limit
            ),
            SafetyError::RecommendationNotAccepted => {
                write!(f, "recommendation is not in ACCEPTED state")
            }
            SafetyError::RecommendationExpired => write!(f, "recommendation has expired"),
            SafetyError::RecommendationSuperseded(id) => {
                write!(f, "recommendation has been superseded by {}", id)
            }
            SafetyError::OptOut { channel } => {
                write!(f, "debtor has opted out of {:?}", channel)
            }
            SafetyError::ConnectorNotEnabled => write!(f, "connector is not enabled"),
            SafetyError::AttemptNotConfirmable => {
                write!(f, "attempt is not in a confirmable state")
            }
            SafetyError::AttemptNotFound => write!(f, "attempt not found"),
            SafetyError::SnapshotMissing => write!(f, "payload snapshot is missing"),
            SafetyError::SnapshotInvalid => write!(f, "payload snapshot is invalid"),
            SafetyError::InconsistentFinalizedState { attempt_id } => write!(
                f,
                "attempt {} is in an inconsistent finalized state",
                attempt_id
            ),
            SafetyError::DbError(e) => write!(f, "database error: {}", e),
        }
    }
}

impl std::error::Error for SafetyError {}

/// The exact bytes handed to the adapter, serialized as JSON and
/// stored in send_attempts.payload_snapshot before the provider is
/// called. Read back only during recovery and manual confirmation.
///
/// No credential or authorization token is stored here. `from` is the
/// sender address, not a secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SendAttemptSnapshot {
    pub to: String,
    pub subject: Option<String>,
    pub from: String,
    pub final_body: String,
    pub connector_code: String,
    pub channel: String,
    pub recommendation_id: String,
    pub debtor_id: String,
    pub created_at: String,
}

impl SendAttemptSnapshot {
    pub fn to_json(&self) -> Result<Vec<u8>, SafetyError> {
        serde_json::to_vec(self).map_err(|_| SafetyError::SnapshotInvalid)
    }

    pub fn from_json(bytes: &[u8]) -> Result<Self, SafetyError> {
        serde_json::from_slice(bytes).map_err(|_| SafetyError::SnapshotInvalid)
    }
}

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

fn parse_ts(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn row_to_attempt(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttemptRow> {
    let state_str: String = row.get(7)?;
    let attempted_str: String = row.get(6)?;
    let finalized_opt: Option<String> = row.get(8)?;
    let state = AttemptState::from_str(&state_str).unwrap_or(AttemptState::InProgress);
    let attempted_at = parse_ts(&attempted_str)
        .unwrap_or_else(|| DateTime::<Utc>::from_timestamp(0, 0).unwrap());
    let finalized_at = finalized_opt.as_deref().and_then(parse_ts);
    Ok(AttemptRow {
        id: row.get(0)?,
        recommendation_id: row.get(1)?,
        reservation_id: row.get(2)?,
        debtor_id: row.get(3)?,
        organization_id: row.get(4)?,
        connector_code: row.get(5)?,
        attempted_at,
        state,
        finalized_at,
    })
}

const ATTEMPT_COLS: &str = "id, recommendation_id, reservation_id, debtor_id, \
     organization_id, connector_code, attempted_at, state, finalized_at";

fn load_attempt(
    conn: &Connection,
    org_id: &str,
    attempt_id: &str,
) -> Result<AttemptRow, SafetyError> {
    let sql = format!(
        "SELECT {} FROM send_attempts WHERE id = ?1 AND organization_id = ?2",
        ATTEMPT_COLS
    );
    conn.query_row(&sql, params![attempt_id, org_id], |row| row_to_attempt(row))
        .optional()
        .map_err(|e| SafetyError::DbError(e.to_string()))?
        .ok_or(SafetyError::AttemptNotFound)
}

fn load_reservation_org(
    conn: &Connection,
    reservation_id: &str,
) -> Result<Option<String>, SafetyError> {
    conn.query_row(
        "SELECT organization_id FROM send_reservations WHERE id = ?1",
        params![reservation_id],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| SafetyError::DbError(e.to_string()))
}

fn load_recommendation_status(
    conn: &Connection,
    org_id: &str,
    rec_id: &str,
) -> Result<Option<(String, Option<String>)>, SafetyError> {
    // Returns (status, superseded_by)
    conn.query_row(
        "SELECT status, superseded_by FROM recommendations
          WHERE id = ?1 AND organization_id = ?2",
        params![rec_id, org_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
    )
    .optional()
    .map_err(|e| SafetyError::DbError(e.to_string()))
}

fn load_recommendation_debtor(
    conn: &Connection,
    org_id: &str,
    rec_id: &str,
) -> Result<Option<String>, SafetyError> {
    conn.query_row(
        "SELECT debtor_id FROM recommendations WHERE id = ?1 AND organization_id = ?2",
        params![rec_id, org_id],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| SafetyError::DbError(e.to_string()))
}

// ---------------------------------------------------------------------
// check_contact_limit
// ---------------------------------------------------------------------

/// Contact-limit enforcement. Read-only. Reads the single-row
/// compliance_rules config without an organization filter (the table
/// is per-device, id = 1). Counts reservations for the (org, debtor,
/// channel) tuple in the configured window. Held (unresolved) and
/// converted (successful) reservations count. Released (failed) does
/// not.
///
/// Malformed configuration fails closed with DbError. Silent
/// interpretation of a malformed limit as "disabled" is not permitted.
pub fn check_contact_limit(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    channel: Channel,
    now: DateTime<Utc>,
) -> Result<(), SafetyError> {
    let row: Option<(i64, Option<i64>, Option<String>)> = conn
        .query_row(
            "SELECT contact_limit_enabled, contact_limit_count, contact_limit_period
               FROM compliance_rules WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let (enabled, count_opt, period_opt) = match row {
        Some(r) => r,
        None => return Ok(()),
    };

    if enabled == 0 {
        return Ok(());
    }

    let limit = count_opt.ok_or_else(|| {
        SafetyError::DbError(
            "contact_limit_enabled = 1 but contact_limit_count is NULL".to_string(),
        )
    })?;
    let period = period_opt.ok_or_else(|| {
        SafetyError::DbError(
            "contact_limit_enabled = 1 but contact_limit_period is NULL".to_string(),
        )
    })?;

    let window_hours: i64 = match period.as_str() {
        "DAY" => 24,
        "WEEK" => 168,
        "MONTH" => 720,
        other => {
            return Err(SafetyError::DbError(format!(
                "unknown contact_limit_period: {}",
                other
            )))
        }
    };

    let cutoff = now - chrono::Duration::hours(window_hours);
    let cutoff_str = cutoff.to_rfc3339();

    let current: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM send_reservations
              WHERE organization_id = ?1
                AND debtor_id = ?2
                AND channel = ?3
                AND reserved_at >= ?4
                AND (released_at IS NULL OR release_reason = 'CONVERTED')",
            params![org_id, debtor_id, channel.as_str(), cutoff_str],
            |row| row.get(0),
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    if current >= limit {
        return Err(SafetyError::ContactLimitExceeded {
            limit,
            window_hours,
            current,
        });
    }

    Ok(())
}

// ---------------------------------------------------------------------
// begin_send
// ---------------------------------------------------------------------

/// Phase 1 — freshness. Committed separately. BEGIN IMMEDIATE.
fn phase_1_freshness(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    recommendation_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let row: Option<(String, Option<String>, String, String)> = tx
        .query_row(
            "SELECT status, superseded_by, created_at, snapshot_hash
               FROM recommendations
              WHERE id = ?1 AND organization_id = ?2",
            params![recommendation_id, org_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let (status, superseded_by, created_at_str, stored_hash) = match row {
        Some(r) => r,
        None => {
            drop(tx);
            return Err(SafetyError::RecommendationNotAccepted);
        }
    };

    let created_at = parse_ts(&created_at_str).ok_or_else(|| {
        SafetyError::DbError("recommendation created_at unparseable".to_string())
    })?;

    let current_hash = recommendation_store::compute_snapshot_hash(&tx, org_id, debtor_id)
        .map_err(|e| SafetyError::DbError(format!("{:?}", e)))?;

    let window_expired = now > created_at + chrono::Duration::hours(72);
    let stale = current_hash != stored_hash;
    let superseded = superseded_by.is_some();

    if !(window_expired || stale || superseded) {
        drop(tx);
        return Ok(());
    }

    let updated = tx
        .execute(
            "UPDATE recommendations
                SET status = 'EXPIRED', decided_at = ?1
              WHERE organization_id = ?2 AND id = ?3 AND status = 'ACCEPTED'",
            params![now.to_rfc3339(), org_id, recommendation_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    if updated == 1 {
        tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;
        return Err(SafetyError::RecommendationExpired);
    }

    // Zero-row branch. Do not claim this call expired the row.
    drop(tx);
    let recheck = load_recommendation_status(conn, org_id, recommendation_id)?;
    match recheck {
        None => Err(SafetyError::RecommendationNotAccepted),
        Some((s, sup)) => {
            if s == "EXPIRED" {
                Err(SafetyError::RecommendationExpired)
            } else if sup.is_some() {
                Err(SafetyError::RecommendationSuperseded(sup.unwrap()))
            } else if s != "ACCEPTED" {
                Err(SafetyError::RecommendationNotAccepted)
            } else {
                // Invariant violation: the row is ACCEPTED but the
                // conditional update matched zero rows. Report.
                Err(SafetyError::DbError(
                    "Phase 1 zero-row on ACCEPTED recommendation".to_string(),
                ))
            }
        }
    }
}

/// Reserve and record an attempt. Two-phase.
///
/// Phase 1 (freshness) commits separately and returns
/// RecommendationExpired on any staleness before Phase 2 begins.
/// Phase 2 is one BEGIN IMMEDIATE transaction that inserts the
/// reservation and the attempt. The caller must not call the provider
/// until both commits have returned Ok.
pub fn begin_send(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    recommendation_id: &str,
    connector_code: &str,
    payload_snapshot: &[u8],
    now: DateTime<Utc>,
) -> Result<(AttemptRow, String), SafetyError> {
    // Phase 1.
    phase_1_freshness(conn, org_id, debtor_id, recommendation_id, now)?;

    // Phase 2.
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    // 1. Recommendation must still be ACCEPTED and not superseded.
    let status_row = load_recommendation_status(&tx, org_id, recommendation_id)?;
    let (status, superseded_by) = match status_row {
        Some(r) => r,
        None => {
            drop(tx);
            return Err(SafetyError::RecommendationNotAccepted);
        }
    };
    if superseded_by.is_some() {
        let by = superseded_by.unwrap();
        drop(tx);
        return Err(SafetyError::RecommendationSuperseded(by));
    }
    if status != "ACCEPTED" {
        drop(tx);
        return Err(SafetyError::RecommendationNotAccepted);
    }

    // 2. Opt-out.
    let channel = compliance::channel_for_connector_code(connector_code)
        .ok_or(SafetyError::ConnectorNotEnabled)?;
    if let Err(block) =
        compliance::check_opt_out(&tx, org_id, debtor_id, connector_code)
    {
        drop(tx);
        return Err(SafetyError::OptOut { channel });
    }

    // 3. Contact limit.
    if let Err(e) = check_contact_limit(&tx, org_id, debtor_id, channel, now) {
        drop(tx);
        return Err(e);
    }

    // 4. Connector enabled (reads the credential; None means not
    //    enabled on this device).
    let enabled = crate::connectors::local_record::read_local_connector_credential(
        &tx, org_id, connector_code,
    )
    .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if enabled.is_none() {
        drop(tx);
        return Err(SafetyError::ConnectorNotEnabled);
    }

    // 5. Reservation.
    let reservation_id = Uuid::new_v4().to_string();
    let now_str = now.to_rfc3339();
    tx.execute(
        "INSERT INTO send_reservations
            (id, organization_id, debtor_id, connector_code, channel,
             reserved_at, released_at, release_reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL)",
        params![
            reservation_id,
            org_id,
            debtor_id,
            connector_code,
            channel.as_str(),
            now_str
        ],
    )
    .map_err(|e| SafetyError::DbError(e.to_string()))?;

    // 6. Attempt.
    let attempt_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO send_attempts
            (id, recommendation_id, reservation_id, debtor_id, organization_id,
             connector_code, attempted_at, state, finalized_at, payload_snapshot)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'IN_PROGRESS', NULL, ?8)",
        params![
            attempt_id,
            recommendation_id,
            reservation_id,
            debtor_id,
            org_id,
            connector_code,
            now_str,
            payload_snapshot,
        ],
    )
    .map_err(|e| SafetyError::DbError(e.to_string()))?;

    tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;

    let attempt = AttemptRow {
        id: attempt_id,
        recommendation_id: recommendation_id.to_string(),
        reservation_id: reservation_id.clone(),
        debtor_id: debtor_id.to_string(),
        organization_id: org_id.to_string(),
        connector_code: connector_code.to_string(),
        attempted_at: now,
        state: AttemptState::InProgress,
        finalized_at: None,
    };

    Ok((attempt, reservation_id))
}

// ---------------------------------------------------------------------
// recover_at_startup
// ---------------------------------------------------------------------

/// Runs once, after DB unlock and before any command can touch
/// send_attempts. Every IN_PROGRESS attempt is an orphan under the
/// single-instance precondition. No time, process, or organization
/// filter. Returns the number actually transitioned.
pub fn recover_at_startup(
    conn: &mut Connection,
    now: DateTime<Utc>,
) -> Result<u32, SafetyError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let mut stmt = tx
        .prepare(
            "SELECT id, organization_id, recommendation_id
               FROM send_attempts WHERE state = 'IN_PROGRESS'",
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| SafetyError::DbError(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);

    let mut transitioned: u32 = 0;

    for (attempt_id, org_id, rec_id) in rows {
        let rows_a = tx
            .execute(
                "UPDATE send_attempts SET state = 'UNCERTAIN'
                  WHERE id = ?1 AND organization_id = ?2 AND state = 'IN_PROGRESS'",
                params![attempt_id, org_id],
            )
            .map_err(|e| SafetyError::DbError(e.to_string()))?;

        if rows_a == 0 {
            let current: Option<String> = tx
                .query_row(
                    "SELECT state FROM send_attempts
                      WHERE id = ?1 AND organization_id = ?2",
                    params![attempt_id, org_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(|e| SafetyError::DbError(e.to_string()))?;
            match current.as_deref() {
                None => {
                    drop(tx);
                    return Err(SafetyError::InconsistentFinalizedState {
                        attempt_id,
                    });
                }
                Some("UNCERTAIN") => continue,
                Some(_) => {
                    drop(tx);
                    return Err(SafetyError::InconsistentFinalizedState {
                        attempt_id,
                    });
                }
            }
        }
        transitioned += 1;

        // Recommendation side.
        let rec = load_recommendation_status(&tx, &org_id, &rec_id)?;
        let (status, superseded_by) = match rec {
            Some(r) => r,
            None => {
                drop(tx);
                return Err(SafetyError::InconsistentFinalizedState { attempt_id });
            }
        };

        if superseded_by.is_some() {
            continue;
        }
        if status != "ACCEPTED" {
            continue;
        }

        let rows_r = tx
            .execute(
                "UPDATE recommendations SET status = 'SEND_UNCERTAIN'
                  WHERE organization_id = ?1 AND id = ?2 AND status = 'ACCEPTED'",
                params![org_id, rec_id],
            )
            .map_err(|e| SafetyError::DbError(e.to_string()))?;

        if rows_r == 0 {
            let recheck = load_recommendation_status(&tx, &org_id, &rec_id)?;
            match recheck {
                None => {
                    drop(tx);
                    return Err(SafetyError::InconsistentFinalizedState { attempt_id });
                }
                Some((s, sup)) => {
                    if sup.is_some() || s == "SEND_UNCERTAIN" {
                        // fine
                    } else {
                        drop(tx);
                        return Err(SafetyError::InconsistentFinalizedState { attempt_id });
                    }
                }
            }
        }
    }

    tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;
    let _ = now;
    Ok(transitioned)
}

// ---------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------

fn load_snapshot_bytes(
    conn: &Connection,
    org_id: &str,
    attempt_id: &str,
) -> Result<Option<Vec<u8>>, SafetyError> {
    conn.query_row(
        "SELECT payload_snapshot FROM send_attempts
          WHERE id = ?1 AND organization_id = ?2",
        params![attempt_id, org_id],
        |r| r.get::<_, Option<Vec<u8>>>(0),
    )
    .optional()
    .map_err(|e| SafetyError::DbError(e.to_string()))
    .map(|opt| opt.flatten())
}

/// Read the snapshot for an UNCERTAIN attempt. Used only during the
/// recovery display flow. Not a message-history API.
pub fn read_snapshot(
    conn: &Connection,
    org_id: &str,
    attempt_id: &str,
) -> Result<Vec<u8>, SafetyError> {
    let attempt = load_attempt(conn, org_id, attempt_id)?;
    if attempt.state != AttemptState::Uncertain {
        return Err(SafetyError::AttemptNotConfirmable);
    }
    let bytes = load_snapshot_bytes(conn, org_id, attempt_id)?;
    bytes.ok_or(SafetyError::SnapshotMissing)
}

// ---------------------------------------------------------------------
// Finalization — success path
// ---------------------------------------------------------------------

fn finalize_success_impl(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    created_by: &str,
    now: DateTime<Utc>,
    source_state: AttemptState,
) -> Result<String, SafetyError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    // Load attempt (org-scoped).
    let attempt = load_attempt(&tx, org_id, attempt_id)?;

    // State gate.
    match attempt.state {
        AttemptState::ConfirmedSuccess => {
            // Idempotent path: re-run cross-record validation first,
            // then return the linked communication id.
            let comm_id = validate_and_find_communication(&tx, org_id, &attempt, true)?;
            drop(tx);
            return comm_id.ok_or(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
        s if s == source_state => {}
        _ => {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState {
                attempt_id: attempt_id.to_string(),
            });
        }
    }

    // Load and validate snapshot.
    let snap_bytes = load_snapshot_bytes(&tx, org_id, attempt_id)?
        .ok_or(SafetyError::SnapshotMissing)?;
    let snapshot = SendAttemptSnapshot::from_json(&snap_bytes)?;

    // Cross-record validation.
    if snapshot.connector_code != attempt.connector_code { drop(tx); return Err(SafetyError::SnapshotInvalid); }
    if snapshot.recommendation_id != attempt.recommendation_id { drop(tx); return Err(SafetyError::SnapshotInvalid); }
    if snapshot.debtor_id != attempt.debtor_id { drop(tx); return Err(SafetyError::SnapshotInvalid); }

    let res_org = load_reservation_org(&tx, &attempt.reservation_id)?
        .ok_or(SafetyError::SnapshotInvalid)?;
    if res_org != org_id { drop(tx); return Err(SafetyError::SnapshotInvalid); }

    let res_debtor: Option<String> = tx
        .query_row(
            "SELECT debtor_id FROM send_reservations
              WHERE id = ?1 AND organization_id = ?2",
            params![attempt.reservation_id, org_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    match res_debtor {
        Some(d) if d == snapshot.debtor_id => {}
        _ => { drop(tx); return Err(SafetyError::SnapshotInvalid); }
    }

    let chan_for_code = compliance::channel_for_connector_code(&snapshot.connector_code);
    let chan_from_snap: Option<Channel> = match snapshot.channel.as_str() {
        "email" => Some(Channel::Email),
        "sms" => Some(Channel::Sms),
        "voice" => Some(Channel::Voice),
        _ => None,
    };
    match (chan_for_code, chan_from_snap) {
        (Some(a), Some(b)) if a == b => {}
        _ => { drop(tx); return Err(SafetyError::SnapshotInvalid); }
    }

    let rec_org_debtor = load_recommendation_debtor(&tx, org_id, &attempt.recommendation_id)?
        .ok_or(SafetyError::SnapshotInvalid)?;
    if rec_org_debtor != attempt.debtor_id { drop(tx); return Err(SafetyError::SnapshotInvalid); }

    // Recommendation state classification.
    let rec_row = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?
        .ok_or(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() })?;
    let (rec_status, rec_sup) = rec_row;
    if rec_sup.is_some() {
        if rec_status != "REJECTED" {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
        // Preserve REJECTED. Proceed.
    } else if rec_status == "ACCEPTED" || rec_status == "SEND_UNCERTAIN" {
        // A confirmed delivery moves the recommendation to SENT,
        // whether it was ACCEPTED (direct success) or SEND_UNCERTAIN
        // (confirmed after an uncertain attempt).
        let rows = tx
            .execute(
                "UPDATE recommendations SET status = 'SENT', decided_at = ?1
                  WHERE organization_id = ?2 AND id = ?3
                    AND status IN ('ACCEPTED','SEND_UNCERTAIN') AND superseded_by IS NULL",
                params![now.to_rfc3339(), org_id, attempt.recommendation_id],
            )
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if rows == 0 {
            let recheck = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?;
            match recheck {
                None => { drop(tx); return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() }); }
                Some((s, sup)) => {
                    if sup.is_some() || s == "SENT" {
                        // fine
                    } else {
                        drop(tx);
                        return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
                    }
                }
            }
        }
    } else if rec_status == "EXPIRED" || rec_status == "SENT" {
        // No write; proceed.
    } else {
        drop(tx);
        return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
    }

    // Insert communication via the transactional helper.
    let comm_id = crate::communications::insert_communication_in_tx(
        &tx,
        org_id,
        crate::models::CommunicationInput {
            debtor_id: snapshot.debtor_id.clone(),
            r#type: channel_type_for(&snapshot.connector_code).to_string(),
            direction: "OUTBOUND".to_string(),
            content: Some(snapshot.final_body.clone()),
            duration: None,
            data: None,
        },
        created_by,
        Some(&snapshot.connector_code),
        Some(&attempt.id),
    )
    .map_err(|e| SafetyError::DbError(e))?
    .id;

    // Attempt.
    let rows_att = tx
        .execute(
            "UPDATE send_attempts
                SET state = 'CONFIRMED_SUCCESS', finalized_at = ?1, payload_snapshot = NULL
              WHERE id = ?2 AND organization_id = ?3
                AND state IN ('IN_PROGRESS','UNCERTAIN')",
            params![now.to_rfc3339(), attempt_id, org_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if rows_att == 0 {
        let cur: Option<String> = tx
            .query_row(
                "SELECT state FROM send_attempts WHERE id = ?1 AND organization_id = ?2",
                params![attempt_id, org_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if cur.as_deref() != Some("CONFIRMED_SUCCESS") {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
    }

    // Reservation.
    let rows_res = tx
        .execute(
            "UPDATE send_reservations
                SET released_at = ?1, release_reason = 'CONVERTED'
              WHERE id = ?2 AND organization_id = ?3 AND released_at IS NULL",
            params![now.to_rfc3339(), attempt.reservation_id, org_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if rows_res == 0 {
        let existing: Option<(Option<String>, Option<String>)> = tx
            .query_row(
                "SELECT released_at, release_reason FROM send_reservations
                  WHERE id = ?1 AND organization_id = ?2",
                params![attempt.reservation_id, org_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        match existing {
            Some((Some(_), Some(reason))) if reason == "CONVERTED" => {}
            _ => {
                drop(tx);
                return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
            }
        }
    }

    tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;
    Ok(comm_id)
}

fn validate_and_find_communication(
    tx: &rusqlite::Transaction<'_>,
    org_id: &str,
    attempt: &AttemptRow,
    allow_missing: bool,
) -> Result<Option<String>, SafetyError> {
    // Returns the linked communication id if present. `allow_missing`
    // controls whether None is acceptable (idempotent path with
    // no communication -> InconsistentFinalizedState).
    // Cross-record validation is re-run before this is used.
    let comm_id: Option<String> = tx
        .query_row(
            "SELECT id FROM communications
              WHERE send_attempt_id = ?1 AND debtor_id = ?2
              LIMIT 1",
            params![attempt.id, attempt.debtor_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if comm_id.is_none() && !allow_missing {
        // Caller will surface SnapshotInvalid / Inconsistent.
    }
    let _ = org_id;
    Ok(comm_id)
}

fn channel_type_for(connector_code: &str) -> &'static str {
    if connector_code.ends_with("-email") {
        "EMAIL"
    } else if connector_code.ends_with("-sms") {
        "SMS"
    } else if connector_code.ends_with("-voice") {
        "CALL"
    } else {
        "NOTE"
    }
}

// ---------------------------------------------------------------------
// Public finalize_* and confirm_*
// ---------------------------------------------------------------------

pub fn finalize_success(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    created_by: &str,
    now: DateTime<Utc>,
) -> Result<String, SafetyError> {
    finalize_success_impl(conn, org_id, attempt_id, created_by, now, AttemptState::InProgress)
}

pub fn confirm_delivered(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    created_by: &str,
    now: DateTime<Utc>,
) -> Result<String, SafetyError> {
    finalize_success_impl(conn, org_id, attempt_id, created_by, now, AttemptState::Uncertain)
}

// ---------------------------------------------------------------------
// Failure path
// ---------------------------------------------------------------------

fn finalize_failure_impl(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
    source_state: AttemptState,
) -> Result<(), SafetyError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let attempt = load_attempt(&tx, org_id, attempt_id)?;

    match attempt.state {
        AttemptState::ConfirmedFailure => {
            // Idempotent path: verify reservation released with
            // release_reason = 'RELEASED'.
            let res: Option<(Option<String>, Option<String>)> = tx
                .query_row(
                    "SELECT released_at, release_reason FROM send_reservations
                      WHERE id = ?1 AND organization_id = ?2",
                    params![attempt.reservation_id, org_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()
                .map_err(|e| SafetyError::DbError(e.to_string()))?;
            match res {
                Some((Some(_), Some(r))) if r == "RELEASED" => {
                    drop(tx);
                    return Ok(());
                }
                _ => {
                    drop(tx);
                    return Err(SafetyError::InconsistentFinalizedState {
                        attempt_id: attempt_id.to_string(),
                    });
                }
            }
        }
        s if s == source_state => {}
        _ => {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState {
                attempt_id: attempt_id.to_string(),
            });
        }
    }

    // Recommendation state — no write on this path.
    let rec_row = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?
        .ok_or(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() })?;
    let (rec_status, rec_sup) = rec_row;
    if rec_sup.is_some() {
        if rec_status != "REJECTED" {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
    } else if rec_status == "SEND_UNCERTAIN" {
        // A confirmed non-delivery after uncertainty returns the
        // recommendation to ACCEPTED for retry. decided_at is
        // preserved â€” the user's original acceptance time stands.
        let rows = tx
            .execute(
                "UPDATE recommendations SET status = 'ACCEPTED'
                  WHERE organization_id = ?1 AND id = ?2
                    AND status = 'SEND_UNCERTAIN' AND superseded_by IS NULL",
                params![org_id, attempt.recommendation_id],
            )
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if rows == 0 {
            let recheck = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?;
            match recheck {
                None => { drop(tx); return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() }); }
                Some((s, sup)) => {
                    if sup.is_some() || s == "ACCEPTED" {
                        // fine
                    } else {
                        drop(tx);
                        return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
                    }
                }
            }
        }
    } else {
        match rec_status.as_str() {
            "ACCEPTED" | "EXPIRED" => {}
            _ => {
                drop(tx);
                return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
            }
        }
    }

    // Attempt.
    let rows_att = tx
        .execute(
            "UPDATE send_attempts
                SET state = 'CONFIRMED_FAILURE', finalized_at = ?1, payload_snapshot = NULL
              WHERE id = ?2 AND organization_id = ?3
                AND state IN ('IN_PROGRESS','UNCERTAIN')",
            params![now.to_rfc3339(), attempt_id, org_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if rows_att == 0 {
        let cur: Option<String> = tx
            .query_row(
                "SELECT state FROM send_attempts WHERE id = ?1 AND organization_id = ?2",
                params![attempt_id, org_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if cur.as_deref() != Some("CONFIRMED_FAILURE") {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
    }

    // Reservation.
    let rows_res = tx
        .execute(
            "UPDATE send_reservations
                SET released_at = ?1, release_reason = 'RELEASED'
              WHERE id = ?2 AND organization_id = ?3 AND released_at IS NULL",
            params![now.to_rfc3339(), attempt.reservation_id, org_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if rows_res == 0 {
        let existing: Option<(Option<String>, Option<String>)> = tx
            .query_row(
                "SELECT released_at, release_reason FROM send_reservations
                  WHERE id = ?1 AND organization_id = ?2",
                params![attempt.reservation_id, org_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        match existing {
            Some((Some(_), Some(reason))) if reason == "RELEASED" => {}
            _ => {
                drop(tx);
                return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
            }
        }
    }

    tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;
    Ok(())
}

pub fn finalize_failure(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError> {
    finalize_failure_impl(conn, org_id, attempt_id, now, AttemptState::InProgress)
}

pub fn confirm_not_delivered(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError> {
    finalize_failure_impl(conn, org_id, attempt_id, now, AttemptState::Uncertain)
}

// ---------------------------------------------------------------------
// Uncertain path
// ---------------------------------------------------------------------

pub fn finalize_uncertain(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError> {
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| SafetyError::DbError(e.to_string()))?;

    let attempt = load_attempt(&tx, org_id, attempt_id)?;

    match attempt.state {
        AttemptState::Uncertain => {
            drop(tx);
            return Ok(());
        }
        AttemptState::InProgress => {}
        _ => {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState {
                attempt_id: attempt_id.to_string(),
            });
        }
    }

    // Attempt → UNCERTAIN.
    let rows_att = tx
        .execute(
            "UPDATE send_attempts SET state = 'UNCERTAIN', finalized_at = NULL
              WHERE id = ?1 AND organization_id = ?2 AND state = 'IN_PROGRESS'",
            params![attempt_id, org_id],
        )
        .map_err(|e| SafetyError::DbError(e.to_string()))?;
    if rows_att == 0 {
        let cur: Option<String> = tx
            .query_row(
                "SELECT state FROM send_attempts WHERE id = ?1 AND organization_id = ?2",
                params![attempt_id, org_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if cur.as_deref() != Some("UNCERTAIN") {
            drop(tx);
            return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
        }
    }

    // Recommendation side.
    let rec_row = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?
        .ok_or(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() })?;
    let (rec_status, rec_sup) = rec_row;
    if rec_sup.is_some() {
        // no change
    } else if rec_status == "ACCEPTED" {
        let rows = tx
            .execute(
                "UPDATE recommendations SET status = 'SEND_UNCERTAIN', decided_at = ?1
                  WHERE organization_id = ?2 AND id = ?3
                    AND status = 'ACCEPTED' AND superseded_by IS NULL",
                params![now.to_rfc3339(), org_id, attempt.recommendation_id],
            )
            .map_err(|e| SafetyError::DbError(e.to_string()))?;
        if rows == 0 {
            let recheck = load_recommendation_status(&tx, org_id, &attempt.recommendation_id)?;
            match recheck {
                None => { drop(tx); return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() }); }
                Some((s, sup)) => {
                    if sup.is_some() || s == "SEND_UNCERTAIN" {
                        // fine
                    } else {
                        drop(tx);
                        return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
                    }
                }
            }
        }
    } else if rec_status == "EXPIRED" {
        // no change
    } else {
        drop(tx);
        return Err(SafetyError::InconsistentFinalizedState { attempt_id: attempt_id.to_string() });
    }

    tx.commit().map_err(|e| SafetyError::DbError(e.to_string()))?;
    Ok(())
}