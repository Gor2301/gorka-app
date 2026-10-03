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

&#x20; Batch 6b-2a Backend relay service            NOT STARTED

&#x20; Batch 6b-2b Client relay fallback            NOT STARTED

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

STATE AT END OF BATCH 6B-1

================================================================



&#x20; Main machine:  0fc95ee, clean, pushed.

&#x20; Cloud machine: 0fc95ee, clean except test-output.txt (scratch).

&#x20; GitHub:        0fc95ee.



Both binaries build. 39 tests pass. The Client and Agent can

discover each other through the Control Plane and synchronize

without a manual peer address.



Criterion 9 (relay fallback) is the only remaining unstarted

acceptance criterion. It is Batch 6b-2a (backend) and 6b-2b

(client).



Batch 7 is the full ten-criterion acceptance.



================================================================

END OF DOCUMENT

================================================================

