// gorka-shared::connectors::local_record
//
// Write-through for the local_connectors table.
// Phase B3 of the Connection Center work.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::sync::{encode_connector_enabled_payload, encode_connector_disabled_payload};
use crate::sync_events::{self, ENTITY_CONNECTOR, EVENT_CONNECTOR_ENABLED, EVENT_CONNECTOR_DISABLED};

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
               AND status = 'ENABLED'
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

/// The credential material and parsed configuration for one enabled
/// connector on this device.
///
/// The name says explicitly that this struct carries the secret.
/// No other read function on local_connectors returns
/// credential_value; this one must only be called by code whose
/// purpose is to use the credential against the provider — for
/// example the Agent's send command. It must never be called from a
/// UI read path.
pub struct LocalConnectorSecret {
    pub credential_value: Vec<u8>,
    pub configuration: serde_json::Value,
}

/// Read the credential and configuration for one enabled connector.
///
/// Returns Ok(None) if the connector is not enabled for this
/// organization, or if its status is not 'ENABLED'.
///
/// The stored configuration string is parsed into a serde_json::Value
/// before return; malformed JSON in storage is an error, not a
/// silent None.
pub fn read_local_connector_credential(
    conn: &Connection,
    organization_id: &str,
    connector_code: &str,
) -> Result<Option<LocalConnectorSecret>, String> {
    let raw: Option<(Vec<u8>, String)> = conn
        .query_row(
            "SELECT credential_value, configuration
             FROM local_connectors
             WHERE organization_id = ?1
               AND connector_code = ?2
               AND status = 'ENABLED'",
            params![organization_id, connector_code],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let Some((credential_value, configuration_json)) = raw else {
        return Ok(None);
    };

    let configuration: serde_json::Value = serde_json::from_str(&configuration_json)
        .map_err(|e| format!("Stored connector configuration is not valid JSON: {}", e))?;

    Ok(Some(LocalConnectorSecret {
        credential_value,
        configuration,
    }))
}

/// Disable a local connector and originate a CONNECTOR_DISABLED
/// event in one transaction.
///
/// The credential value, configuration, and tier are wiped. The
/// row remains with status = DISABLED so a later ENABLED from
/// another device must win the tie-break before the connector is
/// usable again.
///
/// This is the write path the Client Dashboard's
/// disable_local_connector command uses. CONNECTOR-EVENT-ORDER-SPEC
/// v1.0 §7.3.
pub fn disable_local_connector_with_event(
    conn: &mut Connection,
    organization_id: &str,
    source_device_id: &str,
    connector_code: &str,
) -> Result<(), String> {
    let disabled_at_ms = chrono::Utc::now().timestamp_millis() as u64;
    let payload = encode_connector_disabled_payload(connector_code, disabled_at_ms);
    let now = chrono::Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE local_connectors
         SET status = 'DISABLED',
             tier = '',
             credential_value = X'',
             configuration = '',
             source_device_id = ?1,
             updated_at = ?2
         WHERE organization_id = ?3 AND connector_code = ?4",
        params![source_device_id, now, organization_id, connector_code],
    ).map_err(|e| e.to_string())?;

    sync_events::originate_event(
        &tx,
        organization_id,
        EVENT_CONNECTOR_DISABLED,
        ENTITY_CONNECTOR,
        connector_code,
        &payload,
        &[],
    )?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}