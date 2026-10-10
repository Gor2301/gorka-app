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
// The SQLCipher key is read from stdin (see §9.2). The utility
// never prints the key, the credential_value, or the
// configuration.

use std::env;
use std::io::{self, Read};
use std::process::ExitCode;

use rusqlite::Connection;

use gorka_shared::recover::{inspect, repair_apply, repair_dry_run, InspectLine};

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();

    if args.len() < 3 {
        eprintln!("usage: gorka-recover <inspect|repair> [--dry-run|--apply] <db_path>");
        return ExitCode::from(2);
    }

    let mode = args[1].as_str();
    let (sub_mode, db_path) = if mode == "repair" {
        if args.len() < 4 {
            eprintln!("usage: gorka-recover repair [--dry-run|--apply] <db_path>");
            return ExitCode::from(2);
        }
        (args[2].as_str(), args[3].as_str())
    } else {
        ("", args[2].as_str())
    };

    // Read key from stdin. Single line, trailing whitespace trimmed.
    eprintln!("SQLCipher key (hex):");
    let mut key = String::new();
    if io::stdin().read_to_string(&mut key).is_err() {
        eprintln!("failed to read key from stdin");
        return ExitCode::FAILURE;
    }
    let key = key.trim();
    if key.is_empty() {
        eprintln!("empty key");
        return ExitCode::FAILURE;
    }

    let conn = match open_with_key(db_path, key) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("failed to open database: {}", e);
            return ExitCode::FAILURE;
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
    // Force SQLCipher to actually open the DB (lazy until first read).
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(|e| format!("db open failed: {}", e))?;
    Ok(conn)
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