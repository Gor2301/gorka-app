# RESUME HERE

**Updated:** 2026-10-07 (Connector catalog gained mvpStatus flag. Resend is LIVE, other four COMING_SOON. All green.)
**Main machine:** 5d1a63c
**Cloud machine:** 5d1a63c (last verified green)
**GitHub:** 5d1a63c

---

## Where we are

Phase 5 is closed. The connector catalog now carries an
mvpStatus flag that gates the UI: a LIVE row shows an active
Connect button; a COMING_SOON row shows a disabled Coming soon
button. Only resend-email is LIVE today; twilio-sms,
twilio-voice, mocean-sms, and gemini-ai are COMING_SOON.

This was added because the Connectors page, as rewritten in
Phase 5b, derived its button from isManagedByGorka alone. All
five catalog rows are isManagedByGorka = true. Without the
mvpStatus gate, clicking Connect on a connector with no adapter
wrote a CONNECTED row for something that cannot send. That was
the defect this commit fixes.

Relevant commits, in order:

  5d1a63c  Connector catalog: add mvpStatus flag (LIVE /
           COMING_SOON)
  d13ca82  RESUME-HERE.md: Phase 5 closed
  68e775e  Phase 5b: align Connectors.tsx to actual backend
           endpoints (B1, B2)
  62d332f  Phase 5a: CONNECTOR event wire encoders and decoders
  8c88d0a  RESUME-HERE.md: Phase 4 closed.
  115796d  Phase 4: migration 9 adds local_connectors,
           connector_usage, connector_sync_state,
           compliance_rules

Earlier phase commits, still in history:

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

## What Phase 5 delivered

Three commits build on each other.

**62d332f (5a).** Rust wire encoders and decoders for the three
CONNECTOR event types (SYNC-ARCHITECTURE.md Sections 25.14 to
25.16). Entity type 0x06.

  shared/src/sync.rs         encode_bytes_value,
                             encode_connector_enabled_payload,
                             encode_connector_disabled_payload,
                             encode_connector_credential_replaced_payload
  shared/src/sync_parse.rs   decode_bytes_value, three payload
                             structs, three parsers
  shared/tests/sync_wire_roundtrip.rs
                             four new round-trip tests.
                             Test count 15 -> 19.

No deterministic hex vectors. Round-trip tests only.

**68e775e (5b).** Aligned the Client Dashboard Connectors page
to the backend that exists.

  src/backend/routes/connectors.routes.ts
                             + GET /api/connectors/catalog
  connectors.service.ts      full rewrite. listCatalog,
                             listEnablements, enable, disable.
  Connectors.tsx             full rewrite. Reads catalog +
                             enablements, merges by code.
  ConfigurationModal.tsx     full rewrite. Five VITE_* reads
                             removed. Now orphaned; kept for B3.

**5d1a63c (mvpStatus).** Added the LIVE/COMING_SOON gate.

  prisma/schema.cloud.prisma        + mvpStatus String @default("COMING_SOON")
  prisma/seed-connectors.ts         each row sets its value;
                                    update block updated
  connectors.service.ts             CatalogEntry gains
                                    mvpStatus
  Connectors.tsx                    if COMING_SOON, render
                                    disabled "Coming soon"

---

## Verification at 5d1a63c (cloud)

  cargo build --workspace   green. Warnings unchanged from
                            Phase 4 baseline: gorka-agent 2,
                            gorka-client 3, gorka-shared 6.
  cargo test --workspace    72 tests, 0 failed.
  node verify/index.mjs     9/9 PASS.
  npm run build             green, 661.06 kB bundle.
  prisma db push --schema=prisma\schema.cloud.prisma
                            column added, no drops.
  seed re-run               five rows seeded.
  DB row check              resend-email LIVE, other four
                            COMING_SOON.
  Bundle contains
    "Coming soon"           yes.
    "mvpStatus"             yes.
    VITE_* reads            none.
    old endpoints           none.

Important: `npx prisma db push` defaults to `prisma/schema.prisma`,
which is a stale file and produces a diff that drops every cloud
table. Always pass `--schema=prisma\schema.cloud.prisma` (or
`schema.cloud.prisma` if cwd is prisma/) and use the pooler
DATABASE_URL override. The direct Supabase hostname does not
resolve from AWS Singapore.

Pooler URL used:

  postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka_test

---

## Trip A — what was planned, what was done

Trip A originally bundled four slices: mvpStatus, B4b,
5a-vectors, B7-static.

Done:

  mvpStatus                 shipped and verified.

Not done (recorded, deferred):

  B4b (Zone 3 docs note)    Docs-only. Zone 3 has no trigger
                            today: no external_api catalog row
                            exists, and no live code path opens
                            DeclarationModal. Reopens when the
                            Connection Center adds a generic-API
                            connector.

  5a-vectors                Deterministic hex vectors for the
                            three connector events. Test-only,
                            no source change. Needs a two-phase
                            cloud build (encode -> capture hex ->
                            freeze assertions -> verify).

  B7-static                 Backend logging review note.
                            Docs-only.

None of the three affects the Communication Center UI. They
were deferred to spend the remaining session time on the
mvpStatus defect fix, which does.

---

## What is not built yet (Phase 5 scope reminders)

  - No local_connectors write from the frontend. The Tier 2
    Configure path is disabled because B3 does not exist.
  - No B3 Tauri command for local credential write. Next slice.
  - No Zone 3 audit record write. B4b above records this as
    not applicable in the current catalog.
  - No local compliance rules page. B5, B6.
  - No backend provider provisioning. POST /connectors/enable
    still only writes a client_connectors row.
  - No adapters for twilio-sms, twilio-voice, mocean-sms,
    gemini-ai. Resend is the only adapter that exists.

---

## Adaptors vs catalog rows (working note)

A catalog row makes a connector appear in the UI. An adaptor
is the Rust code that makes it work. The catalog is dynamic;
the UI reads it from GET /api/connectors/catalog. Adding a
row is a data edit (one object in the seed array, no code
change). Adding an adaptor is a code slice.

The future Connection Center (CONNECTOR-MODEL.md N1) will let
one generic adaptor serve many providers via configuration.
Until then, one adaptor per provider.

---

## Where we go next (candidate order)

  1. B3. Local Tauri command to write a credential into
     local_connectors. Wire ConfigurationModal to it. Flip
     the Tier 2 Configure button to active. Needs a shared
     db.rs function or a new shared module.

  2. B4b, B7-static. Docs-only. Can be folded into any
     session.

  3. 5a-vectors. Two-phase cloud build.

  4. First real adapter slice after B3: twilio-sms is the
     natural next. Then flip its mvpStatus to LIVE.

Full connector arc (CONNECTOR-MODEL.md Section 14):

  Phase 5 (this)  = connector events + Connectors.tsx + mvpStatus
  Phase 6         = Zone 3 audit record
  Phase 7         = compliance rules page
  Phase 8         = agent send command
  ...
  Phase 15        = acceptance

---

## Known loose ends

Build warnings (pre-existing, not from Phase 5):

  - shared/src/db.rs:4 -- unused import
    `use serde_json::Value as JsonValue;`
  - shared/tests/sync_engine.rs:92 -- `let mut conn_b_test`
    does not need `mut`.
  Both predate Phase 1.

Documentation:

  - CONNECTOR-MODEL.md Section 3.3 still says Mocean and Gemini
    are isManagedByGorka = false. The DB and the seed have all
    five rows true. The spec will be revised when the connector
    model is revised. Do not amend now.
  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale: they describe the created_by defect as open.
  - SYNC-TEST-VECTORS-v1.md header says V6 is PENDING. The V6
    entry and summary table correctly say FROZEN.
  - LOCAL-TABLES.md B.2 and B.3 have a source line "Connector
    addendum" rather than a section reference.

Code:

  - No JWT decode. user_id from login response. Persisted at
    login.
  - /api/auth/login response contract is load-bearing. No
    backend test guards it.
  - Logout does not delete user_id key.
  - V6 vector: created_by is now part of the spec
    (SYNC-ARCHITECTURE.md v1.5, TLV 0x5006). Rust and Node
    implementations were not recomputed. V6 is frozen at its
    pre-amendment value.

Environment:

  - Cloud has untracked scratch files from earlier slices
    (b7-meta-check.cjs, build-6b2b-listener.txt,
    build-6b2b.txt, check-columns.ts, relay-check.cjs,
    test-6b2b-listener.txt, test-6b2b.txt, test-output.txt).
  - .env and .env.test contain live credentials including a
    Resend API key and a Gemini API key. Rotation deferred to
    pre-launch by founder decision.
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
  file: use content anchors. Never raw line indices. Never
  String.Replace on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
- Read UTF-8 files as UTF-8. Non-ASCII in source files will
  be silently corrupted otherwise.
- PowerShell here-strings: leave a blank line before the
  closing '@ or the next line merges with the last. This
  bit us in 5a.
- npx prisma db push always needs --schema=prisma\schema.cloud.prisma
  plus the pooler DATABASE_URL override. Default schema file
  is stale.
- git diff <file> after every edit before moving on.
- Match tool weight to edit size.
- One commit per coherent change.
- No guessing. Every fact confirmed on disk before the
  script is written.
- When in doubt, stop and ask the founder.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.

At slice end: rewrite it with the new state. Rewritten in
place, not appended to. Kept under 250 lines.

If the chat dies unexpectedly: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md