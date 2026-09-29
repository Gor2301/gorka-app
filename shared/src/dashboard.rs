// gorka-shared::dashboard
//
// Dashboard aggregate statistics. Moved from the Client
// Dashboard's Tauri command layer in Phase 9.5, slice
// "dashboard".
//
// The SQL string is identical to the code that lived in
// src-tauri/src/main.rs. All three organization filters are
// preserved, all three subqueries are bound to a single ?1,
// and the row mapping is unchanged. Only the signature changed:
// the organization id and the connection are supplied by the
// caller.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};

use crate::models::DashboardStats;

pub fn get_dashboard_stats(
    conn: &Connection,
    organization_id: &str,
) -> Result<DashboardStats, String> {
    let stats = conn.query_row(
        "SELECT
            (SELECT COUNT(*) FROM debtors
               WHERE organization_id = ?1) AS total_debtors,
            (SELECT COALESCE(SUM(d.amount), 0)
               FROM debts d
               INNER JOIN debtors b ON b.id = d.debtor_id
               WHERE b.organization_id = ?1
                 AND d.status NOT IN ('PAID', 'CANCELLED')) AS total_debt,
            (SELECT COUNT(*) FROM actions a
               INNER JOIN debtors b ON b.id = a.debtor_id
               WHERE b.organization_id = ?1) AS total_actions",
        params![organization_id],
        |row| Ok(DashboardStats {
            total_debtors: row.get(0)?,
            total_debt: row.get(1)?,
            total_actions: row.get(2)?,
        }),
    ).map_err(|e| e.to_string())?;

    Ok(stats)
}