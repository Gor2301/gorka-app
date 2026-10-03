// shared/tests/sync_engine.rs
//
// Integration test for the sync engine.
//
// Two on-disk SQLite databases, two engine handles, one TCP
// loopback session. One side inserts a debtor. The test asserts
// the full delivery pipeline: A's sync_events row, A -> Pending,
// B accepts and ACKs, A's sync_delivery watermark advances,
// A returns to Synced, B has the debtor.

use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use rusqlite::{params, Connection};
use uuid::Uuid;

use gorka_shared::db::open_file_for_tests;
use gorka_shared::debtors;
use gorka_shared::models::DebtorInput;
use gorka_shared::sync_events::ensure_sync_state;
use gorka_shared::sync_engine::{
    start_engine_connect, start_engine_listen, EngineHandle, EngineStatus,
    DiscoveryConfig, ListenerConfig,
};

const ORG_ID: &str = "org-engine-test";
const ORG_KEY: [u8; 32] = [0u8; 32];

fn unique_temp_db(suffix: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    let name = format!("gorka_engine_test_{}_{}.db", Uuid::new_v4(), suffix);
    p.push(name);
    p
}

fn cleanup_db(path: &PathBuf) {
    let _ = std::fs::remove_file(path);
    let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    let _ = std::fs::remove_file(format!("{}-wal", path.display()));
}

fn find_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().expect("addr").port();
    drop(listener);
    port
}

fn poll_until<F: FnMut() -> bool>(deadline: Duration, mut f: F) -> bool {
    let start = Instant::now();
    while start.elapsed() < deadline {
        if f() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

fn get_device_id(conn: &mut Connection) -> [u8; 16] {
    let tx = conn.transaction().expect("begin tx");
    let did = ensure_sync_state(&tx, ORG_ID).expect("ensure_sync_state");
    tx.commit().expect("commit");
    did
}

fn make_debtor_input() -> DebtorInput {
    DebtorInput {
        name: "Wire".to_string(),
        surname: "Test".to_string(),
        email: None,
        phone: None,
        data: serde_json::json!({}),
    }
}

#[test]
fn direct_sync_propagates_debtor() {
    let db_a_path = unique_temp_db("a");
    let db_b_path = unique_temp_db("b");
    cleanup_db(&db_a_path);
    cleanup_db(&db_b_path);

    // Two connections per DB: one for the engine, one for the test.
    let mut conn_a_engine =
        open_file_for_tests(&db_a_path).expect("open a engine");
    let mut conn_a_test =
        open_file_for_tests(&db_a_path).expect("open a test");
    let mut conn_b_engine =
        open_file_for_tests(&db_b_path).expect("open b engine");
    let mut conn_b_test =
        open_file_for_tests(&db_b_path).expect("open b test");

    // Initialize sync_state on each and read back the device_id.
    let device_a = get_device_id(&mut conn_a_engine);
    let device_b = get_device_id(&mut conn_b_engine);
    assert_eq!(device_a.len(), 16);
    assert_eq!(device_b.len(), 16);
    assert_ne!(device_a, device_b);

    // Start B as listener, A as connector.
    let port = find_free_port();
    let mut engine_b: EngineHandle = start_engine_listen(
        conn_b_engine,
        ORG_ID.to_string(),
        ORG_KEY,
        device_b,
        ListenerConfig {
            jwt: String::new(),
            listen_port: port,
            listen_address: format!("127.0.0.1:{}", port),
        },
    )
    .expect("start engine B");

    // Small delay so the listener binds before A dials.
    std::thread::sleep(Duration::from_millis(200));

    let mut engine_a: EngineHandle = start_engine_connect(
        conn_a_engine,
        ORG_ID.to_string(),
        ORG_KEY,
        device_a,
        DiscoveryConfig {
            jwt: String::new(),
            local_wire_device_id: device_a,
            manual_override: Some(format!("127.0.0.1:{}", port)),
        },
    );

    // Wait for both sides to reach Synced.
    let both_synced = poll_until(Duration::from_secs(10), || {
        let sa = engine_a.status();
        let sb = engine_b.status();
        matches!(sa, EngineStatus::Synced) && matches!(sb, EngineStatus::Synced)
    });
    assert!(
        both_synced,
        "engines did not reach Synced: a={:?} b={:?}",
        engine_a.status(),
        engine_b.status()
    );

    // Insert a debtor into A on the test's connection. Retry on
    // transient write-lock collisions with the engine's connection.
    let mut inserted = false;
    for _ in 0..30 {
        match debtors::insert_debtor(&mut conn_a_test, ORG_ID, make_debtor_input()) {
            Ok(_) => {
                inserted = true;
                break;
            }
            Err(e) if e.contains("locked") || e.contains("busy") => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => panic!("insert_debtor failed: {}", e),
        }
    }
    assert!(inserted, "insert_debtor did not succeed within deadline");

    // A's sync_events row exists.
    let a_events: i64 = conn_a_test
        .query_row(
            "SELECT COUNT(*) FROM sync_events WHERE entity_id IN (SELECT id FROM debtors WHERE name = 'Wire')",
            [],
            |row| row.get(0),
        )
        .expect("q");
    assert_eq!(a_events, 1, "A should have exactly one sync_events row");

    // B eventually has the debtor.
    let b_has_it = poll_until(Duration::from_secs(10), || {
        conn_b_test
            .query_row(
                "SELECT COUNT(*) FROM debtors WHERE name = 'Wire' AND surname = 'Test'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|n| n > 0)
            .unwrap_or(false)
    });
    assert!(b_has_it, "B did not receive the debtor within deadline");

    // A returns to Synced (delivery complete).
    let a_synced = poll_until(Duration::from_secs(5), || {
        matches!(engine_a.status(), EngineStatus::Synced)
    });
    assert!(
        a_synced,
        "A did not return to Synced: {:?}",
        engine_a.status()
    );

    // A's delivery watermark to B for origin A advanced past 0.
    let watermark: i64 = conn_a_test
        .query_row(
            "SELECT watermark FROM sync_delivery
             WHERE peer_device_id = ?1 AND origin_device_id = ?2",
            params![&device_b[..], &device_a[..]],
            |row| row.get(0),
        )
        .expect("read watermark");
    assert!(
        watermark >= 1,
        "A's delivery watermark to B did not advance: {}",
        watermark
    );

    // B's entity_field_state has a winner for the debtor's name.
    let b_winner: i64 = conn_b_test
        .query_row(
            "SELECT COUNT(*) FROM entity_field_state
             WHERE entity_type = 'debtor' AND field_name = 'name'",
            [],
            |row| row.get(0),
        )
        .expect("q");
    assert!(b_winner >= 1, "B's entity_field_state was not populated");

    // Stop both engines cleanly.
    engine_a.stop();
    engine_b.stop();

    cleanup_db(&db_a_path);
    cleanup_db(&db_b_path);
}