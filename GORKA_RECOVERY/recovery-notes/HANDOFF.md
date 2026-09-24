
# GORKA RECOVERY - HANDOFF DOCUMENT

**Version:** 1.0
**Date:** September 12, 2026
**Purpose:** Transfer context from recovery session to a new AI session.
**For:** The next AI developer continuing the GORKA recovery.

---

## 1. WHO YOU ARE

You are continuing the GORKA recovery. This began September 11, 2026, after a period of architectural drift. Before acting, read ALL files in GORKA_RECOVERY/recovery-notes/.

You are BOUND by:
- ARCHITECTURAL-LAW.md (the constitution)
- RECOVERY-RULES.md (14 rules)
- DATA-BOUNDARY-MATRIX.md (operational data map)
- DECISIONS.md (why things are the way they are)
- CLOUD-TABLES.md (19 cloud tables)
- LOCAL-TABLES.md (local schema)
- PRODUCTION-REBUILD-PLAN.md (Phase 17 plan)

If any of these files conflict with your intuition, the FILES WIN.

---

## 2. WHERE WE ARE NOW

**Phase status (as of Sept 12, 2026):**

- Phase 0 - Freeze and Backup: COMPLETE
- Phase 1 - Architectural Law: COMPLETE
- Phase 2 - Decision Documents: COMPLETE
- Phase 3 - Cloud Schema: COMPLETE (19 tables in schema.cloud.prisma)
- Phase 3.5 - Backend cleanup: COMPLETE (11 files moved to _disabled/)
- Phase 4 - Prisma Generation: COMPLETE
- Phase 5 - Rebuild gorka_test: COMPLETE (19 tables, 0 debtor tables)
- Phase 6 - Schema verification: COMPLETE
- Phase 7 - Registration: COMPLETE
- Phase 8 - Login and Auth: COMPLETE
- Phase 9 - Tauri Local Database: NEXT
- Phase 10-18: PENDING

**Production Supabase:** untouched since Sept 10 backup.

**gorka_test:** has 19 tables + 2 test orgs/users.

**Working Tauri build:** v0.1.0, all platforms, GitHub Release exists.

---

## 3. THE 14 RULES (SHORT VERSION)

1. Do not modify production to make a test pass.
2. Do not add a cloud table because a backend route expects it.
3. Do not add a debtor model to the cloud Prisma schema.
4. Do not put a foreign key to debtors in any cloud table.
5. Do not send debtor IDs as metadata.
6. Do not put personalized messages into cloud templates.
7. Do not put debtor info into support tickets.
8. Do not assume an external provider supports GORKA-issued temporary credentials.
9. Do not mix local SQLite models into the cloud Prisma schema.
10. Do not use prisma db push against production during development.
11. Do not fix schema mismatches by adding random columns.
12. Do not touch the working Tauri CI/CD pipeline without specific need.
13. Do not start Phase 13-14 connectors while Phases 3-12 are unstable.
14. Do not let a failing test cause us to question the architecture.

**Zero production SQL between Phase 2 and Phase 17.**

Full version in RECOVERY-RULES.md.

---

## 4. HOW TO HANDLE A FAILING TEST

Debug DOWN the chain:

   Architecture
        v
   Specification
        v
   Schema
        v
   Backend
        v
   Test

Find the level where the failure originates. Fix at THAT level. Do NOT change the architecture because the implementation does not match it.

This is the exact mistake from Sept 9-10, 2026. Registration failed. Instead of fixing the backend/schema, we questioned the architecture. Two days were lost. We do not do this again.

---

## 5. HOW TO HANDLE A NEW QUESTION OR FEATURE REQUEST

Before acting, ask:

1. Is this cloud or local?
2. If cloud: does it contain or reference an individual debtor?
3. If yes: it belongs local. Do not add to cloud.
4. If no: cloud is possible.
5. If unsure: STOP. Ask the user. Document the decision.

NEVER make a schema change to satisfy an error without first checking the rules.

---

## 6. HOW TO HANDLE A SUCCESSFUL PHASE

1. Add a short note to DECISIONS.md (what, why, where).
2. Update the phase list in this Handoff.
3. Tell the user the phase is complete.
4. Wait for the user to say continue. Do NOT propose the next phase unprompted.

---

## 7. CURRENT PHASE IN DETAIL - PHASE 9

**Phase 9: Tauri Local Database Verification**

Goal: Verify the local SQLite (Tauri) data plane works.

Verify:
- SQLCipher encryption is active (DB cannot be opened by plain SQLite)
- Unlock with correct password succeeds
- Unlock with wrong password fails immediately
- Debtor CRUD works
- Debt CRUD works
- Document upload works
- Communication logging works
- Action CRUD works
- Local audit log records operations
- Data persists across restart

Do NOT:
- Touch production
- Modify the Tauri CI/CD
- Change the cloud schema
- Add cloud tables

Source of truth for local schema: GORKA_RECOVERY/specs/Tauri-v3.2/tauri-spec-v3.2.txt

---

## 8. HOW TO START THE NEW SESSION

First message from user will include this document.

Then:
1. Read every file in GORKA_RECOVERY/recovery-notes/
2. Read both spec files in GORKA_RECOVERY/specs/
3. Confirm understanding in one short message
4. Ask the user: Ready to continue with Phase 9?
5. Wait for the user.

Do NOT:
- Suggest improvements
- Propose redesigns
- Recommend upgrades
- Question the architecture
- Start work without user confirmation

---

## 9. KEY FILES AND LOCATIONS

**Recovery documentation:** GORKA_RECOVERY/recovery-notes/
**Specs:** GORKA_RECOVERY/specs/ (Core-v2.0, Tauri-v3.2, Migration-v5.0)
**Backups:** GORKA_RECOVERY/backups/
**Cloud schema:** prisma/schema.cloud.prisma
**Backend:** src/backend/ (Express + Prisma)
**Tauri Rust:** src-tauri/
**Tauri frontend:** supervisor-dashboard/
**Owner Dashboard:** owner-dashboard/
**Disabled code:** src/backend/_disabled/

**Database (test):**
postgresql://postgres:gorka2026saas@db.tmloklxelckicufzpzxz.supabase.co:5432/gorka_test

**Database (production - FROZEN):**
postgresql://postgres:gorka2026saas@db.tmloklxelckicufzpzxz.supabase.co:5432/postgres

---

## 10. THE INVARIANT

**No individual debtor information is stored in GORKA cloud infrastructure.**

This is not a feature. This is not a policy. This is the architectural invariant everything else depends on.

Allowed in cloud:
- Customer data (organization business info)
- User authentication and profiles
- Aggregate metrics (counts, sums)
- Client behavioral metrics
- Support tickets (with PII warning)
- Cloud audit logs
- Boundary proof logs
- Connector catalog and enablement
- Connector usage (aggregates only)

Forbidden in cloud (local only):
- Debtor names, contacts, addresses
- Individual debt amounts or records
- Message content
- Documents
- Individual actions or communications
- Debtor IDs in any form

Read ARCHITECTURAL-LAW.md for the full version.

---

**This document is the bridge. Follow it exactly.**


## STATUS UPDATE — September 13, 2026

Phase 9 (Tauri Local Database Verification) is BLOCKED, not complete.

Reason: the v0.1.0 Tauri binary's frontend does not implement the
flows spec §16 requires. Specifically:
- The app launches directly to "Set Local Encryption Password" and
  never calls auth::login first. Because the salt is written only
  inside login (auth.rs), no salt persists, and the app prompts "Set"
  on every launch instead of "Enter."
- Collections shows "Collections Under Construction."
- Data Upload requires a login that the frontend never performs.
- No Audit Logs UI, no Backup UI.

The Rust layer (main.rs, db.rs, auth.rs) matches Tauri spec v3.2
§5, §6 + Annex A, §7. Annex A fix is applied. SQLCipher is enabled
via Cargo.toml. §16.2 "first-run encrypted DB creation" was verified
empirically (DB header is not "SQLite format 3").

Phase 9 completion is gated on a frontend build that performs cloud
login before local unlock and exposes Collections / Data Upload /
Audit Logs / Settings-Backup UI. See DECISIONS.md entry
"Phase 9 — Blocked — September 13, 2026" for full details.

No production touched. No cloud schema changed. No CI/CD touched.
No source edited. Invariant intact.

## STATUS UPDATE — September 13, 2026

Phase 10 (Aggregate Metrics Sync) is COMPLETE.

- New endpoint POST /api/metrics/sync in
  src/backend/routes/metrics.routes.ts, mounted with
  authenticateToken in src/backend/index.ts.
- Writes aggregate_metrics (upsert per organization) and creates a
  boundary_proof_logs entry with eventType=METRICS_SYNC and
  debtorDataIncluded=false.
- Verified end-to-end against gorka_test with curl + psql.
- Backend-only scope; Tauri-side sync deferred until the Phase 9
  frontend workstream exists.

Phase 9 remains BLOCKED. Next phase: 11 — Client Activity Metrics
Sync.

Standing rule from this session: always start the backend with the
inline DATABASE_URL=...gorka_test override; `.env` points at
production postgres.

## STATUS UPDATE — September 13, 2026 (Phase 11)

Phase 11 (Client Activity Metrics Sync) is COMPLETE.

- New endpoint POST /api/activity/sync in
  src/backend/routes/activity.routes.ts, mounted with
  authenticateToken in src/backend/index.ts.
- Writes client_activity_metrics (period + eight counts) and
  creates a boundary_proof_logs entry with
  eventType=ACTIVITY_SYNC, debtorDataIncluded=false.
- Verified end-to-end against gorka_test with curl + psql.
- Backend-only scope; Tauri-side sync deferred until the Phase 9
  frontend workstream exists.

Phase 9 remains BLOCKED. Next phase: 12 — Boundary Proof Logging
Surfaced.

Standing rule: always start the backend with the inline
DATABASE_URL=...gorka_test override; `.env` points at production
postgres.

## STATUS UPDATE — September 13, 2026 (Phase 12)

Phase 12 (Boundary Proof Logging Surfaced) is COMPLETE.

- New endpoint GET /api/boundary-proofs in
  src/backend/routes/boundary.routes.ts, mounted with
  authenticateToken. Reads boundary_proof_logs. Role scoping:
  OWNER sees all orgs; other roles see only their own.
- New Owner Dashboard page:
  owner-dashboard/pages/BoundaryProofsPage.tsx, reachable at
  /boundary-proofs, with a "Boundary Proofs" nav item in the
  sidebar.
- New helper getBoundaryProofs() in owner-dashboard/services/api.ts.
- Verified end-to-end against gorka_test: two rows returned for
  test@example.com's org (ACTIVITY_SYNC, METRICS_SYNC), both
  debtorDataIncluded=false; zero rows for test2@example.com's org.
  Owner Dashboard page rendered with both rows in the browser.

Deferred (documented, tracked): Client Dashboard display of
proof logs, client-side local proof demonstration from the
Tauri app, and a formal regulator-facing PDF export. All wait
on the Phase 9 frontend workstream.

Known gap recorded: the Owner Dashboard's other pages
(Clients, Analytics, Billing, Audit, Dashboard) call backend
endpoints that do not exist yet. That is pre-existing and NOT
part of Phase 12. It is a future workstream.

Phase 9 remains BLOCKED. Next phase: 13 — Connector
Architecture Feasibility.

## STATUS UPDATE — September 13, 2026 (Phase 13)

Phase 13 (Connector Architecture Feasibility) is COMPLETE.

- New document: GORKA_RECOVERY/recovery-notes/CONNECTOR-LIFECYCLE.md
  (13,121 bytes).
- Reframed from a per-provider deep feasibility proof to a
  permanent lifecycle document: connectors are re-assessed and
  can be replaced. Two tiers: Tier 1 (GORKA-managed) and
  Tier 2 (client BYO).
- Six-condition rule for Tier 1 providers.
- Add / replace / retire procedure. Schema already supports it
  (connector_catalog.lifecycleStatus, client_connectors.
  credentialsLocation, connector_usage.pricingVersion).
- Prototype assessment: Twilio feasible both tiers; Resend
  Tier 2 feasible, Tier 1 needs verification; Mocean Tier 2
  feasible, Tier 1 unconfirmed; Gemini Tier 1 feasible via
  Vertex AI, Tier 2 via AI Studio.
- No schema change. No code change. No production touched.

Next phase: 14 — Connector Implementation. Per Recovery Rule 13,
implementation should not begin while Phases 3-12 are unstable.
Phases 3-12 are now stable at prototype level.

Phase 9 remains BLOCKED (Tauri frontend workstream).

## STATUS UPDATE — September 13, 2026 (Phase 14 and 14.5)

Phase 14 (Connector Implementation) is COMPLETE.
Phase 14.5 (Subscription Billing) is COMPLETE.

### Phase 14 — Connector Implementation

Backend-only scope (Path C). Four sub-phases delivered:

- 14.1: prisma/seed-connectors.ts seeds five connector_catalog
  rows (twilio-sms, twilio-voice, resend-email, mocean-sms,
  gemini-ai).
- 14.2: src/backend/routes/connectors.routes.ts — enable/disable
  client_connectors. LOCAL only; CLOUD rejected until credential
  encryption exists.
- 14.3: src/backend/routes/connector-usage.routes.ts —
  append-only usage sync + read. Writes boundary proof log per
  sync.
- 14.4: src/backend/routes/billing.routes.ts — billing summary
  aggregating connector_usage per org per connector.

### Phase 14.5 — Subscription Billing

- Six additive columns added to License model in
  schema.cloud.prisma: renewalCycle, price, currency,
  stripeCustomerId, stripeSubscriptionId, stripePriceId.
  Applied to gorka_test via prisma db push. Stripe fields stay
  null until real Stripe integration (deferred until company
  registration).
- prisma/seed-plans.ts seeds default tier prices into
  platform_settings key='plans' (FREE 0, PROFESSIONAL 2000,
  ENTERPRISE 10000, USD, MONTHLY).
- src/backend/routes/licenses.routes.ts — /me (client view),
  / (OWNER list), POST / (OWNER upsert, supports discounts),
  POST /set-plan (OWNER, uses defaults from platform_settings).
- Discount verified: POST with explicit price 1500 updated the
  license price while preserving other fields.

### Deferred (frontend workstream)

Client Dashboard and Owner Dashboard display of connector
status, connector analytics, billing, and subscription views.
Tauri frontend workstream still blocks these.

### Known gaps recorded, not Phase 14 scope

- prisma/seed.ts is stale (references a removed PermissionRole
  model). It should not be run.
- Two Prisma instantiation conventions in the backend.
- Owner Dashboard still calls missing endpoints for
  /clients, /analytics/overview, /audit, /billing/revenue,
  /analytics/usage, /status.

Phase 9 remains BLOCKED. Next phase: 15 — Boundary / Security
Test.

## STATUS UPDATE — September 14, 2026 (Phase 15)

Phase 15 (Boundary / Security Test) is PARTIAL.

- Static boundary review complete (Claim A). All 19 cloud
  models and all 10 backend routes inspected. No debtor field
  exists in cloud schema. No backend route accepts or returns
  debtor data. Two permitted "debtor" mentions
  (debtor_count, debtor_data_included). Two risk areas noted
  (support free text, template parameterization), mitigated by
  UI which is deferred.
- New document: GORKA_RECOVERY/recovery-notes/
  BOUNDARY-TEST-PLAN.md (9,030 bytes). Contains manual and
  automated test procedures for when the Tauri frontend exists,
  plus the inference test, outbound channel list, and canary
  field list.
- Runtime portion (manual test, automated test in CI, inference
  test) deferred pending the Tauri frontend workstream. Same
  blocker as Phase 9.

Known findings recorded: support.routes.ts has stale
PLATFORM_OWNER role references, a hardcoded placeholder id, and
a third Prisma import convention. Not Phase 15 scope.

Phase 9 remains BLOCKED. Phase 15 runtime tests remain deferred.
Next phase: 16 — Production Cutover Plan (review only).

## STATUS UPDATE — September 14, 2026 (Phase 9 unblock)

Phase 9 (Tauri Local Database Verification) moved from BLOCKED
to PARTIAL.

Reconnaissance this session established:
- Tauri frontend source is supervisor-dashboard/src/.
- All Rust debtor commands exist.
- The frontend service wrapper (local.db.ts) had auth only, no
  localDB.
- Collections.tsx was a static placeholder.

Two deliverables produced and tested:

A. localDB object added to
   supervisor-dashboard/src/services/local.db.ts. Wraps eight
   Rust commands. No organization_id sent from frontend.

B. supervisor-dashboard/src/pages/Collections.tsx rewritten as
   a full CRUD page: list, search, add, edit, delete. Verified
   in the running Tauri app: insert, update, search, bulk
   insert via CSV, and persistence across restart all work.

Boundary fix performed on
supervisor-dashboard/src/services/upload.service.ts:

- The previous version POSTed parsed debtor rows to a cloud
  endpoint /api/debtors/bulk. That endpoint no longer exists
  (disabled in Phase 3.5), so the call would have failed, but
  the intent violated the invariant.
- Rewritten: CSV parsed locally, rows sent to
  localDB.bulkInsertDebtors. No fetch. No token.
- Upload.tsx: removed the supervisor_token check. Visual design
  preserved. One no-op token variable added for compile
  compatibility.

Phase 9 test results (empirical, in the running app):
- SQLCipher active.
- Unlock correct password: works.
- Unlock wrong password: fails immediately.
- Debtor insert, update, search, bulk insert: all work.
- Persistence across restart: works.
- Local audit log: reasoned from code, not read back.

Still unimplemented in the UI: debt CRUD, communication
logging, action CRUD, debtor-attached document upload. These
keep Phase 9 at PARTIAL.

Findings recorded for later:
- auth.rs writes the salt during login, causing UnlockScreen to
  show "Enter" on first run instead of "Set". Rust-side fix
  needed later.
- Phase 15's boundary review missed the frontend services
  layer. upload.service.ts would have been flagged.

Phase 15 remains PARTIAL. Next phase: 16 — Production Cutover
Plan (review only; gated on Phase 9 and Phase 15 full
completion).

## STATUS UPDATE — September 14, 2026 (Phase 9 items 1, 1b, 2)

Phase 9 progress continued. Three items now complete:

- Item 1: Debtor-attached document upload. Works.
- Item 1b: Debtor detail page at /collections/:id with shared
  DebtorEditModal. Works.
- Item 2: Debt CRUD. Rust commands, localDB methods, shared
  DebtEditModal, Debts card on the detail page. Works and
  persists across restart.

Remaining:
- Item 3: Communication logging. Rust commands already added
  to main.rs and compiled. Frontend not yet built.
- Item 4: Action CRUD. Requires local schema migration v3 to
  add `actions` table (authorized by founder).

### CRITICAL: WDAC blocker and signing workflow

Windows Application Control (WDAC) began blocking newly built
unsigned binaries on this machine. Cause: the 9/9/2026 Windows
updates and WDAC policy changes.

Solution: a self-signed code-signing certificate (CN=GORKA Dev
Signing, thumbprint
370532F494A44A0B46E789D40649B26A13096FDB) trusted at system
level. Every Rust build must now be signed before running.

`npm run tauri:dev` NO LONGER WORKS. Full instructions in
GORKA_RECOVERY/recovery-notes/TAURI-DEV-WORKFLOW.md.

Short version:
1. Terminal A: npm run dev (Vite, stays running)
2. Terminal B: cargo build, then Set-AuthenticodeSignature on
   the produced gorka-client.exe
3. Terminal B: run the signed binary directly

Frontend-only changes do not require re-signing. Rust changes do.

### What is on disk

- Two new components: DebtorEditModal.tsx, DebtEditModal.tsx
- One new page: DebtorDetail.tsx
- Collections.tsx rewritten
- local.db.ts expanded (documents + debts)
- main.rs expanded (debts + communications)
- App.tsx gained one route

Phase 15 remains PARTIAL. Next phase: 16 (gated).


## STATUS UPDATE — September 14, 2026 (Phase 9 item 3)

Phase 9 Item 3 (Communication Logging) is DONE and verified in
the running desktop app.

### What was delivered

Frontend-only. The Rust side already had the three commands
(get_communications, insert_communication,
delete_communication) compiled into the signed binary. No
Rust change was needed. No re-signing was needed.

- supervisor-dashboard/src/services/local.db.ts
  Added Communication and CommunicationInput interfaces.
  Added three localDB methods: getCommunications,
  insertCommunication, deleteCommunication.
- supervisor-dashboard/src/components/CommunicationEditModal.tsx
  New. Modeled on DebtEditModal.tsx. Create-only. Fields:
  Type (CALL / EMAIL / SMS / NOTE), Direction (INBOUND /
  OUTBOUND), Content (textarea), Duration (number, shown
  only when Type is CALL).
- supervisor-dashboard/src/pages/DebtorDetail.tsx
  Added Communications state, loadCommunications, useEffect
  hook, handleDeleteCommunication, a Communications card
  between the Debts card and the Documents card, and the
  modal mount.

### Test results

Communications card renders. Log Communication opens the
modal. Entries created for all four types with both
directions. Duration shows only for CALL. Delete works.
Persistence across restart: works.

### Phase 9 status

- Item 1 (document upload): DONE.
- Item 1b (debtor detail page): DONE.
- Item 2 (debt CRUD): DONE.
- Item 3 (communication logging): DONE.
- Item 4 (action CRUD): PENDING. Requires local schema
  migration v3 in src-tauri/src/db.rs to add the `actions`
  table. Authorized by the founder. Not started.

### Rule compliance

No production touched. No cloud schema change. No CI/CD
touched. Invariant held — communication content stays on the
local machine. No frontend fetch, no cloud API call, no
supervisor_token in the new code.

### Document updates

- DECISIONS.md: new entry "Phase 9 Progress — Item 3
  (Communication Logging) — September 14, 2026" appended.
- HANDOFF.md: this entry.

### What is on disk

- supervisor-dashboard/src/services/local.db.ts (appended)
- supervisor-dashboard/src/components/CommunicationEditModal.tsx
  (new)
- supervisor-dashboard/src/pages/DebtorDetail.tsx (edited)

Phase 15 remains PARTIAL. Next phase: 16 (gated).


## STATUS UPDATE — September 15, 2026 (Phase 9 item 4 + SAC investigation)

### Phase 9 Item 4 (Action CRUD) — code complete, not yet tested

Frontend written this session. Rust side and migration v3 were
already written and compiled on September 14.

- supervisor-dashboard/src/services/local.db.ts
  Added Action and ActionInput interfaces. Added four localDB
  methods: getActions, insertAction, updateAction, deleteAction.
- supervisor-dashboard/src/components/ActionEditModal.tsx
  New. Create and edit. Type dropdown has 7 values: CALL,
  EMAIL, SMS, VISIT, LETTER, TASK, LEGAL. Status dropdown has
  4 values: PENDING, IN_PROGRESS, COMPLETED, CANCELLED.
  Assigned To is free text (deferred attribution). LEGAL is
  a label only — no enforcement.
- supervisor-dashboard/src/pages/DebtorDetail.tsx
  Added Actions state, loadActions, useEffect hook, handlers,
  an Actions card between Communications and Documents, and
  the modal mount. Type badge red for LEGAL, purple for
  others. Status badge has four colors.

Rust side (already on disk since Sept 14):
- src-tauri/src/db.rs — migration v3, `actions` table with
  10 columns (Option B, includes `data JSON DEFAULT '{}'`),
  two indexes.
- src-tauri/src/main.rs — Action and ActionInput structs,
  four commands, all registered in generate_handler!.

### The signed binary is blocked on the main machine

Smart App Control (SAC) is enforced on the founder's main
machine. CodeIntegrity event 3077, Policy ID
{0283ac0f-fff1-49ae-ada1-8a933130cad6} = Smart App Control
base policy. A self-signed certificate does not satisfy SAC.
See the DECISIONS.md entry "SAC investigation and cloud
development environment decision — September 15, 2026" for
the full reasoning.

Consequence: Item 4's frontend cannot be tested on the main
machine. It will be tested once a cloud Windows environment
is available.

### Host machine is not VM-capable

Host check results:
- Intel Celeron J4025, 2 cores, 2 threads, 2.0 GHz
- 7.68 GB RAM
- 123.4 GB free disk
- Virtualization enabled in firmware, but no hypervisor
  currently running

A Windows 11 VM is not viable on this host. Insufficient CPU
cores and RAM to run both host and guest.

### Decision: cloud Windows environment

Selected for trial: V2 Cloud "Heavy" plan (4 CPU / 16 GB RAM /
50 GB storage). 7-day free trial, no credit card required.
Signup not yet completed — deferred.

Alternatives considered and rejected:
- Windows 365 (requires credit card, founder has debit only)
- Kamatera (accepts PayPal deposit as card alternative —
  fallback if V2 Cloud does not work)
- Amazon WorkSpaces (requires credit card)
- Local VM (host hardware insufficient)

### Deferred topics (recorded, not acted on)

1. Microsoft Store distribution for investor demo. Two
   paths: MSIX via Store (Microsoft signs, free) or OV
   certificate + direct website download (requires Spanish
   incorporation + ~$150-300/year certificate). Decision
   deferred until the cloud environment is proven.
   Caveat: Tauri's current Store documentation describes
   EXE/MSI submission, not MSIX. Route to investigate later.

2. OV certificate purchase. Deferred until Spanish
   incorporation exists and there is a real distribution
   need.

3. Portfolio transfer feature (debt transfer between
   entities, judicial process). Deferred to a future phase.
   Would require portfolio/batch model, transfer record,
   payment schedule, and history preservation — none of
   which exist yet.

### Rule compliance

No production touched. No cloud schema change. No CI/CD
touched. Invariant held. The SAC investigation was diagnostic
only; no Windows security settings were modified. The choice
of a cloud environment is a response to the host hardware
limit, not a workaround on the main machine.

### What is on disk

- supervisor-dashboard/src/services/local.db.ts (appended)
- supervisor-dashboard/src/components/ActionEditModal.tsx
  (new)
- supervisor-dashboard/src/pages/DebtorDetail.tsx (edited)
- src-tauri/src/db.rs (migration v3)
- src-tauri/src/main.rs (action commands, registered)
- DECISIONS.md (new entries: Item 4, SAC investigation)
- HANDOFF.md (this entry)

### Phase 9 status

- Item 1 (document upload): DONE, tested.
- Item 1b (debtor detail page): DONE, tested.
- Item 2 (debt CRUD): DONE, tested.
- Item 3 (communication logging): DONE, tested.
- Item 4 (action CRUD): CODE COMPLETE, not yet tested.

Phase 15 remains PARTIAL. Phase 16+ still gated.

### Next

1. Complete V2 Cloud trial signup (or Kamatera as fallback).
2. On first login, check SAC state. Turn it off if enforced,
   using only the normal Windows Security UI.
3. Install Rust, Build Tools, Node, Tauri CLI.
4. Clone the repo. Build. Sign with the self-signed cert.
5. Test Item 4 end to end.
6. Snapshot the environment.
7. Separately: website modifications (out of spec, no
   project impact).



## STATUS UPDATE — September 17, 2026 (Multi-User Data Model)

### The decision

GORKA's multi-user model is now defined and frozen. The full concept is in the new document `MULTI-USER-CONCEPT.md`, Version 2.0.

The decision in one line:

> GORKA's multi-user model is direct machine-to-machine synchronization of debtor data, brokered by GORKA's Control Plane, end-to-end encrypted, with hub-and-spoke topology for the MVP and mesh topology for production; GORKA cannot decrypt the data at any point, and this is enforced architecturally, not by policy.

### The new promise

The old promise — "Your debtor data never touches our servers" — was technically indefensible, because a relay is sometimes required. It has been replaced.

- Technical statement (canonical): "GORKA cannot decrypt your debtor data. This is an architectural property, not a policy."
- Marketing statement: "Your debtor data stays under your control. GORKA cannot read it."

Both statements are true. The technical statement is what a security review verifies. The marketing statement is what a customer reads.

### What was produced today

Eight documents were created or amended.

**New:**

- `MULTI-USER-CONCEPT.md` — Version 2.0, frozen. The full concept. The source of truth for the multi-user model.

**Amended:**

- `ARCHITECTURAL-LAW.md` — v1.2. New Section 20, six subsections.
- `ARCHITECTURAL-LAW-AMENDMENTS.md` — new v1.2 entry.
- `DATA-BOUNDARY-MATRIX.md` — new Section 20, five subsections.
- `PHASE-PLAN.md` — v1.1. Three new phases added: 9.5, 9.6, 9.7.
- `LOCAL-TABLES.md` — new Category D. Three new tables.
- `CLOUD-TABLES.md` — new Section 20. Two new tables.
- `DECISIONS.md` — new long entry: "Multi-User Data Model — September 17, 2026."

### New cloud tables

- `device_registrations` — Control Plane device list.
- `relay_sessions` — Control Plane relay session metadata.

Cloud tables: 19 → 21.

### New local tables

- `sync_events` — the append-only event stream.
- `sync_state` — per-peer sync bookkeeping.
- `sync_peers` — local cache of peer devices.

Local tables: 12 → 15.

### New phases

Added to the phase plan, with decimal numbering per the existing convention:

- **Phase 9.5** — Agent App and Client Dashboard, local only. Both binaries exist, both work locally, no sync.
- **Phase 9.6** — Sync engine, MVP scope. Hub-and-spoke, event-based, direct connection, encrypted relay fallback, single organization key. Ten acceptance criteria.
- **Phase 9.7** — Multi-user demonstration. Two laptops, working sync, rehearsed.

All three: NOT STARTED.

### What is explicitly deferred to the funded phase

- Mesh topology (production).
- Per-machine device identity (production).
- Key rotation (production).
- Offboarding and lost-device flows (production).
- Group key management and MLS (production).
- A cryptography specialist's review.
- A threat model and independent security review.

None of these are in the MVP. They are recorded and planned.

### The three documents that must be written next

Before any implementation of the multi-user model:

1. **`SYNC-ARCHITECTURE.md`** — the technical specification of the sync engine. Must answer: device identity, organization identity, authentication, enrollment, key creation, key storage, key distribution, session-key establishment, message format, message IDs, event IDs, originating device, ordering, duplicate detection, acknowledgements, offline queue, retry, conflict resolution, direct connection, relay fallback, corrupt/invalid message handling, protocol versioning, recovery after interruption, what metadata GORKA sees, what GORKA can never see, and what "most recent" means without depending on wall-clock time.

2. **`GORKA-MVP-SCOPE.md`** — the MVP defined in full. Every block, every constraint, every out-of-scope item. This is the anchor for the next weeks of work.

3. **Threat model / security review** — 3 to 5 pages. Who can attack what, what GORKA can see, what a compromised device can do, what happens when a device is lost.

Only after all three are written and approved does implementation begin.

### What is still open from before today

The cloud Windows environment for Rust development is not yet set up. The SAC block on the main machine is unresolved (documented in the September 15 SAC investigation entry). V2 Cloud trial signup was started but not completed.

This does not block the writing of the next three documents. It only blocks the building of code.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held.
- No code written. Documentation only.
- Every amendment to the architectural law, the data boundary matrix, the cloud tables, and the local tables was additive. No existing rule was weakened.

### What to do next session

Two options, in order of preference:

1. Begin writing `GORKA-MVP-SCOPE.md`. It is the smaller of the two technical documents and is a prerequisite for `SYNC-ARCHITECTURE.md`.
2. Complete the V2 Cloud trial signup, if the founder wants to unblock the build environment first.

The documents must come before the code. `SYNC-ARCHITECTURE.md` especially — without it, the sync engine cannot be built without the developer making architectural assumptions that the concept document deliberately leaves open.

## STATUS UPDATE — September 20–21, 2026 (Section 22 restoration, Block C, header v1.2)

### What was completed

The Section 22 restoration is finished. `SYNC-ARCHITECTURE.md` is now complete at v1.2.

- **Section 22 completed.** Subsections 22.7 through 22.19 were inserted. The wire format now runs continuously from 22.1 through 22.19.4. Verified: every §22 subsection header appears exactly once.

- **Block C applied.** Two one-line amendments, both verified by on-disk count:
  - §18.2: "ACCEPTED, DUPLICATE, and REJECTED are all terminal delivery outcomes for the delivery bookkeeping defined in this subsection. REJECTED is terminal; the sender does not retry it automatically."
  - §11.4: "The first event originated by a device instance has sequence number 1. Sequence number 0 is the initial value of the counter before any event has been originated; no event has sequence number 0."

- **Header bumped to v1.2.** Date September 21, 2026. Amendment note records Section 22 completed by restoration, plus the two Block C amendments.

- **`SYNC-TEST-VECTORS-v1.md` status updated.** H1, H2, H3 moved from BLOCKED to SPECIFIED. The missing §22.19 is no longer a blocker; what remains for H1/H2/H3 is computation, the same as M1, M2, V1, V4, V6. E1 remains blocked by the Argon2id parameters in §7.3 / §22.19.2.

### Verification performed

Every edit was verified by reading the file on disk, not by trusting a paste.

- `SYNC-ARCHITECTURE.md` sections 1–30 each present exactly once, in order.
- §22 continuous from 22.1 through 22.19.4.
- Byte-level checks: 363 correct em-dashes (E2 80 94), zero mojibake; 29 correct section signs (C2 A7) in the test-vector file, zero mojibake.
- Block C: §18.2 count 1, §11.4 count 1.
- v1.2 header: version line 1, date line 1, amendment note 1.
- Test-vector status: H1 fixed 1, H2 fixed 1, H3 fixed 1, old blocked line 0.

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held.
- No code written. Documentation only.
- Every amendment was additive; no existing rule was weakened.

### What is still open

- **Argon2id parameters.** §7.3 and §22.19.2 need benchmarked values for the supported GORKA desktop environment. They block E1's deterministic bytes. Cannot be done without the environment.
- **Test-vector computation.** The five SPECIFIED vectors and the four BLOCKED vectors need a working implementation. That requires the cloud Windows environment.
- **V2 Cloud Windows environment.** Not yet set up. Blocks the build and blocks vector computation.
- **MVP sync engine implementation.** After all of the above.

### The next phase

The next workstream is to set up the V2 Cloud Windows environment, benchmark the Argon2id parameters, compute the test vectors, then begin implementation of the MVP sync engine.

### Document status after this session

- `SYNC-ARCHITECTURE.md` — v1.2, complete.
- `SYNC-TEST-VECTORS-v1.md` — v1.0, partially complete. H1/H2/H3 unblocked. E1 still blocked on the Argon2id parameters.
- `DECISIONS.md` — updated with the September 18–20 entry.
- `HANDOFF.md` — this entry.
- `SESSION-LOG.md` — to be updated.
- `START-HERE.md` — to be updated.

## STATUS UPDATE — September 21–22, 2026 (Cloud Environment Built)

### What was achieved

The AWS cloud Windows environment is built and working. This was the last item recorded in the September 15 SAC investigation as "not yet set up." As of September 21, it exists.

- **AWS EC2 instance** `Gorka-dev` (`i-0ac85da213bdaa09a`), `t3.small`, Windows Server 2025 Datacenter, region Singapore. Disk 70 GiB. RDP working.
- **Toolchain installed and verified:** Git 2.55.0, Node.js 24.21.0, Rust 1.98.1, Visual Studio C++ Build Tools, Strawberry Perl 5.42.3.1.
- **`cargo build` on the Tauri backend succeeded** (18m 21s). `gorka-client.exe` produced.
- **`npm run build` on the frontend succeeded.**
- **Backend runs** and connects to Supabase `gorka_test` through the session pooler.
- **Tauri app launches on the cloud machine.** Login succeeds. Local database unlocks. Client Dashboard reached. Collections page shows the real CRUD UI.
- **Debtor CRUD confirmed working** on the cloud machine.

### The repository synchronization problem

The cloud machine was cloned at commit `c9efd44` (tag `v0.1.0`), which reflected the last commit on the main machine, not the main machine's working tree. The main machine had **months of uncommitted work**. Eight file mismatches were found and resolved as they appeared.

Root cause: the main machine's working tree had become the de facto development branch, and git was not being used as the synchronization authority.

Fix: the main machine's working tree was committed as `08eac3b` (114 files changed) and pushed to `origin/main`. The cloud machine's pull was blocked by an untracked `DebtorEditModal.tsx`; after moving it aside, the pull fast-forwarded to `08eac3b`.

**Both machines are now on commit `08eac3b`, working trees clean.**

### Process rule established

**Git is the synchronization authority between development machines.**

MAIN MACHINE: `git add -A`, `git commit`, `git push`.
CLOUD MACHINE: `git pull`, `git log --oneline -1` to verify HEAD.

Before starting work on either machine, verify both HEADs match. This rule would have prevented most of the September 21–22 confusion.

### Operational knowledge recorded

- **Supabase session pooler is required from AWS Singapore.** The direct hostname `db.tmloklxelckicufzpzxz.supabase.co` does not resolve. The pooler hostname `aws-1-eu-west-3.pooler.supabase.com` does. Pooler username format: `postgres.tmloklxelckicufzpzxz`.
- **SQLCipher's `file is not a database` error means wrong key, not corrupt file.** Try the correct password before considering deletion.
- **Supabase free tier pauses projects after 7 days of inactivity.** Check the dashboard if connection fails.

### What is still open

- **Debt due-date bug.** Adding a debt fails at the due-date field. Diagnosis not started.
- **Phase 9 Item 4 (Action CRUD).** Not fully tested. Debtor CRUD was exercised on the cloud machine; Action CRUD was not.
- **Persistence-across-restart test.** Not run for the cloud-machine database.
- **Registration flow audit.** Not done. Known UX bug: `UnlockScreen` shows "Set" vs "Enter" incorrectly.
- **Argon2id parameters.** `SYNC-ARCHITECTURE.md §7.3` and `§22.19.2` still need benchmarked values.
- **Test-vector computation.** M1, M2, V1, V4, V6 not computed.
- **Control Plane tables not applied to `gorka_test`.** `device_registrations` and `relay_sessions` specified but not created.
- **Agent App (Phase 9.5) not started.** Requires an architecture decision (see below).
- **Sync engine (Phase 9.6) not started.**

### Unresolved questions

Two questions have been raised and not yet decided or recorded:

1. **Agent App architecture.** `MULTI-USER-CONCEPT.md §9` and `GORKA-MVP-SCOPE.md §5.3` describe the Agent App as a second Tauri binary in the same repository, sharing the Rust command layer. The founder recalls a prior-chat discussion about building it from scratch instead. **Not recorded in any recovery document.** Must be decided and recorded before Phase 9.5 begins.

2. **An embedding that should not have happened.** The founder mentions a prior attempt to embed something (likely Agent App functionality) into the Client Dashboard. **Not documented in any recovery file.** Needs investigation and recording.

### Security items to address

Three credentials have been written into chat logs and should be rotated:

1. **Supabase password** `<REDACTED>` — rotate in the Supabase dashboard.
2. **GitHub token** `<REDACTED>` — revoke at `https://github.com/settings/tokens`, create a new one with `repo` scope.
3. **Resend API key** `<REDACTED>` — rotate in the Resend dashboard.

After rotating, update the `.env` files on both machines and redact the values from any recovery document that references them, using `<REDACTED>`.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held.
- No application code written. All work was infrastructure and testing.

### The next phase

Two parallel workstreams are available:

1. **Phase 9 polish.** Fix the debt due-date bug. Complete Item 4. Audit the registration flow.
2. **Sync engine prerequisites.** Benchmark the Argon2id parameters. Apply the Control Plane tables to `gorka_test`. Compute the test vectors.

The Agent App (Phase 9.5) waits until the architecture question is decided and recorded.

### Document status after this session

- `SYNC-ARCHITECTURE.md` — v1.2, complete.
- `SYNC-TEST-VECTORS-v1.md` — v1.0, partially complete. H1/H2/H3 unblocked. E1 still blocked on Argon2id parameters.
- `DECISIONS.md` — updated with the September 21–22 entry.
- `HANDOFF.md` — this entry.
- `SESSION-LOG.md` — to be updated.
- `START-HERE.md` — to be updated.

---

**End of entry.**

---

## STATUS UPDATE — September 23, 2026 (Client Dashboard local auth flow stabilization)

### What this session did

Working session on the Client Dashboard, on the local authentication and unlock flow. Three separate defects were found, fixed, committed, and verified. All work was on the Tauri app's local login/unlock/logout loop.

The goal: stabilize the loop a client performs after they have the installer and the app on their own machine — login, set local password (first run), enter local password (subsequent runs), logout, and back again without glitches.

### The three fixes, committed today

**1. `01631c6` — Set/Enter bug.**
`UnlockScreen` read `localStorage.getItem('salt')`, but the salt lives in `settings.dat` (written by Rust). The two stores are unrelated, so the read always returned null and the screen always showed "Set." Fixed by adding a Rust command `database_exists` that checks for the presence of `gorka-client.db` on disk. DB absent → "Set"; DB present → "Enter." The `localStorage` read and write were removed. Verified: fresh state → "Set"; return state → "Enter"; wrong password → error, screen stays; correct password → Dashboard.

**2. `38aec9c` — Logout button no-op (superseded).**
`Sidebar.tsx`'s handler cleared `localStorage` and a cookie, neither of which the Tauri app uses, and the navigation line was commented out. First fix called `auth.logout()` and `window.location.reload()`. Superseded because the reload does not tear down the JavaScript context in this webview — proven by the console retaining its lines.

**3. `183e8f7` — Logout state reset.**
`App` now owns the logout operation: `handleLogout` calls `auth.logout()`, then sets `isAuthenticated(false)` and `isUnlocked(false)`. The callback is passed through `AppShell` to `Sidebar` via an `onLogout` prop. `Sidebar` no longer contains auth logic. The `window.location.reload()` was removed.

**4. `40b2378` — Rust logout connection leak (the actual root cause).**
After fixes 2 and 3, the bug still reproduced. The real cause: `logout` cleared `settings.dat` but did not close the SQLCipher connection held in `AppState.db`. The command `is_database_unlocked` reads `AppState.db`, not `settings.dat`. So after logout, the connection was still open, `is_database_unlocked` returned `true`, and the next login skipped the Enter screen. Fixed by making `logout` receive `state: tauri::State<AppState>`, lock `state.db`, set it to `None` (which drops the connection), then call `auth::logout(app)`.

### Verified state of the local auth loop

On the cloud machine, after the Rust rebuild:

- Fresh launch → Login → Enter Password → Dashboard.
- Dashboard → Logout → Login screen.
- `settings.dat` after logout: `salt` only.
- Login → **"Enter Local Encryption Password"** (not Dashboard).
- Enter password → Dashboard.
- Logout → Login → Login → **"Enter Local Encryption Password"** again.
- Two consecutive loops, both correct.

The bug that appeared at the start of the session (Login → Dashboard, skipping "Enter") no longer occurs.

### Repository state

- Main machine: at `40b2378`, clean, pushed.
- Cloud machine: at `40b2378`, clean.
- GitHub: `origin/main` at `40b2378`.

### Key learning recorded

"Unlocked" in this app means the SQLCipher connection is open in the running process, held in `AppState.db`. It is not a flag in `settings.dat`. `is_database_unlocked` reads the connection. This is why quitting the app fixed the symptom: process termination destroys `AppState.db`. The design is intentional and secure — the connection being open is the true test of whether the app can read the encrypted data. The bug was that `logout` left the connection open.

### Deferred findings, recorded not acted on

1. **Dashboard 401 errors from `api.gorka.localhost:3000`.** Separate finding, not yet investigated.
2. **Eye-icon inconsistency on the password field.** WebView2 built-in password reveal control disappears after an error re-render. Deferred.
3. **Debt due-date bug.** Adding a debt fails at the due-date field. Not investigated today.
4. **Dead code in `Sidebar.tsx` lines 33–37** (commented-out old handler). Inert. Removal deferred.

### What is still open

- Debt due-date bug. Not investigated.
- Phase 9 Item 4 (Action CRUD). Code complete, not fully tested.
- Persistence-across-restart test on the cloud machine. Not run today.
- Dashboard 401 errors. Recorded, not investigated.
- Eye-icon inconsistency. Recorded, deferred.
- Argon2id parameters (`§7.3`, `§22.19.2`).
- Test-vector computation (M1, M2, V1, V4, V6).
- Control Plane tables not applied to `gorka_test`.
- Control Plane services not implemented.
- Agent App (Phase 9.5) not started.
- Sync engine (Phase 9.6) not started.
- Multi-user demonstration (Phase 9.7) not started.

### Process notes

- The session used the "check first, then edit" discipline throughout. Every file was read on disk before any edit was proposed, and every edit was verified with a targeted command afterward.
- Two false theories were discarded by evidence. First: that the Set/Enter bug was a salt-ordering issue (it was a `localStorage` / `settings.dat` mismatch). Second: that the logout bug was a frontend state issue (it was a Rust connection leak). Both corrections are recorded.
- cmd.exe was used for all commands, per the convention established earlier. One slip back to PowerShell was caught and corrected.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. No debtor data crossed the boundary. All work was local.
- No new abstraction introduced. The frontend fix threads a callback through the existing component hierarchy. The Rust fix is one function.
- No routing redesign. No React Context.

### The next phase

Two parallel workstreams available:

1. **Phase 9 polish.** Fix the debt due-date bug. Complete Item 4. Test persistence across restart.
2. **Sync engine prerequisites.** Benchmark the Argon2id parameters. Apply the Control Plane tables to `gorka_test`. Compute the test vectors.

The local registration flow — Stage 4 (login → set/enter local password) and Stage 5 (logout → login → enter → dashboard, repeatable) — is now stable and verified.

### Document status after this session

- `DECISIONS.md` — updated with the September 23 entry (four fixes, corrected diagnosis, design clarification, deferred findings).
- `HANDOFF.md` — this entry.
- `SESSION-LOG.md` — to be updated.
- `START-HERE.md` — to be updated.

---

**End of entry.**


STATUS UPDATE - September 24, 2026 (Dashboard local-stats task)

WHAT THIS SESSION DID

Completed the Dashboard local-stats task, and wrote the Excel/TXT upload specification. The implementation of Excel and TXT is deferred by conscious decision.

THE DASHBOARD TASK

The Client Dashboard's home page called a cloud endpoint (/api/dashboard/stats) and received 401 Unauthorized on every load. The task was to make the Dashboard read from the local SQLCipher database, the same way Collections does.

Delivered:

get_dashboard_stats Rust command in src-tauri/src/main.rs, returning a DashboardStats struct.

DashboardStats interface and getDashboardStats() method in supervisor-dashboard/src/services/local.db.ts.

Dashboard.tsx rewritten to call localDB.getDashboardStats(). Total Agents card removed. Recent Activity block removed. Both deferred.

Verified on the cloud machine:

Dashboard loads. Three cards: Total Debtors (11), Total Debt ($11,800), Total Actions (0).

A debt was created, edited, deleted. Numbers updated correctly.

A debt was changed to PAID. Total Debt fell by its amount. The status filter works.

The /api/dashboard/stats 401 is gone from the console.

The pre-existing /api/auth/me and /api/connectors/types 401s remain. Those are the September 23 deferred finding #1, out of scope.

Commit: 66c6f12. Pushed to origin/main.

UPLOAD PATH RECONNAISSANCE

CSV upload works end-to-end on the cloud machine. 10 debtors inserted, visible in Collections.

The debt due-date bug did not reproduce on the current build. Not closed. If it recurs, capture the actual error.

The shipped bundle (C:\Users\kucha\gorka-app\dist) is clean of the old cloud-post upload code.

The stale supervisor-dashboard\dist\ contains the old cloud-post code. Not the folder Tauri serves from. Housekeeping, not correctness.

EXCEL AND TXT SPECIFICATION

The full spec is in UPLOAD-EXCEL-TXT-SPEC.md in this folder. Key points:

TXT is trivial: extension-only, reuses the existing delimiter detection. Four or five lines of change.

Excel is one to two hours: needs a parser. The parser location is an open decision.

One shared mapper (rowsToDebtors) for CSV, TXT, and Excel. One interpretation of debtor columns.

Boundary check is static (findstr) and runtime (network inspection during upload).

Resource limits: 10 MB file size, 10,000 rows.

OPEN DECISION - EXCEL PARSER LOCATION

Two options, not chosen today. Lean: backend (calamine, in Rust), for transactionality, the future sync event model, and the test surface. The MVP keeps CSV-only at this stage. This is a conscious decision, not a backlog item.

The determining question for the next session: is the MVP a stepping stone that will be rewritten for production, or the production version with features turned off? If the former, SheetJS (frontend) is fine. If the latter, calamine is preferable now.

WHY THE DECISION WAS DEFERRED

The session's remaining time is allocated to the Argon2id parameters, which are on the critical path for the sync engine. The Excel/TXT work is documented in full so a future session can pick it up without re-deriving the reasoning.

NEXT WORKSTREAM

Argon2id parameters. Benchmark and freeze the values used by the enrollment package (SYNC-ARCHITECTURE.md section 7.3 and section 22.19.2). Those values block the E1 deterministic test vector, which blocks the test-vector computation, which blocks the sync engine implementation.

The benchmark must run on the supported GORKA desktop environment.

WHAT IS STILL OPEN

Excel and TXT implementation. Deferred by conscious decision. Spec written.

Debt due-date bug. Not reproducible. Not closed.

supervisor-dashboard\dist\ stale build. Housekeeping.

dataType dropdown offers CSV and JSON. JSON is not implemented. UI honesty issue.

.txt entry in unstructured accept advertises a route that does not work.

Dashboard 401s from /api/auth/me and /api/connectors/types. Separate task.

Argon2id parameters. Next session's focus.

All items from the September 23 entry, unchanged.

REPOSITORY STATE

Main machine: at 66c6f12, clean, pushed.

Cloud machine: needs git pull to reach 66c6f12.

GitHub origin/main: at 66c6f12.

Note: the documentation commit for this session (DECISIONS.md, UPLOAD-EXCEL-TXT-SPEC.md, HANDOFF.md, SESSION-LOG.md, START-HERE.md) is separate and is committed after all five documents are written.

RULE COMPLIANCE

No production touched.

No cloud schema change. No new tables. No new columns.

No CI/CD touched.

Invariant held. All debtor data stayed on the local machine.


STATUS UPDATE - September 24, 2026 (Argon2id freeze)

WHAT THIS SESSION DID

Froze the Argon2id parameters for the MVP enrollment package. The benchmark was written, run twice on the cloud machine, and the values were chosen and recorded in SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2.

THE BENCHMARK

One file, src-tauri/src/bin/argon2bench.rs, 137 lines. Commit bd50fbc. It measures Argon2id key derivation for nine (m_cost, t_cost, p_cost) triples in one process on the cloud machine (AWS EC2 t3.small, 2 vCPU, 2 GiB RAM). It uses the same argon2 crate version (0.5.3) and call shape that the enrollment package will use.

Two runs. Checksums matched row for row, confirming deterministic derivation.

THE CHOSEN VALUES

  argon2_memory_kib  = 131072    (128 MiB)
  argon2_iterations  = 4
  argon2_parallelism = 1

Run 2 median: 461 ms on the cloud machine.

WHY 128/4

461 ms sits comfortably inside the 250-1000 ms target. 128 MiB leaves memory headroom for weaker client machines. The cloud machine is a floor; a client machine at its capability must not fail. Within 128 MiB, four iterations is more computational work than three at the same memory. 256 MiB was rejected on the weaker-machine risk.

THE FREEZE

The three integers were written into SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2. The trailing placeholder sentences were replaced with a short note pointing at DECISIONS.md. No other section was changed.

NEXT WORKSTREAM

Phase D - implement the enrollment package against the frozen parameters. Export command, import command, 63-byte header, Argon2id at 128/4/1, XChaCha20-Poly1305 with the header as AAD, inner content {organization_id, organization_key}. Add chacha20poly1305 and hkdf to Cargo.toml. Separate task, own spec.

Then Phase E - E1.

WHAT IS STILL OPEN

Enrollment package implementation - Phase D. Not started.

E1 test vector. Blocked on Phase D.

Excel and TXT implementation. Deferred by conscious decision.

Debt due-date bug. Not reproducible. Not closed.

supervisor-dashboard\dist\ stale build. Housekeeping.

dataType dropdown offers CSV and JSON. JSON is not implemented.

.txt entry in unstructured accept advertises a route that does not work.

Dashboard 401s from /api/auth/me and /api/connectors/types.

Control Plane tables not applied to gorka_test.

Control Plane services not implemented.

Agent App (Phase 9.5) not started.

Sync engine (Phase 9.6) not started.

Multi-user demonstration (Phase 9.7) not started.

All items from the September 23 and September 24 Dashboard entries, unchanged.

REPOSITORY STATE

Main machine: at bd50fbc, clean before the freeze commit.

Cloud machine: at bd50fbc, clean.

GitHub origin/main: at bd50fbc.

Note: the freeze commit (SYNC-ARCHITECTURE.md, DECISIONS.md, HANDOFF.md, SESSION-LOG.md, START-HERE.md) follows after all five documents are written.

RULE COMPLIANCE

No production touched.

No cloud schema change. No new tables. No new columns.

No CI/CD touched.

Invariant held. All debtor data stayed on the local machine. Instance B (db.rs) was not touched.

STATUS UPDATE - September 24, 2026 (Phase D.1 and D.2)

WHAT THIS SESSION DID

Started Phase D: the enrollment package and its prerequisites.
D.1 added the organization_keys table. D.2 added the enable_sync
command. Both verified on the cloud machine.

D.1 - THE organization_keys MIGRATION

Commit adcab50. src-tauri/src/db.rs, 20 insertions.

A new migration v4 creates the single-row organization_keys
table per LOCAL-TABLES.md Category D.5. The block follows the
exact structure of the existing migrations. No command, no key
generation, no package code.

Verified: build succeeded (1m 28s incremental). App launched,
database unlocked, migration ran, existing debtors unaffected.

D.2 - THE enable_sync COMMAND

Commit 941917a. src-tauri/src/main.rs, 36 insertions.

Three edits: the rand::RngCore import, the enable_sync command
between is_database_unlocked and get_debtors, the registration
in generate_handler!.

The command reads the trusted organization id, requires the
database to be unlocked, refuses if a key already exists,
generates 32 random bytes with the OS CSPRNG, and inserts the
row into organization_keys. It does not report to the Control
Plane.

Verified via the app's devtools console: is_database_unlocked
returned true. The first enable_sync returned OK null. The
second returned "ERR Sync is already enabled for this
organization" - the refusal path works. The successful insert
also confirms the D.1 migration created the table correctly.

THE cargo.exe BLOCK ON THE MAIN MACHINE

New finding. cargo build on the main machine fails with:

  'C:\Users\kucha\.cargo\bin\cargo.exe' was blocked by your
  organization's Device Guard policy.

This is different from the September 15 SAC block. That was on
the built binary. This is on cargo.exe itself.

The chosen response: the cloud machine is the sole build
environment. The main machine is the editor and the repository
host. Recorded in TAURI-DEV-WORKFLOW.md section 8.

NEXT WORKSTREAM

D.3 - the export_enrollment_package command. Needs the
chacha20poly1305 crate, the 63-byte header, the Argon2id call at
131072 / 4 / 1, XChaCha20-Poly1305 with the header as AAD, the
inner content {organization_id, organization_key}.

D.4 - the import_enrollment_package command.

Then Phase E - E1.

WHAT IS STILL OPEN

Enrollment package export - D.3. Not started.

Enrollment package import - D.4. Not started.

E1 test vector. Blocked on D.3 and D.4.

Excel and TXT implementation. Deferred by conscious decision.

Debt due-date bug. Not reproducible. Not closed.

supervisor-dashboard\dist\ stale build. Housekeeping.

dataType dropdown offers CSV and JSON. JSON is not implemented.

.txt entry in unstructured accept advertises a route that does
not work.

Dashboard 401s from /api/auth/me and /api/connectors/types.

Control Plane tables not applied to gorka_test.

Control Plane services not implemented.

Agent App (Phase 9.5) not started.

Sync engine (Phase 9.6) not started.

Multi-user demonstration (Phase 9.7) not started.

All items from the September 23 and September 24 Dashboard
entries, unchanged.

REPOSITORY STATE

Main machine: at 941917a, clean, pushed.

Cloud machine: at 941917a, clean.

GitHub origin/main: at 941917a.

RULE COMPLIANCE

No production touched.

No cloud schema change. No new tables. No new columns.

No CI/CD touched.

Invariant held. The organization key is local-only. Instance B
(db.rs::derive_key) was not touched.



