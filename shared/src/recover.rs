// gorka-shared::recover
//
// Recovery utility for CONNECTOR-EVENT-ORDER-SPEC v1.0 §8.
//
// Used when migration v10 fails on a real device. Reads
// sync_events (read-only), inspects local_connectors, and repairs
// rows that are inconsistent with the protocol-latest matching
// event. Ordering uses protocol_order_less, not SQL ORDER BY.
//
// Credential-safe by construction: SafeRow and SafeEvent never
// carry credential_value or configuration, and no repair path
// writes them to stdout, stderr, or any error message.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::sync_parse::{
    parse_connector_disabled_payload, parse_connector_enabled_payload,
};
use crate::sync_pipeline::protocol_order_less;

// ---------------------------------------------------------------
// Public, credential-safe views
// ---------------------------------------------------------------

/// Safe projection of a local_connectors row.
/// No credential_value. No configuration. Per spec §8.7.
#[derive(Debug, Clone, Serialize)]
pub struct SafeRow {
    pub id: String,
    pub connector_code: String,
    pub organization_id: String,
    pub tier: String,
    pub status: String,
    pub source_device_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub winning_logical_clock: i64,
    pub winning_device_id_hex: String,
    pub winning_sequence: i64,
}

/// Safe projection of a sync_events row.
/// No payload. Per spec §8.7.
#[derive(Debug, Clone, Serialize)]
pub struct SafeEvent {
    pub id: String,
    pub event_type: String,
    pub logical_clock: i64,
    pub sequence: i64,
    pub device_id_hex: String,
}

/// One row's inspection result. Serializable for CLI output.
#[derive(Debug, Serialize)]
pub struct InspectLine {
    pub row: SafeRow,
    pub latest_event: Option<SafeEvent>,
    pub status_consistent: bool,
    pub tuple_matches_latest: bool,
}

#[derive(Debug)]
pub enum RecoverError {
    NoMatchingEvent { organization_id: String, connector_code: String },
    StatusMismatch { row_id: String, expected: String, actual: String },
    DecodeFailed { event_id: String, category: &'static str },
    IdentityMismatch { row_id: String, event_id: String },
    DuplicateRow { organization_id: String, connector_code: String },
    Sqlite(String),
}

impl std::fmt::Display for RecoverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RecoverError::NoMatchingEvent { organization_id, connector_code } =>
                write!(f, "no matching event for ({}, {})", organization_id, connector_code),
            RecoverError::StatusMismatch { row_id, expected, actual } =>
                write!(f, "status mismatch on row {}: expected {}, actual {}", row_id, expected, actual),
            RecoverError::DecodeFailed { event_id, category } =>
                write!(f, "decode failed on event {}: {}", event_id, category),
            RecoverError::IdentityMismatch { row_id, event_id } =>
                write!(f, "identity mismatch: row {} vs event {}", row_id, event_id),
            RecoverError::DuplicateRow { organization_id, connector_code } =>
                write!(f, "duplicate rows for ({}, {})", organization_id, connector_code),
            RecoverError::Sqlite(e) => write!(f, "sqlite error: {}", e),
        }
    }
}

impl std::error::Error for RecoverError {}

impl From<rusqlite::Error> for RecoverError {
    fn from(e: rusqlite::Error) -> Self {
        RecoverError::Sqlite(e.to_string())
    }
}

// ---------------------------------------------------------------
// Internal rows (may carry credential bytes; never exposed)
// ---------------------------------------------------------------

struct FullRow {
    id: String,
    connector_code: String,
    organization_id: String,
    tier: String,
    status: String,
    credential_value: Vec<u8>,
    configuration: String,
    source_device_id: String,
    created_at: String,
    updated_at: String,
    winning_logical_clock: i64,
    winning_device_id: Vec<u8>,
    winning_sequence: i64,
}

struct CandidateEvent {
    id: String,
    event_type: String,
    logical_clock: i64,
    sequence: i64,
    device_id: Vec<u8>,
    payload: Vec<u8>,
    created_at: String,
}

fn row_to_full(row: &rusqlite::Row<'_>) -> rusqlite::Result<FullRow> {
    Ok(FullRow {
        id: row.get(0)?,
        connector_code: row.get(1)?,
        organization_id: row.get(2)?,
        tier: row.get(3)?,
        status: row.get(4)?,
        credential_value: row.get(5)?,
        configuration: row.get(6)?,
        source_device_id: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        winning_logical_clock: row.get(10)?,
        winning_device_id: row.get(11)?,
        winning_sequence: row.get(12)?,
    })
}

fn load_full_row(conn: &Connection, org: &str, code: &str) -> Result<Option<FullRow>, RecoverError> {
    let row = conn.query_row(
        "SELECT id, connector_code, organization_id, tier, status,
                credential_value, configuration, source_device_id,
                created_at, updated_at,
                winning_logical_clock, winning_device_id, winning_sequence
         FROM local_connectors
         WHERE organization_id = ?1 AND connector_code = ?2",
        params![org, code],
        row_to_full,
    ).optional()?;
    Ok(row)
}

fn load_candidates(conn: &Connection, org: &str, code: &str) -> Result<Vec<CandidateEvent>, RecoverError> {
    let mut stmt = conn.prepare(
        "SELECT id, event_type, logical_clock, sequence, device_id, payload, created_at
         FROM sync_events
         WHERE organization_id = ?1
           AND entity_type = 'connector'
           AND event_type IN ('CONNECTOR_ENABLED', 'CONNECTOR_DISABLED')
           AND entity_id = ?2",
    )?;

    let rows = stmt.query_map(params![org, code], |row| {
        Ok(CandidateEvent {
            id: row.get(0)?,
            event_type: row.get(1)?,
            logical_clock: row.get(2)?,
            sequence: row.get(3)?,
            device_id: row.get(4)?,
            payload: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Fold using protocol_order_less. The result is the event the
/// application would pick as winner. No SQL ORDER BY assumption.
fn latest_candidate(events: Vec<CandidateEvent>) -> Option<CandidateEvent> {
    let mut best: Option<CandidateEvent> = None;
    for ev in events {
        best = match best {
            None => Some(ev),
            Some(b) => {
                if protocol_order_less(
                    b.logical_clock, &b.device_id, b.sequence,
                    ev.logical_clock, &ev.device_id, ev.sequence,
                ) {
                    Some(ev)
                } else {
                    Some(b)
                }
            }
        };
    }
    best
}

// ---------------------------------------------------------------
// Decoding and classification
// ---------------------------------------------------------------

enum DecodedEvent {
    Enabled {
        connector_code: String,
        tier: String,
        credential_value: Vec<u8>,
        configuration: String,
    },
    Disabled {
        connector_code: String,
    },
}

fn decode_event(ev: &CandidateEvent) -> Result<DecodedEvent, RecoverError> {
    match ev.event_type.as_str() {
        "CONNECTOR_ENABLED" => {
            let p = parse_connector_enabled_payload(&ev.payload)
                .map_err(|_| RecoverError::DecodeFailed {
                    event_id: ev.id.clone(),
                    category: "invalid CONNECTOR_ENABLED payload",
                })?;
            Ok(DecodedEvent::Enabled {
                connector_code: p.connector_code,
                tier: p.tier,
                credential_value: p.credential_value,
                configuration: p.configuration,
            })
        }
        "CONNECTOR_DISABLED" => {
            let p = parse_connector_disabled_payload(&ev.payload)
                .map_err(|_| RecoverError::DecodeFailed {
                    event_id: ev.id.clone(),
                    category: "invalid CONNECTOR_DISABLED payload",
                })?;
            Ok(DecodedEvent::Disabled {
                connector_code: p.connector_code,
            })
        }
        _ => Err(RecoverError::DecodeFailed {
            event_id: ev.id.clone(),
            category: "unexpected event type",
        }),
    }
}

/// Repair plan for a single (org, code) pair. Internal type.
/// Never printed to stdout/stderr; its credential fields are
/// passed only to the UPDATE that applies them.
#[derive(Debug)]
pub enum RepairPlan {
    Consistent,
    TupleOnly {
        row_id: String,
        logical_clock: i64,
        device_id: Vec<u8>,
        sequence: i64,
    },
    RebuildEnabled {
        row_id: String,
        tier: String,
        credential_value: Vec<u8>,
        configuration: String,
        source_device_id_hex: String,
        logical_clock: i64,
        device_id: Vec<u8>,
        sequence: i64,
        updated_at: String,
    },
    RebuildDisabledTombstone {
        row_id: String,
        source_device_id_hex: String,
        logical_clock: i64,
        device_id: Vec<u8>,
        sequence: i64,
        updated_at: String,
    },
}

fn classify(row: &FullRow, ev: &CandidateEvent) -> Result<RepairPlan, RecoverError> {
    let decoded = decode_event(ev)?;
    let tuple_matches = row.winning_logical_clock == ev.logical_clock
        && row.winning_device_id == ev.device_id
        && row.winning_sequence == ev.sequence;

    match decoded {
        DecodedEvent::Enabled { connector_code, tier, credential_value, configuration } => {
            if connector_code != row.connector_code {
                return Err(RecoverError::IdentityMismatch {
                    row_id: row.id.clone(),
                    event_id: ev.id.clone(),
                });
            }
            if row.status != "ENABLED" {
                return Err(RecoverError::StatusMismatch {
                    row_id: row.id.clone(),
                    expected: "ENABLED".to_string(),
                    actual: row.status.clone(),
                });
            }

            let content_matches = row.tier == tier
                && row.credential_value == credential_value
                && row.configuration == configuration;

            if content_matches && tuple_matches {
                Ok(RepairPlan::Consistent)
            } else if content_matches {
                Ok(RepairPlan::TupleOnly {
                    row_id: row.id.clone(),
                    logical_clock: ev.logical_clock,
                    device_id: ev.device_id.clone(),
                    sequence: ev.sequence,
                })
            } else {
                Ok(RepairPlan::RebuildEnabled {
                    row_id: row.id.clone(),
                    tier,
                    credential_value,
                    configuration,
                    source_device_id_hex: hex::encode(&ev.device_id),
                    logical_clock: ev.logical_clock,
                    device_id: ev.device_id.clone(),
                    sequence: ev.sequence,
                    updated_at: ev.created_at.clone(),
                })
            }
        }
        DecodedEvent::Disabled { connector_code } => {
            if connector_code != row.connector_code {
                return Err(RecoverError::IdentityMismatch {
                    row_id: row.id.clone(),
                    event_id: ev.id.clone(),
                });
            }
            if row.status != "DISABLED" {
                return Err(RecoverError::StatusMismatch {
                    row_id: row.id.clone(),
                    expected: "DISABLED".to_string(),
                    actual: row.status.clone(),
                });
            }

            let tombstone_ok = row.tier.is_empty()
                && row.credential_value.is_empty()
                && row.configuration.is_empty();

            if tombstone_ok && tuple_matches {
                Ok(RepairPlan::Consistent)
            } else if tombstone_ok {
                Ok(RepairPlan::TupleOnly {
                    row_id: row.id.clone(),
                    logical_clock: ev.logical_clock,
                    device_id: ev.device_id.clone(),
                    sequence: ev.sequence,
                })
            } else {
                Ok(RepairPlan::RebuildDisabledTombstone {
                    row_id: row.id.clone(),
                    source_device_id_hex: hex::encode(&ev.device_id),
                    logical_clock: ev.logical_clock,
                    device_id: ev.device_id.clone(),
                    sequence: ev.sequence,
                    updated_at: ev.created_at.clone(),
                })
            }
        }
    }
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

fn safe_row(r: &FullRow) -> SafeRow {
    SafeRow {
        id: r.id.clone(),
        connector_code: r.connector_code.clone(),
        organization_id: r.organization_id.clone(),
        tier: r.tier.clone(),
        status: r.status.clone(),
        source_device_id: r.source_device_id.clone(),
        created_at: r.created_at.clone(),
        updated_at: r.updated_at.clone(),
        winning_logical_clock: r.winning_logical_clock,
        winning_device_id_hex: hex::encode(&r.winning_device_id),
        winning_sequence: r.winning_sequence,
    }
}

fn safe_event(ev: &CandidateEvent) -> SafeEvent {
    SafeEvent {
        id: ev.id.clone(),
        event_type: ev.event_type.clone(),
        logical_clock: ev.logical_clock,
        sequence: ev.sequence,
        device_id_hex: hex::encode(&ev.device_id),
    }
}

pub fn inspect(conn: &Connection, organization_id: &str) -> Result<Vec<InspectLine>, RecoverError> {
    let mut stmt = conn.prepare(
        "SELECT id, connector_code, organization_id, tier, status,
                credential_value, configuration, source_device_id,
                created_at, updated_at,
                winning_logical_clock, winning_device_id, winning_sequence
         FROM local_connectors
         WHERE organization_id = ?1",
    )?;

    let rows = stmt.query_map(params![organization_id], row_to_full)?;

    let mut out = Vec::new();
    for r in rows {
        let r = r?;
        let candidates = load_candidates(conn, &r.organization_id, &r.connector_code)?;
        let latest = latest_candidate(candidates);
        let (status_consistent, tuple_matches_latest) = match &latest {
            None => (false, false),
            Some(ev) => {
                let expected = match ev.event_type.as_str() {
                    "CONNECTOR_ENABLED" => "ENABLED",
                    "CONNECTOR_DISABLED" => "DISABLED",
                    _ => "UNKNOWN",
                };
                let tuple_ok = r.winning_logical_clock == ev.logical_clock
                    && r.winning_device_id == ev.device_id
                    && r.winning_sequence == ev.sequence;
                (r.status == expected, tuple_ok)
            }
        };
        out.push(InspectLine {
            row: safe_row(&r),
            latest_event: latest.as_ref().map(safe_event),
            status_consistent,
            tuple_matches_latest,
        });
    }
    Ok(out)
}

pub fn plan_for_row(
    conn: &Connection,
    organization_id: &str,
    connector_code: &str,
) -> Result<RepairPlan, RecoverError> {
    let row = load_full_row(conn, organization_id, connector_code)?
        .ok_or_else(|| RecoverError::NoMatchingEvent {
            organization_id: organization_id.to_string(),
            connector_code: connector_code.to_string(),
        })?;

    let candidates = load_candidates(conn, organization_id, connector_code)?;
    let latest = latest_candidate(candidates)
        .ok_or_else(|| RecoverError::NoMatchingEvent {
            organization_id: organization_id.to_string(),
            connector_code: connector_code.to_string(),
        })?;

    classify(&row, &latest)
}

/// Apply a plan inside the caller's transaction. Never prints
/// credential or configuration values.
pub fn apply_plan(tx: &Connection, plan: RepairPlan) -> Result<(), RecoverError> {
    match plan {
        RepairPlan::Consistent => Ok(()),
        RepairPlan::TupleOnly { row_id, logical_clock, device_id, sequence } => {
            tx.execute(
                "UPDATE local_connectors
                 SET winning_logical_clock = ?1,
                     winning_device_id = ?2,
                     winning_sequence = ?3
                 WHERE id = ?4",
                params![logical_clock, device_id, sequence, row_id],
            )?;
            Ok(())
        }
        RepairPlan::RebuildEnabled {
            row_id, tier, credential_value, configuration,
            source_device_id_hex, logical_clock, device_id, sequence, updated_at,
        } => {
            tx.execute(
                "UPDATE local_connectors
                 SET tier = ?1,
                     status = 'ENABLED',
                     credential_value = ?2,
                     configuration = ?3,
                     source_device_id = ?4,
                     updated_at = ?5,
                     winning_logical_clock = ?6,
                     winning_device_id = ?7,
                     winning_sequence = ?8
                 WHERE id = ?9",
                params![
                    tier, credential_value, configuration,
                    source_device_id_hex, updated_at,
                    logical_clock, device_id, sequence, row_id,
                ],
            )?;
            Ok(())
        }
        RepairPlan::RebuildDisabledTombstone {
            row_id, source_device_id_hex, logical_clock, device_id, sequence, updated_at,
        } => {
            tx.execute(
                "UPDATE local_connectors
                 SET tier = '',
                     status = 'DISABLED',
                     credential_value = X'',
                     configuration = '',
                     source_device_id = ?1,
                     updated_at = ?2,
                     winning_logical_clock = ?3,
                     winning_device_id = ?4,
                     winning_sequence = ?5
                 WHERE id = ?6",
                params![
                    source_device_id_hex, updated_at,
                    logical_clock, device_id, sequence, row_id,
                ],
            )?;
            Ok(())
        }
    }
}

/// Human-readable summary of what a repair --dry-run would do.
#[derive(Debug, Serialize)]
pub enum RepairAction {
    TupleOnly { connector_code: String },
    RebuildEnabled { connector_code: String },
    RebuildDisabledTombstone { connector_code: String },
}

#[derive(Debug, Serialize)]
pub struct RepairReport {
    pub organization_id: String,
    pub total_rows: usize,
    pub consistent: usize,
    pub actions: Vec<(String, RepairAction)>,
}

fn codes_for_org(conn: &Connection, organization_id: &str) -> Result<Vec<String>, RecoverError> {
    let mut stmt = conn.prepare(
        "SELECT connector_code FROM local_connectors WHERE organization_id = ?1",
    )?;
    let iter = stmt.query_map(params![organization_id], |row| row.get::<_, String>(0))?;
    let mut v = Vec::new();
    for r in iter {
        v.push(r?);
    }
    Ok(v)
}

pub fn repair_dry_run(
    conn: &Connection,
    organization_id: &str,
) -> Result<RepairReport, RecoverError> {
    let codes = codes_for_org(conn, organization_id)?;
    let total_rows = codes.len();
    let mut consistent = 0usize;
    let mut actions = Vec::new();

    for code in &codes {
        let plan = plan_for_row(conn, organization_id, code)?;
        match plan {
            RepairPlan::Consistent => consistent += 1,
            RepairPlan::TupleOnly { .. } =>
                actions.push((code.clone(), RepairAction::TupleOnly { connector_code: code.clone() })),
            RepairPlan::RebuildEnabled { .. } =>
                actions.push((code.clone(), RepairAction::RebuildEnabled { connector_code: code.clone() })),
            RepairPlan::RebuildDisabledTombstone { .. } =>
                actions.push((code.clone(), RepairAction::RebuildDisabledTombstone { connector_code: code.clone() })),
        }
    }

    Ok(RepairReport {
        organization_id: organization_id.to_string(),
        total_rows,
        consistent,
        actions,
    })
}

/// Classify every row first (read-only). If any classification
/// fails, return Err before opening the write transaction.
/// Apply all plans in one transaction. Returns the count applied.
pub fn repair_apply(
    conn: &mut Connection,
    organization_id: &str,
) -> Result<usize, RecoverError> {
    let codes = codes_for_org(conn, organization_id)?;
    let mut plans = Vec::with_capacity(codes.len());
    for code in &codes {
        plans.push(plan_for_row(conn, organization_id, code)?);
    }

    let tx = conn.transaction()?;
    let mut applied = 0usize;
    for plan in plans {
        match plan {
            RepairPlan::Consistent => {}
            other => {
                apply_plan(&tx, other)?;
                applied += 1;
            }
        }
    }
    tx.commit()?;
    Ok(applied)
}