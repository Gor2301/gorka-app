# RESUME HERE

**Updated:** 2026-10-07 (Phase 4 closed: migration 9 adds the connector and compliance tables. All green.)
**Main machine:** 115796d
**Cloud machine:** 115796d
**GitHub:** 115796d

---

## Where we are

Phase 4 is closed. The local SQLite schema now contains the four
tables that LOCAL-TABLES.md already specified but the runtime DDL
never created: local_connectors, local_connector_usage,
connector_sync_state, compliance_rules. Cloud build, workspace
tests, and node verify are green.

Reconnaissance at the start of Phase 4 found the actual gap: A3
had been applied at the spec level last session, but the code that
creates those tables was never written. No Rust source referenced
either table. So Phase 4 was not an amendment slice; it was a
migration slice.

Relevant commits, in order:

  115796d  Phase 4: migration 9 adds local_connectors,
           connector_usage, connector_sync_state,
           compliance_rules

Prior phase commits, still in history:

  60974bc  RESUME-HERE.md: Phase 3 closed.
  9ed9fda  Phase 3: test_factory returns Result to match fallible
           AdapterFactory
  c287e7b  Phase 3: real HttpClient, fallible AdapterFactory,
           default registry
  f1aa4ab  RESUME-HERE.md: Phase 2 closed.
  585261e  Phase 2: test helper avoids Debug requirement on adapter
  7271146  Phase 2: Resend email adapter with HttpClient abstraction
  1b9066c  RESUME-HERE.md: Phase 1 closed.
  ea8fb49  Phase 1: gorka-shared::connectors skeleton
  221a771  RESUME-HERE.md: Phase 0 closed.
  dcfe858  Phase 0 build fixes.

---

## What Phase 4 delivered

Modified file: shared/src/db.rs.

  - One new migration block: `if current_version < 9 { ... }`,
    inserted between migration 8's closing and the function's
    Ok(()) in run_migrations.
  - Creates local_connectors (B.1), with unique index on
    (organization_id, connector_code) and a status index.
  - Creates local_connector_usage (B.2), with FKs on debtor_id
    (debtors, ON DELETE SET NULL) and message_log_id
    (communications, ON DELETE SET NULL).
  - Creates connector_sync_state (B.3), with UNIQUE on
    connector_code.
  - Creates compliance_rules (F.1), with CHECK (id = 1) enforcing
    the single-row invariant.
  - Sets PRAGMA user_version = 9.
  - No table existing before Phase 4 was touched.

New file: shared/tests/connector_tables.rs.

  - Four integration tests:
      migration_9_creates_all_four_tables
      migration_9_creates_local_connectors_indexes
      compliance_rules_enforces_single_row
      local_connectors_accepts_a_row
  - Uses open_in_memory_for_tests() from db.rs. No new dependency.

---

## Verification at 115796d

  cargo build --workspace   green. Pre-existing warnings only:
                            gorka-agent 2, gorka-client 3.
  cargo test --workspace    all pass. gorka_shared lib: 25 (unchanged
                            from Phase 3). New integration test
                            connector_tables: 4/4. enrollment 6/6;
                            sync 9/9 (V6 included); sync_engine 1/1;
                            sync_pipeline 6/6; sync_session 2/2;
                            sync_wire_roundtrip 15/15.
  node verify/index.mjs     9/9 PASS.

---

## What Phase 4 did not do

  - No Tauri command. No frontend.
  - No sync event types for connector changes. Those need an
    amendment to SYNC-ARCHITECTURE.md (CONNECTOR-MODEL.md Section
    14 A1). That amendment has been applied already (commit
    2273396 per the earlier "mechanism is live" summary), but the
    Rust wire encoder/decoder for the three new event types does
    not exist yet.
  - No local_organization or local_user tables. Those are spec'd
    (LOCAL-TABLES.md C.1, C.2) but out of scope for Phase 4.
  - No fix of the pre-existing db.rs:4 unused-import warning.

---

## Where we go next

Phase 5 candidates, in dependency order:

  1. CONNECTOR_ENABLED / CONNECTOR_DISABLED /
     CONNECTOR_CREDENTIAL_REPLACED wire encoders and decoders in
     shared/src/sync.rs and sync_parse.rs, matching the amendment
     already applied to SYNC-ARCHITECTURE.md Sections 25.14
     through 25.16. This is the next structural piece: without
     these, no credential can travel between devices. Spec-only
     reference work first, then code.

  2. Connectors.tsx alignment (CONNECTOR-MODEL.md Section 14.2
     B1, B2). Frontend only. Self-contained but lower value.

  3. Tier 2 credential local write path (Section 14.2 B3). Now
     unblocked: local_connectors exists. Needs a Tauri command and
     the Client Dashboard form.

Full connector arc:

  Phase 5 = connector event types; Phase 6 = Zone 3 audit record;
  Phase 7 = compliance rules page; Phase 8 = agent send command;
  ... Phase 15 = acceptance. (Phase 4 absorbed the old Phase 4 and
  Phase 5 candidates; the Connectors.tsx alignment is now a
  candidate for Phase 5 alongside the event types.)

---

## Known loose ends

Build warnings (pre-existing, not from Phase 4):

  - shared/src/db.rs:4 -- unused import
    `use serde_json::Value as JsonValue;`
  - shared/tests/sync_engine.rs:92 -- `let mut conn_b_test` does
    not need `mut`.
  Both predate Phase 1. Small cleanup slice candidate.

Documentation:

  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale: they describe the created_by defect as open, but
    Phase 0 applied the A2 amendment and recomputed V6 to the
    109-byte payload. Cosmetic.

  - SYNC-TEST-VECTORS-v1.md header note is stale: it describes V6
    as PENDING. The V6 entry and summary table correctly say
    FROZEN. Cosmetic.

  - LOCAL-TABLES.md B.2 and B.3 have a source line "Connector
    addendum" rather than a section reference. Cosmetic. Its B.1
    and F.1 reference CONNECTOR-MODEL.md sections properly.

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
    deferred until pre-launch.

  - Resend live sending: a @gmail.com from-address is rejected by
    Resend. Either verify a domain or use onboarding@resend.dev
    when Phase 6+ exercises the live API.

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