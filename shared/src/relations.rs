// gorka-shared::relations
//
// Debtor relation operations. New code for Phase 9.5 Stage B
// sub-slice 3, not extracted from the Client.
//
// The debtor_relations table (added by the Stage A migration,
// v7) links a debtor to a guarantor or pledger. The related
// person is itself a debtors row with role GUARANTOR or
// PLEDGER. The relation is stored directionally (debtor_id is
// the primary debtor; related_debtor_id is the related
// person).
//
// get_debtor_relations returns only rows where debtor_id = the
// requested debtor. On Y's profile, the agent sees who is
// related to Y. A reverse-direction view is out of scope.
//
// All three functions take a trusted organization_id. The
// spec's section 6.3 example signatures did not include it, but
// LOCAL-TABLES.md v1.3 Amendment 1 requires organization_id in
// debtor_relations to be derived from trusted context, not
// supplied by the frontend.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use uuid::Uuid;
use chrono::Utc;

use crate::db;
use crate::models::{DebtorRelation, DebtorRelationInput};
use crate::storage::AppStorage;

pub fn get_debtor_relations(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<Vec<DebtorRelation>, String> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.organization_id, r.debtor_id, r.related_debtor_id,
                r.relation_type, r.created_at, b.name, b.surname, b.email,
                b.phone, b.role
         FROM debtor_relations r
         INNER JOIN debtors b ON b.id = r.related_debtor_id
         WHERE r.organization_id = ?1 AND r.debtor_id = ?2
         ORDER BY b.surname, b.name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![organization_id, debtor_id], |row| {
        Ok(DebtorRelation {
            id: row.get(0)?,
            organization_id: row.get(1)?,
            debtor_id: row.get(2)?,
            related_debtor_id: row.get(3)?,
            relation_type: row.get(4)?,
            created_at: row.get(5)?,
            related_name: row.get(6)?,
            related_surname: row.get(7)?,
            related_email: row.get(8)?,
            related_phone: row.get(9)?,
            related_role: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut relations = Vec::new();
    for row in rows {
        relations.push(row.map_err(|e| e.to_string())?);
    }

    Ok(relations)
}

pub fn insert_debtor_relation(
    conn: &Connection,
    organization_id: &str,
    input: DebtorRelationInput,
) -> Result<DebtorRelation, String> {
    if input.debtor_id == input.related_debtor_id {
        return Err("Cannot create a relation to the same debtor".to_string());
    }

    match input.relation_type.as_str() {
        "GUARANTOR" | "PLEDGER" => {}
        _ => return Err("Invalid relation_type".to_string()),
    }

    let debtor_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&input.debtor_id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debtor_ok == 0 {
        return Err("Debtor not found or not in this organization".to_string());
    }

    let related_ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
        params![&input.related_debtor_id, organization_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if related_ok == 0 {
        return Err("Related debtor not found or not in this organization".to_string());
    }

    let duplicate: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtor_relations
         WHERE debtor_id = ?1 AND related_debtor_id = ?2 AND relation_type = ?3",
        params![&input.debtor_id, &input.related_debtor_id, &input.relation_type],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if duplicate > 0 {
        return Err("Relation already exists".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO debtor_relations
            (id, organization_id, debtor_id, related_debtor_id, relation_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            &id,
            organization_id,
            &input.debtor_id,
            &input.related_debtor_id,
            &input.relation_type,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    let (related_name, related_surname, related_email, related_phone, related_role): (
        String, String, Option<String>, Option<String>, String,
    ) = conn.query_row(
        "SELECT name, surname, email, phone, role FROM debtors WHERE id = ?1",
        params![&input.related_debtor_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    ).map_err(|e| e.to_string())?;

    Ok(DebtorRelation {
        id,
        organization_id: organization_id.to_string(),
        debtor_id: input.debtor_id,
        related_debtor_id: input.related_debtor_id,
        relation_type: input.relation_type,
        created_at: now,
        related_name,
        related_surname,
        related_email,
        related_phone,
        related_role,
    })
}

pub fn delete_debtor_relation(
    conn: &Connection,
    storage: &AppStorage,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    // Read the related person before we delete the relation row.
    let related: Option<String> = conn
        .query_row(
            "SELECT related_debtor_id FROM debtor_relations
             WHERE id = ?1 AND organization_id = ?2",
            params![id, organization_id],
            |row| row.get(0),
        )
        .ok();

    let related_id = match related {
        Some(r) => r,
        None => return Ok(false),
    };

    let affected = conn.execute(
        "DELETE FROM debtor_relations WHERE id = ?1 AND organization_id = ?2",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Ok(false);
    }

    // If the related person was a marker-role related debtor and
    // now has nothing else (no other relations, no debts, no
    // communications, no actions, no documents), remove the
    // person row and their files folder. A plain debtor (role
    // DEBTOR) is never touched.
    let role: Option<String> = conn
        .query_row(
            "SELECT role FROM debtors WHERE id = ?1 AND organization_id = ?2",
            params![&related_id, organization_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(r) = role {
        if r != "DEBTOR" {
            let orphaned = is_orphaned_related_debtor(conn, organization_id, &related_id)?;
            if orphaned {
                conn.execute(
                    "DELETE FROM debtors WHERE id = ?1 AND organization_id = ?2",
                    params![&related_id, organization_id],
                ).map_err(|e| e.to_string())?;

                if let Ok(dir) = db::get_debtor_files_dir(storage, &related_id) {
                    if dir.exists() {
                        let _ = std::fs::remove_dir_all(&dir);
                    }
                }
            }
        }
    }

    Ok(true)
}

fn is_orphaned_related_debtor(
    conn: &Connection,
    organization_id: &str,
    debtor_id: &str,
) -> Result<bool, String> {
    let relations: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debtor_relations
         WHERE organization_id = ?1
           AND (debtor_id = ?2 OR related_debtor_id = ?2)",
        params![organization_id, debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if relations > 0 {
        return Ok(false);
    }

    let debts: i64 = conn.query_row(
        "SELECT COUNT(*) FROM debts WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if debts > 0 {
        return Ok(false);
    }

    let comms: i64 = conn.query_row(
        "SELECT COUNT(*) FROM communications WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if comms > 0 {
        return Ok(false);
    }

    let acts: i64 = conn.query_row(
        "SELECT COUNT(*) FROM actions WHERE debtor_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if acts > 0 {
        return Ok(false);
    }

    let docs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE entity_id = ?1",
        params![debtor_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if docs > 0 {
        return Ok(false);
    }

    Ok(true)
}