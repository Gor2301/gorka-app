# RESUME HERE

**Updated:** 2026-10-07 (Phase 3 closed: real HttpClient, fallible factory, default registry. All green.)
**Main machine:** 9ed9fda
**Cloud machine:** 9ed9fda
**GitHub:** 9ed9fda

---

## Where we are

Phase 3 is closed. The gorka-shared::connectors module now contains
a real HTTP client (reqwest::blocking), a fallible AdapterFactory
signature, and a default registry that returns a fully wired
Resend email adapter. Cloud build, workspace tests, and node verify
are green.

Two design decisions were settled at the start of Phase 3:

  1. AdapterFactory became fallible. The frozen Section 7.4
     signature returned Box<dyn ConnectorAdapter>; construction
     errors had nowhere to go. Now it returns
     Result<Box<dyn ConnectorAdapter>, ConnectorError>. Section
     7.4 of CONNECTOR-MODEL.md is amended in place, with a dated
     amendment note. Section 7.3's LocalConfigurationError finally
     has a producer.

  2. Phase 3 stayed shared-crate-only. No Tauri command. A command
     would need a credential source, and local_connectors does not
     exist yet (CONNECTOR-MODEL.md Section 14 A3 names it as a
     required amendment). The command lands in a later phase.

The relevant commits, in order:

  c287e7b  Phase 3: real HttpClient, fallible AdapterFactory,
           default registry
  9ed9fda  Phase 3: test_factory returns Result to match fallible
           AdapterFactory

Prior phase commits, still in history:

  f1aa4ab  RESUME-HERE.md: Phase 2 closed.
  585261e  Phase 2: test helper avoids Debug requirement on adapter
  7271146  Phase 2: Resend email adapter with HttpClient abstraction
  1b9066c  RESUME-HERE.md: Phase 1 closed.
  ea8fb49  Phase 1: gorka-shared::connectors skeleton
  221a771  RESUME-HERE.md: Phase 0 closed.
  dcfe858  Phase 0 build fixes.

---

## What Phase 3 delivered

New file: shared/src/connectors/http_reqwest.rs.

  - ReqwestHttpClient. Implements HttpClient. Wraps
    reqwest::blocking::Client, 30s connect timeout, 60s read
    timeout. Style mirrors sync_discovery.rs, which uses the same
    blocking client for Control Plane discovery.
  - Error mapping: reqwest timeout -> HttpErrorKind::Timeout;
    everything else -> HttpErrorKind::Transport.
  - Default impl for ReqwestHttpClient (calls ::new()).

Modified file: shared/src/connectors/mod.rs.

  - `pub mod http_reqwest;` added after `pub mod http;`.
  - AdapterFactory signature changed to fallible:
      pub type AdapterFactory =
          fn(ConnectorCredential)
              -> Result<Box<dyn ConnectorAdapter>, ConnectorError>;
  - `pub fn build_default_registry() -> ConnectorRegistry` added.
    Registers "resend-email" -> resend_email::factory.
  - test_factory helper updated to match the new signature.
  - Two new tests: build_default_registry_contains_resend,
    default_registry_returns_none_for_unknown.

Modified file: shared/src/connectors/resend_email.rs.

  - `use crate::connectors::http_reqwest::ReqwestHttpClient;`
  - Two new free functions:
      pub fn factory(credential) -> Result<Box<dyn
          ConnectorAdapter>, ConnectorError>
        Constructs the adapter with a real ReqwestHttpClient.
      pub fn factory_with_http(credential, http) -> Result<Box<dyn
          ConnectorAdapter>, ConnectorError>
        Constructs the adapter with a caller-supplied HttpClient.
        Used by tests and by any caller that controls transport.
  - Two new tests: factory_with_http_succeeds_on_valid_credential,
    factory_with_http_propagates_constructor_error.

Modified file: GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md.

  - Section 7.4 AdapterFactory signature updated. Dated amendment
    note added. This is the first spec amendment applied in place
    since Phase 0's A2 amendment.

Tests: 7 new (3 in http_reqwest, 2 in mod, 2 in resend_email).
gorka_shared lib is now at 25 tests total.

---

## Verification at 9ed9fda

  cargo build --workspace   green. Pre-existing warnings only:
                            gorka-agent 2, gorka-client 3.
                            Unchanged from Phase 2.
  cargo test --workspace    all pass. gorka_shared lib: 25 (7 new).
                            enrollment 6/6; sync 9/9 (V6 included);
                            sync_engine 1/1; sync_pipeline 6/6;
                            sync_session 2/2; sync_wire_roundtrip
                            15/15.
  node verify/index.mjs     9/9 PASS.

---

## What Phase 3 did not do

  - No Tauri command. No credential source exists yet on the
    local device.
  - No local_connectors table. That is CONNECTOR-MODEL.md Section
    14 A3; an amendment to LOCAL-TABLES.md is required before it
    exists.
  - No live Resend API call in the test suite. The
    ReqwestHttpClient tests hit http://127.0.0.1:1 (a closed
    port), and the adapter tests use MockHttpClient.
  - No Mocean adapter.
  - No new dependency. reqwest (with blocking) was already in
    shared/Cargo.toml.

---

## Where we go next

Phase 4 candidates, in dependency order:

  1. LOCAL-TABLES.md amendment (CONNECTOR-MODEL.md Section 14 A3)
     adding local_connectors and compliance_rules tables. This is
     a hard blocker for Phase 5 (credential write path) and Phase
     7 (compliance page). It is a spec-only slice, like Phase 3's
     Section 7.4 amendment.

  2. Client Dashboard Connectors.tsx alignment (CONNECTOR-MODEL
     Section 14.2 B1, B2). Frontend only. No local table needed.

  3. Tier 2 credential local write path (Section 14.2 B3). Needs
     local_connectors (item 1 above).

Full connector arc, still on the numbering from the plan the
founder adopted after Phase 1:

  Phase 4 = Connectors.tsx alignment; Phase 5 = Tier 2 credential
  local write; Phase 6 = Zone 3 audit record; Phase 7 = compliance
  rules page; Phase 8 = agent send command; ... Phase 15 =
  acceptance.

---

## Known loose ends

Build warnings (pre-existing, not from Phase 3):

  - shared/src/db.rs:4 -- unused import
    `use serde_json::Value as JsonValue;`
  - shared/tests/sync_engine.rs:92 -- `let mut conn_b_test` does
    not need `mut`.
  Both predate Phase 1. Small cleanup slice candidate.

Documentation:

  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale: they describe the created_by defect as open, but
    Phase 0 applied the A2 amendment and recomputed V6 to the
    109-byte payload. Cosmetic. A proper fix runs through the
    amendment process.

  - SYNC-TEST-VECTORS-v1.md header note is stale: it describes V6
    as PENDING. The V6 entry and summary table correctly say
    FROZEN. Cosmetic.

Code:

  - No JWT decode. user_id comes from the login response and is
    persisted to settings.dat at login. Design choice.

  - The /api/auth/login response contract is load-bearing for the
    local store. No backend-side test guards it, and no local
    check refuses to originate when user_id is empty.

  - The logout blocks in both binaries do not delete the user_id
    key. Cosmetic.

Environment:

  - Cloud has 8 untracked junk files from an earlier slice:
    b7-meta-check.cjs, build-6b2b-listener.txt, build-6b2b.txt,
    check-columns.ts, relay-check.cjs, test-6b2b-listener.txt,
    test-6b2b.txt, test-output.txt.

  - .env files in the repo contain live credentials. Rotation is
    deferred until pre-launch. Recorded so pre-launch work
    includes rotating every key and moving them out of the repo.

  - Resend sending: for a live test_connection call from Phase 4+
    onward, a @gmail.com from-address will be rejected by Resend.
    Either verify a domain or use onboarding@resend.dev.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot reliably
  compile (SAC blocks build-script binaries at unpredictable
  points).
- One machine owns a slice at a time. Git is the only handoff.
- Edits on main. Commit on main, push, pull on cloud, build and
  test and verify on cloud, pull back on main.
- For any scripted edit to a recovery document or source file:
  use content anchors (FindUnique returns exactly one match or
  throws). Never use raw line indices. Never use String.Replace
  on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
- Read UTF-8 files as UTF-8, never as ANSI. Emoji in source
  files will be silently corrupted otherwise. For single-line
  edits on files that contain non-ASCII characters, edit by
  hand in a text editor instead of scripting.
- git diff <file> after every edit before moving on. Fastest
  proof of a clean write.
- Match tool weight to edit size. Heavy machinery for multi-
  file, multi-anchor edits. Notepad for one-liners.
- One commit per coherent change.
- No guessing. Every fact confirmed on disk before the script
  is written.
- When in doubt, stop and ask the founder.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.
Nothing else is needed.

At slice end: rewrite it with the new state. This file is
rewritten in place, not appended to. It stays under 250 lines.

If the chat dies unexpectedly: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md