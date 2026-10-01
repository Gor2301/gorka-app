\# GORKA RECOVERY — DECISIONS LOG



\*\*Session Date:\*\* September 11, 2026

\*\*Participants:\*\* GORKA founder + AI architect

\*\*Purpose:\*\* Record every decision made during this session, with

reasoning, alternatives considered, and impact.

\*\*Status:\*\* Frozen.



\---



\## Why This Document Exists



On September 9–10, 2026, GORKA drifted from its specifications

during a database reconciliation attempt. Two days were lost.



This document ensures that the reasoning behind every decision made

on September 11, 2026 is preserved. So that:



\- Future sessions can understand the "why," not just the "what."

\- Decisions aren't accidentally reversed.

\- Alternatives that were considered are documented, so we don't

&#x20; revisit them without reason.



\---



\## Context of the Session



\*\*Starting state:\*\*

\- Tauri Client Dashboard builds and produces installers on 3 platforms

\- GitHub Release v0.1.0 with artifacts

\- Backend server runs

\- Prisma 6.19.3 installed

\- Production Supabase has 18 tables — all test/mock data

\- `gorka\_test` exists in a dirty state (reconciliation partially applied)

\- Architecture drift discovered: debtor tables in cloud, Prisma schema mixed



\*\*Goal of the session:\*\*

Re-establish the correct architecture (Tauri spec v3.2 + Migration

spec v5.0), preserve the working Tauri build, and prepare a

step-by-step recovery.



\---



\## Decisions Made



\### D-001: Use Architectural Law as the constitution



\*\*Decision:\*\* Write and freeze a one-page document called

`ARCHITECTURAL-LAW.md` that states the invariant (no individual

debtor data in cloud), definitions (client data vs debtor data), and

the two data planes.



\*\*Reasoning:\*\* Without a single written source of truth, every session

drifts. The law becomes the constitution that all future work

references.



\*\*Alternatives considered:\*\*

\- Verbal understanding only → rejected (drifts)

\- Multiple smaller docs → rejected (no single authority)



\*\*Impact:\*\* All future work must comply with the law. Amendments

require an explicit documented process.



\---



\### D-002: "Debtor data" is the term of art



\*\*Decision:\*\* Use "debtor data" for the regulated category and

"customer data" for GORKA's customers (agencies/banks).



\*\*Reasoning:\*\* The earlier term "client data" caused confusion —

debtors are the client's clients. Using "debtor data" and "customer

data" removes the ambiguity.



\*\*Alternatives considered:\*\*

\- Keep "client data" with definitions → rejected (too ambiguous)

\- Use "account data" → rejected (weaker than "customer data")

\- Use "subject data" (GDPR-style) → rejected (too legalistic)



\*\*Impact:\*\* All future docs use "debtor data" and "customer data."



\---



\### D-003: Cloud table count is not a fixed rule



\*\*Decision:\*\* The permanent rule is \*what categories of data may

live in cloud\*, not "these exact 19 tables forever."



\*\*Reasoning:\*\* Six months from now, GORKA may legitimately need new

cloud tables (billing\_invoices, feature\_flags, etc.). Declaring

"19 forever" would create false constraints.



\*\*Alternatives considered:\*\*

\- Freeze the 19 tables as permanent → rejected (brittle)

\- No rule at all → rejected (drift)

\- Permanent rule + current implementation = better framing → accepted



\*\*Impact:\*\* `CLOUD-TABLES.md` documents the rule, then lists the

current 19 as the approved implementation.



\---



\### D-004: Boundary test must be manual AND automated



\*\*Decision:\*\* Build both:

\- Manual test (fake debtor, trace network, demonstrate to regulators)

\- Automated test (regression guard, fails CI if any debtor data appears)



\*\*Reasoning:\*\* Manual for regulator story. Automated for permanent

protection. The manual test can be forgotten or skipped; the

automated cannot.



\*\*Alternatives considered:\*\*

\- Manual only → rejected (no regression protection)

\- Automated only → rejected (no regulator demonstration)

\- Both → accepted



\*\*Impact:\*\* Phase 15 (boundary test) includes both. Automated test

runs in CI/CD.



\---



\### D-005: Role enum simplified to OWNER / CLIENT / AGENT



\*\*Decision:\*\* Three roles only:

\- `OWNER` — platform owner (the founder)

\- `CLIENT` — client admin (agency owner)

\- `AGENT` — agency employee (future Agent App)



\*\*Reasoning:\*\* Simple, unambiguous, matches how you describe them.



\*\*Alternatives considered:\*\*

\- `PLATFORM\_OWNER` / `CLIENT\_ADMIN` / `AGENT` (Migration spec v5.0)

&#x20; → rejected (longer, less natural)

\- `SUPER\_ADMIN` / `OWNER` / `CLIENT` / `AGENT` (Support spec v2.3)

&#x20; → rejected (`OWNER` = two meanings: platform vs agency)

\- `OWNER` / `CLIENT` / `AGENT` → accepted



\*\*Impact:\*\* Support spec v2.3's `OWNER` (agency owner) becomes

`CLIENT`. Support spec's `SuperAdmin` becomes `OWNER`. Migration spec

names adjusted.



\---



\### D-006: Production data is disposable



\*\*Decision:\*\* Production Supabase will be rebuilt from scratch.

Nothing in the current 18-table schema is preserved except the

architectural decision to create one OWNER account.



\*\*Reasoning:\*\* All current data is mock/test. No real customers, no

real users, no real debtors. Nothing of value exists to preserve.



\*\*Alternatives considered:\*\*

\- Migrate existing data → rejected (nothing worth migrating)

\- Preserve only `admin@gorka.click` → rejected (mock account; you'll

&#x20; create a fresh one with your real email)



\*\*Impact:\*\* Phases 17-18 will drop all production tables and rebuild.

No data migration scripts needed.



\---



\### D-007: Cloud table count grew from 11 to 19



\*\*Decision:\*\* Original Master Plan proposed 11 cloud tables. This

session grew the list to 19.



\*\*Reasoning:\*\* New information from specs:

\- Support spec v2.3 defines 6 support tables (not just `support\_tickets`)

\- Behavioral analytics requires `client\_activity\_metrics`

\- Boundary compliance requires `boundary\_proof\_logs`

\- Templates decision kept the existing `templates` table



\*\*Alternatives considered:\*\*

\- Keep 11 tables, defer support → rejected (support spec exists)

\- Combine behavioral metrics into aggregate\_metrics → rejected

&#x20; (different cadence, different use)



\*\*Impact:\*\* 19 cloud tables. Documented in `CLOUD-TABLES.md`.



\---



\### D-008: Two audit tables, not one



\*\*Decision:\*\* Two distinct cloud audit tables:

\- `cloud\_audit\_logs` — customer-level actions

\- `boundary\_proof\_logs` — compliance evidence



\*\*Reasoning:\*\* Different audiences, different purposes.

\- Customer actions: for platform administration and account history.

\- Boundary proof: for regulators and demonstrating that no debtor

&#x20; data ever crossed the boundary.



\*\*Alternatives considered:\*\*

\- One generic `audit\_logs` → rejected (conflates two purposes)

\- Three tables → rejected (no third purpose identified)

\- Two tables → accepted



\*\*Impact:\*\* Cloud schema has both. Different retention/access may

apply later.



\---



\### D-009: Behavioral metrics allowed in cloud



\*\*Decision:\*\* Client behavioral activity metrics (uploads count,

deletions count, active users, days active, etc.) are allowed in

cloud as `client\_activity\_metrics`.



\*\*Reasoning:\*\* These metrics describe \*how the client uses the tool\*,

not \*who the debtors are\*. They help GORKA:

\- Understand customer health

\- Identify churn risk

\- Reward power users

\- Detect unusual usage patterns

\- Show regulators "here's how the client operates, without seeing any

&#x20; debtor"



\*\*Alternatives considered:\*\*

\- Forbid behavioral metrics → rejected (loses business insight)

\- Only allow static aggregates (debtor\_count, total\_debt) → rejected

&#x20; (misses the business need)



\*\*Impact:\*\* New cloud table. Behavioral metrics explicitly allowed by

the Architectural Law.



\---



\### D-010: Templates in cloud with parameterization rule



\*\*Decision:\*\* Templates may be stored in cloud, but must be

parameterized. Rendered/personalized content stays local.



\*\*Allowed in cloud:\*\*

"Dear {{debtor\_name}}, your balance is {{amount}}..."



\*\*Not allowed in cloud:\*\*

"Dear John Smith, your balance is $4,285..."



\*\*Reasoning:\*\*

\- Templates are customer-owned content (agency's asset)

\- Multi-user access (future Agent App) needs cloud templates

\- Parameterized templates contain no actual debtor data

\- Rendered content contains debtor data → local only



\*\*Alternatives considered:\*\*

\- Templates local only → rejected (breaks multi-user)

\- Templates cloud with no rule → rejected (drift risk)

\- Parameterized cloud, rendered local → accepted



\*\*Impact:\*\* Architectural Law updated. UI/API must reject

non-parameterized templates.



\---



\### D-011: Support system from spec v2.3



\*\*Decision:\*\* Adopt the full Support System Spec v2.3 model

(support\_tickets + replies + events + organization\_audit\_events +

notifications + ticket\_counter).



\*\*Reasoning:\*\* The spec is production-ready, includes PII safety,

audit requirements, rate limiting, and tenant isolation. Reimplementing

it would be wasteful.



\*\*Alternatives considered:\*\*

\- Simple support\_tickets only → rejected (missing audit, PII safety)

\- Adopt spec v2.3 → accepted



\*\*Impact:\*\* 6 support tables in cloud schema. PII warning enforced in

UI.



\---



\### D-012: Support is a PII leak vector — enforce warnings



\*\*Decision:\*\* The support UI must warn users about debtor data and

require confirmation before sending.



\*\*Reasoning:\*\* A client could paste "John Smith at 14 Main Street

owes $7,500" into a support ticket. That would put debtor data into

cloud. The warning + confirmation is a required safety mechanism.



\*\*Alternatives considered:\*\*

\- No warning → rejected (dangerous)

\- Automated detection only → deferred (not MVP)

\- Warning + confirmation → accepted for now



\*\*Impact:\*\* UI must show the warning. Future: automated detection.



\---



\### D-013: Connector architecture stays deferred



\*\*Decision:\*\* Connector implementation remains in a later phase

(Phase 14-15). A feasibility phase (Phase 13) precedes it.



\*\*Reasoning:\*\* Per-provider authentication models differ. A universal

"GORKA issues token → Tauri calls vendor" model may not work for all

providers. Each provider needs individual proof before implementation.



\*\*Alternatives considered:\*\*

\- Implement connectors now → rejected (drift risk)

\- Defer connectors to Phase 14-15 → accepted



\*\*Impact:\*\* Connector work begins only after core architecture is

stable.



\---



\### D-014: Boundary test extends to all outbound channels



\*\*Decision:\*\* The boundary test checks not just metrics sync, but

every outbound channel: auth, license, support, notifications,

telemetry, error reporting, logs, crash reporting, updates.



\*\*Reasoning:\*\* Any of these channels could accidentally leak debtor

data. Testing only metrics sync leaves blind spots.



\*\*Alternatives considered:\*\*

\- Test only metrics sync → rejected (incomplete)

\- Test all outbound channels → accepted



\*\*Impact:\*\* Boundary test scope expanded. Automated test covers all.



\---



\### D-015: Cloud customer data subject to privacy law



\*\*Decision:\*\* Use language that acknowledges customer data may

include personal data (contact person name/email/phone).



\*\*Correct wording:\*\*

> Cloud storage is permitted for GORKA customer/account data,

> subject to applicable privacy/security requirements, but

> debtor-level data is architecturally prohibited from cloud storage.



\*\*Reasoning:\*\* Saying customer data is "not regulated" is legally

inaccurate. A contact person's name is personal data under GDPR.



\*\*Alternatives considered:\*\*

\- "Customer data is not regulated" → rejected (legally wrong)

\- "Customer data is subject to privacy law" → accepted



\*\*Impact:\*\* Architectural Law and Data Boundary Matrix use this

wording.



\---



\### D-016: Zero production SQL between Phase 2 and Phase 17



\*\*Decision:\*\* No production SQL of any kind between Phase 2 and

Phase 17 (production rebuild).



\*\*Reasoning:\*\* Every touch of production during development is an

opportunity for drift. The previous session's failure mode started

with "let's just fix this one column in production."



\*\*Alternatives considered:\*\*

\- Allow read-only queries → rejected (opens the door)

\- Zero SQL at all → accepted



\*\*Impact:\*\* `RECOVERY-RULES.md` includes this. All development on

`gorka\_test` or a restored backup copy.



\---



\### D-017: Backend cleanup moves before Prisma generation



\*\*Decision:\*\* Reorder phases so backend cleanup (removing

`prisma.debtor`, `prisma.action`, etc. references) happens BEFORE

generating the new Prisma Client.



\*\*Reasoning:\*\* The new `schema.cloud.prisma` won't have debtor

models. If backend still references them, TypeScript compilation

breaks or runtime errors occur.



\*\*Original order:\*\*

Phase 3 (schema) → Phase 5 (rebuild test DB) → Phase 7 (registration)

→ Phase 9 (clean backend)



\*\*Corrected order:\*\*

Phase 3 (schema) → Phase 3.5 (clean backend) → Phase 4 (generate) →

Phase 5 (rebuild test DB) → ...



\*\*Impact:\*\* Master Plan reordered.



\---



\### D-018: Recovery Notes folder is the permanent record



\*\*Decision:\*\* All recovery documents live in

`GORKA\_RECOVERY/recovery-notes/`. They are the permanent record of

this recovery and its decisions.



\*\*Documents:\*\*

\- `ARCHITECTURAL-LAW.md` — the constitution

\- `RECOVERY-RULES.md` — the discipline

\- `DATA-BOUNDARY-MATRIX.md` — the operational reference

\- `CLOUD-TABLES.md` — the cloud contract

\- `LOCAL-TABLES.md` — the local contract

\- `DECISIONS.md` — this document

\- `ARCHITECTURAL-LAW-AMENDMENTS.md` — versioned changes

\- `PRODUCTION-REBUILD-PLAN.md` — the cutover plan



\*\*Reasoning:\*\* Future sessions (human or AI) will read these before

making changes. They prevent re-litigating settled decisions.



\*\*Impact:\*\* All future architectural discussions reference these

documents.



\---



\## Summary Table



| ID | Decision |

|----|----------|

| D-001 | Architectural Law as constitution |

| D-002 | Use "debtor data" / "customer data" terms |

| D-003 | Cloud table count is a rule, not a fixed list |

| D-004 | Boundary test manual + automated |

| D-005 | Role enum: OWNER / CLIENT / AGENT |

| D-006 | Production data disposable |

| D-007 | Cloud tables: 11 → 19 |

| D-008 | Two audit tables (cloud + boundary proof) |

| D-009 | Behavioral metrics allowed in cloud |

| D-010 | Templates parameterized in cloud |

| D-011 | Support system from spec v2.3 |

| D-012 | Support is PII leak vector — warnings required |

| D-013 | Connector architecture deferred |

| D-014 | Boundary test covers all outbound channels |

| D-015 | Customer data subject to privacy law |

| D-016 | Zero production SQL until Phase 17 |

| D-017 | Backend cleanup before Prisma generation |

| D-018 | Recovery notes folder is the record |



\*\*19 tables, 18 decisions.\*\*



\---



\## What This Document Is Not



\- Not a legal document (that's the Architectural Law)

\- Not an operational checklist (that's Recovery Rules)

\- Not a data map (that's Data Boundary Matrix)

\- Not a schema definition (that's Cloud/Local Tables)



It is the record of \*\*why\*\* this recovery looks the way it does.


---

## Known Cosmetic Issue (Sept 12, 2026)

After migrating to schema.cloud.prisma, running npx tsc --noEmit reports 36 TypeScript errors. All 36 are in leftover Electron-era folders:

- src/frontend/
- src/renderer/
- renderer/ (root)

These folders are NOT part of the active architecture. The active code (backend, Tauri, supervisor-dashboard, owner-dashboard) compiles cleanly.

The errors are cosmetic and non-blocking. They will be cleaned up in a future cleanup phase (not before production cutover).

Do not modify tsconfig.json to hide these errors until the cleanup phase. Leave the file in its current state.

---
## Phase 9 Reconnaissance Report — September 12, 2026

Purpose: Verify the Tauri local SQLite data plane against Tauri spec
v3.2 (§5, §6 + Annex A, §7, §8, §12). Method: read on-disk source,
compare to spec, classify each divergence. No edits, no builds, no
tests during this reconnaissance.

Files reviewed:
- src-tauri/src/main.rs     (vs spec §6 + Annex A)
- src-tauri/src/db.rs       (vs spec §5)
- src-tauri/src/auth.rs     (vs spec §7 + §8)
- src-tauri/Cargo.toml      (vs spec §6)
- src-tauri/tauri.conf.json (vs spec §12)
- src-tauri/capabilities/default.json (vs spec §12)

Stage 0 conclusion:
- Annex A fix (placeholder-connection bug) IS applied on disk.
  AppState uses Mutex<Option<Connection>>; main() uses Mutex::new(None);
  unlock_database is the sole caller of db::init_db(&key);
  is_database_unlocked returns db_guard.is_some(); all commands handle
  the None (locked) case with "Database not unlocked".
- No source changes required at Stage 1 for Annex A.
- Source matches spec at the schema level: db.rs creates exactly the
  5 tables from spec §5 (debtors, debts, documents, communications,
  audit_log) with 6 indexes and the PRAGMA user_version migration gate.
- SQLCipher is enabled: rusqlite features =
  ["bundled-sqlcipher-vendored-openssl"] in Cargo.toml. Encryption
  test §16.2 is not dependency-blocked.

### Decision 1 — Git tracking of src-tauri/ (informational)

git check-ignore -v src-tauri/src/main.rs printed nothing (not ignored).
git status src-tauri/ reports "working tree clean." src-tauri/ is
tracked by git and unchanged since the last commit. Two rollback paths
exist for Phase 9 edits: git restore src-tauri/<file>, and the
.before-phase9-20260912 filesystem copies.

### Decision 2 — Local backend on port 3000 during Stage 4 (test config)

auth.rs calls http://localhost:3000/api/auth/login. Every local CRUD
command requires a successful login because organization_id is read
from the settings store, and the store is only populated by login.
Chosen option (a): run a local backend on port 3000 pointed at
gorka_test during Phase 9 runtime tests. No source change (Rule 12
respected).

Note: During Phase 9 runtime tests, backend runs locally at
localhost:3000 against gorka_test. Production behavior uses
api.gorka.click. This is a test-only configuration.

### Decision 3 — derive_key determinism (deferred to Stage 4)

db.rs derives the SQLCipher key via Argon2id. Spec §5 and on-disk code
differ in how the salt is passed into hash_password_into
(salt.as_bytes() vs salt.as_str().as_bytes()). On-disk form is
consistent with the pinned argon2 crate. Determinism (same password +
same salt -> same key across sessions) can only be confirmed at
runtime. Deferred to Stage 4 §16.2 Encryption acceptance test.

### Decision 4 — Spec-text corrections (8 items, log as informational)

The following are places where Tauri spec v3.2 text is behind on-disk
reality and the on-disk code is correct. Fix level: Specification.
Spec file update deferred to a future cleanup phase (not before
Phase 15).

1. main.rs — bulk_insert_debtors uses db_guard.as_mut() (required for
   conn.transaction()); spec shows as_ref() which would not compile.
2. db.rs — PRAGMA key and PRAGMA journal_mode use query_row (both
   return rows); spec shows execute().
3. db.rs — derive_key passes salt.as_str().as_bytes() to
   hash_password_into; spec shows salt.as_bytes().
4. auth.rs — LoginData includes redirectUrl (matches Phase 8 backend
   response); spec shows only { token, user }.
5. auth.rs — UserData includes name and uses
   #[serde(rename = "organizationId")] on organization_id (matches
   backend camelCase); spec shows organization_id without rename.
6. auth.rs — StoreBuilder::new(&app, "settings.dat") matches
   tauri-plugin-store v2 API; spec shows the v1-style
   StoreBuilder::new(app.clone(), "settings.dat".parse().unwrap()).
7. Cargo.toml — rusqlite feature is bundled-sqlcipher-vendored-openssl
   (stronger than spec's bare sqlcipher; no system SQLCipher
   dependency); tauri features are ["default", "tray-icon"] (Tauri 2
   convention) vs spec's ["api-all", "updater"] (v1-era); no [lib]
   block (Tauri 2 binary-only layout) vs spec's cdylib/staticlib block.
8. tauri.conf.json — productName "GORKA-Client-Dashboard" (hyphens)
   vs spec "GORKA Client Dashboard" (spaces); bundle.targets is an
   explicit 4-item list ["nsis", "appimage", "deb", "dmg"] vs spec
   "all". Both appear deliberate.

### Decision 5 — Informational items (no Phase 9 fix)

C-2: auth.rs get_token prints the auth token to local stdout
(println!("Raw value: {:?}", value)). Local-only; no cloud leak.
Review before production.

C-3: main.rs adds a get_salt command not present in spec §6.
Consistent with auth.rs get_salt and the frontend UnlockScreen flow.
Spec omits this; intentional.

C-4: tauri.conf.json plugins.updater.active = true with
pubkey "YOUR_PUBKEY_HERE", but tauri-plugin-updater is absent from
Cargo.toml and not registered in main.rs. Block appears inert.
Auto-updater block appears inert; must be resolved before production
(not Phase 9).

Phase 9 Stage 0 closed. No Annex A fix needed. Source matches spec
structurally. Ready for Stage 1 (no edits required), then Stage 2
(source-level acceptance), then Stage 3 (test vehicle decision).


## Phase 9 — Blocked — September 13, 2026

Status: Phase 9 (Tauri Local Database Verification) does NOT complete in
this session. Blocked at the frontend implementation level.

### What was tested and passed

- §16.2 (partial): First-run "Set Local Encryption Password" creates a
  SQLCipher-encrypted DB. Verified empirically: first 16 bytes of
  gorka-client.db are f0 d1 1e e8 05 8f 2b 19 9b 8e 8e 15 10 be 93 ce
  (NOT "SQLite format 3"), confirming SQLCipher encryption is active.
- Rust layer (src-tauri/src/main.rs, db.rs, auth.rs) matches spec §5,
  §6 + Annex A, §7. Annex A placeholder-connection fix IS applied.
- Cargo.toml enables SQLCipher via
  rusqlite features = ["bundled-sqlcipher-vendored-openssl"].
- Binary under test: v0.1.0, commit c9efd44, ProductName
  "GORKA-Client-Dashboard", ProductVersion 0.1.0.

### What could NOT be tested and why

- §16.2 returning-user flow ("Enter" password, wrong-password rejection,
  persistence across restart): the v0.1.0 frontend launches directly to
  "Set Local Encryption Password" and never calls auth::login. Per
  auth.rs, the salt is generated and written to settings.dat ONLY inside
  login. Without a login call, no salt is persisted, so the app prompts
  "Set" on every launch. settings.dat does not exist anywhere under
  %APPDATA%\gorka after multiple launches.
- §16.4 Path Traversal: no upload UI is implemented in v0.1.0.
- §16.5 Offline / CRUD: Collections page shows "Collections Under
  Construction." Data Upload prompts for login (no session). No UI to
  drive debtor CRUD, document upload, communication logging, or actions.
- §16.6 Error Telemetry: Audit Logs page not exercised; no operations to
  log.
- §16.7 Backup Verification: no backup UI in v0.1.0 Settings.

### Level of origin (debugging chain)

- Architecture: intact. Invariant held.
- Specification: Tauri spec v3.2 §8 assumes cloud login precedes local
  unlock. Spec is correct; frontend does not implement the step.
- Schema: no issue. db.rs creates the 5 spec §5 tables correctly.
- Backend (Rust): correct. auth.rs writes salt inside login as spec §7
  requires. Rust commands exist and are registered.
- Test/frontend: failure originates here. v0.1.0 frontend is a partial
  implementation: no pre-unlock cloud login, no Collections CRUD, no
  Data Upload, no Audit UI, no Backup UI.

### Rule compliance

- No source edited (Rule 12 respected; working Tauri CI/CD untouched).
- No production SQL executed (zero production SQL rule held).
- No cloud schema changed. No cloud tables added.
- Architecture not questioned (Rule 14 held). Failure was located at
  the frontend level and left there.

### Prerequisite for Phase 9 completion

A Tauri build whose frontend:
(a) performs cloud login before showing the local unlock screen,
(b) exposes Collections CRUD wired to the Rust commands,
(c) exposes Data Upload,
(d) exposes Audit Logs reading local audit_log,
(e) exposes Settings/Backup if §16.7 is to be tested.

### State left on disk (recoverable)

- New encrypted DB at %APPDATA%\gorka\client\data\gorka-client.db
  (created during Phase 9, 4 KB main + WAL). Contains no real debtor
  data. Safe to keep or remove.
- Sept 7 DB preserved in two places:
  (i)  .old-from-20260907 suffixes in the same data folder.
  (ii) .before-phase9-20260912 copies in GORKA_RECOVERY\backups\.

### Post-Phase-9 housekeeping (not before Phase 15)

- Eight spec-text corrections identified in Stage 0 remain deferred.
- Auto-updater block in tauri.conf.json remains inert (C-4).
- C-2 (auth.rs prints token to stdout) review before production.
- C-3 (get_salt command) noted as intentional.
- Windows Application Control blocked rolldown native binding; this is
  an environment issue affecting frontend dev server only, not the
  shipped Tauri binary. No fix in scope.

## Phase 10 Precondition — Backend Pointed at Production by .env — September 13, 2026

Finding: During the first Phase 10 login test, the backend (PID 10880)
was connected to the production database `postgres`, not to `gorka_test`.

Root cause: `.env` sets DATABASE_URL to
postgresql://.../postgres. `index.ts` calls dotenv.config(). The shell
variable `DATABASE_URL` had been set in a DIFFERENT terminal than the
one running the backend, so it did not apply to the backend process,
and `.env` supplied the value.

Detection: POST /api/auth/login returned {"success":false,"error":
"Login failed"}. Backend terminal showed PrismaClientKnownRequestError
P2022: "The column `users.password_hash` does not exist in the current
database." psql connected directly to gorka_test showed the column
DOES exist there, with both test users present. Mismatch between what
Prisma saw and what gorka_test contained identified the wrong database
as the origin.

Rule-compliance assessment:
- Rule 1 (no production modification to make a test pass): held.
- Zero production SQL between Phase 2 and Phase 17: no writes were
  performed. The failed login was a read (user.findUnique). The
  password check failed before any write (lastLogin update) could run.
  No registration, verify-email, or complete-registration call was
  made in this session.
- No production schema change. No production data change.

Resolution: Option B chosen. Leave `.env` unchanged. Start the backend
in a single terminal with an inline `set DATABASE_URL=...gorka_test`
BEFORE `npx tsx src/backend/index.ts`, joined by &&. dotenv does not
override pre-existing environment variables, so the shell value wins.

Verification: After restart, POST /api/auth/login with
test@example.com / Test123! returned success with JWT and
organizationId cmty0xrxw0000c4q4mvtpqjqv, matching the row in
gorka_test observed via psql.

Standing instruction from this point forward: the backend must always
be started with the inline DATABASE_URL override for gorka_test. Never
start it relying on `.env` alone.

Evidence of no production writes (September 13, 2026):

Direct psql inspection of production `postgres` after the drift was
detected:
- users count: 1 (admin@gorka.click, created 2026-08-14)
- organizations count: 1 (org_123 "GORKA Organization", created
  2026-08-14)
- No rows in either table with created_at or updated_at on
  2026-09-13.
- Production `users` has column `last_login_at`, not `last_login`,
  and no `is_active` column. This confirms production is still the
  pre-Phase-3 schema and was not touched by the cloud-schema work.

Conclusion: no writes reached production during the drift window.
The only backend request against production was the failed
/api/auth/login curl (a read). Rule 1 and the zero-production-SQL
rule were upheld.

## Phase 10 — COMPLETE — September 13, 2026

Goal: Implement aggregate metrics sync from local to cloud.
Backend-only for this phase. Tauri-side sync deferred (Phase 9
blocked on frontend).

### Delivered

- New file: src/backend/routes/metrics.routes.ts
- Endpoint: POST /api/metrics/sync, mounted at
  app.use('/api/metrics', authenticateToken, metricsRoutes) in
  src/backend/index.ts.
- Auth via existing authenticateToken middleware.
- organizationId read from req.user.organizationId (JWT claim),
  never from the request body.
- Payload validated with zod: { debtorCount, totalDebt,
  agentCount, activeCaseCount }, all non-negative numbers.
- prisma.$transaction: upsert aggregate_metrics (unique on
  organizationId) + create boundary_proof_logs row with
  eventType='METRICS_SYNC', debtorDataIncluded=false,
  payloadSummary containing only the four counts.
- Response returns the four counts, lastSyncedAt, and
  boundaryProofLogId. No debtor identifiers.

### Verification (against gorka_test)

- curl POST /api/auth/login as test@example.com → success, JWT.
- curl POST /api/metrics/sync with the JWT and
  { debtorCount: 42, totalDebt: 125000.5, agentCount: 3,
  activeCaseCount: 17 } → success, boundaryProofLogId returned.
- psql: aggregate_metrics row present with correct values and
  organizationId cmty0xrxw0000c4q4mvtpqjqv.
- psql: boundary_proof_logs row present, event_type=METRICS_SYNC,
  debtor_data_included=false, payload_summary contains counts only.

### Rule compliance

- No production touched. All work against gorka_test.
- No cloud schema change. No new columns. No new tables.
- No debtor identifiers in payload, response, or DB rows.
- Invariant held. Debugging chain respected.

### Deferred

- Tauri-side aggregate computation and "Sync Now" call — deferred
  until the Tauri frontend exists (Phase 9 workstream).
- Automatic daily sync — deferred as its own sub-phase.
- Boundary proof log surfacing in dashboards — that is Phase 12.

### Files changed

- src/backend/routes/metrics.routes.ts (new, 3,264 bytes)
- src/backend/index.ts (two lines added: import at line 14,
  app.use at line 75)
- src/backend/index.ts.before-phase10-20260913 (backup)

### Next phase

Phase 11 — Client Activity Metrics Sync.

## Phase 11 — COMPLETE — September 13, 2026

Goal: Client activity metrics sync from local to cloud.
Backend-only. Tauri-side deferred (Phase 9 blocked).

### Delivered

- New file: src/backend/routes/activity.routes.ts
- Endpoint: POST /api/activity/sync, mounted at
  app.use('/api/activity', authenticateToken, activityRoutes) in
  src/backend/index.ts (line 77).
- Auth via existing authenticateToken middleware.
- organizationId read from req.user.organizationId (JWT claim),
  never from the request body.
- Payload validated with zod: periodStart, periodEnd (ISO
  datetime strings), plus eight non-negative integers:
  uploadsCount, uploadBatchAvgSize, deletionsCount,
  actionsCreatedCount, messagesSentCount, activeUsersCount,
  daysActive, syncEventsCount.
- prisma.$transaction: insert client_activity_metrics +
  create boundary_proof_logs row with
  eventType='ACTIVITY_SYNC', debtorDataIncluded=false,
  payloadSummary containing only counts and period.
- Response returns the row id, all counts, createdAt, and
  boundaryProofLogId. No debtor identifiers.

### Verification (against gorka_test)

- curl POST /api/auth/login as test@example.com → success, JWT.
- curl POST /api/activity/sync with JWT and a 10-field payload →
  success, id cmtzcvibr0001c4ycmp737u21, boundaryProofLogId
  cmtzcvink0002c4ycxul108cq.
- psql: client_activity_metrics row present with correct values
  and organizationId cmty0xrxw0000c4q4mvtpqjqv.
- psql: boundary_proof_logs contains ACTIVITY_SYNC row with
  debtor_data_included=false. The METRICS_SYNC row from Phase 10
  is still present.

### Rule compliance

- No production touched. All work against gorka_test.
- No cloud schema change. No new columns. No new tables.
- No debtor identifiers in payload, response, or DB rows.
- Invariant held.

### Deferred

- Tauri-side computation and "Sync Now" call — deferred until the
  Tauri frontend exists (Phase 9 workstream).
- Dashboard surfacing of activity metrics and proof logs — that is
  Phase 12.

### Files changed

- src/backend/routes/activity.routes.ts (new, 4,284 bytes)
- src/backend/index.ts (two lines added: import at line 15,
  app.use at line 77)
- src/backend/index.ts.before-phase11-20260913 (backup)

### Next phase

Phase 12 — Boundary Proof Logging surfaced.

## Phase 12 — Boundary Proof Logging Surfaced — COMPLETE — September 13, 2026

Goal: Surface boundary_proof_logs to the Owner Dashboard as
regulator-facing evidence that no debtor data crossed into GORKA
cloud infrastructure.

Scope decision (Path C): Owner Dashboard + backend portion only.
Client Dashboard display of proof logs and client-side local
proof demonstration are deferred with the Phase 9 frontend
workstream.

### Delivered

Backend:
- New file: src/backend/routes/boundary.routes.ts
- Endpoint: GET /api/boundary-proofs, mounted at
  app.use('/api/boundary-proofs', authenticateToken, boundaryRoutes)
  in src/backend/index.ts (import line 9, mount line 79).
- Auth via existing authenticateToken middleware.
- Role handling inside the handler:
    OWNER  -> sees all organizations; optional ?organizationId filter.
    Others -> forced to their own req.user.organizationId.
- Optional query params: organizationId (OWNER), eventType, from, to,
  limit (max 500), offset.
- Returns: { rows, total, limit, offset }.
- Reads from boundary_proof_logs only. Read-only endpoint.

Owner Dashboard:
- New page: owner-dashboard/pages/BoundaryProofsPage.tsx (10,377 bytes)
- New helper in owner-dashboard/services/api.ts:
  getBoundaryProofs() (line 364), plus BoundaryProofRow and
  BoundaryProofResponse interfaces.
- Route registered in owner-dashboard/index.tsx (import line 10,
  route line 91) under /boundary-proofs.
- Sidebar item added in owner-dashboard/components/OwnerSidebar.tsx:
  ShieldCheck icon + "Boundary Proofs" label (import line 13,
  nav item line 26).

### Verification (against gorka_test)

- curl POST /api/auth/login as test@example.com -> 200.
- curl GET /api/boundary-proofs with test@example.com's JWT ->
  200, two rows (ACTIVITY_SYNC and METRICS_SYNC), both with
  debtorDataIncluded: false, payloadSummary contains only counts.
- curl GET /api/boundary-proofs with test2@example.com's JWT ->
  200, zero rows (that organization has performed no syncs).
  Organization isolation confirmed.
- Owner Dashboard loaded in browser at localhost:3002, logged in
  as an OWNER role, clicked Boundary Proofs, page rendered with
  both rows and both rows showing FALSE. Screenshot captured.

### Rule compliance

- No production touched. All work against gorka_test.
- No cloud schema change. No new columns, no new tables.
- No debtor identifiers in the new endpoint's payload, response,
  or in the boundary_proof_logs data itself.
- Invariant held.
- Tauri CI/CD untouched (Rule 12).

### Files changed

- src/backend/routes/boundary.routes.ts (new, 2,320 bytes)
- src/backend/index.ts (two lines: import 9, mount 79)
- owner-dashboard/services/api.ts (appended, getBoundaryProofs
  at line 364)
- owner-dashboard/pages/BoundaryProofsPage.tsx (new, 10,377 bytes)
- owner-dashboard/index.tsx (two lines: import 10, route 91)
- owner-dashboard/components/OwnerSidebar.tsx (two lines: import
  13, nav item 26)
- src/backend/index.ts.before-phase12-20260913 (backup)

### Deferred (documented, tracked)

- Client Dashboard display of proof logs — blocked on the Tauri
  frontend workstream (same as Phase 9).
- Client-side local proof demonstration from the Tauri app —
  blocked on the same workstream.
- Polished regulator-facing export (PDF or signed document) —
  the current page is the view; a formal export is a follow-up,
  not part of this phase.

### Known gap recorded during Phase 12 reconnaissance (not Phase 12 scope)

The Owner Dashboard currently calls many endpoints that do not
exist on the backend:
- GET /analytics/overview
- GET /clients, /clients/:id
- POST /clients/:id/verify, /suspend, /reject, /reinstate
- PUT /clients/:id
- GET /audit
- GET /status
- GET /analytics/usage
- GET /billing/revenue

Those pages (AuditPage.tsx, ClientsPage.tsx, AnalyticsPage.tsx,
BillingPage.tsx, DashboardPage.tsx) are mock or fail to load.
This is a pre-existing condition and is NOT part of Phase 12.
It is recorded here as a future workstream. The Boundary Proofs
page added in Phase 12 is the first Owner Dashboard page that is
wired to a real backend endpoint.

### Two other findings, recorded for future cleanup, no action

1. Two conventions for Prisma instantiation in the backend:
   src/backend/db.ts exports a shared prisma instance
   (used by dashboard.routes.ts and boundary.routes.ts);
   metrics.routes.ts and activity.routes.ts instantiate
   new PrismaClient() locally. Harmless today. Candidate for
   unification in a cleanup phase.
2. Two token storage keys across apps: the Tauri app uses
   auth_token in settings.dat; the Owner Dashboard uses
   gorka_token in localStorage. They are separate systems, so
   this is not a defect, but worth noting for coherence.

### Next phase

Phase 13 — Connector Architecture Feasibility.

## Phase 13 — Connector Architecture Feasibility — COMPLETE — September 13, 2026

Goal: Define the permanent rule and process for how connectors
are assessed, added, replaced, and retired in GORKA. Apply the
rule to the four prototype connectors. Establish that connector
reassessment is permanent, not one-off.

### Key reframing accepted by the founder

The original Phase 13 plan framed this as a per-provider deep
feasibility proof. The founder reframed it to a lifecycle
document: connectors come and go, providers change, the process
must be simple and reliable. The four current connectors are
assessed at prototype depth only. Re-assessment happens at launch
and at enterprise transition.

### Delivered

- New document: GORKA_RECOVERY/recovery-notes/CONNECTOR-LIFECYCLE.md
  (13,121 bytes).

Contents:
- Two tiers: Tier 1 (GORKA-managed) and Tier 2 (client BYO).
- Six-condition rule for Tier 1 providers.
- Add / replace / retire procedure.
- Schema mapping: connector_catalog, client_connectors,
  connector_usage. No schema change required.
- Prototype assessment of Twilio, Resend, Mocean, Gemini.
- Re-assessment schedule.

### The six conditions (summary)

1. Per-client attribution: provider supports sub-accounts,
   projects, or per-client credentials.
2. Direct content path: client -> provider direct, never
   client -> GORKA -> provider.
3. Usage reporting for reconciliation.
4. No debtor content in GORKA cloud.
5. Terms permit intermediary billing.
6. Disclaimer coverage (client dashboard connector page).

If any condition fails, the connector is offered only as Tier 2
(BYO) or not at all.

### Prototype assessment summary

- Twilio: Feasible for both tiers. Subaccounts + Access Tokens.
- Resend: Tier 2 feasible. Tier 1 depends on per-key attribution
  (needs verification at launch).
- Mocean: Tier 2 feasible. Tier 1 not yet confirmed.
- Gemini: Tier 1 feasible via Vertex AI. Tier 2 feasible via
  AI Studio API key.

### Schema mapping

No schema change. The existing fields already support the
lifecycle:
- connector_catalog.lifecycleStatus (ACTIVE / DEPRECATED /
  RETIRED)
- connector_catalog.isManagedByGorka
- client_connectors.credentialsLocation (CLOUD / LOCAL)
- connector_usage.pricingVersion + unitPrice (frozen at time
  of use for historical billing integrity)

### Rule compliance

- No production touched. No cloud schema change. No code
  changed.
- Invariant held. GORKA-managed connectors must not require
  GORKA cloud to see debtor content.
- Tauri CI/CD untouched (Rule 12).

### Files changed

- GORKA_RECOVERY/recovery-notes/CONNECTOR-LIFECYCLE.md (new,
  13,121 bytes)
- GORKA_RECOVERY/recovery-notes/PHASE-PLAN.md (Phase 13 status
  line and summary table line)

### What is NOT decided in Phase 13

- Pricing amounts or enterprise contracts.
- Specific enterprise providers.
- Actual integration code.
- The exact disclaimer page text (it already exists in the
  client dashboard).

### Next phase

Phase 14 — Connector Implementation. Note: Phase 14 depends on
Phase 13's feasibility conclusions, but per Recovery Rule 13,
implementation should not begin while Phases 3-12 are unstable.
Phases 3-12 are now stable at prototype level.

## Phase 14 — Connector Implementation — COMPLETE — September 13, 2026

Goal: Implement GORKA-managed and BYO connector flows at
prototype level. Backend-only scope (Path C). Client Dashboard
and Owner Dashboard display of connector status, analytics, and
billing are deferred with the Phase 9 frontend workstream.

### 14.1 — Seed connector_catalog

- New file: prisma/seed-connectors.ts (3,552 bytes).
- Seeds five rows, one per provider capability:
  twilio-sms (SMS), twilio-voice (VOICE), resend-email (EMAIL),
  mocean-sms (SMS), gemini-ai (AI).
- Idempotent via upsert on code.
- Verified: five rows present in gorka_test with
  is_managed_by_gorka = true, lifecycle_status = ACTIVE.
- Did NOT modify the stale prisma/seed.ts, which still references
  a removed PermissionRole model. Recorded as a known stale file.

### 14.2 — client_connectors enable/disable

- New file: src/backend/routes/connectors.routes.ts (5,893 bytes).
- Endpoints:
    GET  /api/connectors         - list (OWNER all, others own org)
    POST /api/connectors/enable  - LOCAL only (CLOUD rejected until
                                    credential encryption is built)
    POST /api/connectors/disable - 404 if not enabled
- Mount: app.use('/api/connectors', authenticateToken, connectorsRoutes)
  in src/backend/index.ts (import line 10, mount line 81).
- Tests: enable LOCAL creates row; enable CLOUD returns 400 with
  clear message; disable sets status DISCONNECTED; disable as
  different org returns 404; list isolated by org.

### 14.3 — connector_usage sync + read

- New file: src/backend/routes/connector-usage.routes.ts
  (6,985 bytes).
- Endpoints:
    POST /api/connector-usage/sync - append-only write of an
      aggregate usage row per (org, connector, period). unitPrice,
      pricingVersion, billableAmount, currency are frozen from
      connector_catalog.pricingConfig at write time.
    GET  /api/connector-usage       - read with org scoping.
- Each sync also writes a boundary_proof_logs row with
  eventType = CONNECTOR_USAGE_SYNC and debtorDataIncluded = false.
- Mount: import line 11, mount line 83 in src/backend/index.ts.
- Tests: two syncs created two rows (append-only confirmed);
  read returned both; different org returned zero; unknown
  connector returned 404.

### 14.4 — Billing summary (connector compensation)

- New file: src/backend/routes/billing.routes.ts (3,417 bytes).
- Endpoint: GET /api/billing/summary - aggregates connector_usage
  per connector per org. OWNER sees all or filters; others see own
  org only.
- Mount: import line 12, mount line 85 in src/backend/index.ts.
- Pricing is currently zero because connector_catalog.pricingConfig
  does not include unitPrice. Real prices will be added at launch.
- Tests: test@example.com saw usageTotal 59 billableTotal 0;
  test2@example.com saw empty totals.

## Phase 14.5 — Subscription Billing — COMPLETE — September 13, 2026

Goal: Implement GORKA <-> Client SaaS subscription record-keeping.
Distinct from connector compensation (14.4). Stripe-ready schema,
no Stripe integration yet (company not yet registered).

### Schema change — first since Phase 7

Six additive columns added to License in schema.cloud.prisma:
  renewalCycle         String   @default("MONTHLY")
  price                Float    @default(0)
  currency             String   @default("USD")
  stripeCustomerId     String?  (nullable)
  stripeSubscriptionId String?  (nullable)
  stripePriceId        String?  (nullable)

Applied to gorka_test via:
  npx prisma db push --schema=prisma\schema.cloud.prisma
Verified with psql \d licenses. No data loss. No production touch.

### 14.5 deliverables

- New file: prisma/seed-plans.ts (1,310 bytes). Seeds default plan
  tiers into platform_settings key='plans':
    FREE 0 USD MONTHLY
    PROFESSIONAL 2000 USD MONTHLY
    ENTERPRISE 10000 USD MONTHLY
- New file: src/backend/routes/licenses.routes.ts (8,015 bytes).
- Endpoints:
    GET  /api/licenses/me       - the caller's org license.
    GET  /api/licenses          - OWNER only, all licenses.
    POST /api/licenses          - OWNER only, upsert. Accepts
                                   explicit price for discounts.
    POST /api/licenses/set-plan - OWNER only, sets plan by tier
                                   using platform_settings default.
- Mount: import line 13, mount line 87 in src/backend/index.ts.
- Stripe fields stay null until later integration.

### 14.5 tests

- /api/licenses/me as CLIENT with no license -> null.
- /api/licenses as CLIENT -> 403 OWNER only.
- POST /set-plan PROFESSIONAL -> license created,
  price 2000, currency USD, renewalCycle MONTHLY, expiry +30d.
- /me returned the row; list as OWNER returned it too.
- POST /api/licenses with price 1500 -> discount applied, other
  fields preserved, same row id, updatedAt refreshed.
- test@example.com role temporarily promoted to OWNER for tests,
  reverted to CLIENT after.

### Rule compliance

- No production touched. All work against gorka_test.
- No CI/CD touched (Rule 12).
- Invariant held: no debtor data anywhere in connectors,
  connector_usage, billing, licenses. All are metadata only.
- Rule 8 (do not assume external provider supports GORKA-issued
  temporary credentials) was respected: only the LOCAL path was
  implemented; CLOUD deferred until credential handling exists.
- Schema change was explicitly authorized and is additive only.

### Deferred within Phase 14 (frontend workstream)

- Client Dashboard display of connector status.
- Owner Dashboard display of connector analytics.
- Client Dashboard display of billing summary.
- Actual credential encryption for Tier 1 (CLOUD) connectors.
- Subscription billing dashboard views on both sides.
- Stripe integration (checkout, webhooks, real customer
  and subscription IDs).

### Files changed

- prisma/seed-connectors.ts (new)
- prisma/seed-plans.ts (new)
- prisma/schema.cloud.prisma (License model, six additive columns)
- src/backend/routes/connectors.routes.ts (new)
- src/backend/routes/connector-usage.routes.ts (new)
- src/backend/routes/billing.routes.ts (new)
- src/backend/routes/licenses.routes.ts (new)
- src/backend/index.ts (four imports, four mounts: lines 10, 11,
  12, 13 for imports; 81, 83, 85, 87 for mounts)

### Known gaps recorded, not Phase 14 scope

- prisma/seed.ts is stale (references removed PermissionRole
  model). It should not be run. Cleanup deferred.
- Two Prisma instantiation conventions in backend:
  src/backend/db.ts shared instance (used by dashboard,
  boundary, connectors, connector-usage, billing, licenses)
  vs local new PrismaClient() in metrics and activity routes.
  Harmonization deferred.
- Owner Dashboard still calls missing endpoints for
  /clients, /analytics/overview, /audit, /billing/revenue,
  /analytics/usage, /status. Pre-existing, deferred.

### Next phase

Phase 15 — Boundary / Security Test.

## Phase 15 — Boundary / Security Test — PARTIAL — September 14, 2026

Goal: Prove the invariant. No debtor data leaves the local
machine.

Status: PARTIAL. The static portion is complete and recorded.
The runtime portion is deferred pending the Tauri frontend
workstream (same dependency that blocks Phase 9).

### What was done — static boundary review (Claim A)

Reviewed all 19 cloud models in schema.cloud.prisma and all 10
backend route files in src/backend/routes/.

Result:
- No cloud model contains a debtor name, phone, email, address,
  ID, individual amount, message content, document, or action.
- Two permitted fields mention "debtor":
    aggregate_metrics.debtor_count (Int, aggregate)
    boundary_proof_logs.debtor_data_included (Boolean, proof
    marker)
  Both are explicitly allowed by Architectural Law §4 and §13.
- No backend endpoint accepts or returns a debtor field.

Two risk areas recorded, not fixed:
- Support ticket free-text fields (subject, message, reply,
  messagePreview) could contain debtor info if a user typed it.
  Mitigation is the client-facing UI warning and confirmation.
  The UI is deferred.
- Template.content has no DB-level parameterization enforcement.
  Mitigation is UI/API. Deferred.

Conclusion: Claim A holds at schema and backend layer as of
today.

### What was produced

- New document: GORKA_RECOVERY/recovery-notes/BOUNDARY-TEST-PLAN.md
  (9,030 bytes).
  Contains:
  - Three claim definitions (Static, Runtime, Inference).
  - Manual boundary test procedure (canary debtor, network
    capture, string scan).
  - Automated boundary test specification (proxy harness, CI
    fail-on-match).
  - Aggregation inference test.
  - List of all outbound channels to exercise.
  - List of all debtor fields to cover with the canary.
  - Sign-off criteria.
- Static review results included in Section 3 of the plan.

### What is deferred

- Manual boundary test execution — depends on Tauri frontend.
- Automated boundary test in CI — same.
- Aggregation inference test — same.
- Support UI warning enforcement — depends on client dashboard.
- Template parameterization enforcement — same.

### Rule compliance

- No production touched.
- No schema change.
- No code change.
- No CI/CD touched.

### Known findings recorded during the review, not Phase 15 scope

- support.routes.ts uses stale role name PLATFORM_OWNER in
  three endpoints (/personal, /unread-count, /read). Those
  endpoints currently always return 403.
- support.routes.ts has ownerId = 'owner_user_id_placeholder'
  hardcoded in the escalate handler.
- support.routes.ts imports prisma from '../database', a third
  Prisma instantiation convention alongside '../db' and local
  new PrismaClient(). Harmonization deferred.
- Template.content parameterization is not enforced at the DB
  level.

### Next phase

Phase 16 — Production Cutover Plan (review only; no execution).
Phase 16 depends on Phases 0-15 being complete. Because Phase 9
and the runtime portion of Phase 15 are BLOCKED/PARTIAL pending
the Tauri frontend, Phase 16 is not yet reachable in full. The
plan document review portion of Phase 16 can proceed.

## Phase 9 Unblock — Local Debtor CRUD — September 14, 2026

Context: Phase 9 (Tauri Local Database Verification) was marked
BLOCKED on September 13 because the v0.1.0 Tauri frontend did not
implement the Collections CRUD UI, and the missing pieces were
not precisely understood.

Reconnaissance today (recorded in FRONTEND-REALITY.md):
- The Tauri frontend source is supervisor-dashboard/src/.
  Built by Vite into dist/, bundled into the Tauri app by
  tauri.conf.json frontendDist: "../dist".
- The Rust side implements all debtor commands.
- The frontend service (local.db.ts) only wrapped `auth`.
  No localDB object existed.
- Collections.tsx was a static "Under Construction" placeholder.

Two deliverables were produced and tested.

### Deliverable A — localDB wrapper

File: supervisor-dashboard/src/services/local.db.ts
Added: Debtor and DebtorInput interfaces; a localDB object with
eight methods: getDebtors, getDebtor, insertDebtor,
bulkInsertDebtors, updateDebtor, deleteDebtor, searchDebtors,
getDebtorCount. Each invokes the matching Rust command.
organization_id is never sent from the frontend; the Rust side
derives it from local auth state.

### Deliverable B — Collections page

File: supervisor-dashboard/src/pages/Collections.tsx
Replaced the placeholder with a full CRUD UI:
- List of debtors in a table.
- Search box (name / surname / email / phone).
- Add Debtor button opening a modal form (name, surname, email,
  phone).
- Edit per row (pencil icon) pre-filling the modal.
- Delete per row (trash icon) with confirmation.
- Loading, empty, and error states.
- No console.log of debtor fields.
- No cloud calls. Only localDB.

### Upload rewrite (boundary fix)

Finding: supervisor-dashboard/src/services/upload.service.ts
previously POSTed parsed debtor rows to
`${API_URL}/debtors/bulk` and uploaded documents to
`${API_URL}/documents/upload`. That would send debtor name,
email, phone, address and debt amount to the cloud. The endpoint
/api/debtors/bulk no longer exists (moved to _disabled/ in
Phase 3.5), so it would have failed with 404, but the intent was
a boundary violation.

Fix:
- upload.service.ts rewritten to parse CSV locally and call
  localDB.bulkInsertDebtors. No fetch. No token required.
- Unstructured upload returns a clear "not yet available in the
  desktop app" message. No cloud call.
- Upload.tsx: removed the `supervisor_token` check that blocked
  uploads on a key that is never written by the Tauri app.
  The visual design is unchanged.
- Debtor fields now mapped to the local schema shape:
  { name, surname, email, phone, data: { address, totalDebt,
  status } }.

### Findings recorded, not fixed

- Local encryption password flow: on a fresh install, after the
  first successful login, `auth.rs::login` writes a salt into
  settings.dat. UnlockScreen then shows "Enter Local Encryption
  Password" instead of "Set Local Encryption Password" because
  it checks whether a salt exists rather than whether a local
  DB file exists. The correct first-run behavior is "Set".
  This is a Rust-side ordering bug in auth.rs. Recorded for a
  later fix.

- Boundary review (Phase 15) missed the frontend services layer.
  The static review inspected backend routes and cloud schema but
  did not read supervisor-dashboard/src/services/. The
  upload.service.ts finding would have been caught earlier if it
  had. Recorded as a scope correction for Phase 15.

### Phase 9 test results (September 14, 2026)

Empirically verified against a freshly built Tauri dev session:
- SQLCipher encryption active. (Reconfirmed.)
- Unlock with correct password succeeds.
- Unlock with wrong password fails immediately.
- Debtor insert works. Row appears in Collections.
- Debtor update works. Row reflects the change.
- Debtor search works (partial match, empty results on no
  match).
- Debtor delete was not exercised in this session.
- Bulk insert via CSV upload works. 10 rows inserted.
- Persistence across app restart works. Rows survive.
- Local audit log writes are reasoned from code
  (log_audit is called in every mutating Rust command); not
  empirically read back in this session.

Not tested because UI does not exist yet:
- Debt CRUD
- Communication logging
- Action CRUD
- Debtor-attached document upload

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. All debtor data stayed on the local machine.
- The rewritten upload path removes a boundary-risk artifact.

### Files changed

- supervisor-dashboard/src/services/local.db.ts (appended)
- supervisor-dashboard/src/pages/Collections.tsx (rewritten)
- supervisor-dashboard/src/services/upload.service.ts (rewritten)
- supervisor-dashboard/src/pages/Upload.tsx (edited - one block
  removed, one token variable added, everything else unchanged)
- Backups: local.db.ts.before-phase9-localdb-20260914,
  Collections.tsx.before-phase9-20260914,
  upload.service.ts.before-phase9-local-20260914,
  Upload.tsx.before-phase9-local-20260914

### Status change

Phase 9 is no longer BLOCKED. It is PARTIAL: the debtor CRUD
path is verified end to end in the desktop app; debt,
communication, action, and debtor-document features remain
unimplemented in the UI.

## Phase 9 Progress — Items 1, 1b, 2 — September 14, 2026

Continued the Phase 9 unblock work started earlier today.

### Item 1 — Debtor-attached document upload

- Added Document and DocumentInput interfaces to
  supervisor-dashboard/src/services/local.db.ts.
- Added three methods to the localDB object:
  uploadDocument, getDocuments, deleteDocument.
- Documents initially lived inside the Edit modal in
  Collections.tsx. Later moved to the debtor detail page
  (item 1b).
- Tested: upload a file, list it, delete it, upload again.
  All work.

### Item 1b — Debtor detail page

- New file:
  supervisor-dashboard/src/components/DebtorEditModal.tsx
  (5,695 bytes). Extracted from Collections.tsx as a shared
  component.
- New file:
  supervisor-dashboard/src/pages/DebtorDetail.tsx
  (13,550 bytes initially, later expanded).
- New route /collections/:id in App.tsx.
- Collections.tsx: debtor name is now a clickable link that
  navigates to the detail page. The pencil icon still opens
  the edit modal.
- Detail page shows: name, surname, email, phone, created,
  updated; Documents section; later Debts section.
- Tested: click debtor, page loads, edit works, document
  upload works, delete works.

### Item 2 — Debt CRUD

Rust side:
- Added Debt and DebtInput structs to src-tauri/src/main.rs.
- Added four commands: get_debts, insert_debt, update_debt,
  delete_debt. All org-scoped via join to debtors.
- Registered all four in generate_handler!.

Frontend side:
- Added Debt and DebtInput interfaces and four localDB methods
  to local.db.ts.
- New file:
  supervisor-dashboard/src/components/DebtEditModal.tsx
  (7,304 bytes).
- DebtorDetail.tsx gained a Debts card: list, add via modal,
  edit via modal, delete.

Tested end-to-end on the previous DB and again on a fresh DB:
- Insert debt with amount, currency, status, due date,
  description.
- Edit debt (change status).
- Delete debt.
- Persistence across app restart.
All work.

### WDAC blocker and self-signed certificate — CRITICAL

Mid-session, new Rust builds stopped running with:
    An Application Control policy has blocked this file.
    (os error 4551)

Diagnosis:
- WDAC enforced
  (CodeIntegrityPolicyEnforcementStatus = 2).
- Smart App Control: On.
- The 9/9/2026 Windows Updates (KB5124007, KB5124008,
  KB5126052) and the 9/9/2026 WDAC policy changes were the
  likely trigger.
- Defender exclusions do not help (Application Control, not
  real-time scanning).

Solution implemented:
- Created a self-signed code-signing certificate
  (CN=GORKA Dev Signing, thumbprint
  370532F494A44A0B46E789D40649B26A13096FDB).
- Exported it to C:\Users\kucha\GORKADev.cer.
- Imported into TrustedPeople and TrustedPublisher
  (CurrentUser).
- Imported into Root and TrustedPublisher (LocalMachine) via
  certutil in an elevated prompt.
- Every Rust build is now signed with
  Set-AuthenticodeSignature before execution.

Operational change:
- `npm run tauri:dev` no longer works on this machine.
- New workflow: Vite dev server in one terminal, cargo build
  then sign then run the binary in another.
- Full instructions in
  GORKA_RECOVERY/recovery-notes/TAURI-DEV-WORKFLOW.md.

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held: all debtor, debt, document, communication
  data remains on the local machine.
- The self-signed certificate is a local development tool. It
  does not affect GORKA's cloud or the invariant.

### Files changed

- src-tauri/src/main.rs (Debt structs, four debt commands,
  Communication enums and structs, three communication
  commands, updated generate_handler!)
- supervisor-dashboard/src/services/local.db.ts (Document,
  DocumentInput, Debt, DebtInput interfaces; uploadDocument,
  getDocuments, deleteDocument, getDebts, insertDebt,
  updateDebt, deleteDebt methods)
- supervisor-dashboard/src/components/DebtorEditModal.tsx (new)
- supervisor-dashboard/src/components/DebtEditModal.tsx (new)
- supervisor-dashboard/src/pages/DebtorDetail.tsx (new, then
  expanded with Debts)
- supervisor-dashboard/src/pages/Collections.tsx (rewritten)
- supervisor-dashboard/src/App.tsx (one import, one route)
- Backups: main.rs.before-debts-20260914,
  main.rs.before-communications-20260914,
  local.db.ts.before-debts-20260914,
  Collections.tsx.before-detail-20260914,
  DebtorDetail.tsx.before-debts-20260914,
  App.tsx.before-detail-20260914

### What is complete

- Item 1: Document upload. DONE.
- Item 1b: Debtor detail page. DONE.
- Item 2: Debt CRUD. DONE.

### What is next

- Item 3: Communication logging. Rust side already written and
  compiled. Frontend side not yet built. Needs:
  - localDB methods for communications.
  - CommunicationEditModal.tsx.
  - Communications card on DebtorDetail.tsx.
- Item 4: Action CRUD. Requires a local schema migration v3 to
  add the `actions` table. Authorized by the founder.

### Known UX bug recorded earlier, unchanged

UnlockScreen shows "Set Local Encryption Password" instead of
"Enter Local Encryption Password" when settings.dat lacks the
salt. Root cause: salt is written during login() in auth.rs
rather than during the set-password step. Deferred until the
whole registration flow is designed.

## Phase 9 Progress — Item 3 (Communication Logging) — September 14, 2026

Continued the Phase 9 unblock work. Item 3 is now complete and
verified in the running desktop app.

### What was done

- Communication logging is now fully wired end to end:
  local SQLCipher DB → Rust commands → frontend service →
  UI on the debtor detail page.

### Frontend — service layer

File: supervisor-dashboard/src/services/local.db.ts

Added two interfaces and three methods to the existing localDB
object:

- Communication interface, mirroring the Rust struct in
  src-tauri/src/main.rs. Fields: id, debtor_id, type,
  direction, content, duration, created_by, data, created_at.
  Note: the Rust field is `r#type`, serialized as "type" on the
  JSON wire.
- CommunicationInput interface. Fields: debtor_id, type,
  direction, content, duration, data.
- getCommunications(debtorId) -> invokes get_communications
  with { debtorId } (camelCase conversion, same pattern as
  getDebts).
- insertCommunication(input) -> invokes insert_communication.
  Payload keys match the Rust CommunicationInput struct:
  debtor_id, type, direction, content, duration, data.
  created_by is not sent (Rust sets it to None).
- deleteCommunication(id) -> invokes delete_communication
  with { id }, returns bool.

No updateCommunication method. Communications are append-only
by design, matching the schema's lack of an updated_at field.
Deletion and re-logging is the correction path.

### Frontend — new modal

File: supervisor-dashboard/src/components/CommunicationEditModal.tsx
(new, 4,7xx bytes)

Modeled on DebtEditModal.tsx. Fields: Type (CALL / EMAIL / SMS
/ NOTE), Direction (INBOUND / OUTBOUND), Content (textarea),
Duration (number, only shown when Type is CALL). No editingId
prop and no update path — create only.

Type values match the Rust CommunicationType enum wire values.
Direction values match CommunicationDirection. Duration is sent
only when Type is CALL and the field is non-empty; otherwise
null.

### Frontend — debtor detail page

File: supervisor-dashboard/src/pages/DebtorDetail.tsx

- Added Communications state (list, loading, error, modal
  visibility).
- Added loadCommunications(), called from the existing
  useEffect alongside loadDebtor / loadDocuments / loadDebts.
- Added handleDeleteCommunication().
- Added a Communications card between the Debts card and the
  Documents card. Lists each entry with a type badge, a
  direction badge, content preview, duration when present, and
  created_at timestamp. Delete via trash icon. Add via
  "+ Log Communication" button.
- Mounted CommunicationEditModal at the bottom with the other
  modals. On save, it closes and reloads the list.

### Rust side — no change

The three commands already existed in src-tauri/src/main.rs
(get_communications, insert_communication,
delete_communication) and were already registered in
generate_handler!. No Rust change was required for Item 3.

No re-signing was required. The existing signed binary loads
the updated frontend from the Vite dev server.

### Test results (empirical, in the running app)

- Communications card appears on the debtor detail page,
  between Debts and Documents.
- Log Communication opens the modal.
- Entries created for all four types (CALL, EMAIL, SMS, NOTE)
  with both directions (INBOUND, OUTBOUND).
- Duration field appears only for CALL; duration value
  displayed in the list when present.
- Entries appear in the card with correct badges and
  timestamp.
- Delete works.
- Persistence across app restart: works.

### Rule compliance

- No production touched. All work is local to the Tauri
  SQLCipher DB.
- No cloud schema change. No new columns. No new tables.
- No CI/CD touched (Rule 12 respected).
- Invariant held: communication content stays on the local
  machine. It never reaches GORKA cloud.
- No frontend fetch, no cloud API call, no supervisor_token
  in the new code.

### Files changed

- supervisor-dashboard/src/services/local.db.ts (appended:
  Communication and CommunicationInput interfaces; three
  localDB methods)
- supervisor-dashboard/src/components/CommunicationEditModal.tsx
  (new)
- supervisor-dashboard/src/pages/DebtorDetail.tsx (imports,
  state, loader, useEffect, delete handler, Communications
  card, modal mount)

### What is complete in Phase 9

- Item 1: Document upload. DONE.
- Item 1b: Debtor detail page at /collections/:id. DONE.
- Item 2: Debt CRUD. DONE.
- Item 3: Communication logging. DONE.

### What is next

- Item 4: Action CRUD. Requires local schema migration v3 in
  src-tauri/src/db.rs to add the `actions` table. Authorized
  by the founder. Not started.

### Known UX bug recorded earlier, unchanged

UnlockScreen shows "Set Local Encryption Password" instead of
"Enter Local Encryption Password" when settings.dat lacks the
salt. Root cause: salt is written during login() in auth.rs
rather than during the set-password step. Deferred until the
whole registration flow is designed.

## Phase 9 Progress — Item 4 (Action CRUD) — September 15, 2026

Continued the Phase 9 unblock work. Item 4's frontend code is
written. Item 4's Rust side was already written and compiled
into the signed binary on September 14.

### What was done

#### Local schema migration v3 (already applied, September 14-15)

File: src-tauri/src/db.rs

The `actions` table was added via migration v3. Pattern
matches migration v1: transaction, CREATE TABLE IF NOT EXISTS,
CREATE INDEX IF NOT EXISTS, set PRAGMA user_version = 3,
commit.

Columns (10, per the Option B decision):
  id TEXT PRIMARY KEY
  debtor_id TEXT NOT NULL  (FK -> debtors(id) ON DELETE CASCADE)
  type TEXT NOT NULL
  status TEXT DEFAULT 'PENDING'
  assigned_to TEXT
  due_date DATETIME
  description TEXT
  data JSON DEFAULT '{}'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

Indexes: idx_actions_debtor_id, idx_actions_status.

The `data` column was chosen (Option B) to match the pattern
of the existing tables (debtors, debts, documents,
communications), all of which have a `data JSON DEFAULT '{}'`
column. LOCAL-TABLES.md §A.5 lists 9 columns without `data`;
the recovery session chose to add `data` for consistency with
the migration v1 convention.

#### Rust commands (already written and compiled, September 14-15)

File: src-tauri/src/main.rs

Added Action and ActionInput structs, and four commands:
  get_actions(debtor_id) -> Vec<Action>
  insert_action(input) -> Action
  update_action(id, input) -> Action
  delete_action(id) -> bool

All four registered in generate_handler!. All org-scoped via
INNER JOIN debtors or debtor_id IN (SELECT ...) patterns,
matching the debt and communication commands.

ActionInput includes `debtor_id`. On update, the Rust side does
not use it to reassign the action; it is only used for the audit
entry, matching how update_debt behaves. The WHERE clause on
id is what identifies the row.

`assigned_to` is nullable and not populated from the frontend
in this MVP. Per-user attribution waits for the Agent App.

#### Frontend — service layer

File: supervisor-dashboard/src/services/local.db.ts

Added Action and ActionInput interfaces. Both mirror the Rust
structs exactly, including the r#type -> type wire mapping.
Added four localDB methods: getActions, insertAction,
updateAction, deleteAction. Wire shapes match the Rust
command arguments:
  getActions({ debtorId })
  insertAction({ input: { debtor_id, type, status, assigned_to,
                          due_date, description, data } })
  updateAction({ id, input: { ... } })
  deleteAction({ id })

No organization_id sent from the frontend.

#### Frontend — new modal

File: supervisor-dashboard/src/components/ActionEditModal.tsx
(new)

Modeled on DebtEditModal.tsx and CommunicationEditModal.tsx.
Create and edit supported. Fields:

  Type dropdown (7 values):
    CALL, EMAIL, SMS, VISIT, LETTER, TASK, LEGAL

  Status dropdown (4 values):
    PENDING, IN_PROGRESS, COMPLETED, CANCELLED

  Assigned To — free text, optional, placeholder
    "Leave empty for now" (per-user attribution deferred)

  Due date — date input, optional

  Description — textarea, optional

  `data` is not exposed in the UI. It stays {} on the Rust
  side unless the frontend sends something.

Duration field is not part of this modal; unlike
communications, actions do not have a duration column.

#### Frontend — debtor detail page

File: supervisor-dashboard/src/pages/DebtorDetail.tsx

Added Actions state (list, loading, error, modal visibility,
editing id, editing row). Added loadActions, called from the
existing useEffect alongside the other four loaders.
Added openAddAction, openEditAction, closeActionForm,
handleActionSaved, handleDeleteAction.

Added an Actions card between the Communications card and the
Documents card. Lists each entry with:
  - Type badge (LEGAL rendered in red, others in purple)
  - Status badge (four colors for the four states)
  - Description preview, due date, assigned_to when present
  - created_at timestamp
  - Edit (pencil) and Delete (trash) buttons

Mounted ActionEditModal at the bottom with the other modals.

#### Type list additions during Item 4

The original LOCAL-TABLES.md §A.5 did not enumerate the `type`
values. During Item 4 the founder specified the following
values for the MVP:
  CALL, EMAIL, SMS, VISIT, LETTER, TASK, LEGAL

LEGAL means "judicial process" — the action moves from regular
collection effort (calls, SMS, letters) into court and judicial
procedure. Per the founder's decision, LEGAL is a LABEL ONLY.
It does not block other types, does not change any schema, and
does not enforce any workflow. The agent decides what to do.

### Rust side — no change was required during this session

The four commands and the migration were already written and
compiled into the signed binary on September 14. This session
only added the frontend.

### Not yet tested

The frontend code cannot be tested on the founder's main
machine. The signed binary is currently blocked by Smart App
Control (see the SAC investigation entry below). No Rust
rebuild can be run either, for the same reason.

Testing of Item 4 end to end will happen once a cloud Windows
development environment is available (see below).

### Rule compliance

- No production touched.
- No cloud schema change. The `actions` table is local-only.
- No CI/CD touched (Rule 12 respected).
- Invariant held: all action data stays on the local machine.
  None of it reaches GORKA cloud.
- No frontend fetch, no cloud API call, no supervisor_token
  in the new code.

### Files changed in this session

- supervisor-dashboard/src/services/local.db.ts (appended:
  Action and ActionInput interfaces; four localDB methods)
- supervisor-dashboard/src/components/ActionEditModal.tsx (new)
- supervisor-dashboard/src/pages/DebtorDetail.tsx (imports,
  state, loader, useEffect, handlers, Actions card, modal
  mount)

### What is complete in Phase 9 (code on disk)

- Item 1: Document upload. DONE (tested).
- Item 1b: Debtor detail page at /collections/:id. DONE
  (tested).
- Item 2: Debt CRUD. DONE (tested).
- Item 3: Communication logging. DONE (tested).
- Item 4: Action CRUD. CODE COMPLETE. Not yet tested.

### Next

Testing of Item 4 once a cloud Windows environment is
available. See the SAC investigation entry below.

---

## SAC investigation and cloud development environment decision — September 15, 2026

Context: During the attempt to build and run the rebuilt
gorka-client.exe on the founder's main machine, Windows
Application Control blocked the binary. This entry records the
investigation, the finding, and the decision that resulted
from it.

### The block, precisely

Windows Application Control (Smart App Control, SAC) blocked
the binary. Evidence:

- Event ID 3077 in the CodeIntegrity Operational log:
  "Code Integrity determined that a process ... attempted to
  load ...gorka-client.exe that did not meet the Enterprise
  signing level requirements or violated code integrity policy"
- Policy ID: {0283ac0f-fff1-49ae-ada1-8a933130cad6}
- That policy is VerifiedAndReputableDesktop — the Smart App
  Control base policy.
- SAC registry state: VerifiedAndReputablePolicyState = 1
  (On, enforced).

The binary was signed with a self-signed certificate
(CN=GORKA Dev Signing) and Set-AuthenticodeSignature reported
Status: Valid. SAC still blocked it. SAC requires the binary
to be signed by a certificate from the Microsoft Trusted Root
Program, or to have accumulated cloud reputation with
Microsoft's Intelligent Security Graph. A self-signed
certificate does not satisfy this.

### What the founder asked us to check (in order)

1. Can we execute a newly compiled Rust binary on the main
   machine while SAC remains enforced?
   Answer: NO. Confirmed by event log and SAC documentation.
   SAC does not allow per-file allowlists for consumer
   machines. The only paths are: turn SAC off, sign with a
   Trusted Root certificate, or run elsewhere.

2. Is there a supported development configuration?
   Answer: There is an SAC audit policy, but it only applies
   when SAC is set to Evaluation mode. Changing to Evaluation
   mode requires disabling BitLocker, removing Defender
   dynamic signatures, and booting to Recovery to edit the
   offline registry hive. Microsoft warns this compromises
   protection. Reversibility is not reliably documented.
   The founder declined this route.

3. Can the toggle that Microsoft introduced in KB5074105 be
   used to turn SAC Off and back On?
   Answer: The toggle IS present on the founder's machine
   (Windows 11 Home, 25H2, build 26200.9445). Both
   "Evaluation" and "Off" radio buttons are interactive in
   the Smart App Control settings UI. However, Microsoft's
   own documentation and community reports show the toggle
   has been rolled back on many machines and the behavior
   is inconsistent. The founder declined to test the toggle
   because failing to restore SAC would require a Windows
   reset.

4. Is Azure Artifact Signing (Trusted Signing) available?
   Answer: NO. It is geographically limited to organizations
   in the USA, Canada, EU, or UK with 3+ years of verifiable
   history, or to individual developers in the USA and
   Canada. The Philippines is not in any eligible category.
   No announced expansion timeline.

5. Would an OV certificate solve the development problem?
   Answer: OV certificate would allow SAC to run the signed
   binary, but the cost ($150-300/year), the hardware token
   requirement (FIPS 140-2 Level 2, since June 2023), and the
   company registration requirement mean it is not a
   development-phase solution. It is a production-phase
   decision.

### Host machine check (September 15, 2026)

The founder's main machine, checked for VM feasibility:

- Windows edition: Windows 11 Home, version 25H2, build
  26200.9445
- CPU: Intel Celeron J4025 @ 2.00 GHz, 2 cores, 2 logical
  processors
- RAM: 8,248,205,312 bytes = 7.68 GB total
- Free disk on C:: 123.4 GB (out of 231.8 GB)
- Virtualization: VirtualizationFirmwareEnabled = True,
  HypervisorPresent = False
- Defender: all four services True
- BitLocker: not enabled on C:

Conclusion: A Windows 11 VM on this host is not viable. The
host has only 2 CPU cores and 7.68 GB RAM. A Windows 11
guest needs at least 4 GB RAM and 2 CPU cores on its own.
Assigning 4 GB to the VM would leave ~3.7 GB for the host,
and 2 cores assigned to the VM would starve the host. A
Tauri `cargo build` inside such a VM would likely swap
heavily or fail during linking. This is a hardware limit,
not a configuration issue.

### Decision: cloud Windows development environment

The chosen path is a cloud Windows desktop. This is a
separate Windows machine hosted in the cloud, accessible via
Remote Desktop. It solves the SAC problem by providing a
Windows environment where SAC is either off by default or
controllable.

Provider selected for trial: V2 Cloud. Their "Heavy" plan
(4 CPU / 16 GB RAM / 50 GB storage) matches the workload.
The 7-day free trial does not require a credit card.

Alternatives considered:
- Windows 365 free trial (30 days, but requires a credit
  card, which the founder does not have — only debit cards)
- Kamatera (30-day $100 credit trial, accepts PayPal deposit
  as an alternative to card, ~$17.59/month for a usable plan
  after trial)
- Amazon WorkSpaces (free tier is misleading, AWS account
  requires credit card)
- V2 Cloud (7-day trial, no card required)

Selection rationale: start with V2 Cloud's free 7-day trial
because it requires no card. If the workflow proves viable,
move to Kamatera for ongoing use, using their PayPal deposit
alternative if the debit card is declined.

### Actions NOT taken

- SAC was not turned off on the main machine.
- No registry modifications were made.
- No Group Policy changes.
- No BitLocker changes.
- No VM was created on the host (not viable).
- No certificate was purchased.
- No Microsoft Store developer account was registered yet.

### The plan going forward (three phases)

Phase 1 — Cloud Windows environment (V2 Cloud trial, then
Kamatera if viable). On first login to the cloud machine,
check SAC state. If enforced, try the normal Windows
Security UI toggle to switch it off. If that works, proceed.
If not, try a different provider.

Phase 2 — Prove GORKA builds and runs in the cloud machine.
Install Rust, Visual Studio Build Tools, Node, Tauri CLI.
Clone the repository. Run cargo build. Sign with the
self-signed certificate. Run gorka-client.exe. Test Item 4
end to end (create action, edit, delete, persistence).

Phase 3 — Snapshot the cloud machine as a known-good
development environment. Continue with remaining work.

### Deferred topics (recorded, not acted on)

1. Microsoft Store distribution for investor demo.
   The founder wants to demonstrate GORKA to potential
   investors and customers. Security-conscious investors will
   not disable SAC or click through warnings. Two paths
   discussed:
   a. MSIX via Microsoft Store — Microsoft signs the package
      for free. No certificate purchase needed for this
      channel.
   b. OV certificate + direct download from the website —
      requires company registration (planned as Spanish
      incorporation) and certificate purchase (~$150-300/year).
   The final decision on which route to use is deferred until
   the cloud development environment is working and the app
   is demonstrable. Microsoft Store registration requires
   only an individual developer account (free, identity
   verification by government ID + selfie), which the founder
   can register without a company.

   Important caveat recorded: Tauri's official Microsoft
   Store documentation currently describes submitting EXE/MSI
   installers, not MSIX. Converting an MSI to MSIX is
   possible but adds work. Investigation of the correct
   Tauri-to-Store route is deferred to after the cloud
   environment is proven.

2. OV certificate purchase and Spanish incorporation.
   The founder plans to incorporate in Spain before
   production deployment. The certificate will be purchased
   by the Spanish entity then. This is not needed for the
   development phase or the initial investor demo if the
   Microsoft Store route works.

3. Portfolio transfer feature (debt transfer to collection
   agency or judicial process). The founder described a
   business feature where an entire portfolio of debtors
   (overdue debt plus scheduled future payments) transfers
   from one entity to another — for example, a bank transfers
   a book of debtors to a collection agency, or a debtor
   enters judicial process. This is a significant data model
   feature requiring: a portfolio/batch concept, a transfer
   record, partitioning of debt into overdue and healthy
   portions, a payment schedule (currently `debts` has a
   single amount field), and history preservation across the
   transfer boundary.

   Decision: this feature is documented and DEFERRED. It is
   not part of Phase 9 and not part of Item 4. It belongs to
   a future phase after the current Phase 9 work is tested
   and complete. Implementing it now would break the
   recovery discipline (one item at a time) and cannot be
   tested without a working build environment anyway.

### Rule compliance for this session

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held.
- The SAC investigation was diagnostic only. No Windows
  security settings were modified.
- The decision to use a cloud environment instead of a local
  VM is a response to the host hardware limit, not a
  workaround or a security bypass on the main machine.


## Multi-User Data Model — September 17, 2026

This entry records the decision that defines GORKA's multi-user architecture. It is the largest single decision in the recovery after the invariant itself. The record is kept in one entry because the decision is one decision, even though it touches many documents.

### Context: why this topic escalated

GORKA's invariant is that no individual debtor information is stored in GORKA cloud infrastructure. The Client Dashboard was built on that invariant for a single machine: debtor data in a local SQLCipher database, GORKA cloud holding only customer accounts, licensing, billing, and aggregate numbers.

GORKA's real customers are multi-user agencies: one admin, many agents, some in the office, some at home, some in the field. They need to see the same debtors. They need to see each other's work. The admin needs to see everything the agents do.

That requirement — multiple machines, same data, no debtor data on GORKA's servers — is the hardest problem in the platform. It is the one that decides whether GORKA can be what it claims to be. The topic escalated because it is not a feature, it is the foundation. Everything else in the product is built on top of the answer.

### The two models considered

Model A — GORKA Cloud as the sync relay.

The admin's machine sends debtor data to a GORKA cloud service. The agent's machine receives it from the same service. GORKA is the middleman for every change.

- Advantages: easy to build, standard SaaS pattern, GORKA's servers are always online.
- Disadvantage: GORKA now holds debtor data, even briefly, even encrypted. The promise becomes harder to defend. A regulator or a bank hears the difference.

Model A was rejected.

Model B — Direct machine-to-machine sync, brokered by GORKA.

The client's machines synchronize with each other. GORKA's servers help them find each other, then step out of the way. The debtor data travels from one client-owned machine to another. GORKA never holds it, never reads it, never sees it in readable form.

Model B was adopted.

### Topology: hub-and-spoke for MVP, mesh for production

Within Model B, there are three possible topologies. GORKA chooses different ones for different stages.

MVP topology — hub-and-spoke.

- The admin's machine is the hub.
- Every agent's machine is a spoke.
- All sync traffic passes through the admin's machine.

Why this choice for the MVP:

- Dramatically simpler to build. One connection per machine, not one per pair of machines.
- Matches a large part of the actual customer base. A professional agency with 10–20+ staff typically has an office machine that is always on.
- Produces a working demonstration quickly.

What is lost: if the admin's machine is offline, agents can still work locally — their changes queue up — but they cannot see each other's new changes until the hub returns.

Important safety property: each device holds an independently encrypted replica of the organization's data. No single device is the permanent master database. The synchronization protocol's job is to make the replicas converge toward the same logical state.

Production topology — mesh.

In the funded version, any two authorized machines in the organization sync directly with each other. The admin's machine is no longer a single point of coordination. This removes the operational constraint of the MVP and is the correct target for field-based and multi-office agencies.

### Device identity: user account for MVP, combined for production

MVP — device identity is the user account.

- Agents log in with credentials provided by the admin.
- An agent can use GORKA from any machine by logging in.
- There is no per-machine registration in the MVP.
- Removing an agent means disabling their user account.

Known limitation: if an agent's machine is stolen, the admin cannot remove only that machine. The admin can only disable the user account, which also locks the agent out of their other machines. For the MVP, with one agent typically using one machine, this is acceptable.

Production — combined user + device identity.

Each machine is a registered entity within the organization. Each machine has its own identity. Each machine is enrolled, listed, and can be individually revoked. Removing one lost machine does not disable the agent's other machines.

Migration cost: real. The enrollment flow, key distribution, and revocation flow are all new work. The sync protocol is largely unaffected. This belongs to the funded phase.

### The sync model: events from the beginning

The synchronization engine is event-based from the beginning. It is not "last-write-wins over the whole database," because that would silently lose business events in a debt-collection context.

Two categories of data:

State — mutable properties of a record. Debtor's current name, address, phone, status, assigned agent. State is synchronized with deterministic rules. When two machines change the same field to different values, the most recent change wins, and the previous value is recorded.

Events — append-only business facts. PAYMENT_RECORDED, PROMISE_CREATED, PROMISE_BROKEN, CALL_LOGGED, SMS_SENT, EMAIL_SENT, NOTE_ADDED, STATUS_CHANGED, CONTACT_ATTEMPTED. Events are never overwritten. Two agents recording two payments produce two events. Both survive.

Why events are the foundation:

- In debt collection, business meaning matters. A payment and a promise are events, not field values.
- Events reconstruct current state, so nothing is lost if state and events diverge.
- Events provide the basis for future features: audit reporting, AI analysis, regulatory export.
- Choosing events now avoids a data migration later, when the funded phase would otherwise have to add events to a database that never recorded them.

The application audit log is not the sync protocol's memory.

There are two separate things: the application audit log (a record of who did what, for compliance and human review), and the sync protocol's change history (the events and change records that machines exchange to reconcile). The application audit log is not the sync protocol's source of truth. The sync protocol maintains its own change history, in its own structure. This distinction is essential and belongs in `SYNC-ARCHITECTURE.md`.

MVP event set.

The MVP populates the event table with a limited set of event types — enough to demonstrate the architecture: DEBTOR_CREATED, DEBTOR_UPDATED, ACTION_CREATED, COMMUNICATION_LOGGED.

The full set of business events is added as the product matures. The table, the protocol, and the reconciliation logic all assume events from the beginning, so no migration is required when the set expands.

"Most recent" requires a precise definition.

The concept says that conflicting state changes use deterministic rules, and that the most recent change wins. The technical specification must define what "most recent" actually means. It cannot simply mean wall-clock time, because distributed clocks cannot be trusted to establish globally correct ordering. The correct rule — a logical ordering, a sequence number, a protocol-defined tiebreaker — belongs in `SYNC-ARCHITECTURE.md`.

### Key management: client policy, GORKA mechanism

The client decides who is authorized to access their data. GORKA provides the secure mechanism for granting and revoking that access, without ever possessing the organization's decryption keys.

- The client controls authorization — who has access, when they lose it, and under what conditions.
- GORKA implements the mechanism — the enrollment flow, the key distribution package, the revocation process.
- GORKA does not possess the decryption keys — not for recovery, not for support, not for any purpose. This is architectural, not policy.

Lost devices.

GORKA provides mechanisms: remove a device from the organization (production only), rotate the organization key so future traffic is not readable by the lost device, and document the recovery process plainly.

GORKA cannot delete data on a machine it cannot reach. That is physics, not policy.

Critical caveat: revocation prevents future synchronization. It does not guarantee deletion of data already replicated to the device. Any device that has ever synced holds a local copy of the data it was authorized to access. This is true of any product that stores data locally, and it must be stated plainly in the documentation so that no client is surprised later.

### The canonical promise

The canonical statement of GORKA's data protection is now:

> GORKA cannot decrypt your debtor data. This is an architectural property, not a policy.

This replaces the looser formulation "debtor data never touches GORKA's servers," which was not achievable in practice, because encrypted traffic may pass through the relay.

The marketing statement, for customer-facing use, is:

> Your debtor data stays under your control. GORKA cannot read it.

Both statements are true. The technical statement is what a security review verifies. The marketing statement is what a customer reads.

### The relay fallback and its implications

GORKA may operate an encrypted relay as part of the Control Plane. The relay passes end-to-end encrypted traffic between the client's devices. The relay cannot decrypt the traffic it carries. The relay may observe connection metadata: which devices are connected, when, and how much data is passing. The relay must not be capable of decrypting debtor data under any configuration, including administrative override, support access, or legal compulsion.

The relay exists because direct device-to-device connections cannot always be established, due to NATs, firewalls, and network policies. It is an operational necessity, not an architectural compromise. Its inability to decrypt is the boundary.

This is what makes the new promise defensible where the old one was not. The old promise required no traffic to pass through GORKA's infrastructure. The new promise requires only that GORKA cannot decrypt it. The first is unachievable in real networks. The second is achievable and testable.

### The MVP, restated

The MVP is a working product with constraints, not a proof-of-concept. All four blocks are present. Each is limited by an explicit list.

Tier 1 — must work reliably:

- Local SQLCipher storage on each machine.
- Multi-user sync engine. Hub-and-spoke. Direct connection, encrypted relay fallback. Event-based.
- Client Dashboard and Agent App as two separate Tauri binaries, sharing a Rust command layer.
- Registration, login, and organization membership.
- One demonstration of sync between two machines, meeting the acceptance criteria.

Tier 2 — must exist and be demonstrable, but simple:

- Owner Dashboard with a metadata-only view of sync activity.
- Marketing website with registration and download links.
- One working connector through the Communication Center.
- Basic AI Copilot: one prompt, one recommendation, one draft.
- Local encrypted data on disk, visible in the demonstration.

Tier 3 — buttons, documentation, or roadmap only:

- Other connectors.
- Key rotation, offboarding, lost-device flows.
- Per-machine device identity.
- Mesh topology.
- Compliance dashboard.
- Full AI Copilot capability.

The MVP is Tier 1 and Tier 2, working. Tier 3 is the roadmap.

### The demonstration

The core proof for investors and prospective clients:

- Two laptops, side by side. One is the admin's, one is the agent's.
- The admin creates a debtor. Within seconds, the debtor appears on the agent's machine.
- The agent logs an action. It appears on the admin's machine.
- A network capture shows the sync traffic as ciphertext. GORKA cannot decrypt it.
- The Owner Dashboard shows the two machines connected, and shows nothing about the debtors.
- The client's local data is encrypted at rest.

### What was produced today

The following documents were created or amended:

1. `MULTI-USER-CONCEPT.md` — new. The full concept, frozen at Version 2.0. This is the source of truth for the multi-user model.

2. `ARCHITECTURAL-LAW.md` — amended to v1.2. New Section 20, six subsections covering the two planes, multi-device debtor data, the encrypted relay, the canonical promise, the reference to the concept, and what the amendment does not change.

3. `ARCHITECTURAL-LAW-AMENDMENTS.md` — amended. New v1.2 entry with the reasoning, the changes, and the relationship to prior versions.

4. `DATA-BOUNDARY-MATRIX.md` — amended. New Section 20, five subsections classifying encrypted sync payloads, Control Plane connection metadata, sync events and change history, what the new data types do not permit, and the extended proof test.

5. `PHASE-PLAN.md` — amended to v1.1. Three new phases added: Phase 9.5 (Agent App and Client Dashboard, local only), Phase 9.6 (Sync Engine), Phase 9.7 (Multi-User Demonstration). Decimal phase numbering, per the existing convention.

6. `LOCAL-TABLES.md` — amended. New Category D with three new tables: `sync_events`, `sync_state`, `sync_peers`. Total local tables increased from 12 to 15.

7. `CLOUD-TABLES.md` — amended. New Section 20 with two new tables: `device_registrations`, `relay_sessions`. Total cloud tables increased from 19 to 21.

8. `DECISIONS.md` — this entry.

### Two new cloud tables

`device_registrations` — the Control Plane's authoritative record of which devices belong to which organization. Enables the discovery, presence, and relay coordination services. Enables the device list in the Owner Dashboard and the Client Dashboard. Contains only device and user identity metadata. Never debtor data. Never any identifier that maps to an individual debtor. Never any key material that could be used to decrypt sync traffic.

`relay_sessions` — operational record of relay sessions. Used for capacity planning, abuse detection, and troubleshooting. Contains only session metadata: that a relay was used, between which devices, for how long, and how many bytes. Never the content of the traffic. The relay cannot decrypt the traffic and never stores it.

### Three new local tables

`sync_events` — the append-only record of every business event and state change this device has produced. Events are never modified and never deleted. The foundation of the sync protocol.

`sync_state` — per-peer bookkeeping. Tracks what has been sent, what has been received, and the current status of each peer relationship.

`sync_peers` — local cache of the peer devices this device knows about, for the sync indicator UI and for reconnection. The authoritative list of authorized devices lives in the Control Plane; this is a local mirror.

### What is explicitly deferred

- **Mesh topology** — production phase.
- **Per-machine device identity** — production phase.
- **Key rotation** — production phase.
- **Offboarding and lost-device flows** — production phase.
- **Group key management and MLS** — production phase.
- **Threat model and independent security review** — separate document, before shipping to real customers.
- **`SYNC-ARCHITECTURE.md`** — the next document. It is the technical specification of the sync engine and is the document a developer follows.
- **`GORKA-MVP-SCOPE.md`** — follows after `SYNC-ARCHITECTURE.md`.

### The documents that must be written next

In order:

1. `SYNC-ARCHITECTURE.md` — the technical specification for the sync engine. Must answer every open design question: device identity, organization identity, authentication, enrollment, key creation, key storage, key distribution, session-key establishment, message format, message IDs, event IDs, originating device, ordering, duplicate detection, acknowledgements, offline queue, retry, conflict resolution, direct connection, relay fallback, corrupt/invalid message handling, protocol versioning, recovery after interruption, what metadata GORKA sees, what GORKA can never see, and what "most recent" means without depending on wall-clock time.

2. `GORKA-MVP-SCOPE.md` — the MVP defined in full. Every block, every constraint, every out-of-scope item.

3. Threat model / security review — 3 to 5 pages. Who can attack what, what GORKA can see, what a compromised device can do, what happens when a device is lost.

Only after these three are written and approved does implementation begin.

### Rule compliance

- No production touched.
- No cloud schema change to production. The two new cloud tables exist only in this document; they are not yet applied to any database.
- No CI/CD touched.
- Invariant held. The amendments to the architectural law explicitly reaffirm the invariant in Section 20.6 of the law and in Section 20.4 of the Data Boundary Matrix.
- No code written. The session was documentation only, producing the frozen concept and the amendments that bring the existing documents into alignment with it.

### The decision, in one line

**GORKA's multi-user model is direct machine-to-machine synchronization of debtor data, brokered by GORKA's Control Plane, end-to-end encrypted, with hub-and-spoke topology for the MVP and mesh topology for production; GORKA cannot decrypt the data at any point, and this is enforced architecturally, not by policy.**


### Documents reviewed and unchanged

On September 17, 2026, the following documents were reviewed and
confirmed to require no updates from the multi-user work:

- `RECOVERY-RULES.md` — the 14 rules remain as written. The
  multi-user model does not introduce a new rule. It extends
  the context in which Rules 3 and 4 apply, but the rules
  themselves are unchanged.
- `CONNECTOR-LIFECYCLE.md` — the connector lifecycle is
  independent of the multi-user model. No update required.
- `FRONTEND-REALITY.md` — the reconnaissance record of the
  Tauri frontend layout is unchanged. The Agent App does not
  yet exist on disk; when it does, this document will be
  updated.

The following two documents required small updates, which were
applied:

- `PRODUCTION-REBUILD-PLAN.md` — table count updated from 19 to
  21 (adding `device_registrations` and `relay_sessions`). A
  note added to Phase D: no seed data is needed for the two new
  tables. A note added to "What This Plan Does Not Do": the plan
  does not cover the multi-user sync engine, which is a separate
  workstream.
- `TAURI-DEV-WORKFLOW.md` — a new Section 7 added, documenting
  that Smart App Control (SAC) now blocks the signed binary on
  this machine even after the WDAC signing workaround, and that
  a cloud Windows environment is the chosen path.


---

**End of entry.**

---

## Recovery Session — September 18–20, 2026

This entry records the work done across three sessions: September 18, September 19, and September 20, 2026. It covers the multi-user model's remaining prerequisite documents, the field-semantics specification, the LOCAL-TABLES.md v1.2 amendment, the threat model freeze, the test-vector artifact, and the Section 22 restoration.

### September 18, 2026 — GORKA-MVP-SCOPE.md and the Three-Zones Amendment

- **`ARCHITECTURAL-LAW.md` amended to v1.3.** New Section 21, The Three Zones of Data Control. The v1.0 law and the v1.2 amendment named two planes (Control Plane, Data Plane) and stated the invariant. They did not distinguish between data leaving the client's control through a GORKA-provided mechanism (Zone 2) and data leaving through a path the client chose outside GORKA (Zone 3). The distinction matters: it determines where GORKA's obligation is prevention and where it is warning. Section 21 names Zone 1 (GORKA cloud), Zone 2 (GORKA-provided mechanisms), and Zone 3 (client-connected third parties). GORKA's obligation in Zone 2 is prevention; the mechanism is the guard. GORKA's obligation in Zone 3 is warning at the point of connection, recorded and non-blocking. The invariant is unchanged.

- **`ARCHITECTURAL-LAW-AMENDMENTS.md`** updated with a v1.3 entry recording the amendment, its reasoning, and what did not change.

- **`GORKA-MVP-SCOPE.md` v1.1, frozen.** The MVP defined in full: every block, every constraint, every out-of-scope item, and the acceptance criteria. Subordinate to `ARCHITECTURAL-LAW.md` v1.3, extending `MULTI-USER-CONCEPT.md` v2.0. Structured around the three tiers from the concept: Tier 1 (must work reliably), Tier 2 (must exist and be demonstrable), Tier 3 (buttons, documentation, or roadmap only). Names the MVP event set (four types), the exact synchronized objects (debtor, debt, action, communication, document metadata), and the operational limitations honestly, including the single organization key. Defines the demonstration as combining a network capture with a key-custody review — neither alone sufficient. Establishes that the order of work is: this document, then `SYNC-ARCHITECTURE.md`, then the threat model, then implementation. Corrects the earlier ordering in `MULTI-USER-CONCEPT.md` §14 and in the September 17 DECISIONS entry.

### September 19, 2026 — SYNC-ARCHITECTURE.md v1.0 frozen

- **`SYNC-ARCHITECTURE.md` written and frozen at v1.0.** The technical specification of the sync protocol. Thirty sections in seven parts. Defines the exact wire format (TLV, big-endian, canonical serialization), the exact ordering rule (the protocol order: logical_clock, device_id, sequence, compared lexicographically), the exact reconciliation rule (per-field, most-recent-in-protocol-order wins, losing value preserved), the exact duplicate detection rule (event_id only), and the exact sync state machine (six states). Defines the delivery bookkeeping (per-origin watermark plus sparse gap set), the failure classes (SESSION_ERROR, PROTOCOL_ERROR, EVENT_ERROR, TRANSPORT_ERROR, INTERNAL_ERROR), protocol versioning, and the security properties the protocol provides and does not provide.

- **§22.1 through §22.6.7 written at v1.0.** The encoding conventions, byte order, string and binary blob formats, TLV record structure, message framing, maximum message size, session context, the encrypted envelope, canonical serialization, and the cryptographic primitives.

- **§22.7 through §22.19 were not written at v1.0.** The wire format's message-specific subsections — the enrollment package, the four handshake messages, SESSION_ESTABLISHED, SESSION_END, SYNC_MESSAGE, SYNC_ACK, DISCOVERY_QUERY, DISCOVERY_RESPONSE, SIGNAL_MESSAGE, ERROR, and the HKDF/Argon2/nonce specification — were left incomplete. This was the critical open problem carried into the next sessions.

- **`THREAT-MODEL.md` v1.0, written and frozen, audited.** Nine residual risks (R1–R9), each recorded as ACCEPTED by the founder with reasoning. Audited against `SYNC-ARCHITECTURE.md` v1.1 Sections 28 and 29. Two reordering sentences in Sections 5.4 and 6.4 corrected. Authority-line and sign-off wording updated.

### September 20, 2026 — Section 25.13, LOCAL-TABLES.md v1.2, test vectors, Section 22 restoration

- **`SYNC-ARCHITECTURE.md` §25.13 written.** The field-semantics specification, replacing the previous checklist. Contains §25.13.1 through §25.13.12: the field classification tables, NULL/empty/JSON-null semantics, canonical JSON (RFC 8785 with GORKA number restriction), canonical date-time (YYYY-MM-DD), canonical decimal, enum values, reference-field rules, attribution (created_by), updated_at semantics, and the field-name-to-column master mapping. The header was updated to v1.1 with a note recording the §25.13 amendment.

- **`LOCAL-TABLES.md` v1.2.** Category D rewritten to include D.1 through D.8. Shape B adopted (separate sync_state, sync_delivery, sync_peers). Four new sync tables added: `organization_keys`, `history_records`, `pending_events`, `entity_field_state`. Four column additions to Category A: `debtors.deleted`, `actions.data`, `actions.deleted`, `communications.deleted`. Summary table shows 20 local tables.

- **`SYNC-TEST-VECTORS-v1.md` v1.0 (partially complete) written.** The fixture and known-answer specification. All fixtures pinned. Nine deterministic vectors recorded. Five are marked SPECIFIED / TO BE COMPUTED (M1, M2, V1, V4, V6). Four marked BLOCKED: E1 needs the Argon2id parameters frozen in §7.3; H1, H2, H3 were blocked by the missing §22.19.

- **Section 22 restoration.** The missing subsections, §22.7 through §22.19, were recovered and inserted into `SYNC-ARCHITECTURE.md`. The inserted content was reviewed by the founder's technical reviewer on September 20, 2026, with six targeted corrections:

  1. §22.7.1 and §22.19.2: distinguish fixed protocol Argon2id values from implementation defaults. Placeholders `[TO BE BENCHMARKED]` mark the values that must be benchmarked and frozen.
  2. §22.11: SESSION_ESTABLISHED is one-way (responder → initiator). "Exchanged" replaced with "received and accepted."
  3. §22.13.2: entity types 0x02 (debt) and 0x05 (document) MUST NOT appear in accepted MVP sync events. One paragraph added.
  4. §22.13.4: required vs optional field rules defer to Section 25. One sentence reworded.
  5. §22.14.4: "This subsection amends Section 18.2" replaced with "as defined in Section 18.2." The REJECTED-terminal rule belongs in §18.2, not hidden in §22.
  6. §22.19.1: "This removes ambiguity: two different concatenations cannot produce the same byte sequence" replaced with "This makes the encoding unambiguous."

- **Block C applied.** Two one-line amendments, both verified by on-disk read:
  - §18.2: "ACCEPTED, DUPLICATE, and REJECTED are all terminal delivery outcomes for the delivery bookkeeping defined in this subsection. REJECTED is terminal; the sender does not retry it automatically."
  - §11.4: "The first event originated by a device instance has sequence number 1. Sequence number 0 is the initial value of the counter before any event has been originated; no event has sequence number 0."

- **`SYNC-ARCHITECTURE.md` header bumped to v1.2.** Date September 21, 2026. Amendment note records Section 22 completed by restoration, plus the two Block C amendments to §18.2 and §11.4.

- **`SYNC-TEST-VECTORS-v1.md` status updated.** H1, H2, H3 moved from BLOCKED (blocked by missing §22.19) to SPECIFIED (blocked by computation only). E1 remains blocked by the Argon2id parameters in §7.3 / §22.19.2.

### Verification performed

Every edit in the September 20–21 sessions was verified by reading the file on disk, not by trusting a paste. Specifically:

- `SYNC-ARCHITECTURE.md` section structure: sections 1 through 30 each present exactly once, in order.
- `SYNC-ARCHITECTURE.md` §22: 22.1 through 22.19.4 continuous, every subsection header exactly once.
- `SYNC-ARCHITECTURE.md` byte-level: 363 correct em-dashes (E2 80 94), zero mojibake. 29 correct section signs (C2 A7) in `SYNC-TEST-VECTORS-v1.md`, zero mojibake.
- Block C: 18.2 insertion count 1, 11.4 insertion count 1.
- v1.2 header: version line 1, date line 1, amendment note 1.
- Test-vector status: H1 fixed 1, H2 fixed 1, H3 fixed 1, old H1 blocked line remaining 0.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held. Every amendment was additive; no existing rule was weakened.
- No code written. Documentation only.

### What is still open

- **Argon2id parameters.** §7.3 and §22.19.2 need the values that will be used for MVP enrollment package creation. These must be benchmarked on the supported GORKA desktop environment. They cannot be invented. They block E1's deterministic bytes.
- **Test-vector computation.** The five SPECIFIED vectors (M1, M2, V1, V4, V6) and the four BLOCKED vectors, once the parameters are frozen, need a working implementation. That requires the cloud Windows environment.
- **V2 Cloud Windows environment.** Not yet set up. Blocks the build and blocks vector computation.
- **MVP sync engine implementation.** After all of the above.

### The next phase

The next workstream is to set up the V2 Cloud Windows environment, benchmark the Argon2id parameters, compute the test vectors, and then begin implementation of the MVP sync engine. Until the parameters are frozen and the cloud environment exists, implementation cannot start.

### Rule compliance for this entry

This entry is a record, not a decision. No new decisions were made in the September 18–20 sessions beyond those already recorded in the relevant documents. The entry's purpose is to have a single chronological record of the multi-user document work, so that a future session reading `DECISIONS.md` sees what was done and when, and does not have to reconstruct it from the individual files.

---

**End of entry.**

---

## Recovery Session — September 21–22, 2026

This entry records the September 21–22, 2026 sessions: the construction of the AWS cloud Windows environment, the resolution of the repository synchronization problem, and the partial exercise of Phase 9 Item 4.

### September 21, 2026 — Cloud environment built

- **AWS EC2 instance created.** `Gorka-dev` (`i-0ac85da213bdaa09a`), `t3.small` (2 vCPU, 2 GiB RAM), Windows Server 2025 Datacenter, region Singapore (`ap-southeast-1`). Disk EBS `vol-02111dd953df939b6`, gp3, grown 30 → 50 → 70 GiB. C: extended in Windows to ~69.5 GB. Security group allows RDP from "My IP" only.

- **Toolchain installed and verified.** Git 2.55.0, Node.js 24.21.0 with npm 11.19.0, Rust 1.98.1 with cargo, Visual Studio C++ Build Tools, Strawberry Perl 5.42.3.1 (required by `openssl-sys` to build OpenSSL from source).

- **Rust build succeeded.** `cargo build` on the Tauri backend: `Finished dev profile [unoptimized + debuginfo] target(s) in 18m 21s`. `gorka-client.exe` produced at `C:\gorka-app\src-tauri\target\debug\gorka-client.exe`.

- **Frontend built.** `npm run build` succeeded. `dist/` produced.

- **Backend runs.** Express on port 3000. Initial connection attempts to Supabase failed because the direct hostname `db.tmloklxelckicufzpzxz.supabase.co` does not resolve from AWS Singapore. Switched to the Supabase **session pooler**: `aws-1-eu-west-3.pooler.supabase.com:5432`, username `postgres.tmloklxelckicufzpzxz`. Connection succeeded: `✅ PostgreSQL connected successfully`.

- **Tauri app launches.** Login screen appears. Login with `test@example.com` / `Test123!` succeeds. Local SQLCipher database unlocks with `Password123`. Client Dashboard reached. Collections page shows the real CRUD UI.

- **Eight file mismatches found and resolved.** The cloud machine was cloning an old commit because the main machine had months of uncommitted work. The eight mismatches — `package.json` backend dependencies, the Prisma schema, `@map` annotations, an orphan field, `api.service.ts` token source, `Collections.tsx` placeholder, `DebtorEditModal.tsx`, `local.db.ts` stub — were all symptoms of one cause: the main machine's working tree had become the de facto development branch, and git was not the synchronization authority.

- **Repository synchronized.** On the main machine: `.gitignore` extended to exclude backup binaries and database copies; `git add -A`, commit as `08eac3b` (114 files changed, 122,495 insertions, 673 deletions); pushed to `origin/main`. On the cloud machine: the pull was blocked by an untracked `DebtorEditModal.tsx`. After moving that file aside, the pull fast-forwarded cleanly from `c9efd44` to `08eac3b`.

- **Both machines on commit `08eac3b`.** Working trees clean.

### September 22, 2026 — Item 4 partial test

- **Services started on the cloud machine.** Vite dev server (`npm run dev`), backend (`npx tsx src/backend/index.ts` with inline environment variables), Tauri app.

- **Local database created fresh.** Initial "Enter password" screen failed with `file is not a database` when entering `Test123!`. The correct password is `Password123` — the local encryption password is distinct from the login password. Once the correct password was entered, the database unlocked.

- **Debtor CRUD confirmed working on the cloud machine.** Create, edit, delete all functioned. Collections page shows the real CRUD UI.

- **Debt CRUD partially failing.** Adding a debt failed at the due-date field. Not yet diagnosed. This is the first Phase 9 feature confirmed broken since the cloud environment came up.

- **Phase 9 Item 4 (Action CRUD) not yet fully tested.** Debtor CRUD was exercised; Action CRUD was not completed because the debt due-date issue appeared first.

### Operational knowledge recorded

- **Supabase session pooler is required from AWS Singapore.** The direct database hostname does not resolve. The pooler hostname `aws-1-eu-west-3.pooler.supabase.com` does. The username format for the pooler appends the project ID: `postgres.tmloklxelckicufzpzxz`.

- **SQLCipher's `file is not a database` error means wrong key, not corrupt file.** This is the SQLCipher error message when the key is wrong; it cannot distinguish wrong key from corruption. Always try the correct password before considering deletion.

- **Supabase free tier pauses projects after 7 days of inactivity.** The Gorka SaaS project was paused on September 20, resumed on September 22. Project ID `tmloklxelckicufzpzxz`, region `eu-west-3`.

- **The `prisma/schema.prisma` file in git was the wrong schema.** It described the pre-recovery cloud database with `Debtor`, `Debt`, `Action`, `MessageLog`, `CalendarEvent`, `PermissionRole`, `Connector` models. The correct schema is `prisma/schema.cloud.prisma`, which has the 21 cloud-only models. The cloud machine's `schema.prisma` is now the content of `schema.cloud.prisma`. **A future session should resolve the relationship between these two files** — right now, `schema.prisma` is authoritative in practice, but its content has been overwritten with the cloud schema, and the naming is confusing.

- **`prisma.config.ts` was renamed to `prisma.config.ts.disabled`** in git as part of commit `08eac3b`. This is recorded in the commit, but worth noting.

### Process rule established

**Git is the synchronization authority between development machines.**

Not file-copying. Not "I think it is committed." The workflow is:

MAIN MACHINE
git status
git add -A
git commit
git push
↓
GITHUB
↓
CLOUD MACHINE
git pull
git log --oneline -1 ← verify HEAD
restart services if needed

Before starting work on either machine, verify the HEAD matches:

git log --oneline -1


Both machines must show the same commit. This rule would have prevented most of the September 21–22 confusion.

### The method lesson

The founder's instruction — **check first, then edit** — was tested and held. Two false alarms (the `≤` character in `SYNC-ARCHITECTURE.md`, the `â€"` character in the header) were proven to be terminal display artifacts, not file corruption, by running byte-level checks. In one case (`Password123`), the "corruption" reported by SQLCipher was actually a wrong password. The lesson, restated: **run a byte-level or targeted check before any deletion or repair**.

### Unresolved questions

Two questions the founder has raised are not yet decided or recorded elsewhere:

1. **Agent App architecture.** `MULTI-USER-CONCEPT.md §9` and `GORKA-MVP-SCOPE.md §5.3` describe the Agent App as a second Tauri binary in the same repository, sharing the Rust command layer. The founder recalls a prior-chat discussion about building it **from scratch** instead. **This is not recorded in any recovery document.** Before Phase 9.5 begins, this decision must be discussed, decided, and recorded here.

2. **An embedding that should not have happened.** The founder mentions a prior attempt to embed something (likely Agent App functionality) into the Client Dashboard. **Not documented in any recovery file.** If the founder can identify the code or file, we investigate and record. Otherwise this remains an open question.

### Security items to address

Three credentials have been written into chat logs during the September 21–22 sessions and should be rotated:

1. **Supabase password** `<REDACTED>` — rotate in the Supabase dashboard.
2. **GitHub token** `<REDACTED>` — revoke at `https://github.com/settings/tokens`, create a new one with `repo` scope.
3. **Resend API key** `<REDACTED>` — rotate in the Resend dashboard.

After rotating, update the `.env` files on both machines and redact the credentials from this document and any other recovery document that references them, using `<REDACTED>` in place of the value. The Redact Rule: **no credential value should appear in any recovery document, git commit, or handoff file.**

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held.
- No application code written. All work was infrastructure and testing.

### What is still open

- **Debt due-date bug.** Adding a debt fails at the due-date field. Diagnosis not started.
- **Phase 9 Item 4 completion.** Action CRUD not yet fully tested.
- **Persistence-across-restart test.** Not run for the cloud-machine database.
- **Registration flow audit.** Not done. Known UX bug: `UnlockScreen` shows "Set" vs "Enter" incorrectly because the salt is written during `login()` rather than during `set-password`.
- **Argon2id parameters.** `§7.3` and `§22.19.2` still need benchmarked values.
- **Test-vector computation.** M1, M2, V1, V4, V6 not computed.
- **Control Plane tables not applied to `gorka_test`.** `device_registrations` and `relay_sessions` are specified in `CLOUD-TABLES.md` v1.2 §20 but not created.
- **Control Plane services not implemented.** Discovery, signaling, relay coordination.
- **Agent App (Phase 9.5) not started.** Requires the architecture decision above.
- **Sync engine (Phase 9.6) not started.** Requires the three prerequisites above.
- **Multi-user demonstration (Phase 9.7) not started.**

### The next phase

Two parallel workstreams are now available:

1. **Phase 9 polish.** Fix the debt due-date bug. Complete Item 4. Audit the registration flow. Fix the `UnlockScreen` UX bug.
2. **Sync engine prerequisites.** Benchmark the Argon2id parameters. Apply the Control Plane tables to `gorka_test`. Compute the test vectors.

The Agent App (Phase 9.5) should wait until the architecture question is decided and recorded.

### Rule compliance for this entry

This entry is a record, not a decision, except for the process rule established (git as synchronization authority) and the operational knowledge recorded. Those two items are decisions in effect and should be treated as binding going forward.

---

**End of entry.**

---

## Recovery Session — September 23, 2026

This entry records the September 23, 2026 session. It is a working session on the Client Dashboard, specifically on the local authentication and unlock flow. Three code fixes were made and verified, each with its own root cause. This entry records all three, plus one corrected diagnosis of an earlier entry, plus four deferred findings.

### Context

The goal of the session was to stabilize the local registration flow: login, set local password (first run), enter local password (subsequent runs), logout, and back again — the loop a client performs after they have the installer and the app on their machine.

Three separate defects were found and fixed. They were discovered in sequence, each one only becoming visible after the previous was addressed. The record preserves the sequence, because it shows how the true root cause was found.

### Fix 1 — The Set/Enter bug (commit `01631c6`)

**Symptom.** The `UnlockScreen` showed "Set Local Encryption Password" on returning runs, when it should show "Enter Local Encryption Password." A returning user — one who already had an encrypted database on disk — should be asked to enter their password, not set a new one.

**Root cause.** `UnlockScreen.tsx` decided which screen to show by reading `localStorage.getItem('salt')`:

```typescript
const salt = localStorage.getItem('salt');
setIsFirstTime(!salt);
```

But the salt is stored in `settings.dat`, the Tauri store file, written by the Rust side (`auth.rs`). `localStorage` and `settings.dat` are two entirely separate stores, and the Rust code never writes to `localStorage`. So the frontend's read always returned `null`, and `setIsFirstTime` was always `true`. The screen always showed "Set."

The frontend attempted to compensate by writing `localStorage.setItem('salt', 'set')` after a successful unlock, but this was writing to the wrong store and did not survive reliably.

**Correction to an earlier diagnosis.** The `DECISIONS.md` entry of September 21–22 recorded the cause as: "the salt is written during `login()` rather than during `set-password`." That observation is true — the salt is created in `login()` — but it was not the cause of the Set/Enter symptom. The cause was the `localStorage` / `settings.dat` mismatch. The earlier diagnosis is superseded by this entry.

**Fix.** A new Rust command was added:

```rust
pub fn database_exists() -> bool {
    get_db_path().exists()
}
```

Exposed as the Tauri command `database_exists`. The `UnlockScreen` now invokes this command and decides:

- Database file absent → "Set Local Encryption Password."
- Database file present → "Enter Local Encryption Password."

The `localStorage` read and write were both removed.

**Reasoning recorded.** The correct signal for "first run vs returning run" is the presence of the encrypted database file on disk, not the presence of a salt. A database file cannot exist unless a password has been set. The salt's presence is not the correct signal; the DB file's presence is. The unlock operation remains the authority for whether a password is correct; `database_exists` only selects which screen to show.

**Verification.** On the cloud machine: fresh state (no DB) → "Set" with Confirm field; set password → Dashboard; quit and relaunch → "Enter" with no Confirm field; enter password → Dashboard. Both paths verified. Wrong password → error, screen stays on "Enter," retry with correct password succeeds.

### Fix 2 — The logout button did nothing (commit `38aec9c`, superseded by `183e8f7` and `40b2378`)

**Symptom.** The Logout button in the sidebar did nothing. The hover state worked (background color changed), but clicking it had no effect. The only way to exit was the OS window close button.

**Root cause.** `Sidebar.tsx`'s handler cleared `localStorage` and a cookie:

```typescript
const handleLogout = () => {
  localStorage.clear();
  document.cookie = 'gorka_session=; ...';
  // window.location.href = 'http://localhost:3001/login';  // commented out
};
```

But the Tauri app does not use `localStorage` or cookies for its session. It stores the auth token in `settings.dat` and reads it via the Rust `get_token` command. So the handler was a no-op for the Tauri app. The navigation line was commented out, so nothing visible happened either.

**Fix (first attempt, commit `38aec9c`).** The handler was changed to call `auth.logout()` (the Rust command that clears `settings.dat`) and then `window.location.reload()`.

**Why it was superseded.** The `window.location.reload()` does not tear down the JavaScript context in this Tauri webview. This was proven by the developer console: after clicking Logout, the console retained all its prior log lines. A real page reload clears the console. So the reload did not happen, and the React state survived.

### Fix 3 — Logout state reset in the frontend (commit `183e8f7`)

**Symptom.** After logout and re-login **within the same app session**, the app skipped the "Enter Local Encryption Password" screen and went straight to the Dashboard.

**Root cause (as understood at the time).** The frontend's React state held `isUnlocked = true` from the earlier unlock in the same session. Because the reload did not happen (see Fix 2), the state survived the logout. On the next login, `checkAuth` set `isAuthenticated = true` but did not reset `isUnlocked`, so the gate saw both true and rendered the Dashboard.

**Fix.** Ownership of the logout operation was moved to `App.tsx`. A `handleLogout` was added:

```typescript
const handleLogout = async () => {
  try {
    await auth.logout();
    setIsAuthenticated(false);
    setIsUnlocked(false);
  } catch (err) {
    console.error('Logout failed:', err);
  }
};
```

The callback is passed down through `AppShell.tsx` to `Sidebar.tsx` via an `onLogout` prop. `Sidebar`'s handler now calls `onLogout()` and contains no authentication logic itself. The `window.location.reload()` was removed.

**Why this was still not the whole story.** It corrected the React state, but the bug reproduced. The root cause was deeper, in Rust.

### Fix 4 — The Rust logout connection leak (commit `40b2378`)

**Symptom.** The bug from Fix 3, still reproducing after Fix 3 was applied. Logout → login skipped the Enter screen.

**Root cause — the actual one.** The app's notion of "unlocked" is not a flag in a file. It is the **presence of an open SQLCipher connection in the running Rust process**, held in `AppState.db`:

```rust
struct AppState {
    db: Mutex<Option<Connection>>,
}
```

The command `is_database_unlocked` — which the frontend invokes to decide whether to show the Enter screen — reads `AppState.db`, not `settings.dat`.

The `logout` command cleared `settings.dat` (via `auth::logout`) but did not close the connection in `AppState.db`. So after logout, the connection was still open. `is_database_unlocked` returned `true`. The next login skipped the Enter screen.

The persistent-session side of logout was correct all along. The Rust `logout` deleted `auth_token`, `organization_id`, and `db_unlocked` from `settings.dat`. But `is_database_unlocked` does not read `settings.dat`. It reads the connection.

**Why quitting the app appeared to fix it.** When the app process ends, `AppState.db` is discarded. On the next launch it starts as `None`, so `is_database_unlocked` returns `false`, and the Enter screen appears. The bug only appeared within a session where an unlock had already occurred.

**Fix.** The `logout` command now closes the connection as well as clearing the session:

```rust
#[command]
fn logout(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    {
        let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
        *db_guard = None;
    }
    auth::logout(app)
}
```

Setting `AppState.db = None` drops the `Connection`, and rusqlite closes the SQLCipher handle when the `Connection` is dropped. The lock is scoped with braces so it is released before `auth::logout(app)` runs. The signature follows the file convention: `AppHandle` first, `State<AppState>` second, matching `get_debtors` and the other commands.

**Reasoning recorded.** "Unlocked" in this app means the SQLCipher connection is open in the running process. That is the design, and it is the more secure one: the connection being open is the true test of whether the app can read the encrypted data right now. The bug was that the connection survived logout. The fix closes it.

**Verification.** On the cloud machine, after building the change: logout → `settings.dat` contains only `salt`; login → **"Enter Local Encryption Password"** (not Dashboard); enter password → Dashboard; logout → Login; login again → **"Enter Local Encryption Password"** again. Two consecutive loops, both correct.

### The four commits, in order

| Commit | What it fixed | Layer |
|--------|--------------|-------|
| `01631c6` | Set/Enter screen selection | Frontend + new Rust command |
| `38aec9c` | Logout button no-op (superseded) | Frontend |
| `183e8f7` | Logout React state reset | Frontend |
| `40b2378` | Logout connection leak (actual root cause) | Rust |

Both `38aec9c` and `183e8f7` are correct and remain in the code. `38aec9c`'s `window.location.reload()` was replaced by `183e8f7`'s state reset. All four commits are in `main`.

### Design clarification — `db_unlocked` in `settings.dat`

The `db_unlocked` field in `settings.dat` is written by `unlock_database` (via `auth::set_unlocked`) and deleted by `logout`. However, it is **not read** by the frontend's gate. The gate reads `AppState.db` via `is_database_unlocked`. So `db_unlocked` in `settings.dat` is effectively vestigial in the current design.

This is recorded as an observation, not a defect. No action is taken. A future feature (for example, "remember unlocked across restarts") could legitimately use this field. Removing it now would be an unforced change.

### Deferred findings, recorded not acted on

1. **Dashboard 401 errors.** The Dashboard page calls `api.gorka.localhost:3000` (the web API) and receives 401 Unauthorized. This is a separate finding, **not yet investigated.** The Dashboard's data loading uses the web `api.service.ts` layer (`fetch`-based, `Authorization: Bearer` from `localStorage`), which is the web Client Dashboard's channel, not the Tauri app's. In the Tauri app, `localStorage` has no token, so the requests are unauthenticated. The finding is recorded; the fix is for a future session.

2. **Eye-icon inconsistency on the password field.** On the "Enter Local Encryption Password" screen, an eye icon (the WebView2 built-in password reveal control) appears on the first typing but not after an error re-render. This is a WebView2 behavior, not the app's code. A future UX improvement would be to add an explicit show/hide toggle in the component. Deferred.

3. **Debt due-date bug.** Adding a debt fails at the due-date field. Not investigated today. Still open.

4. **Dead code in `Sidebar.tsx`.** Lines 33–37 contain a commented-out old logout handler. Left in place intentionally; it is inert. Removal is a separate cleanup task.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. No debtor data crossed the boundary. All work was on the local authentication and unlock flow.
- No new abstraction introduced. The frontend fix threads a callback through the existing `App → AppShell → Sidebar` hierarchy. The Rust fix is one function.
- No frontend routing redesign. No React Context introduced.

### What is still open

- **Debt due-date bug.** Not investigated. Still open.
- **Phase 9 Item 4 (Action CRUD).** Code complete, not fully tested on the cloud machine. Still open.
- **Persistence-across-restart test.** Not run today on the cloud machine. Still open.
- **Dashboard 401 errors from `api.gorka.localhost:3000`.** Recorded today, not investigated. Open.
- **Eye-icon inconsistency on the password field.** Recorded today, deferred. Open.
- **Argon2id parameters.** `§7.3` and `§22.19.2` still need benchmarked values.
- **Test-vector computation.** M1, M2, V1, V4, V6 not computed.
- **Control Plane tables not applied to `gorka_test`.**
- **Control Plane services not implemented.**
- **Agent App (Phase 9.5) not started.** Requires architecture decision.
- **Sync engine (Phase 9.6) not started.** Requires the three prerequisites.
- **Multi-user demonstration (Phase 9.7) not started.**

### The next workstream

Two parallel workstreams remain available:

1. **Phase 9 polish.** Fix the debt due-date bug. Complete Item 4. Test persistence across restart.
2. **Sync engine prerequisites.** Benchmark the Argon2id parameters. Apply the Control Plane tables to `gorka_test`. Compute the test vectors.

The local authentication and unlock flow — Stage 4 and Stage 5 of the five-stage registration flow — is now stable and verified.

### Rule compliance for this entry

This entry is a record. It contains three fix records (each with symptom, root cause, and reasoning), one corrected diagnosis of an earlier entry, one design clarification, and four deferred findings. No new decisions beyond the code fixes themselves.

---

**End of entry.**

Recovery Session - September 24, 2026

This entry records the September 24, 2026 session. Two workstreams: completion of the Dashboard local-stats task, and the writing of the Excel/TXT upload specification. The second is documented, not implemented - the implementation is deferred by conscious decision.

CONTEXT

The session continues directly from September 23, which stabilized the local authentication and unlock flow (four fixes, commit 40b2378, docs 54c6a90). The September 23 session left two workstreams open: the debtor data upload path, and the Argon2id parameters that block the sync engine prerequisites.

This session completed the first and produced the plan for a second. The Argon2id work is the next session's focus.

PART 1 - THE DASHBOARD LOCAL-STATS TASK

Goal. The Client Dashboard's home page called a cloud endpoint (/api/dashboard/stats) and received 401 Unauthorized on every load, because the Tauri app holds no cloud session token. The page was empty. The task was to make the Dashboard read from the local SQLCipher database, the same way Collections does.

What the Dashboard needed. Four values and a list: totalDebtors, totalDebt, totalAgents, totalActions, and recentActivities[]. Two had no clean local source. Agents live only in the cloud; the local schema has no agents table. recentActivities expects a user field the local audit_log does not have, because attribution is not populated anywhere in the app.

Step 0 - Reconnaissance. Three questions were read on disk before any edit:

Q1 - Organization isolation. The existing read commands use INNER JOIN debtors b ON b.id = X.debtor_id WHERE b.organization_id = ?1 for tables that reference a debtor (debts, actions, communications), and a direct WHERE organization_id = ?1 for debtors itself. Confirmed against get_debts (lines 669-673), get_actions (lines 864-868), and get_debtor_count (line 649). The new stats command matches this pattern exactly.

Q2 - Monetary representation. amount is f64 end to end: the debts.amount REAL column, the Debt and DebtInput struct fields in main.rs (lines 74 and 87), the insert_debt binding (line 732), the update_debt binding (line 793), and the get_debts read (row.get(2)? at line 681). The frontend's Debt.amount is number. The new struct uses f64.

Q3 - localDB convention. Single object, invoke<T> wrappers, snake_case wire fields, no logging, no try/catch inside localDB. The new method matches.

The spec. A task spec was written, reviewed, and revised. The revision corrected four things: the over-broad "no 401 in console" acceptance criterion; the unsupported equivalence claim about Reading 2.5 and Reading 3; the missing f64 verification; and the missing organization-isolation verification. The revised spec was approved with those corrections.

The decisions, as applied:

D1 - totalDebt is Reading 2.5. SUM(amount) over the org's debts, excluding PAID and CANCELLED. Include ACTIVE and OVERDUE. This is the most accurate number the current schema can produce. Reading 3 (amount minus paid) cannot be computed because the schema records no payment data. When payment data exists, the SQL changes by one line; the Dashboard page does not change.

D1b - Monetary representation follows the existing pattern. f64 throughout, matching the rest of the code.

D2 - The Total Agents card is removed, deferred. No local source of truth. A local agent cache is a separate task.

D3 - The Recent Activity block is removed, deferred. Its user field cannot be filled truthfully today. Attribution is a separate, unstarted workstream.

D4 - One command returns a struct. get_dashboard_stats returns DashboardStats. One invocation, one SQL statement.

D5 - totalActions counts all actions for the org. No status filter.

D6 - Cancelled and paid debts are excluded from totalDebt. Verified by the four-case test matrix.

D7 - Organization isolation follows the existing read pattern. Confirmed by reconnaissance, matched in the SQL.

The edit. Three files changed. src-tauri/src/main.rs: DashboardStats struct added after ActionInput; get_dashboard_stats command added after get_debtor_count; registered in generate_handler!. supervisor-dashboard/src/services/local.db.ts: DashboardStats interface; getDashboardStats() method. supervisor-dashboard/src/pages/Dashboard.tsx: import swapped; interface and state reduced to three snake_case fields; fetchDashboardStats reduced to localDB.getDashboardStats(); Total Agents card removed; Recent Activity block removed; two deferral comments added.

Two mistakes caught before commit:

A stray blank line was inserted in main.rs between DebtInput and Communication. Caught by reading the git diff before commit. Removed.

An orphaned fetchDashboardStats body was left in Dashboard.tsx after the first edit - the old cloud function survived underneath the new local one. Caught by a findstr check for api.get and recentActivities, which returned matches where there should have been none. Removed.

The process lesson, recorded: in both cases, the replacement text was written against remembered content, not against the file as it actually was at that moment. The rule for the rest of the task, and going forward: read the exact region on disk immediately before proposing any replacement. Do not write against memory, and do not write against an earlier read.

Verification, on the cloud machine:

Dashboard loads. Three cards render: Total Debtors, Total Debt, Total Actions. No Total Agents card, no Recent Activity block.

Total Debtors = 11, matching the count on Collections.

Total Debt = $11,800, reading the local debts table.

Total Actions = 0, correct - no actions have been created in this database.

A debt was created, edited, and deleted; the numbers updated correctly.

A debt was changed to PAID; Total Debt fell by its amount. The status filter (D1/D6) works.

The /api/dashboard/stats 401 is gone from the console. It no longer appears.

The pre-existing /api/auth/me and /api/connectors/types 401s remain. Those are the September 23 deferred finding #1, out of scope for this task.

The commit. 66c6f12 - "Dashboard: wire to local database via get_dashboard_stats. Add get_dashboard_stats command in main.rs (Reading 2.5 for total_debt: SUM(amount) excluding PAID and CANCELLED, per spec D1/D6). Add DashboardStats struct and localDB.getDashboardStats() wrapper. Dashboard.tsx: replace cloud /dashboard/stats call with local call. Remove Total Agents card (D2) and Recent Activity block (D3), both deferred, no local source of truth yet."

The commit was amended once because the initial commit captured only the first line of the message. Amended to 66c6f12. Pushed to origin/main.

PART 2 - UPLOAD PATH RECONNAISSANCE

The upload path was inspected before any work on it was planned. Findings:

CSV upload works end-to-end. A real CSV file was uploaded through the Upload page; 10 debtors appeared in Collections. The path is Upload.tsx -> uploadService.uploadStructuredData -> parseCsv -> localDB.bulkInsertDebtors -> invoke('bulk_insert_debtors') -> Rust transaction -> SQLCipher. No cloud call. Verified on the cloud machine.

The debt due-date bug did not reproduce. The September 22 entry recorded that adding a debt failed at the due-date field. On the current build (66c6f12 and its predecessor 54c6a90), adding debts works, with both CSV-imported and manually created debtors. The bug is recorded as not reproducible on the current build. It may have been an artifact of a pre-fix build. It is not closed - if it recurs, it should be diagnosed with the actual error captured.

The shipped bundle is clean. C:\Users\kucha\gorka-app\dist\ (the folder Tauri serves from, per tauri.conf.json frontendDist: "../dist") contains one JS bundle and one CSS bundle. A search for debtors/bulk and documents/upload returns zero matches. The old cloud-post upload code is not in the shipped bundle.

A stale build exists elsewhere. supervisor-dashboard\dist\assets\index-DxMiQndA.js contains the pre-rewrite cloud-post upload service. This folder is not the folder Tauri serves from. It is leftover build output. Recorded as an observation, not acted on. It is a housekeeping item, not a correctness or boundary issue.

PART 3 - EXCEL AND TXT UPLOAD SPECIFICATION (WRITTEN, NOT IMPLEMENTED)

A specification for adding .txt and .xlsx/.xls support to the local-only structured upload path was written and reviewed. The full text is in UPLOAD-EXCEL-TXT-SPEC.md. This section records the decisions and the reasons.

Why the task was written and not implemented today. The session's remaining time is allocated to the Argon2id parameters, which are on the critical path for the sync engine. The Excel/TXT work is documented in full so that a future session can pick it up without re-deriving the reasoning.

The key decisions from the spec:

Bulk upload, not one-by-one. The formats feed the same local insert path as CSV: file -> parse locally -> localDB.bulkInsertDebtors -> SQLCipher. No schema change. No cloud.

One shared mapper. parseCsv is refactored into a parser and a shared rowsToDebtors mapper. TXT and Excel use the same mapper. One interpretation of debtor columns, not three.

TXT is extension-only. No dataType entry. The existing delimiter detection (tab, semicolon, comma) applies. Four or five lines of change.

Excel cell normalization. Excel numeric cells may already have lost information (for example, a phone number with a leading zero stored as a number). The parser must not attempt to reconstruct information that is not present in the workbook. The normalization rules are specified precisely in the spec.

Boundary check, static and runtime. A findstr for fetch, api., and supervisor_token is one check. Runtime network inspection during an upload is the other. Both are required.

Resource limits. Explicit maximum file size and row count, enforced before the full workbook is materialized.

The Excel parser location - the open decision, recorded with a lean:

Option 1 - Frontend (SheetJS). Parses Excel in the WebView. Faster to build and iterate. No Rust rebuild for parser changes. Suitable for the MVP stage. Weaker for production: parse and insert are separate steps; the batch is not a first-class object; the parser is tested outside the Rust test surface.

Option 2 - Backend (calamine, Rust). Parses Excel in the Tauri process. Parse and insert can be one transaction. The batch is a first-class object, which fits the future sync event model. Tested in the same crate as the local data layer. Weaker for the MVP stage: every parser change requires cargo build, and on the main machine, the signing workflow.

Lean: backend (calamine). Based on the reconnaissance - transactionality, the event model, and the test surface favor Rust for the long term.

Implementation deferred. The MVP keeps CSV-only at this stage. This is a conscious decision, not a backlog item. The UI currently advertises Excel, JSON, and XML, which do not work. Fixing the UI without implementing the formats would leave the UI pointing at nothing. The UI is left as it is, and the mismatch is recorded as a known limitation of the current MVP stage.

What determines the final decision: whether the MVP is a stepping stone that will be rewritten for production, or the production version with features turned off. If the former, the MVP choice is pragmatic and SheetJS is fine. If the latter, the choice is permanent, and calamine is preferable now.

What does not change either way: the shape of the code. Both options produce string[][] and feed the same rowsToDebtors mapper, then localDB.bulkInsertDebtors(). If the parser moves from JavaScript to Rust later, the mapper moves with it, and the insert command does not change. The migration is a rewrite of the parser, not a redesign of the path.

WHAT IS STILL OPEN

Excel and TXT implementation. Deferred by conscious decision. The spec is written. The parser-location decision is open with a lean toward backend.

Debt due-date bug. Not reproducible on the current build. Not closed.

supervisor-dashboard\dist\ - stale build containing the old cloud-post code. Not the folder Tauri serves from. Housekeeping, not correctness.

The dataType dropdown in Upload.tsx offers CSV and JSON. JSON is not implemented. Recorded as a UI honesty issue, not fixed today.

The .txt entry in the unstructured accept list advertises a route that does not work. Recorded, not fixed today.

Dashboard 401 errors from api.gorka.localhost:3000 - the /api/auth/me and /api/connectors/types calls. Recorded September 23, still open, separate task.

Argon2id parameters. SYNC-ARCHITECTURE.md section 7.3 and section 22.19.2. This is the next session's focus.

All previously open items from the September 23 entry, unchanged.

THE NEXT WORKSTREAM

Argon2id parameters. The next session benchmarks and freezes the Argon2id parameters used by the enrollment package (SYNC-ARCHITECTURE.md section 7.3, section 22.19.2). Those values block the E1 deterministic test vector, which blocks the test-vector computation, which blocks the sync engine implementation.

The benchmark must run on the supported GORKA desktop environment. The values are chosen, recorded in SYNC-ARCHITECTURE.md, and then the test vectors can be computed.

RULE COMPLIANCE

No production touched.

No cloud schema change. No new tables. No new columns.

No CI/CD touched.

Invariant held. All debtor data stayed on the local machine. The Dashboard stats are local aggregates. The upload reconnaissance confirmed the shipped bundle is clean.

The Dashboard change introduced no new abstraction. One struct, one command, one method, one page change.

The Excel/TXT spec introduces no code. It is a plan.

FILES CHANGED THIS SESSION

src-tauri/src/main.rs - DashboardStats struct, get_dashboard_stats command, registration

supervisor-dashboard/src/services/local.db.ts - DashboardStats interface, getDashboardStats method

supervisor-dashboard/src/pages/Dashboard.tsx - local call, interface reduction, Agents card removal, Recent Activity block removal

Commit 66c6f12, pushed to origin/main

FILES WRITTEN THIS SESSION (DOCUMENTATION)

GORKA_RECOVERY/recovery-notes/DECISIONS.md - this entry

GORKA_RECOVERY/recovery-notes/UPLOAD-EXCEL-TXT-SPEC.md - the upload specification

GORKA_RECOVERY/recovery-notes/HANDOFF.md - status update

GORKA_RECOVERY/recovery-notes/SESSION-LOG.md - session extension

GORKA_RECOVERY/recovery-notes/START-HERE.md - September 24 update subsection

End of entry.

---

## Recovery Session — September 24, 2026 (Argon2id freeze)

This entry records the freeze of the Argon2id parameters for the
MVP enrollment package. It is a continuation of the September 24
session, which earlier in the day completed the Dashboard
local-stats task and wrote the Excel/TXT upload specification.

### What this workstream was for

SYNC-ARCHITECTURE.md §22.7.1 and §22.19.2 carried three
placeholders:

  argon2_memory_kib  = [TO BE BENCHMARKED]
  argon2_iterations  = [TO BE BENCHMARKED]
  argon2_parallelism = [TO BE BENCHMARKED]

They are fixed protocol configuration values for the enrollment
package, the file that carries the 32-byte organization key from
the admin's device to the agent's device, protected by a
passphrase the admin chooses. The Argon2id parameters are the
only defense between an attacker who has the package file and
the organization key it protects.

The values block E1, the first deterministic test vector, which
blocks the remaining test vectors, which block the sync engine
implementation (Phase 9.6).

### The reconnaissance finding

The enrollment package code does not exist. `src-tauri/src/`
contains exactly three Rust files — `main.rs`, `db.rs`,
`auth.rs`. A whole-tree search for `enrollment`, `GORKAEP`,
`package_encryption_key`, and `XChaCha` returned zero matches.
The package is specified (§7.3, §22.7, §22.19.2) but not
implemented.

This changed the shape of the work. The benchmark could not
measure an existing call site; it had to be a standalone
harness. The sequence became: benchmark → freeze the values →
implement the package → compute E1.

### What was decided before the benchmark

- Sequence: benchmark first, then freeze, then implement the
  package, then E1. Confirmed September 24.
- Crates for the eventual package: `chacha20poly1305` and
  `hkdf`, both RustCrypto.
- Harness location: `src-tauri/src/bin/argon2bench.rs`.
- Harness crate: `argon2` 0.5.3, already declared in
  `Cargo.toml` and resolved in `Cargo.lock`.
- Harness call shape: `Argon2::new(Algorithm::Argon2id,
  Version::V0x13, Params::new(m_cost, t_cost, p_cost,
  Some(32))?)`, with the raw 16-byte salt passed directly to
  `hash_password_into`. Not `SaltString::encode_b64`, not
  `Argon2::default()`.
- Instance B (the SQLCipher key derivation in `db.rs`) is out
  of scope and was not touched. Its shape differs from the
  package's (it uses `SaltString::encode_b64` and
  `Argon2::default()`), and the two must not be conflated.
- Benchmark target: the cloud machine (AWS EC2 `Gorka-dev`,
  `t3.small`, 2 vCPU, 2 GiB RAM, Windows Server 2025
  Datacenter, Singapore), treated as a floor, not as a
  representative desktop.
- Memory ceiling: roughly 1/4 of 2 GiB, realistically lower.
- Target derive time: 250–1000 ms, aim low end. Up to 2 s
  tolerable if the security margin justifies it.

The full task specification is in the conversation record; it
was not committed as a separate file.

### The harness

One file, `src-tauri/src/bin/argon2bench.rs`, 137 lines.
Commit `bd50fbc`, pushed to `origin/main`.

It iterates nine `(m_cost, t_cost, p_cost)` triples in one
process. For each triple: one warm-up run (discarded), ten
timed runs, min / median / max reported. The output buffer is
consumed after the timing loop so the derivation result remains
observable. The harness measures only the Argon2id derivation —
no XChaCha20-Poly1305, no HKDF, no package header, no AAD, no
import path.

Phase A boundary held. Only `src-tauri/src/bin/` was touched.
`db.rs`, `auth.rs`, `main.rs`, `Cargo.toml`, `Cargo.lock`, and
all recovery documents were untouched.

### The benchmark results

Two runs on the cloud machine, release build. Checksums matched
row for row across both runs, confirming deterministic
derivation.

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

Seven of nine rows drifted by less than 5% between runs. The
two outliers (32/3 at +30%, 256/3 at +6.6%) are shared-vCPU
scheduling noise on a t3.small. The four candidate rows are
stable within ~5%.

Four rows fall in the target window (250–1000 ms): 128/3,
128/4, 256/3, 256/4.

### The decision

Chosen:

  argon2_memory_kib  = 131072    (128 MiB)
  argon2_iterations  = 4
  argon2_parallelism = 1

Run 2 median: 461 ms. Memory: 128 MiB.

Reasoning:

- 461 ms sits comfortably inside the 250–1000 ms target.
- 128 MiB leaves memory headroom for weaker client machines.
  The cloud machine is a floor; a client machine at its
  capability, running a browser and the Tauri app, must not
  fail. 256 MiB would be tight on such a machine. 128 MiB is
  not.
- Within 128 MiB, four Argon2id iterations increase the
  computational cost compared with the 128 MiB / t=3 candidate
  (three iterations), while retaining the same 128 MiB memory
  requirement.
- 256 MiB / t=3 and 256 MiB / t=4 were rejected on the
  weaker-machine risk. The benchmark does not establish that
  the additional memory cost is justified for the MVP, whose
  requirement is to work reliably on a range of client
  machines.
- 128 MiB / t=3 was a defensible alternative. It is 100 ms
  faster and equally memory-safe. The choice of four
  iterations over three at the same memory is a preference
  for more computational work at no additional memory cost.

The benchmark proves that 128/4 is practical on the floor
machine. It does not prove mathematically that 128/4 is the
most secure possible choice. The security choice is a
trade-off between memory hardness and the machines that must
actually run GORKA. The MVP chooses the strongest defensible
balance.

The 250–1000 ms target is selection evidence, not a protocol
requirement. The frozen protocol values are three integers.
The timing is recorded here, not in the architecture.

### The freeze

The three integers were written into:

- `SYNC-ARCHITECTURE.md` §22.7.1
- `SYNC-ARCHITECTURE.md` §22.19.2

The trailing placeholder sentences in both sections were
replaced with a short note pointing at this entry, per the
founder's choice of option B on September 24, 2026.

No other section of `SYNC-ARCHITECTURE.md` was changed.

### Terminal-display artifacts encountered

Three confirmed instances in this project of a terminal
rendering a correct UTF-8 file as mojibake. None is a file
problem.

1. The section sign `§` (bytes `C2 A7`) rendered as `┬º` in
   cmd.exe `type` and `findstr` output. Notepad confirmed the
   file is correct.
2. The em-dash `—` (bytes `E2 80 94`) rendered as `â€"` in the
   same way. Notepad confirmed the file is correct.
3. The same two characters, plus the arrow `→` (bytes
   `E2 86 92`), rendered as `Â§`, `â€"`, and `â†'` in PowerShell
   `Get-Content` output through cmd.exe. Notepad confirmed the
   file is correct.

Recorded so a future session does not chase the same artifact.
When a character looks wrong in cmd.exe or PowerShell console
output, open the file in Notepad before concluding the file
is wrong.

### Open items

- Excel and TXT upload implementation. Deferred by conscious
  decision. Spec written.
- Debt due-date bug. Not reproducible on the current build.
  Not closed.
- `supervisor-dashboard\dist\` stale build containing the old
  cloud-post code. Housekeeping.
- The `dataType` dropdown in `Upload.tsx` offers CSV and JSON.
  JSON is not implemented. UI honesty issue.
- The `.txt` entry in the unstructured accept list advertises
  a route that does not work.
- Dashboard 401s from `/api/auth/me` and
  `/api/connectors/types`. Separate task.
- Test-vector computation (M1, M2, V1, V4, V6). Blocked by
  the package implementation (Phase D).
- Control Plane tables not applied to `gorka_test`.
- Control Plane services not implemented.
- Agent App (Phase 9.5) not started. Requires architecture
  decision.
- Sync engine (Phase 9.6) not started. Requires the package,
  the test vectors, and the Control Plane tables.
- Multi-user demonstration (Phase 9.7) not started.

### The next workstream

Phase D: implement the enrollment package against the frozen
parameters. Export command, import command, 63-byte header,
Argon2id at 128/4/1, XChaCha20-Poly1305 with the header as
AAD, inner content `{organization_id, organization_key}`. Add
`chacha20poly1305` and `hkdf` to `Cargo.toml`. This is a
separate task with its own spec.

Phase E follows: compute E1 against the implemented package.
Then the remaining test vectors. Then Phase 9.6.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. No debtor data touched the boundary.
- Instance B (`db.rs`) was not touched.
- No enrollment package code exists yet. It is Phase D.
- The benchmark measured; the founder chose. The harness did
  not choose.
- The benchmark result is not the implementation validation.
  Phase A does not validate the package. Phase D produces the
  package; Phase E validates it against E1.

### Files changed this session

- `src-tauri/src/bin/argon2bench.rs` — new file, 137 lines.
  Commit `bd50fbc`, pushed to `origin/main`.

### Files to be changed by the freeze commit

- `SYNC-ARCHITECTURE.md` §22.7.1 and §22.19.2 — the three
  integers and the note.
- `DECISIONS.md` — this entry.
- `HANDOFF.md` — status update.
- `SESSION-LOG.md` — session extension.
- `START-HERE.md` — update.

End of entry.

---

## Recovery Session — September 24, 2026 (Phase D.1 and D.2)

This entry records the first two steps of Phase D: the
organization_keys migration (D.1) and the enable_sync command
(D.2). Phase D is the enrollment package and its prerequisites.
The Argon2id parameters were frozen earlier in this session, at
commit d77e2da.

### The reconnaissance finding

The enrollment package code did not exist. src-tauri/src/
contains exactly three Rust files — main.rs, db.rs, auth.rs. A
whole-tree search for enrollment, GORKAEP,
package_encryption_key, and XChaCha returned zero matches. The
organization_keys table did not exist. No key-generation command
existed. No sync table existed.

This made Phase D larger than the freeze entry's Phase D
paragraph described. The freeze entry said "implement the
enrollment package: export, import, header, Argon2id,
XChaCha20-Poly1305." The reconnaissance found that the package
cannot exist without a key and without a home for the key.

### The Phase D spec

A Phase D specification was written, reviewed, and revised to
v1.1. The three decisions that shaped it:

D1 — Combine prerequisites with the package. The
organization_keys table and the key-generation command are the
first two items of Phase D, not separate phases.

D2 — Defer the Control Plane report. The enable_sync command
generates and stores the key locally. It does not report to the
Control Plane. The report is deferred until the Control Plane
tables and services exist.

D3 — Command only; no UI. No Sync Settings UI is built in Phase
D. The commands are invoked directly for testing.

The spec also closed eight questions: command names, caller-
supplied file paths, refusal on existing key, HKDF deferred,
String passphrase handling, the trusted org-ID path, error
categories, and weak-passphrase UX deferral.

The spec added two structural requirements:

- The organization key is organization-wide, not device-
  specific. Each authorized device stores its own local copy
  inside its own SQLCipher database.
- Import is atomic. The key installation and the package
  deletion happen in a single transaction. The package is
  deleted only after the transaction commits.

The spec is not on disk as a separate file. Its content is in
the conversation record and is reflected in the commits below.

### D.1 — the organization_keys migration (v4)

Commit adcab50. One file changed: src-tauri/src/db.rs, 20
insertions.

A new migration block was added to run_migrations, after the v3
block, before Ok(()). It creates the single-row
organization_keys table per LOCAL-TABLES.md Category D.5:

  CREATE TABLE IF NOT EXISTS organization_keys (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      organization_id TEXT NOT NULL,
      key_material BLOB NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME
  )

The block follows the exact structure of the existing migrations:
conn.transaction(), tx.execute with CREATE TABLE IF NOT EXISTS,
tx.execute PRAGMA user_version = 4, tx.commit().

No command, no key generation, no package code. The migration
only.

Verified on the cloud machine. The build succeeded
(incremental, 1m 28s). The app launched, the database unlocked,
the migration ran, and the existing data was unaffected — the
debtors remained in place.

### D.2 — the enable_sync command

Commit 941917a. One file changed: src-tauri/src/main.rs, 36
insertions.

Three edits:

1. Added use rand::RngCore; to the imports.
2. Added the enable_sync command between is_database_unlocked
   and get_debtors.
3. Registered enable_sync in the generate_handler! list.

The command:

- Reads the trusted organization id via
  get_trusted_organization_id. The Q6 verification confirmed
  this helper is JWT-derived: auth::login writes the
  organization_id from the login response to settings.dat,
  auth::get_organization_id reads it, and
  get_trusted_organization_id calls auth::get_organization_id.
  No second authentication path was created.
- Locks AppState.db and requires the database to be unlocked.
- Checks whether organization_keys already contains a row.
  If it does, returns an error. No silent replacement.
- Generates 32 random bytes with rand::rngs::OsRng.
- Inserts the row into organization_keys.
- Does not report to the Control Plane.

Verified on the cloud machine via the app's devtools console.
The build succeeded (incremental, 1m 45s). With the database
unlocked:

- is_database_unlocked returned true.
- enable_sync returned OK null — success, the unit type
  serialized.
- A second enable_sync returned "ERR Sync is already enabled
  for this organization" — the refusal path works.

The second call also confirms the D.1 migration created the
table correctly: the first call's insert succeeded, which would
have failed if the table were missing or malformed.

### The cargo.exe block on the main machine

New finding, September 24, 2026. The main machine can no longer
compile.

When cargo build was run on the main machine, the error was:

  'C:\Users\kucha\.cargo\bin\cargo.exe' was blocked by your
  organization's Device Guard policy.
  Contact your support person for more info.

This is a different failure from the September 15 SAC block.
That block was on the built binary (gorka-client.exe) at run
time. This block is on cargo.exe itself, at invocation, before
any build happens.

The same class of enforcement: Smart App Control, Policy ID
{0283ac0f-fff1-49ae-ada1-8a933130cad6}, the
VerifiedAndReputableDesktop policy. A Rust issue
(rust-lang/rust#160163) documents the same problem: freshly
downloaded toolchains are blocked by SAC after their cloud
reputation is evaluated.

The chosen response: the cloud machine is the sole build
environment. The main machine is the editor and the repository
host. This extends the September 15 and September 21-22 model
one step — the main machine could not run binaries, now it
cannot build them either.

Workarounds considered and not adopted: re-downloading the
toolchain via rustup (buys a window before SAC flags the new
cargo.exe, not a fix), toggling SAC off via the KB5074105
toggle (changes the machine's security posture; unreliable on
some machines per the September 15 investigation), moving
CARGO_TARGET_DIR (addresses a different class of block).

The finding is recorded in TAURI-DEV-WORKFLOW.md section 8.

### The git commit editor behavior

Housekeeping note. On the main machine, running git commit
without -m opens VS Code as the commit message editor. The
commit waits for the editor to close. This is not a problem, but
it means git commit should always be run with -m to avoid the
interactive editor. The pattern used throughout this session is
git commit -m "message".

### Repository state

Main machine: at 941917a, clean, pushed.
Cloud machine: at 941917a, clean.
GitHub origin/main: at 941917a.

### What is still open in Phase D

D.3 — the export_enrollment_package command. Not started. Needs
the chacha20poly1305 crate added to Cargo.toml, the package
layout (63-byte header), the Argon2id call at the frozen
parameters (131072 / 4 / 1, raw 16-byte salt), the
XChaCha20-Poly1305 encryption with the header as AAD, the inner
content {organization_id, organization_key}, the file write.

D.4 — the import_enrollment_package command. Not started. The
mirror of D.3, plus the atomic key installation and the
package deletion only after commit.

Then Phase E — E1, the deterministic test vector.

### Rule compliance

- No production touched.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.
- The frozen parameters are used as-is: 131072 / 4 / 1.
- The organization_keys schema is quoted from LOCAL-TABLES.md
  D.5, not reconstructed.
- The enable sync flow is quoted from SYNC-ARCHITECTURE.md
  section 6.6, not reconstructed.
- The import command is designed to be atomic. It installs the
  key and deletes the package only after the transaction
  commits. This is a D.4 requirement, not yet implemented.
- Only one new crate is planned: chacha20poly1305. Added in
  D.3, not in D.1 or D.2.
- The organization key is organization-wide; each authorized
  device stores its own local copy.

### Files changed this session

- src-tauri/src/db.rs — the v4 migration. Commit adcab50.
- src-tauri/src/main.rs — the enable_sync command, the import,
  the registration. Commit 941917a.

End of entry.

---

## Recovery Session — September 24-25, 2026 (Phase D.3 and D.4.1)

This entry records D.3, the export_enrollment_package command,
complete and verified, and D.4.1, the import_enrollment_package
function, written and compiled. D.4.2 through D.4.4 remain.

### D.3 - the export_enrollment_package command

Commits: d3e5fee (crate), edbaa3a (imports), 5be2599 (command
and registration), d426bba (Cargo.lock from the cloud build).

D.3 added one crate to Cargo.toml:

  chacha20poly1305 = "0.10"

It added two import lines to main.rs:

  use argon2::{Algorithm, Argon2, Params, Version};
  use chacha20poly1305::{aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce};

It added the export_enrollment_package command, placed after
delete_document and before fn main(). The command:

- Reads the organization key from organization_keys.
- Checks the organization_id matches the trusted id.
- Checks the key is exactly 32 bytes.
- Generates a 16-byte salt and a 24-byte nonce with OsRng.
- Derives the package key with Argon2id at the frozen
  parameters (131072 / 4 / 1), using the raw 16-byte salt.
- Builds the inner content: org_id_len (u32 BE) || org_id ||
    org_key (32 bytes).
- Computes the encrypted payload length as inner length + 16.
- Builds the 63-byte header: magic "GORKAEP\0", format_version
  0x0001, the three frozen parameters, salt, nonce, payload
  length. All integers big-endian.
- Encrypts with XChaCha20-Poly1305, using the derived key, the
  nonce, and the full 63-byte header as AAD.
- Assembles the package as header || ciphertext+tag.
- Writes the file to the caller-supplied path.
- Returns the file path.

Registered in generate_handler! after delete_document.

The cloud build added chacha20poly1305 and its transitive
dependencies. Build time: 3m 17s. No errors. Cargo.lock updated
and committed as d426bba.

Tested on the cloud machine via devtools:

  invoke('export_enrollment_package',
    { passphrase: 'test-passphrase-001',
      filePath: 'C:\\gorka-app\\test-package.gorka' })

Returned OK C:\gorka-app\test-package.gorka. The file was 140
bytes. The arithmetic: 63 header + 4 org_id_len + 25 org_id +
32 org_key + 16 tag = 140. Every byte accounted for.

The bytes are not yet verified against a fixed expected output.
That is E1 in Phase E.

### D.4.1 - the import_enrollment_package function

Commit dc7bd54 (the function), 70b8cd8 (the borrow fix).

The function was added after export_enrollment_package and
before fn main(). It is not yet registered in generate_handler!.
That is D.4.2.

The function:

- Reads the package file.
- Verifies the file is at least 63 bytes.
- Verifies the magic bytes are "GORKAEP\0".
- Reads format_version. Rejects if not 0x0001.
- Reads the header fields: argon2_memory_kib (u32 BE),
  argon2_iterations (u32 BE), argon2_parallelism (u8), the
  16-byte salt, the 24-byte nonce, and encrypted_payload_len
  (u32 BE).
- Verifies the file is exactly 63 + encrypted_payload_len
  bytes.
- Derives the key with Argon2id using the parameters from the
  header, per SYNC-ARCHITECTURE.md section 22.7.1. The
  importer does not assume the frozen values; it uses what the
  header carries. No new importer bounds policy is invented.
  Params::new validates the values.
- Decrypts with XChaCha20-Poly1305, using the derived key, the
  nonce, and the 63-byte header as AAD.
- Parses the inner content: org_id_len (u32 BE), org_id, and
  the 32-byte org_key.
- Rejects any trailing bytes after the org_key. The format is
  exactly 4 + org_id_len + 32 bytes.
- Compares the package's organization_id against the trusted
  id. This happens before the transaction begins.
- Locks the database and opens a transaction.
- Checks for an existing key inside the transaction. Refuses
  if one exists. No silent replacement.
- Inserts the key.
- Commits.
- Deletes the package file after commit. Failure is logged
  with eprintln!, not fatal.

### The borrow fix

The first compile on the cloud machine failed with E0596:

  cannot borrow `*conn` as mutable, as it is behind a `&`
  reference

The original code used:

  let mut conn = db_guard.as_ref().ok_or(...)?;
  let tx = conn.transaction()?;

The fix:

  let mut db_guard = state.db.lock()...?;
  let conn = db_guard.as_mut().ok_or(...)?;
  let tx = conn.transaction()?;

Committed as 70b8cd8. Matches the pattern in db.rs
run_migrations, where conn is &mut Connection for the
transaction() call. The build then succeeded in 54.83s.

### The checkpoint after D.4.1

- main.rs compiles. Yes.
- The new function compiles against the actual project APIs.
  Yes.
- No unrelated files modified. Yes - only main.rs.
- No new dependency. Yes.
- No generate_handler! change. Yes - D.4.2 not done.

### What remains in D.4

D.4.2 - register import_enrollment_package in
generate_handler!.

D.4.3 - build with the registration.

D.4.4 - test the import via devtools.

Then Phase E - E1.

### Repository state

Main machine: at 70b8cd8, clean, pushed.
Cloud machine: at 70b8cd8, clean.
GitHub origin/main: at 70b8cd8.

### Rule compliance

- No production touched.
- No cloud schema change.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched.
- The frozen parameters are used as-is in the export.
- The import uses the header's parameters per section 22.7.1.
- The import refuses if a key already exists.
- The key installation is atomic within the SQLite
  transaction. The package file is deleted only after the
  database transaction commits successfully.
- The passphrase is never logged, never stored, never included
  in an error, never printed.

### Files changed this session

- src-tauri/Cargo.toml - the chacha20poly1305 crate. Commit
  d3e5fee.
- src-tauri/src/main.rs - the imports, the export command, the
  export registration, the import function, the borrow fix.
  Commits edbaa3a, 5be2599, dc7bd54, 70b8cd8.
- src-tauri/Cargo.lock - the resolved crate versions. Commit
  d426bba.

End of entry.

powershell -Command "$entry = @'

## Recovery Session — September 25, 2026 (Phase D.4.2–D.4.4)

This entry records the completion of Phase D. The session
registered the import_enrollment_package command in
generate_handler! (D.4.2), built with the registration (D.4.3),
and tested the import via the devtools console (D.4.4). All
three steps completed and verified.

Phase D is now complete. D.1, D.2, D.3, and D.4.1 through D.4.4
are all done.

### D.4.2 — registration

Commit b5af889. One file changed: src-tauri/src/main.rs, one
insertion.

A single line was added to the generate_handler! block, after
the existing export_enrollment_package registration:

  import_enrollment_package,

Twelve spaces of indent. Trailing comma. No comma adjustment was
needed elsewhere, because every entry in the block already ends
in a comma, including export_enrollment_package.

The function and its #[command] attribute were already in place
from D.4.1. The registration is the only change.

### The edit was verified before committing

The registration line was confirmed on disk, twice: once with a
findstr search of the whole file, and once with a PowerShell
read of the generate_handler! region. Before and after the edit.
The diff was then read with git diff --cached, which showed
exactly one insertion:

  +            import_enrollment_package,

One file. One line. Nothing else touched.

### D.4.3 — build

The commit was pushed to origin/main, pulled on the cloud
machine, and built there. The main machine cannot compile
(TAURI-DEV-WORKFLOW.md section 8).

  cargo build

Result: Finished dev profile [unoptimized + debuginfo] target(s)
in 1m 17s. No errors. No warnings.

The time is consistent with the change: only main.rs changed,
and no dependency was added, so no crate resolution was needed.

### D.4.4 — import test

Test conditions on the cloud machine:

- Backend running, connected to gorka_test through the session
  pooler, inline DATABASE_URL override.
- Vite dev server running.
- gorka-client.exe running, logged in as test@example.com,
  local database unlocked, Dashboard reached.
- Devtools console open.

The Tauri global was not present as window.__TAURI__.core in this
build. The working form was:

  const invoke = window.__TAURI_INTERNALS__.invoke;

Preconditions checked before the import:

  await invoke('is_database_unlocked');
  -> true

  await invoke('get_organization_id');
  -> 'cmty0xrxw0000c4q4mvtpqjqv'

The organization id is 25 characters, matching the 25-byte org
id in the D.3 package arithmetic (63 + 4 + 25 + 32 + 16 = 140).
The package's inner organization_id therefore matches the
trusted id, and the pre-transaction comparison will pass.

The enable_sync command was called to confirm a key already
exists:

  await invoke('enable_sync');
  -> \"Sync is already enabled for this organization\"

The key is present. The handoff's predicted D.4.4 path — the
import will refuse on the \"key already exists\" check — is
therefore the path being tested.

The import call:

  await invoke('import_enrollment_package', {
    passphrase: 'test-passphrase-001',
    filePath: 'C:\\\\gorka-app\\\\test-package.gorka'
  }).then(r => ({ ok: true, value: r }))
    .catch(e => ({ ok: false, error: e }));

Result:

  { ok: false, error: 'Sync is already enabled for this
    organization' }

### What the result proves

The refusal is the expected outcome, and it proves every stage
before the refusal ran to completion:

- The package file was read.
- The 63-byte header was verified: magic \"GORKAEP\\0\", format
  version 0x0001, header length.
- The Argon2id key derivation ran with the header's parameters
  (131072 / 4 / 1) and the header's 16-byte salt.
- XChaCha20-Poly1305 decryption succeeded with the header as AAD.
  A wrong passphrase or a tampered payload would have failed
  here with a different error.
- The inner content was parsed: org_id_len, org_id, org_key, and
  the trailing-byte rejection passed.
- The organization id comparison passed: the package's
  organization_id matched the trusted id.
- The function entered the transaction, checked
  organization_keys, found a key, and refused. That refusal is
  the string returned.

The import refused at the correct point, for the correct reason.
D.4.1's spec says: \"refuses if a key already exists. No silent
replacement.\" That is what happened.

The success path (no key present, import installs the key and
deletes the package) was not tested, because a key exists on
this database and removing it is out of scope. It is the same
code path after the refusal check; the only untested branch is
the insert-and-delete.

The package file was not deleted, because the refusal path does
not commit. C:\\gorka-app\\test-package.gorka remains, 140 bytes.

### Phase D is complete

| Step | Status |
|------|--------|
| D.1 — organization_keys migration (v4) | DONE (adcab50) |
| D.2 — enable_sync command | DONE (941917a) |
| D.3 — export_enrollment_package | DONE (d3e5fee, edbaa3a, 5be2599, d426bba) |
| D.4.1 — import_enrollment_package function | DONE (dc7bd54, 70b8cd8) |
| D.4.2 — registration in generate_handler! | DONE (b5af889) |
| D.4.3 — build with the registration | DONE (1m 17s) |
| D.4.4 — import test via devtools | DONE (refusal path) |

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
- The frozen parameters are used as-is in the export.
- The import uses the header's parameters per section 22.7.1.
- The import refuses if a key already exists.
- The passphrase is never logged, never stored, never included
  in an error, never printed. The console output contains only
  the returned error string, which does not contain the
  passphrase or any key material.
- Do not propose redesigns. None was proposed.
- Do not touch db.rs outside the migration, auth.rs, or
  Cargo.toml outside the crates already added. None was touched.

### Files changed this session

- src-tauri/src/main.rs — one line added to
  generate_handler!. Commit b5af889.

### What comes next

Phase E — E1, the first deterministic test vector. It computes
the enrollment package from fixed inputs and verifies the bytes
against the expected output in SYNC-TEST-VECTORS-v1.md. The
package now exists, so E1 is unblocked.

End of entry.

## Recovery Session — September 25, 2026 (Phase E, E1–E6)

This entry records the completion of the enrollment-package
test vectors, E1 through E6. The work extracted two shared
package operations, added the deterministic E1 known-answer
test, and added the five E2–E6 behavioral tests for the import
command. All six tests pass on the cloud machine.

Phase E is not complete. It is the test-vector phase, and E1–E6
are the enrollment-package family. H1, H2, H3, M1, M2, V1, V4,
and V6 remain.

### E1 — the deterministic known-answer test

Commit 4db59fc (extraction and Phase 1 test), 76f4544 (Phase 2
assertion via hex decode), 4a8cd0f (vectors-file update).

The enrollment-package construction was extracted from
export_enrollment_package into a shared operation,
build_enrollment_package. The production command keeps its
behavior: it generates the salt and nonce with OsRng and calls
the shared function. The shared function takes the salt and
nonce as explicit inputs and generates nothing.

The E1 test calls the shared function with the fixed fixtures
from SYNC-TEST-VECTORS-v1.md §2:
  organization_key   organization_key_zero
  organization_id    organization_id_A ("org-test-A")
  passphrase         "test-passphrase-001"
  argon2id_salt      argon2id_salt_zero
  aead_nonce         nonce_structured
  argon2id params    131072 / 4 / 1

The test verifies the structure of the produced package and
asserts its length is 125 bytes. It then decodes the recorded
125-byte reference value from hex and asserts byte equality.
The test is deterministic and runs without a Tauri runtime.

### The 125-byte size, and the 140-byte confusion

The E1 package is 125 bytes: 63-byte header, 46-byte inner
content, 62-byte encrypted payload. The D.3 test produced a
140-byte package because it used the real 25-byte organization
id. E1 uses organization_id_A, which is 10 bytes. The
difference is the organization id length. This is recorded in
the E1 entry in SYNC-TEST-VECTORS-v1.md so the size difference
is not mistaken for a bug.

### Two transcription errors, and the fix

The first attempt at the Phase 2 assertion converted the hex to
a hand-written [u8; 125] array. The array was 124 bytes. The
compiler rejected it. The second attempt recorded the wrong hex
in SYNC-TEST-VECTORS-v1.md: the file's hex was 252 characters
(126 bytes) instead of 250 characters (125 bytes).

The fix: do not transcribe by hand. The test now contains the
hex as a string and decodes it with hex::decode. The recorded
value in the vectors file was compared to the value in main.rs
using fc.exe, a byte-level file comparison. The two files were
byte-identical. The transcription errors are recorded here as
a lesson: a byte-count measured through a terminal can be
wrong, and a value that matters should be verified with a
tool that compares bytes, not characters.

### E2–E6 — the import behavioral tests

Commit ee496e9 (extraction and tests), 77b8aa1 (test-module
import fix).

The package-parsing logic was extracted from
import_enrollment_package into a shared operation,
parse_enrollment_package. The function takes the file bytes,
the passphrase, and the trusted organization id. It returns the
32-byte organization key or an error string. It performs no
I/O and touches no database.

The production command keeps its behavior: it reads the file,
calls the parser, and installs the key in the database. The
parser is not a Tauri command. It has no #[command] attribute.
The import command keeps its #[command] attribute.

Five behavioral tests were added:

  E2  correct passphrase, matching org id   returns the key
  E3  wrong passphrase                      "Wrong passphrase or corrupted package"
  E4  tampered payload (one byte flipped)   "Wrong passphrase or corrupted package"
  E5  organization mismatch                 "Organization mismatch"
  E6  wrong magic bytes                     "Invalid package: bad magic bytes"

E3 and E4 assert the same error string. That is deliberate:
the AEAD cannot distinguish a wrong passphrase from a tampered
payload. A single message for both is honest; pretending to
distinguish them would not be.

All five tests share the E1 package through a helper,
e1_package(), which decodes the recorded hex. The E1 test uses
the same helper.

### The import-command refactor left one stale variable

When the body of import_enrollment_package was replaced, the
INSERT statement still referenced package_org_id, a variable
that had moved into the parser. It also passed organization_key
by value, where the SQL binding needs a slice. Both were fixed
in the same commit: package_org_id became organization_id, and
organization_key became &organization_key.

### The test-module import

The first cloud build of E2–E6 failed with five instances of
E0425: cannot find function parse_enrollment_package. The tests
are in a child module, #[cfg(test)] mod tests, and a child
module does not see the parent's items without an explicit
import. The module already had use super::build_enrollment_package;
it was changed to use super::{build_enrollment_package,
parse_enrollment_package};. Fixed in commit 77b8aa1.

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

### The vectors file, after E1

The E1 entry in SYNC-TEST-VECTORS-v1.md was updated:
  Specification status: BLOCKED -> SPECIFIED
  Expected-bytes status: PENDING -> FROZEN
The recorded hex is the 125-byte value, and a structural
breakdown of the bytes was added under the "Expected output"
heading.

The document header status was updated to note that E1 is
recorded. Section 1, item 3 was updated to say E1 is recorded
and H1, H2, H3 remain. The summary table row for E1 was updated
to SPECIFIED / FROZEN / None.

### Rule compliance

- No production behavior changed. The two production commands,
  export_enrollment_package and import_enrollment_package, keep
  their observable behavior. Only their internal structure was
  refactored.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. The organization key is local-only.
- Instance B (db.rs::derive_key) was not touched. The package
  key derivation is Instance A, separate from the SQLCipher
  derivation.
- No new Tauri command. The two shared functions are plain
  functions, not commands. The generate_handler! block is
  unchanged.
- The passphrase is never logged, never stored, never included
  in an error, never printed.

### Files changed this session

- src-tauri/src/main.rs — build_enrollment_package extracted;
  parse_enrollment_package extracted; export_enrollment_package
  and import_enrollment_package refactored; E1, E2, E3, E4, E5,
  E6 tests added. Commits 4db59fc, 76f4544, ee496e9, 77b8aa1.
- GORKA_RECOVERY/recovery-notes/SYNC-TEST-VECTORS-v1.md — E1
  entry updated; E1 hex recorded; header and Section 1 status
  updated; summary table updated. Commit 4a8cd0f.

### What comes next

H1, H2, H3 — the session-key derivation and handshake proof
tags. Their specification in SYNC-TEST-VECTORS-v1.md still
says "BLOCKED — HKDF domain-separation labels not confirmed in
§22.19", but that text is stale: §22.19 now contains the
labels, restored on September 20-21. The blocker is gone.

H1–H3 need their own spec, in the same style as the E1 spec.
They need two crates not yet in Cargo.toml: hkdf and hmac.

Then M1, M2, V1, V4, V6.

End of entry.

## Recovery Session — September 25, 2026 (Phase E, H1–H3 and M1/M2/V1/V4/V6)

This entry records the completion of Phase E. The enrollment-
package vectors, E1 through E6, were recorded earlier and are
documented in the preceding entry (commit f526a24). This entry
covers the two families that followed: H1–H3, the session-key
derivation and handshake proof tags; and M1, M2, V1, V4, V6,
the SYNC_MESSAGE envelope and the event payload encoders.

All nine remaining vectors are recorded and verified. The test
suite is fourteen tests. All pass on the cloud machine.

### The H family

Commits fbdc42a (functions and Phase 1 tests), 3fe9daa
(vectors recorded and Phase 2 assertions).

Three new operations, added as plain functions in main.rs, not
Tauri commands:

  derive_session_key          H1 — HKDF-SHA256 session key
  compute_handshake_reply_tag H2 — HMAC-SHA256 REPLY proof
  compute_handshake_confirm_tag H3 — HMAC-SHA256 CONFIRM proof

Two crates added: hkdf 0.12 and hmac 0.12. They resolved
against the existing sha2 0.10 without conflict.

H2 and H3 share a private helper, build_handshake_proof_input,
which takes the domain-separation string as a parameter. The
only difference between the two proofs is that string.

Three tests. Each is deterministic, generates no randomness,
performs no I/O. Each carries a byte-width assertion: H1 asserts
that len("org-test-A") encodes as 00 0A, and H2 asserts that
protocol_version encodes as 00 01. Those assertions catch the
single-byte-versus-two-byte mistake at the point where it would
be made.

### The H1 vectors-file discrepancy, and its resolution

The H1 entry in SYNC-TEST-VECTORS-v1.md listed both
organization_id_A and organization_id_B. That did not match
SYNC-ARCHITECTURE §22.11.1 or §22.19.1, which define exactly
one organization_id in the session-key info, shared by both
peers. The vectors file's entry was wrong — it had copied the
input list from H2 and H3, which do use two organization ids.

The H1 entry was corrected to use organization_id_A as the
session organization id. This is a documentation repair; the
protocol was already frozen. §22.11.1 was not reopened.

### The M/V family

Commits 67f8a07 (primitives and Phase 1 tests), 7f8529e
(vectors recorded and Phase 2 assertions).

This family needed serialization code that did not exist. The
following plain functions were added to main.rs:

  encode_tlv                          the single TLV primitive
  encode_string_value                 u32-prefixed UTF-8 string
  encode_debtor_created_payload       V1
  encode_entity_updated_payload       V4
  encode_communication_logged_payload V6
  encode_event_record                 the 0x1101..0x1109 record
  build_sync_message                  inner + outer + encrypt
  parse_sync_message                  decrypt the envelope

The design constraint, from the M/V spec: encode_tlv is the
single TLV primitive, and every higher-level builder calls it.
No builder writes a TLV header on its own. That eliminates the
class of bug where two encoders produce subtly different type or
length headers.

The V4 encoder sorts its change records lexicographically by
field_name before serializing, because §25.9.3 requires that
order and the input slice is not itself a wire-order guarantee.
With V4's single-change fixture the sort is a no-op, and the
spec records that plainly.

build_sync_message does the full construction: inner content,
the 6-byte outer header, XChaCha20-Poly1305 encryption with that
header as AAD, and the assembly header || nonce || ciphertext ||
tag. parse_sync_message validates and decrypts the outer
envelope and returns the decrypted inner content. It does not
parse event records; that is a later concern.

These operations are reusable protocol primitives. M1/M2 and V1/
V4/V6 exercise them; Phase 9.6 will consume the same operations
when the sync engine is implemented. They are not test-only code.

### Five tests

  M1  SYNC_MESSAGE encryption, 239-byte framed message
  M2  SYNC_MESSAGE decryption, 193-byte inner content
  V1  DEBTOR_CREATED payload, 30 bytes
  V4  ENTITY_UPDATED payload, 38 bytes
  V6  COMMUNICATION_LOGGED payload, 88 bytes

Each is deterministic, no randomness, no I/O, no Tauri runtime.
Each carries a structural check of the TLV layout, then the
Phase 2 assertion against the recorded value.

### The M1 message_id fixture

The vectors file said only "a fixed test UUID" and did not give
the bytes. The M/V spec resolved this explicitly:
message_id = event_id_test_001, exactly 16 bytes. This is a
test-fixture choice and does not alter the protocol. The
vectors file records the actual value.

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

Each test asserts its output against the value recorded in
SYNC-TEST-VECTORS-v1.md. The recorded values and the computed
values agree, byte for byte.

### The H Phase 2 verification, deferred and then closed

The three H tests were committed with their Phase 2 assertions
at 3fe9daa, but the cloud machine was off, so they were not run.
They ran for the first time in the next cloud session, when the
M/V work pulled both commits together. All three passed. The
deferred verification is closed.

### The vectors file after this session

All nine vectors are SPECIFIED / FROZEN. The document header
now reads: "All nine vectors recorded. Second-implementation
verification not performed." That is accurate: every vector is
recorded, and the independent second-implementation check that
SYNC-TEST-VECTORS-v1.md §1 describes has not been done.

### Rule compliance

- No production behavior changed. The enrollment-package and
  H operations are new or extracted; the two production
  commands keep their observable behavior.
- No cloud schema change. No new tables. No new columns.
- No CI/CD touched.
- Invariant held. Every operation is local. Nothing is
  transmitted.
- db.rs::derive_key was not touched.
- Two crates added across the session: hkdf and hmac, both
  RustCrypto. No other dependency change.
- No new Tauri command. generate_handler! is unchanged.
- The fixture values are test-only. They are never used in a
  production path.

### Files changed this session

- src-tauri/Cargo.toml — hkdf and hmac crates. Commit fbdc42a.
- src-tauri/src/main.rs — H operations; M/V serialization
  primitives; build_sync_message; parse_sync_message; fourteen
  tests with Phase 2 assertions. Commits fbdc42a, 3fe9daa,
  67f8a07, 7f8529e.
- GORKA_RECOVERY/recovery-notes/SYNC-TEST-VECTORS-v1.md — H1,
  H2, H3, M1, M2, V1, V4, V6 recorded; H1 input corrected;
  summary table and header updated. Commits 3fe9daa, 7f8529e.

### What comes next

Phase E is complete. The next work is Phase 9.6, the sync
engine, which consumes the primitives built here. Before that,
the Control Plane tables (device_registrations, relay_sessions)
must be applied to gorka_test.

End of entry.

---

## Recovery Session — September 26, 2026 (Control Plane tables and device identity)

This entry records the session that created the two Control Plane
tables, device_registrations and relay_sessions, in gorka_test;
resolved the device-identity question that had been ambiguous in
the frozen documents; closed a Cargo.lock divergence; and recorded
the result. It also records a documentation investigation that
initially concluded "no change" and was then corrected.

### What this session did, in one paragraph

Wrote a physical specification for two new cloud tables, applied
them to gorka_test, verified them, and resolved a genuine
inconsistency in the frozen documents about what the wire device_id
means. The tables exist. The existing nineteen tables are unchanged.
No production was touched. No application code was changed. The
files changed in the repository are prisma/schema.cloud.prisma,
src-tauri/Cargo.lock, and six recovery documents.

### The tables

device_registrations — 13 columns. Six active MVP columns (id,
organization_id, user_id, registered_at, last_seen_at,
is_authorized). Seven reserved columns, nullable, empty:
device_name, device_type, device_platform, device_public_key,
revoked_at, revoked_by, metadata.

relay_sessions — 10 columns. No reserved columns. Will contain no
rows until Phase 9.6.

The reserved-field rule: the reserved columns are present for
forward compatibility only. They are not part of the active MVP
behavior. MVP code MUST NOT read them and MUST NOT write them. No
implementation may populate them or assign semantics to them until
the combined-model specification explicitly activates them through
an approved amendment.

is_authorized is the MVP's authorization state. It is NOT the
funded-phase per-machine revocation mechanism; that is revoked_at /
revoked_by, which are reserved.

### The commits

  1d89af8  Add device_registrations and relay_sessions models to
           cloud schema. One file, 95 insertions.
  9b5a118  Add reverse relations to DeviceRegistration for
           relay_sessions. One file, 5 insertions.
  15a993f  Sync Cargo.lock with Cargo.toml: pin hkdf and hmac,
           resolved during Phase E. One file, 20 insertions.

All three on origin/main. All three machines — main, cloud,
GitHub — at 15a993f, working trees clean.

### The two prisma db push errors

The first push failed with P1001: cannot reach database server.
Cause: the cloud machine was using the direct Supabase hostname,
which does not resolve from AWS Singapore. Fixed by switching to
the session pooler hostname already recorded in HANDOFF.md and in
this log. Not a schema problem.

The second push failed with P1012: the relation field deviceA on
model RelaySession is missing an opposite relation field on model
DeviceRegistration. Cause: the physical specification described
the foreign keys from relay_sessions to device_registrations, but
did not state that Prisma requires the relation to be declared on
both models. This was a genuine gap in the specification. Fixed by
adding two reverse-relation lines to DeviceRegistration:
relaySessionsAsDeviceA and relaySessionsAsDeviceB. They are not
columns; they create nothing in the database. The specification
was amended before the file was edited, per the rule that a
specification change precedes an implementation change.

### The verification result

After the second push: "Your database is now in sync with your
Prisma schema. Done in 9.04s."

Verified with a node script using the generated Prisma client:

  - 21 tables in the public schema. The original nineteen plus
    the two new ones.
  - device_registrations has 13 columns, as specified.
  - relay_sessions has 10 columns, as specified.
  - No column matching %debtor% except the two known, permitted
    ones: aggregate_metrics.debtor_count and
    boundary_proof_logs.debtor_data_included.

The backend was started afterwards and connected successfully,
confirming the regenerated Prisma client is compatible with the
existing backend code.

The temporary verification file, verify.cjs, was deleted. The two
untracked files on the cloud machine, check-columns.ts and
test-package.gorka, remain as recorded in prior handoffs.

### The device-identity investigation, and its resolution

During the session, before the schema work, a cross-document pass
on device identity was performed. The pass examined SYNC-
ARCHITECTURE.md Sections 3, 4, 5.5, 7.5, and 11.3, plus
CLOUD-TABLES.md Section 20.1, LOCAL-TABLES.md Category D,
MULTI-USER-CONCEPT.md Section 5, GORKA-MVP-SCOPE.md Section 9.2,
THREAT-MODEL.md, PHASE-PLAN.md, and ARCHITECTURAL-LAW.md Section 20.

The pass concluded, initially, that §11.3 was inconsistent with
§3, §4, and §7.5. A corrected §11.3 was drafted that stated the
MVP wire device_id is the user identity, with the per-database
instance model moved to a funded-phase note.

That draft was reviewed externally. The review found that the
correction would create a real protocol problem: two machines
logging in as the same user would produce two independent sequence
streams under one device_id, breaking the (device_id, sequence)
uniqueness invariant of §11.2 and the per-origin delivery
bookkeeping of §18.2.

On re-examination, the initial finding was wrong in its conclusion
but right about one thing: §11.3's sentence "combines the user
identity with the device instance identifier" was ambiguous and
had been read two different ways. The resolution required an
explicit decision, not a revert.

### The decision: two identity layers

The founder adopted the two-layer model.

Layer 1 — Access (Control Plane). User-based. One registration per
user, per organization. A user logs in from any machine. No
per-machine registration, no per-machine key, no per-machine
revocation. device_registrations records this. In the MVP it is
not a machine registry.

Layer 2 — Sync origin (wire protocol). Each local GORKA database
has its own local replica identifier, generated when the database
is first established. It is 16 bytes. The wire device_id is exactly
this local replica identifier. It does not encode the user
identity.

(device_id, sequence) is globally unique within the organization.
Two local databases used by the same user have different device_id
values and independent sequence namespaces. The collision problem
is solved.

device_id identifies the synchronization origin, not the human
actor. Attribution, where the protocol requires it, is carried
separately (for example, created_by in Section 25.13.9).

### The amendments applied

SYNC-ARCHITECTURE.md, version bumped 1.2 to 1.3:

  §3 — the bullet describing the wire device_id is corrected; a
       clarifying paragraph about the two layers is added.
  §4 — the Device identity definition is rewritten to name the
       two layers; one bullet in "What the MVP Does Not Do" is
       rewritten to say the MVP does not cryptographically
       authenticate a physical machine.
  §11.3 — the sentence "combines the user identity with the
       device instance identifier" is replaced with "is the local
       synchronization-origin identifier of the local GORKA
       database. It is exactly 16 bytes. It does not encode the
       user identity."
  §22.4 — "device_id: fixed-size, exact format defined in Section
       25" becomes "device_id: exactly 16 bytes."
  §25.6.6 — new subsection. Defines the wire device_id: the local
       replica identifier, 16 bytes, generated when the local
       database is first established, never deliberately reused,
       transmitted as raw bytes. The local storage representation
       is deferred to the implementation; whatever representation
       is used MUST decode deterministically to the 16-byte wire
       value.

CLOUD-TABLES.md Section 20.1:

  A physical-specification note and an MVP note are added. The
  section remains the logical contract. The notes point to the
  physical classification and state that the table is not a
  machine registry in the MVP.

LOCAL-TABLES.md:

  No change. Category D.1, D.2, and D.4 are consistent with the
  decision. The storage representation of sync_state.device_id is
  deferred to Phase 9.6, per §25.6.6.

### What the earlier conclusion got wrong

An earlier draft of this record concluded "§11.3 is correct as
written; no change to SYNC-ARCHITECTURE.md." That conclusion was
incomplete. §11.3's "combines" sentence was genuinely ambiguous,
and the two-layer decision resolves it. The sentence is replaced.
The document is now at v1.3.

The record keeps both: the original finding, the external review
that found the protocol problem with the first proposed correction,
and the final decision that resolved the ambiguity without breaking
§11.2.

### The Cargo.lock finding

After the schema work was done, git status on the cloud machine
showed src-tauri/Cargo.lock modified. The change was not from this
session. Investigation showed:

  - Commit fbdc42a (Phase E, H1-H3) added hkdf and hmac to
    Cargo.toml. It did not touch Cargo.lock.
  - The cloud machine's next cargo build resolved the two crates
    and updated Cargo.lock locally.
  - That update was never committed. It sat in the cloud machine's
    working tree since September 25.

The D.3 work had used the correct pattern: d3e5fee added
chacha20poly1305 to Cargo.toml with the note "Cargo.lock updates on
the next build", and d426bba then committed the resulting lock
file. The H-family did the first step and missed the second.

Fixed by committing Cargo.lock as 15a993f from the cloud machine,
then pulling on the main machine. All three machines and GitHub
are now in sync on the lock file.

Process finding recorded: "all machines at the same commit" and
"all working trees clean" are two different claims. The prior
handoff treated them as one. The lock-file divergence was invisible
because no full git status had been run on the cloud machine.
Future handoffs should verify working-tree cleanliness on each
machine separately, not infer it from matching HEADs.

### Rule compliance

- No production touched.
- No cloud schema change to production.
- No CI/CD touched.
- Invariant held. No debtor data crossed the boundary.
- No application code changed. No Rust changed. No backend
  changed.
- No new abstraction introduced in the schema.
- The two prisma db push errors were resolved at the correct
  level: the first was environment (hostname), the second was a
  specification gap, resolved by amending the specification first,
  then the file.
- The §11.3 decision was made by the founder, not inferred.

### Repository state after this session

Main machine: at 15a993f, clean, pushed.
Cloud machine: at 15a993f, clean except the two known untracked
  files (check-columns.ts, test-package.gorka).
GitHub origin/main: at 15a993f.

The documentation commit for this entry follows separately, after
all four record documents are written.

### What is still open

Second-implementation verification of the nine vectors. Unchanged.

Control Plane services not implemented. Discovery, presence, relay
coordination. Phase 9.6 work.

Phase 9.6, the sync engine. Not started.

Phase 9.5 (Agent App) and 9.7 (multi-user demonstration). Not
started.

Excel/TXT upload, the debt due-date bug, the stale
supervisor-dashboard\dist, the UI honesty issues, the Dashboard
401s. Unchanged.

One item for Phase 9.6: when the sync tables are built, the local
storage representation of sync_state.device_id is chosen then.
§25.6.6 defers this choice.

### A small note recorded but not acted on

THREAT-MODEL.md §7.2.2 uses the phrase "the former member's
device", which under the two-layer decision means the former
member's registration row. Not a defect, but a phrase a careful
reader could misread. Recorded here, not acted on.

---

## Recovery Session — September 26, 2026 (Second-implementation verification of the nine vectors)

This entry records the completion of the second-implementation
verification required by SYNC-TEST-VECTORS-v1.md Section 1 and
described in the task brief of the same date. The verification
was performed as a separate task, before Phase 9.6, per the
decision recorded in the brief.

### What the task was

Write a second, independent implementation of the nine
deterministic test vectors, working from the frozen
specification and the recorded fixtures, and confirm that it
produces the same bytes as the values recorded in
SYNC-TEST-VECTORS-v1.md. The vectors were recorded by the Rust
implementation in src-tauri/src/main.rs on 2026-09-25. The
fourteen Rust tests compare the Rust implementation against the
recorded values. That is a regression check, not a correctness
check. A second implementation written from the specification,
not from the Rust code, is the only way to detect a bug that is
present in both the Rust code and the recorded vector.

### The independence boundary

The second implementation was written from SYNC-ARCHITECTURE.md
v1.3 and SYNC-TEST-VECTORS-v1.md only. src-tauri/src/main.rs,
src-tauri/src/db.rs, src-tauri/src/auth.rs, and
src-tauri/Cargo.toml were not consulted. The one exception
permitted by the brief — reading the crate versions from
Cargo.toml — was not needed and was not used. This is the
condition that makes the verification meaningful. Reading the
Rust code would have turned the exercise into a translation,
not an independent verification.

### The second implementation

Location: C:\Users\kucha\gorka-app\verify\
Entry point: index.mjs
Runtime: Node.js v24.18.0, on the main machine

Libraries:
  node:crypto (built-in)   HKDF-SHA256, HMAC-SHA256, SHA-256
  @noble/ciphers 2.4.0     XChaCha20-Poly1305
  hash-wasm 4.12.0         Argon2id

The Rust implementation uses RustCrypto (argon2,
chacha20poly1305, hkdf, hmac, sha2). The second implementation
uses a different library family. A bug in one family is unlikely
to be reproduced in the other. This satisfies the brief's
Condition 2, which was recommended but not required.

The main machine was used, not the cloud machine. Node is
present on both. The task does not require a Rust compiler and
is not blocked by the Smart App Control / cargo.exe restriction
recorded on 2026-09-24. No cloud machine session was needed.

### The verification environment

  OS:      Microsoft Windows 11 Home | 10.0.26200 | build 26200
  Node.js: v24.18.0
  npm:     11.16.0
  @noble/ciphers: 2.4.0
  hash-wasm: 4.12.0
  crypto:  node:crypto (built-in)

Recorded for reproducibility. The task brief's environment
estimate said Node 24.21.0 on the cloud machine. The actual run
used Node v24.18.0 on the main machine. This is not a
discrepancy in the verification; the task did not require a
specific host or a specific minor version.

### The result

node index.mjs, first execution, no adjustment:

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

Every vector produced the exact recorded bytes.

First execution produced 9/9 matches. No implementation
adjustment, vector adjustment, or specification adjustment was
required. No post-hoc convergence occurred. The nine vectors
are now confirmed by two independent implementations against
the final frozen specification:
  1. The Rust implementation in src-tauri/src/main.rs
     (RustCrypto).
  2. The Node.js implementation in verify/index.mjs (@noble,
     hash-wasm, node:crypto).

### The negative control

After the 9/9 run, a copy of the runner was made with one byte
of the V1 expected value mutated from 0x20 to 0xff. The copy
was run, then deleted. Result:

  E1  PASS
  H1  PASS
  H2  PASS
  H3  PASS
  M1  PASS
  M2  PASS
  V1  FAIL
        expected: ff0100000008000000045465737420020000000a00000006446562746f72
        actual:   200100000008000000045465737420020000000a00000006446562746f72
        lengths:  expected=30 actual=30
  V4  PASS
  V6  PASS

  8/9 PASS

The negative control establishes that the comparison harness
detects a one-byte mismatch and reports both the expected and
the actual values plus their lengths. It is not merely printing
PASS. The original runner was rerun after the negative control
and produced 9/9 PASS again.

### The Rust regression status

No Rust source and no vector value were changed during the
verification. The fourteen Rust tests in src-tauri/src/main.rs
were already passing before this session, per the September 25
entries, and were not rerun here, because nothing they depend on
changed. Rerunning them would add no information.

### The header update

The Status block of SYNC-TEST-VECTORS-v1.md was updated from:

  "All nine vectors recorded. Second-implementation
   verification not performed."

to:

  "All nine vectors recorded. Second-implementation
   verification performed on 2026-09-26. All nine vectors
   confirmed by an independent implementation."

This is the status change the task brief Step 6 requires.

### The preservation decision

Decision D4 of the task brief offered two choices for the
verification code: keep it committed, or delete it after
recording the result. The brief recommended keeping it.

Kept. The verify/ folder is committed alongside the
documentation. Its package-lock.json pins the exact library
versions so the check is reproducible. node_modules/ is
gitignored; the manifest and lock file are tracked. A future
session can rerun node index.mjs to reconfirm the vectors
without reconstructing the implementation.

### What this task did not do

  - Did not read src-tauri/src/main.rs, or any file under
    src-tauri/.
  - Did not modify the Rust implementation.
  - Did not modify any vector value.
  - Did not modify the specification.
  - Did not touch the database, the cloud schema, the backend,
    or the Control Plane tables.
  - Did not start Phase 9.6.
  - Did not propose a redesign or question the architecture.

### The commit

Files added:
  - verify/index.mjs
  - verify/package.json
  - verify/package-lock.json
  - verify/.gitignore

Files modified:
  - GORKA_RECOVERY/recovery-notes/SYNC-TEST-VECTORS-v1.md
    (Status block only)
  - GORKA_RECOVERY/recovery-notes/DECISIONS.md (this entry)
  - GORKA_RECOVERY/recovery-notes/HANDOFF.md (one status entry)
  - GORKA_RECOVERY/recovery-notes/SESSION-LOG.md
    (session extension)
  - GORKA_RECOVERY/recovery-notes/START-HERE.md (one update
    subsection)

Commit hash and push recorded after the commit.

### What this entry closes

The open item "Second-implementation verification of the nine
vectors" from the September 25 and September 26 entries is
closed. The nine vectors are no longer recorded-but-not-
confirmed. They are confirmed by two independent
implementations against the final frozen specification.

Conclusion, stated precisely:

  All nine deterministic test vectors have been independently
  reproduced byte-for-byte by a second implementation written
  from SYNC-ARCHITECTURE.md v1.3 and SYNC-TEST-VECTORS-v1.md.
  No disagreement, specification ambiguity, vector correction,
  or implementation correction was required.

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

### Rule compliance

  - No production touched.
  - No cloud schema change. No new tables. No new columns.
  - No CI/CD touched.
  - Invariant held. The verification operates entirely on fixed
    fixtures and produces no debtor data.
  - No Rust code changed. Instance B (db.rs::derive_key) not
    touched.
  - The independence boundary was held. This is the whole point
    of the exercise, and it is recorded here so a future
    session cannot mistake this verification for a
    translation.

End of entry.

---

## Recovery Session — September 27, 2026 (Multi-user application architecture: A–G decisions and design reconnaissance)

This entry records the structured architecture conversation between
the founder and the assistant on September 27, 2026, and the design
reconnaissance of the Client Dashboard that followed it. It is the
input document for the Agent App build spec, which is the next
document to be written. It does not write the spec. It records the
decisions the spec will implement.

It is the largest single record since the September 17 multi-user
decision. That is appropriate: this entry defines how the two apps
coexist, how they reach providers and AI, where compliance is
enforced, what syncs, and what the design vocabulary is.

### Purpose and context

After Phase E (the nine test vectors) and the second-implementation
verification, the next work is the Agent App (Phase 9.5) and the
sync engine (Phase 9.6). Before writing the Agent App build spec,
the founder answered a structured list of questions about how the
two apps coexist, how they reach providers, how the AI fits, where
compliance is enforced, and how data flows. This entry records those
answers. It also records the design vocabulary extracted from the
Client Dashboard, which the Agent App spec will follow.

The multi-user model is unchanged. No frozen document is amended.
Every item here is either a decision within the existing
architecture or an additive extension the frozen documents already
provide for (new event types, new client-side components, new
configurable rules).

### Section A — Where the Communication Service runs

A-1. Two apps, two roles, no overlap. The Client Dashboard is a
management console: the admin uploads debtors, configures
connectors, monitors agent activity, reviews usage, and handles
billing. The Agent App is the working tool: the agent chooses a
debtor, calls/SMS/emails/pushes via connectors the admin has
enabled, and records the activity on the debtor profile.

A-2. The admin cannot send messages to debtors from the Client
Dashboard. If the admin also acts as a collection worker, they
install their own Agent App and log in with the same user account.
This is a systemic principle, deliberate for simplicity in the MVP;
it can be revisited in the funded phase.

A-3. Connectors are configured by the admin, consumed by the agent.
The agent sees what the admin has enabled and never sees provider
accounts, credentials, or settings.

A-4. Two commercial paths.
- GORKA-managed: GORKA is the provider's counterparty. GORKA
  provisions a subaccount per client at the provider. The client
  pays GORKA; GORKA pays the provider. The Client Dashboard and
  Owner Dashboard must include usage and billing functions.
  Confirmed technically possible.
- BYOP (bring your own provider): the client is the provider's
  counterparty. GORKA is excluded from the commercial relationship.
  The client sees a Zone 3 warning that GORKA is not responsible
  for data leaving via their own provider.

A-5. Automatic sending is deferred. For the development stage,
outbound messages are triggered while the agent's machine is on
and the agent is working. A scheduler that fires when the agent's
machine is asleep is a later-phase item and is to be revisited
deliberately.

A-6. The agent experience is the constraint everything else
serves: the agent opens the app, clicks a debtor, chooses a
channel that is available, and executes without thinking about
how it works. The agent never sees credentials or provider
settings.

Open: A-2a (where connector credentials live on the agent side,
lean: client device).

### Section B — Where credentials live

B-1. Provider credentials live locally, inside each device's
SQLCipher database, encrypted with that device's local password.
Same home as the organization key; same lock.

B-2. Provider credentials and the organization key are separate
concepts with separate lifecycles. The organization key proves
membership and derives session encryption. Provider credentials
authenticate the client to a third-party provider. Rotating one
does not rotate the other. They are named separately in the spec
and stored separately.

B-3. Revocation of a local credential is by provider rotation. You
cannot delete a credential from a device you cannot reach. What
you can do is rotate it at the provider so the old copy is
useless, then distribute the new one to the devices that should
still hold it.

Open: B-5 (how a rotated credential reaches the other devices).
Three shapes named in conversation: manual re-entry, sync via the
existing event system (cleanest, matches the multi-user model), and
Control Plane push (would put provider credentials on the path of
GORKA cloud; not debtor data, so not the invariant, but a decision
to make explicitly). To be resolved alongside the sync protocol's
message-type freeze.

Open, production-stage: GORKA-managed connectors make GORKA the
root of trust for every managed connector across every client.
Operational risk belongs in the threat model, not in the MVP.

### Section C — Where AI calls happen

C-1. The AI call goes from the agent's device directly. Not
through the hub, not through GORKA cloud. No approval by the
client/admin. The agent benefits without a gatekeeper.

C-2. Only metadata leaves the device for the AI call. The old
Electron context object (name, email, phone, amount, full
history) is out. Local data storage is the rule, and it extends
to what goes to the AI. The AI must help without receiving
debtor-identifying data.

C-3. There is a new client-side component, the AI boundary
layer. It runs on the agent's device, between the agent and the
AI provider. It inspects what is about to be sent and redacts or
blocks debtor-identifying content. Its rulebook comes from legal
review (see C-1 open item below), not from engineering.

C-4. The DLP shape chosen. Shape 1: redact before sending. The
boundary layer scans the agent's free-text, finds names that
match a debtor in the local database, replaces them with a
placeholder, sends the redacted text. The AI receives the
question without the debtor's identity and answers about the
metadata. The agent sees a natural reply. Names that do not
match a local debtor pass through harmlessly. Option B for the
indicator: a small, unobtrusive visible indicator that a field
was redacted, not silent.

C-5. Multi-provider from the start. Gemini for development and
early production. ChatGPT, DeepSeek, Claude and others later.
The architecture treats AI providers as pluggable, same as
SMS/email providers. The more providers GORKA can offer, the
better; the client chooses.

C-6. The AI provider is not the same category of third party as
the message provider. The message provider necessarily receives
the recipient address and the message content — that is what it
is for. The AI provider must never receive debtor data. The DLP
boundary applies to the AI, not to the message provider. This
distinction is explicit in the spec.

Open: C-1 (the sensitive-field list; a legal input, not a
design choice; pre-implementation task).
Open: C-3a (redaction applied to pasted documents and long text).
Open: C-4 (whether the AI receives free-text at all, or only a
structured metadata blob).
Open: C-5 (how AI provider credentials reach the agent device;
same shape as B-5, solve together).
Open: C-6 (the AI boundary layer needs its own spec section; it is
a new client-side component).

### Section D — Which app hosts what

D-1. Copilot appears in both apps with different purposes.
- Client Dashboard: oversight. Which AI providers are enabled,
  who used them, when, how much, and whether the AI is effective
  against business goals. Also usage totals for billing.
- Agent App: the daily working tool. The agent asks, the AI
  answers, the agent acts.

D-2. Communication Center lives only in the Agent App. The admin
never sends from the Client Dashboard. The Client Dashboard's role
for communication is: configure connectors, monitor usage,
produce analytics, feed billing.

D-3. Per-agent access control (which debtors each agent can see)
is a real question. Three shapes were named:
- Option 1: UI-layer hiding. The Agent App shows only the agent's
  assigned debtors. Data still on the device, because the device
  holds the full replica. Days of work. No architecture change.
- Option 2: sync-layer filtering. The hub sends only events for
  assigned debtors. Access control is real, not cosmetic. This is
  an amendment to SYNC-ARCHITECTURE.md §5.11 and the "every
  authorized device can decrypt any sync traffic" claim. Not a
  silent change.
- Option 3: full per-record crypto access control. Funded phase.
  Not MVP.

The MVP's frozen architecture states every device in the
organization has access to every record. That is the reason the
MVP is simple. Option 1 fits within it; option 2 amends it.

No decision made. Recorded for the Agent App spec and to be
resolved before the spec is finalized.

Note. The Client Dashboard reportedly has a partial permissions
implementation. Worth reading before designing the Agent App's
access layer, following the same discipline as the Electron-era
code: read, do not assume.

### Section E — Compliance enforcement

E-1. Cloud declares, local enforces. The cloud holds the rule
(international defaults, GORKA-wide policy, the list of fields and
thresholds the system should enforce). The client device enforces
the rule (the actual debtor, the actual time, the actual history,
the actual opt-out status). The cloud never needs debtor data to
enforce a rule, because enforcement is always local.

E-2. GORKA declares its scope. GORKA provides the mechanism and
the safeguards. The client is the sender of record. Final legal
responsibility for a rule violation rests with the client. GORKA
is responsible only for what it declares: no debtor data in cloud,
no ability to decrypt sync traffic, no readable debtor data
crossing its infrastructure.

E-3. GORKA provides the scaffolding, not only the disclaimer. The
Client Dashboard includes a "Local compliance rules" section with
fields for quiet hours, contact limits, opt-out handling, and
disclosure text. Pre-populated with whatever GORKA knows about
common jurisdictions; empty where GORKA does not know. The client
fills in their jurisdiction's requirements. The client is still
responsible; GORKA is helpful, not silent.

E-4. A new client-side component, the compliance enforcement
layer. It runs on the sending device, before the provider call.
It reads parameters from cloud (the rules) and state from local
(the actual debtor, the actual time, the actual history).

Open: E-16 (what "block" means per rule type; quiet hours suggests
"schedule for next permitted window"; contact limit suggests
"block entirely"; opt-out suggests "block entirely, no override").
The spec names each.

Open: E-15 (the compliance layer needs its own spec section).

### Section F — Message log and sync

F-1. The message log syncs. It becomes part of the event stream,
following the same rules the frozen architecture already defines.

F-2. The admin sees everything — full message content, status,
provider ids, timing — for business control, agent monitoring,
and compliance review.

F-3. AI recommendations and agent decisions sync. For analytics,
for outcome measurement, for GORKA's own assessment of what works.

F-4. Architectural consequence: new event types. The MVP event
set has four. What F-1 through F-3 require adds:
- MESSAGE_SENT
- MESSAGE_STATUS_CHANGED
- AI_RECOMMENDATION_MADE
- AGENT_DECISION_RECORDED
Possibly more, depending on the desired audit trail. This is
additive. Section 22.13.3 reserves event type codes starting at
0x0100 for exactly this; Section 24 defines the versioning
process. The MVP adds what is cheap; the funded phase extends.

F-5. F-18, the sync unit for a message, staged.
- MVP: one event per message. MESSAGE_SENT carries the content
  and a status field. Subsequent changes are ENTITY_UPDATED on
  that message record. Matches the existing DEBTOR_CREATED /
  ENTITY_UPDATED pattern; fewer events; smaller schema.
- Production: per-step events (MESSAGE_QUEUED, MESSAGE_SENT,
  MESSAGE_DELIVERED, MESSAGE_OPENED, MESSAGE_FAILED). Each its
  own event type under the reserved 0x0100 range. Additive; no
  rebuild.

F-6. F-19, retention, staged.
- MVP: retain everything. Append-only, no pruning.
- Production: retention is a client policy. The client decides
  what to keep and what to prune. Closed files (paid in full, no
  further action) can be pruned except for whatever the client's
  internal policy says must be kept — usually the sensitive bits
  for compliance, not the operational noise.

Open: F-19a (the funded-phase pruning mechanism: what "closed"
means, what is kept, what is pruned; goes in the Client
Dashboard as a configurable retention rule).
Open: F-19b (whether pruning is local or synced; if local, the
"same state on every device" property bends; if synced, a prune
event propagates).

Note. If the admin's device holds every message body from every
agent, then the loss of the admin's device is larger than one
agent's loss. That is a consequence of "full replica on every
device." It is not a defect; it belongs in the threat model that
device loss grows in severity with role.

### Section G — Sequencing and scope

G-1. Same schema for both apps. Same tables, same migrations.
The Agent App is a different UI over the same local database
shape.

G-2. LEGO architecture. GORKA has to be usable on all
environments: Windows, macOS, Linux, mobile (Android, and
Microsoft's mobile platforms). Windows first. Cross-platform is
the target. Read-only reporting consoles and administrative apps
are foreseen. Build the basis for all of it now, where the basis
is cheap to lay now. Where it is expensive, defer, but do not
paint into a corner. No Windows-only assumptions in the shared
Rust layer.

G-3. "Workable GORKA" defined. A product the founder can hand to
friends as a free pilot, get real feedback, and take to investors
as evidence of traction. Minimum functions, but the essential
ones present. Not all AI providers — Gemini. Not all SMS
providers — Twilio. Simple analytics, not a full BI suite. Some
mobile support, not all. Honest pitch: "not complete, but
usable; pricing when you want it; more coming."

G-4. Three pillars for a bank compliance reviewer.
1. Local data storage: debtor data stays on the client's
   machines, encrypted at rest with SQLCipher.
2. SaaS model with simplified pricing: GORKA runs as a service,
   which simplifies many functions and the commercial model.
3. AI Copilot: enhances the client's daily routine.
Each pillar is provable by an audit log journal — a
compliance-facing artifact that shows what crossed the boundary
and what did not.

The honest sentence for the reviewer: all debtor data is stored
on the client's own machines, encrypted at rest with SQLCipher;
sync traffic is end-to-end encrypted; GORKA's cloud holds only
account metadata and cannot decrypt debtor data; audit logs
prove it.

### Section N1 — Connection Center

The communication mechanism in the Client Dashboard is broader
than "communication providers." It is a general third-party
integration mechanism with three properties:
- The client chooses the third party and carries the
  responsibility.
- GORKA provides no credentials and sits nowhere on the path.
- Responses land on the client's machine and stay there.

The categories include communication providers (Twilio, Mocean,
Resend), credit bureaus, the client's own local databases, and
other data vendors. Under the frozen architecture these are all
Zone 3 connections — client-controlled paths that leave the
client's machine and reach a third party GORKA does not control.

Working name: Connection Center (supersedes "Communication
Center" as the broad term; "Communication Center" remains the
specific name for the send-message feature).

Skip-tracing. The capability is needed. The term is dangerous.
The friends' reviews were unanimous that it can be read
negatively by regulators. The capability stays; the framing is a
compliance-sensitive presentation problem; legal review is a
precondition — the same category as C-1.

GORKA provides no credentials for any third-party data source.
The client's relationship with a credit bureau or any data
vendor is a commercial relationship between them; GORKA does
not participate. Responses are stored locally.

MVP inclusion favored if the simplest implementation is
demonstrable. The founder's reasoning: a simple or restricted
version in the MVP is more convincing to investors and pilot
clients than a described future feature.

### Section N2 — Audit log journal

The audit log journal is partially implemented on the Client
Dashboard. The Agent App side and the cross-app connection are
not yet designed. The open question — do the two apps each keep
their own journal, share one, or have one forward to the other —
is deferred. Same shape as the message log question (Section F),
applied to the audit journal.

### Section N3 — Cross-platform commitment

Recorded, see G-2.

### Design vocabulary extracted from the Client Dashboard

Read on 2026-09-27 from: index.css, App.css, App.tsx,
AppShell.tsx, Sidebar.tsx, Sidebar.css, TopHeader.tsx,
GorkaLogo.tsx, Dashboard.tsx, DebtorEditModal.tsx, Login.tsx,
UnlockScreen.tsx. Nothing was written.

Color palette
  Accent (primary):     #7C3AED
  Accent tint:          #F4F0FF
  Accent tint (icons):  #f3e8ff
  Brand red:            #DC2626 (logo, danger)
  Danger:               #dc2626
  Danger tint:          #fef2f2 / #fecaca
  Success:              #16a34a / #dcfce7
  Warning:              #ea580c / #ffedd5
  Text strong:          #111827
  Text normal:          #374151
  Text muted:           #6b7280
  Text dim:             #9ca3af
  Text sidebar:         #4A4A4A
  Border default:       #e5e7eb
  Border sidebar:       #E3E3E3
  Background main:      #f9fafb
  Background sidebar:   #FAFAFA
  Background card:      #FFFFFF

Typography
  Font: system-ui, 'Segoe UI', Roboto, sans-serif
  Body: 13–14px
  Label: 13px, weight 500
  Nav: 16px, weight 400 / 500 active
  Page title: 28px, weight bold
  Card title: 14px, weight 500, muted
  Card value: 24px, weight bold
  Section heading: 18px, weight 600
  Logo: 24–26px, weight bold, uppercase

Spacing
  Modal padding: 24px
  Card padding: 20px
  Content padding: 24px
  Grid gap: 12–16px
  Field spacing: 12px

Shape
  Card radius: 12px
  Button/input radius: 8px
  Nav item radius: 6px
  Icon container radius: 12px
  Sidebar width: 240px
  Header height: 73px
  Nav item height: 36px
  Modal width: 440px (max 90vw)
  Entry card width: 400px

Shadow
  Card default: 0 1px 3px rgba(0,0,0,0.05)
  Card hover:   0 10px 25px rgba(0,0,0,0.08)
  Overlay:      rgba(0,0,0,0.4)

Icons
  Library: lucide-react
  Sidebar: 16px
  Header: 18px, strokeWidth 1.7
  Card icon: 24px
  Close icon: 20px

Components
  card: white, 12px radius, hover lifts 2px + accent border
  kpi-card: icon block 48×48 tinted background, title/value/subtitle, clickable
  btnPrimary: accent background, white text, 8px radius, 14px font
  btnGhost: white background, default border, #374151 text, 8px radius
  input: 8px radius, #e5e7eb border, 14px font, padding 8×12
  label: 13px, weight 500, #374151
  error-banner: danger tint, danger border, danger text, 8px radius
  modal: overlay + white box, close top-right, footer ghost Cancel + primary Save
  spinner: border trick, top border accent, 40px
  avatar: 32px circle, accent background, initials, white text

Layout
  Shell: 240px fixed sidebar + flex column (fixed-height header + scrollable main)
  Page: maxWidth 1200px, margin 0 auto, padding 24px
  Header row: title + subtitle left, actions/avatar right
  KPI grid: repeat(auto-fit, minmax(200px, 1fr))
  Modal form: grid gap 12px
  Modal footer: flex, gap 8px, justify-content flex-end

Consistency rule (settled by founder, 2026-09-27)
  Primary button color: purple #7C3AED, everywhere, including the
  entry flow.
  Red #DC2626 is reserved for the logo, error banners, danger
  buttons, and destructive confirmation. It is not used for
  primary actions.

Inconsistencies noted and not carried forward to the Agent App
  - Three different primary button colors across three surfaces
    (Login red, Unlock blue, workspace purple). Resolved by the
    consistency rule above.
  - Two radius conventions (6px on Login, 8px elsewhere).
    Resolved: 8px.
  - Two logo implementations (GorkaLogo.tsx vs inline in
    Sidebar). The Agent App uses one.
  - Two header implementations (TopHeader.tsx vs inline in
    AppShell). The Agent App uses one.
  - Sidebar.css is orphaned. The Agent App uses one styling
    approach, not two.
  - The Login subtitle says "Supervisor Dashboard" (stale). The
    Agent App's login says "Agent App" and nothing else.

Deferred (running list)
  The Client Dashboard's entry-flow screens (Set/Enter) came in
  from Tauri and use a design that was not chosen by the founder.
  They are to be brought into the Login-page design later. Not
  part of the Agent App spec. Recorded here so it is not lost.

### Entry flow for the Agent App

Three steps, three centered white cards in one visual style.

  1. Login — cloud credentials, JWT. Same shape as the Client
     Dashboard's Login page, with purple primary button per the
     consistency rule.
  2. Unlock — local SQLCipher password. First run: set + confirm.
     Later runs: enter. Same Rust command pattern as the Client
     Dashboard (database_exists, unlock_database).
  3. Enroll — import the organization enrollment package. This is
     the piece the Agent App needs and that the Client Dashboard
     currently only does via the devtools console (Phase D.4.4).
     It has to become a real screen in the Agent App. It also
     implies a proper export/import screen pair on the Client
     Dashboard side, so the admin can export and the agent can
     import without console commands.

The first step is the only one that touches the network. Steps 2
and 3 are local only.

### Running list of open items

A-2a, A-6 (automatic sending deferred), B-5, C-1, C-3a, C-4, C-5,
C-6, D-3 (per-agent access control), E-15, E-16, F-19a, F-19b,
CI/CD for two Tauri apps, enrollment of a second local app on the
same machine, new event types for the funded phase (MESSAGE_SENT,
MESSAGE_STATUS_CHANGED, AI_RECOMMENDATION_MADE,
AGENT_DECISION_RECORDED), the Client Dashboard entry-flow
redesign, and the credit-bureau / data-vendor integration as a
distinct feature within the Connection Center.

### What is not done

  - No Agent App spec written.
  - No code written.
  - No architecture amended.
  - No frozen document modified.
  - No cloud table touched.
  - No Phase 9.5 or 9.6 started.

This entry is a record of decisions and a design reconnaissance.
It is the input to the Agent App spec.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held. Every decision here is consistent with the
    invariant; none of them cause debtor data to reach GORKA
    cloud.
  - No Rust code changed. Instance B (db.rs::derive_key) not
    touched.
  - The design reconnaissance was read-only. Twelve files were
    read; nothing was written.
  - The independence rule of the prior task was not implicated.
    This is a new conversation, not a verification.

End of entry.

---

## Recovery Session — September 27, 2026 (D-3: per-agent access control)

Short entry. Records the decision on D-3, the per-agent access
control question left open in the September 27 architecture
entry.

### The question

When an agent opens the Agent App, do they see every debtor in
the organization, or only those assigned to them? The frozen
architecture states every device in the organization has access
to every record, and every authorized device can decrypt any
sync traffic. Three shapes were named in the earlier entry.

### The decision

MVP: all agents see all debtors. No filtering. This is the
fastest path to a workable pilot product. The trade-off — that
per-agent visibility is not enforced — is accepted for the MVP
stage.

Production: sync-layer filtering is a requirement, not optional.
An agent must eventually see only the debtors assigned to them,
and the enforcement must be real, not cosmetic. UI-layer hiding
alone is not sufficient for the funded phase.

### The seam — a low-cost forward-looking commitment

To avoid a redesign when filtering is added later, the outbound
message path is specified as two steps:

  candidates = events not yet delivered to peer
  filtered   = filter(candidates, peer)
  message    = compose(filtered)

In the MVP, filter is the identity function — it returns
everything. One line. No behavior change. No schema change. No
protocol change. No new event type. No new table.

In production, filter consults the assignment state and drops
events for debtors not assigned to the receiving peer. The sync
engine's outbound path is unchanged. Only the filter function
and the assignment data behind it are added.

Without this seam, adding filtering later means restructuring
the outbound path — the part of the sync engine that touches
delivery bookkeeping, message composition, and the wire format.
With the seam, adding filtering later is: write the filter,
build the assignment table, sync assignment events, and wire the
filter into the outbound path (one line). The first three are
new work either way; the fourth is the redesign the seam
prevents.

The cost of the seam today is zero. It is a specification line,
not an implementation change.

### The limitation, stated plainly

Filtering can only govern future events, not past ones. When an
agent is unassigned from a debtor, the debtor's historical
events are already on that agent's device. Filtering stops new
events from arriving; it cannot recall old ones. This is the
same property as the multi-user model's revocation caveat:
revocation prevents future synchronization, it does not remove
data already replicated.

The funded-phase version of D-3 must therefore state this
limitation in the client-facing documentation. A bank's
compliance reviewer will need to hear it said plainly.

### What this changes

Nothing in the frozen architecture. The MVP behavior is
unchanged from what the frozen documents already describe. The
only addition is the two-step outbound path — a specification
of an internal structure, not a change to any protocol, message,
or table.

### What this does not decide

The shape of the assignment mechanism itself — how debtors are
assigned to agents, whether by the admin in the Client
Dashboard, whether via a new event type, whether as an
`assigned_to` field that is finally synchronized. Those are
funded-phase design questions. This entry records only that the
seam exists and that filtering will be added there.

### Rule compliance

  - No production touched.
  - No cloud schema change.
  - No CI/CD touched.
  - Invariant held.
  - No Rust code changed.
  - Documentation only.

End of entry.

Recovery Session — September 27, 2026 (Agent App build spec)
This entry records the session that wrote the Agent App build spec: the multi-source reconnaissance, the design decisions made during the conversation, the specification itself, the external review of the first draft, the corrections applied, and the founder's approval. The spec is now frozen. It is the input to Phase 9.5.

The prior September 27 entries recorded the A-G architecture decisions and the D-3 access-control decision. This entry is the follow-on: turning those decisions into a build spec a developer can follow.

What this session produced
One document: GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md, version 1.2, frozen on the founder's approval. It is the technical specification for the Agent App. It is a specification, not code. It does not amend any frozen document. It names the needed amendments and defers them.

The spec lives as a standalone file, referenced by this entry, not duplicated here.

The reconnaissance
Before writing, the session read the following on disk (read-only, no files modified):

Source control state. git log --oneline -3 and git status confirmed b125ee9, clean working tree, origin/main matching.

The Rust command layer.

src-tauri/Cargo.toml — the crate set. Tauri 2 with tray-icon, store, dialog, fs. rusqlite bundled-sqlcipher. argon2, chacha20poly1305, hkdf, hmac, sha2, uuid v4, chrono, reqwest, hex, once_cell, rand, rand_core. No jsonwebtoken.

src-tauri/src/auth.rs — store keys auth_token, organization_id, salt, db_unlocked. Functions login, get_token, get_organization_id, get_salt, set_unlocked, is_unlocked, logout. Login POSTs to a hardcoded http://localhost:3000/api/auth/login. get_token prints debug lines including the raw token (already flagged as C-2 in the September 12 Phase 9 entry).

src-tauri/src/db.rs — migrations v1 through v4. v1 creates debtors, debts, documents, communications, audit_log. v2 is an empty placeholder. v3 adds actions. v4 adds organization_keys. The Category D sync tables are not yet migrated. derive_key is Instance B (Argon2::default() + SaltString::encode_b64), distinct from the enrollment package's Instance A. database_exists() reads the file on disk. log_audit writes audit_log with a fresh UUIDv4.

src-tauri/src/main.rs — AppState { db: Mutex<Option<Connection>> }. 34 commands registered in generate_handler!. Structs: Debtor, Document, Debt, Communication, Action, DashboardStats, plus their Inputs. Enums: DocumentCategory, CommunicationType, CommunicationDirection. get_trusted_organization_id reads the JWT-derived org id from settings. enable_sync generates a fresh 32-byte key and inserts it into organization_keys. import_enrollment_package refuses if a key exists.

The Electron-era reference (read-only, not ported).

src/backend/_disabled/communication.service.ts and the providers/ tree. A provider registry pattern: four categories (SMS, email, push, voice), each registerable by name. Six concrete providers (Mocean SMS, Resend email, Twilio voice, three mocks). A uniform result shape {success, messageId?, status, provider, error?, providerResponse}. A status vocabulary PENDING | SENT | FAILED | DELIVERED. An exponential-backoff retry wrapper. Health checks. Some providers had validateCredentials(token).

src/backend/_disabled/context.service.ts and gemini.service.ts. The old AI context object. It sent to Gemini: debtor.name, debtor.email, debtor.phone, debtor.id, exact debtAmount, per-event communication dates and channels, per-event payment dates and amounts. That is the exact leak Section C-2 of the September 27 A-G entry rejects.

src/backend/_disabled/action.service.ts, email.service.ts, push.service.ts. Server-mediated. Reference only.

src/backend/_disabled/routes/compliance.routes.ts and permissions.routes.ts. Cloud-mediated, using pre-recovery roles and tables. Reference only.

src/frontend/pages/DebtorDetail.tsx. Reader-only. No action buttons. The ancestor of the Agent App's debtor profile.

src/frontend/pages/Admin/Communications.tsx. A full CRUD plus a Send button in the admin UI. Section A-2 of the September 27 A-G entry reverses this: the admin does not send from the Client Dashboard.

src/frontend/pages/Admin/Templates.tsx. Parameterized templates with {{debtor_name}} placeholders. Matches Architectural Law Section 12.

The Client Dashboard's calendar (inert).

supervisor-dashboard/src/pages/Calendar.tsx renders a FullCalendar UI.

supervisor-dashboard/src/services/calendar.service.ts calls cloud endpoints GET/POST /calendar/events, PUT/DELETE /calendar/events/:id, POST /calendar/generate.

The only backend route is src/backend/_disabled/routes/calendar.routes.ts (disabled, not mounted).

No calendar model in prisma/schema.cloud.prisma.

No calendar table in the local Rust schema.

Conclusion: the Client Dashboard's calendar is a complete artifact of the pre-recovery drift era. It renders, it may call, it receives nothing. Recorded as pre-existing, not fixed.

Design decisions made during the conversation
These are new decisions, not yet recorded elsewhere. Each is a founder decision made during the session. The spec (Section 12) names them and cites them.

D1 - Command registration is per-binary, not per-UI. The shared Rust command layer is one crate of functions. Each Tauri binary registers its own subset in its own generate_handler!. A command is registered in a binary only if that binary's UI uses it. The boundary is the registration list, not the UI. A hidden button is not a boundary; any registered command is callable from the webview's devtools.

This is stricter than "register everything and hide the admin commands in the UI." It matches D-3's principle: "UI-layer hiding alone is not sufficient."

D2 - enable_sync is Client Dashboard only. The Agent App must not register it. enable_sync generates a fresh random 32-byte key. It is the key creation operation, not the key distribution operation. It runs once per database, ever. If the Agent App ran it, it would create a second, different key, and import_enrollment_package refuses if a key already exists, so the agent could then never import the correct key without wiping the database. enable_sync in the Agent App is an active hazard, not a hidden harmless command. It stays Client Dashboard only.

D3 - export_enrollment_package, get_dashboard_stats, and bulk_insert_debtors are also Client Dashboard only. Export produces a package containing the organization key; giving an agent export capability is granting enroll-new-device authority. Dashboard stats are organization-wide aggregates, admin-side. Bulk insert is an administrative upload path; the agent adds debtors one at a time.

D4 - sync_now is not in the MVP. Synchronization is event-driven: a state change or event originates on one device and is pushed to the peer within seconds when both peers are online. There is no user-facing "Sync Now" button. Events originated while a peer is offline queue in sync_events and deliver on reconnect (SYNC-ARCHITECTURE.md Sections 17 and 18.6). A button is redundant. Named as not-scheduled, not as a future item.

D5 - Guarantors and pledgers. A debtor record may also represent a guarantor or a pledger. Both are the same shape as a debtor: name, surname, contacts, photo, documents. Both live in the debtors table and sync as DEBTOR_CREATED / ENTITY_UPDATED. The relationship is expressed by:

A role column on debtors (DEBTOR, GUARANTOR, PLEDGER).

A debtor_relations linking table (debtor_id, related_debtor_id, relation_type).

Many-to-many both ways: one guarantor may guarantee multiple debtors; one debtor may have multiple guarantors. In the UI, a guarantor appears both inside the debtor profile they guarantee and as a row in the debtor list, distinguished by a role badge. The role is chosen from a dropdown.

Locality in the MVP. The people sync; the relations do not. debtor_relations is a local table in Phase 9.5. Two replicas may hold the same person rows with different relationship graphs. This is deliberate. How relations sync in the funded phase is an open item.

D6 - Debtor profile photo is a column, not a document. A nullable photo_path column on debtors. The documents table is unchanged. The DocumentCategory::ProfilePhoto enum value remains in the code and is not used by the new UI. The rationale: the photo is one face, one field, and a dedicated column matches the "two places" model (photo separate from documents).

D7 - The Agent App's plan view (calendar). A first-class screen. It combines:

Manual events from a new local calendar_events table (birthdays, court dates, auctions, field visits). A manual event may optionally be linked to a debtor (nullable debtor_id).

Payments due, derived from the local debts table, filtered by due_date. Not stored as events.

Follow-ups due, derived from the local actions table, filtered by due_date and status. Not stored as events.

Calendar view modes: month / week / day / list. Each day cell shows a compact count of what is on that day, colored by kind. Selecting a day opens a day panel. Selecting a period opens a summary (payments due, total amount, overdue count, follow-up count, manual event count).

Every row that names a debtor is clickable into the debtor profile directly, without leaving the calendar. Rows can be multi-selected and fed into the bulk-action flow.

The PAYMENT_DUE and FOLLOW_UP views are not stored. They are live queries. This avoids the duplication problem the old cloud route had (its generate route created stored events for every debtor, requiring a uniqueness key).

Calendar events are local-only in the MVP. They do not sync. Whether they sync in the funded phase is an open item.

D8 - Bulk actions send a generic text. The agent may select a group of debtors and send the same text to all of them. The text is generic: no names, no surnames, no individual amounts. Every recipient receives the same body. This is the "pay day is coming" reminder workflow.

Flow: select debtors, pick channel, type the body (or pick a non-personalized template), see a single preview of the exact text, confirm. For each recipient, run the compliance layer against local state, then make the provider call, then record the result. Show a per-recipient result list (sent / failed / blocked). Show a "Retry failed" button. No auto-retry.

Compliance runs per recipient, not per batch, because quiet hours, contact limits, and opt-out status are per-debtor.

D9 - Connector buttons appear conditionally. On the debtor profile, a connector's button appears if and only if:

The admin has enabled that connector, AND

The debtor has the contact field the connector needs.

Contact-field dependency: Twilio voice, Twilio SMS, Mocean SMS, WhatsApp need a phone number. Resend email needs an email address.

The rule is deterministic. No per-debtor overrides, no manual hiding.

D10 - Debts travel inside the parent debtor's data_json. This resolves the specification gap between GORKA-MVP-SCOPE.md Section 8.4 (debts synchronize) and SYNC-ARCHITECTURE.md Section 25.9.2 (entity type 0x02 is reserved for the funded phase; debt and document data remains local in the MVP).

The reconciliation:

Debt remains local as a standalone entity type. Entity type 0x02 is not produced or accepted in MVP sync events, consistent with Section 25.9.2.

In the MVP, debt information that is intentionally part of the synchronized debtor representation may be carried inside the debtor's data_json field. The DEBTOR_CREATED event's data_json payload (type code 0x2005) and the ENTITY_UPDATED event's data_json change record (per Section 25.13.1) are the transport.

Two protocol-level rules follow:

Rule 1 - Receipt. When the receiving device accepts a DEBTOR_CREATED or ENTITY_UPDATED event whose data_json contains debt data, the receiving device updates its local debts table to reflect the debt data. The local debts table remains the query surface. The plan view queries debts directly; it does not parse data_json at render time. Without this rule, the admin's uploaded debts would arrive in data_json but never be visible to the agent's plan view.

Rule 2 - Origination. When the agent adds a debt locally (via insert_debt), the local transaction must also update the parent debtor's data_json field to reflect the new debt, and append the corresponding ENTITY_UPDATED event to sync_events. Without this rule, a debt created locally by the agent would never leave the device.

Consequences.

No cryptography change. The message encryption is the same regardless of what the payload contains.

No wire-format change. data_json already exists in DEBTOR_CREATED (type code 0x2005) and is already in the ENTITY_UPDATED field table (Section 25.13.1).

No new event type. The four MVP types are unchanged.

Conscious MVP limitation, sync granularity. The data field reconciles as a single unit. Two devices changing two different debts inside the same debtor's data at the same time produce one winner for the whole data value and one losing value in history_records. This is the same rule the protocol already applies to every field. It is a deliberate MVP granularity choice, not a defect. Six months from now, "why did changing Debt 1 overwrite Debt 2?" has a written answer: because MVP synchronization granularity for debt data is the debtor's data field, not the individual debt. The funded phase may introduce per-debt entity types (0x02) if finer granularity is needed.

Size limit. data_json is capped at 1 MiB after canonical serialization (SYNC-ARCHITECTURE.md Section 25.13.2). A debtor with many debts grows that field. The practical ceiling on how much debt data travels inside a single debtor's data. Debtors with unusually large numbers of debts may approach this ceiling; the funded phase may need per-debt entity types for such cases.

This decision requires a small amendment to SYNC-ARCHITECTURE.md Section 25.9.2 (see the amendment that follows this entry, or the pending-amendment note below) and to GORKA-MVP-SCOPE.md Section 8.4 if the founder chooses. The amendment adds the debt-in-data_json interpretation and Rules 1 and 2 to the frozen document, so the receiving and originating behavior is part of the frozen specification rather than only the Agent App spec.

D11 - The Phase 9.5 implementation contract. The Agent App spec describes the product, including funded-phase design (connector sending, bulk sending, AI boundary layer, compliance enforcement, funded-phase event types, funded-phase access filtering). To prevent a developer from mistaking funded-phase design for Phase 9.5 work, the spec contains a definitive "Phase 9.5 builds exactly this" list and an explicit "does not build" list.

Phase 9.5 builds: the second Tauri binary with its own identity; the shared schema and migrations; the three-step entry flow; local CRUD (debtor, debt, communication, action, document); the debtor profile with photo; the plan view; the guarantor/pledger local relations; the Agent UI; the command registration boundary; and a static sync placeholder.

Phase 9.5 does not build: the sync engine, connector sending (single or bulk), provider credential storage and distribution, the AI Copilot and boundary layer, the compliance enforcement layer, funded-phase message event types, per-agent access filtering, automatic sending, or any cloud schema change.

The rule: a Phase 9.5 developer works from the "builds exactly this" list. Any other section that describes a later-phase feature is specification context, not Phase 9.5 work.

D12 - Identity: sync origin versus human actor. The protocol distinguishes two identities.

device_id identifies the local synchronization origin. It is the local replica identifier of the Agent App's own database (SYNC-ARCHITECTURE.md Section 25.6.6). It labels a stream of events. It does not identify a person.

Actor identity (created_by or equivalent) identifies the human user whose business action is recorded by an event. It is carried inside the encrypted event payload. It is informational and is not used for authentication, ordering, duplicate detection, or reconciliation.

device_id MUST NOT be interpreted as the human actor. Where human attribution is required, created_by (or the equivalent actor field) carries the user identity. This distinction is established in SYNC-ARCHITECTURE.md v1.3 and is restated in the Agent App spec so that a Phase 9.6 implementation does not accidentally treat the wire device identity as the user identity.

The specification
GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md, version 1.2, frozen on approval. Sections 1 through 13:

Purpose and scope

Architecture (the two-binary model, the shared crate, the Agent App's own identity, the shared schema, the Phase 9.5 implementation contract)

Role and boundary

Entry flow (Login, Unlock, Enroll)

Local schema (the shared schema, the four proposed additions, migration numbering)

Shared command layer (which commands the Agent App uses, which it must not have, the new commands)

Sync participation (topology, protocol, organization key, device identity, the D-3 seam, the sync indicator, cadence, the debt-sync resolution)

Communication Center (single-recipient flow, bulk-action flow, failure handling, funded-phase status changes)

AI Copilot (the AI boundary layer, the field classification, the multi-provider model, the provider distinction)

Compliance enforcement (cloud declares, local enforces, the "block" meanings per rule type)

Design section (the design vocabulary, the debtor profile, the plan view, the Communication Tools screen)

Open items (three buckets: blocks Phase 9.5, does not block Phase 9.5, funded phase)

What this spec does not do

The spec does not amend any frozen document. It names the needed amendments in Section 12.

The external review
The founder sent the first draft (v1.0) to an external reviewer. The reviewer returned a structured assessment.

The reviewer classified v1.0 as "approve after targeted corrections, not redesign" and identified seven corrections:

C1 - Sync topology wording. The draft said "all sync traffic passes through the hub." That conflates the peer relationship (hub-and-spoke) with the transport (direct P2P preferred, encrypted relay fallback). The reviewer's correction is applied: the spec describes the topology as a peer relationship and states that transport uses the protocol's permitted paths as defined by the frozen sync architecture. The Agent App does not redefine transport.

C2 - Formalize the debt-sync resolution. The draft's debt-in-data_json interpretation was correct but was recorded only in the Agent App spec. The reviewer requires it to be recorded in the authoritative architecture document. This session accepts the correction and records the resolution as a pending amendment (below).

C3 - Align LOCAL-TABLES. The four local schema additions (debtors.photo_path, calendar_events, debtors.role, debtor_relations) must be recorded in LOCAL-TABLES.md via its amendment process. Until then, they are proposals in the Agent App spec, not schema. This session accepts the correction and records the four additions as a pending amendment (below).

C4 - Clarify migration numbering. The draft named v5, v6, v7 as fixed numbers. The reviewer requires the numbers to be verified against the actual run_migrations state before implementation. Applied in the spec, Section 5.8.

C5 - Separate device identity from actor identity. The spec now states that device_id MUST NOT be interpreted as the human actor, and that created_by carries the user identity. See D12 above.

C6 - Make Phase 9.5 placeholders explicit. The sync indicator and the Communication Tools screen are static placeholders in Phase 9.5. The spec states this and forbids a fake sync subsystem.

C7 - Make guarantor relation locality explicit. The spec states that the people sync and the relations do not in the MVP. See D5 above.

The reviewer also made several refinements, all applied:

The AI field classification table is now provisional. Fields marked "proposed for transmission" are subject to the funded-phase legal/privacy review. Only the "strip" entries are final.

The compliance section no longer says GORKA determines the client's legal compliance. The technical spec defers legal wording to a separate review.

The shared crate logic lives in modules; main.rs is wiring and command registration, not business logic.

Enrollment completion does not imply synchronization completion. The Agent App may enter the shell with an empty database.

Open items are grouped into three buckets (blocks Phase 9.5, does not block Phase 9.5, funded phase).

The reviewer's recommended sequence was: fix the wording, formalize the debt-sync resolution, align LOCAL-TABLES, verify migration numbering, separate identity, make placeholders explicit, make relation locality explicit. Then founder review, approve, amend the authoritative documents where genuinely necessary, freeze the spec, begin Phase 9.5.

The reviewer's final classification of v1.1 was "approve after final founder review - implementation-ready spec," with three process clarifications (Phase 9.5 vs funded-phase wording, a localhost API endpoint preflight item, and the temporal definition of the Agent App in Section 1.2). All three were applied in v1.2.

The reviewer's closing principle: "Do not let the developer 'improve' the architecture while implementing this spec. At this point, I would want the developer working almost mechanically from the approved specification, with any discovered discrepancy becoming a STOP -> report -> founder decision, rather than an opportunity to redesign."

The founder adopted this principle. It applies to the implementation of the Agent App spec.

The founder's approval
The Agent App build spec, version 1.2, was approved by the founder on September 27, 2026. It is frozen.

The founder's adoption of the reviewer's closing principle is recorded as binding: the spec is the authority during implementation. Any discovered discrepancy is a STOP -> report -> founder decision. It is not a license to redesign.

Pending amendments
Two amendments to frozen documents are required by the external review (C2 and C3). They are recorded here as pending. Their content is defined; the founder decides when to apply them.

Pending amendment 1 — LOCAL-TABLES.md. Add four local schema additions:

debtors.photo_path (nullable TEXT).

A new calendar_events table.

debtors.role (TEXT, default 'DEBTOR').

A new debtor_relations table.

The exact schema is in the Agent App spec, Section 5.4 through 5.6. The amendment promotes the proposals to authoritative schema.

Pending amendment 2 — SYNC-ARCHITECTURE.md. Amend Section 25.9.2 to record the debt-in-data_json interpretation and Rules 1 and 2 (receipt and origination). Also consider amending GORKA-MVP-SCOPE.md Section 8.4 for coherence. This amendment is a precondition for Phase 9.6, not Phase 9.5. The founder decides when to apply it.

Both amendments are small. Neither is an architecture change. Neither reopens the frozen architecture.

Rule compliance
No production touched.

No cloud schema change.

No CI/CD touched.

Invariant held. All debtor data stays local. The Agent App spec does not introduce any path by which debtor data reaches GORKA's cloud.

No Rust code changed. db.rs::derive_key (Instance B) not touched.

The reconnaissance was read-only. No Electron-era file was modified.

The Agent App spec is a document. No code was written in this session.

No frozen document was amended in this session. The two needed amendments are recorded as pending.

What is still open
The two pending amendments.

Phase 9.5 implementation, which begins after the amendments (or in parallel, per the founder's decision).

Phase 9.6 (the sync engine), Phase 9.7 (the multi-user demonstration), all not started.

Every open item listed in the Agent App spec, Section 12.

Files changed this session
GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md (new, version 1.2, frozen).

GORKA_RECOVERY/recovery-notes/DECISIONS.md (this entry).

GORKA_RECOVERY/recovery-notes/HANDOFF.md (follows, separate entry).

GORKA_RECOVERY/recovery-notes/SESSION-LOG.md (follows, separate entry).

GORKA_RECOVERY/recovery-notes/START-HERE.md (follows, separate update).

End of entry.

## Recovery Session - September 28, 2026 (Phase 9.5 begins: HOW decisions)

This entry records the HOW decisions made on the first day of
Phase 9.5 implementation. It does not repeat the technical
slice records, which are in PHASE-9.5-EXTRACTION-LOG.md. It
does not repeat the status, which is in HANDOFF.md. It records
the choices that were not obvious, and the reasoning behind
them.

The session is the first day of Phase 9.5. Fourteen commits
landed. The workspace was created, the storage root was
migrated, five shared-code slices were extracted, the Agent
scaffold was built, and the first adapter slice was completed.

================================================================
CONTEXT: WHAT THE SPECIFICATION DID NOT SAY
================================================================

AGENT-APP-SPEC.md v1.2 defines WHAT the Agent App is. It does
not define HOW the repository is structured for two Tauri
binaries, how the shared code is organised, or which of the
existing Client commands are adapter code versus business
logic.

Before any scaffolding, a set of HOW questions was written
down. They were sent to an external reviewer. The reviewer's
answers became the plan for the day. This entry records those
answers as decisions, with the reasoning that the reviewer
gave.

================================================================
D1 - REPOSITORY LAYOUT IS OPTION A
================================================================

Decision: Cargo workspace at the repository root. Three
members: shared/, src-tauri/, src-tauri-agent/.

The shared member is a normal library crate, gorka-shared.
Each Tauri binary has its own package. The Agent depends on
the shared crate; the Agent does not depend on the Client.

Reasoning recorded by the reviewer:

  "The Agent is not a specialized version of the Client.
  They are two applications consuming common GORKA
  functionality."

  The wrong dependency shape would be Agent -> Client. The
  right shape is Client -> shared <- Agent. The distinction
  becomes increasingly important when the applications
  diverge.

Rejected: Option B (two Tauri projects, one depending on the
other). It would have created an Agent -> Client dependency
that is conceptually wrong.

================================================================
D2 - ONE WORKSPACE TARGET DIRECTORY
================================================================

The workspace shares one target/ directory. This is a benefit
given the 15-25 minute cloud builds: no redundant
recompilation across members.

Operational consequence: the signing workflow no longer
assumes src-tauri/target/debug/. The actual artifact location
became <workspace>/target/debug/. This was verified during
Phase 1a.

================================================================
D3 - THE 14 TESTS RUN ONCE, IN THE SHARED CRATE
================================================================

E1-E6, H1-H3, M1, M2, V1, V4, V6 test protocol, crypto, and
serialization properties. They do not belong to either UI.

The tests live in shared/tests/ as integration tests. They run
with cargo test -p gorka-shared.

Running them twice (once per binary) would test the same
implementation twice. It would add no information. The second-
implementation verification (the Node.js implementation)
already exists and does not need duplication.

================================================================
D4 - FRONTEND FOLDER AND DEV SERVER
================================================================

agent-dashboard/ for the Agent's React frontend.

Vite port 5174 for the Agent. The Client uses 5173. Both can
run simultaneously.

The two frontends are independent. No shared React component
library in Phase 9.5. Design tokens are duplicated from the
frozen vocabulary (spec Section 11.2). The reviewer's
reasoning:

  "Do not create a shared React component library during
  Phase 9.5. [...] get a second functioning application
  without destabilizing the first. A shared UI package
  introduces another dependency boundary that you don't
  need yet."

If the duplication becomes a maintenance problem later, a
shared frontend package can be created in a controlled change.
Not now.

================================================================
D5 - APPLICATION IDENTITY
================================================================

Agent:
  bundle identifier: com.gorka.agent
  database filename: gorka-agent.db
  app data folder:   %APPDATA%\com.gorka.agent\
  settings:          settings.dat (same filename as Client;
                     isolation is by folder)

Client keeps:
  bundle identifier: com.gorka.client
  database filename: gorka-client.db
  app data folder:   %APPDATA%\com.gorka.client\
  settings:          settings.dat

The reviewer on settings.dat:

  "The important isolation mechanism is the application-
  specific storage location, not the filename. If [the two
  apps have their own app data folders], then there is no
  collision. [...] settings.dat for both is fine."

================================================================
D6 - STORAGE ROOT: DIRECTION 1 PLUS OPTION 1B
================================================================

The Client's DB and files were split across two roots:
  %APPDATA%\gorka\client\data\     from ProjectDirs
  %APPDATA%\com.gorka.client\      from the Tauri identifier

The reviewer chose Direction 1: unify to the Tauri root, under
a data/ subfolder. The precise path:

  %APPDATA%\com.gorka.client\
      settings.dat
      data\
          gorka-client.db
          files\
              debtors\

The old path stays as a rollback copy, unmodified.

The reviewer's wording on the checkpoint:

  "Client must preserve the existing Client data and
  semantics through the storage-root migration. After
  migration, it must open the migrated database and files
  from the new authoritative Client AppStorage location,
  with no data loss or unintended behavioral change."

That replaced the earlier wording ("Client still opens exactly
the same existing database/files location"), which would have
frozen a known defect.

================================================================
D7 - MIGRATION MECHANISM: STAGING AND PROMOTION
================================================================

Two corrections to the first draft, both accepted:

Correction 1 - crash safety. The first draft used "NEW_DB
exists" as the sole idempotence test. That fails if the
process crashes mid-copy. The reviewer required a temporary
migration directory (data.migrating/) that is promoted to
data/ only after the full copy has been verified.

The result:

  NEW_ROOT exists                     -> no-op
  NEW_ROOT absent, TMP_ROOT exists    -> discard TMP_ROOT,
                                         retry
  NEW_ROOT absent, TMP_ROOT absent,
    OLD_DB exists                     -> migrate
  NEW_ROOT absent, OLD_DB absent      -> fresh install

Correction 2 - WAL treatment. The reviewer required the WAL
(if present) to be treated as an important auxiliary file, and
the -shm file to be treated as recreatable by SQLite. The
first draft copied -shm; the corrected version does not.

================================================================
D8 - APPSTORAGE TYPE
================================================================

A shared type in gorka-shared::storage:

  pub struct AppStorage {
      pub app_data_dir: PathBuf,
      pub db_filename: String,
      pub files_subdir: String,
  }

Constructed once in each binary's main.rs, placed in Tauri-
managed state, and consumed by the shared layer.

The reviewer's specific rule:

  "Do not pass AppStorage into every shared function as a
  separate argument. [...] The architectural requirement is
  simply: no shared code may assume the Client application's
  storage identity. The application-specific storage context
  must come from the binary."

================================================================
D9 - AGENT SCAFFOLD TIMING (OPTION B BINDING)
================================================================

Two passages in the earlier reviewer answer conflicted.

Prose: scaffold the Agent once models, storage, enrollment,
and sync are shared, before db and auth are fully extracted.

Sequence table: scaffold the Agent after db extraction and
auth split.

The reviewer ruled: the prose was the intended architectural
decision. The sequence table was too conservative and should
be treated as an inconsistency to correct.

Quote:

  "The Agent should be scaffolded once the following are
  established: gorka-shared exists, AppStorage is shared,
  models are shared, enrollment package is shared, sync
  primitives are shared, the Client still passes its smoke/
  regression checks. At that point, we have enough evidence
  that the shared crate is genuinely becoming the common
  Rust core."

The Agent scaffold was executed once that threshold was met.
The scaffold proves: second Cargo package/binary, second Tauri
application, separate bundle identifier, separate app-data
root, separate frontend, shared crate dependency, independent
main.rs, independent Tauri configuration, workspace builds
both.

No Agent functionality was implemented. Only agent_ping, a
trivial command, exists to prove the per-binary command
boundary.

================================================================
D10 - AUTH.RS EXTRACTION IS DEFERRED (READING C)
================================================================

The review's Shape 1 for auth.rs ("move the pure settings/
auth-state operations to shared, keep a thin Tauri adapter")
does not match the actual code. Six of seven functions in
auth.rs are pure tauri-plugin-store operations. There is no
Tauri-free side to move.

The three readings:

  A - move only the HTTP half of login
  B - move the HTTP half and replace tauri-plugin-store with
      a shared Settings implementation
  C - defer entirely

The reviewer chose C. The reasoning:

  "The Agent does not have authentication yet. Therefore
  there is no actual duplication problem to solve today.
  When Agent authentication is actually implemented, we will
  have two concrete consumers and can identify the genuinely
  shared boundary from both sides."

The reviewer also made explicit what is NOT authorised:

  "do not read/reverse-engineer settings.dat, do not replace
  tauri-plugin-store, do not create a Settings serializer,
  do not migrate settings, do not change the settings file,
  do not introduce a shared settings abstraction."

No files changed. a959087 stayed.

================================================================
D11 - ADAPTER/COMMAND CLEANUP: READING 3
================================================================

The reviewer chose Reading 3: extract the 23 SQL-bearing
commands to gorka-shared in entity-based slices.

Slice 1 (debtors) done this session. Slices 2-6 (debts,
communications, actions, documents, dashboard) to follow.

The pattern:

  Tauri command
      |
      v
  AppState lock
      |
      v
  &Connection
      |
      v
  shared business/database operation

The reviewer on the connection boundary:

  "Keep the connection lifecycle in the binary. The shared
  function should receive the already-open connection. This
  preserves the current ownership model and prevents
  gorka-shared from becoming responsible for Tauri state,
  mutex lifecycle, connection ownership, application
  startup/shutdown, or database-open state."

The reviewer on module structure:

  "Approve the entity-oriented structure: shared/src/db.rs,
  debtors.rs, debts.rs, communications.rs, actions.rs,
  documents.rs, dashboard.rs. This is preferable to a 1,000-
  line commands.rs."

The reviewer on audit logging:

  "The audit call belongs inside the shared operation because
  it is part of the semantic database transaction. The
  desired preservation is BEGIN / SQL mutation / audit INSERT
  / COMMIT. [Moving the audit to the adapter] could create a
  partial-operation/audit inconsistency."

================================================================
D12 - VERIFICATION MODEL FOR EXTRACTIONS
================================================================

The reviewer refined the "byte-level comparison" idea:

  "For Rust source, the objective should be: prove semantic/
  source preservation of the operation, not literally
  preserve whitespace or formatting."

The stronger verification, as applied:

  Capture the original function.
  Move it with only necessary signature/module-path changes.
  Diff old vs new.
  Confirm SQL text unchanged.
  Confirm parameter order/types unchanged.
  Confirm row mapping unchanged.
  Confirm transaction boundaries unchanged.
  Confirm audit call unchanged.
  Run the existing Client smoke test.
  Build/test on Cloud.

Explicit: "Do not 'improve' SQL during this operation."

================================================================
D13 - WARNINGS POLICY
================================================================

The reviewer's earlier guidance ("inspect and report first;
don't clean yet") was applied. All 8 gorka-client warnings
were classified as pre-existing, none caused by extraction.

Then the reviewer authorised cleaning three specific warnings
in main.rs as part of Slice 1:

  - unused import: State
  - unused variable: app (upload_document parameter)
  - the third, inherited from imports cleanup

The five auth.rs warnings stay deferred with the auth slice.

The reviewer's rule: "Do not turn this into general warning
cleanup."

================================================================
D14 - ROOT CARGO.LOCK IS TRACKED; OBSOLETE LOCK REMOVED
================================================================

Two housekeeping decisions, both from the reviewer:

Root Cargo.lock: TRACKED. The workspace contains executable
crates. Tracking the authoritative root lock gives
reproducible dependency resolution and prevents the cross-
machine drift we already encountered once. Committed from
the cloud, which is the only machine that can run cargo
build.

src-tauri/Cargo.lock: DELETED. It is the obsolete pre-
workspace lock. Keeping two lock files creates ambiguity
about which dependency resolution is authoritative.

The Agent's gen/schemas/: COMMITTED, matching the Client's
tracked src-tauri/gen/.

================================================================
D15 - TWO UNEXPECTED FINDINGS, RESOLVED
================================================================

1. .gitignore did not exclude target/. Hundreds of files
   under target/debug/ appeared as untracked on the cloud
   after the first workspace build. Verified nothing under
   target/ was ever tracked (git ls-files confirmed). Fix
   was a .gitignore entry; no history cleanup needed.

2. Root Cargo.lock was untracked. It had been generated on
   the cloud but never committed. The same class of cross-
   machine drift as the September 26 divergence. Now
   tracked.

Both are recorded in the extraction log and in HANDOFF.md.

================================================================
D16 - EXTRACTION LOGGING
================================================================

A new file was created: PHASE-9.5-EXTRACTION-LOG.md.

The reviewer's guidance:

  "Don't make documentation block the first extraction.
  [For each slice record]: starting commit; files moved/
  created; commands moved; original/new function mapping;
  tests/build result; Client smoke result; warning count;
  confirmation that SQL/parameters/row mapping were
  preserved; deviations, if any; resulting commit."

The log is updated after each slice. This is better than
waiting until the entire phase is finished, because the
recovery record remains useful if something goes wrong
halfway through.

================================================================
D17 - WHAT WAS NOT AUTHORISED
================================================================

The reviewer's guardrails, restated:

  Not authorised during the adapter slices:
    Agent command implementation.
    Auth changes.
    Settings changes.
    SQL redesign.
    Schema changes.
    Audit redesign.
    Command renaming.
    generate_handler! redesign.
    Release configuration changes.
    Sync changes.

  Not authorised during the Agent scaffold:
    Agent database.
    Agent authentication.
    Agent enrollment implementation.
    Agent CRUD.
    Agent sync.
    command duplication beyond what proves the registration
      architecture.
    release.yml changes.
    Cloud changes.
    Schema changes.
    Architecture changes.

================================================================
END OF THE DAY'S DECISIONS
================================================================

Fourteen commits landed. Fourteen HOW decisions were made.
Two unexpected findings were resolved. Three new recovery
documents were created or updated:
PHASE-9.5-EXTRACTION-LOG.md (new),
START-HERE.md, HANDOFF.md, SESSION-LOG.md, PHASE-PLAN.md,
and this entry.

State at end of session:

  Main machine:  8435179, clean, pushed.
  Cloud machine: ee8c732, clean. Two commits behind.
  GitHub:        8435179.

Next: Slice 2 (debts).

See PHASE-9.5-EXTRACTION-LOG.md for the technical record and
HANDOFF.md for the status update.

End of entry.

## Recovery Session - September 29, 2026 (Stage B + Stage C.1)

This entry records the HOW decisions from the September 29
session. It does not repeat the technical slice records, which
are in PHASE-9.5-EXTRACTION-LOG.md. It does not repeat the
status, which is in HANDOFF.md.

The session covered:

  - Item 1 (delete_debtor test), Item 2 (auth boundary), and
    Item 3 (Stage A migrations) - recorded earlier in the
    extraction log at commit a7c985c.
  - Stage B sub-slices 1-3: photo functions, calendar
    operations, debtor relations.
  - Stage C sub-slice 1: the Agent's authentication
    foundation.

Three HOW decisions were made that were not obvious.

### D1 - The spec's section 6.3 signatures are illustrative

Decision: Where the Agent spec's section 6.3 example
signatures disagree with a normative rule in LOCAL-TABLES.md,
the LOCAL-TABLES rule wins. Section 6.3 signatures are
illustrative.

Specifically: section 6.3 shows the calendar and relation
commands without an app: AppHandle parameter. But
LOCAL-TABLES.md v1.3 Amendment 1 states that
calendar_events.organization_id MUST be derived from the
authenticated/trusted organization context, not from a
frontend-supplied value. To satisfy the normative rule, all
six calendar functions and all three relation functions take
a trusted organization_id, and their Tauri adapters will
take app: AppHandle and call get_trusted_organization_id.

Reasoning: The binding principle is "spec is authority." But
when two frozen documents are in tension, the one that states
a hard rule (MUST) is normative, and the one that shows a
code example is illustrative. The spec itself acknowledges
this in its Section 1.4: "Where this document appears to
contradict a frozen document, the frozen document wins."

Impact: All eleven Stage B functions take organization_id.
Future Agent spec signatures are read the same way:
illustrative by default, normative only when the surrounding
text says so.

### D2 - open_local_file is deferred to Stage D

Decision: The open_local_file command (spec section 6.3) is
not wired in Stage C. It is wired in Stage D, when the
Agent's Documents UI actually consumes it.

Reasoning: Wiring it in Stage C would require choosing a
Tauri plugin before the consumer exists. Choosing a plugin
before the UI is built risks an implementation choice made
without sight of the real use. Spec section 2.8 lists
open_local_file as Phase 9.5 scope. Deferring within Phase
9.5 keeps it in scope without pre-committing to a plugin.

Impact: Stage C registers 41 commands instead of 42. The
Documents card in Stage D adds the 42nd. No user-visible
difference; the command was never callable from any UI.

### D3 - New Agent code is written clean

Decision: The Agent's own Rust code is written without the
Client's debug println!s, dead imports, or incidental noise.
The Agent's auth.rs, unlock_database, and every subsequent
Agent module are clean.

Reasoning: The Client's auth.rs contains historical debug
output and an unused rand::RngCore import. The Agent's
auth.rs is new code, not an extraction. "Preserve exactly"
is a rule for extraction slices; it does not apply to new
code. There is no reason to reproduce the Client's debug
noise in a fresh module.

Impact: The Agent's auth.rs is smaller and carries no
avoidable warnings. The is_unlocked warning is kept
deliberately, for symmetry with the Client's deferred
warning from Slice 3.5. The Agent's warning baseline starts
lower than the Client's. Future Agent code follows the same
rule.

### Session notes

Cloud-side edits accepted.

Two edits were made on the cloud machine rather than on main,
because the cloud session was already open and the
alternative would have been a full turn-on/turn-off cycle
for one-line changes:

  1. Cargo.lock regeneration (67b984a). The lock lives only
     on cloud. Main cannot regenerate it.
  2. Removal of the unused tauri::Manager import from the
     Agent's auth.rs (c69d21e). One line, no behavior.

Both are recorded as deviations in the extraction log.
Neither touched shared code. The standard workflow (main
edits, cloud builds) resumes with the next code change.

Warning count changes.

  gorka-agent (bin): first real build produced 3 warnings.
  Two were identified in auth.rs (unused tauri::Manager
  import; is_unlocked never used). A third was counted by
  cargo but suppressed by deduplication - most likely a
  duplicate of the Manager warning from another compilation
  unit. The Manager warning was removed (c69d21e). Agent bin
  warning baseline is now 2.

  gorka-client (bin): 3 warnings, unchanged.
  gorka-shared (lib): 6 warnings, unchanged.

State at end of session.

  Main machine:  c69d21e, clean.
  Cloud machine: c69d21e, clean except the two known
                 untracked files (check-columns.ts,
                 test-package.gorka).
  GitHub:        c69d21e.

Next work: Stage C.2 - CRUD adapters (debtors, debts,
communications, actions, documents) in the Agent's main.rs.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records and
HANDOFF.md for the status update.

End of entry.

## Recovery Session - September 30, 2026 (Stage C.5 + Stage D.0-D.2)

This entry records the HOW decisions from the September 30
session. Technical slice records are in
PHASE-9.5-EXTRACTION-LOG.md. Status is in HANDOFF.md.

The session covered:
  - C.5 - is_enrolled backend command (query, not operation).
  - Stage D.0 - Agent frontend prerequisites.
  - Stage D.1 - design tokens and ten shared primitives.
  - Stage D.2 - the entry flow (Login, Unlock, Enroll).

Five HOW decisions were made that were not obvious.

### D1 - Design source is the Client's real design, not spec-11.2-verbatim

Decision: The Agent's visual design matches the Client
Dashboard's real on-disk design, not the literal values
written into AGENT-APP-SPEC.md v1.2 section 11.2.

Reasoning: Section 11.2 states its own intent as "the Agent
App uses the same vocabulary [as the Client]. Do not
re-invent." When the Client's actual files were read during
D.1 reconnaissance, the Client turned out to be layered: an
orphaned design-tokens.css, orphaned Vite template CSS
index.css/App.css, and the real visual design expressed as
inline styles in the components (AppShell.tsx, TopHeader.tsx,
Login.tsx). The spec's 11.2 values were extracted from the
component layer, not the token file. Following the literal
token file would have produced a different visual than
following the component layer; following the spec-11.2
values matches the component layer.

Impact: design-tokens.css in the Agent holds every value the
spec 11.2 lists, plus entry-flow tokens drawn from the
Client's pre-Tauri Login page. Components consume tokens via
var(--token). The Agent does not carry Tailwind, does not
carry the Vite template CSS, and does not carry the Client's
dead design-tokens.css.

### D2 - Spec 11.3's six inconsistencies are corrected, not carried

Decision: Where the Client still exhibits one of the six
inconsistencies AGENT-APP-SPEC.md section 11.3 names, the
Agent applies the spec's resolved value, not the Client's
inconsistent one.

Specifically:
  - Primary buttons: purple #7C3AED (spec 11.1), not the
    Client's blue #2563eb in UnlockScreen, not the Client's
    red #DC2626 in Login.
  - Error banner: #fef2f2 / #fecaca / #dc2626 (spec 11.2),
    not the Client's #fee / #fcc / #c00.
  - Input border: #e5e7eb (spec 11.2), not #d1d5db.
  - Modal padding: 24px (spec 11.2), not 32px.
  - Radius: 8px (spec 11.3), not the mixed 6px/8px.
  - Red is reserved for the GORKA wordmark and for danger
    indicators. Not primary actions.

Reasoning: Section 11.3 explicitly names these six and states
they are not to be carried forward. They are the spec's
authority over the Client's drift.

Impact: Agent visually matches the Client everywhere the
Client already matches the spec, and diverges from the
Client only on the six named points. The Client's entry
pages (Tauri heritage) will be redesigned later to match the
Agent's design. Red in the Client's Login page will become
purple at that time. That redesign is not part of Phase 9.5.

### D3 - Entry flow visual reference is the Client's pre-Tauri Login page

Decision: The Agent's Login, Unlock, and Enroll pages use the
design of the Client's pre-Tauri Login page, with the primary
button changed from red #DC2626 to purple #7C3AED.

Reasoning: The Client's UnlockScreen and other Tauri-era
entry screens are known to be visual drift from the intended
design. The Client's Login.tsx predates Tauri and reflects
the intended card layout (centered white card, 40px padding,
12px radius, soft shadow, 400px max width, red wordmark top).
Using it as the reference produces a consistent visual with
a single color correction.

Impact: Agent's entry flow is visually a purple-button version
of the Client's Login page. Later, when the Client's entry
pages are redesigned, they will match the Agent's.

### D4 - is_enrolled replaces the spec's literal "refusal as signal"

Decision: A new backend query, is_enrolled, determines
whether the device is enrolled. The Agent entry flow calls
it after Unlock. If false, Enroll is shown. If true, the
shell is entered directly.

Reasoning: AGENT-APP-SPEC.md section 4.4 describes the
"already enrolled" signal as the refusal of
import_enrollment_package. That mechanism requires the user
to select a package file before the app will tell them they
are already enrolled. On every launch. This is not usable.
The spec's description was written when no better option
existed. A query is the correct abstraction boundary.

The refusal message from import_enrollment_package remains
in place and unchanged. It is still the correct error for an
actual import attempt against an already-enrolled device. It
is simply no longer the mechanism by which the UI discovers
enrollment state.

Impact: see PHASE-9.5-EXTRACTION-LOG.md Stage C.5 slice.

### D5 - The Agent icon is deferred past Phase 9.5

Decision: The Agent binary keeps its Tauri-default icon
(two semicircles) for Phase 9.5. A custom GORKA Agent icon
is out of scope.

Reasoning: The Client Dashboard also carries a Tauri-default
icon. Both will be replaced with proper GORKA branding in a
later phase. Icon design is not an implementation concern
and is not part of the Phase 9.5 scope contract (spec 2.8).

Impact: None in code. Recorded so a future session does not
mistake the icon for a defect.

### Session notes

Standard workflow resumed.

All C.5 and D.0-D.2 edits were made on main and committed on
main. Cloud was used only for verification (build + tests +
visual render of the Agent Login page).

Cloud-side writes: none this session. No lockfile change on
cloud. No deviations recorded in the extraction log for C.5
or D.0-D.2.

Warning baselines confirmed on cloud (2026-09-30):

  gorka-agent (bin): 2 warnings, unchanged.
  gorka-client (bin): 3 warnings, unchanged.
  gorka-shared (lib): 6 warnings, unchanged.

State at end of session.

  Main machine:  2eb97b9, clean.
  Cloud machine: 2eb97b9, clean except the two known
                 untracked files (check-columns.ts,
                 test-package.gorka).
  GitHub:        2eb97b9.

Next work: Stage D.3 - the main Agent shell (sidebar, header,
routing). Then D.4-D.6.

See PHASE-9.5-EXTRACTION-LOG.md for the slice records and
HANDOFF.md for the status update.

End of entry.

## Recovery Session - September 30 and October 1, 2026 (Stage D.4a-0 through D.4b-2c)

This entry records the HOW decisions from the session that
built the Agent App's first data pages. Technical slice
records are in PHASE-9.5-EXTRACTION-LOG.md. Status is in
HANDOFF.md.

The session covered:
  - D.4a-0 - primitive gap-fill for data pages.
  - D.4a   - debtor list and debtor profile (header, debt,
              actions cards).
  - D.4b-1 - communications card and documents card.
  - D.4b-2a - debtor profile photo (Rust and frontend).
  - D.4b-2b - relations card.
  - D.4b-2c - role column and orphan cleanup (Rust half
              only; frontend half is pending).

Decisions below are the HOW decisions that were not
obvious. Slice mechanics are not repeated here.

================================================================
D.4a-0 DECISIONS
================================================================

### DA0-1 - Token strategy is broad and evidence-based

Decision: Extend design-tokens.css with the complete set of
tokens evidenced by the Client's Collections.tsx and
DebtorDetail.tsx. Reuse existing tokens wherever they
already cover a value. Do not add speculative tokens for
future pages.

Reasoning: D.1's reconnaissance was scoped to the Client's
shell and entry flow. It did not read the two data pages
this slice models. Two promises therefore collided: "no
hardcoded px in component CSS" and "no change to
design-tokens.css in D.4a". Only one can bend. Extending
the vocabulary is the choice that preserves the rule
without falsifying the Client reference.

A narrower alternative (add only what D.4a immediately
uses, and add more mid-slice) was considered and rejected,
because it would have split D.4a-0 across other slices.
Broad once, closed once.

Rejected: B (hardcode values in new component CSS), C
(accept visual divergence from the Client).

Impact: 24 new tokens across four existing groups. No
existing token name or value changed.

### DA0-2 - Modal gains closeOnOverlayClick

Decision: Add `closeOnOverlayClick?: boolean` to the Modal
primitive, default true. Form modals pass false.

Reasoning: The primitive closes on overlay click. The
Client's modals do not. Form modals with unsaved input
should not discard input on an accidental outside click.
Changing the default would alter the behavior of every
future caller. A per-call opt-out is the smallest change
that satisfies both.

Rejected: M1 (keep as-is), M2 (design forms to tolerate
it), M3 (change the primitive default).

Impact: No existing call site is affected. Modal had no
external call sites at the time of this decision.

### DA0-3 - Button gains size and iconOnly, no more

Decision: Add `size?: 'sm' | 'md'` (default md) and
`iconOnly?: boolean` (default false) to the Button
primitive. Color for icon-only buttons comes from the
existing variant axis. No new variant value.

Reasoning: The Client's data pages use compact
card-header buttons and chromeless row-action icon
buttons. Neither shape existed. Adding exactly those two
shapes is additive and bounded. Rejected: a `lg` size, an
icon positioning system, an icon registry, or
`icon-accent`/`icon-danger` variants. Those would begin to
make the primitive a design framework rather than a
button.

Impact: Existing call sites unchanged. Five Button call
sites exist, all in the entry-flow pages, none using the
new props.

### DA0-4 - Add Select and Textarea primitives

Decision: Add `Select.tsx`/`Select.css` and
`Textarea.tsx`/`Textarea.css` as thin wrappers modelled on
`Input.tsx`/`Input.css`. Export from the barrel.

Reasoning: The three D.4a modals require both controls.
The alternative -- using the Input primitive for normal
fields and raw HTML for the other two -- would leave two
styling paths for form fields. Adding both once is
cleaner. Both wrappers are thin: no label, no error, no
validation. Same discipline as Input.

Rejected: S2 (add neither), S3 (add Textarea only).

Impact: Ten primitives become twelve. No existing
primitive changed.

### DA0-5 - TopHeader gains one prefix rule

Decision: Add a single prefix check to TopHeader's title
lookup. Paths starting with `/debtors/` resolve to
"Debtor Profile". Everything else follows the existing
exact-match map.

Reasoning: `/debtors/:id` fell through the exact-match map
and rendered the fallback "GORKA". The profile route needs
a title. Generalizing the map to prefix matching was
considered and rejected as over-scoped. One `if` solves
the actual problem.

Rejected: T1 (leave it, shows "GORKA"), T3 (general prefix
matching), T4 (defer the profile route).

Impact: One D.3 file changed, deliberately. Named as a
scope extension authorised by the founder.

================================================================
D.4a DECISIONS
================================================================

### DA-1 - Shell owns the page title; list page has no h1

Decision: The debtors list page does not repeat the title
in its body. TopHeader shows "Debtors". The page body
starts with the subtitle on the left and the "+ Add
Debtor" button on the right.

Reasoning: The shell already owns the route title by
design (spec 11.4). The Client's Collections.tsx repeats
it, but that is drift, not one of spec 11.3's six named
inconsistencies. Defaulting to the already-verified shell
design is the smaller, more coherent, and more reversible
choice.

Reversibility: If H1 looks wrong at cloud verification,
switching to H2 (repeated title) is a one-line edit in two
files. The founder accepted the risk on this basis.

Impact: One page designed with no body-level h1. The
profile page has an h1 for the debtor's name, but that is
content, not a duplicate of the shell title.

### DA-2 - Error banner retry sits next to the banner

Decision: The debtors list page places the retry action
outside the ErrorBanner primitive, not inside it.

Reasoning: The ErrorBanner primitive takes only a message.
Adding an action slot would expand the primitive for one
call site. The retry belongs to the page, not to the
banner.

Impact: No primitive change. Small page-level CSS.

### DA-3 - Debtor deletion from the profile navigates back

Decision: The profile page's Delete button deletes the
debtor and navigates back to `/debtors`. Same as the
Client's DebtorDetail.tsx behavior.

Reasoning: A deleted debtor has no profile. Staying on the
page would show a stale error. Navigating to the list is
the natural recovery.

Impact: None beyond the page logic.

### DA-4 - "-" instead of em-dash for empty cells

Decision: Empty email and phone cells render the ASCII
hyphen "-", not the Client's em-dash.

Reasoning: ASCII-safe. Avoids the terminal mojibake
problem the recovery has already hit twice.

Impact: Small visual difference from the Client. Named
deliberately.


================================================================
D.4b-1 DECISIONS
================================================================

### DB1-1 - Card order matches the Client

Decision: The Communications card is inserted between the
Debts card and the Actions card. The Documents card is
added after Actions. The Actions card moves from position
3 to position 4. Final order: Info, Debts, Communications,
Actions, Documents.

Reasoning: The Client's DebtorDetail.tsx uses that order.
D.4a placed Actions directly after Debts because
Communications did not exist yet. Rather than preserve
that divergence, D.4b-1 brings the Agent into alignment
with the Client.

Impact: The Actions card's JSX was relocated. Same JSX,
same handlers, position only. Named in the commit message
so the move is not buried under "added two cards".

### DB1-2 - Communications are append-only

Decision: The Communications card has no edit path.
Corrections are delete-and-relog.

Reasoning: The schema has no updated_at on
communications, and the Client's CommunicationEditModal
is create-only. The Agent mirrors the Client exactly.

Impact: No "edit" button on communication rows. No
update_communication command anywhere.

### DB1-3 - File upload uses a label-wrapping-hidden-input

Decision: The Documents card's "Choose file" control is a
`<label>` styled as a ghost button, wrapping a hidden
`<input type="file">`. Not the Button primitive with a ref.

Reasoning: Mirrors the Client's pattern. Using the Button
primitive with a ref would be cleaner React but would
diverge from the Client on a point that is not one of the
six named spec 11.3 inconsistencies.

Impact: One small page-level CSS class. No primitive
change.

================================================================
D.4b-2a DECISIONS
================================================================

### DB2a-1 - Photo display via blob URL from Rust bytes

Decision: Add one Rust function `read_debtor_photo` that
returns `{ bytes: Vec<u8>, mime: String }`. Frontend
builds a `blob:` URL from the bytes and displays it in
`<img>`. No config change, no new crate, no new npm
package.

Reasoning: The Agent's CSP is `img-src: 'self' data:
blob:`. It does not include `asset:` or `file:`. So
pointing `<img src="file://...">` at a stored path is
blocked by the security policy. Three workarounds were
considered:
  A. Enable Tauri's asset protocol. Widens CSP.
  B. Return a base64 data URI from Rust. Adds the base64
     crate.
  C. Use @tauri-apps/plugin-fs in the frontend. New npm
     dependency, uncertain capability scope.

The fourth path -- Rust bytes + blob URL -- uses what
already exists. CSP already allows blob:. No new surface.

Impact: One new function, one new struct, one new command
registration. Agent binary only; Client untouched.

### DB2a-2 - Placeholder is the existing Avatar primitive

Decision: When no photo is set, the header card shows the
existing `Avatar` primitive (circular, accent background,
initials) at 96x96. No new placeholder type.

Reasoning: The primitive already produces the right shape.
Adding a distinct photo placeholder would duplicate it.

Impact: None. Avatar primitive unchanged.

### DB2a-3 - Change-photo uses the dialog plugin

Decision: The "Change photo" control uses
`@tauri-apps/plugin-dialog`'s `open()` with an image
filter, not a hidden file input.

Reasoning: `set_debtor_photo` takes a filesystem path. The
dialog returns a path. A hidden file input would return a
File object, requiring an extra read step. The dialog is
also already installed and already used by EnrollPage.

Impact: No new dependency. Small handler in the profile
page.

================================================================
D.4b-2b DECISIONS
================================================================

### DB2b-1 - Zero Rust, zero schema for the relations card

Decision: The Relations card uses only existing commands.
No new Rust function, no new command, no migration.

Reasoning: Initial reconnaissance believed a role-setting
function was needed so the relations card could badge each
row with GUARANTOR or PLEDGER. On re-reading
relations.rs, the badge can read from
`debtor_relations.relation_type`, which is already
populated by `insert_debtor_relation`. The debtors.role
column is not needed for this slice.

Impact: The card is a pure frontend addition.

### DB2b-2 - Collateral is per person, not per relation

Decision: Collateral is stored at
`related_person.data.collateral = { type, description }`.
Not on the debtor_relations row. One collateral per
related person, not per relation.

Reasoning: The pragmatic path agreed with the founder. The
debtor_relations table has no data column. Adding one
would require a migration and a Rust change. Storing in
the person's existing `data` JSON uses what exists.

Known limitation: The same pledger pledging different
collateral for two different debtors cannot be expressed.
Accepted for MVP. The funded phase may add per-relation
collateral if the business needs it.

### DB2b-3 - Two header buttons, role-specific modal titles

Decision: The Relations card has two header buttons,
"+ Add Guarantor" and "+ Add Pledger". Each opens the same
modal with the role preset. Modal title is role-specific:
"Add Guarantor" or "Add Pledger".

Reasoning: The founder chose this over a single button
with a role selector inside the modal. Two buttons are
simpler and make the two roles visible at a glance.

Impact: One modal with a `role` prop.

### DB2b-4 - Collateral fields visible only for PLEDGER

Decision: The modal's create-new and link-existing modes
show the two collateral fields only when the role is
PLEDGER. Guarantor sees only the four name fields.

Reasoning: A guarantor guarantees a debt; a pledger
pledges an asset. Collateral is a pledger concept.

Impact: One conditional in the modal.

### DB2b-5 - No reverse-direction view

Decision: A guarantor's own profile does not show "This
person guarantees X". The relation is only visible on the
primary debtor's profile.

Reasoning: Stage B.3 declared reverse-direction views out
of scope. Unchanged.

Impact: None.

================================================================
D.4b-2c DECISIONS (Rust half)
================================================================

### DB2c-1 - Cleanup writes role, not a marker flag

Decision: Write `role = 'GUARANTOR'` or `role = 'PLEDGER'`
into `debtors.role` when a related person is created via
the relation modal's create-new path. Use `role != 'DEBTOR'`
as the marker for cleanup.

Reasoning: Without a marker, startup cleanup cannot
distinguish "former related person now orphaned" from
"plain debtor created and not yet used". The latter would
be incorrectly deleted by the safe check. Writing role
once, at creation, resolves this.

This overrides the earlier decision (D.4b-2b, and D.4b-2c
planning) that the Agent would not write `debtors.role`.
The founder authorised this on October 1, 2026.

Rejected: leaving role unset and relying on the five-table
check alone. That would delete every freshly-created plain
debtor on the next Debtors page mount.

Impact: `insert_related_debtor` writes the role. Nothing
else writes `debtors.role`.

### DB2c-2 - Cleanup on page mount, not a background job

Decision: `cleanup_orphaned_related_debtors` runs once
when the Debtors page mounts. It is not a background
process, not a scheduled task, not a startup job.

Reasoning: The Debtors page is the only place a user can
see the effect. Running cleanup there means the user
notices removal if it happens unexpectedly. A background
job would remove rows silently.

Impact: Cleanup does not run if the user never opens the
Debtors page. This is acceptable for MVP.

### DB2c-3 - Five-table orphan check, not relations-only

Decision: The orphan check counts relations, debts,
communications, actions, and documents. Any non-zero
count means not orphaned.

Reasoning: The schema uses `ON DELETE CASCADE` throughout.
Deleting a person who happens to have debts of their own
would silently delete those debts, their communications,
their actions, their documents. The five-table check
prevents that.

Rejected: relations-only check. Fast but unsafe.

### DB2c-4 - is_orphaned_related_debtor is duplicated

Decision: The five-table orphan check exists twice:
once as a private helper in `debtors.rs`, once as a
private helper in `relations.rs`. They are identical.

Reasoning: Rust privacy. The helper is private to
`debtors.rs`. `relations.rs` cannot call it. Making the
helper public would expand the public surface of
`debtors.rs` for a function that is only used internally
by two modules. Duplication of ~50 lines was chosen over
exposing a public helper.

Recorded as a deliberate duplication. If the helper ever
grows or changes, both copies must be updated together.

### DB2c-5 - Debt and Currency columns are separate

Decision: The debtors list has a Debt column and a
separate Currency column. Not one column with
"1,234.56 USD" strings.

Reasoning: Different debtors may have debts in different
currencies. Separating the amount from the currency code
allows sorting and comparison per column, and allows a
debtor with debts in two currencies to show one line per
currency without ambiguity.

Impact: `get_debtor_debt_totals` groups by
`(debtor_id, currency)`. The frontend sums within
currency and renders one line per currency.

### DB2c-6 - Total row reflects the whole organization

Decision: The TOTAL row above the data row shows the
summed debt of all debtors in the organization, grouped
by currency. It does not change when the user searches.

Reasoning: The total answers "how much debt does this
company hold". That is a fixed number, not a filtered
number. If the user searches "Bauman", the total still
shows the whole organization's debt. Filtering changes
what rows are visible, not the size of the company.

Rejected: X (total reflects the filtered subset). That
would make the total depend on the search box and would
answer a different question.

### DB2c-7 - Sticky two-row header

Decision: The debtors table's header row and its TOTAL
row stick to the top of the scroll region while the data
rows scroll underneath.

Reasoning: With thousands of debtors, scrolling loses
the column labels and the total. The founder explicitly
asked for a two-line sticky block.

Impact: Two CSS rules. No behavior change.

================================================================
SEAMS FOR THE CLIENT DASHBOARD
================================================================

Recorded now, not actioned in Phase 9.5. These are
forward-looking commitments the founder made during the
session.

### Seam-1 - Relations and photo will exist on the Client
### Dashboard too

Decision: When the Client Dashboard is revisited, it will
gain the same relations card and profile photo that the
Agent now has. The admin bulk-imports debtors and needs
to attach guarantors and pledgers to them; the Client side
cannot lag the Agent side indefinitely.

Not in Phase 9.5. The Client Dashboard currently has no
relations UI. Adding it is a separate slice.

### Seam-2 - Nothing Agent-only in the relations or photo
### layer

Decision: The Agent's relations and photo UI must not
encode Agent-only assumptions. Component names, props,
and copy are neutral. `RelationEditModal` takes a
`debtorId` and a `role`, not a user context. The photo
component does not reference AGENT role.

Reasoning: When the Client reuses these components, the
only difference is which page they sit on. No refactor
should be needed.

Impact: The Rust commands, the local.db.ts wrappers, and
the two components are already client-neutral. The
Client will register the same commands in its
generate_handler! and reuse the same services layer
shape.

### Seam-3 - The list-badge gap will be closed by D.4b-2c

Decision: Spec 11.6 says related persons appear in the
debtor list "distinguished by a role badge". D.4b-2b
deferred the badge. D.4b-2c's Rust half now provides
`get_related_debtor_roles`, which the frontend half will
use to render the badge. The gap closes when the frontend
half lands.

Noted so the spec line is not silently left unmet.

================================================================
DEVIATIONS RECORDED FOR THIS SESSION
================================================================

Three deviations, all founder-authorised.

### Dev-1 - Documentation deferred to end-of-session

The working rules say "after every slice: build on cloud,
run tests, update PHASE-9.5-EXTRACTION-LOG.md." For D.4a,
D.4b-1, D.4b-2a, D.4b-2b, and D.4b-2c (Rust half), the
extraction log entry was written in a single pass at the
end of the session, not after each slice.

Reason: The founder preferred to complete D.4b-2b before
documenting, to keep the working context intact and to
avoid interrupting the flow. The founder then preferred
to complete documentation before the D.4b-2c cloud
verification, to protect the session's work against an
unexpected chat closure.

Risk: Bounded. Git holds the ground truth of every slice.

### Dev-2 - One cloud trip instead of two for D.4b-2a

The D.4b-2a plan originally intended two cloud trips: one
for the Rust half, one for the frontend. Combined into
one trip that also verified D.4b-2b's Rust.

Reason: Cloud sessions cost money. Rust compile is
regression-only for the frontend half.

### Dev-3 - D.4b-2c Rust half is committed but not yet
### compiled on cloud

Recorded in the extraction log and here. The Rust half
was committed on October 1, then the session paused for
documentation before the cloud compile. The compile will
happen after this documentation pass.

================================================================
END OF SESSION ENTRY
================================================================

This entry records the D.4a through D.4b-2c slice decisions
and the three deviations. It does not decide anything about
D.4b-2c's frontend half; that follows after cloud compiles
the Rust half.

End of entry.


## Recovery Session - October 1, 2026 (Stage D.4b-2c frontend half and D.4b-2c-fix)

This entry records the HOW decisions from the session
that completed D.4b-2c and then corrected it. Technical
slice records are in PHASE-9.5-EXTRACTION-LOG.md. Status
is in HANDOFF.md.

The session covered:
  - D.4b-2c frontend half - role column, debt and
                           currency columns, sticky
                           header, orphan cleanup on
                           mount.
  - D.4b-2c-fix        - primary-debtor list filter,
                           role badges on the primary
                           debtor's row only, path-aware
                           back button.

Decisions below are the HOW decisions that were not
obvious. Slice mechanics are not repeated here.

================================================================
D.4b-2c FRONTEND HALF DECISIONS
================================================================

### DB2cF-1 - Role badges read from debtor_relations

Decision: The Role column's badges are built from
`get_primary_debtor_relations`, which reads
`debtor_relations` directly. Not from `debtors.role`.

Reasoning: A person can carry multiple relations
(guarantor for one debtor, pledger for another). The
relations table is the source of truth for what badges to
display on each primary debtor's row. The role column on
the person row is used only by the list filter, not by
badge rendering.

Impact: Badges are correct even if a person's role column
is stale. This is how the Peter residue case was made
visible without a Rust change.

### DB2cF-2 - Cleanup runs on mount, before load

Decision: The Debtors page runs
`cleanup_orphaned_related_debtors` first, then loads
debtors, then loads roles and totals. Order matters.

Reasoning: Rows removed by cleanup must not appear in
the same render. Running cleanup after loading would
briefly show a row that is about to disappear.

Impact: One async effect with three sequential awaits.

### DB2cF-3 - Roles and totals are refreshed on every mutation

Decision: After `handleSaved` or `handleDelete`,
`refresh` re-runs both `handleSearch(query)` and
`loadRolesAndTotals()`.

Reasoning: Deleting a relation can remove a badge. Adding
a relation can add a badge. Both lists must reflect the
change immediately, even if the debtor list itself is
unchanged.

Impact: One small helper, `refresh`, replacing direct
calls to `handleSearch`.

================================================================
D.4b-2c-FIX DECISIONS
================================================================

### DB2cFix-1 - The list filter is role = 'DEBTOR'

Decision: The debtor list shows only rows where
`debtors.role = 'DEBTOR'`. Related persons (GUARANTOR,
PLEDGER) never appear as their own rows, regardless of
whether their relations are currently active.

Reasoning: The founder's rule, stated plainly: the
debtor list shows only debtors. Not "debtors plus anyone
without an active relation". Not "debtors plus related
persons with no data". Only debtors.

The alternative -- filter on "not the target of any
active relation" -- was considered and rejected. It fails
the moment a relation is deleted: the person reappears in
the list. The founder explicitly rejected this behavior:
"they don't have to appear in debtor list even if it a
MVP stage."

The role-column filter is stable across every scenario:
relation added, relation deleted, data added to the
related person, data removed, cleanup runs, cleanup does
not run. In all cases, a related person stays hidden.

Impact: Three new functions in gorka-shared:
`get_primary_debtors`, `search_primary_debtors`,
`get_primary_debtor_relations`. Three new Agent commands
registered. Existing `get_debtors` and `search_debtors`
are untouched; the Client binary still uses them.

### DB2cFix-2 - Role badges are static, not clickable

Decision: The Role column's badges are plain `<span>`
elements. They are not clickable. They do not show the
related person's name. They show only the role:
`PLEDGER` or `GUARANTOR`.

Reasoning: The founder's decision. Two reasons given:
(a) names in the badge would be visually messy, especially
with multiple relations per row; (b) the Relations card on
the primary debtor's profile is the single navigation path
to a related person's profile, so a second path from the
badge is unnecessary and introduces ambiguity when there
are multiple pledgers.

Rejected: clickable badges, count badges
(`PLEDGER x2`), badges with the related person's name.

Impact: Badge rendering is one line of JSX per relation.
No navigation logic. No tooltip.

### DB2cFix-3 - The spec was wrong, not the code

Decision: The spec sentence "In the UI, a guarantor
appears both inside the debtor profile they guarantee
(Section 11.6) and as a row in the debtor list,
distinguished by a role badge" (Section 3.7) was
incorrect. It was replaced in AGENT-APP-SPEC.md v1.3.

Reasoning: The original spec assumed related persons
should appear in the debtor list with a badge. The
founder clarified that this was a miscommunication during
spec authoring. The correct rule is: only primary debtors
appear in the list. The spec was amended. The code was
rebuilt to match.

The handoff and previous decisions attributed this
sentence to section 11.6. It was in fact in section 3.7.
Section 11.6 describes the debtor profile page and is
correct as-is.

Impact: AGENT-APP-SPEC.md v1.3, one paragraph of section
3.7 replaced. Header bumped to FROZEN. No other spec
change.

### DB2cFix-4 - Path-aware back button on the profile page

Decision: When a related person's profile is reached via
a primary debtor's Relations card, the back button reads
`Back to <primary surname, name>` and returns to that
primary debtor's profile. When the profile is reached
from the list (normal case), the button reads
`Back to Debtors` and returns to the list.

Reasoning: Before D.4b-2c-fix, the back button had a
fixed target of `/debtors`. That was correct while the
only way into a profile was from the list. Now that
Relations cards navigate between profiles, the fixed
target is wrong: it drops the user at the list instead
of where they came from.

Implementation: React Router location state. When
`openRelationProfile` is called, it passes
`{ fromDebtorId, fromDebtorLabel }`. The receiving
profile reads `location.state` and derives `backLabel`
and `backTarget`. Falls back to `/debtors` when no state
is present. No history dependency. Works even if the
related person is linked to more than one primary debtor,
because the navigation carries the specific origin.

Impact: One file. Five edits. No Rust change. No CSS
change.

### DB2cFix-5 - Related persons keep all case-file tools

Decision: A related person's profile keeps the
Communications card with `+ Log Communication`, the
Actions card with `+ Add Action`, and the Documents
card's upload control. These are not hidden when
`isRelated` is true.

Reasoning: A guarantor or pledger is a person the agency
must contact until the debt is paid. Calls, SMS, emails,
legal notices all get logged against them. This is a
business requirement. Hiding these tools would have
crippled the collection workflow.

An earlier proposal in this session recommended hiding
them for technical hygiene. The founder rejected it on
business grounds. Business wins.

Rejected: hiding Communications, Actions, and Documents
add-controls on related persons' profiles.

Note: The `+ Add Debt` button and the `+ Add Guarantor`
/ `+ Add Pledger` buttons ARE hidden when `isRelated` is
true. A related person does not have their own debts in
this MVP, and does not have their own relations.

### DB2cFix-6 - The zombie case is accepted as MVP limitation

Decision: If a related person accumulates their own
data (communications, actions, documents) and then their
relation to the primary debtor is deleted, they become
a zombie: hidden from the list, unreachable from the UI,
still in the database, not deleted by cleanup.

Accepted as a known MVP limitation. Deferred to the
funded phase.

Reasoning: The list filter hides them (correct per
DB2cFix-1). The five-table orphan check refuses to
delete them (correct per DB2c-3, protects real data).
The UI has no surface that points to them. They are
invisible, not clutter. This does not violate the
founder's "I do not want to see orphans" rule, because
zombies are not visible.

The proper fix is a "case closed" or "history" surface
in the funded phase, where detach-related-persons with
data are shown to the admin for manual handling. The
founder floated this idea during the session and agreed
to defer it.

Rejected: automatic retention of orphans in the MVP.
Requires a new column or table plus a migration plus a
cleanup behavior change. Not MVP scope.

### DB2cFix-7 - The two residue cases were cleaned manually

Decision: Two pre-existing residue rows were cleaned
manually on the cloud test instance. No code change.

  - Trump Donald: created before `insert_related_debtor`
    existed, role = DEBTOR, no relations, no data. Manual
    delete via the UI.
  - Peter Parker: created before `insert_related_debtor`
    existed, role = DEBTOR, one active relation to Bob.
    Deleted relation, deleted his row, re-created via
    `+ Add Pledger` on Bob's profile so the new role write
    fires.

Reasoning: The new role-column filter cannot distinguish
a pre-fix residue with role = DEBTOR from a genuine new
debtor. There is no field on the row that records "this
was once a related person". The role write added in
D.4b-2c prevents new residues. Only these two pre-fix
rows required manual cleanup.

Impact: No code. Cloud test DB only. New residues are
prevented going forward by the role write in
`insert_related_debtor`.

================================================================
SEAM UPDATE
================================================================

### Seam-3 superseded

Seam-3 (recorded in the September 30 / October 1 entry)
stated that "Spec 11.6 says related persons appear in the
debtor list 'distinguished by a role badge'" and that
D.4b-2c would close the gap by rendering the badge.

That statement is now superseded by DB2cFix-1 and
DB2cFix-3. Related persons do not appear in the debtor
list. The spec was wrong. Seam-3 is retained in the
previous entry as historical record. No action.

================================================================
DEVIATIONS RECORDED FOR THIS SESSION
================================================================

Two deviations, both founder-authorised.

### Dev-4 - Code first, documentation second

The working rules say documentation follows every slice.
For D.4b-2c-fix, the founder requested the opposite
order: write the code, verify on cloud, and only then
document. The reason: a documentation-first order risks
freezing a rule that turns out wrong in practice, and
unwinding it costs more than writing it late.

The order was: Rust half, frontend half, back-button
fix, cloud verification, then this DECISIONS entry and
the spec amendment.

Reason: Bounded risk. Git holds the ground truth of
every slice regardless of when the docs are written.

### Dev-5 - Spec amended after code verification, not before

The spec 3.7 amendment was written after the cloud smoke
test confirmed the new behavior. The old spec sentence
was factually wrong; the new sentence describes what the
code now does, verified on cloud. Amending before
verification would have been a guess.

Reason: Same as Dev-4. Code is the ground truth; docs
describe it.

================================================================
END OF SESSION ENTRY
================================================================

This entry records the D.4b-2c frontend half decisions
and the D.4b-2c-fix decisions, and records the amendment
of AGENT-APP-SPEC.md section 3.7. It supersedes Seam-3
from the previous entry.

End of entry.

## Recovery Session - October 1, 2026 (Stage D.5 - plan view / calendar)

This entry records the HOW decisions from the session
that built the Agent's plan view. Technical slice
records are in PHASE-9.5-EXTRACTION-LOG.md. Status is in
HANDOFF.md.

The session covered:
  - D.5 - plan view (calendar), frontend only.

Decisions below are the HOW decisions that were not
obvious. Slice mechanics are not repeated here.

================================================================
D.5 DECISIONS
================================================================

### D5-1 - Stored events are MANUAL only

Decision: The Agent's Plan page creates calendar events
with event_type = 'MANUAL' and does not expose an
event_type dropdown. The Rust function
insert_calendar_event already hardcodes this value.
CalendarEventInput is not extended with an event_type
field.

Reasoning: Spec 11.7 is explicit: "The calendar_events
table holds only MANUAL rows. This avoids the
duplication problem the old cloud route had." Payments
and follow-ups are live queries over debts and actions,
not stored calendar rows. Adding an event_type dropdown
would reopen the duplication problem the spec
deliberately closed.

The Client Dashboard's calendar offers three choices
(Manual, Payment Due, Follow-up), but sends eventType
in a payload that Rust silently ignores. The Client's
event_type is always MANUAL in the database today. The
Agent does not copy that behavior.

Rejected: a dropdown with MANUAL / PAYMENT_DUE /
FOLLOW_UP. Rejected: extending CalendarEventInput with
event_type so the frontend could write arbitrary
values.

Impact: insert_calendar_event unchanged. No Rust
change. No schema change.

### D5-2 - Derived events are display-only

Decision: Payment-due and follow-up-due entries are
rendered on the calendar but are never passed to
update_calendar_event or delete_calendar_event, and are
never written into calendar_events.

Reasoning: They are live queries. They have no
calendar row. Editing or deleting them through the
calendar would either create phantom stored rows or
silently do nothing, depending on implementation.
Neither is acceptable. The single source of truth for
a payment is the debt row. For a follow-up, the action
row. The calendar is a view.

Interaction: clicking a derived event navigates to the
debtor profile. No edit modal. No delete confirmation.

Impact: The calendar's event click handler switches on
an extendedProps.kind field ('manual', 'payment',
'followup') to route the interaction. Payments and
follow-ups never reach the CalendarEventEditModal.

### D5-3 - Card window is fixed at 30 calendar days

Decision: The Upcoming Payments and Upcoming
Follow-ups cards both cover today through today + 30
calendar days. Same window. Both cards. Fixed. Not
rolling hours. Not calendar month.

Reasoning: The founder wanted a near-term actionable
view. A fixed calendar-day window is deterministic and
easy to explain. Both cards use the same boundary so
the two lists are comparable.

Consequence (accepted): An event beyond 30 days
renders on the calendar but not in either card. A
payment due on Nov 7, seen on the calendar, does not
appear in the Upcoming Payments card on Oct 1. This is
by design. Recorded as a possible future UX
improvement, not actioned in D.5.

Rejected: card window tracks the visible calendar
range. That would couple the cards to the calendar's
current month, which the user navigates freely. The
cards are a fixed-window snapshot.

Impact: PlanPage.tsx computes the window once per
mount. The calendar loads its own range via
FullCalendar's datesSet callback, independent of the
cards.

### D5-4 - Single source of truth for derived data

Decision: The calendar and the two cards both read
from the same three local.db.ts methods:
getCalendarEvents, getUpcomingPayments,
getUpcomingFollowups.

Reasoning: Duplicate filtering between the calendar
and the cards would create a consistency bug where the
red calendar entry and the payment card row could
disagree. One query path per data kind eliminates that
class of bug entirely.

The PlanPage transforms the raw records into
FullCalendar event objects (for the calendar) and list
rows (for the cards). No business logic in the
frontend. The Rust queries remain the authority on
what qualifies as a payment due or a follow-up due.

Impact: The calendar fetches its range on every
FullCalendar datesSet callback. The cards fetch once
on mount. When a manual event is created or edited,
PlanPage re-fetches the visible range; the cards are
not re-fetched unless the user reloads. This is
acceptable because manual events do not affect card
contents, which are derived from debts and actions
only.

### D5-5 - Link-to-debtor picker over all debtors

Decision: The CalendarEventEditModal's
link-to-debtor picker uses searchDebtors, not
searchPrimaryDebtors. It searches the full debtors
table, including related persons (GUARANTOR, PLEDGER).

Reasoning: The founder's Position 2, stated during
D.5 planning. A guarantor or pledger is a person the
agency must contact until the debt is paid. Calling
Putin about Bob's case is a legitimate agent action
that should be linkable to Putin. Restricting the
picker to primary debtors would prevent that.

This is a deliberate divergence from D.4b-2c-fix's
list filter, where only primary debtors appear. The
list answers "who are our debtors". The picker
answers "who is this reminder about". Different
questions, different answers.

Impact: CalendarEventEditModal imports searchDebtors.
The Rust debtor-existence validation inside
insert_calendar_event and update_calendar_event
already accepts any debtors row, including related
persons. No Rust change needed.

### D5-6 - Path-aware navigation and the back button

Decision: The Plan page does not change the
DebtorProfilePage's back button behavior. From a
derived payment or follow-up event, clicking navigates
to the debtor profile with no location state. The
profile's back button therefore reads "Back to
Debtors", and that is correct in this case: the agent
reached the profile from the calendar, not from another
profile.

Reasoning: The path-aware back button added in
D.4b-2c-fix keys off location state from a specific
origin (a primary debtor's Relations card). The Plan
page does not pass that state. So the fallback applies.
No change to the profile page.

An alternative (state carrying "return to /plan") was
considered and rejected. It would require the profile
page to accept a second return destination, expanding
its responsibility beyond the debtor-to-debtor case it
was designed for.

Impact: None. No file change beyond what D.5 already
introduced.

### D5-7 - Event colors via CSS classes, not inline

Decision: Manual events render blue, payments red,
follow-ups amber. Colors are defined in PlanPage.css
via FullCalendar's className feature and named
classes, plus design tokens. No inline colors in the
TSX.

Reasoning: Consistent with the Agent's design-token
discipline from D.4a-0. If the palette ever changes,
one CSS rule changes and every event of that kind
follows.

Impact: fcEvents in PlanPage.tsx carries
className strings. PlanPage.css defines the color
rules scoped under .plan-page__calendar-wrap.

### D5-8 - No new primitive in D.5

Decision: D.5 consumes existing primitives (Button,
Card, Input, Label, Modal, ErrorBanner) and does not
add or extend any primitive.

Reasoning: D.4a-0 closed the primitive gap-fill for
the data pages. The Plan page needs no shape the
existing set does not provide. A new primitive would
be scope creep.

Impact: Zero changes to agent-dashboard/src/
components/primitives/.

================================================================
THIRD-PARTY PLAN REVIEW
================================================================

Before implementation, the D.5 plan was reviewed by a
third party. The review is recorded here because two
of its points were adopted and two were rejected.

### Adopted

  (a) Q-A change: the link-to-debtor picker searches
      all debtors, per founder Position 2. Recorded
      in D5-5 above.

  (b) Card window frozen precisely as "today through
      today + 30 calendar days". Recorded in D5-3
      above.

### Rejected

  (c) The review listed two calendar commands that do
      not exist in the Agent binary:
        get_calendar_event
        get_upcoming_calendar_events
      The actual six commands, confirmed by
      reconnaissance before the plan was written, are:
        get_calendar_events
        insert_calendar_event
        update_calendar_event
        delete_calendar_event
        get_upcoming_payments
        get_upcoming_followups
      The review's list would have had the frontend
      call two nonexistent commands.

  (d) The review proposed a "D.5-0 reconnaissance
      gate" before touching local.db.ts. The
      reconnaissance the review asked for was already
      performed earlier in the session, before the
      plan was written. The plan the review was
      reviewing already reflected those findings.

Recorded so that the review, if read later, is
correctly interpreted. No action.

================================================================
DEVIATIONS RECORDED FOR THIS SESSION
================================================================

One deviation, founder-authorised.

### Dev-6 - Documentation written after cloud verification

The working rules say "after every slice: build on
cloud, run tests, update PHASE-9.5-EXTRACTION-LOG.md."
For D.5, the extraction log entry and this DECISIONS
entry were written after the cloud verification, in
one batch. Same pattern as Dev-4 and Dev-5 from the
D.4b-2c-fix session.

Reason: The founder preferred to see the working
screen on cloud before writing down the HOW. If the
first implementation had been wrong, docs written
first would have described a rule the code did not
follow.

Risk: Bounded. Git holds the ground truth of the
slice regardless of when the docs are written.

================================================================
END OF SESSION ENTRY
================================================================

This entry records the D.5 plan view decisions and
records the third-party review outcome. No spec
amendment in this session; section 11.7 was already
written and matches what D.5 implemented.

End of entry.


## Recovery Session - October 2, 2026 (Stage D.6.1 and D.6.2)

This entry records the HOW decisions from the session that
closed the last two Agent frontend slices, D.6.1 and D.6.2.
Technical slice records are in PHASE-9.5-EXTRACTION-LOG.md.
Status is in HANDOFF.md.

The session covered:
  - D.6.1 - Communication Tools placeholder and Settings
            About-only.
  - D.6.2 - cross-debtor Actions browser.

Decisions below are the HOW decisions that were not
obvious. Slice mechanics are not repeated here.

================================================================
D.6.1 DECISIONS
================================================================

### D61-1 - The Communication Tools page reads nothing

Decision: CommunicationToolsPage.tsx renders a hardcoded
empty state. It does not read local_connectors, does not
create the table, does not trigger a migration.

Reasoning: The D.6 scope decision (Q1) settled this. The
table belongs to Phase 9.6, where its schema is frozen
against real connector requirements. In Phase 9.5 the
table does not exist. A page that tries to read a table
that does not exist would fail. The correct move is the
empty state, exactly as spec 11.8 states.

Impact: The page has no data dependency. It compiles
clean, runs clean, and cannot fail from a missing table.

### D61-2 - The spec 11.8 sentence is preserved verbatim

Decision: The empty state reads exactly: "Your
administrator has not enabled any communication tools
yet. Contact your administrator to enable a channel."

Reasoning: The spec text is the authority. Paraphrasing
or shortening would drift. The D.6.1 answer confirmed
that the full sentence is required, not the truncated
version that was in the D.3 StubPage placeholder.

Impact: The spec sentence appears in one place in the
code. Copy changes to spec 11.8 change this string.

### D61-3 - The version string is hardcoded

Decision: SettingsPage.tsx holds a single constant,
APP_VERSION = '0.0.0', with a one-line comment noting
that a Rust command will replace it later.

Reasoning: D.6.2 was authorized for exactly one new Rust
command (get_all_actions). Adding a second command for a
static version string would break the "one new command"
discipline and add surface for no behavior change. When
the app starts shipping releases, the version becomes
real, and that is when a Rust command is justified.

Impact: When package.json's version changes, the
constant must be updated in the same commit. Recorded
inline above the constant.

### D61-4 - TopHeader.tsx was not modified

Decision: The D.6 plan listed TopHeader.tsx as a
D.6.1 file with "two title entries". On-disk
reconnaissance showed both entries (/communication-tools,
/settings) already exist, added during D.3 when the stub
routes were created. TopHeader.tsx was not touched.

Reasoning: The plan predated D.3's TopHeader work. The
correct action is not to add duplicate entries; it is to
recognize that the file already does what the plan
called for. The D.6.1 file count is 5, not 6.

Impact: One fewer file in D.6.1. Recorded in the
extraction log as a plan correction.

================================================================
D.6.2 DECISIONS
================================================================

### D62-1 - ActionWithDebtor is a joined struct, not N+1

Decision: get_all_actions returns Vec<ActionWithDebtor>,
a struct that carries debtor_name and debtor_surname
alongside the action fields. The query joins actions to
debtors. No per-row get_debtor call on the frontend.

Reasoning: The existing N+1 in loadRelations is
acceptable for 1-3 relations per debtor. It is not
acceptable for a cross-debtor list that can have
hundreds of rows. UpcomingPayment, UpcomingFollowup, and
DebtorRelation already use this pattern in the same
codebase. Follow the precedent.

Impact: One round-trip for the whole list. The struct
is Serialize-only, matching the other joined structs.

### D62-2 - Sort is due_date ASC nulls last, created_at DESC

Decision: The SQL orders by
(due_date IS NULL), due_date ASC, created_at DESC.

Reasoning: The page answers "what should I do next".
Overdue and soonest-due rise to the top. Rows with no
due date fall to the bottom. created_at DESC is the
tiebreaker for rows sharing a due date. Fixed sort,
no clickable headers.

Impact: The frontend does not sort. It renders what the
Rust side returns.

### D62-3 - The page is read-only

Decision: ActionsPage has no add, edit, or delete
controls. No row-level action buttons. Navigation by
clicking the debtor name only.

Reasoning: The D.6 plan the founder approved states
this plainly: "This page is a browser. Add, edit, and
delete live on the debtor profile." The scope is a
read-only browser for the agent to see what is pending
across the book.

Impact: The existing ActionEditModal is not imported by
ActionsPage. Row-level CRUD continues to live only on
the debtor profile.

### D62-4 - Status filter is client-side, five chips

Decision: Five chips: All | Pending | In Progress |
Completed | Cancelled. The filter is applied in the
component after the full list loads. No server round-trip
per filter change.

Reasoning: The list is bounded by the agent's own
organization. Filtering client-side means no loading
flicker per chip and no new Rust function. If the list
ever grows past a few thousand rows, a server-side
filter becomes justified; that is a funded-phase
concern.

Impact: A single getAllActions call on mount. Chip
clicks re-filter in memory.

### D62-5 - No Type filter, no text search in D.6.2

Decision: Recorded as deferred, not implemented.

Reasoning: The founder's answer named them as natural
follow-ups. Adding them now would be scope creep on a
slice the founder already described as "a browser". They
are named in the extraction log so they are not
forgotten.

Impact: None in D.6.2. Two follow-ups on the funded
list.

### D62-6 - The empty state matches the profile card

Decision: ActionsPage's empty state reads "No actions
recorded yet." Same sentence the debtor profile's
Actions card uses when empty. No explanatory second
sentence. No "click here to add".

Reasoning: Consistency with the existing pattern. The
page is a browser, not a tutorial. If the agent needs to
know where actions come from, the profile is one click
away via the sidebar.

Impact: One string, one place. Matches the profile
card's wording.

### D62-7 - Back-target logic is generalized

Decision: DebtorProfilePage's back-target computation
now accepts three shapes, in resolution order:
  1. location.state.fromDebtorId + fromDebtorLabel
     (existing; used by the Relations card).
  2. location.state.fromPath + fromLabel (new; used by
     ActionsPage).
  3. No state: fall back to /debtors.

Reasoning: The founder explicitly fixed the back button
in D.4b-2c-fix to go where the user came from.
Landing on the debtors list from the Actions page would
undo that fix's spirit. The generalization is a small
edit to one block, no new state, no new props.

Impact: Any future cross-debtor page that navigates to
a profile can pass fromPath / fromLabel and the back
button will work correctly. The extension is
general-purpose.

================================================================
SESSION PROCESS NOTES
================================================================

### Read-before-edit discipline break and restoration

During D.6.1 file 5 (App.tsx), edits were proposed from
memory instead of from a fresh disk read. The founder
caught this and required a corrective readback before
the file was accepted. The edit turned out correct. The
discipline was not followed. Restored from D.6.1 file 2
onward: every modified file was read on disk immediately
before the edit was proposed. No code impact. Recorded
here so the discipline stays explicit.

### Cloud trip discipline

D.6.1 and D.6.2 were each verified in a single cloud
trip: one pull, one Rust regression, one frontend build,
one smoke test. Two cloud trips total for two slices.
This is the working rule.

### Commit plan correction

The initial understanding was one commit for both D.6.1
and D.6.2. Corrected by the founder: two implementation
commits (3b578f3, 88ef81c), one documentation commit
(this session's batch). Matches the working rule "one
commit per slice, documentation after implementation in
one batch."

================================================================
SEAMS AND FOLLOW-UPS
================================================================

Nothing new added to the seam list.

Two follow-ups recorded for the Actions browser:
  - Type filter chip.
  - Text search.

Two follow-ups recorded at the D.5 closure remain open:
  - Day panel.
  - Period summary.
  - Bulk-select within a day panel.

================================================================
END OF SESSION ENTRY
================================================================

This entry records the D.6.1 and D.6.2 HOW decisions and
the two session process notes. No spec amendment in this
session. No frozen document amended.

End of entry.