// gorka-recover
//
// First-party recovery utility for the case where migration v10
// fails on a real device. See CONNECTOR-EVENT-ORDER-SPEC v1.0 §8.
//
// Usage:
//   gorka-recover inspect <db_path>
//   gorka-recover repair --dry-run <db_path>
//   gorka-recover repair --apply <db_path>
//
// With an explicit settings.dat (derives the SQLCipher key from the
// local password, the same way the app does):
//   gorka-recover --password <settings.dat> inspect <db_path>
//   gorka-recover --password <settings.dat> repair --dry-run <db_path>
//   gorka-recover --password <settings.dat> repair --apply <db_path>
//
// Without --password, the utility expects the derived hex key on
// stdin (see §9.2). With --password, the local password is read from
// stdin and the salt from the settings file.
//
// The utility never prints the key, the credential_value, or the
// configuration.

use std::env;
use std::io::{self, Read};
use std::process::ExitCode;

use rusqlite::Connection;

use gorka_shared::recover::{inspect, repair_apply, repair_dry_run, InspectLine};

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();

    let mut password_mode: Option<String> = None;
    let mut positional: Vec<&str> = Vec::new();
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--password" {
            if i + 1 >= args.len() {
                eprintln!("--password requires a path to settings.dat");
                return ExitCode::from(2);
            }
            password_mode = Some(args[i + 1].clone());
            i += 2;
        } else {
            positional.push(&args[i]);
            i += 1;
        }
    }

    if positional.len() < 2 {
        eprintln!("usage: gorka-recover [--password <settings.dat>] <inspect|repair> [--dry-run|--apply] <db_path>");
        return ExitCode::from(2);
    }

    let mode = positional[0];
    let (sub_mode, db_path) = if mode == "repair" {
        if positional.len() < 3 {
            eprintln!("usage: gorka-recover repair [--dry-run|--apply] <db_path>");
            return ExitCode::from(2);
        }
        (positional[1], positional[2])
    } else {
        ("", positional[1])
    };

    let conn = match &password_mode {
        Some(settings_path) => match open_with_password(db_path, settings_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("failed to open database: {}", e);
                return ExitCode::FAILURE;
            }
        },
        None => {
            eprintln!("SQLCipher key (hex):");
            let mut key = String::new();
            if io::stdin().read_line(&mut key).is_err() {
                eprintln!("failed to read key from stdin");
                return ExitCode::FAILURE;
            }
            let key = key.trim();
            if key.is_empty() {
                eprintln!("empty key");
                return ExitCode::FAILURE;
            }
            match open_with_key(db_path, key) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("failed to open database: {}", e);
                    return ExitCode::FAILURE;
                }
            }
        }
    };

    match (mode, sub_mode) {
        ("inspect", _) => run_inspect(&conn),
        ("repair", "--dry-run") => run_repair_dry_run(&conn),
        ("repair", "--apply") => run_repair_apply(conn),
        _ => {
            eprintln!("unknown mode: {} {}", mode, sub_mode);
            ExitCode::from(2)
        }
    }
}

fn open_with_key(path: &str, key: &str) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    let escaped = key.replace('\'', "''");
    conn.query_row(&format!("PRAGMA key = '{}'", escaped), [], |row| {
        row.get::<_, String>(0)
    })
    .map_err(|e| format!("PRAGMA key failed: {}", e))?;
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(|e| format!("db open failed: {}", e))?;
    Ok(conn)
}

/// Derive the SQLCipher key from the local password and the salt in
/// settings.dat, exactly as the application does at unlock time.
fn open_with_password(db_path: &str, settings_path: &str) -> Result<Connection, String> {
    let content = std::fs::read_to_string(settings_path)
        .map_err(|e| format!("cannot read settings: {}", e))?;
    let v: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("settings.dat is not valid JSON: {}", e))?;
    let salt_hex = v
        .get("salt")
        .and_then(|s| s.as_str())
        .ok_or("settings.dat has no salt")?;
    let salt = hex::decode(salt_hex).map_err(|e| format!("salt hex decode failed: {}", e))?;

    eprintln!("Local password:");
    let mut password = String::new();
    if io::stdin().read_line(&mut password).is_err() {
        return Err("failed to read password from stdin".to_string());
    }
    let password = password.trim_end_matches(['\r', '\n']);

    let key = gorka_shared::db::derive_key(password, &salt)
        .map_err(|e| format!("derive key failed: {}", e))?;

    open_with_key(db_path, &key)
}

fn read_org_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT organization_id FROM local_connectors")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut v = Vec::new();
    for r in iter {
        v.push(r.map_err(|e| e.to_string())?);
    }
    Ok(v)
}

fn run_inspect(conn: &Connection) -> ExitCode {
    let orgs = match read_org_ids(conn) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("failed to read org ids: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let mut any = false;
    for org in &orgs {
        match inspect(conn, org) {
            Ok(lines) => {
                for line in &lines {
                    any = true;
                    print_line(line);
                }
            }
            Err(e) => {
                eprintln!("inspect failed for org {}: {}", org, e);
                return ExitCode::FAILURE;
            }
        }
    }

    if !any {
        println!("no local_connectors rows found");
    }
    ExitCode::SUCCESS
}

fn run_repair_dry_run(conn: &Connection) -> ExitCode {
    let orgs = match read_org_ids(conn) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("failed to read org ids: {}", e);
            return ExitCode::FAILURE;
        }
    };

    for org in &orgs {
        match repair_dry_run(conn, org) {
            Ok(report) => {
                println!(
                    "org {}: {} rows, {} consistent, {} actions",
                    report.organization_id,
                    report.total_rows,
                    report.consistent,
                    report.actions.len()
                );
                for (code, action) in &report.actions {
                    println!("  {} -> {:?}", code, action);
                }
            }
            Err(e) => {
                eprintln!("dry-run failed for org {}: {}", org, e);
                return ExitCode::FAILURE;
            }
        }
    }
    ExitCode::SUCCESS
}

fn run_repair_apply(mut conn: Connection) -> ExitCode {
    let orgs = match read_org_ids(&conn) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("failed to read org ids: {}", e);
            return ExitCode::FAILURE;
        }
    };

    for org in &orgs {
        match repair_apply(&mut conn, org) {
            Ok(n) => println!("org {}: {} repairs applied", org, n),
            Err(e) => {
                eprintln!("apply failed for org {}: {}", org, e);
                return ExitCode::FAILURE;
            }
        }
    }
    ExitCode::SUCCESS
}

fn print_line(line: &InspectLine) {
    let r = &line.row;
    println!("row {}", r.id);
    println!(
        "  code={} org={} tier={} status={}",
        r.connector_code, r.organization_id, r.tier, r.status
    );
    println!(
        "  winning=({}, {}, {})",
        r.winning_logical_clock, r.winning_device_id_hex, r.winning_sequence
    );
    match &line.latest_event {
        None => println!("  latest_event: NONE"),
        Some(ev) => println!(
            "  latest_event: {} clock={} seq={} dev={}",
            ev.event_type, ev.logical_clock, ev.sequence, ev.device_id_hex
        ),
    }
    println!("  status_consistent: {}", line.status_consistent);
    println!("  tuple_matches_latest: {}", line.tuple_matches_latest);
}