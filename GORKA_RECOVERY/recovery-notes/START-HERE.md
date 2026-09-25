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
  is complete: D.1 through D.4.4 are done and verified. Phase E
  is in progress: E1 through E6 are done and verified. What
  remains before implementation: H1, H2, H3, M1, M2, V1, V4,
  V6, and the Control Plane tables applied to gorka_test.
  
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




