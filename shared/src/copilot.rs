// shared/src/copilot.rs
//
// Slice 5b. Copilot orchestration.
// Authority: SLICE 5b — MINI SPEC v1.0 (FROZEN), §7.
//
// Contract:
//   - Selection is deterministic: gemini-ai, then openai-compatible,
//     in AI_PROVIDER_CODES order. First enabled connector wins.
//   - The caller builds the adapter. This module refuses if the
//     adapter's code is not a registered AI provider.
//   - analyze_debtor runs strategy::analyze and persists the result
//     as a PENDING recommendation. insert_pending supersedes prior
//     PENDING or ACCEPTED rows in the same transaction.
//   - No process identity is received or stored.

use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::connectors::{self, ConnectorAdapter, ConnectorCredential};
use crate::recommendation_store::{self, RecommendationRow, StoreError};
use crate::strategy;

/// AI provider catalog codes in deterministic selection order.
/// Adding a new AI adapter: extend this list and register a factory
/// in build_default_registry.
pub const AI_PROVIDER_CODES: &[&str] = &["gemini-ai", "openai-compatible"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CopilotError {
    AiConnectorUnavailable,
    NoDebtor,
    StoreError(String),
    DbError(String),
}

impl std::fmt::Display for CopilotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CopilotError::AiConnectorUnavailable => {
                write!(f, "no enabled AI connector on this device")
            }
            CopilotError::NoDebtor => write!(f, "debtor not found"),
            CopilotError::StoreError(e) => write!(f, "store error: {}", e),
            CopilotError::DbError(e) => write!(f, "database error: {}", e),
        }
    }
}

impl std::error::Error for CopilotError {}

/// A selected AI provider: catalog code, model identifier from
/// configuration, and the credential material to construct the
/// adapter. Does not construct the adapter itself.
pub struct SelectedAiProvider {
    pub connector_code: String,
    pub model: String,
    pub credential: ConnectorCredential,
}

/// Pick the first enabled AI provider for `org_id`. Order is
/// AI_PROVIDER_CODES. Reads only `local_connectors`; does not
/// construct the adapter and does not touch the network.
pub fn select_ai_provider(
    conn: &Connection,
    org_id: &str,
) -> Result<SelectedAiProvider, CopilotError> {
    for code in AI_PROVIDER_CODES {
        let row: Option<(Vec<u8>, String)> = conn
            .query_row(
                "SELECT credential_value, configuration FROM local_connectors
                  WHERE organization_id = ?1 AND connector_code = ?2
                    AND status = 'ENABLED'",
                rusqlite::params![org_id, *code],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();

        if let Some((value, config_str)) = row {
            let configuration: serde_json::Value =
                serde_json::from_str(&config_str).unwrap_or(serde_json::Value::Null);
            let model = configuration
                .get("model")
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_string();
            return Ok(SelectedAiProvider {
                connector_code: (*code).to_string(),
                model,
                credential: ConnectorCredential { value, configuration },
            });
        }
    }
    Err(CopilotError::AiConnectorUnavailable)
}

/// Construct the adapter for a selected provider via the registry.
pub fn build_selected_adapter(
    selected: &SelectedAiProvider,
) -> Result<Box<dyn ConnectorAdapter>, CopilotError> {
    let registry = connectors::build_default_registry();
    let factory = registry
        .factory(&selected.connector_code)
        .ok_or(CopilotError::AiConnectorUnavailable)?;
    let adapter = factory(ConnectorCredential {
        value: selected.credential.value.clone(),
        configuration: selected.credential.configuration.clone(),
    })
    .map_err(|e| CopilotError::DbError(format!("adapter build: {:?}", e)))?;
    Ok(adapter)
}

/// Analyze a debtor and persist a PENDING recommendation.
///
/// The caller selects an enabled AI provider via `select_ai_provider`,
/// builds the adapter via `build_selected_adapter`, and passes the
/// resulting adapter and model here. This function refuses if the
/// adapter's `code()` is not one of `AI_PROVIDER_CODES`.
pub fn analyze_debtor(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    model: &str,
    adapter: &dyn ConnectorAdapter,
    created_by: &str,
    now: DateTime<Utc>,
) -> Result<RecommendationRow, CopilotError> {
    let adapter_code = adapter.code();
    if !AI_PROVIDER_CODES.contains(&adapter_code) {
        return Err(CopilotError::AiConnectorUnavailable);
    }

    // Confirm the debtor exists in this org and is not deleted.
    let debtor_ok: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM debtors
              WHERE id = ?1 AND organization_id = ?2 AND deleted != 'true'",
            rusqlite::params![debtor_id, org_id],
            |r| r.get(0),
        )
        .map_err(|e| CopilotError::DbError(e.to_string()))?;
    if debtor_ok == 0 {
        return Err(CopilotError::NoDebtor);
    }

    // strategy::analyze always returns Ok on the AI path (any AI-side
    // failure returns Fallback). Err means the fallback input could
    // not be built at all.
    let outcome = strategy::analyze(&*conn, org_id, debtor_id, now, model, adapter)
        .map_err(|e| CopilotError::StoreError(format!("{:?}", e)))?;

    let row = recommendation_store::insert_pending(
        conn,
        org_id,
        debtor_id,
        adapter_code,
        created_by,
        &outcome,
        now,
    )
    .map_err(|e| match e {
        StoreError::DbError(m) => CopilotError::DbError(m),
        other => CopilotError::StoreError(format!("{:?}", other)),
    })?;

    Ok(row)
}