\# SESSION HANDOFF - Companion to RESUME-HERE.md



Document:    SESSION-HANDOFF.md

Date:        October 7, 2026

Purpose:     Deep briefing for a fresh assistant. RESUME-HERE.md is

&#x20;            the short brief. This is the long one. Read both.

Authority:   RESUME-HERE.md wins where they overlap.



\---



\## 1. WHAT THIS DOCUMENT IS



A fresh assistant opening a new chat should read:

&#x20; 1. This file (SESSION-HANDOFF.md) - orientation, gotchas, commands.

&#x20; 2. RESUME-HERE.md - current state, next steps, rules.

&#x20; 3. Then start the slice.



It exists because this session's chat history contained:

&#x20; - discoverable-by-search commands (backend start, pooler URL)

&#x20; - gotchas that cost time (Tailwind, PS here-strings, prisma schema)

&#x20; - architectural clarifications from the founder that are not yet

&#x20;   in any frozen document



The next assistant must not re-discover these.



\---



\## 2. THE PRODUCT, IN ONE PARAGRAPH



GORKA is a debt-collection platform. Two Tauri desktop apps:

the Client Dashboard (admin) and the Agent App (agent). Debtor

data is local, never in GORKA's cloud. GORKA's cloud holds only

customer, billing, aggregate, and metadata.



The Connection Center is the admin surface where GORKA connects

to third-party vendors: communication tools, AI, and

client-supplied data sources (credit bureaus, skip tracing). Two

paths:

&#x20; - GORKA-managed (Tier 1): GORKA provisions a per-client

&#x20;   credential with the vendor and hands it back to the admin.

&#x20; - BYOP (Tier 2): the admin brings their own vendor

&#x20;   relationship and enters the credential.

Both paths store the credential locally on the client's device.

GORKA's cloud never holds it.



The near-term goal is an investor demo. Everything below serves

that.



\---



\## 3. WHERE WE ARE RIGHT NOW



Commit:  8e1bc20 (Main and GitHub)

Cloud:   4fa8eb8 (last verified green; one docs-only commit behind)



Working trees clean. Cloud can be shut down.



The Connectors page works end to end. Verified on cloud today:

&#x20; - Two sections: "GORKA built-in" and "Bring your own"

&#x20; - Resend Email: Connect / Disconnect flips status. Works.

&#x20; - Custom API (BYOP): Add my credentials -> modal -> submit ->

&#x20;   stored locally -> CONNECTED -> Disable. Works.

&#x20; - Twilio SMS, Twilio Voice, Mocean SMS, Gemini AI: disabled

&#x20;   "Coming soon" buttons.



Header title derives from route. API calls carry the JWT. No 401s.



\---



\## 4. THE FOUNDER'S DIRECTION (not yet in any frozen spec)



These are things the founder said this session. They matter for

every connector-related decision.



1\. All current catalog rows are labeled GORKA-managed

&#x20;  (isManagedByGorka = true). This is a label, not a promise.

&#x20;  The GORKA-managed \*capability\* exists only where an adapter

&#x20;  and backend provisioning exist.



2\. The catalog is flexible, not fixed. Adding a vendor is a data

&#x20;  operation (one seed object). Removing or adding vendors must

&#x20;  not require code or architecture change. This is a core

&#x20;  requirement, not a nice-to-have.



3\. BYOP is always available as a fallback for every vendor, even

&#x20;  if GORKA also offers a managed path. The admin chooses per

&#x20;  enablement. A vendor can flip from BYOP-only to also-managed

&#x20;  when GORKA adds a provisioning path, but existing enablements

&#x20;  do not auto-migrate.



4\. Switching a connector from BYOP to GORKA-managed (or back)

&#x20;  requires disabling and re-enabling through the correct path.

&#x20;  No one-click switch. Chaos avoided by design.



5\. Data vendors (credit bureaus, skip tracing, any structured

&#x20;  data source) are BYOP-only, always. GORKA does not hold

&#x20;  credentials to, does not provision, and cannot guarantee

&#x20;  anything about a data vendor. All risk is on the client.



6\. Retired vendors disappear from the dashboard entirely. Only

&#x20;  metadata remains, for compliance.



7\. Agents never see credentials or provider details. They see a

&#x20;  tool appear and they use it.



8\. Two declarations, one per tier:

&#x20;  - Tier 1: honest disclosure. GORKA does not read debtor data;

&#x20;    some metadata reaches the cloud because the service cannot

&#x20;    function without it.

&#x20;  - Tier 2 (BYOP): warning. GORKA cannot guarantee the third

&#x20;    party; client carries responsibility.



9\. CONNECTOR-MODEL.md is outdated. Its §3.3 says Mocean and

&#x20;  Gemini are isManagedByGorka=false. That disagrees with the

&#x20;  founder's current direction. Reconciliation is deferred to a

&#x20;  future revision of the connector model. Do not amend it today.



\---



\## 5. FINDINGS AND GOTCHAS



Every one of these cost time this session. None will cost time

again.



\### 5.1 Backend start



The backend needs two inline env vars, not one:



&#x20;   cd /d C:\\gorka-app

&#x20;   set DATABASE\_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka\_test \&\& set RESEND\_API\_KEY=re\_d5BwBTPP\_77bYXXNXGGLZU5SwNmtx2gjb \&\& npx tsx src/backend/index.ts



Why RESEND\_API\_KEY and not VITE\_RESEND\_API\_KEY:

&#x20; src/backend/routes/auth.ts line 18 reads process.env.RESEND\_API\_KEY.

&#x20; The .env file only has VITE\_RESEND\_API\_KEY. Different names.



\### 5.2 Pooler URL



The direct Supabase hostname (db.tmloklxelckicufzpzxz.supabase.co)

does not resolve from AWS Singapore. Always use the pooler:



&#x20;   aws-1-eu-west-3.pooler.supabase.com:5432



Username for pooler: postgres.tmloklxelckicufzpzxz



\### 5.3 Prisma db push



NEVER run `npx prisma db push` without `--schema`. The default

schema file is prisma/schema.prisma, which is STALE. Running

against it produces a diff that DROPS every cloud table.



Correct:



&#x20;   set DATABASE\_URL=<pooler-url> \&\& npx prisma db push --schema=prisma\\schema.cloud.prisma



If the prompt offers to drop tables, press N. Do not confirm.



\### 5.4 Tailwind is not compiling for the Client Dashboard



Observed: utility classes (grid-cols-3, flex, rounded-lg, etc.)

do not generate CSS for supervisor-dashboard files. Reason not

fully diagnosed. tailwind.config.js content path was updated to

include supervisor-dashboard/src, but utilities still do not

compile in the dev server.



Workaround in place: Connectors.tsx and ConfigurationModal.tsx

use inline styles (style={...}), matching AppShell.tsx and the

rest of the app. Other pages already used inline styles.



Do NOT spend time trying to fix the Tailwind pipeline tonight.

The demo works with inline styles. A dedicated Tailwind slice

belongs later, if at all.



\### 5.5 PowerShell here-string trap



When writing multi-line content via a here-string, always leave

a blank line before the closing '@. Otherwise the last inserted

line merges with the next line in the target file. This bit us

in Phase 5a.



\### 5.6 Single quotes in single-quoted PS strings



Inside a single-quoted PS string, a literal single quote must be

doubled (''), not escaped (\\'). Using \\' causes a parse error.



\### 5.7 Seed upsert requires the new field in the update block



The connector\_catalog seed uses upsert. When a new field is

added to the row object, it must also be added to the `update:`

block. Otherwise existing rows never receive the new value.



\### 5.8 api.service.ts previously read the token from localStorage



The JWT lives in Rust's settings.dat, not browser localStorage.

Fixed this session: api.service.ts now calls

invoke('get\_auth\_token'). If a 401 appears on any page, check

this first.



\### 5.9 Header title



AppShell.tsx derives the title from useLocation(). If a new

route is added to App.tsx, add its title to PAGE\_TITLES in

AppShell.tsx. Otherwise it falls back to "Dashboard".



\### 5.10 Mod.rs duplicate insertion



Scripted inserts using the anchor line as its own insertion

point can produce a duplicate. After any scripted insert, run

`git diff --stat` and check for unexpected +2 on single-line

files.



\---



\## 6. FILES TO READ (in order)



Primary brief:

&#x20; GORKA\_RECOVERY/recovery-notes/RESUME-HERE.md



Model specs:

&#x20; GORKA\_RECOVERY/recovery-notes/CONNECTION-CENTER.md  (new, v0.1 draft)

&#x20; GORKA\_RECOVERY/recovery-notes/CONNECTOR-MODEL.md    (older, partially superseded)

&#x20; GORKA\_RECOVERY/recovery-notes/SYNC-ARCHITECTURE.md  (§25.14 - §25.16 for the three CONNECTOR events)

&#x20; GORKA\_RECOVERY/recovery-notes/LOCAL-TABLES.md       (B.1 local\_connectors, F.1 compliance\_rules)

&#x20; GORKA\_RECOVERY/recovery-notes/CLOUD-TABLES.md       (§6.1 connector\_catalog, §6.2 client\_connectors)



Code - shared crate:

&#x20; shared/src/connectors/mod.rs           module tree, trait, registry

&#x20; shared/src/connectors/resend\_email.rs  the only adapter; the pattern

&#x20; shared/src/connectors/local\_record.rs  B3 write path (new)

&#x20; shared/src/sync.rs                     encoders

&#x20; shared/src/sync\_parse.rs               decoders

&#x20; shared/src/db.rs                       migrations (local\_connectors at line \~645)



Code - client binary:

&#x20; src-tauri/src/main.rs                  Tauri command registrations

&#x20;                                        (write\_local\_connector\_credential at \~337)



Code - frontend:

&#x20; supervisor-dashboard/src/pages/Connectors.tsx

&#x20; supervisor-dashboard/src/components/Connectors/ConfigurationModal.tsx

&#x20; supervisor-dashboard/src/components/Connectors/DeclarationModal.tsx   (exists, unused)

&#x20; supervisor-dashboard/src/services/connectors.service.ts

&#x20; supervisor-dashboard/src/services/api.service.ts

&#x20; supervisor-dashboard/src/components/AppShell.tsx

&#x20; supervisor-dashboard/src/App.tsx



Code - backend:

&#x20; src/backend/routes/connectors.routes.ts

&#x20; src/backend/index.ts                   route mounting

&#x20; prisma/schema.cloud.prisma             ConnectorCatalog model at \~343

&#x20; prisma/seed-connectors.ts



\---



\## 7. ENDPOINTS



Backend routes in src/backend/routes/connectors.routes.ts,

all under /api/connectors, all behind authenticateToken.



&#x20; GET /api/connectors

&#x20;   Returns the caller's organization's enablement rows.

&#x20;   Response: { success, data: { rows, total } }

&#x20;   OWNER sees all orgs; other roles see their own only.



&#x20; GET /api/connectors/catalog

&#x20;   Returns active connector\_catalog rows.

&#x20;   Response: { success, data: { rows, total } }



&#x20; POST /api/connectors/enable

&#x20;   Body: { connectorCode, credentialsLocation }

&#x20;   credentialsLocation: 'LOCAL' | 'CLOUD'. CLOUD is rejected.

&#x20;   Upserts a client\_connectors row with status CONNECTED.

&#x20;   Response: { success, data: <row> }



&#x20; POST /api/connectors/disable

&#x20;   Body: { connectorCode }

&#x20;   Sets status DISCONNECTED, records disconnectedAt.

&#x20;   Response: { success, data: <row> }



Frontend service wrappers live in

&#x20; supervisor-dashboard/src/services/connectors.service.ts

&#x20;   listCatalog(), listEnablements(), enable(code), disable(code)



Note: the previous backend had no /catalog, /types, /:id,

/:id/connect, /:id/connect-auto, /:id/test, or /:id/disconnect

route. The frontend no longer calls those.



\---



\## 8. COMMANDS - MAIN MACHINE



Reconnaissance (read-only):

&#x20;   cd /d C:\\Users\\kucha\\gorka-app

&#x20;   git log --oneline -10

&#x20;   git status --short

&#x20;   git diff --stat

&#x20;   type <path>

&#x20;   findstr /n /c:"literal" <path>

&#x20;   powershell -Command "Select-String -Path <path> -Pattern '<pattern>' -Context 0,40"

&#x20;   powershell -Command "Get-Content <path> | Select-Object -Skip N -First M"



Commit and push:

&#x20;   cd /d C:\\Users\\kucha\\gorka-app

&#x20;   git add <explicit paths>

&#x20;   git commit -m "<message>"

&#x20;   git push



Never: git add -A, git add ., or git add -u.



\---



\## 9. COMMANDS - CLOUD MACHINE



Pull and verify:

&#x20;   cd /d C:\\gorka-app

&#x20;   git pull

&#x20;   git log --oneline -3

&#x20;   cargo build --workspace

&#x20;   cargo test --workspace

&#x20;   node verify\\index.mjs



Frontend build:

&#x20;   cd /d C:\\gorka-app\\supervisor-dashboard

&#x20;   npm run build



Backend (Terminal 1):

&#x20;   cd /d C:\\gorka-app

&#x20;   set DATABASE\_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka\_test \&\& set RESEND\_API\_KEY=re\_d5BwBTPP\_77bYXXNXGGLZU5SwNmtx2gjb \&\& npx tsx src/backend/index.ts



Vite dev server (Terminal 2):

&#x20;   cd /d C:\\gorka-app

&#x20;   npm run dev



Tauri Client Dashboard (Terminal 3):

&#x20;   cd /d C:\\gorka-app\\src-tauri

&#x20;   cargo run --bin gorka-client



Note: `npm run tauri:dev` does NOT work on this machine. Use the

three-terminal workflow above.



Prisma:

&#x20;   cd /d C:\\gorka-app

&#x20;   set DATABASE\_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka\_test \&\& npx prisma db push --schema=prisma\\schema.cloud.prisma



Seed:

&#x20;   cd /d C:\\gorka-app

&#x20;   set DATABASE\_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka\_test \&\& npx tsx prisma/seed-connectors.ts



Inspect DB rows:

&#x20;   cd /d C:\\gorka-app

&#x20;   set DATABASE\_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka\_test \&\& npx tsx -e "import {PrismaClient} from '@prisma/client'; const p = new PrismaClient(); p.connectorCatalog.findMany({select:{code:true,mvpStatus:true,isManagedByGorka:true},orderBy:{code:'asc'}}).then(r=>{console.log(JSON.stringify(r,null,2)); return p.$disconnect();});"



For any npx tsx command, prepend the same inline DATABASE\_URL.



\---



\## 10. PROCESS RULES (founder's working style)



From the founder, verbatim where possible:



&#x20; - Founder pastes outputs verbatim. Commands must be plain and

&#x20;   copy-pasteable.

&#x20; - Always label MAIN or CLOUD on any command.

&#x20; - Do not write any code before plan approval. The failure mode

&#x20;   is "here's the file I'd write" before reconnaissance is done.

&#x20; - Cloud builds are slow (2-4 min). Do not waste them.

&#x20; - Founder values honesty over speed. If reconnaissance shows a

&#x20;   plan is wrong, say so.

&#x20; - When in doubt, stop and ask.

&#x20; - Content anchors only for scripted edits. Never raw line

&#x20;   indices. Never String.Replace on recovery documents.

&#x20; - Sanity-check before write. Abort on failure. Backup before

&#x20;   every edit. Verify with findstr after every edit.

&#x20; - One commit per coherent change. Multi-commit slices are fine,

&#x20;   all pushed before the single cloud trip.

&#x20; - The founder is not a coder. Explain in plain language. Avoid

&#x20;   jargon. If a term is unavoidable, define it.

&#x20; - The founder chooses among recommendations. Do not offer ten

&#x20;   options; offer one recommendation and one alternative.



\---



\## 11. WHAT TO DO FIRST IN A NEW CHAT



&#x20; 1. Say: "Phase \[X] - reconnaissance first, no code."

&#x20; 2. Ask the founder to confirm current state:

&#x20;       git -C C:\\Users\\kucha\\gorka-app log --oneline -1

&#x20;       git -C C:\\Users\\kucha\\gorka-app status --short

&#x20;    Expected: HEAD at 8e1bc20, tree clean.

&#x20; 3. Propose the slice. Wait for approval.

&#x20; 4. Do reconnaissance. Read files on disk. Confirm every fact.

&#x20; 5. Write the plan. Wait for approval.

&#x20; 6. Write code as a script. Verify before commit.

&#x20; 7. Commit, push.

&#x20; 8. One cloud trip.

&#x20; 9. Rewrite RESUME-HERE.md. Commit, push.



\---



\## 12. NEXT SLICES (in recommended order)



&#x20; 1. Zone 3 declaration for the custom-api BYOP path.

&#x20;    Size: small. 30-45 min.

&#x20;    What: show DeclarationModal before ConfigurationModal on the

&#x20;    BYOP "Add my credentials" flow. On accept, write one row to

&#x20;    organization\_audit\_events. Then open the credential modal.

&#x20;    Files: DeclarationModal.tsx (rewrite to inline styles and

&#x20;    spec §9 wording), Connectors.tsx (one extra step), backend

&#x20;    (one route or a parameter on /connectors/enable).

&#x20;    Why next: the custom-api row exists. The declaration has a

&#x20;    trigger. It closes B4b.



&#x20; 2. First non-Resend adapter (Twilio SMS likely).

&#x20;    Size: medium-large. 90 min.

&#x20;    What: new shared/src/connectors/twilio\_sms.rs, mirroring

&#x20;    resend\_email.rs. Register in the factory. Flip twilio-sms

&#x20;    mvpStatus to LIVE in the seed.

&#x20;    Files: 4-6.

&#x20;    Cloud trip: one, with mocked or real provider call.



&#x20; 3. B7-static. Docs-only. 15 min. Backend logging review note.

&#x20; 4. 5a-vectors. Test-only. 45 min, two cloud builds.

&#x20; 5. Connector event origination. Medium. 90+ min. Originate

&#x20;    CONNECTOR\_ENABLED event when a connector is enabled. Touches

&#x20;    the sync engine.



\---



\## 13. WHAT NOT TO DO



&#x20; - Do not run any prisma command without --schema pointing at

&#x20;   prisma/schema.cloud.prisma.

&#x20; - Do not run prisma db push against production. Ever.

&#x20; - Do not git add -A, git add ., or git add -u on cloud.

&#x20; - Do not edit RESUME-HERE.md at any path other than

&#x20;   GORKA\_RECOVERY/recovery-notes/RESUME-HERE.md.

&#x20; - Do not attempt `npm run tauri:dev` on cloud.

&#x20; - Do not attempt `cargo` on main.

&#x20; - Do not amend CONNECTOR-MODEL.md this phase. Its reconciliation

&#x20;   is deferred.

&#x20; - Do not try to fix the Tailwind pipeline. The workaround

&#x20;   (inline styles) is in place.

&#x20; - Do not trust the `.env` file for the backend DATABASE\_URL.

&#x20;   Use the pooler override.

&#x20; - Do not assume the founder is a coder. Explain.

&#x20; - Do not offer ten options. Offer one recommendation and one

&#x20;   alternative.



\---



\## 14. THE THREE MACHINES



&#x20; Main (local)   C:\\Users\\kucha\\gorka-app

&#x20;                Editing. Cannot reliably compile (SAC blocks

&#x20;                build-script binaries). Read-only reconnaissance

&#x20;                plus git add/commit/push.



&#x20; Cloud          C:\\gorka-app

&#x20;                Builds, tests, verification. Opened per slice.

&#x20;                Path distinction matters: cd /d C:\\gorka-app

&#x20;                fails on main.



&#x20; GitHub         Gor2301/gorka-app

&#x20;                Handoff between the two.



\---



\## 15. ENVIRONMENT



&#x20; Main OS:   Windows (SAC enforced; cargo blocked)

&#x20; Cloud OS:  AWS EC2 t3.small, Windows Server 2025, Singapore

&#x20; Node:      v24.x

&#x20; Rust:      1.98 or later

&#x20; Database:  Supabase, gorka\_test schema. Pooler only from cloud.



&#x20; .env files carry live credentials. Rotation deferred to

&#x20; pre-launch. Do not commit new .env files. Do not print their

&#x20; contents in chat unless required for reconnaissance.



\---



\## 16. GLOSSARY (founder may not know these)



&#x20; Adapter         Rust code that speaks one specific provider's

&#x20;                 API. One per provider. Catalog rows make

&#x20;                 vendors appear; adapters make them work.



&#x20; Catalog row     A data row describing a vendor. Adding one is

&#x20;                 a data operation, not code.



&#x20; Enablement      The client's decision to activate a vendor for

&#x20;                 their organization. One row per (org, vendor).



&#x20; BYOP            Bring Your Own Provider. Tier 2. Admin enters

&#x20;                 their own vendor credential.



&#x20; GORKA-managed   Tier 1. GORKA provisions a per-client credential

&#x20;                 on the admin's behalf.



&#x20; Zone 2          GORKA-provided mechanism for a named provider.

&#x20;                 The mechanism is the guard.



&#x20; Zone 3          Client-connected third party outside GORKA's

&#x20;                 control. GORKA warns; the client decides.



&#x20; TLV             Type-Length-Value. The wire encoding used by

&#x20;                 the sync protocol. Section 22 of

&#x20;                 SYNC-ARCHITECTURE.md.



&#x20; Lamport clock   Logical clock used for event ordering.

&#x20;                 Section 12 of SYNC-ARCHITECTURE.md.



\---



\## 17. HOW TO USE THIS DOCUMENT



At the start of a new chat, paste this file and RESUME-HERE.md.



This file answers "how does this project work, what are the

traps, and what commands do I use."



RESUME-HERE.md answers "where are we today and what is next."



Between them, the new assistant has everything needed to start

a slice without re-discovering anything.



\---



End of SESSION-HANDOFF.md

