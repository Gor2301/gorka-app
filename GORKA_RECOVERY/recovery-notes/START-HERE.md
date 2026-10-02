# START HERE

Version: 1.2
Date: September 22, 2026

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

8. CURRENT STATE — September 22, 2026

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

## Update — September 22, 2026

The cloud Windows development environment is now set up and working. This was the item the September 15 SAC investigation recorded as "not yet set up."

- AWS EC2 instance Gorka-dev, t3.small, Windows Server 2025 Datacenter, Singapore. Disk 70 GiB. RDP working.
- Toolchain installed: Git 2.55.0, Node.js 24.21.0, Rust 1.98.1, Visual Studio C++ Build Tools, Strawberry Perl 5.42.3.1.
- cargo build on the Tauri backend succeeded (18m 21s). gorka-client.exe produced.
- npm run build succeeded.
- Backend runs, connected to Supabase gorka_test through the session pooler.
- Tauri app launches on the cloud machine. Login succeeds. Local database unlocks. Client Dashboard reached. Collections page shows the real CRUD UI.
- Debtor CRUD confirmed working on the cloud machine.
- Debt CRUD partially failing at the due-date field. Diagnosis not started.
- Phase 9 Item 4 (Action CRUD) not fully tested.

Repository synchronization problem resolved. The main machine had months of uncommitted work; the cloud machine cloned an old commit. The working tree was committed as 08eac3b and pushed. Both machines are now on the same commit, working trees clean.

New process rule: Git is the synchronization authority between development machines. Before starting work on either machine, verify both HEADs match with `git log --oneline -1`.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full September 21–22 entries.

Two unresolved questions carried forward:

1. Agent App architecture — second Tauri binary in the same repo (per MULTI-USER-CONCEPT.md §9 and GORKA-MVP-SCOPE.md §5.3) or built from scratch. Not yet decided or recorded.
2. An embedding that should not have happened — something reportedly embedded into the Client Dashboard. Not yet documented.

Security housekeeping: three credentials (Supabase password, GitHub token, Resend API key) were exposed in chat logs and should be rotated.

## Update — September 23, 2026

Working session on the Client Dashboard, on the local authentication and unlock flow. Three defects were found, fixed, committed, and verified. All work was local; no cloud schema, no backend, no production.

- **Set/Enter bug fixed (commit `01631c6`).** The `UnlockScreen` read `localStorage.getItem('salt')`, but the salt lives in `settings.dat` (written by Rust). The two stores are unrelated, so the read always returned null and the screen always showed "Set." Fixed by adding a Rust command `database_exists` that checks for `gorka-client.db` on disk. DB absent → "Set"; DB present → "Enter." The `localStorage` read and write were removed.
- **Logout button no-op fixed (commit `38aec9c`, superseded).** The handler cleared `localStorage` and a cookie, neither of which the Tauri app uses. The first fix called `auth.logout()` and `window.location.reload()`; the reload does not tear down the JS context in this webview, so it was replaced.
- **Logout state reset (commit `183e8f7`).** `App` now owns the logout operation: `handleLogout` calls `auth.logout()`, then sets `isAuthenticated(false)` and `isUnlocked(false)`. The callback is threaded through `AppShell` to `Sidebar` via an `onLogout` prop. `Sidebar` contains no auth logic.
- **Rust logout connection leak fixed (commit `40b2378`).** The actual root cause of the re-login skipping the Enter screen. `logout` cleared `settings.dat` but did not close the SQLCipher connection in `AppState.db`. The command `is_database_unlocked` reads `AppState.db`, not `settings.dat`, so it kept returning `true` after logout. Fixed by making `logout` set `AppState.db = None` before calling `auth::logout(app)`.

**Verified on the cloud machine, twice:**

- Fresh launch → Login → Enter Password → Dashboard.
- Dashboard → Logout → Login screen.
- `settings.dat` after logout: `salt` only.
- Login → **"Enter Local Encryption Password"** (not Dashboard).
- Enter password → Dashboard.
- Logout → Login → Login → **"Enter Local Encryption Password"** again.

**Key learning recorded.** "Unlocked" in this app means the SQLCipher connection is open in the running Rust process, held in `AppState.db`. It is not a flag in `settings.dat`. `is_database_unlocked` reads the connection. That is why quitting the app fixed the symptom: process termination destroys `AppState.db`. The design is intentional and secure — the connection being open is the true test of whether the app can read the encrypted data. The bug was that `logout` left the connection open.

**Repository state:** main machine, cloud machine, and GitHub are all at `40b2378`. Working trees clean.

**Deferred findings recorded today:**

1. Dashboard 401 errors from `api.gorka.localhost:3000`. Separate finding, not yet investigated.
2. Eye-icon inconsistency on the password field (WebView2 built-in reveal control disappears after an error re-render). Deferred.
3. Debt due-date bug. Not investigated today.
4. Dead code in `Sidebar.tsx` lines 33–37. Inert. Removal deferred.

**The local registration flow — Stage 4 (login → set/enter local password) and Stage 5 (logout → login → enter → dashboard, repeatable) — is now stable and verified.**

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full September 23 entries.

Update - September 25, 2026 (Phase E, H1-H3 and M1-M2/V1-V4-V6)

Phase E is complete. The enrollment-package vectors, E1-E6,
were recorded earlier. The other two families are now done:
H1-H3, the session-key derivation and handshake proof tags; and
M1, M2, V1, V4, V6, the SYNC_MESSAGE envelope and the event
payload encoders.

All nine vectors are recorded and frozen in
SYNC-TEST-VECTORS-v1.md. The test suite is fourteen tests. All
pass on the cloud machine at commit 7f8529e.

H1-H3: three operations in main.rs, plain functions, not Tauri
commands. Two crates added: hkdf and hmac. The H1 vectors entry
was corrected: it had listed two organization ids, which did
not match section 22.11.1. Corrected to one. This is a
documentation repair, not a protocol change.

M1/M2/V1/V4/V6: the TLV serialization primitives, the
SYNC_MESSAGE framing, and the three event payload encoders.
encode_tlv is the single TLV primitive; every builder calls it.
These are reusable protocol primitives that Phase 9.6 will
consume.

All nine vectors are recorded but not independently confirmed.
Section 1 of SYNC-TEST-VECTORS-v1.md requires a second
implementation; there is only one. That remains open.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 25 (Phase E, H and M/V) entries.

Update - September 24, 2026
Two workstreams: completion of the Dashboard local-stats task, and the writing of the Excel/TXT upload specification. The Excel/TXT implementation is deferred by conscious decision.

Dashboard local-stats task - COMPLETE. The Client Dashboard's home page no longer calls the cloud. It reads from the local SQLCipher database.

A new Rust command get_dashboard_stats returns a DashboardStats struct: total_debtors, total_debt, total_actions.

total_debt uses Reading 2.5: SUM(amount) over the org's debts, excluding PAID and CANCELLED.

The Total Agents card was removed. No local agents table exists. Deferred.

The Recent Activity block was removed. No local attribution exists. Deferred.

The /api/dashboard/stats 401 is gone from the console. Other 401s (/api/auth/me, /api/connectors/types) remain. Those are the September 23 deferred finding #1.

Verified on the cloud machine: 11 debtors, $11,800 total debt, 0 actions. A debt changed to PAID fell by its amount. The status filter works.

Commit 66c6f12. Pushed to origin/main.

Upload path reconnaissance - DONE.

CSV upload verified end-to-end on the cloud machine. 10 debtors.

The debt due-date bug did not reproduce on the current build. Not closed.

The shipped dist/ bundle is clean of the pre-rewrite cloud-post upload code.

The stale supervisor-dashboard\dist\ contains the old cloud-post code. Not the folder Tauri serves from. Housekeeping.

Excel and TXT upload specification - WRITTEN, NOT IMPLEMENTED. Full text in UPLOAD-EXCEL-TXT-SPEC.md.

TXT is trivial: extension-only, reuses the existing CSV delimiter detection.

Excel requires a parser. The parser location is an open decision.

Lean: backend (calamine, in Rust). For transactionality, the future sync event model, and the test surface.

MVP keeps CSV-only at this stage. This is a conscious decision, not a backlog item. The UI currently advertises Excel, JSON, and XML, which do not work. That mismatch is recorded as a known limitation.

The determining question for the next session: is the MVP a stepping stone that will be rewritten for production, or the production version with features turned off?

Repository state: main machine, cloud machine, and GitHub are all at 66c6f12. The documentation commit for this session follows separately, after all five documents are written.

Argon2id parameters - FROZEN. The benchmark was written, run twice on the cloud machine, and the values were chosen and recorded. Chosen values: argon2_memory_kib = 131072, argon2_iterations = 4, argon2_parallelism = 1. Run 2 median: 461 ms on the cloud machine. The values were written into SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2.

Next workstream: Phase D - the enrollment package. D.1 (the organization_keys migration), D.2 (the enable_sync command), and D.3 (the export_enrollment_package command) are COMPLETE and verified on the cloud machine. D.4.1 (the import_enrollment_package function) is written and compiles; D.4.2 (registration), D.4.3 (build), and D.4.4 (test) remain. hkdf is deferred to Phase 9.6. Then Phase E - E1.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full September 24 entries, including the Argon2id freeze.
Update - September 25, 2026

Phase D - the enrollment package - is COMPLETE. D.4.2 (the
registration of import_enrollment_package in generate_handler!),
D.4.3 (the build with the registration), and D.4.4 (the import
test via devtools) are done and verified on the cloud machine.
D.1, D.2, D.3, and D.4.1 were completed earlier. The whole of
Phase D is now done: commit b5af889.

The import was tested against the existing key. It refused with
"Sync is already enabled for this organization" - the expected
outcome, and the path the handoff predicted. The refusal proves
the decryption path ran to completion: file read, 63-byte header
verified, Argon2id derivation, XChaCha20-Poly1305 decryption
with the header as AAD, inner content parsed, organization id
compared, key check reached. The import refused at the correct
point, for the correct reason.

The success path (no key present, install and delete) was not
tested, because a key exists and removing it is out of scope.
The package file was not deleted, because the refusal path does
not commit. C:\gorka-app\test-package.gorka remains, 140 bytes.

Phase E - E1, the first deterministic test vector - is next. It
was blocked on the package not existing. It is now unblocked.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 25 entries.

Update - September 25, 2026 (Phase E, E1-E6)

The enrollment-package test vectors are complete. E1 through E6
are done and pass on the cloud machine. Commit 77b8aa1.

E1 is the deterministic known-answer test. It constructs the
package from fixed inputs and asserts byte equality against a
recorded 125-byte reference value. The value is recorded in
SYNC-TEST-VECTORS-v1.md, E1 entry, as SPECIFIED / FROZEN.

E2 through E6 are the import behavioral tests: correct
passphrase, wrong passphrase, tampered payload, organization
mismatch, wrong magic. All five pass.

Two shared operations were extracted, both plain functions, both
testable without a Tauri runtime:
- build_enrollment_package, used by the export command.
- parse_enrollment_package, used by the import command.

Both production commands keep their observable behavior. No new
Tauri command was added. generate_handler! is unchanged.

Phase E is not complete. H1, H2, H3, M1, M2, V1, V4, V6 remain.
H1-H3 are the next target. Their vectors entry still says
BLOCKED, but that text is stale: SYNC-ARCHITECTURE.md section
22.19 now contains the HKDF labels.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 25 (Phase E) entries.
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

- UnlockScreen "Set" vs "Enter" bug. FIXED September 23, 2026
  (commit 01631c6). The earlier diagnosis ("salt written
  during login() rather than during set-password") is
  superseded. The actual cause was that the frontend read
  localStorage.getItem('salt'), while the salt lives in
  settings.dat. The fix adds a Rust command database_exists
  that selects the screen based on whether gorka-client.db
  exists on disk. See the September 23 entry in DECISIONS.md.
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
  chosen workaround. SET UP September 21-22, 2026: AWS EC2
  instance Gorka-dev, Windows Server 2025, Singapore. The
  signed binary runs there. See the September 15 and
  September 21-22 entries in DECISIONS.md.
- Phase 9 Item 4 (action CRUD) is code complete but not yet
  fully tested. The cloud Windows environment is now available
  (September 21-22), so the earlier SAC block no longer applies.
  Testing is pending.
- The multi-user model is frozen (MULTI-USER-CONCEPT.md v2.0).
  GORKA-MVP-SCOPE.md v1.1, SYNC-ARCHITECTURE.md v1.2, and
  THREAT-MODEL.md v1.0 are all written and frozen. The document
  prerequisites for multi-user implementation are met. The
  Argon2id parameters were frozen on September 24, 2026
  (SYNC-ARCHITECTURE.md section 7.3, section 22.19.2). Phase D
  is complete: D.1 through D.4.4 are done and verified. Phase E is complete: E1 through E6, H1 through H3, and M1,
  M2, V1, V4, V6 are done and verified. What remains before
  implementation: the Control Plane tables applied to
  gorka_test.
  
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


Update - September 26, 2026 (Control Plane tables and device identity)

The two Control Plane tables now exist in gorka_test:
device_registrations and relay_sessions. They were created by the
schema change at 1d89af8 and 9b5a118, verified, and recorded.

device_registrations has 13 columns. Six active MVP columns and
seven reserved columns for the funded-phase combined model. The
reserved columns are nullable and empty. They are governed by the
reserved-field rule: MVP code MUST NOT read or write them.

relay_sessions has 10 columns. No reserved columns. It will contain
no rows until Phase 9.6.

Device identity has two layers, and the frozen documents now say so
explicitly.

Layer 1, access: user-based. One registration per user, per
organization. A user logs in from any machine. No per-machine
registration, no per-machine key, no per-machine revocation.
device_registrations records this. In the MVP it is not a machine
registry.

Layer 2, sync origin: each local GORKA database has its own local
replica identifier, generated when the database is first
established. The wire device_id is exactly this 16-byte identifier.
It does not encode the user identity. (device_id, sequence) is
globally unique within the organization, so two machines under one
user have independent sequence namespaces.

SYNC-ARCHITECTURE.md is now at v1.3. Sections 3, 4, 11.3, and 22.4
were amended; a new subsection 25.6.6 defines the wire device_id.
The sentence in §11.3 that said the wire device_id "combines the
user identity with the device instance identifier" is replaced.

CLOUD-TABLES.md §20.1 gained a physical-specification note and an
MVP note. LOCAL-TABLES.md is unchanged.

A pre-existing Cargo.lock divergence was closed at 15a993f.

Main machine and cloud machine are at 15a993f, clean. The cloud
machine has the two known untracked files only. GitHub origin/main
is at 15a993f.

The next work is Phase 9.6, the sync engine, which consumes these
two tables. One item for Phase 9.6: choose the local storage
representation of sync_state.device_id. §25.6.6 defers this.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 26 entries.

Update - September 26, 2026 (Second-implementation verification of the nine vectors)

The second-implementation verification of the nine deterministic
test vectors is complete. All nine are confirmed by an
independent implementation.

A second, independent implementation was written in Node.js, at
verify/, using @noble/ciphers 2.4.0, hash-wasm 4.12.0, and
node:crypto — a different library family from the Rust
implementation's RustCrypto. It was written from
SYNC-ARCHITECTURE.md v1.3 and SYNC-TEST-VECTORS-v1.md only. No
file under src-tauri/ was read.

First run produced 9/9 PASS. Every vector matched the recorded
value byte-for-byte. No implementation adjustment, vector
adjustment, or specification adjustment was required. A
negative control confirmed the harness detects byte-level
mismatch.

The verification code is preserved at verify/. It can be rerun
with `node verify/index.mjs` to reconfirm the vectors.

The Status block of SYNC-TEST-VECTORS-v1.md was updated from
"Second-implementation verification not performed" to
"verification performed on 2026-09-26. All nine vectors
confirmed by an independent implementation."

The open item "Second-implementation verification of the nine
vectors" is now closed. The nine vectors are no longer recorded
but not confirmed.

What remains unchanged:
  - Phase 9.6 (sync engine), 9.5 (Agent App), 9.7
    (demonstration): not started.
  - Control Plane services: not implemented.
  - Excel/TXT upload, debt due-date bug, stale
    supervisor-dashboard\dist, UI honesty issues, Dashboard
    401s: unchanged.

The Agent App architecture decision (same-repo shared-crate vs
built from scratch) remains open. It has been open since
September 21 and blocks Phase 9.5.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 26 second-implementation entries.


Update — September 27, 2026 (Multi-user application architecture: A–G decisions and design reconnaissance)

A structured architecture conversation about how the two applications coexist, how they reach providers and AI, where compliance is enforced, what syncs, and how the work is sequenced. Followed by a read-only design reconnaissance of the Client Dashboard. Recorded in DECISIONS.md, HANDOFF.md, SESSION-LOG.md.

The Agent App architecture decision, open since September 21, is now resolved:

  Same repository, second Tauri binary, shared Rust command
  layer. Code is written fresh. The Electron-era code in
  src/frontend/ and src/backend/_disabled/ is reference only,
  not ported. It is not deleted; it stays where it is.

The "embedding that should not have happened" question is also resolved. It was the original Electron agent app, left inside the Client Dashboard's tree by mistake during the pre-recovery drift era, and kept untouched afterwards by a deliberate decision. Not a stray. Now documented.

Seven topic areas were settled (A–G):

  A — Communication runs from the Agent App. Admin configures
      connectors; agent sends. GORKA-managed subaccounts and
      BYOP. Automatic sending deferred.
  B — Provider credentials stored locally in each device's
      SQLCipher database. Separate from the organization key.
  C — AI calls direct from the agent's device. Only metadata
      leaves. New client-side component: the AI boundary layer.
  D — Copilot in both apps, different purposes. Communication
      Center in the Agent App only. Per-agent access control
      still undecided.
  E — Cloud declares rules, local enforces. Client is sender of
      record. New client-side compliance enforcement layer.
  F — Message log syncs as new event types. Admin sees full
      content. MVP: one event per message, retain everything.
  G — Same schema for both apps. LEGO architecture.
      Cross-platform in the target. "Workable GORKA" defined.

Three further items: N1 (Connection Center — broader than
communication providers; skip-tracing capability needed, framing
compliance-sensitive, legal review precondition). N2 (audit log
journal; cross-app connection deferred). N3 (cross-platform
commitment; Windows first, no Windows-only assumptions in the
shared Rust layer).

Design reconnaissance read twelve files from the Client
Dashboard on disk. Design vocabulary extracted (colors,
typography, spacing, shape, icons, components, layout). Full
tables in DECISIONS.md.

Consistency rule settled: primary button color is purple
#7C3AED everywhere, including the entry flow. Red #DC2626 is
reserved for the logo, errors, and destructive confirmation.

The Agent App's entry flow is three steps, three centered cards
in one style: Login → Unlock → Enroll. Step 3 (import the
organization enrollment package) is new as a screen. It implies
a proper export/import screen pair on the Client Dashboard side.

The running list of open items is in DECISIONS.md, September 27
entry.

No spec written. No code written. No architecture amended. No
frozen document changed. No commit made this session.

The next work is the Agent App build spec. This session's
decisions and design vocabulary are its input.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full
September 27 entries.

Update — September 27, 2026 (Agent App build spec)

The Agent App build spec is written, reviewed, corrected, and frozen.

Document: GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md, version 1.2, approved by the founder on September 27, 2026. It is the input to Phase 9.5.

The spec defines the second Tauri binary in the same repository: the Agent App. It shares the Rust command layer with the Client Dashboard. It has its own bundle identifier, app data folder, settings.dat, and local SQLCipher database.

The session recorded twelve design decisions (D1 through D12). They are recorded in full in DECISIONS.md (the September 27, 2026 entry "Agent App build spec").

Two amendments to frozen documents were applied:

LOCAL-TABLES.md is now v1.3. Amendment 1 promotes four schema additions to authoritative status: debtors.photo_path, calendar_events, debtors.role, debtor_relations. The summary table now shows 22 local tables (was 20).

SYNC-ARCHITECTURE.md is now v1.4. Amendment 2 extends Section 25.9.2 with subsection 25.9.2a: the debt-in-data_json interpretation, plus Rules 1 (receipt) and 2 (origination).

An external reviewer examined the first draft. The reviewer classified it "approve after targeted corrections, not redesign," identified seven corrections (C1 through C7), and reviewed the corrected draft as "implementation-ready spec." All corrections are applied. The reviewer's closing principle was adopted by the founder as binding:

Do not let the developer "improve" the architecture while implementing this spec. The developer works mechanically from the approved specification. Any discovered discrepancy becomes a STOP -> report -> founder decision, not an opportunity to redesign.

The spec lives as a standalone file, referenced by the recovery notes but not duplicated into them. The recovery notes carry the record: the decisions, the reasoning, the amendments, the status.

Phase 9.5 begins after the founder's go.

See DECISIONS.md, HANDOFF.md, and SESSION-LOG.md for the full September 27 entries.

Update - September 28, 2026 (Phase 9.5 begins: workspace, storage, extraction slices)

Phase 9.5 has begun. It is IN PROGRESS, not NOT STARTED.
The Agent App scaffolding exists. The extraction of shared
code from the Client Dashboard has started and Slice 1 is
complete.

The sequence executed today:

  Phase 1a  Root workspace manifest (199956e)
  Phase 1b  gorka-shared crate (2c540bc)
  Phase 2   Storage root migration (52f0915)
  Slice 3.1 Models extraction (a2ccd73)
  Slice 3.2 Enrollment package (8cce268)
  Slice 3.3 Sync primitives (7b06034)
  Agent scaffold (0e73b34, 699b9fe)
  Slice 3.4 DB extraction (a959087)
  Slice 1 debtors (91b5b7e)
  Housekeeping (.gitignore target/, Cargo.lock, gen/schemas)
  (20a1730, ab957d8, ee8c732)
  Extraction log created (8435179)

What exists now:

  - Cargo workspace with three members: shared/, src-tauri/,
    src-tauri-agent/.
  - The shared crate (gorka-shared) contains: storage.rs
    (AppStorage), models.rs, enrollment.rs, sync.rs, db.rs,
    debtors.rs. All Tauri-free.
  - The Client Dashboard's DB and debtor files moved from
    %APPDATA%\gorka\client\data\ to
    %APPDATA%\com.gorka.client\data\, with the old location
    preserved as a rollback copy.
  - The Agent App (gorka-agent) builds and launches. It has
    its own bundle identifier (com.gorka.agent), its own
    database filename (gorka-agent.db), its own app data
    folder (%APPDATA%\com.gorka.agent\data\), its own command
    list (agent_ping only). No Agent functionality yet.
  - All 14 protocol tests pass. The Client runs and behaves
    as before each slice.

Decisions recorded during the session:

  - Repository layout: Option A (Cargo workspace plus shared
    crate). Agent depends on shared, never on Client.
  - Storage: Direction 1 plus Option 1b (unify to the Tauri
    bundle-identifier root, with data/ subfolder). One-time
    migration, crash-safe, old root preserved.
  - Agent scaffold timing: Option B binding. Scaffold the
    Agent once models, storage, enrollment, sync are shared,
    before db and auth are fully extracted. Done.
  - auth.rs extraction: Reading C, DEFERRED. The proposed
    path-based shape does not match the actual code; the six
    store functions have no Tauri-free side. Wait for the
    Agent's own auth to exist before deciding.
  - Adapter/command cleanup: Reading 3, entity-based slices.
    Debtors first. Debts, communications, actions, documents,
    dashboard to follow.
  - Warnings: inspected and reported. Three main.rs warnings
    cleaned in Slice 1. Five auth.rs warnings deferred with
    auth.

Unexpected findings, both resolved:

  - .gitignore did not exclude target/. Fixed at 20a1730.
  - Root Cargo.lock was untracked. Now tracked (ab957d8).
    The obsolete pre-workspace src-tauri/Cargo.lock was
    removed (ee8c732).

The recovery notes now include a new file:

  GORKA_RECOVERY/recovery-notes/PHASE-9.5-EXTRACTION-LOG.md

It records each slice in detail: starting and resulting
commits, files moved, commands moved, function mapping, data
preservation, adapter behavior preservation, warning counts,
build and test results, explicit non-changes.

State at end of session:

  Main machine:  8435179, clean.
  Cloud machine: ee8c732, clean. Two commits behind; needs
                 git pull before Slice 2.
  GitHub:        8435179.

Next work: Slice 2 (debts). Commands to move:
get_debts, insert_debt, update_debt, delete_debt.
Same pattern as Slice 1. See the extraction log.

After Slice 2: communications, actions, documents, dashboard.
Then final Client regression. Then Agent implementation.
Then Agent authentication. Then re-evaluate the shared auth
boundary.

See DECISIONS.md, HANDOFF.md, SESSION-LOG.md, and the new
PHASE-9.5-EXTRACTION-LOG.md for full details.

================================================================
Update - September 29, 2026 (Stage B complete, Stage C.1 complete)
================================================================

Continued Phase 9.5. The three items left open by the
September 28 session were closed, Stage B was completed, and
Stage C began.

The sequence executed on September 29:

  Item 1    delete_debtor filesystem test     PASSED
  Item 2    auth boundary                     DONE (499e7f5, 10df6f5)
  Item 3    Stage A schema migrations         DONE (6e83a29)
  Stage B.1 photo functions                   DONE (2268a30)
  Stage B.2 calendar operations               DONE (292a3a8)
  Stage B.3 debtor relations                  DONE (884c637)
  Stage C.1 Agent auth foundation             DONE (5ab35ae)
  Cargo.lock reconciliation                   DONE (67b984a)
  C.1 follow-up Manager cleanup               DONE (c69d21e)

What exists now:

  - gorka-shared gains: auth_http.rs, calendar.rs,
    relations.rs. Models gain CalendarEvent,
    CalendarEventInput, UpcomingPayment, UpcomingFollowup,
    DebtorRelation, DebtorRelationInput.

  - shared/src/db.rs migrations v5/v6/v7: debtors.photo_path,
    debtors.role, calendar_events table, debtor_relations
    table.

  - src-tauri-agent now has real code: auth.rs (7 functions),
    AppState with Mutex<Option<Connection>>, 8 commands
    registered (login, get_auth_token, get_salt,
    get_organization_id, database_exists, unlock_database,
    is_database_unlocked, logout). agent_ping removed.

  - The Client binary is unchanged since Item 2 except for
    the removed reqwest dependency.

Decisions recorded during the session (DECISIONS.md,
September 29 entry):

  D1 - Spec section 6.3 example signatures are illustrative,
       not normative. Where they conflict with a MUST rule in
       LOCAL-TABLES, the LOCAL-TABLES rule wins. All Stage B
       functions take trusted organization_id as a result.

  D2 - open_local_file deferred to Stage D, when the
       Agent's Documents UI actually consumes it. Stage C
       registers 41 commands instead of 42.

  D3 - New Agent code is written clean. No debug println!s,
       no dead imports. "Preserve exactly" applies to
       extraction, not to new code.

Verification (cloud, September 29):

  cargo build -p gorka-client    PASS (2m 16s, 3 warnings)
  cargo build -p gorka-agent     PASS (2m 39s, 3 -> 2 warnings
                                  after c69d21e)
  cargo test -p gorka-shared     14/14 PASS
  Client login -> unlock -> dashboard works on the migrated
  schema; existing data intact (12 / $2,381,550 / 2).

State at end of session:

  Main machine:  c69d21e, clean.
  Cloud machine: c69d21e, clean except the two known
                 untracked files (check-columns.ts,
                 test-package.gorka).
  GitHub:        c69d21e.

Next work: Stage C.2 - CRUD adapters in the Agent's main.rs.
21 adapter commands for debtors, debts, communications,
actions, documents. All main-side; cloud needed only for
build verification.

After C.2: C.3 (photo, calendar, relations adapters), C.4
(enrollment). Then Stage D - the Agent frontend. Then the
Agent end-to-end regression.

See DECISIONS.md (September 29 entry), HANDOFF.md,
SESSION-LOG.md, and PHASE-9.5-EXTRACTION-LOG.md for full
details.


================================================================
Update - September 30, 2026 (Stage C complete, Stage D.0-D.3 complete)
================================================================

Continued Phase 9.5. Closed Stage C with a small backend
addition (C.5), then began and advanced Stage D - the Agent
frontend.

The sequence executed on September 30:

  Stage C.5 is_enrolled backend          DONE (a085b8d)
  Stage D.0 frontend prerequisites       DONE (71948ab)
  Stage D.1 design tokens + primitives   DONE (38ae126)
  Stage D.2 entry flow                   DONE (2eb97b9)
  Stage D.3 main shell                   DONE (efbbc4d)
  Documentation batch                    DONE (bdf93a2 + this update)

What exists now:

  - shared/src/db.rs gains is_enrolled(conn) -> Result<bool,
    String>. Queries organization_keys for a row.

  - src-tauri-agent registers 42 commands now (was 41).
    is_enrolled added between is_database_unlocked and
    logout.

  - agent-dashboard has a real frontend: design tokens,
    ten shared primitives, three entry-flow pages, and the
    main shell with sidebar and header.

  - The Client binary is unchanged since Item 2.

Decisions recorded during the session (DECISIONS.md,
September 30 entry):

  D1 - Design source is the Client's real design, not
       spec-11.2-verbatim. Spec 11.2 states its own intent
       as "the Agent uses the same vocabulary as the
       Client." Following the Client's component layer
       matches that intent.

  D2 - Spec 11.3's six named inconsistencies are corrected,
       not carried. Purple #7C3AED primary buttons, error
       banner in #fef2f2/#fecaca/#dc2626, input border
       #e5e7eb, modal padding 24px, radius 8px. Red is
       reserved for the GORKA wordmark and danger indicators.

  D3 - Entry-flow visual reference is the Client's
       pre-Tauri Login page, with the primary button
       changed from red to purple.

  D4 - is_enrolled replaces the spec's literal
       "refusal as signal." The refusal message from
       import_enrollment_package remains; it is simply no
       longer the mechanism by which the UI discovers
       enrollment state.

  D5 - The Agent icon is deferred past Phase 9.5. Both
       binaries keep their Tauri-default icons for now.

Verification (cloud, September 30):

  cargo build -p gorka-agent    PASS (2 warnings, unchanged)
  cargo build -p gorka-client   PASS (3 warnings, unchanged)
  cargo test -p gorka-shared    14/14 PASS
  Cargo.lock                    unchanged
  npm install on cloud          OK, 0 vulnerabilities
  npm run build on cloud        PASS (227.44 kB JS, 7.43 kB CSS)
  Visual: Login page renders correctly (red wordmark, purple
    Sign In button). Shell renders correctly (sidebar, header,
    seven nav items, Today stub).

State at end of session:

  Main machine:  efbbc4d, clean.
  Cloud machine: efbbc4d after next pull (currently at
                 2eb97b9, plus the two known untracked files).
  GitHub:        efbbc4d.

Next work: Stage D.4 - debtor list and debtor profile. Then
D.5 (plan view / calendar), D.6 (remaining screens). Then
the Agent end-to-end regression.

See DECISIONS.md (September 30 entry), HANDOFF.md,
SESSION-LOG.md, and PHASE-9.5-EXTRACTION-LOG.md for full
details.

================================================================
Update - October 1, 2026 (Stage D.4a-0 through D.4b-2c Rust half)
================================================================

Continued Phase 9.5. Built the Agent App's first data pages:
debtor list, debtor profile, communications, documents,
photo, relations. Six slice commits, four documentation
commits. No production touched. No cloud schema change.
The invariant held.

The sequence executed on October 1:

  D.4a-0    primitive gap-fill             DONE (7f122e1)
  D.4a      debtor list and profile        DONE (32f1475)
  D.4b-1    comms and docs cards           DONE (c5e2d6e)
  D.4b-2a   debtor profile photo           DONE (8ddb6ef, 3688d9f)
  D.4b-2b   relations card                 DONE (68440de)
  D.4b-2c   role column + orphan cleanup   RUST HALF DONE (c73373d)
  Documentation batch                      DONE (d0eb175, 829dcea,
                                                  b184408, this)

What exists now:

  - The Agent has real data pages: list with search and
    CRUD, profile with header card (photo + info grid),
    Debts card, Relations card, Communications card,
    Actions card, Documents card.
  - Photo displays via blob URL from Rust bytes. No CSP
    change, no new crate, no new npm package.
  - Relations supports Add Guarantor and Add Pledger,
    with collateral fields for pledgers only.
  - The Rust half of D.4b-2c provides the role lookup,
    the debt totals lookup, and safe orphan cleanup. The
    frontend half is not written yet.

What is verified on cloud:

  D.4a, D.4b-1, D.4b-2a, D.4b-2b. All behavioral tests
  passed, including persistence across process restart.

What is committed but NOT yet compiled on cloud:

  c73373d - D.4b-2c Rust half. Next cloud action:
    cd /d C:\gorka-app && git pull
    cargo build -p gorka-agent
    cargo build -p gorka-client
    cargo test -p gorka-shared

State at end of session:

  Main machine:  (this commit)
  Cloud machine: c5e2d6e, behind.
  GitHub:        (this commit)

Next work:

  D.4b-2c frontend half. Then D.5 (plan view / calendar),
  D.6 (remaining screens). Then Agent end-to-end
  regression.

See DECISIONS.md (October 1 entry), HANDOFF.md,
SESSION-LOG.md, and PHASE-9.5-EXTRACTION-LOG.md for full
details.


================================================================
Update - October 2, 2026 (D.4b-2c-fix, D.5, D.6.1, D.6.2)
================================================================

This entry brings START-HERE current through October 2. The
previous entry here was for D.4a-0 through D.4b-2c Rust
half, dated October 1. Three subsequent work batches
shipped without a START-HERE update (D.4b-2c-fix, D.5,
D.6.1+D.6.2). They are recorded here so the file matches
the repository state.

Sequence since the previous START-HERE entry:

  D.4b-2c frontend half    DONE (8689289)
  D.4b-2c-fix              DONE (f0552aa, 060987c, 7a5c01f)
  D.5 plan view / calendar DONE (1923666)
  D.6.1 Communication Tools placeholder + Settings
                           DONE (3b578f3)
  D.6.2 cross-debtor Actions
                           DONE (88ef81c)
  Documentation batches    DONE (several, ending with this)

What is now working on the Agent:

  - Entry flow: Login, Unlock, Enroll. State machine.
  - Debtors list: primary debtors only, search, CRUD,
    Role column with static badges, Debt and Currency
    columns, two-row sticky header, orphan cleanup on
    mount.
  - Debtor profile: header card with photo, Debts card,
    Relations card, Communications card, Actions card,
    Documents card. Related persons hide Debts and the
    relation add buttons. Back button is path-aware.
  - Plan view (calendar): FullCalendar with four views,
    three overlaid sources (manual blue, payments red,
    follow-ups amber), two cards below. Manual events
    stored, derived events live queries.
  - Communication Tools: read-only placeholder with the
    exact spec 11.8 sentence. No local_connectors table.
  - Settings: About-only. Four cards (About, Data, Sync,
    Security). No password change.
  - Actions (cross-debtor): read-only table, five status
    filter chips, sorted by due date with nulls last,
    debtor-name navigation to the profile.

What is verified on cloud:

  All of the above. D.4b-2c-fix, D.5, D.6.1, D.6.2 all
  cloud-verified with behavioral tests. Rust regression
  unchanged: gorka-agent 2 warnings, gorka-client 3
  warnings, gorka-shared 14/14.

State at end of session:

  Main machine:  88ef81c, clean, pushed.
  Cloud machine: 88ef81c, clean.
  GitHub:        88ef81c.

Next work:

  1. Agent end-to-end regression. Final Phase 9.5 pass.
  2. Close Phase 9.5.
  3. Phase 9.6 begins with reading SYNC-ARCHITECTURE.md
     v1.3 and LOCAL-TABLES.md v1.3. No code on day one.

See DECISIONS.md (October 2 entry), HANDOFF.md,
SESSION-LOG.md, and PHASE-9.5-EXTRACTION-LOG.md for full
details.


================================================================
Update - October 2, 2026 (Phase 9.5 CLOSED)
================================================================

Phase 9.5 is complete. The Agent end-to-end regression
ran and passed ten of eleven steps. The remaining defect
(logout button) was fixed in the closure slice. Both
binaries build and run on cloud. The Client Dashboard
runs at the new identifier with a fresh database.

Sequence since the previous START-HERE entry:

  Agent end-to-end regression    DONE (10 of 11; logout
                                       defect found)
  Closure fixes                  DONE (e9488aa)
  Client storage migration
    removal                      DONE (92e9b7c)
  Documentation batch            DONE (this)

What is now working:

  - Agent App, all screens: entry flow, debtors list,
    debtor profile, photo, relations, plan view,
    Communication Tools, Settings, cross-debtor
    Actions, Support placeholder, working logout.
  - Client Dashboard: fresh install at
    click.gorka.client. No migration. Set-password
    screen on first launch.
  - Both apps now use click.gorka.* bundle identifiers,
    matching the real domain (gorka.click).
  - Support sidebar item present, disabled with a
    "Soon" badge.

What was fixed since the previous entry:

  - Logout button: was wired to the entry-flow check
    function, never called the logout command. Now
    bound to a dedicated handler.
  - Bundle identifier: com.gorka.* -> click.gorka.*.
  - Client storage migration: obsolete Phase 2B module
    removed. Was copying an old DB into the new
    identifier's folder and forcing an "Enter" screen
    instead of "Set".

State at end of session:

  Main machine:  92e9b7c, clean, pushed.
  Cloud machine: 92e9b7c, clean, powered off.
  GitHub:        92e9b7c.

Next work:

  1. Write GORKA-SUPPORT-SPEC.md (parked deliverable).
     Structure proposal first, founder approves, then
     write one section at a time.
  2. Begin Phase 9.6. Read SYNC-ARCHITECTURE.md v1.3
     and LOCAL-TABLES.md v1.3 in full. No code on day
     one.
  3. CONNECTOR-MODEL.md at the start of Phase 9.6.
     The October 1 connector context dump is the input.

See DECISIONS.md (October 2 Phase 9.5 closure entry),
HANDOFF.md, SESSION-LOG.md, and PHASE-9.5-EXTRACTION-LOG.md
for full details.