# START HERE

Version: 1.2
Date: September 21, 2026

Purpose: Single entry point for any new session — human or AI —
working on GORKA recovery.

Authority: This document tells you what to read and in what
order. It does not replace the other documents. They are the
constitution; this is the index.

========================================================================

0. IF YOU ARE STARTING COLD, READ THIS FIRST

========================================================================

You are continuing the GORKA recovery. This project has been
in progress since September 11, 2026. Prior sessions have
produced a large body of documents, code, and decisions. You
have no memory of them. Everything you need is on disk.

Do not improvise. Do not redesign. Do not question the
architecture. The prior sessions already did all of that, and
their conclusions are written down. Your job is to read them,
understand them, and continue the work in the sequence laid out
in PHASE-PLAN.md.

The single most important sentence in this entire project:

> No individual debtor information is stored in GORKA cloud
> infrastructure.

Everything else depends on that sentence.

========================================================================

1. THE PROJECT, IN ONE PARAGRAPH

========================================================================

GORKA is a debt-collection platform for agencies. It has two
data planes:

- A cloud control plane (Supabase PostgreSQL) holding customer
  accounts, licenses, billing, aggregates, support, and
  connector metadata.
- A local data plane (Tauri desktop app, SQLite + SQLCipher)
  holding all debtor data.

The two planes never merge. Debtor data never leaves the client's
machines. The cloud sees only counts, sums, and business
metadata.

There are three roles: OWNER (platform founder), CLIENT
(agency admin), AGENT (agency staff, future Agent App).

GORKA runs as:
- A Tauri desktop app (the Client Dashboard), source at
  `supervisor-dashboard/src/`.
- A web Owner Dashboard (owner-dashboard/).
- An Express backend API (src/backend/).
- A Prisma-managed Supabase cloud database.
- A separate Tauri desktop app (the Agent App) — planned, not
  yet built. See MULTI-USER-CONCEPT.md.

========================================================================

2. THE INVARIANT

========================================================================

> No individual debtor information is stored in GORKA cloud
> infrastructure.

This is not a feature. It is not a policy. It is the
architectural invariant everything else depends on.

It may NEVER be amended. If it needs to change, GORKA becomes a
different product.

What may live in cloud:
- Customer/agency data (business identity, contacts).
- User authentication and profiles.
- Aggregate metrics (debtor_count, total_debt — numbers only).
- Client behavioral metrics (counts of uploads, deletions, etc.).
- Support tickets (with PII warning enforced in UI).
- Cloud audit logs (customer-level actions only).
- Boundary proof logs (proof no debtor data crossed).
- Connector catalog and enablement metadata.
- Connector usage aggregates (counts, not per-debtor).
- Parameterized message templates ({{debtor_name}}, {{amount}}).
- Control Plane connection metadata (device registration,
  presence, relay session metadata — see ARCHITECTURAL-LAW.md
  v1.2 Section 20).
- Encrypted sync payloads in transit through the relay
  (unreadable by GORKA; never stored).

What may NEVER live in cloud (local only):
- Debtor names, surnames, phones, emails, addresses.
- Debtor IDs in any form — not even as metadata.
- Individual debt amounts, dates, payment history.
- Message content (SMS, email bodies).
- Individual action content or assignments.
- Documents or filenames.
- AI prompts or responses containing debtor info.
- Rendered personalized messages.

If you are ever unsure about a specific piece of data, the
answer is: find it in DATA-BOUNDARY-MATRIX.md. If it is not
there, add it there first. Do not guess.

========================================================================

3. THE ORDER TO READ THE DOCUMENTS

========================================================================

All documents live in:

    C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\

Read them in this order. Do not skip.

## First — the ground rules

1.  ARCHITECTURAL-LAW.md
    The constitution. The invariant, definitions, the two data
    planes, the rule for every decision. Now at v1.3 with the
    multi-user amendment (Section 20) and the three-zones
    amendment (Section 21).

2.  ARCHITECTURAL-LAW-AMENDMENTS.md
    Versioned changes to the law. Includes behavioral metrics,
    templates boundary, boundary proof logging, support PII
    protection, role definitions, connector categories, zero
    production SQL, and the v1.2 multi-user amendment.

3.  MULTI-USER-CONCEPT.md
    The multi-user data model. Version 2.0, frozen. Defines
    the Control Plane and the Data Plane, the sync model, the
    canonical promise, hub-and-spoke MVP topology, mesh
    production topology, and the full plan. This document
    extends ARCHITECTURAL-LAW.md v1.2 and is the source of
    truth for the multi-user model. Read it after the law
    amendments and before RECOVERY-RULES.md.

4.  RECOVERY-RULES.md
    The 14 permanent rules. Read all of them. The most
    important ones:
    - Rule 1: Do not modify production to make a test pass.
    - Rule 3: Do not add a debtor model to the cloud schema.
    - Rule 8: Do not assume external providers support
      GORKA-issued temporary credentials.
    - Rule 10: Do not use prisma db push against production.
    - Rule 11: Do not fix schema mismatches by adding random
      columns.
    - Rule 12: Do not touch the working Tauri CI/CD.
    - Rule 14: Do not let a failing test cause you to question
      the architecture.
    Also: Zero Production SQL between Phase 2 and Phase 17.

5.  DATA-BOUNDARY-MATRIX.md
    Every data type and whether it lives in cloud or local.
    Section 20 (added September 17, 2026) covers the multi-user
    data types. Use this before storing any new data.

## Second — the operational documents

6.  PHASE-PLAN.md
    The full 0-18 phase plan, now including Phases 9.5, 9.6,
    and 9.7. Read this to know where you are. The summary
    table at the bottom shows the status of every phase.

7.  CLOUD-TABLES.md
    The 21 cloud tables with the four-question contract for
    each. Section 20 (added September 17, 2026) covers
    `device_registrations` and `relay_sessions`. Never add a
    cloud table without updating this.

8.  LOCAL-TABLES.md
    The 15 local tables (target state). Category D (added
    September 17, 2026) covers `sync_events`, `sync_state`,
    and `sync_peers`.

9.  CONNECTOR-LIFECYCLE.md
    The permanent rule and process for how connectors are
    assessed, added, replaced, and retired. Two tiers:
    GORKA-managed and Client BYO.

## Third — the records

10. DECISIONS.md
    Every decision made in every prior session. This is the
    largest document. Read the section headers to get a
    picture. Read the most recent entries in full — especially
    the "Multi-User Data Model — September 17, 2026" entry.

11. HANDOFF.md
    Status updates appended at the end of every session.

12. SESSION-LOG.md
    Chronological record of the recovery.

13. PRODUCTION-REBUILD-PLAN.md
    The Phase 17 cutover plan. Do not execute until Phase 17.

## Fourth — the operational reference

14. TAURI-DEV-WORKFLOW.md
    CRITICAL. This machine has Windows Application Control
    (WDAC) enforced. Newly built unsigned binaries are blocked.
    A self-signed certificate is set up, and every Rust build
    must be signed before running. `npm run tauri:dev` no
    longer works. Read this document before touching anything
    in `src-tauri/`.

    Additional context: Smart App Control (SAC) on the main
    machine blocks the signed binary even after signing. See
    the September 15 SAC investigation entry in DECISIONS.md.
    A cloud Windows environment is the chosen workaround, not
    yet set up.

15. FRONTEND-REALITY.md
    Where the Tauri frontend actually lives, what exists, what
    is missing.

16. BOUNDARY-TEST-PLAN.md
    The manual and automated boundary tests. The static portion
    is done. Runtime tests depend on the Tauri frontend
    existing.

17. GORKA-MVP-SCOPE.md
    The MVP defined in full. Version 1.1, frozen. Every block,
    every constraint, every out-of-scope item, and the
    acceptance criteria. Read it before SYNC-ARCHITECTURE.md.

18. SYNC-ARCHITECTURE.md
    The technical specification of the sync engine. Version
    1.2, complete. Thirty sections. Defines the exact wire
    format, the exact ordering rule, the exact reconciliation
    rule, and the exact sync state machine. Read after
    GORKA-MVP-SCOPE.md.

19. THREAT-MODEL.md
    The threat model. Version 1.0, frozen and audited. Nine
    residual risks (R1–R9) accepted by the founder.

========================================================================

4. WHERE EVERYTHING LIVES ON DISK

========================================================================

## Recovery documentation

    C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\
    (16 .md files — the constitution and the records)

## Specs

    C:\Users\kucha\gorka-app\GORKA_RECOVERY\specs\
      Tauri-v3.2\
      Migration-v5.0\
      Core-v2.0\

## Backups

    C:\Users\kucha\gorka-app\GORKA_RECOVERY\backups\

## Source code

    C:\Users\kucha\gorka-app\
      prisma/                    Cloud schema and seeds
        schema.cloud.prisma      19 cloud models
        seed-connectors.ts       5 connectors
        seed-plans.ts            3 subscription tiers
        seed.ts                  STALE — do not run
      src/backend/               Express backend
        index.ts                 Route mounting
        db.ts                    Shared Prisma instance
        middleware/auth.ts       JWT middleware
        routes/                  Route files
      src-tauri/                 Tauri Rust (Client Dashboard)
        src/main.rs              All commands
        src/db.rs                SQLCipher schema and migrations
        src/auth.rs              Login, salt, token storage
        tauri.conf.json          Tauri config
        Cargo.toml               Rust deps
      supervisor-dashboard/      Client Dashboard frontend
      owner-dashboard/           Web Owner Dashboard
      gorka-supervisor-web/      (unclear; likely old)
      super-admin-web/           (unclear; likely old)
      renderer/                  (Electron-era; ignore)
      dist/                      Built Tauri frontend (generated)
      src/frontend/              (Electron-era; ignore)
      src/renderer/              (Electron-era; ignore)

## Databases

    gorka_test (Supabase):
      postgresql://postgres:gorka2026saas@db.tmloklxelckicufzpzxz.supabase.co:5432/gorka_test

    production (Supabase, FROZEN until Phase 17):
      postgresql://postgres:gorka2026saas@db.tmloklxelckicufzpzxz.supabase.co:5432/postgres

    Local Tauri DB:
      C:\Users\kucha\AppData\Roaming\gorka\client\data\gorka-client.db
      (encrypted with SQLCipher; key derived from local password + salt)

    Tauri store (token, salt, org id):
      C:\Users\kucha\AppData\Roaming\com.gorka.client\settings.dat

========================================================================

5. HOW TO START THE BACKEND

========================================================================

The backend's `.env` points at production. Do NOT rely on it.
Always start the backend with an inline override that wins:

    cd C:\Users\kucha\gorka-app && set DATABASE_URL=postgresql://postgres:gorka2026saas@db.tmloklxelckicufzpzxz.supabase.co:5432/gorka_test && npx tsx src/backend/index.ts

Wait for:
    🚀 Express server running on http://localhost:3000
    ✅ PostgreSQL connected successfully

Never start it with plain `npx tsx src/backend/index.ts`.

========================================================================

6. HOW TO RUN THE TAURI APP (WDAC WORKAROUND)

========================================================================

CRITICAL. This machine has WDAC enforced. Newly built unsigned
binaries are blocked. `npm run tauri:dev` no longer works.

Additional: Smart App Control (SAC) blocks the signed binary
on this machine even after signing. The current chosen
workaround is a cloud Windows environment (not yet set up). See
the September 15 SAC investigation entry in DECISIONS.md.

Full instructions in TAURI-DEV-WORKFLOW.md. Short version:

## For frontend-only changes

1. Terminal A: `cd C:\Users\kucha\gorka-app && npm run dev`
  (Vite on 5173, stays running)
2. Terminal B: run the already-signed binary:
  `C:\Users\kucha\gorka-app\src-tauri\target\debug\gorka-client.exe`

No re-signing needed.

## For Rust changes

1. Terminal A: `npm run dev`
2. Terminal B: `cd C:\Users\kucha\gorka-app\src-tauri && cargo build`
3. Sign the binary:
  powershell -Command "Set-AuthenticodeSignature -FilePath 'C:\Users\kucha\gorka-app\src-tauri\target\debug\gorka-client.exe' -Certificate (Get-ChildItem Cert:\CurrentUser\My\370532F494A44A0B46E789D40649B26A13096FDB)"
4. Run it:
  `C:\Users\kucha\gorka-app\src-tauri\target\debug\gorka-client.exe`

Expected signature status: Valid. Expected execution: blocked
by SAC on this machine. Use the cloud environment instead.

========================================================================

7. THE 14 RECOVERY RULES (SHORT FORM)

========================================================================

1.  Do not modify production to make a test pass.
2.  Do not add a cloud table because a backend route expects it.
3.  Do not add a debtor model to the cloud Prisma schema.
4.  Do not put a foreign key to debtors in any cloud table.
5.  Do not send debtor IDs as metadata.
6.  Do not put personalized messages into cloud templates.
7.  Do not put debtor info into support tickets.
8.  Do not assume an external provider supports GORKA-issued
    temporary credentials.
9.  Do not mix local SQLite models into the cloud Prisma schema.
10. Do not use prisma db push against production during
    development.
11. Do not fix schema mismatches by adding random columns.
12. Do not touch the working Tauri CI/CD pipeline without
    specific need.
13. Do not start Phase 13-14 connectors while Phases 3-12 are
    unstable.
14. Do not let a failing test cause us to question the
    architecture.

Zero Production SQL between Phase 2 and Phase 17.

When a test fails, debug down the chain:

    Architecture
         |
    Specification
         |
    Schema
         |
    Backend
         |
    Test

Find the level where the failure originates. Fix at that
level. Do NOT change the architecture.

========================================================================

8. CURRENT STATE — September 21, 2026

========================================================================

## Phases complete

- Phase 0 through 8: COMPLETE.
- Phase 9: PARTIAL.
- Phase 9.5: NOT STARTED.
- Phase 9.6: NOT STARTED.
- Phase 9.7: NOT STARTED.
- Phase 10: COMPLETE.
- Phase 11: COMPLETE.
- Phase 12: COMPLETE.
- Phase 13: COMPLETE.
- Phase 14: COMPLETE.
- Phase 14.5: COMPLETE.
- Phase 15: PARTIAL.
- Phases 16-18: NOT STARTED.

## Phase 9 detail

Item 1 (document upload): DONE.
Item 1b (debtor detail page at /collections/:id): DONE.
Item 2 (debt CRUD): DONE.
Item 3 (communication logging): DONE.
Item 4 (action CRUD): CODE COMPLETE, not yet tested. Rust
commands and local schema migration v3 are compiled into the
signed binary. Frontend code is written. Testing is blocked by
the SAC enforcement on the main development machine (see the
September 15 entry in DECISIONS.md).

## Phases 9.5, 9.6, 9.7 detail (NEW — September 17, 2026)

These three phases were added to the plan on September 17, 2026,
after the multi-user data model was decided and frozen. They
are the work stream that implements multi-user sync.

- Phase 9.5 — Agent App and Client Dashboard, local only.
  Both binaries exist as separate Tauri apps, both work against
  their own local SQLCipher databases, no sync yet.

- Phase 9.6 — Sync engine, MVP scope. Hub-and-spoke topology.
  Event-based. Direct connection with encrypted relay
  fallback. Single organization key. Ten acceptance criteria,
  listed in PHASE-PLAN.md.

- Phase 9.7 — Multi-user demonstration. Two laptops, real
  sync, rehearsed, with a backup video.

All three are NOT STARTED. They cannot begin until
SYNC-ARCHITECTURE.md and GORKA-MVP-SCOPE.md are written.

## Phase 15 detail

Static boundary review: DONE.
Runtime boundary tests: DEFERRED pending the Tauri frontend.
See BOUNDARY-TEST-PLAN.md.

## The multi-user model

The multi-user data model was decided and frozen on September
17, 2026. The source of truth is MULTI-USER-CONCEPT.md,
Version 2.0. The key points:

- Model B adopted: direct machine-to-machine sync, brokered by
  GORKA. Model A (GORKA cloud as the sync relay) was rejected.
- MVP topology: hub-and-spoke. Production topology: mesh.
- Sync is event-based from the beginning. The application audit
  log is separate from the sync protocol's change history.
- Key management: the client controls authorization; GORKA
  provides the mechanism and never holds the decryption keys.
- The canonical promise was reworded: "GORKA cannot decrypt
  your debtor data." The old formulation "debtor data never
  touches our servers" was rejected as technically
  indefensible, because a relay is sometimes required.

The following documents were amended to bring them into
alignment: ARCHITECTURAL-LAW.md (v1.2), ARCHITECTURAL-LAW-
AMENDMENTS.md (v1.2 entry), DATA-BOUNDARY-MATRIX.md (Section
20), PHASE-PLAN.md (v1.1, three new phases), LOCAL-TABLES.md
(Category D, three new tables), CLOUD-TABLES.md (Section 20,
two new tables), DECISIONS.md (long entry), HANDOFF.md
(status update).

## What is on disk that is new (September 17)

- GORKA_RECOVERY/recovery-notes/MULTI-USER-CONCEPT.md (new,
  Version 2.0, frozen)

## What must be written next

Before any multi-user implementation begins:

1. SYNC-ARCHITECTURE.md — the technical specification of the
   sync engine. Must answer every open design question,
   including what "most recent" means without depending on
   wall-clock time.
2. GORKA-MVP-SCOPE.md — the MVP defined in full. Every block,
   every constraint, every out-of-scope item.
3. Threat model / security review — three to five pages.

Only after all three are written and approved does
implementation begin.

## Update — September 21, 2026

All three documents are now written.

- GORKA-MVP-SCOPE.md — v1.1, frozen. September 18, 2026.
- SYNC-ARCHITECTURE.md — v1.2, complete. Section 22 completed
  by restoration on September 20–21, 2026. Block C applied.
  Header bumped to v1.2.
- THREAT-MODEL.md — v1.0, frozen and audited.

The document prerequisites are met. What remains is:

- Argon2id parameters in SYNC-ARCHITECTURE.md §7.3 and
  §22.19.2, benchmarked on the supported GORKA desktop
  environment. Blocks E1's deterministic bytes.
- SYNC-TEST-VECTORS-v1.md — compute the five SPECIFIED vectors
  (M1, M2, V1, V4, V6) and the four BLOCKED vectors once the
  parameters are frozen.
- V2 Cloud Windows environment. Not yet set up. Blocks the
  build and blocks vector computation.
- MVP sync engine implementation. After all of the above.

Phase 9 Item 4 (Action CRUD) remains code complete, not yet
tested, blocked by the same cloud environment dependency.

========================================================================

9. HOW TO HANDLE A NEW QUESTION OR FEATURE REQUEST

========================================================================

Before acting, ask yourself:

1. Is this cloud or local?
2. If cloud: does it contain or reference an individual debtor?
3. If yes: it belongs local. Do not add to cloud.
4. If no: cloud is possible.
5. If unsure: STOP. Ask the founder. Document the decision.

NEVER make a schema change to satisfy an error without first
checking the rules.

========================================================================

10. KNOWN ISSUES AND DEFERRED ITEMS

========================================================================

- UnlockScreen shows "Set" instead of "Enter" on some restarts.
  Root cause: salt written during login() in auth.rs rather
  than during set-password. Fix deferred until the whole
  registration flow is designed.
- Owner Dashboard calls many endpoints that do not exist
  (/clients, /analytics/overview, /audit, /billing/revenue,
  /analytics/usage, /status). Pre-existing. Separate future
  phase.
- prisma/seed.ts is stale (references a removed PermissionRole
  model). Do not run.
- Two Prisma instantiation conventions in the backend (shared
  db.ts instance and local new PrismaClient()). Harmonization
  deferred.
- support.routes.ts uses stale role PLATFORM_OWNER in three
  endpoints, has a hardcoded placeholder id, and imports from
  '../database'. Not fixed.
- Phase 15's static review missed the frontend services layer.
  Future boundary reviews must include
  supervisor-dashboard/src/services/.
- Template.content parameterization is not enforced at the DB
  level. UI/API enforcement deferred.
- SAC (Smart App Control) blocks the signed binary on the main
  development machine. A cloud Windows environment is the
  chosen workaround, not yet set up. See the September 15
  entry in DECISIONS.md.
- Phase 9 Item 4 (action CRUD) is code complete but not yet
  tested, for the same SAC reason.
- The multi-user model is frozen in concept form, but
  SYNC-ARCHITECTURE.md and GORKA-MVP-SCOPE.md are not yet
  written. Implementation is blocked until they are.

========================================================================

11. IF YOU ARE AN AI STARTING A NEW SESSION

========================================================================

You will be tempted to:

- Suggest improvements.
- Propose redesigns.
- Recommend upgrades.
- Question the architecture.
- Start work without reading the documents.

Do not do any of those things.

The correct first message from the human will be:

    "Read GORKA_RECOVERY/recovery-notes/START-HERE.md and
    follow it."

If it is not, ask for it. Then:

1. Read the 16 documents in Section 3, in the order given.
2. Confirm in one short message that you understand:
   - The invariant.
   - The multi-user model.
   - Which phases are complete.
   - Which is the next phase.
   - The current operational workarounds (backend inline URL,
     Tauri signing workflow, SAC block and cloud workaround).
3. Do not propose anything until asked.
4. When asked to act, act one step at a time: one command,
   one paste, one result.
5. When something is unclear, go back to the files, not to
   your intuition. THE FILES WIN.

========================================================================

12. THE SENTENCE THAT MATTERS MOST

========================================================================

If you remember nothing else from this document:

> No individual debtor information is stored in GORKA cloud
> infrastructure.

That is the whole project in one line. Everything else is
implementation.

========================================================================

END OF DOCUMENT

========================================================================