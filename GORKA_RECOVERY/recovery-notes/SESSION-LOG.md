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




