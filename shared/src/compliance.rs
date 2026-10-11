// gorka-shared::compliance
//
// Slice 1 of the AI Copilot + compliance work.
// Authority: CONNECTOR-EVENT-ORDER-SPEC Part II §II.17.1, §II.17.2.
//
// This module owns:
//   - Opt-out state stored in debtors.data.opt_out.<channel>
//   - The send-path guard (check_opt_out)
//   - The disclosure-text reader
//   - The idempotent disclosure append
//
// Boundaries:
//   - Pure helpers (channel_for_connector_code, get_opt_out,
//     append_disclosure_idempotent) have no DB dependency.
//   - DB operations (set_debtor_opt_out, get_disclosure_text,
//     check_opt_out) take a connection reference.
//
// Not in this module: quiet-hours enforcement, contact limits,
// reservations. Deferred to later slices.

use rusqlite::{params, Connection};
use serde_json::{json, Value};

use crate::sync;
use crate::sync_events;

/// The three channels the MVP recognizes for opt-out purposes.
/// Matches CONNECTOR-EVENT-ORDER-SPEC Part II §II.17.1: the
/// mapping is by connector code, not by anything the caller supplies.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Channel {
    Email,
    Sms,
    Voice,
}

impl Channel {
    pub fn as_str(self) -> &'static str {
        match self {
            Channel::Email => "email",
            Channel::Sms => "sms",
            Channel::Voice => "voice",
        }
    }
}

impl std::str::FromStr for Channel {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "email" => Ok(Channel::Email),
            "sms" => Ok(Channel::Sms),
            "voice" => Ok(Channel::Voice),
            other => Err(format!("unknown channel: {}", other)),
        }
    }
}

/// The typed reason a send is blocked by the compliance layer.
/// The caller (send_connector_message) maps this to a user-facing
/// error string; the audit log records the variant name and the
/// connector code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ComplianceBlock {
    /// The debtor has the opt-out flag set for the channel that
    /// this connector serves.
    OptOut { channel: Channel },
    /// The connector code does not map to a known channel. Fail
    /// closed: an unrecognized connector must not bypass the guard.
    UnknownConnector { connector_code: String },
    /// The debtor row is absent from the local DB, or the local
    /// read failed. Fail closed.
    DebtorNotFound { debtor_id: String },
    /// debtors.data is not a JSON object, or the opt_out flag is
    /// not a boolean. Fail closed.
    MalformedData,
}

/// Map a connector code to the channel it serves, or None if the
/// code is not a recognized messaging connector.
///
/// This is deliberately separate from the existing
/// communication_type_for helper in src-tauri-agent, which returns
/// "NOTE" for unknown codes. The compliance guard must fail closed
/// on unknown codes; communication_type_for must not.
pub fn channel_for_connector_code(code: &str) -> Option<Channel> {
    if code.ends_with("-email") {
        Some(Channel::Email)
    } else if code.ends_with("-sms") {
        Some(Channel::Sms)
    } else if code.ends_with("-voice") {
        Some(Channel::Voice)
    } else {
        None
    }
}

/// Read the opt-out flag for a channel from a debtor's data blob.
///
/// Returns:
///   Ok(true)  - flag is set
///   Ok(false) - flag is absent or explicitly false
///   Err(_)    - data is not an object, opt_out is not an object,
///               or the flag is not a boolean
pub fn get_opt_out(data: &Value, channel: Channel) -> Result<bool, ComplianceBlock> {
    let obj = data.as_object().ok_or(ComplianceBlock::MalformedData)?;
    let opt_out = match obj.get("opt_out") {
        None => return Ok(false),
        Some(v) => v.as_object().ok_or(ComplianceBlock::MalformedData)?,
    };
    match opt_out.get(channel.as_str()) {
        None => Ok(false),
        Some(v) => v.as_bool().ok_or(ComplianceBlock::MalformedData),
    }
}

/// The send-path guard. Called by send_connector_message before
/// any provider call, after the DB lock and before
/// read_local_connector_credential.
///
/// Fail-closed table (per SLICE-1-MINI-SPEC v1.2 §3.1):
///   known connector + opted out       -> Err(OptOut)
///   known connector + not opted out   -> Ok(())
///   unknown connector                 -> Err(UnknownConnector)
///   malformed data                    -> Err(MalformedData)
///   debtor row absent / read error    -> Err(DebtorNotFound)
pub fn check_opt_out(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
    connector_code: &str,
) -> Result<(), ComplianceBlock> {
    let channel = channel_for_connector_code(connector_code).ok_or_else(|| {
        ComplianceBlock::UnknownConnector {
            connector_code: connector_code.to_string(),
        }
    })?;

    let data_str: String = conn
        .query_row(
            "SELECT data FROM debtors
             WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            params![debtor_id, organization_id],
            |row| row.get(0),
        )
        .map_err(|_| ComplianceBlock::DebtorNotFound {
            debtor_id: debtor_id.to_string(),
        })?;

    let data: Value = serde_json::from_str(&data_str)
        .map_err(|_| ComplianceBlock::MalformedData)?;

    if get_opt_out(&data, channel)? {
        Err(ComplianceBlock::OptOut { channel })
    } else {
        Ok(())
    }
}

/// Set or clear a debtor's opt-out flag for one channel.
///
/// Reads the current data blob, mutates only data.opt_out.<channel>,
/// writes the full blob back, and originates exactly one
/// ENTITY_UPDATED with data_json as the sole change record.
///
/// All three operations commit together or none does.
pub fn set_debtor_opt_out(
    conn: &mut Connection,
    organization_id: &str,
    debtor_id: &str,
    channel: Channel,
    value: bool,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let data_str: String = tx
        .query_row(
            "SELECT data FROM debtors
             WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            params![debtor_id, organization_id],
            |row| row.get(0),
        )
        .map_err(|_| "Debtor not found or not in this organization".to_string())?;

    let mut data: Value = serde_json::from_str(&data_str)
        .map_err(|e| format!("data is not valid JSON: {}", e))?;

    let obj = data
        .as_object_mut()
        .ok_or_else(|| "debtor.data is not a JSON object".to_string())?;

    if !obj.contains_key("opt_out") {
        obj.insert("opt_out".to_string(), json!({}));
    }
    let opt_out = obj
        .get_mut("opt_out")
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| "debtor.data.opt_out is not an object".to_string())?;

    opt_out.insert(channel.as_str().to_string(), json!(value));

    let new_data_json = serde_json::to_string(&data).map_err(|e| e.to_string())?;

    let affected = tx
        .execute(
            "UPDATE debtors SET data = ?1, updated_at = ?2
             WHERE id = ?3 AND organization_id = ?4",
            params![&new_data_json, &now, debtor_id, organization_id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let changes: Vec<(&str, Option<&str>)> = vec![("data_json", Some(&new_data_json))];
    let payload = sync::encode_entity_updated_payload(&changes);
    sync_events::originate_event(
        &tx,
        organization_id,
        sync_events::EVENT_ENTITY_UPDATED,
        sync_events::ENTITY_DEBTOR,
        debtor_id,
        &payload,
        &["data_json"],
    )?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the disclosure_text from the single-row compliance_rules
/// table. Returns Ok(None) when no row exists (fresh install) or
/// when the value is NULL.
///
/// No organization filter: the table is single-row per device,
/// enforced by CHECK (id = 1).
pub fn get_disclosure_text(conn: &Connection) -> Result<Option<String>, String> {
    match conn.query_row(
        "SELECT disclosure_text FROM compliance_rules WHERE id = 1",
        [],
        |row| row.get::<_, Option<String>>(0),
    ) {
        Ok(opt) => Ok(opt),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Append the disclosure to the body, idempotently.
///
/// - Empty or whitespace-only disclosure: returns body unchanged.
/// - Disclosure already the last non-empty line: body unchanged.
/// - Otherwise: returns `body + "\n" + disclosure`.
pub fn append_disclosure_idempotent(body: &str, disclosure: &str) -> String {
    let trimmed = disclosure.trim();
    if trimmed.is_empty() {
        return body.to_string();
    }

    let last_nonempty = body.lines().rev().find(|l| !l.trim().is_empty());

    if let Some(line) = last_nonempty {
        if line.trim() == trimmed {
            return body.to_string();
        }
    }

    format!("{}\n{}", body, trimmed)
}