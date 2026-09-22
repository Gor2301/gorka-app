\# GORKA FRONTEND REALITY



Version: 1.0

Date: September 14, 2026

Status: Reconnaissance record. Not a phase. Not a plan.



Purpose: Record where the Tauri frontend actually lives on

disk, what exists in it, and what is missing, so future

sessions do not spend time rediscovering this. Written after

Phase 15 documentation, before starting frontend repair work.



============================================================

1\. WHERE THE TAURI FRONTEND LIVES

============================================================



\- Vite config: C:\\Users\\kucha\\gorka-app\\vite.config.ts

&#x20; - root: default (project root)

&#x20; - outDir: <project>\\dist

&#x20; - alias '@' -> supervisor-dashboard/src



\- Entry HTML: C:\\Users\\kucha\\gorka-app\\index.html

&#x20; - loads /supervisor-dashboard/src/main.tsx



\- Tauri config: C:\\Users\\kucha\\gorka-app\\src-tauri\\tauri.conf.json

&#x20; - frontendDist: "../dist"

&#x20; - devUrl: http://localhost:5173

&#x20; - beforeBuildCommand: "npm run build"

&#x20; - productName: "GORKA-Client-Dashboard"



\- Root package.json name is "supervisor-dashboard".

&#x20; The folder "supervisor-dashboard" IS the Tauri app's

&#x20; frontend source. The name is legacy. Do not confuse it with

&#x20; a separate web dashboard.



Chain of truth:

&#x20; supervisor-dashboard/src/  ->  vite build  ->  dist/

&#x20; ->  tauri build  ->  GORKA-Client-Dashboard.exe



============================================================

2\. WHAT EXISTS IN supervisor-dashboard/src/

============================================================



Root:

&#x20; App.tsx, main.tsx, App.css, index.css



Components:

&#x20; AppShell.tsx, Sidebar.tsx, Sidebar.css, TopHeader.tsx,

&#x20; GorkaLogo.tsx, UnlockScreen.tsx,

&#x20; Connectors/ConfigurationModal.tsx,

&#x20; Connectors/DeclarationModal.tsx



Services:

&#x20; local.db.ts        (auth wrappers only - see section 4)

&#x20; api.service.ts

&#x20; auth.service.ts

&#x20; agents.service.ts

&#x20; audit.service.ts

&#x20; calendar.service.ts

&#x20; connectors.service.ts

&#x20; permissions.service.ts

&#x20; upload.service.ts



Pages (sorted by size, from a dir listing):

&#x20; STUBS (<= \~1 KB, likely placeholders):

&#x20;   Tasks.tsx            336 B

&#x20;   Clients.tsx          344 B

&#x20;   Reports.tsx          344 B

&#x20;   Settings.tsx         348 B

&#x20;   Billing.tsx          751 B

&#x20;   Analytics.tsx        756 B

&#x20;   Collections.tsx     1336 B  (verified stub - "Under Construction" text only)



&#x20; SUBSTANTIAL (real code, size suggests implementation):

&#x20;   Login.tsx           3870 B

&#x20;   GORKAStatus.tsx     7277 B

&#x20;   Permissions.tsx     7353 B

&#x20;   Support.tsx         7740 B

&#x20;   Dashboard.tsx       9996 B

&#x20;   MyRequestDetail    10021 B

&#x20;   MyRequests         10213 B

&#x20;   Connectors         11584 B

&#x20;   Upload             12697 B

&#x20;   DataFlowAudit      12882 B

&#x20;   ComplianceReport   13180 B

&#x20;   Calendar           16008 B

&#x20;   Audit              20785 B

&#x20;   Agents             21443 B



============================================================

3\. THE APP ROUTING AND GATING (App.tsx)

============================================================



Three-stage gate:

&#x20; !isAuthenticated  -> <Login />

&#x20; authenticated but

&#x20; !isUnlocked       -> <UnlockScreen />

&#x20; both true         -> <Routes>



Routes registered: /, /dashboard, /agents, /collections,

/upload, /audit, /permissions, /analytics, /billing,

/settings, /compliance, /data-flow-audit, /calendar,

/connectors, /support, /status, /my-requests,

/my-requests/:id, \* -> redirect /dashboard



Each page (except Support, GORKAStatus, MyRequests) is wrapped

in <AppShell> which provides the sidebar.



============================================================

4\. AUTH LAYER STATUS

============================================================



supervisor-dashboard/src/services/local.db.ts exports a single

object: `auth`.



auth methods and the Rust commands they invoke:

&#x20; login(email, password)   -> invoke('login')

&#x20; getToken()               -> invoke('get\_auth\_token')

&#x20; getOrganizationId()      -> invoke('get\_organization\_id')

&#x20; getSalt()                -> invoke('get\_salt')

&#x20; isUnlocked()             -> invoke('is\_database\_unlocked')

&#x20; unlockDatabase(password) -> invoke('unlock\_database')

&#x20; logout()                 -> invoke('logout')



Every one of those Rust commands exists and is registered in

src-tauri/src/main.rs (verified in Phase 9 reconnaissance).



CONCLUSION: The auth path is wired end to end.



============================================================

5\. WHAT IS MISSING

============================================================



Debtor CRUD wrapper functions. local.db.ts defines NO localDB

object. There are no frontend functions that call:

&#x20; get\_debtors, get\_debtor, insert\_debtor, bulk\_insert\_debtors,

&#x20; update\_debtor, delete\_debtor, search\_debtors, get\_debtor\_count,

&#x20; upload\_document, get\_documents, delete\_document.



The Rust side implements all of those commands. The frontend

side wrapper does not exist.



Collections.tsx is a static placeholder. No data fetching, no

service calls. It renders "Collections Under Construction".



So the chain is:



&#x20; Collections.tsx  ->  (MISSING)  ->  local.db.ts localDB

&#x20;                  ->  (MISSING)  ->  invoke

&#x20;                  ->  Rust command  ->  SQLCipher



The last two links exist. The first two do not.



============================================================

6\. WHAT PHASE 9 ACTUALLY NEEDS

============================================================



Two deliverables, in order:



&#x20; A. Add a `localDB` object to

&#x20;    supervisor-dashboard/src/services/local.db.ts that wraps

&#x20;    the Rust debtor and document commands. Estimated \~40

&#x20;    lines. Mirrors the pattern of the existing `auth` object.

  STATUS (September 14, 2026): DONE. localDB object added to
  supervisor-dashboard/src/services/local.db.ts. Tested.



&#x20; B. Replace the Collections.tsx placeholder with a real page:

&#x20;    list debtors, search, view detail, add, edit, delete.

&#x20;    Estimated 300-500 lines depending on polish.



Nothing else in Phase 9 depends on more frontend work. The

unlock flow already exists in App.tsx and UnlockScreen.tsx. The

auth layer exists. Only the debtor path is missing.


  STATUS (September 14, 2026): DONE. Collections.tsx rewritten
  as a full CRUD page. Tested in the running app.



After A and B, Phase 9's manual tests can actually run:

&#x20; - create debtor

&#x20; - search debtor

&#x20; - edit debtor

&#x20; - delete debtor

&#x20; - upload document

&#x20; - persistence across restart



============================================================

7\. WHAT ELSE THE FRONTEND DOES NOT DO

============================================================



\- Data Upload (Upload.tsx) exists at 12.7 KB but Phase 9 showed

&#x20; it asks for login when used. Not yet investigated in detail.

&#x20; Needs its own recon pass before Phase 9's document upload

&#x20; test can run.

\- Audit Logs page (Audit.tsx, 20.8 KB) exists. Not yet verified

&#x20; to read from the local audit\_log table.

\- Backup UI: not observed in the file list. May not exist.

\- The Tauri app's connection to the local backend at

&#x20; http://localhost:3000 (per auth.rs) is correct for tests.

&#x20; For production it would need to point at a live backend.



============================================================

8\. NOMENCLATURE WARNING

============================================================



"Client Dashboard" refers to two different things in the

codebase:



&#x20; (1) The Tauri desktop app. Source:

&#x20;     supervisor-dashboard/src/. Product name in

&#x20;     tauri.conf.json: "GORKA-Client-Dashboard".

&#x20;     This is what the agency admin uses.



&#x20; (2) A web page at client.gorka.localhost:5173. This is a

&#x20;     separate artifact that was mistakenly embedded and

&#x20;     should be extracted later. Not the Tauri app.



Future sessions must not confuse (1) and (2).



============================================================

END OF DOCUMENT

============================================================


============================================================
9. UPDATE — September 14, 2026
============================================================

The two deliverables described in Section 6 are complete and
tested. See DECISIONS.md "Phase 9 Unblock — Local Debtor CRUD"
for details.

Additionally, upload.service.ts was found to POST debtor data
to a cloud endpoint and was rewritten to work locally. See the
same DECISIONS.md entry.





