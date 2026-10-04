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
//     handshake (transport switches itself into tick mode)
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
use std::time::Duration;

use rand::RngCore;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::sync::{build_sync_message, encode_event_record};
use crate::sync_handshake::{
    encode_sync_ack, parse_sync_ack, SyncAck, SyncAckOutcome,
    MSG_SYNC_ACK,
};
use crate::sync_pipeline::process_sync_message;
use crate::sync_discovery;
use crate::sync_session::Session;
use crate::sync_transport::TcpTransport;

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

/// Heartbeat interval to the Control Plane, milliseconds.
pub const SYNC_ENGINE_HEARTBEAT_MS: u64 = 15_000;

/// Discovery poll interval when no peer is currently available,
/// milliseconds.
pub const SYNC_ENGINE_DISCOVERY_POLL_MS: u64 = 2_000;

/// TEMPORARY: Batch 7 acceptance test hooks.
/// Both are reset after one use. Removed in the revert commit.
pub static TEST_CORRUPT_NEXT_FRAME: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);
pub static TEST_REVERSE_NEXT_BATCH: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

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
// Config
// ---------------------------------------------------------------

/// Configuration for the connecting peer (Agent).
pub struct DiscoveryConfig {
    /// User's JWT, from settings.dat.
    pub jwt: String,
    /// This device's wire device_id, 16 bytes.
    pub local_wire_device_id: [u8; 16],
    /// This device's wire device_id as a hex string, for the
    /// relay's WebSocket open frame.
    pub local_wire_device_id_hex: String,
    /// Control Plane base URL, e.g. "http://localhost:3000".
    /// Used to derive the relay WebSocket URL.
    pub backend_base_url: String,
    /// Development/test override. If Some, the engine dials this
    /// address directly and skips discovery. Not the normal MVP
    /// path.
    pub manual_override: Option<String>,
}

/// Configuration for the listening peer (Client).
pub struct ListenerConfig {
    /// User's JWT, from settings.dat.
    pub jwt: String,
    /// The port the listener binds to.
    pub listen_port: u16,
    /// The address the listener advertises to the Control Plane.
    pub listen_address: String,
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
    discovery: DiscoveryConfig,
) -> EngineHandle {
    let stop = Arc::new(AtomicBool::new(false));
    let status = Arc::new(Mutex::new(EngineStatus::Connecting));

    let stop_t = stop.clone();
    let status_t = status.clone();

    let join = thread::spawn(move || {
        let mode = PeerMode::Connect(discovery);
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
    config: ListenerConfig,
) -> Result<EngineHandle, String> {
    let listener = TcpListener::bind(("0.0.0.0", config.listen_port))
        .map_err(|e| format!("bind {}: {}", config.listen_port, e))?;

    // Register the endpoint with the Control Plane before spawning
    // the thread. Registration failure is non-fatal in the MVP:
    // the engine still listens, and a peer using a manual override
    // can still connect. The error is logged.
    if let Err(e) = sync_discovery::register_endpoint(
        &config.jwt,
        &device_id,
        &config.listen_address,
    ) {
        eprintln!("register_endpoint failed (continuing anyway): {}", e);
    }

    let stop = Arc::new(AtomicBool::new(false));
    let status = Arc::new(Mutex::new(EngineStatus::Connecting));

    let stop_t = stop.clone();
    let status_t = status.clone();

    let listen_address = config.listen_address.clone();
    let jwt = config.jwt.clone();
    let backend_base_url =
        sync_discovery::CONTROL_PLANE_BASE_URL.to_string();
    let local_wire_device_id_hex = hex_encode(&device_id);

    let join = thread::spawn(move || {
        let mode = PeerMode::Listen {
            listener,
            jwt,
            listen_address,
            backend_base_url,
            local_wire_device_id_hex,
        };
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
    Connect(DiscoveryConfig),
    Listen {
        listener: TcpListener,
        jwt: String,
        listen_address: String,
        backend_base_url: String,
        local_wire_device_id_hex: String,
    },
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
                if e == "NO_PEER_DISCOVERED" || e.starts_with("DISCOVERY_FAILED") {
                    // No peer yet, or the Control Plane is
                    // unreachable. Stay in Connecting and poll
                    // discovery again soon (Q5 decision).
                    set_status(&status, EngineStatus::Connecting);
                    if interruptible_sleep(&stop, SYNC_ENGINE_DISCOVERY_POLL_MS) {
                        break;
                    }
                    continue;
                }
                set_status(&status, EngineStatus::Offline);
                let _ = e;
                if interruptible_sleep(&stop, backoff_ms) {
                    break;
                }
                backoff_ms = (backoff_ms * 2).min(SYNC_ENGINE_BACKOFF_MAX_MS);
                continue;
            }
        };

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

/// Open a direct TCP session with a bounded connect timeout.
/// Used as the first attempt before falling back to the relay.
fn try_tcp_session(
    address: &str,
    organization_id: &str,
    organization_key: &[u8; 32],
    device_id: &[u8; 16],
) -> Result<Session, String> {
    // A 5-second connect timeout gives deterministic fallback
    // without introducing parallel races.
    use std::net::ToSocketAddrs;
    let mut addrs = address
        .to_socket_addrs()
        .map_err(|e| format!("resolve {}: {}", address, e))?;
    let addr = addrs
        .next()
        .ok_or_else(|| format!("no addresses for {}", address))?;

    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("connect {}: {}", address, e))?;
    let transport = TcpTransport::new(stream);
    Session::connect(
        transport,
        organization_id,
        organization_key,
        device_id,
        Duration::from_millis(SYNC_ENGINE_TICK_MS),
    )
}

fn establish_session(
    mode: &mut PeerMode,
    organization_id: &str,
    organization_key: &[u8; 32],
    device_id: &[u8; 16],
    stop: &Arc<AtomicBool>,
) -> Result<Option<Session>, String> {
    match mode {
        PeerMode::Connect(config) => {
            // Determine the peer address.
            let address: String = match &config.manual_override {
                Some(a) => a.clone(),
                None => {
                    match sync_discovery::discover_peer(
                        &config.jwt,
                        &config.local_wire_device_id,
                    ) {
                        Ok(Some(p)) => p.listen_address,
                        Ok(None) => {
                            return Err("NO_PEER_DISCOVERED".to_string());
                        }
                        Err(e) => {
                            return Err(format!("DISCOVERY_FAILED: {}", e));
                        }
                    }
                }
            };

            if stop.load(Ordering::SeqCst) {
                return Ok(None);
            }

            // Try direct TCP first, with a short connect timeout.
            // If the TCP path fails, fall back to the WebSocket
            // relay. TCP first, relay second. No parallel race.
            let tcp_result = try_tcp_session(
                &address,
                organization_id,
                organization_key,
                device_id,
            );

            match tcp_result {
                Ok(session) => return Ok(Some(session)),
                Err(tcp_err) => {
                    // Fall back to the relay. The peer must have
                    // been discovered through the Control Plane, so
                    // we know its wire device_id.
                    let target_wire_device_id_hex = match &config.manual_override {
                        Some(_) => {
                            // Manual override skips discovery. The
                            // relay needs a target id we do not have.
                            return Err(format!(
                                "TCP connect failed and manual override path cannot fall back to relay: {}",
                                tcp_err
                            ));
                        }
                        None => {
                            match sync_discovery::discover_peer(
                                &config.jwt,
                                &config.local_wire_device_id,
                            ) {
                                Ok(Some(p)) => p.wire_device_id_hex,
                                Ok(None) => {
                                    return Err(format!(
                                        "TCP failed, and no peer discoverable for relay: {}",
                                        tcp_err
                                    ));
                                }
                                Err(e) => {
                                    return Err(format!(
                                        "TCP failed, and discovery failed for relay: {}: {}",
                                        tcp_err, e
                                    ));
                                }
                            }
                        }
                    };

                    let relay_transport = crate::sync_relay::RelayTransport::connect(
                        &config.backend_base_url,
                        &config.jwt,
                        &config.local_wire_device_id_hex,
                        &target_wire_device_id_hex,
                    )?;

                    let session = Session::connect(
                        relay_transport,
                        organization_id,
                        organization_key,
                        device_id,
                        Duration::from_millis(SYNC_ENGINE_TICK_MS),
                    )?;
                    Ok(Some(session))
                }
            }
        }

        PeerMode::Listen {
            listener,
            jwt,
            listen_address,
            backend_base_url,
            local_wire_device_id_hex,
        } => {
            // Non-blocking accept, so the loop can check the stop
            // signal between attempts.
            listener
                .set_nonblocking(true)
                .map_err(|e| format!("set_nonblocking: {}", e))?;

            // Relay presence. The waiter is best-effort: if the
            // relay is unreachable, TCP-only still works. Retry
            // ownership lives here, not inside the waiter. The
            // waiter never reopens itself.
            let mut relay_waiter: Option<crate::sync_relay::RelayPairingWaiter> =
                crate::sync_relay::RelayPairingWaiter::open(
                    backend_base_url,
                    jwt,
                    local_wire_device_id_hex,
                )
                .ok();
            let mut last_relay_open = std::time::Instant::now();
            const RELAY_REOPEN_INTERVAL: Duration = Duration::from_secs(2);

            let mut last_heartbeat = std::time::Instant::now();
            let heartbeat_interval =
                Duration::from_millis(SYNC_ENGINE_HEARTBEAT_MS);

            loop {
                if stop.load(Ordering::SeqCst) {
                    return Ok(None);
                }
                // Heartbeat keeps the registry entry fresh while we
                // wait for a peer.
                if last_heartbeat.elapsed() >= heartbeat_interval {
                    if let Err(e) = sync_discovery::heartbeat(
                        jwt,
                        device_id,
                        listen_address,
                    ) {
                        eprintln!("heartbeat failed (continuing): {}", e);
                    }
                    last_heartbeat = std::time::Instant::now();
                }

                // TCP first.
                match listener.accept() {
                    Ok((stream, _)) => {
                        // Back to blocking for the handshake.
                        stream
                            .set_nonblocking(false)
                            .map_err(|e| format!("set_nonblocking(false): {}", e))?;
                        let transport = TcpTransport::new(stream);
                        let session = Session::accept(
                            transport,
                            organization_id,
                            organization_key,
                            device_id,
                            Duration::from_millis(SYNC_ENGINE_TICK_MS),
                        )?;
                        return Ok(Some(session));
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(e) => return Err(format!("accept: {}", e)),
                }

                // Relay second.
                if let Some(waiter) = relay_waiter.as_mut() {
                    match waiter.try_accept_pairing() {
                        Ok(Some(transport)) => {
                            let session = Session::accept(
                                transport,
                                organization_id,
                                organization_key,
                                device_id,
                                Duration::from_millis(SYNC_ENGINE_TICK_MS),
                            )?;
                            return Ok(Some(session));
                        }
                        Ok(None) => {}
                        Err(e) => {
                            eprintln!("relay pairing failed: {}", e);
                            relay_waiter = None;
                            last_relay_open = std::time::Instant::now();
                        }
                    }
                }

                // Reopen the relay waiter only if it is dead and
                // enough time has passed. The 2-second throttle
                // prevents hammering a down relay at 10 Hz.
                if relay_waiter.is_none()
                    && last_relay_open.elapsed() >= RELAY_REOPEN_INTERVAL
                {
                    relay_waiter = crate::sync_relay::RelayPairingWaiter::open(
                        backend_base_url,
                        jwt,
                        local_wire_device_id_hex,
                    )
                    .ok();
                    last_relay_open = std::time::Instant::now();
                }

                thread::sleep(Duration::from_millis(100));
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
        let mut undelivered = compute_undelivered(
            connection,
            local_device_id,
            &peer_device_id,
        )?;
        // TEMPORARY: Batch 7 acceptance test hook.
        if TEST_REVERSE_NEXT_BATCH.swap(
            false,
            std::sync::atomic::Ordering::SeqCst,
        ) {
            undelivered.reverse();
        }
        if !undelivered.is_empty() {
            let nonce = random_nonce();
            let message_id = random_event_id();
            let mut framed = build_sync_message(
                &session_key,
                &nonce,
                &message_id,
                &undelivered,
            )?;
            // TEMPORARY: Batch 7 acceptance test hook.
            if TEST_CORRUPT_NEXT_FRAME.swap(
                false,
                std::sync::atomic::Ordering::SeqCst,
            ) {
                if let Some(b) = framed.last_mut() {
                    *b ^= 0xFF;
                }
            }
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

/// Lowercase hex encoding of a byte slice. Used to derive the
/// wire device id hex string for the relay's open frame.
fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
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