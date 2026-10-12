// shared/src/claim_resolution.rs
//
// Slice 4. Claim resolution.
// Authority: SLICE 4 — MINI SPEC v1.0 (FROZEN), §8.
//
// Records are held in memory by the caller. No persistence in Slice 4.
//
// Draft-ID transition (module header, verbatim):
//
//   The caller increments draft_id on every change to subject or
//   body. A flag carries the draft_id of the draft it was computed
//   from. A resolution carries the draft_id of the draft the
//   resolution applies to — the current draft_id at the moment
//   resolve_claim is called.
//
//   SelectedDbValue is expected to be called with
//   flag.draft_id == current_draft_id. Any mismatch is StaleFlag.
//   The caller resolves first, applies the replacement, then
//   bumps the ID.
//
//   EditRemoved is expected to be called after the edit has been
//   applied and the ID bumped. flag.draft_id < current_draft_id is
//   the normal case. flag.draft_id > current_draft_id is always
//   StaleFlag. flag.draft_id == current_draft_id means no edit has
//   occurred since the flag was computed, so the claim is by
//   construction still present: ClaimStillPresent.
//
// EditRemoved span check (known limitation, documented verbatim):
//
//   For EditRemoved the span is checked by equality, not by an
//   edit-mapping. If an edit inserts text before the flag's
//   position without removing the claim, the flag's byte range may
//   now land on unrelated text and the check will return
//   Ok(EditRemoved) incorrectly. The intended caller workflow
//   removes this risk: after every edit the caller re-runs
//   validate_draft. Any claim that survived the edit is present in
//   the fresh flag set. The caller resolves the stale flag as
//   EditRemoved only when the matching claim is absent from the
//   fresh set. The span check is a defense-in-depth confirmation,
//   not the primary decision.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};

use crate::fact_validation::{ClaimFlag, ClaimSource, ClaimType};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolutionChoice {
    EditRemoved,
    SelectedDbValue { value: String, source_row_id: String },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolutionRecord {
    pub claim_type: ClaimType,
    pub choice: ResolutionChoice,
    pub resolved_text: String,
    pub user_id: String,
    pub resolved_at: DateTime<Utc>,
    pub draft_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolutionError {
    StaleFlag { flag_draft_id: u64, current_draft_id: u64 },
    ValueNotInDb(String),
    ClaimTypeNotResolvable(ClaimType),
    ClaimStillPresent,
    SpanOutOfRange,
}

pub fn resolve_claim(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    current_draft_id: u64,
    current_subject: &str,
    current_body: &str,
    flag: &ClaimFlag,
    choice: ResolutionChoice,
    user_id: &str,
    now: DateTime<Utc>,
) -> Result<ResolutionRecord, ResolutionError> {
    let _ = org_id; // scoping enforced via debtor_id
    let text = match flag.source {
        ClaimSource::Subject => current_subject,
        ClaimSource::Body => current_body,
    };

    match choice {
        ResolutionChoice::EditRemoved => {
            if flag.draft_id > current_draft_id {
                return Err(ResolutionError::StaleFlag {
                    flag_draft_id: flag.draft_id,
                    current_draft_id,
                });
            }
            if flag.draft_id == current_draft_id {
                return Err(ResolutionError::ClaimStillPresent);
            }
            check_bounds(text, flag)?;
            if text[flag.span_start..flag.span_end] == flag.matched_text {
                return Err(ResolutionError::ClaimStillPresent);
            }
            Ok(ResolutionRecord {
                claim_type: flag.claim_type,
                choice: ResolutionChoice::EditRemoved,
                resolved_text: String::new(),
                user_id: user_id.to_string(),
                resolved_at: now,
                draft_id: current_draft_id,
            })
        }
        ResolutionChoice::SelectedDbValue { value, source_row_id } => {
            if flag.draft_id != current_draft_id {
                return Err(ResolutionError::StaleFlag {
                    flag_draft_id: flag.draft_id,
                    current_draft_id,
                });
            }
            check_bounds(text, flag)?;
            if text[flag.span_start..flag.span_end] != flag.matched_text {
                return Err(ResolutionError::SpanOutOfRange);
            }
            match flag.claim_type {
                ClaimType::PriorPromisePayment | ClaimType::LegalOrCreditConsequence => {
                    return Err(ResolutionError::ClaimTypeNotResolvable(flag.claim_type));
                }
                _ => {}
            }
            let _ = source_row_id;
            let row_id = verify_value_in_db(conn, debtor_id, flag.claim_type, &value)
                .map_err(|_| ResolutionError::ValueNotInDb(value.clone()))?;
            Ok(ResolutionRecord {
                claim_type: flag.claim_type,
                choice: ResolutionChoice::SelectedDbValue {
                    value: value.clone(),
                    source_row_id: row_id,
                },
                resolved_text: value,
                user_id: user_id.to_string(),
                resolved_at: now,
                draft_id: current_draft_id,
            })
        }
    }
}

fn check_bounds(text: &str, flag: &ClaimFlag) -> Result<(), ResolutionError> {
    if flag.span_start > flag.span_end {
        return Err(ResolutionError::SpanOutOfRange);
    }
    if flag.span_end > text.len() {
        return Err(ResolutionError::SpanOutOfRange);
    }
    if !text.is_char_boundary(flag.span_start) {
        return Err(ResolutionError::SpanOutOfRange);
    }
    if !text.is_char_boundary(flag.span_end) {
        return Err(ResolutionError::SpanOutOfRange);
    }
    Ok(())
}

fn verify_value_in_db(
    conn: &Connection,
    debtor_id: &str,
    claim_type: ClaimType,
    value: &str,
) -> Result<String, ()> {
    match claim_type {
        ClaimType::InvoiceRef => {
            let row: Option<String> = conn
                .query_row(
                    "SELECT id FROM debts WHERE debtor_id = ?1 AND id = ?2",
                    params![debtor_id, value],
                    |r| r.get(0),
                )
                .optional()
                .map_err(|_| ())?;
            row.ok_or(())
        }
        // Other resolvable types are not exercised by Slice 4's callers.
        // A caller that selects a DB value for one of them gets the same
        // rejection as "no row matched", which is honest: this engine
        // cannot confirm the choice.
        _ => Err(()),
    }
}