
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

STATUS UPDATE - September 24-25, 2026 (Phase D.3 and D.4.1)

WHAT THIS SESSION DID

Completed D.3, the export_enrollment_package command. Wrote
D.4.1, the import_enrollment_package function. D.4.1 compiles.
D.4.2 through D.4.4 remain.

D.3 - THE EXPORT COMMAND

Commits d3e5fee (crate), edbaa3a (imports), 5be2599 (command
and registration), d426bba (Cargo.lock).

Added the chacha20poly1305 crate. Added the export command,
which builds the 63-byte header, derives the key with Argon2id
at 131072 / 4 / 1 with the raw 16-byte salt, encrypts with
XChaCha20-Poly1305 using the full header as AAD, and writes the
package file.

Verified on the cloud machine via devtools. The export produced
a 140-byte file. The arithmetic: 63 header + 4 org_id_len + 25
org_id + 32 org_key + 16 tag = 140. Every byte accounted for.

The bytes are not yet verified against a fixed expected output.
That is E1 in Phase E.

D.4.1 - THE IMPORT FUNCTION

Commits dc7bd54 (the function), 70b8cd8 (the borrow fix).

The function reads the package, verifies magic/version/length,
derives the key with the parameters from the header, decrypts
with the header as AAD, parses the inner content, rejects
trailing bytes, compares the organization id before the
transaction, refuses if a key already exists, inserts the key
atomically, and deletes the package after commit.

Not yet registered in generate_handler!. That is D.4.2.

The first compile failed with E0596, the borrow error. Fixed in
70b8cd8. The cloud build then succeeded in 54.83s.

NEXT WORKSTREAM

D.4.2 - register import_enrollment_package in
generate_handler!.

D.4.3 - build with the registration.

D.4.4 - test the import via devtools.

Then Phase E - E1.

WHAT IS STILL OPEN

Enrollment package import - D.4.2 through D.4.4. Not done.

E1 test vector. Blocked on D.4.

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

check-columns.ts, untracked, on the cloud machine only. A
leftover diagnostic from September 22. Not part of any phase.
Left in place.

All items from the September 23 and September 24 Dashboard
entries, unchanged.

REPOSITORY STATE

Main machine: at 70b8cd8, clean, pushed.

Cloud machine: at 70b8cd8, clean.

GitHub origin/main: at 70b8cd8.

RULE COMPLIANCE

No production touched.

No cloud schema change.

No CI/CD touched.

Invariant held. The organization key is local-only. Instance B
(db.rs::derive_key) was not touched.

STATUS UPDATE - September 25, 2026 (Phase D.4.2 through D.4.4)

WHAT THIS SESSION DID

Completed Phase D. D.4.2 registered the import_enrollment_package
command in generate_handler!. D.4.3 built with the registration
on the cloud machine. D.4.4 tested the import via the devtools
console. All three steps completed and verified.

Phase D is now complete. D.1 through D.4.4 are all done.

D.4.2 - REGISTRATION

Commit b5af889. One file, one insertion: src-tauri/src/main.rs.

A single line added to the generate_handler! block, after the
existing export_enrollment_package registration:

  import_enrollment_package,

Twelve spaces of indent. Trailing comma. No comma adjustment
elsewhere.

The function and its #[command] attribute were already in place
from D.4.1. The registration was the only change.

The edit was verified on disk before committing, with findstr
and with a PowerShell read of the handler block. The staged
diff showed exactly one insertion. One file. One line.

D.4.3 - BUILD

The commit was pushed, pulled on the cloud machine, and built
there. The main machine cannot compile (TAURI-DEV-WORKFLOW.md
section 8).

  cargo build

Result: Finished dev profile [unoptimized + debuginfo] target(s)
in 1m 17s. No errors, no warnings.

D.4.4 - IMPORT TEST

Test conditions: backend running against gorka_test through the
session pooler with the inline DATABASE_URL override; Vite dev
server running; gorka-client.exe running, logged in, database
unlocked, Dashboard reached; devtools console open.

The Tauri global was not window.__TAURI__.core in this build.
The working form:

  const invoke = window.__TAURI_INTERNALS__.invoke;

Preconditions:

  await invoke('is_database_unlocked');
  -> true

  await invoke('get_organization_id');
  -> 'cmty0xrxw0000c4q4mvtpqjqv'

The org id is 25 characters, matching the D.3 package
arithmetic.

  await invoke('enable_sync');
  -> "Sync is already enabled for this organization"

A key exists. The handoff's predicted path is the one tested.

The import call:

  await invoke('import_enrollment_package', {
    passphrase: 'test-passphrase-001',
    filePath: 'C:\\gorka-app\\test-package.gorka'
  }).then(r => ({ ok: true, value: r }))
    .catch(e => ({ ok: false, error: e }));

Result:

  { ok: false, error: 'Sync is already enabled for this
    organization' }

The refusal is the expected outcome. It proves every stage
before the refusal ran to completion: the file was read, the
63-byte header was verified, the Argon2id derivation ran, the
XChaCha20-Poly1305 decryption succeeded, the inner content was
parsed, the trailing-byte check passed, the organization id
comparison passed, and the function refused at the "key already
exists" check inside the transaction.

The success path (no key present, install and delete) was not
tested, because a key exists and removing it is out of scope.

The package file was not deleted, because the refusal path does
not commit. C:\gorka-app\test-package.gorka remains, 140 bytes.

PHASE D STATUS

All of Phase D is complete:

- D.1 organization_keys migration (adcab50)
- D.2 enable_sync command (941917a)
- D.3 export_enrollment_package (d3e5fee, edbaa3a, 5be2599,
  d426bba)
- D.4.1 import_enrollment_package function (dc7bd54, 70b8cd8)
- D.4.2 registration (b5af889)
- D.4.3 build (1m 17s)
- D.4.4 import test (refusal path)

WHAT IS STILL OPEN

E1 test vector. Unblocked now that the package exists.

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

check-columns.ts, untracked, on the cloud machine only.

All items from the September 23 and September 24 entries,
unchanged.

REPOSITORY STATE

Main machine: at b5af889, clean, pushed.

Cloud machine: at b5af889, clean, built.

GitHub origin/main: at b5af889.

RULE COMPLIANCE

No production touched.

No cloud schema change.

No CI/CD touched.

Invariant held. The organization key is local-only. Instance B
(db.rs::derive_key) was not touched.

STATUS UPDATE - September 25, 2026 (Phase E, E1-E6)

WHAT THIS SESSION DID

Completed the enrollment-package test vectors, E1 through E6.
All six tests pass on the cloud machine with cargo test.

Phase E is not complete. It is the test-vector phase. E1-E6 are
the enrollment-package family. H1, H2, H3, M1, M2, V1, V4, and
V6 remain.

E1 - THE DETERMINISTIC KNOWN-ANSWER TEST

Commits 4db59fc (extraction and Phase 1 test), 4a8cd0f (vector
and Phase 2 assertion), 76f4544 (hex decode).

The package construction was extracted from
export_enrollment_package into build_enrollment_package. The
production command keeps its behavior: salt and nonce from
OsRng, then a call to the shared function. The shared function
takes salt and nonce as explicit inputs and generates nothing.

The E1 test calls the shared function with fixed fixtures and
asserts the result. The package is 125 bytes. The recorded
reference value is in SYNC-TEST-VECTORS-v1.md, E1 entry,
recorded as SPECIFIED / FROZEN.

Note on size: the E1 package is 125 bytes, not 140. The D.3
test produced 140 because it used the real 25-byte org id. E1
uses organization_id_A, 10 bytes. The difference is the org id
length. Recorded in the vectors file.

Two transcription errors are recorded in DECISIONS.md: a
124-byte hand-written array, and a 126-byte hex in the vectors
file. The fix was to stop transcribing by hand. The test now
decodes the hex with hex::decode, and the vectors file's hex
was compared against main.rs with fc.exe. Byte-identical.

E2-E6 - THE IMPORT BEHAVIORAL TESTS

Commits ee496e9 (extraction and tests), 77b8aa1 (import fix).

The parsing logic was extracted from import_enrollment_package
into parse_enrollment_package. It takes file bytes, passphrase,
and trusted org id; it returns the 32-byte key or an error
string. No I/O, no database. The production import command
reads the file, calls the parser, and installs the key.

Five tests:

  E2  correct passphrase              returns the key
  E3  wrong passphrase                "Wrong passphrase or corrupted package"
  E4  tampered payload                "Wrong passphrase or corrupted package"
  E5  organization mismatch           "Organization mismatch"
  E6  wrong magic                     "Invalid package: bad magic bytes"

E3 and E4 assert the same message. That is deliberate: the AEAD
cannot distinguish a wrong passphrase from a tampered payload.

All six tests share the E1 package through a helper,
e1_package(). The E1 test uses the same helper.

WHAT IS STILL OPEN

H1, H2, H3 - the session-key derivation and handshake proof
tags. Their vectors entry still says BLOCKED, but that is
stale: SYNC-ARCHITECTURE.md 22.19 now contains the HKDF labels,
restored on September 20-21. H1-H3 need their own spec, in the
style of the E1 spec. They need two crates not yet in
Cargo.toml: hkdf and hmac.

M1, M2, V1, V4, V6 - specification done, expected bytes not
computed.

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

check-columns.ts, untracked, on the cloud machine only.

test-package.gorka, untracked, on the cloud machine only. The
D.3 test package. Not deleted, because the D.4.4 refusal path
did not commit.

All items from the September 23 and September 24 entries,
unchanged.

REPOSITORY STATE

Main machine: at 77b8aa1, clean, pushed.

Cloud machine: at 77b8aa1, clean.

GitHub origin/main: at 77b8aa1.

RULE COMPLIANCE

No production behavior changed. Both production commands keep
their observable behavior; only their internal structure was
refactored.

No cloud schema change.

No CI/CD touched.

Invariant held. The organization key is local-only. Instance B
(db.rs::derive_key) was not touched.

STATUS UPDATE - September 25, 2026 (Phase E, H1-H3 and M1-M2/V1-V4-V6)

WHAT THIS SESSION DID

Completed Phase E. The enrollment-package vectors, E1-E6, were
recorded earlier and documented in commit f526a24. This session
added the other two vector families: H1-H3, the session-key
derivation and handshake proof tags; and M1, M2, V1, V4, V6,
the SYNC_MESSAGE envelope and the event payload encoders.

All nine remaining vectors are recorded and verified. The test
suite is fourteen tests. All pass on the cloud machine.

THE H FAMILY

Commits fbdc42a (functions and Phase 1 tests), 3fe9daa
(vectors and Phase 2 assertions).

Three operations added as plain functions in main.rs, not Tauri
commands: derive_session_key (HKDF-SHA256), and
compute_handshake_reply_tag and compute_handshake_confirm_tag
(HMAC-SHA256). Two crates added: hkdf 0.12 and hmac 0.12. They
resolved against sha2 0.10 without conflict.

H2 and H3 share a helper that takes the domain-separation
string. The only difference between the two proofs is that
string.

The H1 vectors-file discrepancy: the entry had listed both
organization_id_A and organization_id_B, which did not match
section 22.11.1 or 22.19.1. Corrected to use one organization
id. This is a documentation repair; the protocol was not
reopened.

THE M/V FAMILY

Commits 67f8a07 (primitives and Phase 1 tests), 7f8529e
(vectors and Phase 2 assertions).

Serialization code that did not exist before:

  encode_tlv                      the single TLV primitive
  encode_string_value             u32-prefixed UTF-8
  encode_debtor_created_payload   V1
  encode_entity_updated_payload   V4
  encode_communication_logged_payload  V6
  encode_event_record             the event record
  build_sync_message              inner + outer + encrypt
  parse_sync_message              decrypt the envelope

encode_tlv is the only place that writes a TLV header. Every
builder calls it. The V4 encoder sorts change records
lexicographically by field_name, as section 25.9.3 requires.

These are reusable protocol primitives. Phase 9.6 will consume
them.

M1's message_id fixture: the vectors file said only "a fixed
test UUID." Resolved to event_id_test_001, 16 bytes. Recorded
in the vectors file.

THE FIVE NEW TESTS

  M1  SYNC_MESSAGE encryption, 239-byte framed message
  M2  SYNC_MESSAGE decryption, 193-byte inner content
  V1  DEBTOR_CREATED payload, 30 bytes
  V4  ENTITY_UPDATED payload, 38 bytes
  V6  COMMUNICATION_LOGGED payload, 88 bytes

VERIFICATION

The cloud machine ran cargo test -- --nocapture at commit
7f8529e. Fourteen tests, all passed. The three H Phase 2
assertions, deferred when the cloud machine was off, ran for
the first time and passed.

THE VECTORS FILE

All nine vectors are SPECIFIED / FROZEN. The header reads: "All
nine vectors recorded. Second-implementation verification not
performed." That is accurate.

WHAT IS STILL OPEN

Second-implementation verification. SYNC-TEST-VECTORS-v1.md
section 1 requires a second independent implementation to
confirm the bytes. There is only one implementation. The
vectors are recorded, not independently confirmed. This remains
open.

Control Plane tables not applied to gorka_test. device_
registrations and relay_sessions are specified but not created.

Control Plane services not implemented.

Phase 9.6, the sync engine. Not started. It consumes the
primitives built in Phase E.

Agent App (Phase 9.5) not started.

Multi-user demonstration (Phase 9.7) not started.

Excel and TXT implementation. Deferred by conscious decision.

Debt due-date bug. Not reproducible. Not closed.

supervisor-dashboard\dist\ stale build. Housekeeping.

dataType dropdown offers CSV and JSON. JSON is not implemented.

.txt entry in unstructured accept advertises a route that does
not work.

Dashboard 401s from /api/auth/me and /api/connectors/types.

check-columns.ts, untracked, on the cloud machine only.

test-package.gorka, untracked, on the cloud machine only.

All items from the September 23 and September 24 entries,
unchanged.

REPOSITORY STATE

Main machine: at 7f8529e, clean, pushed.

Cloud machine: at 7f8529e, clean.

GitHub origin/main: at 7f8529e.

The documentation commit for this entry follows, covering
HANDOFF.md, DECISIONS.md, SESSION-LOG.md, and START-HERE.md.

RULE COMPLIANCE

No production behavior changed.

No cloud schema change.

No CI/CD touched.

Invariant held. Every operation is local.

db.rs::derive_key was not touched.


## STATUS UPDATE — September 26, 2026 (Control Plane tables and device identity)

### What this session did

Created the two Control Plane tables in gorka_test:
device_registrations and relay_sessions. Verified them. Resolved
the device-identity question that had been ambiguous in the frozen
documents. Closed a pre-existing Cargo.lock divergence. Recorded
the result.

### The tables

device_registrations — 13 columns. Six active MVP columns (id,
organization_id, user_id, registered_at, last_seen_at,
is_authorized). Seven reserved columns, nullable, empty:
device_name, device_type, device_platform, device_public_key,
revoked_at, revoked_by, metadata.

relay_sessions — 10 columns. No reserved columns. Will contain no
rows until Phase 9.6.

The MVP model is user-based: one row per user, per organization.
The reserved columns are for the funded-phase combined model. The
reserved-field rule governs them: MVP code MUST NOT read or write
them, and no implementation may populate them without an approved
amendment.

### The decision — device identity has two layers

Layer 1 — Access (Control Plane). User-based. One registration per
user, per organization. A user logs in from any machine. No
per-machine registration, no per-machine key, no per-machine
revocation. device_registrations records this; in the MVP it is not
a machine registry.

Layer 2 — Sync origin (wire protocol). Each local GORKA database
has its own local replica identifier, generated when the database
is first established. The wire device_id is exactly this 16-byte
identifier. It does not encode the user identity.

(device_id, sequence) is globally unique within the organization.
Two local databases used by the same user have different device_id
values and independent sequence namespaces.

device_id identifies the synchronization origin, not the human
actor.

### The amendments

SYNC-ARCHITECTURE.md bumped to v1.3. Sections 3, 4, 11.3, 22.4
amended; new subsection 25.6.6 added. The sentence in §11.3 that
said the wire device_id "combines the user identity with the device
instance identifier" is replaced. The new §25.6.6 defines the wire
device_id as the 16-byte local replica identifier.

CLOUD-TABLES.md §20.1: a physical-specification note and an MVP
note added. The section remains the logical contract.

LOCAL-TABLES.md: no change. Category D is consistent with the
decision. The storage representation of sync_state.device_id is
deferred to Phase 9.6.

### The commits

  1d89af8  Add the two models to schema.cloud.prisma.
  9b5a118  Add reverse relations to DeviceRegistration.
  15a993f  Sync Cargo.lock with Cargo.toml: pin hkdf and hmac.

All three on origin/main. All three machines at 15a993f.

The documentation commit for this session follows separately.

### The verification

prisma db push succeeded against gorka_test. 21 tables total. The
19 existing are unchanged. No debtor column appeared except the two
known permitted ones. Backend starts cleanly with the regenerated
Prisma client.

### The two push errors

P1001: cannot reach database server. Cause: the direct Supabase
hostname does not resolve from AWS Singapore. Fixed by switching to
the session pooler hostname already recorded in this document.

P1012: missing opposite relation field on DeviceRegistration.
Cause: the specification described the foreign keys from one side
only. Fixed by amending the specification to add two
reverse-relation lines, then editing the file.

### The Cargo.lock finding

Commit fbdc42a (Phase E) added hkdf and hmac to Cargo.toml but did
not commit the resulting Cargo.lock update. The lock file sat
uncommitted on the cloud machine since September 25. Committed as
15a993f.

Process note: "all machines at the same commit" and "all working
trees clean" are two different claims. The prior handoff inferred
the second from the first. Future handoffs should run git status on
each machine, not infer.

### Repository state

Main machine: at 15a993f, clean, pushed.
Cloud machine: at 15a993f, clean except check-columns.ts and
  test-package.gorka, both intentionally untracked.
GitHub origin/main: at 15a993f.

### What is still open

Second-implementation verification of the nine vectors.
Control Plane services not implemented.
Phase 9.6 (sync engine), 9.5 (Agent App), 9.7 (demonstration): not
  started.
Excel/TXT upload, debt due-date bug, stale supervisor-dashboard\dist,
  UI honesty issues, Dashboard 401s: unchanged.
THREAT-MODEL.md §7.2.2 wording: recorded, not acted on.

One item for Phase 9.6: choose the local storage representation of
sync_state.device_id. §25.6.6 defers this.

All items from the September 25 entries, unchanged.

## STATUS UPDATE — September 26, 2026 (Second-implementation verification of the nine vectors)

### What this session did

Completed the second-implementation verification of the nine
deterministic test vectors recorded in SYNC-TEST-VECTORS-v1.md.
The verification is required by SYNC-TEST-VECTORS-v1.md Section
1 and described in the task brief of the same date. It was
performed before Phase 9.6, per the brief's recommendation.

### What was written

A second, independent implementation of the nine vectors, in
Node.js, at verify/. Single file: index.mjs. Libraries:
@noble/ciphers 2.4.0 (XChaCha20-Poly1305), hash-wasm 4.12.0
(Argon2id), node:crypto (HKDF-SHA256, HMAC-SHA256, SHA-256).
Different library family from the Rust implementation's
RustCrypto.

### The independence boundary

The second implementation was written from SYNC-ARCHITECTURE.md
v1.3 and SYNC-TEST-VECTORS-v1.md only. No file under
src-tauri/ was consulted. The permitted Cargo.toml exception
was not used. This is the condition that makes the verification
meaningful.

### The environment

  OS:      Microsoft Windows 11 Home | 10.0.26200 | build 26200
  Node.js: v24.18.0
  npm:     11.16.0
  Libraries: @noble/ciphers 2.4.0, hash-wasm 4.12.0, node:crypto

Ran on the main machine. Not the cloud machine. Node is present
on both; the task does not need a Rust compiler and is not
blocked by the SAC / cargo.exe restriction.

### The result

First execution, no adjustment:

  E1  PASS
  H1  PASS
  H2  PASS
  H3  PASS
  M1  PASS
  M2  PASS
  V1  PASS
  V4  PASS
  V6  PASS

  9/9 PASS

All nine vectors produced the exact recorded bytes. No
implementation adjustment, vector adjustment, or specification
adjustment was required. No post-hoc convergence occurred.

A negative control was performed: a copy of the runner with one
byte of V1's expected value mutated from 0x20 to 0xff produced
V1 FAIL and 8/9 PASS, confirming that the harness detects a
byte-level mismatch. The copy was deleted, the original was
rerun, and 9/9 PASS was reproduced.

### What was not changed

  - Rust source: not read, not modified.
  - Vector values: not modified.
  - Specification: not modified.
  - Database, cloud schema, backend, Control Plane tables: not
    touched.
  - Phase 9.6: not started.

The only file edit was the Status block of SYNC-TEST-VECTORS-v1.md,
updated from "Second-implementation verification not performed"
to "verification performed on 2026-09-26. All nine vectors
confirmed by an independent implementation."

### The preservation decision

Decision D4 of the brief recommended keeping the verification
code. Kept. verify/ is committed alongside the documentation.
package-lock.json pins the exact library versions, so the check
is reproducible. node_modules/ is gitignored.

### Conclusion, stated precisely

All nine deterministic test vectors have been independently
reproduced byte-for-byte by a second implementation written
from SYNC-ARCHITECTURE.md v1.3 and SYNC-TEST-VECTORS-v1.md.
No disagreement, specification ambiguity, vector correction,
or implementation correction was required.

### What this closes

The open item "Second-implementation verification of the nine
vectors" from the September 25 and September 26 entries. The
nine vectors are no longer recorded-but-not-confirmed.

### What remains open

  - Control Plane services not implemented.
  - Phase 9.6 (sync engine), 9.5 (Agent App), 9.7
    (demonstration) not started.
  - Excel/TXT upload, debt due-date bug, stale
    supervisor-dashboard\dist, UI honesty issues, Dashboard
    401s.
  - THREAT-MODEL.md §7.2.2 wording: recorded, not acted on.
  - The local storage representation of sync_state.device_id,
    deferred to Phase 9.6.
  - The Agent App architecture decision (same-repo shared-crate
    vs built from scratch). Open since September 21. Blocks
    Phase 9.5.

### Repository state

Committed and pushed as part of this session's single commit.
Hash to follow.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held.
  - No Rust code changed. Instance B (db.rs::derive_key) not
    touched.
  - The independence boundary was held.

## STATUS UPDATE — September 27, 2026 (Multi-user application architecture: A–G decisions and design reconnaissance)

### What this session did

Held a structured architecture conversation between the founder
and the assistant, covering seven topic areas (A–G) about how the
two applications coexist, how they reach providers and AI, where
compliance is enforced, what syncs, and how the work is
sequenced. Then performed a read-only design reconnaissance of
the Client Dashboard so the Agent App spec can follow the same
visual vocabulary.

Nothing was written in this session except this record. No spec,
no code, no architecture amendment, no frozen document change.

### The seven sections, condensed

A — Communication runs from the Agent App, not the Client
Dashboard. Admin configures connectors and monitors usage.
Agent sends. Two commercial paths: GORKA-managed (subaccount per
client) and BYOP. Automatic sending deferred.

B — Provider credentials live locally in each device's SQLCipher
database. Separate concept from the organization key. Rotation
mechanism (B-5) deferred to sync-protocol design.

C — AI calls go from the agent's device directly. Only metadata
leaves. A new client-side component, the AI boundary layer,
redacts debtor-identifying content before the call. Multi-
provider from the start.

D — Copilot in both apps with different purposes (oversight vs
workflow). Communication Center in the Agent App only.
Per-agent access control (D-3) has three possible shapes; not
yet decided.

E — Cloud declares rules, local enforces them. GORKA provides
mechanism and safeguards; the client is sender of record and is
responsible for local jurisdiction rules. New client-side
compliance enforcement layer.

F — The message log syncs as new event types. Admin sees full
content. AI recommendations and agent decisions sync. MVP: one
event per message, retain everything. Production: per-step
events, client-policy retention.

G — Same schema for both apps. LEGO architecture with
cross-platform in the target. "Workable GORKA" defined as a
usable pilot product, not a demo.

### Section N1–N3, condensed

N1 — The Client Dashboard's third-party integration is broader
than communication providers. Working name: Connection Center.
Skip-tracing capability is needed; its framing is a
compliance-sensitive problem; legal review is a precondition.

N2 — The audit log journal is partially implemented on the
Client Dashboard. The Agent App side and the cross-app
connection are deferred.

N3 — Cross-platform commitment: Windows first, others later. No
Windows-only assumptions in the shared Rust layer.

### Design reconnaissance

Read twelve files from the Client Dashboard on disk. Extracted
the design vocabulary: color palette, typography, spacing,
shape, icons, components, layout. Full tables are in
DECISIONS.md.

Consistency rule settled: primary button color is purple
#7C3AED everywhere, including the entry flow. Red #DC2626 is
reserved for the logo, errors, and destructive confirmation.

Deferred: the Client Dashboard's entry-flow screens (Set/Enter)
came in from Tauri and use a design that was not chosen. They
will be brought into the Login-page design later.

### Entry flow for the Agent App

Three steps, three centered cards in one visual style:
  1. Login — cloud credentials, JWT.
  2. Unlock — local SQLCipher password.
  3. Enroll — import the organization enrollment package.

Step 3 is new as a screen. It also implies a proper
export/import screen pair on the Client Dashboard side.

### Running list of open items

A-2a, A-6, B-5, C-1, C-3a, C-4, C-5, C-6, D-3, E-15, E-16,
F-19a, F-19b, CI/CD for two Tauri apps, enrollment of a second
local app on the same machine, new event types for the funded
phase, the Client Dashboard entry-flow redesign, and the
credit-bureau / data-vendor integration as a distinct feature
within the Connection Center.

### What remains unchanged

  - The multi-user model.
  - Every frozen document.
  - The invariant.
  - Phase 9.5, 9.6, 9.7 status (all not started).

### What comes next

Write the Agent App build spec. This session's decisions and the
design vocabulary are its input. The spec will cover the app's
structure, the shared Rust command layer, the three-step entry
flow, the Connection Center, the AI boundary layer, the
compliance enforcement layer, the local schema (same as the
Client Dashboard), the design section (following the
vocabulary), and the open items above.

### Repository state

No commit made this session. Only DECISIONS.md, HANDOFF.md,
SESSION-LOG.md, and START-HERE.md are modified (or will be,
once this entry is written).

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held.
  - No Rust code changed.
  - The design reconnaissance was read-only.
  - The independence rule of the prior task was not implicated.

STATUS UPDATE — September 27, 2026 (Agent App build spec)
What this session did
Wrote, reviewed, corrected, and froze the Agent App build spec. The spec is GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md, version 1.2, approved by the founder on September 27, 2026. It is the input to Phase 9.5.

The session also recorded twelve design decisions made during the conversation (D1 through D12), performed a multi-source reconnaissance of the existing code, and received an external review of the first draft.

The spec
Sections 1 through 13. The full content is recorded in DECISIONS.md (the September 27, 2026 entry "Agent App build spec"). The spec lives as a standalone file.

Key properties:

The Agent App is the second Tauri binary in the same repository. It shares the Rust command layer with the Client Dashboard.

The command registration boundary: each binary registers its own generate_handler! subset. The boundary is the registration list, not the UI. Admin-only commands are not registered in the Agent App.

The three-step entry flow: Login, Unlock, Enroll.

The debtor profile is the core screen: contact details, debts, communication buttons (conditional on contact field + admin enablement), communications log, actions, documents, photo, guarantors/pledgers.

The plan view (calendar) combines manual events with derived views over debts and actions.

Bulk actions send a generic text to many debtors, with per-recipient compliance checks and a "Retry failed" button.

The Phase 9.5 implementation contract (spec Section 2.8): what is built now versus what is specification context for later phases.

The twelve decisions
Recorded in full in DECISIONS.md. Summary:

D1 — Command registration is per-binary, not per-UI.

D2 — enable_sync is Client Dashboard only.

D3 — export_enrollment_package, get_dashboard_stats, bulk_insert_debtors are Client Dashboard only.

D4 — sync_now is not in the MVP.

D5 — Guarantors and pledgers: role column on debtors; debtor_relations linking table; many-to-many both ways; relations local-only in the MVP.

D6 — Debtor profile photo is a photo_path column, not a document.

D7 — Plan view (calendar) combines manual events with derived views; calendar events are local-only in the MVP.

D8 — Bulk actions send a generic text; per-recipient compliance; report + retry failed; no auto-retry.

D9 — Connector buttons appear conditionally: admin-enabled AND debtor has the required contact field.

D10 — Debts travel inside the parent debtor's data_json. Rules 1 (receipt) and 2 (origination) recorded. Conscious MVP granularity limitation documented.

D11 — The Phase 9.5 implementation contract.

D12 — device_id is the sync origin; created_by is the human actor. Not interchangeable.

The external review
The founder sent the first draft to an external reviewer. The reviewer classified it "approve after targeted corrections" and identified seven corrections (C1 through C7), all applied. The reviewer's final classification of v1.1 was "approve after final founder review — implementation-ready spec," with three process clarifications, applied in v1.2.

The reviewer's closing principle, adopted by the founder and binding on Phase 9.5 implementation:

Do not let the developer "improve" the architecture while implementing this spec. The developer works mechanically from the approved specification. Any discovered discrepancy becomes a STOP -> report -> founder decision, not an opportunity to redesign.

Pending amendments
Two amendments to frozen documents are recorded in DECISIONS.md. They are needed to make the Agent App spec's decisions authoritative.

Amendment 1 — LOCAL-TABLES.md. APPLIED this session. Promotes four schema additions to authoritative status: debtors.photo_path, calendar_events, debtors.role, debtor_relations. LOCAL-TABLES.md is now at v1.3. Summary table shows 22 local tables (was 20).

Amendment 2 — SYNC-ARCHITECTURE.md. APPLIED this session. Extends Section 25.9.2 with subsection 25.9.2a recording the debt-in-data_json interpretation and Rules 1 and 2. SYNC-ARCHITECTURE.md is now at v1.4. This amendment was a precondition for Phase 9.6, not Phase 9.5; it was applied now while the decision was fresh.

What is on disk
GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md — new, v1.2, frozen.

GORKA_RECOVERY/recovery-notes/DECISIONS.md — new long entry.

GORKA_RECOVERY/recovery-notes/LOCAL-TABLES.md — v1.3, Amendment 1 applied.

GORKA_RECOVERY/recovery-notes/SYNC-ARCHITECTURE.md — v1.4, Amendment 2 applied.

GORKA_RECOVERY/recovery-notes/HANDOFF.md — this entry.

What is still open
Phase 9.5 (the Agent App, local only) — the spec is frozen; implementation is next.

Phase 9.6 (the sync engine) — not started.

Phase 9.7 (the multi-user demonstration) — not started.

All open items listed in the Agent App spec, Section 12, in three buckets (blocks Phase 9.5, does not block Phase 9.5, funded phase).

The Client Dashboard enrollment export UI — needed before the Agent App's Enroll step is usable without devtools.

Every item carried from prior sessions (Excel/TXT upload, the debt due-date bug, the stale supervisor-dashboard\dist, UI honesty issues, Dashboard 401s, the localhost API endpoint preflight).

Repository state
No commit this session. The spec and the four documentation files are new or modified in the working tree. The founder decides when to commit.

Rule compliance
No production touched.

No cloud schema change.

No CI/CD touched.

Invariant held.

No Rust code changed. db.rs::derive_key not touched.

The reconnaissance was read-only.

The Agent App spec is a document. No code was written in this session.

## STATUS UPDATE - September 28, 2026 (Phase 9.5 begins)

### What this session did

Phase 9.5 began. The workspace was created, the Client's
storage root was migrated, five shared-code slices were
extracted, the Agent App scaffold was built and verified,
and Slice 1 of the adapter/command cleanup was completed.

Fourteen commits landed. None touched production. None
touched the cloud schema. None broke the invariant.

### The sequence, in commits

  199956e  Phase 1a: root workspace manifest
  2c540bc  Phase 1b: gorka-shared crate
  52f0915  Phase 2: storage root migration
  a2ccd73  Slice 3.1: models
  8cce268  Slice 3.2: enrollment package
  7b06034  Slice 3.3: sync primitives
  0e73b34  Agent scaffold
  699b9fe  Agent scaffold fix (ensure_dirs)
  a959087  Slice 3.4: db
  91b5b7e  Slice 1: debtors
  20a1730  .gitignore target/ and temp files
  ab957d8  Track root Cargo.lock + Agent gen/schemas
  ee8c732  Remove pre-workspace src-tauri/Cargo.lock
  8435179  PHASE-9.5-EXTRACTION-LOG.md

### What the workspace is now

Cargo workspace at the repository root. Three members:
shared/, src-tauri/, src-tauri-agent/.

The shared crate (gorka-shared) contains:
  storage.rs       AppStorage type
  models.rs        all data structs and enums
  enrollment.rs    E1/E2 package build and parse
  sync.rs          wire-format and handshake primitives
  db.rs            SQLCipher access, migrations, audit log
  debtors.rs       debtor operations (Slice 1)

All Tauri-free. No Agent dependency on Client.

### What the Agent App is now

The Agent App is the second Tauri binary. It builds and
launches. It has:
  - its own bundle identifier (com.gorka.agent)
  - its own database filename (gorka-agent.db)
  - its own app data folder (%APPDATA%\com.gorka.agent\data\)
  - its own command list (agent_ping only)
  - its own frontend (agent-dashboard/, Vite port 5174)

No Agent functionality yet. No entry flow, no CRUD, no
enrollment UI, no sync.

### The storage migration

The Client's DB and debtor files moved from
%APPDATA%\gorka\client\data\ (legacy ProjectDirs) to
%APPDATA%\com.gorka.client\data\ (Tauri app-data root).

Mechanism:
  - staging in data.migrating/, promoted after SHA-256
    verification
  - atomic rename
  - old root left in place as rollback copy

Verified: DB hash matched pre-migration; dashboard numbers
matched; CRUD worked on migrated DB; path routing proven
(renaming the new DB made the app show "Set", restoring it
made the app show "Enter", file upload landed under the new
root, old root's files folder stayed empty).

### Decisions recorded

See DECISIONS.md for full entries. Summary:

  - Repository layout: Option A. Cargo workspace plus
    shared library crate. Agent depends on shared, never
    on Client.
  - Storage: Direction 1 plus Option 1b. Unify to the Tauri
    bundle-identifier root, with a data/ subfolder. One-time
    deliberate migration, not preservation of the legacy
    path.
  - Agent scaffold timing: Option B binding. Scaffold the
    Agent once models, storage, enrollment, sync are shared,
    before db and auth are fully extracted. The Agent becomes
    the test of the boundary.
  - auth.rs extraction: Reading C, DEFERRED. The proposed
    path-based Shape 1 does not match the actual code. Six of
    seven functions are pure tauri-plugin-store operations
    with no Tauri-free side. No change to auth.rs this
    session.
  - Adapter/command cleanup: Reading 3, entity-based slices.
    Debtors first. Debts, communications, actions, documents,
    dashboard to follow.
  - Warnings: inspected and reported. Three main.rs warnings
    removed in Slice 1. Five auth.rs warnings deferred with
    auth.

### Unexpected findings, both resolved

1. .gitignore did not exclude target/. The workspace
   target/ was generated by the first cloud build and
   appeared as hundreds of untracked files. Verified
   nothing under target/ was ever tracked. Fixed at
   20a1730.

2. Root Cargo.lock was untracked. It is the authoritative
   workspace lock file, generated only on the cloud. Not
   committing it recreated the class of cross-machine
   drift we fixed on September 26. Tracked at ab957d8.
   The obsolete pre-workspace src-tauri/Cargo.lock was
   removed at ee8c732.

### Verification performed

  - cargo build -p gorka-client PASS after each slice.
  - cargo build -p gorka-agent PASS after scaffold.
  - cargo test -p gorka-shared 14/14 PASS. E1 (byte-exact
    enrollment package) still passes. All H, M, V vectors
    still pass.
  - Client smoke test PASS after every slice: login,
    unlock, dashboard numbers, Collections, debtor detail,
    edit debtor, add debtor, search, delete.
  - Agent launch test PASS: window opens, placeholder
    renders, %APPDATA%\com.gorka.agent\data\ created.
  - Path routing checks PASS: database_exists() reads the
    new root; file uploads land under the new root; the old
    root stays empty.

### Recovery notes updated

A new file, PHASE-9.5-EXTRACTION-LOG.md, records each slice
with the fields the review required: starting and resulting
commits, files moved, commands moved, function mapping, data
preservation (SQL, parameters, row mappings, transaction
boundaries, audit calls), adapter behavior preservation (org
id acquisition, AppState ownership, error propagation,
return values), warning counts, build and test results,
explicit non-changes, deviations.

This HANDOFF entry, START-HERE.md, SESSION-LOG.md, PHASE-
PLAN.md, and DECISIONS.md are updated in the same session.

### State at end of session

  Main machine:  8435179, clean, pushed.
  Cloud machine: ee8c732, clean. Two commits behind.
                 Needs git pull before Slice 2.
  GitHub:        8435179.

Both binaries build. 14 tests pass. The Client runs.

### Next work

Slice 2 - debts. Commands to move: get_debts, insert_debt,
update_debt, delete_debt. Same pattern as Slice 1.

After Slice 2: communications, actions, documents,
dashboard. Then final Client regression. Then Agent
implementation. Then Agent authentication. Then re-evaluate
the shared auth boundary.

See PHASE-9.5-EXTRACTION-LOG.md for the Slice 1 record and
the pattern Slice 2 will follow.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the boundary.
  - No frozen document amended except the two that were
    already recorded as amended on September 27 (LOCAL-
    TABLES v1.3, SYNC-ARCHITECTURE v1.4).
  - The extraction was mechanical: SQL, parameters, row
    mappings, transactions, audit calls, and command
    names unchanged in every slice.

## STATUS UPDATE - September 29, 2026 (Stage B complete, Stage C.1 complete)

### What this session did

Continued Phase 9.5. Three items from the previous session's
open list were closed (Item 1, Item 2, Stage A). Then Stage B
(shared functions for the Agent) was completed in three
sub-slices. Then Stage C began with C.1 (the Agent's
authentication foundation).

Nineteen commits landed across the day. No production
touched. No cloud schema change. The invariant held.

### Items closed from the previous session

  Item 1 - delete_debtor filesystem test. PASSED. A fresh
  create/upload/delete cycle leaves no folder behind. The
  pre-existing orphan folder cd972140-... is a historical
  artifact, not a defect.

  Item 2 - auth boundary. HTTP half of login moved to
  gorka_shared::auth_http. Store half stays per binary
  (Reading A from Slice 3.5). Dead reqwest dependency
  removed from src-tauri/Cargo.toml. Verified on cloud:
  gorka-client builds, 14/14 shared tests, login works.

  Item 3 / Stage A - schema migrations v5/v6/v7 applied.
  Adds debtors.photo_path, debtors.role, calendar_events
  table, debtor_relations table. Client runs them on next
  launch; data intact (12 / $2,381,550 / 2).

### Stage B - shared functions (three sub-slices)

  Sub-slice 1 (2268a30) - photo functions.
    set_debtor_photo, get_debtor_photo added to
    shared/src/debtors.rs. Fixed photo.<ext> target, prior
    photo removed. No org scoping (matches spec 6.3).
    Verified on cloud: gorka-client builds.

  Sub-slice 2 (292a3a8) - calendar operations.
    New shared/src/calendar.rs (279 lines), 6 functions,
    4 new model structs. All take trusted organization_id
    (normative LOCAL-TABLES rule over illustrative spec
    6.3). Inclusive overlap for date ranges. event_type
    always MANUAL. Verified on cloud: gorka-client builds,
    14/14 shared tests.

  Sub-slice 3 (884c637) - debtor relations.
    New shared/src/relations.rs (163 lines), 3 functions,
    2 new model structs. Same trusted-org-id rule.
    Reverse-direction view out of scope. Insert validates
    both debtors, rejects self-relations, validates
    relation_type, pre-checks the unique constraint.
    Verified on cloud as part of the next build.

### Stage C.1 - Agent authentication foundation

  Commit 5ab35ae.
    New src-tauri-agent/src/auth.rs (7 functions, thin
    login through gorka_shared::auth_http).
    src-tauri-agent/Cargo.toml gains rusqlite and hex.
    src-tauri-agent/src/main.rs rewritten: AgentState ->
    AppState with Mutex<Option<Connection>>; agent_ping
    removed; 8 commands registered (login, get_auth_token,
    get_salt, get_organization_id, database_exists,
    unlock_database, is_database_unlocked, logout).
    unlock_database written clean (no debug println!s).

  Commit 67b984a - Cargo.lock regenerated on cloud.
    Reconciles Item 2's reqwest move and Stage C.1's
    rusqlite/hex additions.

  Commit c69d21e - follow-up: remove unused
    tauri::Manager import from Agent auth.rs. Agent bin
    warning count 3 -> 2.

  Verified on cloud: gorka-agent builds (first real build),
  gorka-client builds, 14/14 shared tests. Warnings:
  gorka-client bin 3, gorka-agent bin 2, gorka-shared lib 6.

### Documentation

  Combined extraction-log update: four new sections
  (Stage B 1-3, Stage C.1) plus SEQUENCE. Commit c69d21e
  state referenced.

  DECISIONS.md: new September 29 entry recording three HOW
  decisions - D1 (spec 6.3 signatures are illustrative, not
  normative), D2 (open_local_file deferred to Stage D),
  D3 (new Agent code written clean). Plus session notes.

### State at end of session

  Main machine:  c69d21e, clean.
  Cloud machine: c69d21e, clean except the two known
                 untracked files (check-columns.ts,
                 test-package.gorka).
  GitHub:        c69d21e.

### Next work

  Stage C.2 - CRUD adapters in the Agent's main.rs. Adds 21
  adapter commands for debtors, debts, communications,
  actions, documents. All main-side; cloud needed only for
  the build verification.

  After C.2: C.3 (Stage B adapters: photo, calendar,
  relations), C.4 (enrollment). Then Stage D - the Agent
  frontend. Then the Agent end-to-end regression.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the boundary.
  - No frozen document amended beyond the September 27
    amendments already recorded (LOCAL-TABLES v1.3,
    SYNC-ARCHITECTURE v1.4).
  - Stage B introduced new code with per-function design
    decisions, each recorded in the extraction log.
  - Stage C.1 kept the Client binary untouched.

See PHASE-9.5-EXTRACTION-LOG.md for the four new slice
records and DECISIONS.md for the September 29 HOW decisions.

## STATUS UPDATE - September 30, 2026 (Stage C.5 complete, Stage D.0-D.3 complete)

### What this session did

Continued Phase 9.5. Closed Stage C with the small C.5
backend addition (is_enrolled). Then began Stage D - the
Agent frontend - and completed D.0 (prerequisites), D.1
(design tokens and shared primitives), D.2 (entry flow),
and D.3 (main shell).

Six commits landed. No production touched. No cloud schema
change. The invariant held.

### Stage C.5 - is_enrolled

Commit a085b8d. Added shared::db::is_enrolled(conn) ->
Result<bool, String> and the Agent adapter. It queries the
organization_keys table to determine whether the device is
already enrolled. Query only, no side effect.

Reason: the spec's literal "refusal as signal" mechanism
forced the user to select a package file on every launch.
is_enrolled replaces it. See DECISIONS.md September 30
entry, D4.

### Stage D - Agent frontend

  D.0 (71948ab) - prerequisites. React Router, lucide-react,
  FullCalendar v6, @tauri-apps/plugin-dialog installed. tsconfig
  added. Build script becomes tsc && vite build.

  D.1 (38ae126) - design tokens and ten primitives. Tokens
  sourced from spec 11.2 plus entry-flow values from the
  Client's pre-Tauri Login page. All component CSS uses
  var(--token). postcss.config.js added to stop inheriting
  the repo-root Tailwind pipeline.

  D.2 (2eb97b9) - entry flow. App.tsx is now a state machine
  (loading -> login -> unlock -> enroll -> shell). LoginPage,
  UnlockPage (set/enter modes), EnrollPage (.gorka picker).

  D.3 (efbbc4d) - main shell. Sidebar (seven items), TopHeader
  (title, static sync placeholder, avatar, logout), StubPage.
  App.tsx wraps the shell in HashRouter with seven routes.

Documentation commit bdf93a2 covered C.5 and D.0-D.2 slice
records plus the September 30 DECISIONS entry.

### Verification (cloud, September 30)

  cargo build -p gorka-agent    PASS (2 warnings, unchanged)
  cargo build -p gorka-client   PASS (3 warnings, unchanged)
  cargo test -p gorka-shared    14/14 PASS
  npm install on cloud          OK, 0 vulnerabilities
  npm run build on cloud        PASS (227.44 kB JS, 7.43 kB CSS)
  Visual: Login page renders correctly (red wordmark, purple
    Sign In button). Shell renders correctly (sidebar, header,
    seven nav items, Today stub). Both confirmed.

### State at end of session

  Main machine:  efbbc4d, clean.
  Cloud machine: efbbc4d after next pull (currently at 2eb97b9,
                 plus the two known untracked files).
  GitHub:        efbbc4d.

### Next work

  Stage D.4 - debtor list and debtor profile. The core screen.
  Then D.5 (plan view / calendar), D.6 (remaining screens).
  Then the Agent end-to-end regression.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the boundary.
  - No frozen document amended beyond the September 27
    amendments already recorded.
  - Client binary untouched since Item 2.
  - The design-source decision (Path B) recorded in
    DECISIONS.md September 30 entry.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records and
DECISIONS.md for the September 30 HOW decisions.

End of entry.

## STATUS UPDATE - October 1, 2026 (Stage D.4a-0 through D.4b-2c Rust half)

### What this session did

Continued Phase 9.5. Built the Agent App's first data
pages from scratch. Six slice commits and two documentation
commits landed. No production touched. No cloud schema
change. The invariant held.

### The commits

  d4a-0   7f122e1  primitive gap-fill (10 files)
  d4a     32f1475  debtor list and profile (12 files)
  d4b-1   c5e2d6e  communications and documents cards (5 files)
  d4b-2a  8ddb6ef  read_debtor_photo Rust half (3 files)
  d4b-2a  3688d9f  debtor profile photo frontend (3 files)
  d4b-2b  68440de  relations card (5 files)
  d4b-2c  c73373d  role column and orphan cleanup Rust (4 files)
  docs    d0eb175  extraction log entries (1 file)
  docs    829dcea  DECISIONS entries (1 file)

### What is now working on the Agent

Entry flow: Login, Unlock, Enroll. Unchanged from D.2.

Debtors:
  - List with search, add, edit, delete.
  - Profile with header card (photo + info grid), Debts
    card, Relations card, Communications card, Actions
    card, Documents card.

Photo:
  - Read from disk via Rust bytes, displayed as blob URL.
  - Change-photo via the dialog plugin, filtered to
    images.

Relations:
  - Two header buttons: Add Guarantor, Add Pledger.
  - Modal with create-new and link-existing modes.
  - Collateral fields (PLEDGER only).
  - Row click navigates to that person's profile.
  - Delete removes the relation and, if the person is
    orphaned, removes the person row too.

### What is verified

All behavioral tests on cloud passed, for:
  - D.4a (list, profile, debt CRUD, action CRUD, persistence)
  - D.4b-1 (comms CRUD, docs upload/delete, persistence)
  - D.4b-2a (photo set, display, persistence)
  - D.4b-2b (relations create, collateral, delete, navigate,
              persistence)

### What is committed but NOT yet compiled on cloud

c73373d - D.4b-2c Rust half. Four new commands, one
modified, registration updated. Compiles on main? Not
tested. Cloud is on. The next cloud action is:

  cd /d C:\gorka-app
  git pull
  cargo build -p gorka-agent
  cargo build -p gorka-client
  cargo test -p gorka-shared

Expected: 2 warnings, 3 warnings, 14/14.

### What is NOT started

D.4b-2c frontend half. Five files:
  - local.db.ts: RelatedDebtorRole, DebtorDebtTotal
    types; getRelatedDebtorRoles, getDebtorDebtTotals,
    insertRelatedDebtor, cleanupOrphanedRelatedDebtors
    methods.
  - RelationEditModal.tsx: create-new path switches from
    insertDebtor to insertRelatedDebtor.
  - DebtorsPage.tsx: Role column between Phone and
    Actions, Debt and Currency columns, two-row sticky
    header (header row + TOTAL row), cleanup on mount.
  - DebtorsPage.css: sticky thead, scrollable container,
    role badge styling, right-aligned Debt/Currency.
  - DebtorProfilePage.tsx: read get_related_debtor_roles,
    compute isRelated, hide the two relation add-buttons,
    hide the Debts card on related persons.

Planned after D.4b-2c:
  - D.5 - plan view / calendar (FullCalendar).
  - D.6 - remaining screens (Communication Tools,
    cross-debtor Actions, cross-debtor Documents,
    Settings).
  - Agent end-to-end regression.

### Deviations recorded for this session

1. Documentation deferred to end-of-session. D.4a-0,
   D.4a, D.4b-1, D.4b-2a, D.4b-2b, D.4b-2c-Rust were
   all documented in one pass, not after each slice.
   Founder-authorised.

2. D.4b-2a and D.4b-2b verified in one cloud trip, not
   two. Founder-authorised.

3. D.4b-2c Rust half is committed but not yet compiled
   on cloud. Founder paused to write documentation
   before the compile.

### Forward-looking notes

Relations and photo will exist on the Client Dashboard
too, in a later phase. The Rust commands and the two
components (RelationEditModal, photo block) are designed
to be client-neutral. No Agent-only assumptions encoded.
See DECISIONS.md "Seams for the Client Dashboard" section.

### State at end of session

  Main machine:  829dcea, clean, pushed.
  Cloud machine: c5e2d6e (off or on; behind by seven
                 commits). Needs git pull before any
                 Rust build.
  GitHub:        829dcea.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the boundary.
  - No frozen document amended beyond the September 27
    amendments already recorded.
  - Client binary untouched in this session. Only the
    shared crate changed, and both binaries rebuild
    against it. The Client's generate_handler! list is
    unchanged.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records and
DECISIONS.md for the HOW decisions.

End of entry.

## STATUS UPDATE - October 1, 2026 (D.4b-2c frontend half
## and D.4b-2c-fix)

### What this session did

Continued Phase 9.5. Closed D.4b-2c in two halves and
then corrected it in a third commit. No production
touched. No cloud schema change. The invariant held.

### The commits

  d4b-2c-fix   f0552aa  Rust half (3 files)
  d4b-2c-fix   060987c  frontend half (2 files)
  d4b-2c-fix   7a5c01f  path-aware back button (1 file)

Earlier in the same session, d4b-2c frontend half
landed as 8689289 (5 files).

### What is now working on the Agent

Debtors list:
  - Shows only primary debtors (role = DEBTOR). Related
    persons do not appear as their own rows, regardless
    of active relations.
  - Role column shows one static badge per active
    relation on the primary debtor's row: PLEDGER,
    GUARANTOR. Not clickable. No names.
  - Debt and Currency columns, one line per currency.
  - Two-row sticky header: header row + TOTAL row.
    TOTAL reflects the whole organization, not the
    current search filter.
  - Orphan cleanup runs once per page mount, before
    loading rows.

Debtor profile:
  - Related persons: no Debts card, no relation
    add-buttons.
  - Communications, Actions, and Documents cards stay
    on every profile. Related persons keep all
    case-file tools.
  - Back button is path-aware. From a related person's
    profile reached via a Relations card, it reads
    "Back to <primary surname, name>" and returns to
    that profile.

### What is verified on cloud

All behavioral tests passed, including:
  - D.4b-2c frontend half (list filter, badges, sticky
    header, cleanup, persistence).
  - D.4b-2c-fix (only primary debtors in the list, Role
    badges on the primary's row, search returns only
    primaries, path-aware back button, persistence).

### Spec change

AGENT-APP-SPEC.md bumped to v1.3, FROZEN. One
paragraph of section 3.7 rewritten. Related persons do
not appear in the debtor list; the list shows only
primary debtors. No other spec change.

### Residue cleanup

Two pre-fix residue rows on the cloud test instance
were removed manually. Trump Donald (deleted via UI)
and Peter Parker (relation deleted, row deleted,
re-created via + Add Pledger on Bob's profile so the
new role write fires). No code change. No migration.
New residues are prevented going forward by the role
write in insert_related_debtor.

### Known MVP limitation

A related person who accumulates their own
communications, actions, or documents, and then has
their relation to the primary debtor deleted, becomes
a zombie: hidden from the list, unreachable from the
UI, still in the database, not deleted by cleanup.

Accepted for MVP. The proper fix is a "case closed"
surface in the funded phase. Recorded in DECISIONS.md
DB2cFix-6.

### What is NOT started

  - D.5 - plan view / calendar (FullCalendar).
  - D.6 - remaining screens (Communication Tools,
    cross-debtor Actions, cross-debtor Documents,
    Settings).
  - Agent end-to-end regression.

### Deviations recorded for this session

1. Code first, documentation second. Founder
   requested this order for D.4b-2c-fix. Recorded as
   Dev-4 in DECISIONS.md.

2. Spec amended after cloud verification, not before.
   Recorded as Dev-5 in DECISIONS.md.

3. D.4b-2c-fix verified in one combined cloud trip
   for Rust build, frontend build, and behavioral
   smoke test. Founder-authorised.

### State at end of session

  Main machine:  7a5c01f, clean, pushed.
  Cloud machine: 7a5c01f, clean. Powered off by
                 founder at end of session.
  GitHub:        7a5c01f.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the boundary.
  - No frozen document amended beyond the amendment
    to AGENT-APP-SPEC.md 3.7 recorded in this session.
  - Client binary unchanged. Existing commands used by
    the Client (get_debtors, search_debtors) are
    untouched.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records
and DECISIONS.md for the HOW decisions.

End of entry.

## STATUS UPDATE - October 1, 2026 (Stage D.5 - plan
## view / calendar)

### What this session did

Continued Phase 9.5. Built the Agent's plan view.
Frontend-only slice. Zero Rust. Zero schema. No new
dependency. No new primitive. The invariant held.

### The commit

  D.5   1923666   plan view / calendar (8 files)

### What is now working on the Agent

Plan page (sidebar: Plan, between Today and Debtors):
  - FullCalendar with four views: Month, Week, Day,
    List. Prev / Today / Next navigation.
  - Three event sources overlaid:
      manual events (blue) - create, edit, delete
      payments due (red) - click navigates to debtor
      follow-ups due (amber) - click navigates to
                                debtor
  - Two cards below the calendar: Upcoming Payments
    and Upcoming Follow-ups. Fixed window: today
    through today + 30 calendar days.
  - Click an empty day (Month view) or select a time
    slot (Week / Day views) to open the create modal
    with that date or range prefilled.
  - Click a manual event to edit or delete it.
  - Link a manual event to any debtor, including
    related persons, via search-and-pick.

### What is verified on cloud

All behavioral tests passed:
  - Plan nav entry present, header reads "Plan".
  - Four views switch correctly.
  - Manual event created, rendered blue, edited,
    deleted, persisted across reload.
  - Derived payment rendered red. Click navigated to
    debtor profile. No edit modal.
  - Derived follow-ups rendered amber. Card and
    calendar entries matched.
  - Card rows navigated to debtor profile.
  - Bundles matched main (index-BARau3eA.js,
    index-2hhgwo-j.css).
  - Rust regression: gorka-agent PASS 2 warnings,
    gorka-client PASS 3 warnings, gorka-shared
    14/14.

### Key design choices

  - Stored events are MANUAL only. No event_type
    dropdown. Spec 11.7.
  - Derived events are display-only. Never passed to
    update or delete. Never written to
    calendar_events.
  - Calendar and cards read from the same three
    local.db.ts methods. Single source of truth.
  - Link-to-debtor picker searches all debtors,
    including related persons, per founder Position 2.
  - No new primitive in D.5.

### Known observations (not actioned)

  - Bundle grows by ~280 kB because FullCalendar is
    now imported. A 500 kB chunk warning appears.
    Expected and acceptable for MVP.
  - Cards use a fixed 30-day window. A payment beyond
    30 days renders on the calendar but not in the
    card. By design. Possible future UX improvement.

### Third-party plan review

The D.5 plan was reviewed before implementation.
Two points adopted (picker scope, card window
precision). Two rejected (a list of two calendar
commands that do not exist, and a reconnaissance gate
already satisfied). Recorded in DECISIONS.md.

### What is NOT started

  - D.6 - remaining screens (Communication Tools,
    cross-debtor Actions, cross-debtor Documents,
    Settings).
  - Agent end-to-end regression.

### Deferred from spec 11.7

  Three features described in spec 11.7 were not
  delivered in D.5:

    - Day panel: clicking a day opens a list of that
      day's manual events, payments, and follow-ups
      below the calendar (or as a modal).
    - Period summary: selecting a period shows counts
      of payments, follow-ups, and manual events in
      that period.
    - Bulk-select within the day panel and a "Send
      reminder to all selected" action.

  All three are deferred. The bulk flow depends on
  the D.6 Communication Tools surface, which does not
  exist yet. The day panel and period summary are
  independent and can land in a later Agent slice.

  Section 11.7 of the spec is unchanged. It remains
  the target. D.5 delivered the calendar core.

### Deviations recorded for this session

1. Documentation written after cloud verification,
   in one batch. Recorded as Dev-6 in DECISIONS.md.

### State at end of session

  Main machine:  1923666, clean, pushed.
  Cloud machine: 1923666, clean. Powered off by
                 founder at end of session.
  GitHub:        1923666.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed the
    boundary.
  - No frozen document amended. AGENT-APP-SPEC.md
    section 11.7 was already written and matches what
    D.5 implemented.
  - Client binary unchanged. Client commands
    (get_debtors, search_debtors) untouched.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records
and DECISIONS.md for the HOW decisions.

End of entry.


## STATUS UPDATE - October 2, 2026 (Stage D.6.1 and D.6.2)

### What this session did

Continued Phase 9.5. Closed the last two remaining
slices of the Agent frontend before the end-to-end
regression. Two implementation commits and one
documentation commit (this batch).

Two slices, both cloud-verified:

  D.6.1 - Communication Tools placeholder and Settings
          About-only. Five files. Frontend only.
  D.6.2 - cross-debtor Actions browser. Eight files.
          One new Rust command, one new shared function,
          one new shared struct.

### The commits

  D.6.1  3b578f3  Communication Tools placeholder +
                  Settings About-only (5 files)
  D.6.2  88ef81c  cross-debtor Actions browser (8 files)
  docs   (this)   extraction log, DECISIONS, HANDOFF,
                  START-HERE, SESSION-LOG, PHASE-PLAN

### What is now working on the Agent

Communication Tools page:
  - Card wrapper with a MessageSquare icon.
  - The exact spec 11.8 empty state sentence.
  - Reads nothing. No local_connectors table.
  - No migration triggered.

Settings page:
  - Four cards: About, Data, Sync, Security.
  - About: App name, Version 0.0.0 (hardcoded),
    Bundle id, Product name.
  - Data: gorka-agent.db and the app data path.
  - Sync: static placeholder text.
  - Security: single deferral line.
  - No password-change control.

Actions page (cross-debtor):
  - Table: Debtor, Type, Status, Assigned To, Due
    Date, Description.
  - Five status filter chips (All, Pending, In
    Progress, Completed, Cancelled). Client-side.
  - Sort: due_date ASC nulls last, then created_at
    DESC.
  - Debtor name click navigates to the profile.
  - Back button on the profile reads "Back to
    Actions" when reached from this page.
  - Read-only: no add, edit, or delete.

DebtorProfilePage:
  - Back-target computation extended to accept
    fromPath / fromLabel, generalizing the
    Relations-card case.

### What is verified on cloud

All behavioral tests passed for both slices:

  D.6.1: Communication Tools renders with the exact
    spec sentence. Settings renders all four cards
    with all fields. No console errors.

  D.6.2: Actions page renders. Chips work. Status
    filter works. Debtor link navigates. Back button
    reads "Back to Actions". Back returns to
    /actions.

Rust regression unchanged:
  gorka-agent 2 warnings, gorka-client 3 warnings,
  gorka-shared 14/14.

Frontend hashes matched main for both slices.

### What is NOT started

  - Agent end-to-end regression. This is the final
    Phase 9.5 pass.
  - Phase 9.6 (sync engine).

### Deferred (recorded so not forgotten)

  From D.6.2:
    - Type filter on ActionsPage.
    - Text search on ActionsPage.

  From D.5 (unchanged):
    - Day panel.
    - Period summary.
    - Bulk-select within a day panel.

### Process notes

Read-before-edit discipline broke once during D.6.1
(App.tsx was edited from memory). The founder caught
it. Corrective readback was performed. The edit
turned out correct, but the discipline was not
followed. Restored from D.6.1 file 2 onward. No code
impact.

D.6.1 file count corrected from 6 to 5 in the plan.
TopHeader.tsx already had both title entries from
D.3; no change was needed there.

D.6.2 file count corrected from 6 to 8 in the plan.
DebtorProfilePage's back-target extension and
local.db.ts's wrapper were not in the original
count. Founder approved.

### State at end of session

  Main machine:  88ef81c, clean, pushed.
  Cloud machine: 88ef81c, clean.
  GitHub:        88ef81c.

### Next work

  1. Agent end-to-end regression. Final Phase 9.5
     pass. All pages, all flows, on a fresh cloud
     session.
  2. Close Phase 9.5.
  3. Phase 9.6 begins with reading
     SYNC-ARCHITECTURE.md v1.3 and LOCAL-TABLES.md
     v1.3. No code on day one.

See PHASE-9.5-EXTRACTION-LOG.md for the two slice
records and DECISIONS.md for the HOW decisions.

End of entry.


## STATUS UPDATE - October 2, 2026 (Phase 9.5 closed)

### What this session did

Closed Phase 9.5. Ran the Agent end-to-end regression,
found and fixed a logout defect, changed the bundle
identifier for both apps, removed an obsolete Client
storage migration, added a Support sidebar placeholder,
and wrote the Phase 9.5 closure documentation.

Two implementation commits and one documentation commit
(this batch).

### The commits

  e9488aa  Phase 9.5 closure fixes: logout wiring,
           bundle identifier change, Support item
           (6 files)
  92e9b7c  Client storage migration removal
           (2 files, one deleted)
  (this)   documentation batch: extraction log,
           DECISIONS, HANDOFF, START-HERE, SESSION-LOG,
           PHASE-PLAN

### The Agent end-to-end regression

Ten of eleven steps passed on first pass. One defect.

  Entry flow (Login, Unlock, Enroll)      PASS
  Debtors list (rows, badges, total,
    search)                               PASS
  Debtor profile (all cards)              PASS
  Photo change                            PASS
  Relations (add, navigate, back)         PASS
  Plan view (calendar, derived events)    PASS
  Communication Tools                     PASS
  Settings (layout)                       PASS
  Actions page                            PASS
  Persistence across process restart      PASS
  Logout button                           FAIL

The logout failure is why the closure slice exists.

### What was fixed

Logout button. Was wired to the entry-flow check
function, which re-verifies state and re-selects the
shell step. Never called the logout command. Now bound
to a dedicated handler that invokes logout and returns
to the Login step. Verified on cloud.

Bundle identifier. Both apps changed from
com.gorka.* to click.gorka.* (real domain is
gorka.click). The reverse-DNS form is now correct.
Both apps start fresh at the new identifiers. Old
%APPDATA%\com.gorka.*\ folders are abandoned,
disposable mock data.

Obsolete Client storage migration. The Phase 2B
storage_migration.rs module from September 28 fired
on every Client launch after the identifier change,
copying an old DB into the new identifier's folder and
causing an "Enter" screen instead of "Set". Removed
the module declaration, the setup() call, and the
file. Verified: the Client now shows "Set" on first
launch.

Support sidebar item. Added between Copilot and
Settings. Disabled with a "Soon" badge. Same treatment
as Copilot. No functionality.

### What is now working

Phase 9.5 is complete. Both binaries build. The Agent
App runs on cloud with all screens working:

  - Entry flow (Login, Unlock, Enroll)
  - Debtors list, profile, photo, relations
  - Plan view (calendar)
  - Communication Tools (placeholder)
  - Settings (About, Data, Sync, Security)
  - Cross-debtor Actions page
  - Logout button (fixed)
  - Support sidebar item (placeholder)

The Client Dashboard runs on cloud at the new
identifier. No storage migration, fresh DB.

### Support spec - sequencing decision

The GORKA support specification (GORKA-SUPPORT-SPEC.md)
will be written before Phase 9.6 begins. It is a
parked deliverable. Support and the sync engine do not
touch: support lives in the Control Plane, sync
operates on local replicas plus Control Plane as a
broker. Writing it now, while the analysis is fresh,
preserves the work without delaying the plan.

The spec will be written against the current
architecture, not as a revival of the old Support
System Spec v2.3. The old spec is a source of
business requirements (status flow, categories,
priorities, reply separation, audit pattern, rate
limits, pagination) but not of architecture
(Express/Prisma/PostgreSQL, four-role model, three
frontend targets).

### State at end of session

  Main machine:  92e9b7c, clean, pushed.
  Cloud machine: 92e9b7c, clean, powered off.
  GitHub:        92e9b7c.

### Next work

  1. Write GORKA-SUPPORT-SPEC.md. Parked deliverable.
     Structure proposal first, founder approves, then
     write one section at a time. Commit the file plus
     a DECISIONS marker.
  2. Begin Phase 9.6. Read SYNC-ARCHITECTURE.md v1.3
     and LOCAL-TABLES.md v1.3 in full. No code on day
     one. Propose the sync-engine implementation plan.
  3. Then CONNECTOR-MODEL.md at the start of Phase 9.6.
     The connector context dump from October 1 is the
     input.

See PHASE-9.5-EXTRACTION-LOG.md for the two closure
slice records and DECISIONS.md for the HOW decisions.

End of entry.


## STATUS UPDATE - October 3, 2026 (Phase 9.6 through Batch 6b-1)

### What this session did

Phase 9.6 was opened and eight batches were built, verified on
cloud, and (for the last two) verified live. This entry records the
state.

### The batches

  Batch 1   Category D migrations v8           7b4b35c
  Batch 2   Transactions + event origination   6c0a8c4, 8d12eec
  Batch 3   entity_field_state at origination  cbac09c, bd2f751
  Batch 4a  Wire-format parsers                0d1e2bc, 800791a
  Batch 4b  Receiving pipeline                 b76c15f
  Batch 5   Transport and session              ecdb34f, ca49dd2
  Batch 6a  Sync engine, direct TCP            21157b8, f46cbcd
  Batch 6b-1 Control Plane discovery           900bfbd, 55976d4,
                                                e963c4d, 0fc95ee
  docs      Extraction log                     08907bf

### What is now working

A full MVP sync engine, direct connection path, with Control Plane
discovery:

- Category D migrations run on both apps.
- Every mutation originates an event in the same transaction as the
  state change.
- The receiving pipeline accepts, duplicates, rejects, defers, and
  reconciles.
- The handshake and session protocol work on real TCP.
- The engine drives sessions in both binaries.
- The Control Plane provides discovery: the Agent calls
  discover_peer and gets the Client's address; no manual peer
  address needed.

### Live verification (cloud, 2026-10-03)

Two apps running as separate binaries on the cloud machine:

- Both reached synced over TCP loopback.
- Debtor inserted on Client propagated to Agent within two seconds.
- Multiple debtors converged.
- Discovery path: Agent called discover_peer, got the Client's
  registered endpoint, dialed it, handshake succeeded, debtor
  propagated. All without a typed peer address.

### Criteria proven

1 (initial sync), 2 (new debtor propagation), 4 (event propagation),
7 (no data loss), 8 (direct connection path).

Criteria built but not exercised live: 3 (state update), 6
(duplicate prevention), 10 (corrupted message rejection).

Criteria not started: 5 (offline then reconnect), 9 (relay
fallback).

### What is next

Batch 6b-2a - backend relay service (WebSocket). Criterion 9.

Batch 6b-2b - client relay fallback.

Batch 7 - full ten-criterion acceptance.

Then the sync indicator slice, and CONNECTOR-MODEL.md.

### State at end of session

  Main machine:  08907bf (this doc commit follows separately),
                 clean, pushed.
  Cloud machine: 0fc95ee, clean except test-output.txt (scratch).
  GitHub:        0fc95ee plus this doc commit.

39 shared tests pass. Agent 2 warnings, Client 3 warnings,
shared 6 warnings.

See PHASE-9.6-EXTRACTION-LOG.md and DECISIONS.md for the full
records.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held.
  - No frozen document amended.

End of entry.


## STATUS UPDATE - October 3-5, 2026 (Batch 6b-2b, Batch 7 acceptance, Test C closed with finding)

### What this session did

Closed Batch 6b-2b (client relay fallback). Ran Batch 7 - the full ten-criterion sync-engine acceptance - live. Ran the two §12.2 extra tests. Confirmed the two founder-requested extra tests already recorded (A, B). Diagnosed and closed Test C. Reverted all diagnostic machinery. Rebuilt clean at both warning baselines.

### Batch 6b-2b - client relay fallback

Commit chain:

  da8ec6d  connector side
  bbe28dd  test fix
  096ff0f  listener side
  bcf6624  temporary test change (force relay path on loopback)
  7cdac88  revert of the temporary test change
  04bc5db  post-hoc Cargo.lock alignment (tungstenite 0.21.0)

Transport generalization: SessionTransport and HandshakeTransport traits. Session holds Box<dyn SessionTransport>. Direct TCP preferred, relay fallback when TCP fails. Listener side opens a parallel pairing WebSocket. Criterion 9 proven over the relay: relay_sessions row cmusrkd4t0005uvh4vtnsiqji, 1898 bytes, ENDED, normal-close.

Windows Firewall loopback finding recorded: netsh advfirewall rules do not filter 127.0.0.1 connections. Forcing the relay path on the same machine required a temporary listener-port change (bcf6624, reverted at 7cdac88).

### Batch 7 - full ten-criterion acceptance

All ten MVP sync-engine acceptance criteria proven live:

  1  Initial sync between two machines       PROVEN
  2  New debtor propagation                  PROVEN
  3  State update propagation                PROVEN
  4  Event propagation, append-only          PROVEN
  5  Offline, reconnect, reconcile           PROVEN
  6  Duplicate prevention                    PROVEN
  7  No data loss under normal operation     PROVEN
  8  Direct connection path                  PROVEN
  9  Relay fallback path                     PROVEN (6b-2b)
  10 Corrupted message rejection             PASS

### §12.2 extra tests

Out-of-order arrival: PASS. Three debtors in a tight burst, batch reversed on the wire, Client converged to three rows, no duplicates, no missing.

Connection-drop-mid-sync: PASS. Twenty debtors inserted on Agent, Client killed with taskkill /F mid-transfer, relaunched, engine restarted, Agent reconnected, unacknowledged events re-sent. Client converged to twenty rows, no duplicates, no missing.

### Founder-requested extra tests A and B - PASSED (prior session)

Test A - Agent killed mid-sync, catches up. 300 debtors inserted while Agent offline; Client reached 316; taskkill /F on gorka-agent.exe mid-transfer; Agent relaunched and caught up to 316. No loss, no duplicates.

Test B - Client killed mid-receive, catches up. 200 debtors inserted while both offline; Agent reached 516; taskkill /F on gorka-client.exe mid-receive; Client relaunched and caught up to 516. No loss, no duplicates.

### Criterion 10 - PASS

Corrupted-frame rejection, session termination, retry, successful recovery, and data preservation are proven. The rejecting engine records the internal error and enters the normal recovery state sequence. No data loss, no duplicate effect.

### Test C - CLOSED WITH FINDING

The corrupted-frame rejection and recovery behavior is proven. The rejecting engine writes Error(...) internally, but the UI does not expose that transient state because it is immediately replaced by Offline. The UI-visible recovery sequence Offline -> Connecting -> Pending -> Synced was directly observed under a 60-second polling window. No production defect was identified. The remaining question of whether transient cryptographic/session failures should have a separately visible error indication is deferred as a future status/UX design decision.

The reviewer's ruling: GO with Option A - do not modify production code. Close Test C with a documented finding. Treat visible transient Error as a future design decision rather than an MVP defect. Full reasoning recorded in DECISIONS.md.

No production code was changed to make Test C's original wording pass. No artificial Error display window was introduced.

### Diagnostic machinery - all reverted

Five temporary commits added probes and hooks during Batch 7. All reverted in one commit at the end:

  4e090e0 - Revert every Batch 7 Test C diagnostic probe and hook.
  Diff of shared/src/sync_engine.rs, shared/src/sync.rs, and
  src-tauri-agent/src/main.rs against the pre-probe state 224bd79
  is empty.

### Verification after revert (cloud, 4e090e0)

  gorka-agent build   PASS, 2 warnings
  gorka-client build  PASS, 3 warnings
  gorka-shared        PASS, 6 warnings
  shared tests        39/39 PASS

### The one Cargo.lock commit

04bc5db. Cargo.lock sync after 6b-2b. Tungstenite 0.21.0 plus transitive deps. Committed 2026-10-04. Documented in the extraction log under 6b-2b. No source or protocol change.

### Claim D - not folded into this batch

The boundary-test multi-machine relay claim (BOUNDARY-TEST-PLAN.md §2.4) was not folded into Batch 7. Reason: forcing the relay path on loopback needs a temporary code change, and the reviewer's ruling for this batch was no production changes during diagnosis. Claim D remains a Phase 15 item.

### What remains in Phase 9.6 after Batch 7

  - The sync indicator slice (replace the static TopHeader
    placeholder with a functional status reader).
  - CONNECTOR-MODEL.md.
  - Then Phase 9.6 closes and Phase 9.7 (multi-user
    demonstration) can begin planning.

### State at end of session

  Main machine:  4e090e0, clean, pushed.
  Cloud machine: 4e090e0, clean except known untracked scratch
                 files (b7-meta-check.cjs, build-6b2b*.txt,
                 check-columns.ts, relay-check.cjs,
                 test-6b2b*.txt, test-output.txt).
  GitHub:        4e090e0.

39 shared tests pass. Agent 2 warnings, Client 3 warnings, shared 6 warnings.

See PHASE-9.6-EXTRACTION-LOG.md and DECISIONS.md for the full records.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held.
  - No frozen document amended.
  - No production logic change was made for any test.

End of entry.

## STATUS UPDATE — October 5, 2026 (9.6.10-A/B/C, header polish, Client entry-flow redesign)

### What this session did

Closed three slices that had landed on main without a HANDOFF entry: the sync-indicator work (9.6.10-A/B/C), the Client header polish, and the Client entry-flow redesign.

Two of the three are recorded as honest summaries, sourced from commit messages and the repository state, because their full design sessions were not available. The third was executed this session and is fully documented.

### Slice 1 — 9.6.10-A/B/C

  d5d53b3  auto-start on unlock (Client + Agent)
  357c361  sync indicator in both apps
  7beec24  wire SyncIndicator into Client's real AppShell header
  a13a1f9  Agent SyncIndicator CSS import
  89ab7fa  Agent logout moved to sidebar

The static TopHeader sync placeholder is replaced by a functional reader. The sync-indicator slice from the Phase 9.6 closure list is done.

### Slice 2 — Header polish

  f168d8e  header polish: real name in Client (initial)
  922f182  fix: closing brace in auth_http::login
  56a674e  fix: restore lost functions in auth.rs and main.rs
  f8cdc75  cleanup: remove unused tauri::Manager import

The Client header now shows the user's real name, with email fallback and initials derived from the displayed name. Three intermediate fix commits are recorded in DECISIONS.md.

### Slice 3 — Client entry-flow redesign

Commit ffb3d56.

The Client's Login and Unlock screens now use the Agent's visual vocabulary: same primitives, same design tokens, one vocabulary across both apps.

Concretely:
  - The Agent's primitives/ folder (25 files) was copied into the Client. Byte-identical.
  - The Client's orphaned design-tokens.css (zero importers, verified by grep) was overwritten with the Agent's token file. Byte-identical.
  - main.tsx imports the token file once.
  - Login.tsx and UnlockScreen.tsx were rewritten using EntryCard, GorkaLogo, ErrorBanner, Input, Label, Button variant="primary".
  - The stale "Supervisor Dashboard" subtitle became "Client Dashboard".
  - Login.css and UnlockScreen.css were created with local helper classes.
  - The three Tauri-heritage console.log/console.error debug lines were dropped.

Logic untouched. Same auth.login call, same database_exists check, same unlock_database call, same onUnlocked callback. App.tsx unchanged. No Enroll screen on the Client — the Client is the admin, it exports, it does not import.

### What is verified

Local:
  npm run build passes on main at every step.

Cloud:
  Pulled ffb3d56. npm run build passes (18.69s).
  Launched the Client with backend running and Vite dev server running.
  Login renders with red GORKA wordmark, "Client Dashboard" subtitle, purple Sign In button, EntryCard shape. Logged in, reached Unlock, reached Dashboard. Redesign confirmed live.

### What is unchanged

  - App.tsx
  - Any Rust source
  - Any Tauri command
  - The Agent
  - Login → Unlock → Dashboard flow
  - The invariant

### Commits on main since f8cdc75

  d5d53b3  9.6.10-A auto-start on unlock (Client + Agent)
  357c361  9.6.10-B sync indicator in both apps
  7beec24  wire SyncIndicator into Client's real AppShell header
  a13a1f9  Agent SyncIndicator CSS import
  89ab7fa  Agent logout moved to sidebar
  f168d8e  header polish: real name in Client (initial)
  922f182  fix: closing brace in auth_http::login
  56a674e  fix: restore lost functions in auth.rs and main.rs
  f8cdc75  cleanup: remove unused tauri::Manager import
  ffb3d56  Client entry-flow redesign

### State at end of session

  Main machine:  ffb3d56, clean, pushed.
  Cloud machine: ffb3d56, clean.
  GitHub:        ffb3d56.

### What remains in Phase 9.6

  - CONNECTOR-MODEL.md.
  - Then Phase 9.6 closes and Phase 9.7 (multi-user demonstration)
    can begin planning.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held. No debtor data crossed any boundary.
  - No frozen document amended.

End of entry.

## STATUS UPDATE — October 6, 2026 (CONNECTOR-MODEL.md frozen)

### What this session did

Wrote, reviewed section by section, corrected, and froze GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md. Fourteen sections. Committed as 2f0d10c. Pushed to origin/main.

The document is the connector specification: how the Client Dashboard and the Agent App interact with third-party communication providers (Twilio, Resend, Mocean, future) and with the AI provider (Gemini). It is the last item in the Phase 9.6 closure list.

### The document

  Version:    1.0
  Status:     FROZEN
  File:       GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md
  Size:       203,015 bytes
  Sections:   14 plus header and section map

Sections:

  1. Purpose, scope, and status
  2. The two planes and the three zones
  3. The connector catalog
  4. Admin enable/disable
  5. The agent view
  6. Credential storage and distribution
  7. Provider adapters in the shared crate
  8. Single-recipient send flow
  9. Message logging and sync
  10. Compliance enforcement hooks
  11. Aggregate usage reporting
  12. AI Copilot as a connector
  13. Zone 3 declaration
  14. Open items

### The two-sided model, settled

Admin enables and provides credentials on the Client Dashboard. Agent sends from the Agent App. The credential reaches agent devices through a dedicated encrypted sync event on the existing sync channel. Agents never see or type provider credentials. The GORKA cloud never holds the credential of either a Tier 1 subaccount or a Tier 2 BYOP key.

Tier 1 (GORKA-managed): GORKA provisions a per-client subaccount using its master credential. The subaccount credential reaches the client's devices. The agent device sends directly to the provider.

Tier 2 (BYOP): the client's own credential is entered on the admin's device, stored locally, distributed the same way.

Both tiers use credentialsLocation = LOCAL. The MVP does not implement CLOUD.

### Section 14 — the two hard blockers

A1. SYNC-ARCHITECTURE.md amendment: three new event types (CONNECTOR_ENABLED, CONNECTOR_DISABLED, CONNECTOR_CREDENTIAL_REPLACED), one new entity type (CONNECTOR), payload schemas, wire encodings, validation, reconciliation.

A2. SYNC-ARCHITECTURE.md amendment: created_by in COMMUNICATION_LOGGED. §25.13.9 says the field is present, §25.11.3 does not list it, and the V6 vector does not encode it. Resolution: add created_by to §25.11.3 as a required field with a new type code (0x5006), update the V6 vector.

Neither hard blocker can be sidestepped by starting implementation first.

### Other blocked items

A3. LOCAL-TABLES.md amendment: two new local tables (the connector local record, the compliance rules record) and their indexes. The "cache" is the same connector record viewed from two angles, not a third table.

A4. CLOUD-TABLES.md verification: confirm the organization_audit_events table's columns support the Zone 3 acknowledgment record. No schema change expected; verification only.

### Implementation-phase tasks recorded

Client Dashboard (B1 through B7): fix Connectors.tsx's endpoints; remove import.meta.env.VITE_* reads from ConfigurationModal.tsx; replace the Tier 2 credential submission path with a local Tauri command; wire the Zone 3 audit record; add the "Local compliance rules" configuration page; display "rules last configured at"; build the Tier 1 credential transit verification.

Agent App (C1 through C7): register the send command; register the test-connection command; build the Copilot command; structurally enforce the AI boundary layer path; write the credential-leak regression test for every adapter; write the registry invariant test; verify the /api/connector-usage/sync route's organizationId source.

### Funded-phase items recorded

D1 through D21, in the document's Section 14.4. Includes credential fingerprints, organization-wide compliance synchronization, per-channel disclosure and contact limits, scheduled sends, voice, weekly/daily periodicity, frozen closed periods, AI usage aggregates, local_ai_history, delivery-status event, message-queue retry, provider-side idempotency, more Tier 1 providers, Mocean Tier 1, Gemini Tier 1, Zone 3 "remember this choice," additional Zone 3 categories.

### Method used

Same as the recovery's standard: write one section, send for external review, apply corrections in place, move to the next. Four review batches over the session. Every correction from the four reviews was applied before the next section was written.

### The pre-Tauri document extraction

The session read five pre-Tauri specification documents the founder placed in the conversation (Twilio/Comm Service, Connecting Spec, Communication Service, AI Copilot, Super Admin). They assume an Electron + centralized-cloud architecture that no longer applies. The session extracted the implementation-grade patterns that survive the architecture change (provider-adapter pattern, provider-config routing, structured result shape, idempotency, retry, compliance rules, fact-validation for AI, MFA, immutable audit, archive-not-delete, anonymized analytics) and rejected everything that assumes the cloud sees content. The extraction is embodied in the new document; the raw reasoning is recorded in DECISIONS.md.

### State at end of session

  Main machine:  2f0d10c, clean, pushed.
  Cloud machine: 36dc292, one commit behind.
  GitHub:        2f0d10c.

### What comes next

  1. On cloud: `git pull`. Brings cloud to 2f0d10c.
  2. Then the two amendments in order: A1 (connector event types), then A2 (created_by reconciliation).
  3. Then A3 (LOCAL-TABLES.md amendment), A4 (CLOUD-TABLES.md verification).
  4. Then the implementation-phase work.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched (release.yml unchanged).
  - Invariant held.
  - No code changed.
  - No frozen document amended. The document names the amendments it requires; they are applied through their own processes.

End of entry.
