// gorka-shared::calendar
//
// Calendar event operations and derived calendar views. New code
// for Phase 9.5 Stage B sub-slice 2, not extracted from the Client.
//
// The four CRUD functions operate on the calendar_events table
// (added by the Stage A migration, v6). The two derived views are
// read-only queries over debts and actions; they store nothing.
//
// All six functions take a trusted organization_id. The spec's
// section 6.3 example signatures did not include it, but
// LOCAL-TABLES.md v1.3 Amendment 1 requires organization_id in
// calendar_events to be derived from trusted context, not
// supplied by the frontend. All six therefore take it from the
// caller.
//
// Nothing here is Tauri-specific.

use rusqlite::{Connection, params};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::Utc;

use crate::models::{CalendarEvent, CalendarEventInput, UpcomingPayment, UpcomingFollowup};

pub fn get_calendar_events(
    conn: &Connection,
    organization_id: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<CalendarEvent>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, organization_id, title, description, start_date, end_date,
                all_day, event_type, debtor_id, data, created_at, updated_at
         FROM calendar_events
         WHERE organization_id = ?1
           AND start_date <= ?3 AND end_date >= ?2
         ORDER BY start_date"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![organization_id, start_date, end_date], |row| {
        let data_json: String = row.get(9)?;
        Ok(CalendarEvent {
            id: row.get(0)?,
            organization_id: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            start_date: row.get(4)?,
            end_date: row.get(5)?,
            all_day: row.get(6)?,
            event_type: row.get(7)?,
            debtor_id: row.get(8)?,
            data: serde_json::from_str(&data_json).unwrap_or(JsonValue::Null),
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row.map_err(|e| e.to_string())?);
    }

    Ok(events)
}

pub fn insert_calendar_event(
    conn: &Connection,
    organization_id: &str,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    if let Some(ref debtor_id) = input.debtor_id {
        let debtor_ok: i64 = conn.query_row(
            "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
            params![debtor_id, organization_id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if debtor_ok == 0 {
            return Err("Debtor not found or not in this organization".to_string());
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let all_day = input.all_day.unwrap_or(false);
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let event_type = "MANUAL".to_string();

    conn.execute(
        "INSERT INTO calendar_events
            (id, organization_id, title, description, start_date, end_date,
             all_day, event_type, debtor_id, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            &id,
            organization_id,
            &input.title,
            &input.description,
            &input.start_date,
            &input.end_date,
            all_day,
            &event_type,
            &input.debtor_id,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(CalendarEvent {
        id,
        organization_id: organization_id.to_string(),
        title: input.title,
        description: input.description,
        start_date: input.start_date,
        end_date: input.end_date,
        all_day,
        event_type,
        debtor_id: input.debtor_id,
        data,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_calendar_event(
    conn: &Connection,
    organization_id: &str,
    id: &str,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    if let Some(ref debtor_id) = input.debtor_id {
        let debtor_ok: i64 = conn.query_row(
            "SELECT COUNT(*) FROM debtors WHERE id = ?1 AND organization_id = ?2",
            params![debtor_id, organization_id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if debtor_ok == 0 {
            return Err("Debtor not found or not in this organization".to_string());
        }
    }

    let now = Utc::now().to_rfc3339();
    let all_day = input.all_day.unwrap_or(false);
    let data = input.data.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let affected = conn.execute(
        "UPDATE calendar_events
         SET title = ?1, description = ?2, start_date = ?3, end_date = ?4,
             all_day = ?5, debtor_id = ?6, data = ?7, updated_at = ?8
         WHERE id = ?9 AND organization_id = ?10",
        params![
            &input.title,
            &input.description,
            &input.start_date,
            &input.end_date,
            all_day,
            &input.debtor_id,
            &serde_json::to_string(&data).unwrap_or("{}".to_string()),
            &now,
            id,
            organization_id,
        ],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Calendar event not found or not in this organization".to_string());
    }

    let (event_type, created_at): (String, String) = conn.query_row(
        "SELECT event_type, created_at FROM calendar_events WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    Ok(CalendarEvent {
        id: id.to_string(),
        organization_id: organization_id.to_string(),
        title: input.title,
        description: input.description,
        start_date: input.start_date,
        end_date: input.end_date,
        all_day,
        event_type,
        debtor_id: input.debtor_id,
        data,
        created_at,
        updated_at: now,
    })
}

pub fn delete_calendar_event(
    conn: &Connection,
    organization_id: &str,
    id: &str,
) -> Result<bool, String> {
    let affected = conn.execute(
        "DELETE FROM calendar_events WHERE id = ?1 AND organization_id = ?2",
        params![id, organization_id],
    ).map_err(|e| e.to_string())?;

    Ok(affected > 0)
}

pub fn get_upcoming_payments(
    conn: &Connection,
    organization_id: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<UpcomingPayment>, String> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.debtor_id, b.name, b.surname, d.amount, d.currency,
                d.status, d.due_date
         FROM debts d
         INNER JOIN debtors b ON b.id = d.debtor_id
         WHERE b.organization_id = ?1
           AND d.due_date >= ?2 AND d.due_date <= ?3
           AND d.status NOT IN ('PAID', 'CANCELLED')
           AND d.due_date IS NOT NULL
         ORDER BY d.due_date"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![organization_id, start_date, end_date], |row| {
        Ok(UpcomingPayment {
            debt_id: row.get(0)?,
            debtor_id: row.get(1)?,
            debtor_name: row.get(2)?,
            debtor_surname: row.get(3)?,
            amount: row.get(4)?,
            currency: row.get(5)?,
            status: row.get(6)?,
            due_date: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for row in rows {
        payments.push(row.map_err(|e| e.to_string())?);
    }

    Ok(payments)
}

pub fn get_upcoming_followups(
    conn: &Connection,
    organization_id: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<UpcomingFollowup>, String> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.debtor_id, b.name, b.surname, a.type, a.status, a.due_date
         FROM actions a
         INNER JOIN debtors b ON b.id = a.debtor_id
         WHERE b.organization_id = ?1
           AND a.due_date >= ?2 AND a.due_date <= ?3
           AND a.status IN ('PENDING', 'IN_PROGRESS')
           AND a.due_date IS NOT NULL
         ORDER BY a.due_date"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![organization_id, start_date, end_date], |row| {
        Ok(UpcomingFollowup {
            action_id: row.get(0)?,
            debtor_id: row.get(1)?,
            debtor_name: row.get(2)?,
            debtor_surname: row.get(3)?,
            r#type: row.get(4)?,
            status: row.get(5)?,
            due_date: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut followups = Vec::new();
    for row in rows {
        followups.push(row.map_err(|e| e.to_string())?);
    }

    Ok(followups)
}