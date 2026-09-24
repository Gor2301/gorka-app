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
