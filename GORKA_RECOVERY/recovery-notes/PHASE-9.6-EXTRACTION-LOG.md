\# PHASE 9.6 - EXTRACTION LOG



Version: 1.0

Date: October 3, 2026

Purpose: Auditable record of each Phase 9.6 implementation batch.

Authority: Subordinate to SYNC-ARCHITECTURE.md v1.4 and

ARCHITECTURAL-LAW.md v1.3.



================================================================

SEQUENCE

================================================================



&#x20; Batch 1   Category D migrations v8           DONE (7b4b35c)

&#x20; Batch 2   Transactions + event origination   DONE (6c0a8c4, 8d12eec)

&#x20; Batch 3   entity\_field\_state at origination  DONE (cbac09c, bd2f751)

&#x20; Batch 4a  Wire-format parsers                DONE (0d1e2bc, 800791a)

&#x20; Batch 4b  Receiving pipeline                 DONE (b76c15f)

&#x20; Batch 5   Transport and session              DONE (ecdb34f, ca49dd2)

&#x20; Batch 6a  Sync engine, direct TCP            DONE (21157b8, f46cbcd)

&#x20; Batch 6b-1 Control Plane discovery           DONE (900bfbd, 55976d4,

&#x20;                                                    e963c4d, 0fc95ee)

  Batch 6b-2a Backend relay service            DONE (9b526a5)
  Batch 6b-2b Client relay fallback            NOT STARTED

&#x20; Batch 7   End-to-end acceptance              NOT STARTED



Batching decision: seven original batches, with 4 and 6 each split

into two halves. Founder-approved. One commit per slice, one cloud

trip per slice.



================================================================

BATCH 1 - CATEGORY D MIGRATIONS V8

================================================================



Commit: 7b4b35c

Files: shared/src/db.rs (180 insertions)



What was added:

&#x20; Migration v8. Seven Category D tables:



&#x20;   sync\_events          the append-only event log. Columns:

&#x20;                        id TEXT PRIMARY KEY, organization\_id,

&#x20;                        device\_id BLOB(16), event\_type,

&#x20;                        entity\_type, entity\_id, payload BLOB,

&#x20;                        sequence INTEGER, logical\_clock INTEGER,

&#x20;                        created\_at, local\_received\_at.

&#x20;                        UNIQUE (device\_id, sequence).

&#x20;   sync\_state           one row per local device.

&#x20;   sync\_delivery        per (local\_device, peer, origin)

&#x20;                        bookkeeping. Composite primary key.

&#x20;   sync\_peers           local cache of known peers.

&#x20;   history\_records      reconciliation losing values.

&#x20;   pending\_events       deferred-application work queue.

&#x20;   entity\_field\_state   current winner per field.



&#x20; Three soft-delete columns:

&#x20;   debtors.deleted         TEXT NOT NULL DEFAULT 'false'

&#x20;   actions.deleted         TEXT NOT NULL DEFAULT 'false'

&#x20;   communications.deleted  TEXT NOT NULL DEFAULT 'false'



Decision recorded in this batch:

&#x20; device\_id stored as BLOB(16), the raw wire form

&#x20; (SYNC-ARCHITECTURE.md Section 25.6.6). No text encoding.



Verification (cloud, 2026-10-03):

&#x20; gorka-agent build       PASS, 2 warnings

&#x20; gorka-client build      PASS, 3 warnings

&#x20; shared tests            14/14 PASS

&#x20; Client launch           PASS. Migration ran. Dashboard reached.

&#x20;                         Existing data intact.



Deviations: None.



================================================================

BATCH 2 - TRANSACTIONS AND EVENT ORIGINATION

================================================================



Commits: 6c0a8c4 (main), 8d12eec (fix)

Files:

&#x20; shared/Cargo.toml                  uuid v7 feature

&#x20; shared/src/lib.rs                  pub mod sync\_events

&#x20; shared/src/sync\_events.rs          NEW

&#x20; shared/src/sync.rs                 encoder widening

&#x20; shared/src/debtors.rs              full rewrite

&#x20; shared/src/debts.rs                full rewrite

&#x20; shared/src/actions.rs              full rewrite

&#x20; shared/src/communications.rs       full rewrite

&#x20; shared/tests/sync.rs               V4 call site

&#x20; src-tauri/src/main.rs              adapters

&#x20; src-tauri-agent/src/main.rs        adapters



What was added:

&#x20; sync\_events module with ensure\_sync\_state and originate\_event.

&#x20; Every mutating function opens a transaction, applies the change,

&#x20; calls originate\_event, writes the audit row, commits. Five

&#x20; signatures changed from \&Connection to \&mut Connection.



&#x20; Soft delete: delete\_debtor, delete\_action, delete\_communication

&#x20; now set deleted = 'true' instead of DELETE FROM. Read queries

&#x20; filter deleted rows.



&#x20; Debt-in-data\_json Rule 2 (Section 25.9.2a): insert\_debt,

&#x20; update\_debt, delete\_debt rebuild the parent debtor's

&#x20; data\_json.debts array inside their transaction and originate an

&#x20; ENTITY\_UPDATED event for the parent debtor. Private helper

&#x20; refresh\_debtor\_debt\_json.



&#x20; encode\_entity\_updated\_payload now takes

&#x20; \&\[(\&str, Option<\&str>)]. None is null, Some("") is empty string.



&#x20; encode\_action\_created\_payload added (private in actions.rs at

&#x20; first, moved to sync.rs in Batch 4a).



Fix during the batch:

&#x20; 8d12eec. encode\_communication\_logged\_payload expects \&str;

&#x20; input.content is Option<String>. None encodes as empty string.



Verification (cloud, 2026-10-03):

&#x20; Both binaries build. 14/14 tests pass.

&#x20; Client launched, debtor inserted, list refreshed. That

&#x20; requires the whole transaction committed, including the

&#x20; sync\_events row.



Deviations:

&#x20; Dev-1. unlock\_database debug println!s had emoji; converted to

&#x20; ASCII in one pass, then restored after founder request. No

&#x20; logic change.

&#x20; Dev-2. enable\_sync db\_guard changed from as\_ref to as\_mut

&#x20; during the adapter pass. Compiles either way. Recorded as an

&#x20; unforced harmless change; left in place.



Direct inspection of sync\_events row contents deferred to

Batch 4b, where the read path was built.



================================================================

BATCH 3 - ENTITY\_FIELD\_STATE AT ORIGINATION

================================================================



Commits: cbac09c (main), bd2f751 (fix)

Files:

&#x20; shared/src/sync\_events.rs

&#x20; shared/src/debtors.rs

&#x20; shared/src/debts.rs

&#x20; shared/src/actions.rs

&#x20; shared/src/communications.rs



What was added:

&#x20; originate\_event takes a new parameter: fields\_set: \&\[\&str].

&#x20; For each field, writes a row to entity\_field\_state with an

&#x20; ON CONFLICT clause that updates the current winner. The new

&#x20; event is always the winner for the fields it sets

&#x20; (Section 12.3 Rule 2).



&#x20; Thirteen call sites updated:

&#x20;   debtors.rs (5): insert\_debtor, bulk\_insert\_debtors,

&#x20;     update\_debtor, delete\_debtor, insert\_related\_debtor

&#x20;   debts.rs (3): data\_json for insert, update, delete

&#x20;   actions.rs (3): insert (7 fields), update (6 fields),

&#x20;     delete (deleted)

&#x20;   communications.rs (2): insert (4 fields), delete (deleted)



Scope: local side only. The comparison algorithm of Section

25.9.9 is exercised by the receiving pipeline in Batch 4b.



Fix during the batch:

&#x20; bd2f751. bulk\_insert\_debtors originated with `id,` instead of

&#x20; `\&id,`. String vs \&str. One-line fix.



Verification (cloud, 2026-10-03):

&#x20; Both binaries build. 14/14 tests pass. Client launched, debtor

&#x20; inserted. The five entity\_field\_state rows committed.



================================================================

BATCH 4A - WIRE-FORMAT PARSERS

================================================================



Commits: 0d1e2bc (main), 800791a (fix)

Files:

&#x20; shared/src/lib.rs                  two pub mod lines

&#x20; shared/src/sync.rs                 action encoder moved

&#x20; shared/src/sync\_parse.rs           NEW (514 lines)

&#x20; shared/src/sync\_handshake.rs       NEW (575 lines)

&#x20; shared/src/actions.rs              private encoder removed

&#x20; shared/tests/sync\_wire\_roundtrip.rs NEW (303 lines)



What was added:

&#x20; sync\_parse module:

&#x20;   parse\_tlv / TlvReader

&#x20;   decode\_string\_value, decode\_optional\_string\_value

&#x20;   parse\_debtor\_created\_payload, parse\_entity\_updated\_payload

&#x20;   parse\_action\_created\_payload, parse\_communication\_logged\_payload

&#x20;   parse\_event\_record, parse\_sync\_message\_inner



&#x20; sync\_handshake module: encoders and parsers for

&#x20;   HANDSHAKE\_HELLO       0x0002

&#x20;   HANDSHAKE\_REPLY       0x0003

&#x20;   HANDSHAKE\_CONFIRM     0x0004

&#x20;   SESSION\_ESTABLISHED   0x0005  AEAD-encrypted

&#x20;   SESSION\_END           0x0006  AEAD-encrypted

&#x20;   SYNC\_ACK              0x0011  AEAD-encrypted



&#x20; AckOutcome enum: Accepted, Duplicate, Rejected.



&#x20; encode\_action\_created\_payload moved from actions.rs (private)

&#x20; to sync.rs (public), beside the other three payload encoders.



&#x20; 15 round-trip tests in shared/tests/sync\_wire\_roundtrip.rs.



Scope: pure functions. No database, no state machine, no Tauri

wiring, no new commands.



Fix during the batch:

&#x20; 800791a. SeqReader::read\_u64 was written but never called.

&#x20; Removed. Lib warnings restored to 6.



Verification (cloud, 2026-10-03):

&#x20; gorka-shared build PASS, 6 warnings.

&#x20; shared tests 29/29 PASS (6 enrollment + 8 sync + 15 wire

&#x20; round-trip; two empty harnesses at 0).



================================================================

BATCH 4B - RECEIVING PIPELINE AND RECONCILIATION

================================================================



Commit: b76c15f

Files:

&#x20; shared/src/lib.rs                  pub mod sync\_pipeline

&#x20; shared/src/sync\_pipeline.rs        NEW (879 lines)

&#x20; shared/tests/sync\_pipeline.rs      NEW (325 lines)

&#x20; shared/src/db.rs                   open\_in\_memory\_for\_tests

&#x20; shared/src/communications.rs       drop duration from fields



What was added:

&#x20; sync\_pipeline module:

&#x20;   process\_sync\_message: entry point. Decrypts, parses,

&#x20;   processes each event, returns per-event outcomes.



&#x20;   Pipeline per Section 25.12.1:

&#x20;     structural validation (event\_type, entity\_type)

&#x20;     duplicate check by event\_id

&#x20;     semantic validation per event type

&#x20;     advance logical clock (Lamport, Section 12.3 Rule 2)

&#x20;     append event to sync\_events

&#x20;     prerequisite check

&#x20;     if pending: record in pending\_events, ACCEPTED

&#x20;     if applicable: apply, update entity\_field\_state,

&#x20;       record losing values in history\_records



&#x20;   Reconciliation per Section 25.9.9:

&#x20;     protocol\_order\_less compares (logical\_clock, device\_id,

&#x20;     sequence) lexicographically.

&#x20;     reconcile\_field reads current winner, compares, updates

&#x20;     state table, records losing value in history\_records,

&#x20;     updates entity\_field\_state.



&#x20;   Six tests: accept, duplicate, semantic rejection,

&#x20;   pending deferral, newer-wins, older-loses.



Fix during the batch: none.



Verification (cloud, 2026-10-03):

&#x20; Compile clean on first try.

&#x20; shared tests 35/35 PASS.

&#x20; Agent 2 warnings, Client 3 warnings.



================================================================

BATCH 5 - TRANSPORT AND SESSION HANDSHAKE

================================================================



Commits: ecdb34f (main), ca49dd2 (fix)

Files:

&#x20; shared/src/lib.rs                  two pub mod lines

&#x20; shared/src/sync.rs                 device\_id signature change

&#x20; shared/src/sync\_transport.rs       NEW (61 lines)

&#x20; shared/src/sync\_session.rs         NEW (229 lines)

&#x20; shared/tests/sync.rs               byte literals + 4th H test

&#x20; shared/tests/sync\_session.rs       NEW (121 lines)



What was added:

&#x20; Device\_id signature change: derive\_session\_key,

&#x20; compute\_handshake\_reply\_tag, compute\_handshake\_confirm\_tag,

&#x20; and build\_handshake\_proof\_input now take \&\[u8] instead of

&#x20; \&str. A real 16-byte device\_id is not always valid UTF-8.



&#x20; New function: derive\_handshake\_key (HKDF-SHA256 with info

&#x20; "GORKA-MVP-HANDSHAKE-v1", Section 8.5).



&#x20; sync\_transport module: read\_frame, write\_frame over a

&#x20; TcpStream. Outer-TLV framing. 16 MiB cap.



&#x20; sync\_session module: Session struct with connect and accept.

&#x20; Four-message handshake. send\_frame / recv\_frame.



&#x20; Two integration tests on real TCP loopback:

&#x20;   Full handshake plus DEBTOR\_CREATED message processed.

&#x20;   Handshake with wrong organization key must fail.



Fix during the batch:

&#x20; ca49dd2. h\_handshake\_key\_derivation test added (was omitted

&#x20; from the batch 5 commit).



Verification (cloud, 2026-10-03):

&#x20; gorka-shared build PASS, 6 warnings.

&#x20; shared tests 38/38 PASS, including two real TCP sessions on

&#x20; loopback.



================================================================

BATCH 6A - SYNC ENGINE, DIRECT TCP

================================================================



Commits: 21157b8 (main), f46cbcd (fix)

Files:

&#x20; shared/src/lib.rs                  pub mod sync\_engine

&#x20; shared/src/sync\_engine.rs          NEW (878 lines)

&#x20; shared/src/sync\_session.rs         peer\_device\_id,

&#x20;                                    set\_read\_timeout,

&#x20;                                    try\_recv\_frame

&#x20; shared/tests/sync\_engine.rs        NEW (218 lines)

&#x20; shared/src/db.rs                   open\_file\_for\_tests

&#x20; src-tauri-agent/src/auth.rs        peer\_address helpers

&#x20; src-tauri-agent/src/main.rs        AppState, three commands

&#x20; src-tauri/src/auth.rs              listen\_port helpers

&#x20; src-tauri/src/main.rs              AppState, three commands



What was added:

&#x20; Two-level engine:

&#x20;   OUTER LOOP (session lifecycle)

&#x20;     connect or listen

&#x20;     handshake

&#x20;     set stream read timeout (once, 500 ms)

&#x20;     INNER SESSION LOOP

&#x20;     close

&#x20;     exponential backoff (1s, 2s, 4s, 8s, max 30s)

&#x20;     reconnect



&#x20;   INNER SESSION LOOP (tick)

&#x20;     check stop signal

&#x20;     send locally-originated events not yet acked

&#x20;     try receive one frame

&#x20;     dispatch (SYNC\_MESSAGE -> pipeline + ACK; SYNC\_ACK ->

&#x20;       delivery bookkeeping)

&#x20;     update status



&#x20; EngineStatus, six values: Disabled, Connecting, Pending,

&#x20; Synced, Offline, Error.



&#x20; Pending is narrowly defined: locally-originated events not

&#x20; yet acknowledged by the peer. Received dependency gaps do not

&#x20; set Pending.



&#x20; EngineHandle, stop and status.



&#x20; AppState in both binaries gains db\_key and engine.

&#x20; unlock\_database writes the derived SQLCipher key into db\_key.

&#x20; logout stops the engine, clears db, clears db\_key, in that

&#x20; order. Reviewer-required ordering.



&#x20; Three new commands per binary:

&#x20;   start\_sync\_engine   (agent: connect; client: listen)

&#x20;   stop\_sync\_engine

&#x20;   sync\_engine\_status



&#x20; sync\_session gains peer\_device\_id, set\_read\_timeout, and a

&#x20; buffered try\_recv\_frame so a partial frame arriving across a

&#x20; tick boundary is preserved.



&#x20; db::open\_file\_for\_tests for the engine integration test.



Fix during the batch:

&#x20; f46cbcd. TcpStream::connect takes \&str, not \&mut String.

&#x20; Unused Instant import removed.



Verification (cloud, 2026-10-03):

&#x20; gorka-shared build PASS, 6 warnings.

&#x20; shared tests 39/39 PASS, including the engine integration

&#x20; test (2.09s, real TCP, full delivery pipeline).

&#x20; Agent 2 warnings, Client 3 warnings.



&#x20; Live in Agent binary (cloud, devtools):

&#x20;   is\_database\_unlocked = true

&#x20;   is\_enrolled = true

&#x20;   start\_sync\_engine(bogus) = ok

&#x20;   status transitions: connecting -> offline

&#x20;   stop\_sync\_engine = null

&#x20;   status returns to disabled

&#x20;   logout stops engine, clears state

&#x20;   re-login, re-start works



&#x20; Live two-apps (cloud, both binaries):

&#x20;   Client listening on 54321, Agent manual override to

&#x20;   that address. Both reached synced. Debtor inserted on

&#x20;   Client appeared on Agent. Multiple debtors converged.



================================================================

BATCH 6B-1 - CONTROL PLANE DISCOVERY

================================================================



Commits: 900bfbd (main), 55976d4 (fix), e963c4d (fix),

&#x20;        0fc95ee (test fix)

Files:

&#x20; shared/src/lib.rs                  pub mod sync\_discovery

&#x20; shared/src/sync\_discovery.rs       NEW (187 lines)

&#x20; shared/src/sync\_engine.rs          DiscoveryConfig,

&#x20;                                    ListenerConfig,

&#x20;                                    discovery branch

&#x20; shared/Cargo.toml                  reqwest blocking feature

&#x20; shared/tests/sync\_engine.rs        test updated

&#x20; src-tauri-agent/src/main.rs        start\_sync\_engine changed

&#x20; src-tauri-agent/src/auth.rs        dead helpers removed

&#x20; src-tauri/src/main.rs              start\_sync\_engine changed

&#x20; src/backend/index.ts               mount line

&#x20; src/backend/routes/sync.routes.ts  NEW (243 lines)



What was added:

&#x20; Backend sync.routes.ts with an in-memory ephemeral endpoint

&#x20; registry keyed by (organizationId, wireDeviceId). Four

&#x20; endpoints:

&#x20;   POST /api/sync/register-endpoint

&#x20;   POST /api/sync/heartbeat

&#x20;   GET  /api/sync/peers

&#x20;   POST /api/sync/unregister-endpoint



&#x20; Entries expire after 30 seconds of no heartbeat. Lazy cleanup

&#x20; on reads. No background thread.



&#x20; register-endpoint upserts a device\_registrations row using only

&#x20; the authorized columns (organizationId, userId, registeredAt,

&#x20; lastSeenAt, isAuthorized). No reserved fields. No address in

&#x20; device\_registrations.



&#x20; Shared sync\_discovery module: register\_endpoint, heartbeat,

&#x20; unregister\_endpoint, discover\_peer. All use

&#x20; reqwest::blocking::Client. CONTROL\_PLANE\_BASE\_URL constant

&#x20; beside the auth configuration.



&#x20; sync\_engine gains:

&#x20;   DiscoveryConfig { jwt, local\_wire\_device\_id, manual\_override }

&#x20;   ListenerConfig { jwt, listen\_port, listen\_address }



&#x20; start\_engine\_connect takes DiscoveryConfig. The Connect branch

&#x20; calls discover\_peer unless manual\_override is Some.



&#x20; start\_engine\_listen takes ListenerConfig. Registers the

&#x20; endpoint with the Control Plane before spawning the thread.

&#x20; Heartbeats every 15 seconds while waiting for an accept.



&#x20; Outer loop distinguishes NO\_PEER\_DISCOVERED and

&#x20; DISCOVERY\_FAILED from real connection errors: those stay in

&#x20; Connecting and poll every 2 seconds (Q5 decision).



&#x20; stop\_sync\_engine in both binaries unregisters its endpoint on

&#x20; graceful shutdown. Failure logged and tolerated.



&#x20; Client listen port: fixed default 54321. Non-zero command

&#x20; argument overrides. Not user-facing.



Fixes during the batch:

&#x20; 55976d4. reqwest::Client is async; the discovery client

&#x20; needed reqwest::blocking. Enabled the blocking feature.

&#x20; auth\_http.rs unchanged (still async).

&#x20; e963c4d. Removed dead peer\_address helpers from Agent auth.rs.

&#x20; start\_sync\_engine now takes manual override as a command

&#x20; argument, so the settings.dat persistence helpers had no

&#x20; callers.

&#x20; 0fc95ee. shared/tests/sync\_engine.rs updated for the new

&#x20; engine signatures. start\_engine\_listen takes ListenerConfig,

&#x20; start\_engine\_connect takes DiscoveryConfig. Test uses the

&#x20; manual\_override path for direct TCP, without requiring a

&#x20; running Control Plane.



Verification (cloud, 2026-10-03):

&#x20; gorka-shared build PASS, 6 warnings.

&#x20; Agent 2 warnings, Client 3 warnings.

&#x20; shared tests 39/39 PASS.



&#x20; Live discovery demo (cloud, devtools):

&#x20;   Backend running on port 3000 with gorka\_test.

&#x20;   Client: start\_sync\_engine(listenPort: 54321) -> registers.

&#x20;     status: connecting.

&#x20;   Agent: start\_sync\_engine(manualOverride: null) -> calls

&#x20;     discover\_peer.

&#x20;   Agent status: synced. Discovery found the Client.

&#x20;   Debtor inserted on Client. Agent received it:

&#x20;   \[{...}] with name "Discovery", surname "Works".



&#x20; End-to-end proof: Agent called discover\_peer, got the

&#x20; Client's registered endpoint from the Control Plane, dialed

&#x20; it, handshake succeeded, debtor propagated through the

&#x20; pipeline.



================================================================
BATCH 6B-2A - BACKEND RELAY SERVICE
================================================================

Commit: 9b526a5
Files:
  package.json                       ws, @types/ws
  package-lock.json                  resolved
  src/backend/relay.service.ts       NEW (336 lines)
  src/backend/index.ts               import, httpServer, attach

What was added:
  WebSocketServer attached to the existing HTTP server at
  ws://localhost:3000/api/sync/relay.

  First-message auth. The peer sends a JSON frame:
    { type: "open", jwt, wireDeviceId, targetWireDeviceId? }
  The JWT is verified once with JWT_SECRET and discarded.

  Pairing uses an in-memory active-connections map keyed by
  (organizationId, wireDeviceId). No relay_sessions row is
  created until two peers are paired. If the opener's target is
  not connected, the peer waits.

  On pairing: one relay_sessions row with canonical deviceAId
  and deviceBId by lexicographic order of DeviceRegistration.id.
  Both peers must have an is_authorized device_registrations
  row.

  Binary frames forwarded verbatim. Bytes counted only after
  successful forward. Nothing inspected, persisted, or logged.

  On termination: endedAt, bytesTransferred, sessionStatus
  (ENDED or FAILED), closeReason.

  The relay holds no organization key and no session key. It
  cannot decrypt.

  index.ts captures the http.Server returned by app.listen and
  calls attachRelay.

Distinction preserved (reviewer-required):
  wireDeviceId           ephemeral pairing handle, not persisted
  DeviceRegistration.id  persistent DB identity, the FK target
                         in relay_sessions
  No substitution between the two.

Verification (cloud, 2026-10-03):
  npm install on cloud. ws and @types/ws resolved.
  Backend started with the usual inline DATABASE_URL override.
  Two WebSocket clients, one JWT, two wire device ids.

    [1] login test@example.com
    [2] register both endpoints with /api/sync/register-endpoint
    [3] open both WebSockets, both paired
    [4] A -> B binary 5 bytes  (0102030405)
    [5] B -> A binary 3 bytes  (0a141e)
    [6] close both, ENDED

  relay_sessions row inspected:
    sessionStatus:     ENDED
    bytesTransferred:  8
    endedAt:           set
    closeReason:       normal-close
    deviceAId = deviceBId

  Same deviceAId and deviceBId because the test logged in once
  as one user. device_registrations has
  @@unique([organizationId, userId]), so both wire devices
  resolved to the same registration row. In production, Client
  and Agent are distinct users; the ids differ. The relay does
  not need a change. This is an MVP behavior note.

Fix during the batch: none.

================================================================
           STATE AT END OF BATCH 6B-2A
================================================================

  Main machine:  9b526a5 plus this doc commit, clean, pushed.
  Cloud machine: 9b526a5, clean.
  GitHub:        9b526a5 plus this doc commit.

Both binaries build. 39 shared tests pass. The Client and Agent
can discover each other through the Control Plane and
synchronize without a manual peer address. The Control Plane
relay accepts WebSocket connections, pairs two peers,
forwards opaque ciphertext both directions, and records the
session in relay_sessions.

Criterion 9 (relay fallback) requires the client-side fallback
path, which is Batch 6b-2b. The backend half is done.

Batch 7 is the full ten-criterion acceptance.

================================================================

END OF DOCUMENT

Batch 7 is the full ten-criterion acceptance.

================================================================
BATCH 6B-2B - CLIENT RELAY FALLBACK
================================================================

Commits:
  da8ec6d  connector side
  bbe28dd  test fix (DiscoveryConfig gains two new fields)
  096ff0f  listener side (RelayPairingWaiter, no self-reconnect)
  bcf6624  temporary test change (force relay path on loopback)
  7cdac88  revert of the temporary test change
  04bc5db  post-hoc Cargo.lock alignment (tungstenite 0.21.0)

Files added / changed (connector side):
  shared/src/sync_transport.rs   SessionTransport and
                                 HandshakeTransport traits
  shared/src/sync_session.rs     Session holds Box<dyn SessionTransport>;
                                 drops TcpStream-specific recv_frame
                                 and set_read_timeout
  shared/src/sync_relay.rs       NEW: RelayTransport, opens WebSocket
                                 to ws://<backend>/api/sync/relay,
                                 sends open frame (jwt, wireDeviceId,
                                 targetWireDeviceId), waits for paired
  shared/src/sync_engine.rs      Connect branch: try_tcp_session with
                                 5 s connect_timeout, then fall back to
                                 RelayTransport when TCP fails.
                                 DiscoveryConfig gains
                                 local_wire_device_id_hex and
                                 backend_base_url
  src-tauri-agent/src/main.rs    start_sync_engine supplies both fields
  shared/tests/sync_engine.rs    DiscoveryConfig gains the two fields;
                                 test uses manual_override path

Files added / changed (listener side, 096ff0f):
  shared/src/sync_relay.rs       open_pairing_websocket (no-target
                                 open, non-blocking);
                                 RelayPairingWaiter (one socket,
                                 no self-reconnect);
                                 RelayTransport::from_paired_websocket
  shared/src/sync_engine.rs      PeerMode::Listen becomes a struct
                                 variant carrying backend_base_url and
                                 local_wire_device_id_hex. Listen
                                 branch polls TCP and the relay waiter
                                 with a 2-second reopen throttle.
                                 Retry ownership stays in the Listen
                                 loop, not in the waiter.
  ListenerConfig, both Tauri binaries, and the backend: untouched.

What was added:
  Transport generalization. A session is no longer tied to a TCP
  stream. The SessionTransport and HandshakeTransport traits let
  the engine pick direct or relay at session setup. The wire
  framing and buffered try_recv_frame are preserved.

  Client relay fallback. When a direct TCP connect fails, the Agent
  falls back to opening a WebSocket to the Control Plane relay.

  Parallel relay presence for the listener. The Client listener
  opens a pairing WebSocket to the relay alongside its TCP listener
  and polls both in the same loop. Whichever yields a session first
  wins. Without this, the Agent's relay fallback had nobody to pair
  with.

No protocol, event, reconciliation, schema, or encryption changes.

Windows Firewall loopback finding (recorded during this batch):
  Inbound and outbound netsh advfirewall rules have no effect on
  127.0.0.1 connections. To force the relay path on the same
  machine, the listener registered 127.0.0.1:<port+1> so the
  Agent's TCP connect to the bound port failed. This is the
  temporary change at bcf6624, reverted at 7cdac88.

Criterion 9 proof (over the relay):
  relay_sessions row cmusrkd4t0005uvh4vtnsiqji, 1898 bytes,
  sessionStatus ENDED, closeReason normal-close, recorded during
  the temporary window. Bidirectional propagation while the relay
  was on the path. Direct TCP preference also proven.

Post-hoc lockfile alignment:
  04bc5db - Cargo.lock sync after 6b-2b; tungstenite 0.21.0 and
  transitive dependency resolution (data-encoding, sha1, utf-8).
  Committed 2026-10-04. No source or protocol change. Listed here
  so a future reader sees why a dependency-lock commit appears
  after the 6b-2b implementation commit.

Fix during the batch: none.

================================================================
BATCH 7 - FULL TEN-CRITERION ACCEPTANCE
================================================================

Purpose:
  Run every MVP acceptance criterion live and capture direct
  evidence. Plus the §12.2 extra tests. Plus three founder-requested
  tests (A, B, C). The founder's reasoning, on the record: this sync
  engine is a core pillar. If it does not work properly, everything
  else is useless. Time authorized accordingly.

The ten MVP acceptance criteria (§12.1), all proven live:

  #   Criterion                                    Status
  --  -------------------------------------------  -----------------
  1   Initial sync between two machines            PROVEN
  2   New debtor propagation                       PROVEN
  3   State update propagation                     PROVEN
  4   Event propagation, append-only               PROVEN
  5   Offline, reconnect, reconcile                PROVEN
  6   Duplicate prevention                         PROVEN
  7   No data loss under normal operation          PROVEN
  8   Direct connection path                       PROVEN
  9   Relay fallback path                          PROVEN (6b-2b)
  10  Corrupted message rejection                  PASS (see below)

The §12.2 extra tests, both run live in this session:

  Out-of-order arrival                            PASS
  Connection-drop-mid-sync                        PASS

Founder-requested extra tests A, B, C:

  Test A - Agent killed mid-sync, catches up      PASS (prior session)
  Test B - Client killed mid-receive, catches up  PASS (prior session)
  Test C - AEAD rejection observability           CLOSED WITH FINDING
                                                   (see below)

Test A (prior session):
  Client inserted 300 debtors while Agent offline. Client
  reached 316. Agent's engine started, then taskkill /F on
  gorka-agent.exe mid-transfer. Agent relaunched, engine
  started, caught up to 316. No loss, no duplicates.

Test B (prior session):
  Agent inserted 200 debtors while both offline. Agent reached
  516. Both engines started, then taskkill /F on
  gorka-client.exe mid-receive. Client relaunched, engine
  started, caught up to 516. No loss, no duplicates.

Out-of-order arrival test (this session):
  Reorder hook (test_reverse_next_batch) armed on Agent. Three
  debtors inserted on Agent in a tight burst, so a single
  outbound SYNC_MESSAGE carried all three events with their
  order reversed on the wire. Client search returned exactly
  three rows (OOO-1, OOO-2, OOO-3), no duplicates, no missing.
  Convergence held.

Connection-drop-mid-sync test (this session):
  Twenty debtors inserted on Agent in one burst. Client killed
  with taskkill /F mid-transfer, before the burst finished
  pushing to the peer. Client relaunched, engine restarted,
  Agent reconnected, unacknowledged events re-sent, duplicate
  detection prevented double-apply. Client search returned
  exactly 20 rows, no duplicates, no missing. Directly observed,
  not inferred.

Criterion 10 - PASS:
  Corrupted-frame rejection, session termination, retry,
  successful recovery, and data preservation are proven.
  The rejecting engine records the internal Error and enters
  the normal recovery state sequence. No data loss, no duplicate
  effect. Verified by direct observation of the wire, across
  multiple runs, with probes on both binaries.

Test C - CLOSED WITH FINDING:
  The corrupted-frame rejection and recovery behavior is proven.
  The rejecting engine writes Error(...) internally, but the UI
  does not expose that transient state because it is immediately
  replaced by Offline. The UI-visible recovery sequence
  Offline -> Connecting -> Pending -> Synced was directly
  observed under a 60-second polling window. No production defect
  was identified. The remaining question of whether transient
  cryptographic/session failures should have a separately
  visible error indication is deferred as a future status/UX
  design decision.

  Supporting evidence, Client terminal:

    AEAD FAILURE len=283
    OUTER ERROR: SYNC_MESSAGE: decryption failed
    set_status -> Error("SYNC_MESSAGE: decryption failed") @ 0x1f17aa4d2a0
    set_status -> Offline @ 0x1f17aa4d2a0
    set_status -> Connecting @ 0x1f17aa4d2a0
    ...
    set_status -> Pending @ 0x1f17aa4d2a0
    set_status -> Synced @ 0x1f17aa4d2a0

  Supporting evidence, Client poll (100 ms cadence, 60-second
  window, 544 reads):

    [{ "dt": 12,     "s": "synced"     },
     { "dt": 15692,  "s": "offline"    },
     { "dt": 16768,  "s": "connecting" },
     { "dt": 33047,  "s": "pending"    },
     { "dt": 33159,  "s": "synced"     }]

  Supporting evidence, Arc comparison: on Client, every write and
  every read used Arc 0x1f17aa4d2a0. On Agent, every write and
  every read used Arc 0x23296070070. There is no second Arc.
  No set_status LOCK FAILED line was observed.

  Architectural interpretation:
    Internal diagnostic event: AEAD failure -> Error(...)
    Stable operational state: session failed -> Offline ->
                              Connecting -> Pending -> Synced

  The distinction makes sense for GORKA. An AEAD failure is
  important from a security/diagnostic perspective, but it does
  not mean the replica should remain in a persistent Error
  state. Section 26.2 defines Error for persistent conditions
  (repeated session failures, version mismatch, internal errors,
  persistent transport failure). A one-shot AEAD rejection that
  immediately terminates the session and enters recovery is not
  by itself a persistent condition. Under that interpretation,
  Offline is the correct user-facing state, and the Error write
  is close to dead code for this specific path.

  No production code was changed to make Test C's original
  wording pass. No artificial Error display window was
  introduced. The question of whether transient security or
  session failures should have a visible error indicator is
  recorded as a future UX/status design decision, not a Batch 7
  blocker.

Temporary diagnostic machinery used during Batch 7:

  9918e5f  Batch 7 acceptance test hooks (corruption + reorder)
  867f846  Batch 7 Test C diagnostic probes (CORRUPTING + sending)
  9bb7db8  Batch 7 Test C Client-side probes (received + parse +
           AEAD FAILURE)
  24c1035  Batch 7 Test C localization probe (OUTER ERROR)
  125e1f2  Batch 7 Test C status-path probes (set_status write-side,
           EngineHandle::status read-side)

  All temporary. No control-flow change. Removed in one revert
  commit.

Revert commit:
  4e090e0 - Revert every Batch 7 Test C diagnostic probe and
  hook. Restores shared/src/sync_engine.rs, shared/src/sync.rs,
  and src-tauri-agent/src/main.rs to their pre-probe state
  (224bd79). Diff against 224bd79 for the three files is empty.

Post-revert verification (cloud, 4e090e0):
  gorka-agent build   PASS, 2 warnings
  gorka-client build  PASS, 3 warnings
  gorka-shared        PASS, 6 warnings
  shared tests        39/39 PASS
                      (6 enrollment + 9 sync + 1 engine
                       integration + 6 wire roundtrip
                       + 2 pipeline + 15 session)

Deviations:
  None. No production logic change was made for any test.
  Test C's original wording was not satisfied by adding an
  artificial Error display window. The finding is documented
  rather than papered over.

================================================================
           STATE AT END OF BATCH 7
================================================================

  Main machine:  4e090e0, clean, pushed.
  Cloud machine: 4e090e0, clean except known untracked scratch
                 files (b7-meta-check.cjs, build-6b2b*.txt,
                 check-columns.ts, relay-check.cjs,
                 test-6b2b*.txt, test-output.txt).
  GitHub:        4e090e0.

All ten MVP sync-engine acceptance criteria proven live. §12.2
extra tests both passed. Founder-requested tests A, B passed;
Test C closed with finding. Criterion 10 pass. All temporary
diagnostic machinery reverted. Builds clean at baseline
warnings. 39 shared tests pass.

What remains in Phase 9.6 after Batch 7:

  - The sync indicator slice (replace the static TopHeader
    placeholder with a functional status reader).
  - CONNECTOR-MODEL.md.
  - Then Phase 9.6 closes and Phase 9.7 (multi-user
    demonstration) can begin planning.

Claim D (the boundary-test multi-machine relay claim from
BOUNDARY-TEST-PLAN.md §2.4) was not folded into this batch.
Reason: forcing the relay path on loopback needs a temporary
code change, and the reviewer's ruling for this batch was no
production changes during diagnosis. Claim D remains a Phase 15
item.

================================================================

END OF DOCUMENT

================================================================

================================================================
SLICE 9.6.10-A/B/C — SYNC INDICATOR AND ENTRY WORK
================================================================

Date: October 5, 2026.
Commits: d5d53b3, 357c361, 7beec24, a13a1f9, 89ab7fa.

Files changed: multiple. See the individual commit messages.

What landed:

  d5d53b3  auto-start on unlock (Client and Agent). The sync
           engine starts automatically after the database is
           unlocked.
  357c361  sync indicator in both apps. A shared SyncIndicator
           component reads engine status and renders the current
           state.
  7beec24  wire SyncIndicator into the Client's real AppShell
           header.
  a13a1f9  Agent SyncIndicator CSS import.
  89ab7fa  Agent logout moved to sidebar.

The static TopHeader sync placeholder from the Phase 9.6 closure
list is now a functional reader.

This slice was not executed in this session. It is recorded here
from the commit messages and the repository state, so that the
log matches the current state. Design decisions for the
SyncIndicator's visual shape (colors, per-peer vs aggregate,
which states map to which labels) are visible in code, not
restated here.

================================================================
SLICE HEADER POLISH — REAL NAME IN THE CLIENT HEADER
================================================================

Date: October 5, 2026.
Commits: f168d8e, 922f182, 56a674e, f8cdc75.

What landed:

  f168d8e  header polish. The login flow now preserves the
           name and email the backend already returns. The
           shared::auth_http::LoginResult gains name and email
           fields. The Client's auth.rs stores user_name and
           user_email in settings.dat at login and exposes
           get_user_name and get_user_email. The Client's
           main.rs registers both as Tauri commands. The
           Client's services/local.db.ts adds getUserName() and
           getUserEmail() wrappers on the auth object.
           AppShell.tsx replaces the broken
           apiService.get('/auth/me') call with
           auth.getUserName(), falling back to
           auth.getUserEmail() when the name is empty.

  922f182  fix: closing brace in auth_http::login. The commit
           that added name and email to LoginResult removed the
           function's closing brace, leaving the shared crate
           uncompilable. One-line repair.

  56a674e  fix: restore lost functions in auth.rs and main.rs.
           The earlier repair lost get_organization_id and
           get_user_name in auth.rs and the get_organization_id
           wrapper in main.rs, due to clipboard-overwrite errors
           during editing. All three restored.

  f8cdc75  cleanup: remove unused tauri::Manager import from
           Client auth.rs. The import existed for the
           .path().app_data_dir() calls inside the get_token
           debug block, which was dropped in an earlier commit.
           Removing it restored the Client bin warning baseline
           to 3.

The Client header now shows the user's real name. Fallback is
the email. Avatar initials are derived from the displayed name.
Fallback avatar character is '?' when both are empty.

This slice was not executed in this session. It is recorded here
from the commit messages and the repository state.

================================================================
SLICE CLIENT ENTRY-FLOW REDESIGN
================================================================

Date: October 5, 2026. Executed in this session.
Commit: ffb3d56.

Purpose:
  Bring the Client's Login and Unlock screens into the Agent's
  visual vocabulary, so both apps share one design system.

What was done:
  1. Copied agent-dashboard/src/components/primitives/ to
     supervisor-dashboard/src/components/primitives/.
     Twenty-five files, byte-identical.

  2. Copied agent-dashboard/src/styles/design-tokens.css to
     supervisor-dashboard/src/styles/design-tokens.css.
     Byte-identical. Verified with fc /b.

  3. Added one import line to supervisor-dashboard/src/main.tsx:
       import './styles/design-tokens.css';
     Immediately below the existing './index.css' import.

  4. Rewrote supervisor-dashboard/src/pages/Login.tsx to use
     EntryCard, GorkaLogo, ErrorBanner, Input, Label, and
     Button variant="primary". Subtitle changed from
     "Supervisor Dashboard" to "Client Dashboard".

  5. Created supervisor-dashboard/src/pages/Login.css.

  6. Rewrote supervisor-dashboard/src/components/UnlockScreen.tsx
     using the same primitives.

  7. Created supervisor-dashboard/src/components/UnlockScreen.css.

DATA PRESERVATION
  Same auth.login call.
  Same onLoginSuccess and onUnlocked callbacks.
  Same database_exists check.
  Same two-mode set/enter logic.
  Same unlock_database invocation.
  Same password-match and minimum-length validation.
  Same error fallback when database_exists fails.

BEHAVIOR PRESERVATION
  Same Login -> Unlock -> Dashboard flow.
  Same App.tsx state machine, unchanged.
  Same Tauri commands invoked.
  Same settings.dat behavior.

WARNING DELTA
  None. Client bin warning baseline unchanged at 3.

VERIFICATION
  Main: npm run build passes at every step.
  Cloud: pulled ffb3d56, npm run build passes in 18.69s.
         Launched Client with backend and Vite dev server.
         Login card visually confirmed (red GORKA wordmark,
         "Client Dashboard" subtitle, purple Sign In button,
         EntryCard shape). Login -> Unlock -> Dashboard walked.

EXPLICIT NON-CHANGES
  No schema change.
  No Rust change.
  No App.tsx change.
  No Agent change.
  No new dependency.
  No change to the Login -> Unlock -> Dashboard flow.

DEVIATIONS
  None.

================================================================
END OF ADDENDUM
================================================================
