// gorka-shared::sync_engine
//
// The sync engine. Drives the session lifecycle and the tick loop
// that turns local events into wire messages and peer messages
// into local state.
//
// Two levels:
//
//   OUTER LOOP (session lifecycle)
//     connect or listen
//     handshake
//     set stream read timeout (once)
//     INNER SESSION LOOP
//     close session
//     exponential backoff
//     reconnect
//
//   INNER SESSION LOOP (tick)
//     check stop signal
//     send locally-originated events not yet acked by this peer
//     try receive one frame
//     dispatch (SYNC_MESSAGE -> process + ACK, SYNC_ACK -> delivery)
//     update status
//
// The engine owns one SQLCipher connection for its lifetime. The
// connection is opened by the caller (the Tauri command) and moved
// into the engine thread. No Arc<Mutex<Connection>>.
//
// Nothing here is Tauri-specific.

use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use rand::RngCore;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::sync::{build_sync_message, encode_event_record};
use crate::sync_handshake::{
    encode_sync_ack, parse_sync_ack, SyncAck, SyncAckOutcome,
    MSG_SYNC_ACK,
};
use crate::sync_pipeline::process_sync_message;
use crate::sync_session::Session;

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

/// Tick interval. Not a protocol value; a poll cadence.
pub const SYNC_ENGINE_TICK_MS: u64 = 500;

/// Initial backoff after a failed connection attempt.
pub const SYNC_ENGINE_BACKOFF_INITIAL_MS: u64 = 1_000;

/// Maximum backoff after repeated failures.
pub const SYNC_ENGINE_BACKOFF_MAX_MS: u64 = 30_000;

/// Maximum events per outbound SYNC_MESSAGE.
pub const SYNC_ENGINE_MAX_EVENTS_PER_MESSAGE: usize = 100;

/// Message type code for SYNC_MESSAGE (SYNC-ARCHITECTURE.md
/// Section 22.6).
const MSG_SYNC_MESSAGE: u16 = 0x0010;

// ---------------------------------------------------------------
// Status
// ---------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum EngineStatus {
    /// The engine is not running.
    Disabled,
    /// The engine is attempting to establish a session.
    Connecting,
    /// A session is established and there are locally-originated
    /// events not yet acknowledged by the peer.
    Pending,
    /// A session is established and there are no locally-originated
    /// events awaiting delivery.
    Synced,
    /// The engine is alive but has no active session.
    Offline,
    /// The last operation errored. The engine will retry.
    Error(String),
}

// ---------------------------------------------------------------
// Handle
// ---------------------------------------------------------------

pub struct EngineHandle {
    stop: Arc<AtomicBool>,
    status: Arc<Mutex<EngineStatus>>,
    join: Option<JoinHandle<()>>,
}

impl EngineHandle {
    /// Signal the engine to stop and wait for its thread to exit.
    /// Consumes the handle. Safe to call multiple times; only the
    /// first has an effect.
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
    }

    /// Current status. Cheap; just a mutex read.
    pub fn status(&self) -> EngineStatus {
        self.status.lock().map(|g| g.clone()).unwrap_or(EngineStatus::Error(
            "status lock poisoned".to_string(),
        ))
    }
}

impl Drop for EngineHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

// ---------------------------------------------------------------
// Public start functions
// ---------------------------------------------------------------

/// Start the engine in connect mode. Dials the peer at
/// `peer_address` (host:port). Used by the Agent binary.
pub fn start_engine_connect(
    connection: Connection,
    organization_id: String,
    organization_key: [u8; 32],
    device_id: [u8; 16],
    peer_address: String,
) -> EngineHandle {
    let stop = Arc::new(AtomicBool::new(false));
    let status = Arc::new(Mutex::new(EngineStatus::Connecting));

    let stop_t = stop.clone();
    let status_t = status.clone();

    let join = thread::spawn(move || {
        let mode = PeerMode::Connect(peer_address);
        run_engine(
            mode,
            connection,
            organization_id,
            organization_key,
            device_id,
            stop_t,
            status_t,
        );
    });

    EngineHandle { stop, status, join: Some(join) }
}

/// Start the engine in listen mode. Binds `listen_port` and accepts
/// one connection per session. Used by the Client binary.
pub fn start_engine_listen(
    connection: Connection,
    organization_id: String,
    organization_key: [u8; 32],
    device_id: [u8; 16],
    listen_port: u16,
) -> Result<EngineHandle, String> {
    let listener = TcpListener::bind(("0.0.0.0", listen_port))
        .map_err(|e| format!("bind {}: {}", listen_port, e))?;

    let stop = Arc::new(AtomicBool::new(false));
    let status = Arc::new(Mutex::new(EngineStatus::Connecting));

    let stop_t = stop.clone();
    let status_t = status.clone();

    let join = thread::spawn(move || {
        let mode = PeerMode::Listen(listener);
        run_engine(
            mode,
            connection,
            organization_id,
            organization_key,
            device_id,
            stop_t,
            status_t,
        );
    });

    Ok(EngineHandle { stop, status, join: Some(join) })
}

// ---------------------------------------------------------------
// Peer mode
// ---------------------------------------------------------------

enum PeerMode {
    Connect(String),
    Listen(TcpListener),
}

// ---------------------------------------------------------------
// Outer loop
// ---------------------------------------------------------------

fn run_engine(
    mut mode: PeerMode,
    mut connection: Connection,
    organization_id: String,
    organization_key: [u8; 32],
    device_id: [u8; 16],
    stop: Arc<AtomicBool>,
    status: Arc<Mutex<EngineStatus>>,
) {
    let mut backoff_ms = SYNC_ENGINE_BACKOFF_INITIAL_MS;

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        set_status(&status, EngineStatus::Connecting);

        // Establish session.
        let session = match establish_session(
            &mut mode,
            &organization_id,
            &organization_key,
            &device_id,
            &stop,
        ) {
            Ok(Some(s)) => s,
            Ok(None) => break, // stop requested during accept/connect wait
            Err(e) => {
                set_status(&status, EngineStatus::Offline);
                let _ = e;
                if interruptible_sleep(&stop, backoff_ms) {
                    break;
                }
                backoff_ms = (backoff_ms * 2).min(SYNC_ENGINE_BACKOFF_MAX_MS);
                continue;
            }
        };

        // Set the read timeout once, before entering the tick loop.
        if let Err(e) =
            session.set_read_timeout(Some(Duration::from_millis(SYNC_ENGINE_TICK_MS)))
        {
            set_status(&status, EngineStatus::Error(e));
            if interruptible_sleep(&stop, backoff_ms) {
                break;
            }
            backoff_ms = (backoff_ms * 2).min(SYNC_ENGINE_BACKOFF_MAX_MS);
            continue;
        }

        // Successful session. Reset backoff.
        backoff_ms = SYNC_ENGINE_BACKOFF_INITIAL_MS;

        // Inner session loop. Returns Ok on clean stop, Err on
        // session failure that should be retried.
        let session_result = run_session(
            session,
            &mut connection,
            &organization_id,
            &device_id,
            &stop,
            &status,
        );

        match session_result {
            Ok(()) => break, // stop requested
            Err(e) => {
                set_status(&status, EngineStatus::Error(e));
            }
        }

        set_status(&status, EngineStatus::Offline);
        if interruptible_sleep(&stop, backoff_ms) {
            break;
        }
        backoff_ms = (backoff_ms * 2).min(SYNC_ENGINE_BACKOFF_MAX_MS);
    }

    set_status(&status, EngineStatus::Disabled);
}

// ---------------------------------------------------------------
// Session establishment
// ---------------------------------------------------------------

fn establish_session(
    mode: &mut PeerMode,
    organization_id: &str,
    organization_key: &[u8; 32],
    device_id: &[u8; 16],
    stop: &Arc<AtomicBool>,
) -> Result<Option<Session>, String> {
    match mode {
        PeerMode::Connect(address) => {
            let stream = TcpStream::connect(address)
                .map_err(|e| format!("connect {}: {}", address, e))?;
            // Note: connect is blocking. If the engine is stopped
            // while waiting, the connect either completes or fails;
            // either way, the next check of `stop` in run_engine
            // terminates the outer loop.
            let _ = stop;
            let session = Session::connect(
                stream,
                organization_id,
                organization_key,
                device_id,
            )?;
            Ok(Some(session))
        }
        PeerMode::Listen(listener) => {
            // Non-blocking accept, so the loop can check the stop
            // signal between attempts.
            listener
                .set_nonblocking(true)
                .map_err(|e| format!("set_nonblocking: {}", e))?;

            loop {
                if stop.load(Ordering::SeqCst) {
                    return Ok(None);
                }
                match listener.accept() {
                    Ok((stream, _)) => {
                        // Back to blocking for the handshake.
                        stream
                            .set_nonblocking(false)
                            .map_err(|e| format!("set_nonblocking(false): {}", e))?;
                        let session = Session::accept(
                            stream,
                            organization_id,
                            organization_key,
                            device_id,
                        )?;
                        return Ok(Some(session));
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => return Err(format!("accept: {}", e)),
                }
            }
        }
    }
}

// ---------------------------------------------------------------
// Inner session loop
// ---------------------------------------------------------------

fn run_session(
    mut session: Session,
    connection: &mut Connection,
    organization_id: &str,
    local_device_id: &[u8; 16],
    stop: &Arc<AtomicBool>,
    status: &Arc<Mutex<EngineStatus>>,
) -> Result<(), String> {
    let session_key = *session.session_key();
    let peer_device_id = session.peer_device_id().to_vec();

    // Record the peer on first successful session.
    upsert_peer_row(connection, organization_id, &peer_device_id)?;

    loop {
        if stop.load(Ordering::SeqCst) {
            return Ok(());
        }

        // 1. Compose and send undelivered events, if any.
        let undelivered = compute_undelivered(
            connection,
            local_device_id,
            &peer_device_id,
        )?;
        if !undelivered.is_empty() {
            let nonce = random_nonce();
            let message_id = random_event_id();
            let framed = build_sync_message(
                &session_key,
                &nonce,
                &message_id,
                &undelivered,
            )?;
            session.send_frame(&framed)?;
        }

        // 2. Try to receive one frame.
        match session.try_recv_frame()? {
            Some(frame) => {
                handle_incoming(
                    &mut session,
                    connection,
                    organization_id,
                    &session_key,
                    &peer_device_id,
                    &frame,
                )?;
            }
            None => {}
        }

        // 3. Update status. "Pending" means locally-originated
        //    events not yet acknowledged. Received-but-not-applied
        //    events do not make the local engine Pending.
        let remaining = count_undelivered(
            connection,
            local_device_id,
            &peer_device_id,
        )?;
        if remaining == 0 {
            set_status(status, EngineStatus::Synced);
        } else {
            set_status(status, EngineStatus::Pending);
        }
    }
}

// ---------------------------------------------------------------
// Incoming message dispatch
// ---------------------------------------------------------------

fn handle_incoming(
    session: &mut Session,
    connection: &mut Connection,
    organization_id: &str,
    session_key: &[u8; 32],
    peer_device_id: &[u8],
    frame: &[u8],
) -> Result<(), String> {
    if frame.len() < 2 {
        return Err("frame too short for message type".to_string());
    }
    let msg_type = u16::from_be_bytes([frame[0], frame[1]]);
    match msg_type {
        MSG_SYNC_MESSAGE => {
            let result = process_sync_message(
                connection,
                organization_id,
                session_key,
                frame,
            )?;
            let outcomes: Vec<SyncAckOutcome> = result
                .outcomes
                .iter()
                .map(|o| SyncAckOutcome {
                    event_id: o.event_id,
                    outcome: o.outcome,
                })
                .collect();
            let ack = SyncAck {
                acknowledged_message_id: result.message_id,
                outcomes,
            };
            let nonce = random_nonce();
            let framed_ack = encode_sync_ack(session_key, &nonce, &ack)?;
            session.send_frame(&framed_ack)?;
        }
        MSG_SYNC_ACK => {
            let ack = parse_sync_ack(session_key, frame)?;
            apply_ack(connection, peer_device_id, &ack)?;
        }
        other => {
            return Err(format!("unexpected message type 0x{:04x}", other));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------
// Delivery bookkeeping
// ---------------------------------------------------------------

/// Query one batch of events that are not yet known to be delivered
/// to the given peer. Groups by origin, orders within a group by
/// sequence, and returns at most SYNC_ENGINE_MAX_EVENTS_PER_MESSAGE
/// event records ready to be placed into a SYNC_MESSAGE.
fn compute_undelivered(
    connection: &Connection,
    local_device_id: &[u8; 16],
    peer_device_id: &[u8],
) -> Result<Vec<Vec<u8>>, String> {
    // Every distinct origin in sync_events.
    let mut stmt = connection
        .prepare("SELECT DISTINCT device_id FROM sync_events")
        .map_err(|e| e.to_string())?;
    let origins: Vec<Vec<u8>> = stmt
        .query_map([], |row| row.get::<_, Vec<u8>>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut out: Vec<Vec<u8>> = Vec::new();
    for origin in origins {
        if out.len() >= SYNC_ENGINE_MAX_EVENTS_PER_MESSAGE {
            break;
        }
        let watermark = read_watermark(connection, local_device_id, peer_device_id, &origin)?;
        let gap_set = read_gap_set(connection, local_device_id, peer_device_id, &origin)?;

        let mut stmt = connection
            .prepare(
                "SELECT id, device_id, sequence, logical_clock, event_type, entity_type,
                        entity_id, payload, created_at
                 FROM sync_events
                 WHERE device_id = ?1 AND sequence > ?2
                 ORDER BY sequence ASC
                 LIMIT ?3",
            )
            .map_err(|e| e.to_string())?;

        let remaining = SYNC_ENGINE_MAX_EVENTS_PER_MESSAGE - out.len();
        let rows = stmt
            .query_map(
                params![&origin, watermark, remaining as i64],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Vec<u8>>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, Vec<u8>>(7)?,
                        row.get::<_, String>(8)?,
                    ))
                },
            )
            .map_err(|e| e.to_string())?;

        for r in rows {
            let (event_id_str, device_id, sequence, logical_clock, event_type_str,
                 entity_type_str, entity_id_str, payload, created_at_str) =
                r.map_err(|e| e.to_string())?;

            // Skip sequences already in the gap set (delivered).
            if gap_set.contains(&sequence) {
                continue;
            }

            let event_id = uuid_bytes_from_string(&event_id_str)?;
            let event_type = event_type_code(&event_type_str)?;
            let entity_type = entity_type_code(&entity_type_str)?;
            let created_at_ms = rfc3339_to_ms(&created_at_str);

            let record = encode_event_record(
                &event_id,
                &device_id,
                sequence as u64,
                logical_clock as u64,
                event_type,
                entity_type,
                entity_id_str.as_bytes(),
                created_at_ms,
                &payload,
            );
            out.push(record);
            if out.len() >= SYNC_ENGINE_MAX_EVENTS_PER_MESSAGE {
                break;
            }
        }
    }

    Ok(out)
}

fn count_undelivered(
    connection: &Connection,
    local_device_id: &[u8; 16],
    peer_device_id: &[u8],
) -> Result<i64, String> {
    // Total events in sync_events minus those below watermark or in
    // gap set, per origin. Simpler for the MVP: sum the count of
    // events from each origin above the watermark not in the gap set.
    let mut stmt = connection
        .prepare("SELECT DISTINCT device_id FROM sync_events")
        .map_err(|e| e.to_string())?;
    let origins: Vec<Vec<u8>> = stmt
        .query_map([], |row| row.get::<_, Vec<u8>>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut total: i64 = 0;
    for origin in origins {
        let watermark = read_watermark(connection, local_device_id, peer_device_id, &origin)?;
        let gap_set = read_gap_set(connection, local_device_id, peer_device_id, &origin)?;

        let mut stmt = connection
            .prepare(
                "SELECT sequence FROM sync_events
                 WHERE device_id = ?1 AND sequence > ?2",
            )
            .map_err(|e| e.to_string())?;
        let seqs: Vec<i64> = stmt
            .query_map(params![&origin, watermark], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for s in seqs {
            if !gap_set.contains(&s) {
                total += 1;
            }
        }
    }
    Ok(total)
}

fn read_watermark(
    connection: &Connection,
    local_device_id: &[u8; 16],
    peer_device_id: &[u8],
    origin_device_id: &[u8],
) -> Result<i64, String> {
    let v: Option<i64> = connection
        .query_row(
            "SELECT watermark FROM sync_delivery
             WHERE local_device_id = ?1 AND peer_device_id = ?2 AND origin_device_id = ?3",
            params![local_device_id, peer_device_id, origin_device_id],
            |row| row.get(0),
        )
        .ok();
    Ok(v.unwrap_or(0))
}

fn read_gap_set(
    connection: &Connection,
    local_device_id: &[u8; 16],
    peer_device_id: &[u8],
    origin_device_id: &[u8],
) -> Result<std::collections::HashSet<i64>, String> {
    let v: Option<String> = connection
        .query_row(
            "SELECT gap_set FROM sync_delivery
             WHERE local_device_id = ?1 AND peer_device_id = ?2 AND origin_device_id = ?3",
            params![local_device_id, peer_device_id, origin_device_id],
            |row| row.get(0),
        )
        .ok();
    let s = v.unwrap_or_default();
    let mut out = std::collections::HashSet::new();
    if s.is_empty() {
        return Ok(out);
    }
    for part in s.split(',') {
        if let Ok(n) = part.parse::<i64>() {
            out.insert(n);
        }
    }
    Ok(out)
}

/// Apply an incoming SYNC_ACK to the delivery bookkeeping.
///
/// For each outcome, the origin and sequence of the event are
/// looked up from the local sync_events table, and the sequence is
/// added to the gap set for (local, peer, origin). Then the
/// watermark advances over any contiguous prefix.
///
/// ACCEPTED, DUPLICATE, and REJECTED are all terminal for delivery
/// (Section 18.2). REJECTED is not retried.
fn apply_ack(
    connection: &Connection,
    peer_device_id: &[u8],
    ack: &SyncAck,
) -> Result<(), String> {
    let local_device_id = read_local_device_id(connection)?;

    for outcome in &ack.outcomes {
        let event_id_str = Uuid::from_bytes(outcome.event_id).to_string();
        let origin_and_seq: Option<(Vec<u8>, i64)> = connection
            .query_row(
                "SELECT device_id, sequence FROM sync_events WHERE id = ?1",
                params![&event_id_str],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        let (origin, sequence) = match origin_and_seq {
            Some(v) => v,
            None => continue, // unknown event; nothing to do
        };

        // Insert or update the delivery row.
        let _ = outcome; // accepted, duplicate, rejected all count
        add_delivered_sequence(
            connection,
            &local_device_id,
            peer_device_id,
            &origin,
            sequence,
        )?;
    }
    Ok(())
}

fn add_delivered_sequence(
    connection: &Connection,
    local_device_id: &[u8; 16],
    peer_device_id: &[u8],
    origin_device_id: &[u8],
    sequence: i64,
) -> Result<(), String> {
    let mut watermark = read_watermark(connection, local_device_id, peer_device_id, origin_device_id)?;
    let mut gaps = read_gap_set(connection, local_device_id, peer_device_id, origin_device_id)?;

    if sequence <= watermark {
        return Ok(());
    }
    gaps.insert(sequence);

    // Advance the watermark over any contiguous prefix.
    loop {
        let next = watermark + 1;
        if gaps.remove(&next) {
            watermark = next;
        } else {
            break;
        }
    }

    // Serialize gap_set canonically: ascending, comma-separated.
    let mut gap_vec: Vec<i64> = gaps.into_iter().collect();
    gap_vec.sort_unstable();
    let gap_str: String = gap_vec
        .iter()
        .map(|n| n.to_string())
        .collect::<Vec<_>>()
        .join(",");

    connection
        .execute(
            "INSERT INTO sync_delivery
                (local_device_id, peer_device_id, origin_device_id,
                 organization_id, watermark, gap_set, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(local_device_id, peer_device_id, origin_device_id)
             DO UPDATE SET
                watermark = excluded.watermark,
                gap_set = excluded.gap_set,
                updated_at = excluded.updated_at",
            params![
                local_device_id,
                peer_device_id,
                origin_device_id,
                "", // organization_id is informational in sync_delivery
                watermark,
                gap_str,
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------
// Peers table
// ---------------------------------------------------------------

fn upsert_peer_row(
    connection: &Connection,
    organization_id: &str,
    peer_device_id: &[u8],
) -> Result<(), String> {
    let id = Uuid::from_slice(peer_device_id)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| {
            // Fallback: derive a stable id from the raw bytes.
            let mut bytes = [0u8; 16];
            for (i, b) in peer_device_id.iter().take(16).enumerate() {
                bytes[i] = *b;
            }
            Uuid::from_bytes(bytes).to_string()
        });
    let now = chrono::Utc::now().to_rfc3339();
    connection
        .execute(
            "INSERT INTO sync_peers
                (id, organization_id, peer_name, peer_type, role, status,
                 last_seen_at, last_successful_sync, last_endpoint, is_trusted,
                 created_at, updated_at)
             VALUES (?1, ?2, NULL, NULL, NULL, 'IN_SYNC', ?3, ?3, NULL, 1, ?3, ?3)
             ON CONFLICT(id) DO UPDATE SET
                status = 'IN_SYNC',
                last_seen_at = excluded.last_seen_at,
                last_successful_sync = excluded.last_successful_sync,
                updated_at = excluded.updated_at",
            params![&id, organization_id, &now],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

fn read_local_device_id(connection: &Connection) -> Result<[u8; 16], String> {
    let v: Vec<u8> = connection
        .query_row("SELECT device_id FROM sync_state LIMIT 1", [], |row| row.get(0))
        .map_err(|e| format!("read local device_id: {}", e))?;
    if v.len() != 16 {
        return Err("sync_state.device_id is not 16 bytes".to_string());
    }
    let mut out = [0u8; 16];
    out.copy_from_slice(&v);
    Ok(out)
}

fn set_status(status: &Arc<Mutex<EngineStatus>>, s: EngineStatus) {
    if let Ok(mut g) = status.lock() {
        *g = s;
    }
}

/// Sleep, waking early if the stop signal is set. Returns true if
/// the stop signal was observed.
fn interruptible_sleep(stop: &Arc<AtomicBool>, ms: u64) -> bool {
    let step = 100u64;
    let mut elapsed = 0u64;
    while elapsed < ms {
        if stop.load(Ordering::SeqCst) {
            return true;
        }
        let remain = ms - elapsed;
        let sleep_for = remain.min(step);
        thread::sleep(Duration::from_millis(sleep_for));
        elapsed += sleep_for;
    }
    stop.load(Ordering::SeqCst)
}

fn random_nonce() -> [u8; 24] {
    let mut out = [0u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut out);
    out
}

fn random_event_id() -> [u8; 16] {
    let u = Uuid::now_v7();
    *u.as_bytes()
}

fn uuid_bytes_from_string(s: &str) -> Result<[u8; 16], String> {
    let u = Uuid::parse_str(s).map_err(|e| format!("uuid parse {}: {}", s, e))?;
    Ok(*u.as_bytes())
}

fn event_type_code(s: &str) -> Result<u16, String> {
    match s {
        "DEBTOR_CREATED" => Ok(0x0001),
        "ENTITY_UPDATED" => Ok(0x0002),
        "ACTION_CREATED" => Ok(0x0003),
        "COMMUNICATION_LOGGED" => Ok(0x0004),
        _ => Err(format!("unknown event_type {}", s)),
    }
}

fn entity_type_code(s: &str) -> Result<u8, String> {
    match s {
        "debtor" => Ok(0x01),
        "action" => Ok(0x03),
        "communication" => Ok(0x04),
        _ => Err(format!("unknown entity_type {}", s)),
    }
}

fn rfc3339_to_ms(s: &str) -> u64 {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.timestamp_millis() as u64)
        .unwrap_or(0)
}