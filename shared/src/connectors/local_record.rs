// gorka-shared::connectors::local_record
//
// Write-through for the local_connectors table.
// Phase B3 of the Connection Center work.

use rusqlite::{params, Connection, OptionalExtension};

pub struct LocalConnectorInput {
    pub connector_code: String,
    pub tier: String,
    pub status: String,
    pub credential_value: Vec<u8>,
    pub configuration: String,
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

