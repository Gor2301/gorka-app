# RESUME HERE

**Updated:** 2026-10-07 (Phase 5 closed: connector wire encoders/decoders and Connectors.tsx aligned. All green.)
**Main machine:** 68e775e
**Cloud machine:** 68e775e (last verified green)
**GitHub:** 68e775e

---

## Where we are

Phase 5 is closed. Two commits:

  62d332f  Phase 5a: CONNECTOR event wire encoders and decoders
  68e775e  Phase 5b: align Connectors.tsx to actual backend
           endpoints (B1, B2)

Phase 5a added the Rust wire encoders and decoders for the
three connector event types defined in SYNC-ARCHITECTURE.md
Sections 25.14-25.16: CONNECTOR_ENABLED (0x0005),
CONNECTOR_DISABLED (0x0006), CONNECTOR_CREDENTIAL_REPLACED
(0x0007). Entity type 0x06. No changes to the spec; no changes
to the pipeline; no connector wiring.

Phase 5b aligned the Client Dashboard's Connectors page to the
backend that actually exists. The old page called six routes
that do not exist (/connectors/types, /:id, /:id/connect,
/:id/connect-auto, /:id/test, /:id/disconnect). It also read
five import.meta.env.VITE_* values that were being baked into
the shipped bundle. Both defects are gone.

Relevant commits, in order:

  68e775e  Phase 5b: align Connectors.tsx to actual backend
           endpoints (B1, B2)
  62d332f  Phase 5a: CONNECTOR event wire encoders and decoders
  8c88d0a  RESUME-HERE.md: Phase 4 closed.
  115796d  Phase 4: migration 9 adds local_connectors,
           connector_usage, connector_sync_state,
           compliance_rules

Prior phase commits, still in history:

  60974bc  RESUME-HERE.md: Phase 3 closed.
  9ed9fda  Phase 3: test_factory returns Result to match
           fallible AdapterFactory
  c287e7b  Phase 3: real HttpClient, fallible AdapterFactory,
           default registry
  f1aa4ab  RESUME-HERE.md: Phase 2 closed.
  585261e  Phase 2: test helper avoids Debug requirement on
           adapter
  7271146  Phase 2: Resend email adapter with HttpClient
           abstraction
  1b9066c  RESUME-HERE.md: Phase 1 closed.
  ea8fb49  Phase 1: gorka-shared::connectors skeleton
  221a771  RESUME-HERE.md: Phase 0 closed.
  dcfe858  Phase 0 build fixes.

---

## What Phase 5a delivered

Three files modified:

  shared/src/sync.rs
    encode_bytes_value                    new helper.
                                          Mirrors
                                          encode_string_value,
                                          emits u32 BE length
                                          then raw bytes.
    encode_connector_enabled_payload      new. TLV order:
                                          0x6001 connector_code
                                          0x6002 tier
                                          0x6003 credential_value
                                          0x6004 configuration
                                          0x6005 enabled_at (u64)
    encode_connector_disabled_payload     new. TLV order:
                                          0x6001 connector_code
                                          0x6006 disabled_at (u64)
    encode_connector_credential_replaced_payload
                                          new. TLV order:
                                          0x6001 connector_code
                                          0x6003 credential_value
                                          0x6004 configuration
                                          0x6007 replaced_at (u64)

  shared/src/sync_parse.rs
    decode_bytes_value                    new helper.
    ConnectorEnabledPayload               new struct.
    ConnectorDisabledPayload              new struct.
    ConnectorCredentialReplacedPayload    new struct.
    parse_connector_enabled_payload       new.
    parse_connector_disabled_payload      new.
    parse_connector_credential_replaced_payload
                                          new.
                                          All three parsers use
                                          the existing TlvReader
                                          and seen: HashSet<u16>
                                          guard pattern.

  shared/tests/sync_wire_roundtrip.rs
    connector_enabled_round_trip          new test.
    connector_enabled_empty_configuration_round_trip
                                          new test. Covers the
                                          configuration="" edge
                                          case.
    connector_disabled_round_trip         new test.
    connector_credential_replaced_round_trip
                                          new test.

No deterministic hex vectors. Round-trip tests only. Vectors
are proposed as a separate small slice, 5a-vectors, to be done
on cloud with a hex-capture step.

---

## What Phase 5b delivered

Four files changed:

  src/backend/routes/connectors.routes.ts
    + GET /api/connectors/catalog. Returns active
      connector_catalog rows where isActive=true and
      lifecycleStatus='ACTIVE'. JSON shape:
      { success, data: { rows, total } }. Matches the existing
      GET /api/connectors shape.

  supervisor-dashboard/src/services/connectors.service.ts
    Full rewrite. Four functions, all returning the
    unwrapped body.data portion of the response:
      listCatalog()      -> GET /connectors/catalog
      listEnablements()  -> GET /connectors
      enable(code)       -> POST /connectors/enable
                            body { connectorCode, credentialsLocation: 'LOCAL' }
      disable(code)      -> POST /connectors/disable
                            body { connectorCode }
    Types CatalogEntry and EnablementRow exported. The old
    Connector interface and the six old functions are removed.

  supervisor-dashboard/src/pages/Connectors.tsx
    Full rewrite. Loads catalog and enablements in parallel on
    mount, merges by code. Renders a card per catalog row with
    the display shape defined by CONNECTOR-MODEL.md Section
    4.4. Button wording:
      Tier 1, disconnected -> Connect
      Tier 1, connected    -> Disconnect
      Tier 2, disconnected -> Configure (coming soon), disabled
      Tier 2, connected    -> Disable
    All four call the same two backend routes. No Test button,
    no connect-auto, no reference to any nonexistent endpoint.
    Tier 1 / Tier 2 derived from catalog.isManagedByGorka.

  supervisor-dashboard/src/components/Connectors/ConfigurationModal.tsx
    Full rewrite. B2 only. The getDefaultCredentials function
    and its five import.meta.env.VITE_* reads are removed. The
    credentials state initializes to {}. Everything else
    unchanged. Not called by the page in 5b; stays in place
    for B3.

---

## Verification at 68e775e (cloud)

  cargo build --workspace   green. Warnings unchanged from
                            Phase 4 baseline: gorka-agent 2,
                            gorka-client 3, gorka-shared 6.
  cargo test --workspace    72 tests, 0 failed.
                            gorka_shared lib: 25 (unchanged).
                            connector_tables: 4/4.
                            enrollment: 6/6.
                            sync: 9/9.
                            sync_engine: 1/1.
                            sync_pipeline: 6/6.
                            sync_session: 2/2.
                            sync_wire_roundtrip: 19/19
                              (was 15; +4 connector tests).
  node verify/index.mjs     9/9 PASS, unchanged.
  npm run build (supervisor-dashboard)
                            green, 660.73 kB bundle.
  VITE_* in shipped bundle  zero matches. B2 verified.
  Removed endpoints in bundle
                            zero matches.
  New endpoints in bundle   all three present
                            (/connectors/catalog, /enable,
                            /disable).

---

## What Phase 5 did not do

  - No local_connectors write from the frontend. The Tier 2
    Configure path is disabled in 5b because B3 (the local
    Tauri credential write) does not exist yet.
  - No Tauri command for local credential write. B3 next.
  - No Zone 3 audit record write. B4.
  - No local compliance rules page. B5, B6.
  - No Tier 1 credential transit verification. B7.
  - No "Test connection" via a Tauri command. Requires B3.
  - No backend provider provisioning. POST /connectors/enable
    still only writes the client_connectors row. No subaccount
    is created with any provider.
  - No deterministic hex test vectors for the three connector
    events. Proposed as slice 5a-vectors.
  - No change to ConfigurationModal.tsx's caller or the page's
    use of it. The file is orphaned in 5b.

---

## Where we go next

Phase 6 in the plan is the Zone 3 audit record. Phase 7 is the
compliance rules page. Phase 8 is the agent send command. But
the natural next slice from where we are is B3, the local
credential write path. It closes the only gap that leaves a
user-visible button disabled.

Candidate order:

  1. 5a-vectors. Small. Cloud-only work: encode the three
     events with fixed fixtures, capture the hex, freeze them
     in sync_wire_roundtrip.rs. Adds 3-6 tests, no source
     changes.

  2. B3. Local Tauri command to write a credential into
     local_connectors. Needs a new shared function in db.rs
     or a new connectors module. Wire ConfigurationModal to
     it. Re-enable the Tier 2 Configure button. Then B3's
     verification requires the client to run with the
     command registered.

  3. B4. Zone 3 audit record write. Small. DeclarationModal's
     onAccept calls a new backend route or extends
     /connectors/enable with an acknowledge flag. Writes one
     row in organization_audit_events.

  4. B7. Tier 1 credential transit verification. Read-only
     review of backend logging, tracing, error serialization.
     No code change expected if the review finds nothing.

Full connector arc (from CONNECTOR-MODEL.md Section 14):

  Phase 5 (this phase) = connector event types + Connectors.tsx
  Phase 6 = Zone 3 audit record
  Phase 7 = compliance rules page
  Phase 8 = agent send command
  ...
  Phase 15 = acceptance

---

## Known loose ends

Build warnings (pre-existing, not from Phase 5):

  - shared/src/db.rs:4 -- unused import
    `use serde_json::Value as JsonValue;`
  - shared/tests/sync_engine.rs:92 -- `let mut conn_b_test`
    does not need `mut`.
  Both predate Phase 1. Small cleanup slice candidate.

Documentation:

  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale: they describe the created_by defect as open, but
    Phase 0 applied the A2 amendment and recomputed V6.
    Cosmetic.
  - SYNC-TEST-VECTORS-v1.md header says V6 is PENDING. The V6
    entry and summary table correctly say FROZEN. Cosmetic.
  - LOCAL-TABLES.md B.2 and B.3 have a source line "Connector
    addendum" rather than a section reference. Cosmetic.

Code:

  - No JWT decode. user_id from login response. Persisted at
    login. Design choice.
  - /api/auth/login response contract is load-bearing. No
    backend test guards it. No local check refuses to originate
    when user_id empty.
  - Logout does not delete user_id key. Cosmetic.
  - V6 vector: created_by is now part of the spec
    (SYNC-ARCHITECTURE.md v1.5, TLV 0x5006) but the Rust and
    Node implementations were not recomputed. V6 is frozen at
    its pre-amendment value. Tracked separately.

Environment:

  - Cloud has untracked scratch files from earlier slices
    (b7-meta-check.cjs, build-6b2b-listener.txt,
    build-6b2b.txt, check-columns.ts, relay-check.cjs,
    test-6b2b-listener.txt, test-6b2b.txt, test-output.txt).
  - .env and .env.test contain live credentials including a
    Resend API key and a Gemini API key. Rotation deferred to
    pre-launch by founder decision. VITE_* reads from the
    source are removed by 5b; the .env values themselves
    remain.
  - Resend sending: @gmail.com from-address rejected by
    Resend. onboarding@resend.dev works for dev.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot
  reliably compile.
- One machine owns a slice at a time. Git is the only
  handoff.
- Edits on main. Commit on main, push, pull on cloud, build
  and test and verify on cloud, pull back on main.
- For any scripted edit to a recovery document or source
  file: use content anchors (FindUnique returns exactly one
  match or throws). Never use raw line indices. Never use
  String.Replace on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
- Read UTF-8 files as UTF-8. Emoji and non-ASCII in source
  files will be silently corrupted otherwise. For
  single-line edits on non-ASCII files, edit by hand in a
  text editor instead of scripting.
- When scripting multi-line insertions in PowerShell here-
  strings, always leave a blank line before the closing '@
  or the next line merges with the last. This bit us in 5a.
- git diff <file> after every edit before moving on.
- Match tool weight to edit size.
- One commit per coherent change.
- No guessing. Every fact confirmed on disk before the
  script is written.
- When in doubt, stop and ask the founder.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.

At slice end: rewrite it with the new state. This file is
rewritten in place, not appended to. It stays under 250 lines.

If the chat dies unexpectedly: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md