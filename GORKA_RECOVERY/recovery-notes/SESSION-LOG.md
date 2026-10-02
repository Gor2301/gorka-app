\# GORKA RECOVERY - SESSION LOG



Session dates: September 11-12, 2026

Duration: Two days

Participants: GORKA founder + AI architect

Purpose: Chronological record of the recovery session.



This document complements HANDOFF.md.

\- HANDOFF.md tells you WHERE we are.

\- SESSION-LOG.md tells you HOW we got here.



The new AI should read both.



\---



\## 1. THE PROBLEM WE FOUND



Date: September 11, 2026



Before this session, a period of architectural drift had occurred (Sept 9-10, 2026).



During an attempt to fix a registration failure, the previous session:



\- Added debtor-related tables to the cloud Supabase database

\- Added 18 tables that mixed cloud and local concerns

\- Tried to reconcile the schema against a database that was already wrong

\- Lost two days



Root cause: Registration failed. Instead of debugging down the chain (spec -> schema -> backend -> test), the previous session questioned the architecture. It began rebuilding around the wrong assumptions.



The recovery began with a single rule:



Stop trying to make the old database fit. Build the correct database from the specs.



\---



\## 2. PHASE 0 - FREEZE AND BACKUP



Date: September 11, 2026 (morning)



Actions:

\- Created GORKA\_RECOVERY folder structure

\- Backed up: production database dump, current prisma schema, migrations, backend source (100 files), Tauri source (27 files), .env

\- Copied all three spec files into GORKA\_RECOVERY/specs/

\- Zero modifications to any active code or database



Outcome: A known-good recovery point. Nothing changed. Everything preserved.



\---



\## 3. PHASE 1 - ARCHITECTURAL LAW



Date: September 11, 2026



Created GORKA\_RECOVERY/recovery-notes/ARCHITECTURAL-LAW.md (v1.0).



This document established:

\- The Invariant: No individual debtor information is stored in GORKA cloud infrastructure.

\- Two data planes: Cloud (control plane) vs Local (debtor data plane)

\- Definitions: Debtor data vs Customer data

\- The rule for every decision: Does this contain or reference an individual debtor?

\- The proof test (fake debtor, trace network, confirm no leak)



Later amended to v1.1 (see Phase 2 for details).



\---



\## 4. PHASE 2 - DECISION DOCUMENTS



Date: September 11, 2026



Eight documents were written:



1\. ARCHITECTURAL-LAW.md - the constitution (v1.0, later v1.1)

2\. RECOVERY-RULES.md - the 14 rules + zero production SQL

3\. DATA-BOUNDARY-MATRIX.md - every data type, cloud or local

4\. CLOUD-TABLES.md - the 19 cloud tables with the four-question contract

5\. LOCAL-TABLES.md - the local SQLite schema reference

6\. DECISIONS.md - every decision from this session with reasoning

7\. ARCHITECTURAL-LAW-AMENDMENTS.md - version history

8\. PRODUCTION-REBUILD-PLAN.md - the Phase 17 cutover plan



Key decisions made during this phase:



\- Cloud tables: 19 (Core + Metrics + Audit + Support + Templates + Connectors)

\- Role enum simplified: OWNER / CLIENT / AGENT

\- Behavioral metrics allowed in cloud (client activity)

\- Two audit tables: cloud\_audit\_logs + boundary\_proof\_logs

\- Templates: parameterized only in cloud

\- Support: PII warning enforced in UI

\- Connector architecture: deferred to Phase 13-14

\- Boundary test: manual + automated

\- Production data: disposable (test data only)



\---



\## 5. PHASE 3 - CLOUD SCHEMA



Date: September 12, 2026



Created prisma/schema.cloud.prisma with 19 models:



\- Organization, User, Agent, License, PlatformSettings

\- AggregateMetrics, ClientActivityMetrics

\- CloudAuditLog, BoundaryProofLog

\- SupportTicket, SupportTicketReply, SupportTicketEvent, OrganizationAuditEvent, Notification, TicketCounter

\- Template

\- ConnectorCatalog, ClientConnector, ConnectorUsage



Method note: The file was written in chunks using PowerShell Add-Content. This was a deliberate workaround for a Notepad paste-truncation issue at the \~2500 byte mark. The chunks are atomic; the file ends up correct.



Validated with: npx prisma validate --schema=prisma\\schema.cloud.prisma

Result: The schema at prisma\\schema.cloud.prisma is valid.



\---



\## 6. PHASE 3.5 - BACKEND CLEANUP



Date: September 12, 2026



Purpose: Move backend files that reference forbidden models OUT of the active routes folder BEFORE generating the new Prisma client. This was a reordering from the original plan, recommended by a peer reviewer.



Files moved to src/backend/\_disabled/routes/:



\- analytics.routes.ts (used debtor, messageLog)

\- audit.routes.ts (used activityLog)

\- calendar.routes.ts (used calendarEvent, activityLog, debtor)

\- clients.ts (used debtor, activityLog)

\- compliance.routes.ts (used debtor, activityLog)

\- connector.routes.ts (used connector)

\- debtors.ts (used debtor, activityLog)

\- permissions.routes.ts (used permissionRole)

\- status.ts (used debtor, action)

\- users.routes.ts (used activityLog)



File moved to src/backend/\_disabled/jobs/:



\- audit-retention.job.ts (used activityLog)



Files kept active:



\- auth.ts (only uses organization, user)

\- dashboard.routes.ts (only uses user, supportTicket)

\- support.routes.ts (only uses organization, supportTicket)



index.ts updated:

\- Removed 10 route imports

\- Removed 10 route mounts

\- Kept 3 route mounts + health + forbidden-endpoint blacklist



Result: Backend starts cleanly. No compile errors from Prisma references.



\---



\## 7. PHASE 4 - PRISMA GENERATION AND COMPILE



Date: September 12, 2026



Ran: npx prisma generate --schema=prisma\\schema.cloud.prisma



Result: Prisma client generated for the 19 cloud models.



Verified:

\- node\_modules/.prisma/client/index.d.ts contains 19 model definitions

\- Zero occurrences of the string Debtor in the generated client

\- Backend compiles (no Prisma errors)



Note: 36 TypeScript errors remain, all in leftover Electron-era folders (src/frontend, src/renderer, renderer). These are cosmetic and non-blocking. Recorded in DECISIONS.md as a known issue.



tsconfig.json was inspected but NOT modified. The file remains in its original state to avoid unintended side effects.



\---



\## 8. PHASE 5 - DESTROY AND REBUILD gorka\_test



Date: September 12, 2026



Actions:



1\. DROP DATABASE IF EXISTS gorka\_test;

2\. CREATE DATABASE gorka\_test;

3\. npx prisma db push --schema=prisma\\schema.cloud.prisma (with DATABASE\_URL pointing at gorka\_test)

4\. Verified with \\dt: exactly 19 tables, all correct names

5\. Verified no debtor table: SELECT tablename FROM pg\_tables WHERE tablename LIKE %debtor% -> 0 rows

6\. Verified no debtor column: SELECT column\_name FROM information\_schema.columns WHERE column\_name LIKE %debtor% -> 2 rows (both allowed: debtor\_count in aggregate\_metrics, debtor\_data\_included in boundary\_proof\_logs)



Result: gorka\_test is now a clean cloud-only schema.



\---



\## 9. PHASE 6 - MANUAL CLOUD SCHEMA VERIFICATION



Date: September 12, 2026



All 19 tables were inspected with psql \\d. Verification performed in 5 batches.



Checks performed per table:

\- Primary key present on id

\- Foreign keys point to correct target

\- Unique constraints present where expected

\- Nullable matches Prisma schema

\- Defaults match (PENDING\_EMAIL, ACTIVE, now(), etc.)

\- Indexes present for query patterns



Findings:



\- All 19 tables structurally correct

\- No anomalies

\- Notable correct design: support\_tickets uses ON DELETE RESTRICT (audit integrity), support\_ticket\_replies uses ON DELETE CASCADE (replies go with ticket)

\- Notable correct design: templates.organization\_id is nullable with ON DELETE SET NULL (GORKA defaults survive org deletion)

\- Notable correct design: connector\_usage has unit\_price + pricing\_version fields so historical invoices stay accurate when pricing changes



\---



\## 10. PHASE 7 - REGISTRATION



Date: September 12, 2026



Seeded ticket\_counter with required default row.



First registration attempt FAILED with:



&#x20; Unknown argument emailVerificationToken.



Diagnosis: The backend (auth.ts) uses three fields that were missing from the cloud schema:

\- emailVerificationToken

\- emailVerificationExpires

\- verificationStatus values PENDING\_EMAIL and ACTIVE (schema default was PENDING)



Decision point:



Two options were considered:

A. Add the missing fields to the schema (email verification is a real feature)

B. Remove the fields from the backend (email verification not in scope)



The founder confirmed: email verification is a required part of registration. The client registers, receives a verification email, clicks the link, and is redirected to the client dashboard.



Resolution (Option A):



Added to Organization model in schema.cloud.prisma:

\- emailVerificationToken   String?   @map(email\_verification\_token)

\- emailVerificationExpires DateTime? @map(email\_verification\_expires)

\- Changed verificationStatus default from PENDING to PENDING\_EMAIL



This is NOT a case of adding random columns to make a test pass. The fields are part of a legitimate cloud concern (account verification) and are explicitly used by the backend. Adding them was the correct fix at the schema level, not the architecture level.



After the fix:

\- prisma db push succeeded

\- registration succeeded

\- Response: { success: true, data: { organizationId, userId, message } }



\---



\## 11. PHASE 8 - LOGIN AND AUTH



Date: September 12, 2026



Login test succeeded immediately:

\- POST /api/auth/login returned success with JWT and redirectUrl



Bug discovered during /api/auth/me test:



The response included emailVerificationToken in plaintext. This is a security leak — the token should never leave the server.



Attempted fix: Prisma @omit attribute on the two fields.



This failed: Prisma 6.19.3 does not support @omit (it was introduced in a later version).



Attempted fix (reverted to): change the /api/auth/me endpoint to use an explicit select instead of organization: true.



Added 16 field selections (all except emailVerificationToken and emailVerificationExpires).



After restart: /api/auth/me returned organization data with no token leak. Verified.



Second bug discovered during registration test:



Every new user was created with role OWNER instead of CLIENT. This is a security issue — every registering agency owner would become the platform owner.



Fix:



\- auth.ts line 136: role OWNER changed to CLIENT

\- auth.ts lines 369, 481: PLATFORM\_OWNER changed to OWNER (the enum value)

\- Existing test user test@example.com updated: role changed from OWNER to CLIENT in database



After fix: registration of a second test user produced role CLIENT. Verified.



Final state of auth (all verified working):



\- Registration creates organization + user with CLIENT role

\- Login returns JWT token and redirect URL

\- /api/auth/me returns user + organization, no sensitive fields

\- Email verification token is stored (hashed) but never returned by the API



\---



\## 12. SESSION PAUSE AND MIGRATION PREPARATION



Date: September 12, 2026 (afternoon)



At this point the session was paused because the chat context was growing large. To preserve continuity for a new session, the following artifacts were created:



1\. HANDOFF.md - a full reference document (10 sections) describing the state of recovery and the rules for continuation

2\. NEW-CHAT-STARTER.txt - a shorter, paste-ready message for use as the first message in a new chat

3\. SESSION-LOG.md - this document, the chronological record



All three live in GORKA\_RECOVERY/recovery-notes/.



\---



\## 13. RECOMMENDED NEXT STEP



Phase 9 - Tauri Local Database Verification



Goal: Verify the Tauri app local SQLite data plane:

\- SQLCipher encryption is actually active

\- Unlock flow works (correct password succeeds, wrong password fails)

\- Debtor CRUD works

\- Debt CRUD works

\- Document upload works

\- Communication logging works

\- Action CRUD works

\- Local audit log records operations

\- Data persists across restart



Source of truth: GORKA\_RECOVERY/specs/Tauri-v3.2/tauri-spec-v3.2.txt



The local Rust code is in src-tauri/src/ (db.rs, auth.rs, main.rs).

The Tauri frontend is in supervisor-dashboard/.



\---



\## 14. PRESERVED WORKING ARTIFACTS



Items that were NOT modified during this recovery:



\- Tauri CI/CD workflows in .github/

\- GitHub Release v0.1.0 with Windows/macOS/Linux installers

\- Working Tauri source code in src-tauri/

\- Working Tauri frontend in supervisor-dashboard/

\- Owner Dashboard in owner-dashboard/



These are the working baseline. They must not be touched unless a specific phase requires it.



\---



\## 15. INVARIANT RESTATED



No individual debtor information is stored in GORKA cloud infrastructure.



This invariant was held throughout Phases 0-8. It must be held through Phases 9-18.



If a future session is ever tempted to add debtor data to cloud (to make a test pass, to add a feature, or for any other reason), STOP. Read the Architectural Law. Read the Recovery Rules. Debug down the chain.



\---



End of Session Log.



\---



\## Session Extension — September 12–13, 2026



Phase 9 reconnaissance and partial runtime verification. Outcome:

blocked at frontend level. See DECISIONS.md "Phase 9 — Blocked —

September 13, 2026" for the record.



Binary under test: v0.1.0, commit c9efd44.

Environment: local backend on localhost:3000 against gorka\_test.

Test DB: fresh gorka-client.db created by Phase 9 first-run flow.

Old DB (Sept 7): preserved in two locations, unreachable through the

app because its settings.dat (holding the salt) no longer exists.



\---



\## Session Extension — September 14, 2026



Phase 9 unblock. Three items completed end to end.



\- Item 1 (document upload): DONE.

\- Item 1b (debtor detail page at /collections/:id): DONE.

\- Item 2 (debt CRUD): DONE.



Item 3 (communication logging): Rust commands written, compiled

into the binary. Frontend not yet built.

Item 4 (action CRUD): pending. Requires local schema migration v3.



Frontend files added or rewritten:

\- components/DebtorEditModal.tsx (new, shared)

\- components/DebtEditModal.tsx (new, shared)

\- pages/DebtorDetail.tsx (new)

\- pages/Collections.tsx (rewritten, names clickable)

\- services/local.db.ts (expanded with document + debt methods)

\- services/upload.service.ts (rewritten to be local-only)

\- pages/Upload.tsx (supervisor\_token check removed)

\- App.tsx (new /collections/:id route)



Rust changes:

\- src-tauri/src/main.rs: Debt structs and four commands;

&#x20; Communication enums and structs and three commands; updated

&#x20; generate\_handler!.



WDAC blocker discovered. Windows Application Control began

blocking newly built unsigned binaries. Root cause: Windows

updates and WDAC policy changes on 9/9/2026. Solution: self-signed

code-signing certificate (CN=GORKA Dev Signing, thumbprint

370532F494A44A0B46E789D40649B26A13096FDB), trusted at system

level. Every Rust build must now be signed before running.

`npm run tauri:dev` no longer works. Full workflow documented in

TAURI-DEV-WORKFLOW.md.



Documents created this session:

\- FRONTEND-REALITY.md

\- BOUNDARY-TEST-PLAN.md

\- TAURI-DEV-WORKFLOW.md

\- START-HERE.md



Phase 15 static boundary review completed. Runtime portion

deferred pending the Tauri frontend.



See DECISIONS.md "Phase 9 Progress — Items 1, 1b, 2 — September

14, 2026" for the full entry.



---

## Session Extension — September 17, 2026

### What this session did

This session produced the multi-user data model decision — the
single largest architectural decision in the recovery after the
invariant itself — and brought every affected document into
alignment with it.

The work was documentation only. No code was written. No
production was touched. No cloud schema was changed. The
invariant was reaffirmed and strengthened.

### The problem that was solved

GORKA's invariant holds for a single machine: debtor data in a
local SQLCipher database, cloud holding only customer accounts,
licensing, billing, and aggregate numbers.

GORKA's real customers are multi-user agencies: one admin, many
agents, some in the office, some at home, some in the field.
They need to see the same debtors. They need to see each other's
work. The admin needs to see everything the agents do.

That requirement — multiple machines, same data, no debtor data
on GORKA's servers — is the hardest problem in the platform. It
is not a feature. It is the foundation.

The session resolved it.

### The decision

Two models were considered.

- **Model A** — GORKA cloud as the sync relay. Rejected, because
  GORKA would hold debtor data, even briefly, even encrypted.
  The promise becomes harder to defend. A regulator or a bank
  hears the difference.

- **Model B** — direct machine-to-machine sync, brokered by
  GORKA. Adopted. The client's machines synchronize with each
  other. GORKA's servers help them find each other and step out
  of the way. Debtor data travels from one client-owned machine
  to another. GORKA never holds it.

Topology: hub-and-spoke for the MVP (the admin's machine is the
hub), mesh for production (any two machines sync directly). The
MVP constraint is stated explicitly everywhere it matters, so
that no reader assumes the MVP is the production model.

Device identity: user account for the MVP, combined user +
device for production. The migration cost is real and recorded.

Sync model: event-based from the beginning. Two categories of
data — state (mutable properties, deterministic rules) and
events (append-only business facts, never overwritten). The
application audit log is not the sync protocol's memory. This
distinction is essential and is recorded in both the concept and
the amended law.

Key management: the client decides who is authorized. GORKA
provides the mechanism and never holds the decryption keys. Lost
devices are a client problem, with GORKA-provided mechanisms.
Critical caveat recorded: revocation prevents future sync; it
does not delete data already replicated to an unreachable
device.

The canonical promise was reworded. The old formulation "debtor
data never touches our servers" was technically indefensible,
because a relay is sometimes required. The new formulation:

> **GORKA cannot decrypt your debtor data. This is an
> architectural property, not a policy.**

And the marketing form:

> **Your debtor data stays under your control. GORKA cannot read
> it.**

### Documents created or amended

**New:**

- `MULTI-USER-CONCEPT.md` — Version 2.0, frozen. The full
  concept. The source of truth for the multi-user model.

**Amended:**

- `ARCHITECTURAL-LAW.md` — v1.2. New Section 20, six
  subsections: the two planes, multi-device debtor data, the
  encrypted relay, the canonical promise, the reference to the
  concept, what the amendment does not change.
- `ARCHITECTURAL-LAW-AMENDMENTS.md` — new v1.2 entry with
  reasoning, changes, and relationship to prior versions.
- `DATA-BOUNDARY-MATRIX.md` — new Section 20, five subsections:
  encrypted sync payloads, Control Plane connection metadata,
  sync events and change history, what the new data types do
  not permit, extended proof test.
- `PHASE-PLAN.md` — v1.1. Three new phases added: 9.5, 9.6,
  9.7. Summary table updated.
- `LOCAL-TABLES.md` — new Category D with three tables:
  `sync_events`, `sync_state`, `sync_peers`. Total local tables:
  12 → 15.
- `CLOUD-TABLES.md` — new Section 20 with two tables:
  `device_registrations`, `relay_sessions`. Total cloud tables:
  19 → 21.
- `DECISIONS.md` — new long entry: "Multi-User Data Model —
  September 17, 2026."
- `HANDOFF.md` — new status update at the bottom.

### External review

The concept was reviewed twice externally before being frozen.
The first review identified missing pieces: the relay fallback
that makes direct connections sometimes fail, the distinction
between "GORKA cannot read" and "data never passes through
GORKA," the danger of a single organization key, the fact that
last-write-wins silently loses business events, and the
tendency to understate the difficulty of key management and
protocol design.

The second review confirmed the direction and identified
several refinements: the "spokes are the truth" wording was
dangerous and was replaced with "independently encrypted
replicas converging to one logical state"; the audit log and
the sync protocol's change history are two different things and
must not be merged; device identity must be first-class in the
protocol even though the MVP derives it simply; "cannot
decrypt" is a testable claim where "cannot read" is not.

All corrections were accepted and applied.

### Phase plan

Three new phases were added to the plan using the existing
decimal-numbering convention:

- **Phase 9.5** — Agent App and Client Dashboard, local only.
  Both binaries exist, both work locally, no sync. NOT STARTED.
- **Phase 9.6** — Sync engine, MVP scope. Hub-and-spoke,
  event-based, direct connection, encrypted relay fallback,
  single organization key. Ten acceptance criteria. NOT
  STARTED.
- **Phase 9.7** — Multi-user demonstration. Two laptops, working
  sync, rehearsed. NOT STARTED.

### What is explicitly deferred

- Mesh topology (production).
- Per-machine device identity (production).
- Key rotation (production).
- Offboarding and lost-device flows (production).
- Group key management and MLS (production).
- A cryptography specialist's review.
- A threat model and independent security review.

### The three documents that must be written next

1. `SYNC-ARCHITECTURE.md` — the technical specification of the
   sync engine.
2. `GORKA-MVP-SCOPE.md` — the MVP defined in full.
3. Threat model / security review — 3 to 5 pages.

Only after all three are written and approved does
implementation of the multi-user model begin.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held.
- No code written. Documentation only.
- Every amendment was additive. No existing rule was weakened.

### Notes on prior session

The September 15, 2026 session produced the SAC investigation
and the cloud Windows environment decision. That work is
recorded in `DECISIONS.md` under "SAC investigation and cloud
development environment decision — September 15, 2026" and in
`HANDOFF.md` under the corresponding status update. It was not
duplicated here.

That session also completed the frontend code for Phase 9 Item
4 (Action CRUD), which remains untested pending a working build
environment.

---

## Session Extension — September 18–20, 2026

### What these sessions did

These three sessions produced the multi-user model's remaining prerequisite documents and closed out the Section 22 gap in SYNC-ARCHITECTURE.md. The work was documentation only. No code was written. No production was touched. No cloud schema was changed. The invariant was reaffirmed and strengthened.

### September 18, 2026 — MVP scope and the three-zones amendment

`ARCHITECTURAL-LAW.md` was amended to v1.3. The new Section 21, The Three Zones of Data Control, names Zone 1 (GORKA cloud), Zone 2 (GORKA-provided mechanisms), and Zone 3 (client-connected third parties). The distinction the amendment makes: GORKA's obligation in Zone 2 is prevention — the mechanism is the guard — and GORKA's obligation in Zone 3 is warning, at the point of connection, recorded and non-blocking. The v1.0 and v1.2 law named the two planes but did not distinguish where the data left by a GORKA-provided mechanism versus a path the client chose outside GORKA.

`ARCHITECTURAL-LAW-AMENDMENTS.md` was updated with a v1.3 entry recording the reasoning and what did not change.

`GORKA-MVP-SCOPE.md` v1.1 was written and frozen. It defines the MVP in full: the three tiers, the MVP event set, the exact synchronized objects, the operational limitations, the demonstration, the prerequisites, and the acceptance criteria. It corrects the earlier ordering that placed SYNC-ARCHITECTURE.md before this document. The correct order is: this document, then SYNC-ARCHITECTURE.md, then the threat model, then implementation.

### September 19, 2026 — SYNC-ARCHITECTURE.md v1.0 frozen

`SYNC-ARCHITECTURE.md` was written and frozen at v1.0. Thirty sections in seven parts. It defines the exact wire format (TLV, big-endian, canonical serialization), the exact ordering rule (the protocol order: logical_clock, device_id, sequence, compared lexicographically), the exact reconciliation rule (per-field, most-recent-in-protocol-order wins, losing value preserved), the exact duplicate detection rule (event_id only), and the exact sync state machine (six states).

`§22.1` through `§22.6.7` were written at v1.0. The message-specific subsections, `§22.7` through `§22.19`, were left incomplete. This was the critical open problem carried into the next session.

`THREAT-MODEL.md` v1.0 was written and frozen, audited against `SYNC-ARCHITECTURE.md` v1.1 Sections 28 and 29. Nine residual risks (R1–R9) recorded as ACCEPTED by the founder with reasoning.

### September 20, 2026 — Section 25.13, LOCAL-TABLES.md v1.2, test vectors, Section 22 restoration

`SYNC-ARCHITECTURE.md` `§25.13` was written: the field-semantics specification, replacing the previous checklist. Contains `§25.13.1` through `§25.13.12`, including the field classification tables, NULL/empty/JSON-null semantics, canonical JSON (RFC 8785 with GORKA number restriction), canonical date-time (YYYY-MM-DD), canonical decimal, enum values, reference-field rules, attribution, updated_at semantics, and the field-name-to-column master mapping. The header was updated to v1.1 to record the amendment.

`LOCAL-TABLES.md` v1.2 was written. Category D rewritten to include D.1 through D.8. Shape B adopted (separate sync_state, sync_delivery, sync_peers). Four new sync tables: `organization_keys`, `history_records`, `pending_events`, `entity_field_state`. Four column additions to Category A: `debtors.deleted`, `actions.data`, `actions.deleted`, `communications.deleted`. Summary table shows 20 local tables.

`SYNC-TEST-VECTORS-v1.md` v1.0 (partially complete) was written. All fixtures pinned. Nine deterministic vectors recorded. Five marked SPECIFIED / TO BE COMPUTED (M1, M2, V1, V4, V6). Four marked BLOCKED: E1 needs the Argon2id parameters frozen in `§7.3`; H1, H2, H3 were blocked by the missing `§22.19`.

Section 22 restoration. The missing subsections `§22.7` through `§22.19` were recovered and inserted into `SYNC-ARCHITECTURE.md`. The inserted content was reviewed by the founder's technical reviewer, with six corrections applied:

1. `§22.7.1` and `§22.19.2`: distinguish fixed protocol Argon2id values from implementation defaults.
2. `§22.11`: SESSION_ESTABLISHED is one-way. "Exchanged" replaced with "received and accepted."
3. `§22.13.2`: entity types 0x02 (debt) and 0x05 (document) MUST NOT appear in accepted MVP sync events.
4. `§22.13.4`: required vs optional field rules defer to Section 25.
5. `§22.14.4`: the REJECTED-terminal rule belongs in `§18.2`, not hidden in `§22`.
6. `§22.19.1`: wording made precise.

### September 21, 2026 — Block C and header bump

Block C was applied. Two one-line amendments, verified by on-disk count:

- `§18.2`: "ACCEPTED, DUPLICATE, and REJECTED are all terminal delivery outcomes for the delivery bookkeeping defined in this subsection. REJECTED is terminal; the sender does not retry it automatically."
- `§11.4`: "The first event originated by a device instance has sequence number 1. Sequence number 0 is the initial value of the counter before any event has been originated; no event has sequence number 0."

The `SYNC-ARCHITECTURE.md` header was bumped to v1.2, dated September 21, 2026, with an amendment note recording Section 22 completed by restoration and the two Block C amendments.

`SYNC-TEST-VECTORS-v1.md` status was updated. H1, H2, H3 moved from BLOCKED to SPECIFIED. E1 remains blocked by the Argon2id parameters in `§7.3` / `§22.19.2`.

### Verification performed

Every edit was verified by reading the file on disk, not by trusting a paste. Specifically:

- `SYNC-ARCHITECTURE.md` sections 1–30 each present exactly once, in order.
- `§22` continuous from `22.1` through `22.19.4`, every subsection header exactly once.
- Byte-level checks: 363 correct em-dashes (E2 80 94), zero mojibake; 29 correct section signs (C2 A7) in the test-vector file, zero mojibake.
- Block C: `§18.2` count 1, `§11.4` count 1.
- v1.2 header: version line 1, date line 1, amendment note 1.
- Test-vector status: H1 fixed 1, H2 fixed 1, H3 fixed 1, old blocked line 0.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held. Every amendment was additive; no existing rule was weakened.
- No code written. Documentation only.

### What is still open

- **Argon2id parameters.** `§7.3` and `§22.19.2` need benchmarked values for the supported GORKA desktop environment. They block E1's deterministic bytes.
- **Test-vector computation.** The five SPECIFIED vectors and the four BLOCKED vectors need a working implementation, which requires the cloud Windows environment.
- **V2 Cloud Windows environment.** Not yet set up. Blocks the build and blocks vector computation.
- **MVP sync engine implementation.** After all of the above.

### What comes next

The next workstream is to set up the V2 Cloud Windows environment, benchmark the Argon2id parameters, compute the test vectors, then begin implementation of the MVP sync engine.

---

## Session Extension — September 18–22, 2026

### What these sessions did

Two distinct workstreams across five days: the completion of the multi-user model's remaining prerequisite documents (September 18–20), and the construction of the AWS cloud Windows environment (September 21–22). The second was the work that finally resolved the blocker recorded on September 15 — the Smart App Control enforcement that prevented the signed Tauri binary from running on the founder's main machine.

### September 18, 2026 — MVP scope and the three-zones amendment

`ARCHITECTURAL-LAW.md` was amended to v1.3. The new Section 21, The Three Zones of Data Control, distinguishes Zone 1 (GORKA cloud), Zone 2 (GORKA-provided mechanisms), and Zone 3 (client-connected third parties). GORKA's obligation in Zone 2 is prevention — the mechanism is the guard. GORKA's obligation in Zone 3 is warning at the point of connection, recorded and non-blocking. The v1.0 and v1.2 law named the two planes but did not distinguish these two cases.

`ARCHITECTURAL-LAW-AMENDMENTS.md` was updated with a v1.3 entry.

`GORKA-MVP-SCOPE.md` v1.1 was written and frozen. It defines the MVP in full: three tiers, the MVP event set, the exact synchronized objects, the operational limitations, the demonstration, the prerequisites, and the acceptance criteria. It corrects the earlier ordering that placed `SYNC-ARCHITECTURE.md` before this document.

### September 19, 2026 — SYNC-ARCHITECTURE.md v1.0 frozen

`SYNC-ARCHITECTURE.md` was written and frozen at v1.0. Thirty sections in seven parts. It defines the exact wire format (TLV, big-endian, canonical serialization), the protocol order (`logical_clock`, `device_id`, `sequence`), the reconciliation rule, the duplicate detection rule (`event_id` only), and the sync state machine.

`§22.1` through `§22.6.7` were written. The message-specific subsections — `§22.7` through `§22.19` — were left incomplete. This became the critical open problem.

`THREAT-MODEL.md` v1.0 was written and frozen, audited against `SYNC-ARCHITECTURE.md` v1.1 Sections 28 and 29. Nine residual risks (R1–R9) recorded as ACCEPTED by the founder with reasoning.

### September 20, 2026 — Section 25.13, LOCAL-TABLES.md v1.2, test vectors, Section 22 restoration

`SYNC-ARCHITECTURE.md §25.13` was written: the field-semantics specification. Contains `§25.13.1` through `§25.13.12`. The header was updated to v1.1.

`LOCAL-TABLES.md` v1.2 was written. Category D rewritten with D.1 through D.8. Shape B adopted. Four new sync tables added. Summary table shows 20 local tables.

`SYNC-TEST-VECTORS-v1.md` v1.0 (partially complete) was written. Nine deterministic vectors recorded. Five SPECIFIED / TO BE COMPUTED (M1, M2, V1, V4, V6). Four BLOCKED (E1 on Argon2id parameters; H1, H2, H3 on the missing `§22.19`).

Section 22 restoration. The missing subsections `§22.7` through `§22.19` were recovered and inserted. Six corrections from the founder's technical reviewer were applied. Block C was applied (`§18.2` and `§11.4` amendments). The header was bumped to v1.2.

`SYNC-TEST-VECTORS-v1.md` status updated: H1, H2, H3 moved from BLOCKED to SPECIFIED.

### September 21, 2026 — Cloud environment built

The AWS cloud Windows environment was constructed. The blocker from September 15 — Smart App Control refusing to run the signed Tauri binary on the main machine — was bypassed by running on a machine where SAC is not enforced.

- **AWS EC2 instance** `Gorka-dev` (`i-0ac85da213bdaa09a`), `t3.small`, Windows Server 2025 Datacenter, Singapore. Disk 70 GiB after two resizes. RDP working. Security group allows RDP from "My IP" only.
- **Toolchain installed:** Git 2.55.0, Node.js 24.21.0, Rust 1.98.1, Visual Studio C++ Build Tools, Strawberry Perl 5.42.3.1.
- **`cargo build` on the Tauri backend succeeded** (18m 21s). `gorka-client.exe` produced.
- **`npm run build` succeeded.** `dist/` produced.
- **Backend runs**, connected to Supabase `gorka_test` through the session pooler.
- **Tauri app launches, login succeeds, local database unlocks, Client Dashboard reached.**

Eight file mismatches were found during this work. All resolved. Root cause: the main machine had months of uncommitted work in the working tree, and git was not the synchronization authority. The fix: commit the working tree as `08eac3b`, push it, pull it on the cloud machine. Both machines are now on the same commit.

### September 22, 2026 — Item 4 partial test

Services restarted on the cloud machine. Initial local database unlock failed with `file is not a database` because the wrong password was entered. The correct password is `Password123` — the local encryption password is distinct from the login password. Once the correct password was entered, the database unlocked.

Debtor CRUD was confirmed working on the cloud machine. Create, edit, delete all functioned.

Debt CRUD partially failed at the due-date field. Not yet diagnosed.

Action CRUD (Phase 9 Item 4) was not fully tested. Debtor CRUD was exercised; Action CRUD was not completed because the debt due-date issue appeared first.

### Operational knowledge recorded

- **Supabase session pooler is required from AWS Singapore.** The direct database hostname does not resolve. The pooler hostname `aws-1-eu-west-3.pooler.supabase.com` does. Username format: `postgres.tmloklxelckicufzpzxz`.
- **SQLCipher's `file is not a database` error means wrong key, not corrupt file.** Try the correct password before considering deletion.
- **Supabase free tier pauses projects after 7 days of inactivity.** Gorka SaaS was paused on September 20, resumed on September 22.

### Process rule established

**Git is the synchronization authority between development machines.** Not file-copying, not "I think it is committed." The workflow is: main machine commits and pushes; cloud machine pulls and verifies HEAD. Both machines must show the same commit before work begins.

### Unresolved questions

1. **Agent App architecture.** `MULTI-USER-CONCEPT.md §9` and `GORKA-MVP-SCOPE.md §5.3` describe the Agent App as a second Tauri binary in the same repository. The founder recalls a prior-chat discussion about building it from scratch. **Not recorded in any recovery document.** Must be decided and recorded before Phase 9.5 begins.

2. **An embedding that should not have happened.** The founder mentions a prior attempt to embed something into the Client Dashboard. **Not documented.** Needs investigation and recording.

### Security items to address

Three credentials have been written into chat logs and should be rotated: the Supabase password, the GitHub token, and the Resend API key. After rotating, update the `.env` files and redact the values from any recovery document that references them.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held.
- No application code written. All work was infrastructure, testing, and documentation.

### What is still open

- Debt due-date bug.
- Phase 9 Item 4 completion (Action CRUD).
- Persistence-across-restart test for the cloud-machine database.
- Registration flow audit. Known UX bug in `UnlockScreen`.
- Argon2id parameters benchmarking.
- Test-vector computation (M1, M2, V1, V4, V6).
- Control Plane tables not applied to `gorka_test`.
- Agent App (Phase 9.5). Requires architecture decision.
- Sync engine (Phase 9.6). Requires the three prerequisites.
- Multi-user demonstration (Phase 9.7).

### What comes next

Two parallel workstreams are available: Phase 9 polish (fix the debt bug, complete Item 4, audit registration), and sync engine prerequisites (benchmark Argon2id, apply the Control Plane tables, compute the vectors). The Agent App waits until the architecture question is decided.

---

**End of entry.**


---

## Session Extension — September 23, 2026

### What this session did

Working session on the Client Dashboard, on the local authentication and unlock flow. Three separate defects were found, fixed, committed, and verified. All work was local; no cloud schema, no backend, no production.

The goal was to stabilize the loop a client performs after they have the installer and the app on their own machine: login → set local password (first run) → enter local password (subsequent runs) → dashboard → logout → login again → enter password → dashboard. Repeatable, without glitches.

### The three fixes

**Set/Enter bug — commit `01631c6`.**

The `UnlockScreen` showed "Set Local Encryption Password" on returning runs. The cause was that it read `localStorage.getItem('salt')`, but the salt lives in `settings.dat`, written by the Rust side. The two stores are unrelated, so the read always returned null. Fixed by adding a Rust command `database_exists` that checks for `gorka-client.db` on disk. DB absent → "Set"; DB present → "Enter." The `localStorage` read and write were removed.

**Logout state reset — commits `38aec9c` (superseded) and `183e8f7`.**

The Logout button did nothing because its handler cleared `localStorage` and a cookie, neither of which the Tauri app uses. The first fix called `auth.logout()` and `window.location.reload()`, but the reload does not tear down the JavaScript context in this webview. The second fix moved ownership of logout to `App.tsx`: `handleLogout` calls `auth.logout()`, then sets `isAuthenticated(false)` and `isUnlocked(false)`. The callback is passed through `AppShell` to `Sidebar` via an `onLogout` prop.

**Rust logout connection leak — commit `40b2378`.**

After the frontend fix, the bug still reproduced. The real cause: `logout` cleared `settings.dat` but did not close the SQLCipher connection held in `AppState.db`. The command `is_database_unlocked` reads `AppState.db`, not `settings.dat`. So the connection was still open after logout, `is_database_unlocked` returned `true`, and the next login skipped the Enter screen. Fixed by making `logout` receive `state: tauri::State<AppState>`, lock `state.db`, set it to `None`, then call `auth::logout(app)`.

### What was verified

On the cloud machine, after the Rust rebuild:

- Fresh launch → Login → Enter Password → Dashboard.
- Dashboard → Logout → Login screen.
- `settings.dat` after logout: `salt` only.
- Login → **"Enter Local Encryption Password"** (not Dashboard).
- Enter password → Dashboard.
- Logout → Login → Login → **"Enter Local Encryption Password"** again.
- Two consecutive loops, both correct.

The bug that appeared at the start of the session — login going straight to the Dashboard — no longer occurs.

### Two theories that were discarded

This session is a record of how the true root cause was found, so the discarded theories are recorded too:

1. **The Set/Enter bug was thought to be a salt-ordering issue.** The earlier `DECISIONS.md` entry said "the salt is written during `login()` rather than during `set-password`." That is true, but it was not the cause. The cause was the `localStorage` / `settings.dat` mismatch. The earlier diagnosis is now superseded.

2. **The logout bug was thought to be a frontend state issue.** The first two fixes assumed the React state (`isUnlocked`) was stale. It was, but that was a symptom, not the cause. The actual cause was the open SQLCipher connection in `AppState.db`. Fixing the frontend state alone did not fix the bug; the Rust fix did.

Both corrections are recorded in `DECISIONS.md`.

### Key learning

"Unlocked" in this app means the SQLCipher connection is open in the running Rust process, held in `AppState.db`. It is not a flag in `settings.dat`. `is_database_unlocked` reads the connection. That is why quitting the app "fixed" the symptom: process termination destroys `AppState.db`. The design is intentional and secure — the connection being open is the true test of whether the app can read the encrypted data. The bug was that `logout` left the connection open.

### Deferred findings, recorded not acted on

1. **Dashboard 401 errors from `api.gorka.localhost:3000`.** Separate finding, not yet investigated.
2. **Eye-icon inconsistency on the password field.** WebView2 built-in password reveal control disappears after an error re-render. Deferred.
3. **Debt due-date bug.** Adding a debt fails at the due-date field. Not investigated today.
4. **Dead code in `Sidebar.tsx` lines 33–37.** Commented-out old handler. Inert. Removal deferred.

### Repository state

- Main machine: at `40b2378`, clean, pushed.
- Cloud machine: at `40b2378`, clean.
- GitHub: `origin/main` at `40b2378`.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. No debtor data crossed the boundary. All work was local.
- No new abstraction introduced. The frontend fix threads a callback through the existing component hierarchy. The Rust fix is one function.
- No routing redesign. No React Context.

### What is still open

- Debt due-date bug.
- Phase 9 Item 4 (Action CRUD) — code complete, not fully tested.
- Persistence-across-restart test on the cloud machine.
- Dashboard 401 errors from `api.gorka.localhost:3000`.
- Eye-icon inconsistency on the password field.
- Argon2id parameters (`§7.3`, `§22.19.2`).
- Test-vector computation (M1, M2, V1, V4, V6).
- Control Plane tables not applied to `gorka_test`.
- Control Plane services not implemented.
- Agent App (Phase 9.5) not started.
- Sync engine (Phase 9.6) not started.
- Multi-user demonstration (Phase 9.7) not started.

### What comes next

Two parallel workstreams:

1. **Phase 9 polish.** Fix the debt due-date bug. Complete Item 4. Test persistence across restart.
2. **Sync engine prerequisites.** Benchmark the Argon2id parameters. Apply the Control Plane tables to `gorka_test`. Compute the test vectors.

The local registration flow — Stage 4 (login → set/enter local password) and Stage 5 (logout → login → enter → dashboard, repeatable) — is now stable and verified.

---

**End of entry.**

Session Extension - September 24, 2026

WHAT THIS SESSION DID

Two workstreams. First, completion of the Dashboard local-stats task. Second, the writing of the Excel/TXT upload specification, with implementation deferred by conscious decision.

DASHBOARD LOCAL-STATS TASK

The problem. The Client Dashboard's home page called /api/dashboard/stats and received 401 Unauthorized on every load. The page was empty. Two of its four values had no clean local source: totalAgents (no local agents table) and recentActivities (no user attribution locally).

Reconnaissance. Three questions read on disk before any edit:

Organization isolation: existing read commands join through debtors on organization_id for debts, actions, communications; and query debtors directly for debtors itself.

Monetary representation: amount is f64 end to end - column, struct, bindings, read.

localDB convention: single object, invoke<T> wrappers, snake_case fields, no logging.

The spec. Written, reviewed, revised. The revision corrected four things: the "no 401" criterion was narrowed; the Reading 2.5/Reading 3 equivalence claim was removed; the f64 verification was added; the organization-isolation verification was added.

Decisions applied:

D1: totalDebt = Reading 2.5. SUM(amount) excluding PAID and CANCELLED.

D2: Total Agents card removed, deferred.

D3: Recent Activity block removed, deferred.

D4: One command returns one struct.

D5: totalActions counts all actions.

D6: PAID and CANCELLED excluded.

D7: Organization isolation matches existing read pattern.

The edit. Three files:

src-tauri/src/main.rs: DashboardStats struct; get_dashboard_stats command; registration.

supervisor-dashboard/src/services/local.db.ts: DashboardStats interface; getDashboardStats method.

supervisor-dashboard/src/pages/Dashboard.tsx: local call; three snake_case fields; Agents card removed; Activity block removed.

Two mistakes caught before commit:

A stray blank line in main.rs between DebtInput and Communication. Caught by reading the git diff.

An orphaned fetchDashboardStats body in Dashboard.tsx. Caught by findstr for api.get and recentActivities, which returned matches where none should exist.

The process lesson, recorded: read the exact region on disk immediately before proposing a replacement. Do not write against memory.

Verification on the cloud machine:

Dashboard loads. Three cards render.

Total Debtors = 11. Total Debt = $11,800. Total Actions = 0.

Create, edit, delete debtor and debt. Numbers update correctly.

A debt changed to PAID fell by its amount. Status filter works.

/api/dashboard/stats 401 gone. Other 401s remain, out of scope.

Commit. 66c6f12. Amended once because the first commit captured only the summary line. Pushed to origin/main.

UPLOAD PATH RECONNAISSANCE

CSV upload verified end-to-end on the cloud machine. 10 debtors in Collections.

Debt due-date bug did not reproduce on the current build. Not closed.

Shipped dist bundle is clean of the pre-rewrite cloud-post upload code.

Stale supervisor-dashboard\dist contains the old cloud-post code. Not the folder Tauri serves from. Recorded, not acted on.

EXCEL AND TXT SPECIFICATION

Written, not implemented. Full text in UPLOAD-EXCEL-TXT-SPEC.md.

Key decisions from the spec:

Bulk upload, not one-by-one. Same local insert path as CSV.

One shared mapper. parseCsv split into parseCsvToCells and rowsToDebtors. TXT and Excel use the same mapper.

TXT is extension-only. Four or five lines of change.

Excel cell normalization: preserve strings, convert numbers non-exponentially, use workbook date formatting. Do not reconstruct information not present in the workbook.

Boundary check: static (findstr) and runtime (network inspection during upload).

Resource limits: 10 MB file size, 10,000 rows.

Open decision - Excel parser location:

Option 1: Frontend (SheetJS). Faster to build.

Option 2: Backend (calamine, Rust). Stronger for production.

Lean: backend, for transactionality, the event model, and the test surface.

Implementation deferred. MVP keeps CSV-only at this stage. Conscious decision, not a backlog item.

Determining question: is the MVP a stepping stone or the production version with features turned off?

WHY EXCEL AND TXT WERE DEFERRED

The session's remaining time is allocated to the Argon2id parameters, which are on the critical path for the sync engine. Documented in full so a future session can pick it up without re-deriving the reasoning.

NEXT WORKSTREAM

Argon2id parameters. Benchmark and freeze the values for the enrollment package (SYNC-ARCHITECTURE.md section 7.3 and section 22.19.2). Those values block E1, which blocks the test vectors, which blocks the sync engine.

DOCUMENTATION WRITTEN THIS SESSION

DECISIONS.md - the September 24 entry

UPLOAD-EXCEL-TXT-SPEC.md - new file, the upload spec

HANDOFF.md - status update

SESSION-LOG.md - this entry

START-HERE.md - September 24 update subsection

DOCUMENTATION COMMIT

All five documents are committed together, after all are written. The commit is the record of the session.

REPOSITORY STATE

Main machine: at 66c6f12, clean, pushed.

Cloud machine: needs git pull to reach 66c6f12.

GitHub origin/main: at 66c6f12.

RULE COMPLIANCE

No production touched.

No cloud schema change. No new tables. No new columns.

No CI/CD touched.

Invariant held. All debtor data stayed on the local machine.

End of entry.

Session Extension — September 24, 2026 (Argon2id freeze)

### What this session did

Froze the Argon2id parameters for the MVP enrollment package. The benchmark was written, run twice on the cloud machine, and the values were chosen and recorded in SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2. This is the second half of the September 24 session; the first half completed the Dashboard local-stats task and wrote the Excel/TXT upload specification.

### The reconnaissance finding

The enrollment package code does not exist. src-tauri/src/ contains exactly three Rust files — main.rs, db.rs, auth.rs. A whole-tree search for enrollment, GORKAEP, package_encryption_key, and XChaCha returned zero matches.

This changed the shape of the work. The benchmark could not measure an existing call site; it had to be a standalone harness. The sequence became: benchmark, freeze the values, implement the package, compute E1.

### What was decided before the benchmark

- Sequence: benchmark first, then freeze, then implement, then E1.
- Crates for the eventual package: chacha20poly1305 and hkdf, both RustCrypto.
- Harness location: src-tauri/src/bin/argon2bench.rs.
- Harness crate: argon2 0.5.3.
- Harness call shape: Argon2::new with explicit Params, raw 16-byte salt to hash_password_into, Algorithm::Argon2id, Version::V0x13, 32-byte output.
- Instance B (db.rs) out of scope.
- Cloud machine as floor.
- Memory ceiling roughly 1/4 of 2 GiB.
- Target 250-1000 ms, aim low end.

### The harness

One file, 137 lines. Commit bd50fbc. Nine (m_cost, t_cost, p_cost) triples, one process, one warm-up per triple, ten timed runs, min/median/max. Output buffer consumed after timing. Measures only the Argon2id derivation.

Phase A boundary held. Only src-tauri/src/bin/ was touched.

### The benchmark results

Two runs on the cloud machine. Checksums matched row for row.

| m_cost (MiB) | t_cost | p_cost | Run 1 median | Run 2 median |
|---|---|---|---|---|
| 32 | 2 | 1 | 62.17 ms | 65.08 ms |
| 32 | 3 | 1 | 85.00 ms | 110.79 ms |
| 64 | 2 | 1 | 130.17 ms | 128.60 ms |
| 64 | 3 | 1 | 178.31 ms | 171.91 ms |
| 64 | 4 | 1 | 220.62 ms | 224.75 ms |
| 128 | 3 | 1 | 361.64 ms | 363.31 ms |
| 128 | 4 | 1 | 447.72 ms | 461.49 ms |
| 256 | 3 | 1 | 735.49 ms | 783.80 ms |
| 256 | 4 | 1 | 925.78 ms | 946.33 ms |

Four rows fall in the target window: 128/3, 128/4, 256/3, 256/4.

### The decision

Chosen: 131072 KiB, 4 iterations, 1 lane (128 MiB / 4 / 1). Run 2 median: 461 ms.

Reasoning: 461 ms is mid-target. 128 MiB is memory-safe on a weaker client machine where 256 MiB would be tight. Four iterations at the same memory is more work than three. 256 MiB rejected on the weaker-machine risk.

### The freeze

The three integers written into SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2. The trailing placeholder sentences replaced with a short note pointing at DECISIONS.md.

### Terminal-display artifacts

Three confirmed instances of a terminal rendering a correct UTF-8 file as mojibake. The section sign, the em-dash, and the arrow. None is a file problem. Notepad confirmed the files are correct.

### Files changed this session

src-tauri/src/bin/argon2bench.rs — new, 137 lines, commit bd50fbc.

### Files changed by the freeze commit

SYNC-ARCHITECTURE.md section 22.7.1 and section 22.19.2. DECISIONS.md. HANDOFF.md. SESSION-LOG.md. START-HERE.md.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. All debtor data stayed on the local machine.
- Instance B (db.rs) was not touched.
- No enrollment package code exists yet.

### What comes next

Phase D: implement the enrollment package against the frozen parameters. Separate task, own spec.

Then Phase E: E1.

End of entry.

Session Extension — September 24, 2026 (Phase D.1 and D.2)

### What this session did

Started Phase D: the enrollment package and its prerequisites.
D.1 added the organization_keys table. D.2 added the enable_sync
command. Both verified on the cloud machine.

The Argon2id parameters were frozen earlier in this session at
commit d77e2da. That freeze was the prerequisite for Phase D.

### The reconnaissance finding

The enrollment package code did not exist. src-tauri/src/
contains exactly three Rust files: main.rs, db.rs, auth.rs. The
organization_keys table did not exist. No key-generation command
existed. A whole-tree search for enrollment, GORKAEP,
package_encryption_key, and XChaCha returned zero matches.

### The Phase D spec

A Phase D specification was written and revised to v1.1. Key
decisions: combine prerequisites with the package, defer the
Control Plane report, no Sync Settings UI. Eight open questions
closed. Two structural requirements added: the organization key
is organization-wide, and import is atomic.

### D.1 — the organization_keys migration (v4)

Commit adcab50. src-tauri/src/db.rs, 20 insertions.

A migration v4 creates the single-row organization_keys table
per LOCAL-TABLES.md Category D.5. The block follows the existing
migration structure. No command, no key generation, no package
code.

Verified: build succeeded (1m 28s incremental). App launched,
database unlocked, migration ran, existing data unaffected.

### D.2 — the enable_sync command

Commit 941917a. src-tauri/src/main.rs, 36 insertions.

The rand::RngCore import, the enable_sync command between
is_database_unlocked and get_debtors, the registration in
generate_handler!.

The command reads the trusted organization id, requires the
database unlocked, refuses if a key exists, generates 32 random
bytes with OsRng, and inserts the row. No Control Plane report.

Verified via devtools: is_database_unlocked true. First
enable_sync returned OK null. Second returned "ERR Sync is
already enabled for this organization". The refusal path works.
The successful insert confirms the D.1 migration created the
table correctly.

### The cargo.exe block on the main machine

New finding. cargo build on the main machine fails:
'cargo.exe' was blocked by Device Guard policy.

Different from the September 15 SAC block, which was on the
built binary. This is on cargo.exe itself.

The cloud machine is the sole build environment. Recorded in
TAURI-DEV-WORKFLOW.md section 8.

### Files changed this session

src-tauri/src/db.rs — the v4 migration, commit adcab50.

src-tauri/src/main.rs — the enable_sync command, commit
941917a.

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.

### What comes next

D.3 — the export_enrollment_package command.

D.4 — the import_enrollment_package command.

Then Phase E — E1.

End of entry.

Session Extension — September 24-25, 2026 (Phase D.3 and D.4.1)

### What this session did

Completed D.3, the export_enrollment_package command. Wrote
D.4.1, the import_enrollment_package function. D.4.1 compiles.
D.4.2 through D.4.4 remain.

### D.3 - the export command

Commits d3e5fee (crate), edbaa3a (imports), 5be2599 (command
and registration), d426bba (Cargo.lock).

Added chacha20poly1305 = "0.10" to Cargo.toml. Added the
imports. Added the export command, placed after delete_document
and before fn main().

The command reads the organization key from organization_keys,
validates it, generates a salt and nonce, derives the package
key with Argon2id at 131072 / 4 / 1 with the raw 16-byte salt,
builds the 63-byte header, encrypts with XChaCha20-Poly1305
using the full header as AAD, and writes the package file.

The cloud build took 3m 17s and updated Cargo.lock. Tested via
devtools: the export produced a 140-byte file. 63 header + 4
org_id_len + 25 org_id + 32 org_key + 16 tag = 140.

### D.4.1 - the import function

Commits dc7bd54 (the function), 70b8cd8 (the borrow fix).

The function reads the package, verifies magic/version/length,
derives the key with the parameters from the header, decrypts
with the header as AAD, parses the inner content, rejects
trailing bytes, compares the organization id before the
transaction, refuses if a key already exists, inserts the key
atomically, and deletes the package after commit.

Not yet registered. That is D.4.2.

The first compile failed with E0596, the borrow error for
conn.transaction(). Fixed in 70b8cd8 by changing as_ref() to
as_mut() and db_guard to mut. The cloud build then succeeded
in 54.83s.

### Files changed this session

src-tauri/Cargo.toml — the crate. Commit d3e5fee.

src-tauri/src/main.rs — the imports, the export command, the
export registration, the import function, the borrow fix.
Commits edbaa3a, 5be2599, dc7bd54, 70b8cd8.

src-tauri/Cargo.lock — the resolved crate versions. Commit
d426bba.

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.

### What comes next

D.4.2 — register import_enrollment_package in
generate_handler!.

D.4.3 — build.

D.4.4 — test the import.

Then Phase E — E1.

End of entry.

## Session Extension — September 25, 2026 (Phase D.4.2–D.4.4)

### What this session did

Completed Phase D. Registered the import_enrollment_package
command in generate_handler! (D.4.2), built with the
registration (D.4.3), and tested the import via the devtools
console (D.4.4). All three steps completed and verified. Phase D
is now complete.

### D.4.2 — registration

Commit b5af889. One file changed: src-tauri/src/main.rs, one
insertion.

A single line was added to the generate_handler! block, after
the existing export_enrollment_package registration:

  import_enrollment_package,

Twelve spaces of indent. Trailing comma. No comma adjustment
elsewhere, because every entry in the block already ends in a
comma.

The function and its #[command] attribute were already in place
from D.4.1. The registration is the only change.

Verified on disk before committing. findstr and a PowerShell
read of the handler block confirmed the line. The staged diff
showed exactly one insertion:

  +            import_enrollment_package,

One file. One line. Nothing else touched.

### D.4.3 — build

The commit was pushed to origin/main, pulled on the cloud
machine, and built there. The main machine cannot compile
(TAURI-DEV-WORKFLOW.md section 8).

  cargo build

Result: Finished dev profile [unoptimized + debuginfo] target(s)
in 1m 17s. No errors, no warnings.

The time is consistent with the change: only main.rs changed,
and no dependency was added, so no crate resolution was needed.

### D.4.4 — import test

Test conditions on the cloud machine: backend running against
gorka_test through the session pooler with the inline
DATABASE_URL override; Vite dev server running;
gorka-client.exe running, logged in as test@example.com, local
database unlocked, Dashboard reached; devtools console open.

The Tauri global was not window.__TAURI__.core in this build.
The working form:

  const invoke = window.__TAURI_INTERNALS__.invoke;

Preconditions checked before the import:

  await invoke('is_database_unlocked');
  -> true

  await invoke('get_organization_id');
  -> 'cmty0xrxw0000c4q4mvtpqjqv'

The org id is 25 characters, matching the 25-byte org id in the
D.3 package arithmetic (63 + 4 + 25 + 32 + 16 = 140). The
package's inner organization_id therefore matches the trusted
id, and the pre-transaction comparison will pass.

  await invoke('enable_sync');
  -> "Sync is already enabled for this organization"

A key exists. The handoff's predicted D.4.4 path — the import
will refuse on the "key already exists" check — is the path
being tested.

The import call:

  await invoke('import_enrollment_package', {
    passphrase: 'test-passphrase-001',
    filePath: 'C:\\gorka-app\\test-package.gorka'
  }).then(r => ({ ok: true, value: r }))
    .catch(e => ({ ok: false, error: e }));

Result:

  { ok: false, error: 'Sync is already enabled for this
    organization' }

### What the result proves

The refusal is the expected outcome, and it proves every stage
before the refusal ran to completion:

- The package file was read.
- The 63-byte header was verified: magic "GORKAEP\0", format
  version 0x0001, header length.
- The Argon2id key derivation ran with the header's parameters
  (131072 / 4 / 1) and the header's 16-byte salt.
- XChaCha20-Poly1305 decryption succeeded with the header as AAD.
- The inner content was parsed: org_id_len, org_id, org_key, and
  the trailing-byte rejection passed.
- The organization id comparison passed.
- The function entered the transaction, checked
  organization_keys, found a key, and refused.

The import refused at the correct point, for the correct reason.
D.4.1's spec says: "refuses if a key already exists. No silent
replacement."

The success path (no key present, install and delete) was not
tested, because a key exists and removing it is out of scope.

The package file was not deleted, because the refusal path does
not commit. C:\gorka-app\test-package.gorka remains, 140 bytes.

### Phase D is complete

All of Phase D:

- D.1 organization_keys migration (adcab50)
- D.2 enable_sync command (941917a)
- D.3 export_enrollment_package (d3e5fee, edbaa3a, 5be2599,
  d426bba)
- D.4.1 import_enrollment_package function (dc7bd54, 70b8cd8)
- D.4.2 registration (b5af889)
- D.4.3 build (1m 17s)
- D.4.4 import test (refusal path)

### Repository state

Main machine: at b5af889, clean, pushed.

Cloud machine: at b5af889, clean, built.

GitHub origin/main: at b5af889.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.
- The passphrase is never logged, never stored, never included
  in an error, never printed.

### What comes next

Phase E — E1, the first deterministic test vector. It computes
the enrollment package from fixed inputs and verifies the bytes
against the expected output in SYNC-TEST-VECTORS-v1.md. The
package now exists, so E1 is unblocked.

End of entry.

## Session Extension — September 25, 2026 (Phase E, E1–E6)

### What this session did

Completed the enrollment-package test vectors, E1 through E6.
Extracted two shared operations, added the E1 deterministic
known-answer test, added the E2-E6 import behavioral tests. All
six pass on the cloud machine.

Phase E is not complete. It is the test-vector phase. E1-E6 are
the enrollment-package family. H1, H2, H3, M1, M2, V1, V4, V6
remain.

### E1 — extraction and known-answer test

Commits 4db59fc, 4a8cd0f, 76f4544.

Package construction was extracted from
export_enrollment_package into build_enrollment_package. The
production command keeps its behavior: OsRng generates salt and
nonce, then calls the shared function. The shared function takes
salt and nonce as explicit inputs.

The E1 test calls the shared function with the fixed fixtures
from SYNC-TEST-VECTORS-v1.md §2: organization_key_zero,
organization_id_A ("org-test-A"), "test-passphrase-001",
argon2id_salt_zero, nonce_structured, and the frozen parameters
131072 / 4 / 1.

The test verifies the package structure: magic, version, three
Argon2id parameters, salt, nonce, encrypted_payload_len, total
length. Then it decodes the recorded 125-byte reference value
from hex and asserts byte equality. Deterministic. No Tauri
runtime required.

### The 125-byte size

The E1 package is 125 bytes: 63-byte header, 46-byte inner
content (4 + 10 + 32), 62-byte encrypted payload, 125 total.
The D.3 test produced 140 bytes because it used the real 25-byte
organization id. E1 uses organization_id_A, 10 bytes. The
difference is the org id length.

### Two transcription errors

The first Phase 2 assertion used a hand-written byte array. It
was 124 bytes; the compiler rejected it. The vectors file then
got a wrong hex: 252 characters (126 bytes) instead of 250
characters (125 bytes).

The fix: stop transcribing by hand. The test now holds the hex
as a string and decodes it with hex::decode. The vectors file's
hex was compared against main.rs with fc.exe, the byte-level
file compare. The two were identical. The lesson, recorded in
DECISIONS.md: a byte count measured through a terminal can be
wrong; a value that matters is verified with a tool that
compares bytes.

### E2–E6 — extraction and behavioral tests

Commits ee496e9, 77b8aa1.

Parsing was extracted from import_enrollment_package into
parse_enrollment_package. It takes file bytes, passphrase, and
trusted org id; it returns the 32-byte key or an error string.
No I/O, no database. The production import command reads the
file, calls the parser, and installs the key.

Five tests:

  E2  correct passphrase              returns the key
  E3  wrong passphrase                "Wrong passphrase or corrupted package"
  E4  tampered payload (byte flip)    "Wrong passphrase or corrupted package"
  E5  organization mismatch           "Organization mismatch"
  E6  wrong magic                     "Invalid package: bad magic bytes"

E3 and E4 assert the same message. The AEAD cannot distinguish
the two causes. One honest message is correct.

A helper, e1_package(), decodes the recorded hex once and all
six tests share it. The E1 test uses the helper too.

### Two fixes during the work

The import-command refactor left a stale variable in the INSERT
statement: package_org_id, which had moved into the parser, and
organization_key, which needed to be passed as a slice. Both
were fixed in the same commit: organization_id and
&organization_key.

The first cloud build of E2-E6 failed with five instances of
E0425. The tests are in a child module; a child module does not
see the parent's items without an explicit import. The line
use super::build_enrollment_package; became
use super::{build_enrollment_package, parse_enrollment_package};
Fixed in 77b8aa1.

### Verification

The cloud machine ran cargo test -- --nocapture. All six tests
passed:

  test tests::e1_enrollment_package_creation ... ok
  test tests::e2_import_correct_passphrase ... ok
  test tests::e3_import_wrong_passphrase ... ok
  test tests::e4_import_tampered_payload ... ok
  test tests::e5_import_organization_mismatch ... ok
  test tests::e6_import_wrong_magic ... ok

  test result: ok. 6 passed; 0 failed

### The vectors file after E1

SYNC-TEST-VECTORS-v1.md, E1 entry: BLOCKED -> SPECIFIED,
PENDING -> FROZEN. The recorded hex is the 125-byte value. A
structural breakdown was added under "Expected output". The
document header and Section 1 item 3 were updated to say E1 is
recorded. The summary table row is now SPECIFIED / FROZEN /
None.

### Repository state

Main machine: at 77b8aa1, clean, pushed.
Cloud machine: at 77b8aa1, clean.
GitHub origin/main: at 77b8aa1.

### Rule compliance

- No production behavior changed. Both commands keep their
  behavior; only internal structure was refactored.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.
- No new Tauri command. The two shared functions are plain
  functions. generate_handler! is unchanged.
- The passphrase is never logged, never stored, never printed.

### What comes next

H1, H2, H3. Their vectors entry still says BLOCKED, but that is
stale: SYNC-ARCHITECTURE.md 22.19 now has the HKDF labels. They
need their own spec, in the style of the E1 spec. They need two
crates not yet in Cargo.toml: hkdf and hmac.

Then M1, M2, V1, V4, V6.

End of entry.

## Session Extension — September 25, 2026 (Phase E, H1–H3 and M1/M2/V1/V4/V6)

### What this session did

Completed Phase E. The enrollment-package vectors, E1-E6, were
recorded earlier and documented in commit f526a24. This session
added the other two families: H1-H3, the session-key derivation
and handshake proof tags; and M1, M2, V1, V4, V6, the
SYNC_MESSAGE envelope and the event payload encoders.

All nine remaining vectors are recorded and verified. The test
suite is fourteen tests. All pass on the cloud machine.

### The H family

Commits fbdc42a (functions and Phase 1 tests), 3fe9daa
(vectors and Phase 2 assertions).

Three operations added as plain functions in main.rs, not Tauri
commands: derive_session_key, compute_handshake_reply_tag,
compute_handshake_confirm_tag. Two crates added: hkdf 0.12 and
hmac 0.12, both resolved against sha2 0.10 without conflict.

A shared helper, build_handshake_proof_input, takes the
domain-separation string as a parameter. H2 and H3 differ only
in that string.

Each of the three tests carries a byte-width assertion. H1
asserts that len("org-test-A") encodes as 00 0A. H2 asserts
that protocol_version encodes as 00 01. These catch the
single-byte-versus-two-byte mistake at the point where it would
be made.

### The H1 vectors-file discrepancy

The H1 entry in SYNC-TEST-VECTORS-v1.md listed both
organization_id_A and organization_id_B. That did not match
section 22.11.1 or 22.19.1, which define exactly one
organization_id in the session-key info, shared by both peers.
The entry had copied the input list from H2 and H3.

Corrected to use organization_id_A as the session organization
id. This is a documentation repair; the protocol was already
frozen. Section 22.11.1 was not reopened.

### The M/V family

Commits 67f8a07 (primitives and Phase 1 tests), 7f8529e
(vectors and Phase 2 assertions).

This family needed serialization code that did not exist. Eight
plain functions were added:

  encode_tlv                      the single TLV primitive
  encode_string_value             u32-prefixed UTF-8
  encode_debtor_created_payload   V1
  encode_entity_updated_payload   V4
  encode_communication_logged_payload  V6
  encode_event_record             the event record
  build_sync_message              inner + outer + encrypt
  parse_sync_message              decrypt the envelope

The design constraint: encode_tlv is the only place that writes
a TLV header. Every builder calls it. That eliminates the class
of bug where two encoders produce subtly different headers.

The V4 encoder sorts change records lexicographically by
field_name, because section 25.9.3 requires that order and the
input slice is not a wire-order guarantee. With V4's
single-change fixture the sort is a no-op, and the spec records
that plainly.

build_sync_message does the full construction: inner content,
the 6-byte outer header, XChaCha20-Poly1305 with that header as
AAD, and the assembly header || nonce || ciphertext || tag.
parse_sync_message validates and decrypts the outer envelope
and returns the decrypted inner content. It does not parse
event records.

These are reusable protocol primitives. Phase 9.6 will consume
them.

### The M1 message_id fixture

The vectors file said only "a fixed test UUID" and did not give
the bytes. The M/V spec resolved this explicitly:
message_id = event_id_test_001, exactly 16 bytes. This is a
test-fixture choice; the protocol is unchanged. The vectors file
records the actual value.

### Five new tests

  M1  SYNC_MESSAGE encryption, 239-byte framed message
  M2  SYNC_MESSAGE decryption, 193-byte inner content
  V1  DEBTOR_CREATED payload, 30 bytes
  V4  ENTITY_UPDATED payload, 38 bytes
  V6  COMMUNICATION_LOGGED payload, 88 bytes

Each is deterministic, no randomness, no I/O, no Tauri runtime.
Each carries a structural check of the TLV layout, then the
Phase 2 assertion against the recorded value.

### Verification

The cloud machine ran cargo test -- --nocapture at commit
7f8529e. All fourteen tests passed:

  test tests::e1_enrollment_package_creation ... ok
  test tests::e2_import_correct_passphrase ... ok
  test tests::e3_import_wrong_passphrase ... ok
  test tests::e4_import_tampered_payload ... ok
  test tests::e5_import_organization_mismatch ... ok
  test tests::e6_import_wrong_magic ... ok
  test tests::h1_session_key_derivation ... ok
  test tests::h2_handshake_reply_tag ... ok
  test tests::h3_handshake_confirm_tag ... ok
  test tests::m1_sync_message_encryption ... ok
  test tests::m2_sync_message_decryption ... ok
  test tests::v1_debtor_created_payload ... ok
  test tests::v4_entity_updated_payload ... ok
  test tests::v6_communication_logged_payload ... ok

  test result: ok. 14 passed; 0 failed

The three H Phase 2 assertions were deferred when the cloud
machine was off. They ran for the first time in this cloud
session, when the M/V work pulled both commits together. All
three passed. The deferred verification is closed.

### The vectors file after this session

All nine vectors are SPECIFIED / FROZEN. The document header
reads: "All nine vectors recorded. Second-implementation
verification not performed." That is accurate: every vector is
recorded, and the independent second-implementation check that
section 1 describes has not been done.

### Repository state

Main machine: at 7f8529e, clean, pushed.
Cloud machine: at 7f8529e, clean.
GitHub origin/main: at 7f8529e.

The documentation commit for this entry follows.

### Rule compliance

- No production behavior changed.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. Every operation is local.
- db.rs::derive_key was not touched.
- Two crates added: hkdf and hmac.
- No new Tauri command. generate_handler! is unchanged.
- The fixture values are test-only.

### What comes next

Phase E is complete. The next work is Phase 9.6, the sync
engine, which consumes the primitives built here. Before that,
the Control Plane tables (device_registrations, relay_sessions)
must be applied to gorka_test.

End of entry.


## Session Extension — September 26, 2026 (Control Plane tables and device identity)

### What this session did

Created two Control Plane tables in gorka_test. Verified them.
Resolved the device-identity question that had been ambiguous in
the frozen documents. Closed a Cargo.lock divergence. Recorded the
result.

### The sequence

1. Cross-document pass on device identity. Read SYNC-
   ARCHITECTURE.md Sections 3, 4, 5.5, 7.5, and 11.3 together
   with the other documents that mention device identity.
   Concluded, initially, that §11.3 was inconsistent.

2. Founder confirmed the MVP model: user-based, one row per user,
   wire device_id is the user identity. Called Reading B.

3. Wrote the physical specification. It went through several
   review rounds. Final shape: Reading B, Option 1
   (forward-compatible columns physically present),
   reserved-field rule, is_authorized active.

4. Wrote the two Prisma models into schema.cloud.prisma. Added
   the reverse relations to Organization and User.

5. Committed as 1d89af8, pushed, pulled on cloud.

6. prisma db push failed with P1001: cannot reach database
   server. Cause: the direct Supabase hostname does not resolve
   from AWS Singapore. Fixed by switching to the session pooler
   hostname.

7. prisma db push failed with P1012: missing opposite relation
   field on DeviceRegistration. Cause: the specification
   described the foreign keys only from the relay_sessions side.
   Amended the specification to add two reverse-relation lines to
   DeviceRegistration.

8. Committed the fix as 9b5a118, pushed, pulled on cloud.

9. prisma db push succeeded. 9.04 seconds.

10. Verified with a node script using the generated Prisma client.
    21 tables. Columns of the two new tables match the spec. No
    debtor column except the two known permitted ones.

11. Started the backend. Connected successfully.

12. Deleted the temporary verification file.

13. git status on the cloud machine showed src-tauri/Cargo.lock
    modified. Not from this session. Investigated: fbdc42a added
    hkdf and hmac to Cargo.toml but did not commit the Cargo.lock
    update. The update sat uncommitted since September 25.

14. Committed the lock file as 15a993f, pushed, pulled on main.

15. Re-examined the §11.3 finding. External review had identified
    a protocol problem with the initially proposed correction. On
    re-examination, the initial conclusion was incomplete: §11.3's
    "combines" sentence was genuinely ambiguous. The founder
    adopted a two-layer model to resolve it.

16. Applied the amendments to SYNC-ARCHITECTURE.md §§3, 4, 11.3,
    22.4, and added the new §25.6.6. Bumped the version to v1.3.

17. Added the physical-specification note and the MVP note to
    CLOUD-TABLES.md §20.1.

18. Confirmed LOCAL-TABLES.md Category D needs no change.

### The tables

device_registrations: 13 columns, six active, seven reserved.
relay_sessions: 10 columns, no reserved.

The MVP is user-based. The reserved columns are for the
funded-phase combined model. The reserved-field rule governs them.

### The device-identity decision

Two identity layers.

Layer 1 — Access (Control Plane). User-based. device_registrations
records which users are authorized. Not a machine registry.

Layer 2 — Sync origin (wire protocol). Each local GORKA database
has its own local replica identifier. The wire device_id is exactly
this 16-byte identifier. It does not encode the user identity.

(device_id, sequence) is globally unique within the organization.
Two machines under one user have independent sequence namespaces.

device_id identifies the synchronization origin, not the human
actor.

### The commits

  1d89af8  Add the two models to schema.cloud.prisma.
  9b5a118  Add reverse relations to DeviceRegistration.
  15a993f  Sync Cargo.lock.

### Two process findings

First: the physical spec for the two tables initially missed
Prisma's requirement that a relation be declared on both models.
The spec described foreign keys from one side only. The gap
surfaced on the first push. Fixed by amending the spec before
editing the file.

Second: "all machines at the same commit" is not the same claim as
"all working trees clean". The prior handoff treated them as one.
A full git status on the cloud machine would have found the
Cargo.lock divergence earlier. Future handoffs should verify the
working tree on each machine, not infer it from matching HEADs.

### Repository state

Main machine: at 15a993f, clean, pushed.
Cloud machine: at 15a993f, clean except the two known untracked
  files.
GitHub origin/main: at 15a993f.

### What is still open

Second-implementation verification of the nine vectors.
Control Plane services not implemented.
Phase 9.5, 9.6, 9.7 not started.
Excel/TXT upload, debt due-date bug, stale dist, UI honesty issues,
  Dashboard 401s: unchanged.
One item for Phase 9.6: choose the local storage representation of
  sync_state.device_id. §25.6.6 defers this.

### Rule compliance

No production touched. No cloud schema change to production. No
CI/CD touched. Invariant held. No application code changed. The two
push errors were resolved at the correct level: the first was
environment, the second was specification. The §11.3 decision was
made by the founder, not inferred.

## Session — September 26, 2026 (Second-implementation verification)

Completed the second-implementation verification of the nine
deterministic test vectors, required by SYNC-TEST-VECTORS-v1.md
Section 1 and described in the task brief of the same date.

### What was done

Wrote a second, independent implementation of the nine vectors
in Node.js, at verify/. Single file: index.mjs. Libraries:
@noble/ciphers 2.4.0 (XChaCha20-Poly1305), hash-wasm 4.12.0
(Argon2id), node:crypto (HKDF-SHA256, HMAC-SHA256, SHA-256).
Different library family from the Rust implementation's
RustCrypto.

The independence boundary was held: written from
SYNC-ARCHITECTURE.md v1.3 and SYNC-TEST-VECTORS-v1.md only, with
no file under src-tauri/ consulted. The permitted Cargo.toml
exception was not used.

### Environment

  OS:      Microsoft Windows 11 Home | 10.0.26200 | build 26200
  Node.js: v24.18.0
  npm:     11.16.0
  Libraries: @noble/ciphers 2.4.0, hash-wasm 4.12.0, node:crypto

Ran on the main machine, not the cloud machine. Node is present
on both. No Rust compiler needed; not blocked by SAC.

### Result

First execution, no adjustment: 9/9 PASS. E1, H1, H2, H3, M1,
M2, V1, V4, V6 each produced the exact recorded bytes. No
implementation adjustment, vector adjustment, or specification
adjustment was required. No post-hoc convergence occurred.

A negative control was performed: one byte of V1's expected
value was mutated from 0x20 to 0xff in a copy of the runner.
The mutated copy produced V1 FAIL and 8/9 PASS, confirming the
harness detects byte-level mismatch. The copy was deleted; the
original was rerun and reproduced 9/9 PASS.

### Files changed

  Added:    verify/index.mjs, verify/package.json,
            verify/package-lock.json, verify/.gitignore
  Modified: SYNC-TEST-VECTORS-v1.md (Status block only),
            DECISIONS.md (entry appended),
            HANDOFF.md (entry appended),
            SESSION-LOG.md (this entry),
            START-HERE.md (update subsection)

### What was not changed

Rust source, vector values, specification. Database, cloud
schema, backend, Control Plane tables. Phase 9.6 not started.

### Rule compliance

No production touched. No cloud schema change. No CI/CD touched.
Invariant held. No Rust code changed. Instance B
(db.rs::derive_key) not touched. The independence boundary was
held.

## Session — September 27, 2026 (Multi-user application architecture: A–G and design reconnaissance)

Held a structured architecture conversation covering how the two
applications coexist, how they reach providers and AI, where
compliance is enforced, what syncs, and how the work is
sequenced. Then performed a read-only design reconnaissance of
the Client Dashboard.

Nothing was written this session except this record. No spec, no
code, no architecture amendment, no frozen document change.

### The seven sections (A–G), condensed

A — Communication runs from the Agent App, not the Client
Dashboard. Admin configures connectors and monitors. Agent sends.
GORKA-managed subaccounts and BYOP. Automatic sending deferred.

B — Provider credentials live locally, in each device's SQLCipher
database, encrypted with the local password. Separate from the
organization key. Rotation mechanism deferred to sync-protocol
design.

C — AI calls go from the agent's device directly. Only metadata
leaves. New client-side component: the AI boundary layer, which
redacts debtor-identifying content before the call. Multi-provider
from the start.

D — Copilot in both apps with different purposes. Communication
Center in the Agent App only. Per-agent access control not yet
decided.

E — Cloud declares rules, local enforces them. GORKA provides
mechanism and safeguards; the client is sender of record. New
client-side compliance enforcement layer.

F — Message log syncs as new event types. Admin sees full
content. AI recommendations and agent decisions sync. MVP: one
event per message, retain everything. Production: per-step
events, client-policy retention.

G — Same schema for both apps. LEGO architecture. Cross-platform
in the target. "Workable GORKA" defined as a usable pilot
product.

### N1–N3

N1 — Connection Center (broader than communication providers).
Skip-tracing capability needed; framing compliance-sensitive;
legal review a precondition.

N2 — Audit log journal: partially implemented on Client
Dashboard; cross-app connection deferred.

N3 — Cross-platform commitment: Windows first, others later, no
Windows-only assumptions in the shared Rust layer.

### Design reconnaissance

Twelve files read on disk from the Client Dashboard. Design
vocabulary extracted: color palette, typography, spacing, shape,
icons, components, layout. Full tables in DECISIONS.md.

Consistency rule settled: primary button purple #7C3AED
everywhere, including the entry flow. Red #DC2626 reserved for
the logo, errors, and destructive confirmation.

### Entry flow for the Agent App

Three steps, three centered cards in one style: Login → Unlock →
Enroll. Step 3 (Enroll — import the organization enrollment
package) is new as a screen; it also implies a proper export/
import screen pair on the Client Dashboard.

### Files changed

  Modified: DECISIONS.md (this session's entry appended)
  Modified: HANDOFF.md (status update appended)
  Modified: SESSION-LOG.md (this entry)
  Modified: START-HERE.md (update appended, pending)

No commit made this session. No code touched.

### Rule compliance

No production touched. No cloud schema change. No CI/CD touched.
Invariant held. No Rust code changed. The design reconnaissance
was read-only.

September 27, 2026 — Agent App build spec
Session type: Specification authoring. No code. No cloud schema change. No production touched.

Goal: Write the Agent App build spec. Input to Phase 9.5.

Result: Spec written, externally reviewed, corrected, and frozen at version 1.2. Twelve design decisions recorded. Two amendments to frozen documents applied.

Sequence
Ground truth. git log --oneline -3 and git status confirmed b125ee9, clean, origin/main matching.

Reconnaissance. Read on disk, no modifications:

src-tauri/Cargo.toml, auth.rs, db.rs, main.rs (the Rust command layer).

src/backend/_disabled/communication.service.ts and the providers/ tree (the old Communication Center).

src/backend/_disabled/context.service.ts and gemini.service.ts (the old AI context object, the leak C-2 rejects).

src/backend/_disabled/routes/compliance.routes.ts, permissions.routes.ts, calendar.routes.ts (pre-recovery drift, reference only).

src/frontend/pages/DebtorDetail.tsx, Admin/Communications.tsx, Admin/Templates.tsx (the old agent workflow UI).

supervisor-dashboard/src/pages/Calendar.tsx and services/calendar.service.ts (the Client Dashboard's calendar — inert).

Design conversation. Twelve decisions made with the founder. Recorded as D1 through D12 in DECISIONS.md.

Spec written. AGENT-APP-SPEC.md, version 1.0.

External review. The founder sent it to a reviewer. The reviewer returned seven corrections (C1 through C7) and several refinements. Classification: "approve after targeted corrections, not redesign."

Corrections applied. Version 1.1.

Second review pass. Reviewer classified v1.1 as "approve after final founder review — implementation-ready spec," with three process clarifications (Phase 9.5 vs funded-phase wording, localhost API endpoint preflight item, temporal definition in Section 1.2).

Final corrections applied. Version 1.2. Founder approved.

Documentation. DECISIONS.md entry, LOCAL-TABLES.md amendment (v1.3), SYNC-ARCHITECTURE.md amendment (v1.4), HANDOFF.md entry, this SESSION-LOG entry, START-HERE.md update.

The seven corrections from the review
C1 — Sync topology wording. The draft said "all sync traffic passes through the hub." Corrected: hub-and-spoke describes the peer relationship, not the transport path. Transport uses direct P2P preferred, encrypted relay fallback.

C2 — Formalize the debt-sync resolution. Debt-in-data_json interpretation must be recorded in the authoritative architecture document, not only in the Agent App spec. Applied: SYNC-ARCHITECTURE.md Section 25.9.2a, plus Rules 1 and 2.

C3 — Align LOCAL-TABLES. The four schema additions must be recorded in LOCAL-TABLES.md. Applied: LOCAL-TABLES.md v1.3, Amendment 1.

C4 — Clarify migration numbering. Verify against actual run_migrations state before implementation. Applied in the spec, Section 5.8.

C5 — Separate device identity from actor identity. device_id MUST NOT be interpreted as the human actor. Applied: spec Section 3.9, decision D12.

C6 — Make Phase 9.5 placeholders explicit. The sync indicator and Communication Tools screen are static placeholders. Applied: spec Sections 7.6, 8.2, 11.8.

C7 — Make guarantor relation locality explicit. People sync; relations do not in the MVP. Applied: spec Sections 3.7, 5.6, decision D5.

The twelve decisions
D1 command registration per binary. D2 enable_sync admin-only. D3 export_enrollment_package / get_dashboard_stats / bulk_insert_debtors admin-only. D4 no sync_now. D5 guarantors and pledgers. D6 photo as a column. D7 plan view. D8 bulk actions. D9 conditional connector buttons. D10 debt data inside data_json. D11 Phase 9.5 implementation contract. D12 device_id vs created_by.

The reviewer's closing principle, adopted as binding
Do not let the developer "improve" the architecture while implementing this spec. The developer works mechanically from the approved specification. Any discovered discrepancy becomes a STOP -> report -> founder decision, not an opportunity to redesign.

Files on disk after this session
GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md — new, v1.2, frozen.

GORKA_RECOVERY/recovery-notes/DECISIONS.md — new long entry.

GORKA_RECOVERY/recovery-notes/LOCAL-TABLES.md — v1.3.

GORKA_RECOVERY/recovery-notes/SYNC-ARCHITECTURE.md — v1.4.

GORKA_RECOVERY/recovery-notes/HANDOFF.md — new entry.

GORKA_RECOVERY/recovery-notes/SESSION-LOG.md — this entry.

GORKA_RECOVERY/recovery-notes/START-HERE.md — update to follow.

What is next
Phase 9.5 implementation begins after the founder's go. The spec is frozen.

Rule compliance
No production touched.

No cloud schema change.

No CI/CD touched.

Invariant held.

No Rust code changed. db.rs::derive_key not touched.

Reconnaissance was read-only.

No code written in this session.

Session Extension - September 28, 2026 (Phase 9.5 begins)

WHAT THIS SESSION DID

Phase 9.5 began. The workspace was created, the Client's storage
root was migrated, five shared-code slices were extracted, the
Agent App scaffold was built and verified, and Slice 1 of the
adapter/command cleanup was completed.

Fourteen commits landed. Nothing touched production. Nothing
touched the cloud schema. The invariant held.

This is the entry that records the day's work chronologically.
The technical details of each extraction slice are in the new
PHASE-9.5-EXTRACTION-LOG.md. The decisions are in DECISIONS.md.
The status is in HANDOFF.md.

THE SESSION IN ORDER

Opening. State was verified first: main machine at 15c88d3,
clean; cloud machine at 86f7bac with two known untracked files.
The recovery discipline (verify both machines, read the exact
region, one command at a time) was applied throughout.

Phase 1a - Root workspace manifest (199956e).

Created a virtual Cargo workspace at the repository root. One
member initially: src-tauri. No code touched.

Verified: cargo build -p gorka-client on the cloud passed.

Phase 1b - gorka-shared crate (2c540bc).

Created shared/ with a placeholder lib.rs. Added shared to the
workspace members. No code moved yet.

Verified: both crates build.

Phase 2 - Storage root migration (52f0915).

The Client's DB and debtor files lived at
%APPDATA%\gorka\client\data\ (legacy ProjectDirs root), while
settings.dat and the fs plugin scope lived at
%APPDATA%\com.gorka.client\ (Tauri bundle-identifier root).

The two did not agree. This was the hazard: an Agent App calling
the same code would open the Client Dashboard's database.

Decision: Direction 1 plus Option 1b. Unify to the Tauri root
under a data/ subfolder. One-time deliberate migration. Old
root preserved as rollback.

Mechanism:
  - staging into data.migrating/, promoted only after SHA-256
    verification
  - atomic fs::rename for promotion
  - copy .db and .db-wal; do not copy -shm (SQLite recreates it)
  - old root untouched

Files created:
  shared/src/storage.rs        AppStorage type
  src-tauri/src/storage_migration.rs  the migration

Files changed:
  src-tauri/src/db.rs          five functions take &AppStorage
  src-tauri/src/main.rs        .setup() runs migration, manages
                               AppStorage

Verified end-to-end:
  - migration ran once, at startup, before DB open
  - DB hash at new location matched pre-migration
  - old root byte-identical, untouched
  - dashboard numbers matched
  - CRUD worked on migrated DB
  - path routing: renaming the new DB made the app show "Set";
    restoring it made the app show "Enter"
  - file upload landed under new root's files/debtors/<id>/
  - old root's files folder stayed empty
  - data.migrating did not survive the promotion

ProjectDirs now appears in exactly one file on disk:
storage_migration.rs. Not in shared/, not in db.rs, not in
main.rs.

Slice 3.1 - Models (a2ccd73).

Moved all structs and enums from main.rs to
shared/src/models.rs. main.rs imports them via
use gorka_shared::models::*.

Verified: build passed. Client smoke test passed.

Slice 3.2 - Enrollment package (8cce268).

Moved build_enrollment_package and parse_enrollment_package
to shared/src/enrollment.rs. E1-E6 tests moved to
shared/tests/enrollment.rs as integration tests.

The Tauri commands export_enrollment_package and
import_enrollment_package stay in main.rs and call the
shared functions.

Verified: cargo test -p gorka-shared passed 6/6, including E1,
the byte-exact known-answer test. cargo test -p gorka-client
passed 8/8 (H, M, V). Client smoke test passed.

Slice 3.3 - Sync primitives (7b06034).

Moved twelve functions to shared/src/sync.rs:
derive_session_key, compute_handshake_reply_tag,
compute_handshake_confirm_tag, build_handshake_proof_input,
encode_tlv, encode_string_value, encode_debtor_created_payload,
encode_entity_updated_payload,
encode_communication_logged_payload, encode_event_record,
build_sync_message, parse_sync_message.

Moved H1-H3, M1, M2, V1, V4, V6 tests to shared/tests/sync.rs.

Cleaned seven dead imports out of main.rs.

Verified: build passed. Warnings dropped from 25 to 11.
cargo test -p gorka-shared passed 14/14. cargo test -p
gorka-client reported 0 tests. Client smoke test passed.

Agent scaffold (0e73b34, 699b9fe).

The external review's Q5 answer was refined: the Agent scaffold
should come once models, storage, enrollment, sync are shared,
before db and auth are fully extracted. The prose recommendation
was binding; the sequence table's later placement of the
scaffold was treated as an inconsistency to correct.

The external review also chose Option B as binding on the
scaffold timing.

Created:
  agent-dashboard/            independent React frontend,
                              Vite port 5174
  src-tauri-agent/            second Tauri binary
    Cargo.toml                gorka-agent package
    build.rs
    tauri.conf.json           identifier com.gorka.agent
    capabilities/default.json
    icons/                    copied from Client, TODO for
                              distinct Agent icon set
    src/main.rs               one command: agent_ping

Updated workspace members to add src-tauri-agent.

Verified:
  - gorka-agent.exe built (15.5 MB initially)
  - window opened, titled "GORKA Agent"
  - placeholder frontend rendered from agent-dashboard on 5174
  - app data folder did not exist initially - Tauri's
    app_data_dir() resolves a path but does not create it

Fix 699b9fe: added storage.ensure_dirs() in the Agent's setup
closure. Tauri's app_data_dir() resolves but does not create
directories; ensure_dirs creates the files/debtors tree.

Verified after the fix:
  - %APPDATA%\com.gorka.agent\data\files\debtors\ created
  - %APPDATA%\com.gorka.client\ untouched
  - %APPDATA%\gorka\ untouched

Slice 3.4 - DB extraction (a959087).

Moved db.rs wholesale to shared/src/db.rs. All ten functions:
get_db_path, database_exists, get_files_dir,
get_debtor_files_dir, derive_key, generate_salt, init_db,
verify_password, run_migrations, log_audit.

One import adjusted: use gorka_shared::storage::AppStorage
becomes use crate::storage::AppStorage. One path comment
updated. Nothing else.

Deleted src-tauri/src/db.rs. Removed mod db; from main.rs,
added use gorka_shared::db;. The db::foo(...) call sites
kept working.

Also deleted the two tracked September 14 backups:
main.rs.before-communications-20260914,
main.rs.before-debts-20260914. This was authorized after the
Agent scaffold verified.

Verified: both binaries built. cargo test -p gorka-shared
passed 14/14. Client smoke test passed.

Slice 3.5 - Auth.

Reconnaissance found that the review's Shape 1 (path-based
pure functions) does not match the actual code. Six of seven
functions in auth.rs are pure tauri-plugin-store operations
with no Tauri-free side. Only the HTTP half of login is
Tauri-free.

The founder asked the external reviewer. Answer: Reading C,
DEFERRED. No code change. The store is genuinely Tauri-
specific; the six functions are essentially direct plugin
operations. The Agent's auth does not exist yet, so there is
no duplication to remove. Re-evaluate after the Agent's
authentication exists.

The review's reasoning: the current architecture has simply
shown there is not a clean, justified extraction boundary for
the settings portion yet. "Deferred" is not "failed."

No files changed. a959087 stayed.

Adapter/command cleanup, Slice 1 - Debtors (91b5b7e).

Reconnaissance identified 34 Tauri commands in main.rs:
  - 11 already thin adapters (delegate to db:: or auth::)
  - 23 with real logic (SQL, row mapping, audit calls in body)
  - 3 AppState-touching (unlock_database, is_database_unlocked,
    logout)

The external review chose Reading 3: extract in entity-based
slices. Debtors first.

Pattern: shared function takes (conn: &Connection,
organization_id: &str, ...); the Tauri command locks AppState,
gets the trusted org id, calls the shared function, returns.

Created shared/src/debtors.rs with eight functions. Every SQL
string, parameter binding, row mapping, transaction boundary,
and audit call is identical to the original. Only the
signatures changed.

main.rs: each of the eight commands became a thin adapter.
bulk_insert_debtors still uses as_mut() for the transaction.
delete_debtor still takes State<AppStorage> for file deletion.

Warning cleanup (Q5 of the review): removed unused State
import and the unused app parameter in upload_document.

Verified: build passed (2m 28s). Warnings 8 to 6. cargo test
-p gorka-shared passed 14/14. Client smoke test passed with
every debtor operation exercised: list, detail, edit, add,
search, delete.

Housekeeping - three commits, at the end of the session.

20a1730: .gitignore added target/ and **/target/, plus
slice1_block.txt, *.bak-slice1, *.bak-phase3-*. The workspace
target/ was never tracked, but the ignore file did not list
it; the first post-workspace build produced hundreds of
untracked artifacts. Verified nothing under target/ was ever
tracked, so a gitignore fix was sufficient.

ab957d8: root Cargo.lock and src-tauri-agent/gen/schemas/*.json
tracked. The root Cargo.lock was generated on the cloud but
never committed. Not committing it recreated the same class of
cross-machine drift we fixed on September 26. Committed from
the cloud.

ee8c732: removed the obsolete pre-workspace src-tauri/
Cargo.lock. Root Cargo.lock is now authoritative. Also deleted
the two gitignored temp files from Slice 1.

Extraction log (8435179).

Created PHASE-9.5-EXTRACTION-LOG.md in the recovery notes. It
records Slice 1 in detail with the fields the review required:
starting and resulting commits, files moved, commands moved,
function mapping, data preservation (SQL, parameters, row
mappings, transaction boundaries, audit calls), adapter
behavior preservation (org id acquisition, AppState
ownership, error propagation, return values), warning count
before/after, build and test results, explicit non-changes,
deviations (none).

Two paste-related defects in the file were caught and fixed
before commit: markdown escapes (\#, \&, \_, &#x20;) and
doubled newlines. Final file: 132 lines, clean.

VERIFICATION SUMMARY

  cargo build -p gorka-client        PASS after each slice
  cargo build -p gorka-agent         PASS after scaffold
  cargo test -p gorka-shared         14/14 PASS
  cargo test -p gorka-client         0 tests (all moved)
  Client smoke test                  PASS after each slice
  Agent launch test                  PASS after scaffold
  Path routing checks                PASS after migration

WARNINGS

  gorka-client warnings: 10 at the start of the session,
  6 at the end. Removed: unused import State; unused variable
  app (upload_document parameter); three imports that moved
  to shared with the sync primitives.

  Five auth.rs warnings remain. Deferred with the auth slice.

  One gorka-agent linker warning (LNK4099, OpenSSL PDB) is
  cosmetic and unavoidable with the vendored OpenSSL build.

UNEXPECTED FINDINGS

  1. .gitignore did not exclude target/. Discovered during
     the final verification. Fixed at 20a1730.

  2. Root Cargo.lock was untracked. Fixed at ab957d8. The
     pre-workspace src-tauri/Cargo.lock removed at ee8c732.

  3. The Agent's app data folder did not exist after the
     first launch. Cause: Tauri's app_data_dir() resolves a
     path but does not create the directory. Fixed at
     699b9fe with storage.ensure_dirs() in setup.

STATE AT END OF SESSION

  Main machine:  8435179, clean, pushed.
  Cloud machine: ee8c732, clean. Two commits behind; needs
                 git pull before Slice 2.
  GitHub:        8435179.

NEXT WORK

Slice 2 - debts. Commands to move: get_debts, insert_debt,
update_debt, delete_debt. Same pattern as Slice 1.

After Slice 2: communications, actions, documents, dashboard.
Then final Client regression. Then Agent implementation. Then
Agent authentication. Then re-evaluate the shared auth
boundary.

RULE COMPLIANCE

No production touched.
No cloud schema change.
No CI/CD touched (release.yml unchanged).
Invariant held.
No frozen document amended beyond the September 27
amendments already recorded.
The extraction was mechanical: SQL, parameters, row mappings,
transactions, audit calls, and command names unchanged in
every slice.

End of entry.

Session Extension - September 29, 2026 (Stage B complete, Stage C.1 complete)

WHAT THIS SESSION DID

Continued Phase 9.5. Three items left open by the previous
session were closed: Item 1 (delete_debtor filesystem test),
Item 2 (auth boundary), and Item 3 / Stage A (schema
migrations). Then Stage B was completed in three sub-slices:
photo functions, calendar operations, and debtor relations.
Then Stage C began with C.1, the Agent's authentication
foundation.

Nineteen commits landed. No production touched. No cloud
schema change. The invariant held.

This is the entry that records the day's work
chronologically. Technical details of each slice are in
PHASE-9.5-EXTRACTION-LOG.md. The HOW decisions are in
DECISIONS.md (September 29 entry). Status is in HANDOFF.md.

THE SESSION IN ORDER

Item 1 - delete_debtor filesystem test.

Isolated test on the cloud. Created a test debtor in the
Client UI, uploaded one document, deleted the debtor. The
filesystem was inspected before and after. The folder and
its documents subfolder were both gone after the delete.
PASS. A pre-existing orphan folder (cd972140-...) from an
earlier manual test remained, but a fresh create/upload/
delete cycle leaves nothing behind. The delete path is
correct.

Item 2 - auth boundary.

Decision Reading A from Slice 3.5 was finally applied. The
HTTP half of login moved to a new shared module
(gorka_shared::auth_http) holding the request/response
types and one async function. The Client's login became a
thin orchestrator: call shared HTTP, then write auth_token,
organization_id, and salt to its own settings.dat. The
store half stays per binary by design.

Two dead imports (json, Deserialize) removed from the
Client's auth.rs in the same commit. A follow-up commit
(10df6f5) removed reqwest from src-tauri/Cargo.toml, since
no file under src-tauri/src uses it directly anymore.

Verified on cloud: gorka-client built, 14/14 shared tests,
login through the thin orchestrator worked.

Item 3 / Stage A - schema migrations.

Three migration blocks appended to shared/src/db.rs:
  v5 - debtors.photo_path TEXT
  v6 - calendar_events table + 2 indexes
  v7 - debtors.role + debtor_relations table + 3 indexes

Migration-only. No models, no commands, no CRUD. The shared
schema means the Client ran them on its next launch.
Verified on cloud: Client login -> unlock -> dashboard
worked. Existing data intact: 12 debtors, $2,381,550,
2 actions.

Stage B - shared functions.

Sub-slice 1 (2268a30) - photo functions.

set_debtor_photo and get_debtor_photo added to
shared/src/debtors.rs. Photo written to the debtor's files
directory at photo.<ext>; prior photo.* removed before
replacement; debtor existence checked before any filesystem
mutation. No organization scoping (matches spec 6.3 and the
Slice 5 documents precedent). Debtor and DebtorInput models
untouched.

Verified on cloud: gorka-client built.

Sub-slice 2 (292a3a8) - calendar operations.

New shared/src/calendar.rs (279 lines) with six functions:
get_calendar_events, insert_calendar_event,
update_calendar_event, delete_calendar_event,
get_upcoming_payments, get_upcoming_followups. Four new
model structs (CalendarEvent, CalendarEventInput,
UpcomingPayment, UpcomingFollowup).

Key decisions:
  - All six take trusted organization_id. The spec's
    section 6.3 example signatures omitted it, but
    LOCAL-TABLES v1.3 Amendment 1 requires the field to be
    derived from trusted context. The normative rule won.
  - get_calendar_events uses inclusive overlap semantics.
  - event_type is always MANUAL on insert.
  - Explicit debtor-existence check on insert and update.

Verified on cloud: gorka-client built, 14/14 tests.

Sub-slice 3 (884c637) - debtor relations.

New shared/src/relations.rs (163 lines) with three
functions: get_debtor_relations, insert_debtor_relation,
delete_debtor_relation. Two new model structs (DebtorRelation
with joined related-debtor info, DebtorRelationInput).

get_debtor_relations returns only rows where debtor_id
matches the requested debtor; reverse-direction view is out
of scope. Insert validates both debtors exist in the org,
rejects self-relations, validates relation_type against
GUARANTOR and PLEDGER, and pre-checks the unique constraint.
No audit in Phase 9.5, consistent with calendar.

Stage C.1 - Agent authentication foundation.

Commit 5ab35ae.

New src-tauri-agent/src/auth.rs mirroring the Client's
post-Item-2 shape: seven functions (login, get_token,
get_organization_id, get_salt, set_unlocked, is_unlocked,
logout). login is thin: calls gorka_shared::auth_http for
the HTTP half, writes auth_token, organization_id, and salt
to the Agent's own settings.dat.

src-tauri-agent/Cargo.toml gains rusqlite and hex.

src-tauri-agent/src/main.rs rewritten:
  - AppState (was AgentState) with db: Mutex<Option<Connection>>
  - agent_ping removed
  - eight commands registered (login, get_auth_token,
    get_salt, get_organization_id, database_exists,
    unlock_database, is_database_unlocked, logout)
  - unlock_database written clean (no debug println!s),
    but preserves the "Key derivation failed" error wrapper

Commit 67b984a - Cargo.lock regeneration on cloud. The lock
lives only on cloud. Two reconciliations were needed:
Item 2's reqwest move (gorka-client loses it, gorka-shared
gains it) and Stage C.1's hex and rusqlite additions to
gorka-agent.

Commit c69d21e - follow-up: remove the unused
tauri::Manager import from the Agent's auth.rs. The import
became dead because AppHandle methods resolve inherently,
not through the Manager trait. Agent bin warning count went
3 -> 2. The other warning (is_unlocked never used) is kept
deliberately for symmetry with the Client's deferred
warning from Slice 3.5.

Verified on cloud: gorka-agent built for the first time
with real commands. gorka-client built. 14/14 tests.
Warning counts: gorka-client bin 3 (unchanged),
gorka-agent bin 2, gorka-shared lib 6 (unchanged).

DOCUMENTATION

Combined extraction-log update: four new sections (Stage B
1-3, Stage C.1) plus SEQUENCE showing Stage B DONE, Stage C
IN PROGRESS (C.1 done).

DECISIONS.md: new September 29 entry recording three HOW
decisions:
  D1 - spec 6.3 signatures are illustrative, not normative.
       LOCAL-TABLES rules win.
  D2 - open_local_file deferred to Stage D, when the
       Documents UI actually consumes it.
  D3 - new Agent code is written clean (no debug println!s,
       no dead imports). "Preserve exactly" is for
       extraction; it does not apply to new code.

Plus session notes on cloud-side edits (Cargo.lock
regeneration, the Manager cleanup) and warning count changes.

HANDOFF.md, SESSION-LOG.md, and this extension record status
and chronology.

STATE AT END OF SESSION

  Main machine:  c69d21e, clean.
  Cloud machine: c69d21e, clean except the two known
                 untracked files (check-columns.ts,
                 test-package.gorka).
  GitHub:        c69d21e.

NEXT WORK

Stage C.2 - CRUD adapters in the Agent's main.rs. 21
adapter commands for debtors, debts, communications,
actions, documents. All main-side. Cloud needed only for
the build verification.

After C.2: C.3 (photo, calendar, relations adapters), C.4
(enrollment). Then Stage D - the Agent frontend. Then the
Agent end-to-end regression.

RULE COMPLIANCE

No production touched.
No cloud schema change.
No CI/CD touched (release.yml unchanged).
Invariant held.
No frozen document amended beyond the September 27
amendments already recorded.
Stage B introduced new code with per-function design
decisions, each recorded in the extraction log.
Stage C.1 kept the Client binary untouched.

End of entry.

Session Extension - September 30, 2026 (Stage C.5 complete, Stage D.0-D.3 complete)

WHAT THIS SESSION DID

Continued Phase 9.5. Closed Stage C with a small backend
addition (C.5, is_enrolled). Then began Stage D - the Agent
frontend - and completed D.0 (prerequisites), D.1 (design
tokens and primitives), D.2 (entry flow), and D.3 (main
shell).

Six commits landed. No production touched. No cloud schema
change. The invariant held.

This is the entry that records the day's work
chronologically. Technical details of each slice are in
PHASE-9.5-EXTRACTION-LOG.md. The HOW decisions are in
DECISIONS.md (September 30 entry). Status is in HANDOFF.md.

THE SESSION IN ORDER

C.5 - is_enrolled backend command.

Commit a085b8d.

Added shared::db::is_enrolled(conn) -> Result<bool, String>.
The function queries organization_keys for a row. Returns
Ok(true) if present, Ok(false) if absent, Err if the query
fails.

Added the Agent adapter and registered it between
is_database_unlocked and logout in generate_handler!.

Reason: the Agent entry flow needs to know whether the
device is already enrolled. Before this commit, the only way
to learn that was to attempt import_enrollment_package and
interpret its refusal. That forced the user to select a
package file on every launch. is_enrolled is a query, not
an operation.

Scope discipline: Client untouched, schema untouched,
enrollment package format and import behavior unchanged,
organization-key semantics unchanged.

Verified on cloud: gorka-agent builds (2 warnings),
gorka-client builds (3 warnings), 14/14 shared tests,
Cargo.lock unchanged.

Stage D.0 - Agent frontend prerequisites.

Commit 71948ab.

Installed Agent dashboard dependencies: react-router-dom,
lucide-react, FullCalendar v6 (react, daygrid, interaction,
list, timegrid), @tauri-apps/plugin-dialog. Versions match
the Client.

Added tsconfig.json: strict, @/* path alias, vite/client
types, no baseUrl (TS 6.0 deprecation).

Changed build script to tsc -p tsconfig.json && vite build
for type-checking parity with the Client.

Stage D.1 - design tokens and shared primitives.

Commit 38ae126.

Added design-tokens.css with values from AGENT-APP-SPEC.md
v1.2 section 11.2, plus entry-flow tokens sourced from the
Client's pre-Tauri Login page. Single source of truth for
every visual value.

Added index.css: minimal reset, no Tailwind, no Vite
template.

Added ten primitives (Button, Input, Label, ErrorBanner,
Spinner, EntryCard, GorkaLogo, Card, Avatar, Modal), each
with a .tsx and a .css. Barrel export in
primitives/index.ts.

Added postcss.config.js with empty plugins so the Agent
does not inherit the repo-root Tailwind pipeline.

Stage D.2 - entry flow.

Commit 2eb97b9.

Rewrote App.tsx as a state machine: loading -> login ->
unlock -> enroll -> shell. Each screen's success handler
re-runs the bootstrap; the machine self-corrects.

Added LoginPage (invoke('login')), UnlockPage (reads
database_exists for set/enter mode; invoke('unlock_database')),
EnrollPage (dialog.open() filtered to .gorka;
invoke('import_enrollment_package')).

Added AppShell as a placeholder for D.3.

Stage D.3 - main shell.

Commit efbbc4d.

Replaced AppShell placeholder with the real layout:
Sidebar + TopHeader + Outlet.

Sidebar: 240px fixed, GORKA wordmark, seven nav items
(Today, Debtors, Communication Tools, Actions, Documents,
Copilot disabled with "Soon" badge, Settings).

TopHeader: page title (route-driven), static "Sync not yet
enabled" placeholder per spec 7.6, Avatar, logout button.

App.tsx: the shell step now wraps in HashRouter with seven
routes as inline StubPage usages.

DOCUMENTATION

Commit bdf93a2 covered C.5 and D.0-D.2 slice records plus
the September 30 DECISIONS entry (five HOW decisions:
design source is Client real design, spec 11.3 six
inconsistencies corrected, entry-flow reference is Client
pre-Tauri Login with purple button, is_enrolled replaces
literal refusal-as-signal, Agent icon deferred).

The Stage D.3 slice record plus this extension update and
the HANDOFF, PHASE-PLAN, START-HERE updates are appended
after the visual verification in the same session.

VERIFICATION ON CLOUD

cargo build -p gorka-agent    PASS (2 warnings, unchanged)
cargo build -p gorka-client   PASS (3 warnings, unchanged)
cargo test -p gorka-shared    14/14 PASS
npm install on cloud          OK, 0 vulnerabilities
npm run build on cloud        PASS (227.44 kB JS, 7.43 kB CSS)

Visual verification:
  Login page renders correctly (red GORKA wordmark, purple
  Sign In button).
  Shell renders correctly (240px sidebar, seven nav items,
  Today stub active state, header with sync placeholder and
  avatar).

Both confirmed.

STATE AT END OF SESSION

  Main machine:  efbbc4d, clean.
  Cloud machine: efbbc4d after next pull (currently at
                 2eb97b9, plus the two known untracked
                 files).
  GitHub:        efbbc4d.

NEXT WORK

  Stage D.4 - debtor list and debtor profile. The core
  screen. Then D.5 (plan view / calendar), D.6 (remaining
  screens). Then the Agent end-to-end regression.

RULE COMPLIANCE

No production touched.
No cloud schema change.
No CI/CD touched (release.yml unchanged).
Invariant held.
No frozen document amended beyond the September 27
amendments already recorded.
Client binary untouched since Item 2.
The design-source decision (Path B) recorded in DECISIONS.md
September 30 entry.

End of entry.


Session Extension - October 1, 2026 (Stage D.4a-0 through D.4b-2c Rust half)

WHAT THIS SESSION DID

Continued Phase 9.5. Built the Agent App's first data
pages. Six slice commits and four documentation commits
landed in this session extension. No production touched.
No cloud schema change. The invariant held.

This is the chronological record. Technical details of
each slice are in PHASE-9.5-EXTRACTION-LOG.md. The HOW
decisions are in DECISIONS.md (October 1 entry). Status
is in HANDOFF.md.

THE SESSION IN ORDER

D.4a-0 - Primitive gap-fill.

Commit 7f122e1. Discovered during D.4a reconnaissance.
D.1's reconnaissance read the Client's shell and entry
flow, not Collections.tsx or DebtorDetail.tsx. Five gaps
fell out of that scope boundary. All additive.

Files: design-tokens.css gains 24 tokens. Modal gains
closeOnOverlayClick. Button gains size and iconOnly. New
Select and Textarea primitives. TopHeader gains one
prefix rule.

Verified on main: npm run build PASS.

D.4a - Debtor list and debtor profile.

Commit 32f1475. The Agent's first data-page slice.
Frontend only. New: local.db.ts (thin transport adapter),
DebtorEditModal, DebtEditModal, ActionEditModal,
DebtorsPage, DebtorProfilePage. App.tsx gains two routes.

Verified on cloud: entry flow (Login, Set password,
Enroll), list, search, add, edit, delete debtor. Profile
renders header card, debts card, actions card. Debt CRUD
and Action CRUD. Persistence across restart.

D.4b-1 - Communications and documents cards.

Commit c5e2d6e. Communications card inserted between
Debts and Actions so the card order matches the Client.
Documents card added at position 5. Actions card moved
from position 3 to position 4 (same JSX, position only).
New CommunicationEditModal (create-only, duration
CALL-only).

Verified on cloud: comm CRUD, docs upload with category
binding, delete, persistence.

D.4b-2a - Debtor profile photo.

Commits 8ddb6ef (Rust) and 3688d9f (frontend). The CSP
does not include asset: or file:, so a stored path cannot
be displayed. Chosen path: Rust returns bytes plus MIME;
frontend builds a blob: URL. CSP already allows blob:.

Rust: DebtorPhotoData struct, read_debtor_photo function,
mime_from_extension helper. One command, one registration.

Frontend: photoUrl state, photoUrlRef for URL revocation,
loadPhoto, handleChangePhoto (dialog plugin), unmount
cleanup, two-column header card.

Verified on cloud: placeholder Avatar, change photo,
image renders, persists across restart.

D.4b-2b - Relations card.

Commit 68440de. Zero Rust, zero schema. Reconnaissance
found that the role badge can read from
debtor_relations.relation_type, which already exists. The
debtors.role column was not needed for this slice.

Files: local.db.ts gains DebtorRelation types and three
methods. RelationEditModal (two modes: create new, link
existing; collateral fields PLEDGER only). Profile page
gains Relations card between Debts and Communications,
with count in the heading and two header buttons.

Verified on cloud: add guarantor, add pledger with
collateral, navigate to related person, delete relation,
persistence.

Observation (not a defect): related persons appear in the
debtors list without a role badge. Spec 11.6 asks for the
badge. Deferred to D.4b-2c.

D.4b-2c (Rust half) - Role column and orphan cleanup.

Commit c73373d. Four new Rust commands, one modified, all
registered:
  get_related_debtor_roles
  get_debtor_debt_totals
  insert_related_debtor
  cleanup_orphaned_related_debtors
  delete_debtor_relation (now takes storage)

Design: `debtors.role` is written by `insert_related_debtor`
so that cleanup can distinguish "former related person now
orphaned" from "plain debtor created and not yet used".
Cleanup runs once on Debtors page mount. Orphan check
covers five tables to prevent cascade-delete of real data.

NOT YET COMPILED ON CLOUD. The founder paused to write
documentation before the compile.

DOCUMENTATION

Four commits in this batch:
  d0eb175  extraction log entries
  829dcea  DECISIONS entries
  b184408  HANDOFF status update
  (this)   SESSION-LOG, START-HERE, PHASE-PLAN

STATE AT END OF SESSION

  Main machine:  (pushed at end of this documentation batch)
  Cloud machine: c5e2d6e, behind by three commits.
                 Needs git pull before any Rust build.
  GitHub:        (pushed)

NEXT WORK

  1. Cloud pull, cargo build -p gorka-agent,
     cargo build -p gorka-client, cargo test -p gorka-shared.
  2. D.4b-2c frontend half (five files).
  3. D.5 - plan view / calendar.
  4. D.6 - remaining screens.
  5. Agent end-to-end regression.

RULE COMPLIANCE

  No production touched.
  No cloud schema change.
  No CI/CD touched (release.yml unchanged).
  Invariant held.
  No frozen document amended beyond the September 27
  amendments already recorded.

End of entry.


================================================================
SESSION - October 2, 2026 (D.6.1 and D.6.2)
================================================================

WHAT THIS SESSION DID

Continued Phase 9.5. Closed the last two remaining
frontend slices before the Agent end-to-end regression:
D.6.1 (Communication Tools placeholder + Settings
About-only) and D.6.2 (cross-debtor Actions browser).

Two implementation commits and one documentation batch.

COMMITS

  3b578f3  D.6.1 Communication Tools placeholder and
           Settings About-only (5 files)
  88ef81c  D.6.2 cross-debtor Actions browser (8 files)
  (this)   documentation batch: extraction log,
           DECISIONS, HANDOFF, START-HERE, SESSION-LOG,
           PHASE-PLAN

WHAT WAS BUILT

D.6.1 - five files, no Rust, no schema.
  - CommunicationToolsPage.tsx / .css. Card wrapper,
    MessageSquare icon, the exact spec 11.8 sentence.
    Reads nothing. No local_connectors table.
  - SettingsPage.tsx / .css. Four cards: About, Data,
    Sync, Security. Version hardcoded 0.0.0.
  - App.tsx: two Route swaps.

D.6.2 - eight files. One new Rust command.
  - models.rs: ActionWithDebtor struct (joined row).
  - actions.rs: get_all_actions(conn, org_id). Sort
    is (due_date IS NULL), due_date ASC, created_at
    DESC.
  - src-tauri-agent/src/main.rs: register the command.
    Client binary untouched.
  - local.db.ts: ActionWithDebtor type,
    getAllActions() wrapper.
  - ActionsPage.tsx / .css: read-only table, five
    status filter chips, debtor-name navigation.
  - App.tsx: /actions route swap.
  - DebtorProfilePage.tsx: back-target logic extended
    to accept fromPath / fromLabel.

WHAT IS VERIFIED ON CLOUD

Both slices. Full behavioral smoke tests passed.
Rust regression unchanged:
  gorka-agent 2 warnings, gorka-client 3 warnings,
  gorka-shared 14/14.
Frontend hashes matched main for both slices.

DEFERRED

  From D.6.2:
    - Type filter on ActionsPage.
    - Text search on ActionsPage.
  From D.5 (unchanged):
    - Day panel.
    - Period summary.
    - Bulk-select within a day panel.

PROCESS NOTES

Read-before-edit discipline broke once during D.6.1
(App.tsx edited from memory). Caught by the founder.
Corrective readback performed. Restored from D.6.1
file 2 onward. No code impact.

D.6.1 file count corrected from 6 to 5 in the plan
(TopHeader.tsx already had both title entries from
D.3).

D.6.2 file count corrected from 6 to 8 in the plan
(DebtorProfilePage back-target extension and
local.db.ts wrapper were not counted). Founder
approved the correction.

STATE AT END OF SESSION

  Main machine:  88ef81c, clean, pushed.
  Cloud machine: 88ef81c, clean.
  GitHub:        88ef81c.

NEXT WORK

  1. Agent end-to-end regression. Final Phase 9.5
     pass.
  2. Close Phase 9.5.
  3. Phase 9.6 begins with reading
     SYNC-ARCHITECTURE.md v1.3 and LOCAL-TABLES.md
     v1.3. No code on day one.

RULE COMPLIANCE

  No production touched.
  No cloud schema change.
  No CI/CD touched (release.yml unchanged).
  Invariant held.
  No frozen document amended.

End of entry.


================================================================
SESSION - October 2, 2026 (Phase 9.5 closed)
================================================================

WHAT THIS SESSION DID

Ran the Agent end-to-end regression, found and fixed a
logout defect, changed the bundle identifier for both
apps, removed an obsolete Client storage migration,
added a Support sidebar placeholder, and closed
Phase 9.5.

Two implementation commits, one documentation batch.

COMMITS

  e9488aa  Phase 9.5 closure fixes: logout wiring,
           bundle identifier change, Support item
           (6 files)
  92e9b7c  Client storage migration removal
           (2 files, one deleted)
  (this)   documentation batch

AGENT END-TO-END REGRESSION

Ten of eleven steps passed:

  Entry flow                     PASS
  Debtors list                   PASS
  Debtor profile (all cards)     PASS
  Photo change                   PASS
  Relations                      PASS
  Plan view (calendar)           PASS
  Communication Tools            PASS
  Settings (layout)              PASS
  Actions page                   PASS
  Persistence across restart     PASS
  Logout button                  FAIL

WHAT WAS FIXED

  Logout button. Was bound to the entry-flow check
  (advance), which re-selects the shell step without
  calling logout. Now bound to a dedicated handler
  that invokes the logout command and returns to
  Login.

  Bundle identifier. Both apps changed from
  com.gorka.* to click.gorka.*. Reverse-DNS now
  matches the real domain (gorka.click).

  Client storage migration. The Phase 2B
  storage_migration.rs module fired on every Client
  launch and copied an old DB into the new
  identifier folder. Removed. Client now shows "Set"
  on first launch.

  Support sidebar item. Added between Copilot and
  Settings, disabled with "Soon" badge. Placeholder
  only.

WHAT WAS DEFERRED

  GORKA-SUPPORT-SPEC.md. The support specification
  will be written before Phase 9.6 begins. It is a
  parked deliverable. Support and sync do not touch.

STATE AT END OF SESSION

  Main machine:  92e9b7c, clean, pushed.
  Cloud machine: 92e9b7c, clean, powered off.
  GitHub:        92e9b7c.

NEXT WORK

  1. Write GORKA-SUPPORT-SPEC.md. Structure proposal
     first, founder approves, then write one section
     at a time.
  2. Begin Phase 9.6. Read SYNC-ARCHITECTURE.md v1.3
     and LOCAL-TABLES.md v1.3 in full. No code on day
     one.
  3. CONNECTOR-MODEL.md at the start of Phase 9.6.

RULE COMPLIANCE

  No production touched.
  No cloud schema change.
  No CI/CD touched (release.yml unchanged).
  Invariant held.
  No frozen document amended beyond the AGENT-APP-SPEC
  3.7 amendment recorded earlier in Phase 9.5.

End of entry.
