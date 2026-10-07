// gorka-shared::connectors::local_record
//
// Write-through for the local_connectors table.
// Phase B3 of the Connection Center work.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::sync::encode_connector_enabled_payload;
use crate::sync_events::{self, ENTITY_CONNECTOR, EVENT_CONNECTOR_ENABLED};

pub struct LocalConnectorInput {
    pub connector_code: String,
    pub tier: String,
    pub status: String,
    pub credential_value: Vec<u8>,
    pub configuration: String,
}

/// Read-model view of a local_connectors row.
///
/// Deliberately omits credential_value. The read model is what
/// the UI and the sync layer's own inspection helpers consume;
/// it must never carry the secret. If a future need requires the
/// credential, read it by a dedicated function whose name says
/// so, not by widening this struct.
#[derive(Serialize)]
pub struct LocalConnectorRow {
    pub connector_code: String,
    pub tier: String,
    pub status: String,
    pub configuration: String,
    pub source_device_id: String,
    pub updated_at: String,
}

pub fn upsert_local_connector(
    conn: &Connection,
    organization_id: &str,
    source_device_id: &str,
    input: LocalConnectorInput,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM local_connectors WHERE organization_id = ?1 AND connector_code = ?2",
            params![organization_id, input.connector_code],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match existing_id {
        Some(id) => {
            conn.execute(
                "UPDATE local_connectors SET tier = ?1, status = ?2, credential_value = ?3, configuration = ?4, source_device_id = ?5, updated_at = ?6 WHERE id = ?7",
                params![
                    input.tier,
                    input.status,
                    input.credential_value,
                    input.configuration,
                    source_device_id,
                    now,
                    id,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO local_connectors (id, connector_code, organization_id, tier, status, credential_value, configuration, source_device_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    id,
                    input.connector_code,
                    organization_id,
                    input.tier,
                    input.status,
                    input.credential_value,
                    input.configuration,
                    source_device_id,
                    now,
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Write the local record and originate a CONNECTOR_ENABLED event
/// in one transaction.
///
/// The state change and the sync_events row commit or roll back
/// together (SYNC-ARCHITECTURE.md Section 25.4.1). There is no
/// state in which one exists without the other.
///
/// This is the write path the Client Dashboard's
/// write_local_connector_credential command uses. Every local
/// connector write is intended to reach the other devices.
pub fn upsert_local_connector_with_event(
    conn: &mut Connection,
    organization_id: &str,
    source_device_id: &str,
    input: LocalConnectorInput,
) -> Result<(), String> {
    let enabled_at_ms = chrono::Utc::now().timestamp_millis() as u64;

    // Build the payload before opening the transaction, so any
    // serialization problem fails before any write.
    let payload = encode_connector_enabled_payload(
        &input.connector_code,
        &input.tier,
        &input.credential_value,
        &input.configuration,
        enabled_at_ms,
    );
    let connector_code = input.connector_code.clone();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    upsert_local_connector(&tx, organization_id, source_device_id, input)?;

    // Section 25.14.5 explicitly says: no entity_field_state rows
    // for CONNECTOR events. The fields_set argument is empty on
    // purpose. CONNECTOR records do not participate in field-level
    // reconciliation.
    sync_events::originate_event(
        &tx,
        organization_id,
        EVENT_CONNECTOR_ENABLED,
        ENTITY_CONNECTOR,
        &connector_code,
        &payload,
        &[],
    )?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the enabled connector rows for one organization.
///
/// Returns the read model (no credential_value). Rows are ordered
/// by connector_code so the UI shows a stable list.
pub fn list_local_connectors(
    conn: &Connection,
    organization_id: &str,
) -> Result<Vec<LocalConnectorRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT connector_code, tier, status, configuration, source_device_id, updated_at
             FROM local_connectors
             WHERE organization_id = ?1
             ORDER BY connector_code ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![organization_id], |row| {
            Ok(LocalConnectorRow {
                connector_code: row.get(0)?,
                tier: row.get(1)?,
                status: row.get(2)?,
                configuration: row.get(3)?,
                source_device_id: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}