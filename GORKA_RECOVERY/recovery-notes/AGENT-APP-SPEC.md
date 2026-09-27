GORKA AGENT APP BUILD SPEC

Document: AGENT-APP-SPEC.md

Version: 1.2 (draft for founder review)

Date: September 27, 2026

Status: DRAFT - awaiting founder review

Authority: Subordinate to ARCHITECTURAL-LAW.md v1.3.

Inputs: DECISIONS.md, September 27, 2026 (both entries); GORKA-MVP-SCOPE.md v1.1; SYNC-ARCHITECTURE.md v1.3; LOCAL-TABLES.md v1.2; MULTI-USER-CONCEPT.md v2.0; THREAT-MODEL.md v1.0.

Phase: Input to Phase 9.5.



Revision note (v1.2): This version applies the final process clarifications from the founder's external review of v1.1, dated September 27, 2026. Three changes: (1) the Agent App's temporal definition in Section 1.2 states the Phase 9.6 timing explicitly; (2) a new Section 2.8 provides the Phase 9.5 implementation contract - a definitive list of what is built now versus what is specification context for later phases; (3) the localhost API endpoint is added to the Phase 9.5 preflight checklist in Section 12. No architecture is reopened. No other section is changed.



1\. PURPOSE AND SCOPE

1.1 What this document is

This document is the technical specification for the Agent App, the second Tauri desktop application in the GORKA platform. It is the document a developer follows to build the Agent App in Phase 9.5.



It is a specification, not code. It names what the Agent App is, what it is not, what it shares with the Client Dashboard, what it owns exclusively, and what is deliberately out of scope. It does not write Rust, TypeScript, or SQL.



1.2 What the Agent App is

The Agent App is the collection worker's daily tool. It is a Tauri desktop application that runs on the agent's own machine. It opens the agent's own local SQLCipher database. The Agent App is designed to synchronize with the other devices in the organization through the sync engine defined in SYNC-ARCHITECTURE.md. Synchronization is implemented in Phase 9.6, not Phase 9.5. The Agent App does not send debtor data to GORKA's cloud in readable form, at any point, under any configuration.



The agent opens the Agent App to do their job: see the day's plan, look at a debtor, contact the debtor through a communication tool the admin has enabled, log what happened, create a follow-up action, review documents, and move to the next debtor.



1.3 What the Agent App is not

The Agent App is not the Client Dashboard. It is not an administrative console, a configuration surface, a reporting surface, or a billing surface.



Specifically, the Agent App does not:



Send messages to debtors from the Client Dashboard. Sending is agent-side (Section A-2 of the September 27 A-G entry). The admin never sends.



Configure connectors. The admin configures; the agent consumes (Section A-3).



Display provider credentials. The agent never sees provider accounts, tokens, or settings (Section A-3, Section A-6).



Manage organization keys. The agent imports an enrollment package; the agent does not generate keys (Section 6.4).



Display admin-level analytics, usage totals for billing, or organization-wide monitoring.



Export the organization enrollment package. Export is admin-side.



Contain per-agent access-control filtering in the MVP. All agents see all debtors (D-3 of the September 27 entry). The outbound path is specified as two steps with an identity filter for the MVP (Section 7.5), so the funded-phase filter is a one-line change, not a redesign.



1.4 What this document does not do

It does not write code.



It does not amend any frozen document. Where this document identifies a needed change in a frozen document, it names it and defers the amendment to the process in Section 12.



It does not amend the invariant.



It does not add any event type, entity type, message type, or table to the frozen architecture. Where this document introduces a local schema addition, the addition is proposed here and must be confirmed in LOCAL-TABLES.md before implementation (Section 12, Correction C3).



It does not change the cloud schema.



It does not start Phase 9.6.



It does not resolve the open items in Section 12. It names them.



If this document ever appears to contradict ARCHITECTURAL-LAW.md, SYNC-ARCHITECTURE.md, or GORKA-MVP-SCOPE.md, the frozen document wins and this document is corrected.



2\. ARCHITECTURE

2.1 The two-binary model

The Agent App is the second Tauri binary in the same repository. The Client Dashboard is the first. Both live in C:\\Users\\kucha\\gorka-app.



The decision is recorded in the September 27 A-G entry, Section G:



Same repository, second Tauri binary, shares the Rust command layer with the Client Dashboard. Code is written fresh. The Electron-era code in src/frontend/ and src/backend/\_disabled/ is reference only, not ported.



The Agent App is not a fork of the Client Dashboard. It is a fresh frontend over the same Rust command layer. It reads the same local schema. It is a different application with a different purpose.



2.2 The shared Rust command layer

One crate holds the logic. Both Tauri binaries compile it. Each binary registers its own subset of commands in its own generate\_handler! block, in its own main.rs.



The rule:



Shared Rust command layer = one crate of functions, organized into modules. Each Tauri binary registers its own subset in its own generate\_handler!. A command is registered in a binary only if that binary's UI uses it. Admin-only commands are not registered in the Agent App. New commands are added to the crate once and registered where they belong.



This is the seam. It is what makes the "LEGO" model in Section G-2 of the September 27 entry work. Adding a feature later is: write the function once in the crate, register it in the binary that needs it, add the UI. The other binary is untouched.



This is stricter than "register everything and hide the admin commands in the UI." A hidden UI button is not a boundary: any registered command is callable from the webview's devtools regardless of what the UI renders. The boundary is the registration list.



This rule matches the principle already stated in D-3 of the September 27 entry: "UI-layer hiding alone is not sufficient for the funded phase. Not a UI guard."



Module organization. The shared crate's logic lives in modules, not in a single main.rs. The main.rs of each binary contains application wiring and the generate\_handler! registration list. Business logic (database access, enrollment package, sync primitives, connector logic, compliance enforcement) lives in its own module (db.rs, auth.rs, and future modules such as sync.rs, connectors.rs, compliance.rs). This prevents main.rs from becoming a God file as features are added.



2.3 The Agent App's own identity

The Agent App is a distinct application with distinct file locations. It does not share:



Bundle identifier. The Agent App has its own. The exact string is chosen at build configuration time.



App data folder. The Agent App's settings.dat lives in its own app data folder. The pattern follows the Client Dashboard's: %APPDATA%\\gorka\\client\\ becomes %APPDATA%\\gorka\\agent\\ (or the equivalent chosen at build time).



settings.dat. The Agent App's own store holds its own auth\_token, organization\_id, salt, db\_unlocked, and any future keys. It is not the same file as the Client Dashboard's.



Local SQLCipher database. The Agent App's own database file, following the gorka-client.db pattern as gorka-agent.db (or the equivalent chosen at build time). Same schema. Same migrations. Different file. Different encryption key derived from this device's own local password.



The reason: two local applications on the same machine are two distinct local replicas. Each has its own device identity for sync purposes (Section 5.3). Each has its own local password. Each has its own SQLCipher key. They do not share a database, and they do not share a store.



2.4 The shared local schema

The local schema is the same in both apps. That is the settled rule from Section G-1 of the September 27 entry:



Same schema for both apps. Same tables, same migrations.



The Agent App runs the same migration sequence in its own database. When a new migration block is added (a new if current\_version < N block in run\_migrations), both apps run it. The schema is not forked.



Schema authority. LOCAL-TABLES.md v1.2 is the authoritative source for the local schema. The additions this document proposes (Section 5.4 through 5.6) must be recorded in LOCAL-TABLES.md via its amendment process before implementation. Until that amendment lands, the additions are proposals, not schema. A developer must not implement them against this document alone. See Section 12 (Correction C3).



2.5 The sync engine is shared

The sync engine (Phase 9.6) is part of the shared Rust command layer. Both apps run the same engine, exchange the same event types, follow the same protocol. See Section 7 for the Agent App's participation in the MVP topology.



2.6 Crate and dependency set

The Agent App uses the same Cargo crate set as the Client Dashboard. The current set, from src-tauri/Cargo.toml, is: tauri 2 with default and tray-icon, tauri-utils 2, tauri-plugin-store 2, tauri-plugin-dialog 2, tauri-plugin-fs 2, serde, serde\_json, rusqlite 0.32 with bundled-sqlcipher-vendored-openssl, uuid 1 with v4, chrono 0.4, directories 5, thiserror 1, reqwest 0.11 with json, hex 0.4, sha2 0.10, once\_cell 1, argon2 0.5, rand 0.8, rand\_core 0.6, chacha20poly1305 0.10, hkdf 0.12, hmac 0.12.



No additional crate is required for Phase 9.5. New crates, if needed for a later feature (for example, a Rust Excel parser, see Section 12), are added to the shared crate and both apps rebuild.



2.7 Cross-platform commitment

The Agent App follows the commitment in Section G-2 and N3 of the September 27 entry:



Windows first. macOS, Linux, mobile later. No Windows-only assumptions in the shared Rust layer.



The shared Rust command layer must not use Windows-only APIs. Paths use the directories crate, not hardcoded %APPDATA%. File dialogs use the Tauri dialog plugin, not Win32. The build target for Phase 9.5 is Windows; the code is written so that a future macOS or Linux build is a configuration change, not a rewrite.



2.8 The Phase 9.5 implementation contract

This document describes the Agent App as a product. It also contains substantial design for phases that come later: connector sending, bulk sending, the AI boundary layer, compliance enforcement, funded-phase message events, funded-phase access filtering, and the funded-phase sync engine.



This subsection exists so that no developer mistakes funded-phase design for Phase 9.5 work. It is the definitive statement of the Phase 9.5 scope.



Phase 9.5 builds exactly this:



The second Tauri binary, in the same repository, as a distinct application.



Its own bundle identifier, its own app data folder, its own settings.dat, its own local SQLCipher database file.



The shared schema and the shared migration sequence, run against the Agent App's own database.



The entry flow: Login, Unlock, Enroll.



Local login via the login command (the current development endpoint; see Section 12 preflight).



Local unlock via the unlock\_database command.



Enrollment import via the import\_enrollment\_package command.



Debtor CRUD: get\_debtors, get\_debtor, insert\_debtor, update\_debtor, delete\_debtor, search\_debtors, get\_debtor\_count.



Debt CRUD: get\_debts, insert\_debt, update\_debt, delete\_debt.



Communications CRUD and logging: get\_communications, insert\_communication, delete\_communication.



Action CRUD: get\_actions, insert\_action, update\_action, delete\_action.



Document operations: upload\_document, get\_documents, delete\_document, and the new open\_local\_file.



The debtor profile, including the photo (set\_debtor\_photo, get\_debtor\_photo).



The plan view (calendar), including the calendar\_events table (proposed; pending LOCAL-TABLES amendment) and the derived payment-due and follow-up views (get\_upcoming\_payments, get\_upcoming\_followups).



Guarantor and pledger local relations: get\_debtor\_relations, insert\_debtor\_relation, delete\_debtor\_relation.



The Agent UI, following the design vocabulary in Section 11.



The command registration boundary: the Agent App's own generate\_handler!, with admin-only commands excluded.



A static sync placeholder in the header. Not a functional sync subsystem.



Phase 9.5 does not build:



The sync engine. Phase 9.6.



Connector sending (single or bulk). Funded phase.



Provider credential storage and distribution. Funded phase (the local\_connectors table is likely empty in Phase 9.5; the Communication Tools screen shows an empty state).



The AI Copilot and the AI boundary layer. Funded phase.



The compliance enforcement layer. Funded phase.



Funded-phase message event types (MESSAGE\_SENT, MESSAGE\_STATUS\_CHANGED, and the per-step model). Funded phase.



Per-agent access-control filtering. Funded phase (D-3).



Automatic sending. Funded phase (A-6).



Any new cloud table or cloud schema change. Not in scope for any phase of the Agent App.



The rule this subsection establishes: a Phase 9.5 developer works from the "builds exactly this" list. Any other section of this document that describes a later-phase feature is specification context, not Phase 9.5 work. If a Phase 9.5 developer finds themselves implementing any item on the "does not build" list, that is scope creep and the work stops.



This subsection is a scope statement. It is not a redesign. It restates what Sections 1.3, 6.5, 7.6, 8.2, 8.3, 9.7, and 10.6 already establish, in one place, so the Phase 9.5 boundary is impossible to miss.



3\. ROLE AND BOUNDARY

3.1 The agent's role

The agent is a collection worker. The agent logs in with credentials the admin has provided. The agent sees the organization's debtor data (in the MVP, all of it; see D-3 and Section 7.5). The agent contacts debtors, logs communications, creates follow-up actions, records outcomes, and reviews documents.



3.2 What the agent does

The agent, in the Agent App:



Logs in with cloud credentials (JWT) - Section 4.2.



Unlocks the local SQLCipher database with the local password - Section 4.3.



Enrolls the device by importing the organization enrollment package the admin exported - Section 4.4.



Opens the Plan view (the calendar) to see what is due, what is overdue, and what is planned - Section 11.7.



Views the debtor list with local search and filter.



Opens a debtor profile - Section 11.6.



Views the debtor's contact details, debts, communications, actions, documents, photo, and any linked guarantors - Section 11.6.



Contacts the debtor through any connector the admin has enabled for a contact field the debtor has - Section 8 (funded phase).



Logs a communication (the existing COMM logs).



Creates a follow-up action.



Reviews and opens the debtor's documents - Section 11.6.



Uses the AI Copilot in the workflow mode - Section 9 (funded phase).



Selects a group of debtors and sends a shared text to all of them - Section 8.4 (funded phase).



Navigates directly from a calendar entry or a plan-view row into the debtor's profile - Section 11.7.



Sees the current sync state - Section 7.6 (a static placeholder in Phase 9.5).



3.3 What the agent never sees

The agent never sees:



Provider credentials. Not the token, not the API key, not the account SID. The credential is read from the local database by the connector code, used to make the provider call, and never surfaced to the UI.



Provider settings. The agent sees "Mocean is available" or "Resend is available", not the account number, the sending number, or the rate plan.



Admin functions. The Agent App's command registration (Section 6) does not include export\_enrollment\_package, enable\_sync, or any command whose purpose is administration.



Organization-wide analytics. The agent sees the debtors, not the aggregate counts, the usage summaries, or the billing.



Other users' details beyond what the debtor profile needs.



3.4 The boundary is the command registration

The boundary is enforced by which commands the Agent App registers (Section 6), not by which buttons the UI renders. A command that is not registered in the Agent App's generate\_handler! cannot be invoked from the Agent App's webview, regardless of what the UI or the devtools console tries.



3.5 The two communication contexts

Both apps touch the communication subsystem. Different contexts:



Client Dashboard (admin). Configures connectors. Monitors usage. Produces analytics. Feeds billing. The admin does not send messages to debtors from the Client Dashboard (Section A-2). If the admin also works as a collection agent, they install the Agent App and log in with the same user account.



Agent App (agent). Sends. Sees the tools the admin has enabled. Uses the provider credentials the admin configured, stored locally in the device's SQLCipher database (Section B-1). The agent never sees the credentials themselves.



3.6 The two audit-log contexts

Both apps have an audit log. The relationship between the two is deferred (Section N2 of the September 27 entry). The Agent App writes its own local audit\_log entries (the existing log\_audit function in db.rs). The Client Dashboard writes its own. Whether the two journals are shared, forwarded, or federated is an open item (Section 12).



3.7 The guarantor and pledger roles

A debtor record may also represent a guarantor or a pledger. A guarantor is a person liable for another debtor's obligation. A pledger is a person who pledged an asset as collateral. Both are the same shape as a debtor: name, surname, contacts, photo, documents. Both live in the debtors table and sync as DEBTOR\_CREATED / ENTITY\_UPDATED events.



The relationship is expressed by a role column on debtors (DEBTOR, GUARANTOR, PLEDGER) and a debtor\_relations linking table (Section 5.6). A guarantor may guarantee multiple debtors, and a debtor may have multiple guarantors.



In the UI, a guarantor appears both inside the debtor profile they guarantee (Section 11.6) and as a row in the debtor list, distinguished by a role badge. The role is chosen from a dropdown when a person record is created or edited.



Locality of relations in the MVP. The people sync; the relations do not. In Phase 9.5, debtor\_relations is a local table. Two replicas may hold the same person rows with different relationship graphs. This is deliberate, not a defect. Section 7.8 states the full rule and Section 12 names it as an open item for the funded phase.



3.8 Bulk actions

The agent may select a group of debtors and send the same text to all of them. The text is generic: no names, no surnames, no individual amounts. Every recipient receives the same body. This is the "send a reminder" workflow - "pay day is coming" and similar.



The flow is defined in Section 8.4. The compliance enforcement layer (Section 10) runs per recipient, not per batch. The connector call is per recipient, from the agent's device. Each result is reported individually. Partial failure is reported; the agent decides whether to retry.



3.9 Identity: sync origin versus human actor

The protocol distinguishes two identities, and the Agent App must not conflate them:



device\_id identifies the local synchronization origin. It is the local replica identifier of the Agent App's own database (SYNC-ARCHITECTURE.md Section 25.6.6). It labels a stream of events. It does not identify a person.



Actor identity (created\_by or equivalent) identifies the human user whose business action is recorded by an event. It is carried inside the encrypted event payload. It is informational and is not used for authentication, ordering, duplicate detection, or reconciliation.



Where human attribution is required, the entity's created\_by (or the equivalent actor field) carries the user identity. device\_id MUST NOT be interpreted as the human actor. This distinction is established in SYNC-ARCHITECTURE.md v1.3 and is restated here so that a Phase 9.6 implementation does not accidentally treat the wire device identity as the user identity.



4\. ENTRY FLOW

4.1 The three steps

The Agent App's first-run and every-run flow has three steps, three centered cards, one visual style. The steps are:



Login - cloud credentials, JWT.



Unlock - local SQLCipher password. First run: set + confirm. Later runs: enter.



Enroll - import the organization enrollment package.



The order is fixed. Step 1 is the only step that touches the network. Steps 2 and 3 are local only.



Source: the September 27 A-G entry, "The Agent App entry flow" section.



4.2 Step 1: Login

The Login screen uses the same shape as the Client Dashboard's Login page, with the purple primary button per the consistency rule (Section 11.1).



The flow, from auth.rs and main.rs:



The user enters email and password.



The client invokes the login command.



login POSTs to http://localhost:3000/api/auth/login (the current hardcoded URL; see Section 12, Phase 9.5 preflight - the production URL is a controlled configuration task).



On success, the response contains token, organization\_id, and the user data.



login writes auth\_token and organization\_id to settings.dat. If salt does not exist, login generates one and writes it.



The UI transitions to Step 2.



On failure, the UI shows an error banner. The user retries.



4.3 Step 2: Unlock

The Unlock screen decides between "set" and "enter" by invoking the database\_exists command. The rule, from the September 23 DECISIONS entry:



Database file absent → "Set Local Encryption Password" (with a Confirm field).



Database file present → "Enter Local Encryption Password" (no Confirm field).



The command database\_exists reads the file on disk. It does not read a salt, does not read a flag, does not read settings.dat. The presence of the database file is the authoritative signal.



On the "set" path: the user enters a password twice; the app derives the SQLCipher key from the password and the salt; unlock\_database opens the database and runs migrations; the connection is stored in AppState.db.



On the "enter" path: the user enters the password; unlock\_database derives the key, opens the database, verifies the password by reading sqlite\_master, and stores the connection in AppState.db.



If the password is wrong, unlock\_database returns an error and the connection is not stored. The UI shows the error banner and stays on Step 2.



Source: unlock\_database, is\_database\_unlocked, database\_exists in main.rs and db.rs; the September 23 DECISIONS entry (four fixes).



4.4 Step 3: Enroll

The Enroll screen is new. It does not exist in the Client Dashboard. It is the one screen the Agent App adds to the entry flow.



The flow:



The UI checks whether the organization key is already present. The check is the behavior of import\_enrollment\_package: it refuses with "Sync is already enabled for this organization" if a key is present. That refusal is the "already enrolled" signal.



If the key is absent, the UI shows a "Select enrollment package file" control and a passphrase field.



The user selects the package file the admin exported, and enters the passphrase.



The client invokes import\_enrollment\_package with the file path and passphrase.



import\_enrollment\_package reads the file, verifies the 63-byte header, derives the package key with Argon2id at the frozen parameters (131072 / 4 / 1, the values from the September 24 freeze), decrypts the payload with XChaCha20-Poly1305 using the header as AAD, parses the inner content (organization\_id, organization\_key), compares the package's organization\_id to the trusted id, refuses if a key already exists, and installs the key atomically.



On success, the package file is deleted and the key is installed.



On failure, the UI shows the specific error from import\_enrollment\_package: "Invalid package: bad magic bytes", "Organization mismatch", "Wrong passphrase or corrupted package", or "Sync is already enabled for this organization".



The UI transitions to the main application shell.



Source: import\_enrollment\_package and parse\_enrollment\_package in main.rs; Section 22.7 of SYNC-ARCHITECTURE.md; Phase D.4.4 in the September 25 DECISIONS entry.



4.5 The enroll step's dependency on the Client Dashboard

Step 3 requires the Client Dashboard to export an enrollment package. The Client Dashboard's export command is export\_enrollment\_package. It exists in the shared Rust command layer and is registered only in the Client Dashboard's generate\_handler! (Section 6.4).



The Client Dashboard currently exports via devtools (the D.3 test). It does not yet have a UI. The spec names this as an open item (Section 12): the Client Dashboard needs an export/import screen pair so that the admin can export and the agent can import without devtools.



4.6 After enrollment

Once all three steps are complete, the app enters the main shell (Section 11.4). The unlock state is durable in AppState.db for the life of the process. Logout clears settings.dat and drops the connection (the September 23 Rust logout connection-leak fix).



On the next launch, the flow repeats from Step 1 (Login). Step 2 is skipped if the user is already authenticated and the database is already unlocked within the same process. Step 3 is skipped if the key is already installed (the import\_enrollment\_package refusal path).



Enrollment completion does not imply synchronization completion. Entering the shell after enrollment is valid even with an empty or local-only database. The Agent App may enter the shell with no debtor data and no peers connected. Synchronization becomes active in Phase 9.6. A Phase 9.5 developer must not interpret "entered the shell" as "the device is synchronized."



4.7 What the entry flow does not do

It does not create the organization key. That is enable\_sync, which is admin-only (Section 6.4).



It does not export an enrollment package. That is export\_enrollment\_package, which is Client Dashboard only.



It does not configure connectors. That is Client Dashboard only.



It does not display the organization key or any provider credential.



It does not send any debtor data over the network. Step 1 sends credentials only; Steps 2 and 3 are local.



5\. LOCAL SCHEMA

5.1 The schema is shared, and LOCAL-TABLES.md is authoritative

The Agent App opens its own local database with the same schema the Client Dashboard uses. The schema is defined in src-tauri/src/db.rs. The current migration version is v4 (per the September 24 D.1 work).



The shared schema rule is settled in Section G-1 of the September 27 entry. This spec does not fork it.



Authority. LOCAL-TABLES.md v1.2 is the authoritative source for the local schema. The additions this document proposes (Section 5.4 through 5.6) are proposals until LOCAL-TABLES.md is amended to include them. The amendment goes through LOCAL-TABLES.md's own amendment process.



The workflow is:



text

AGENT-APP-SPEC (this document, proposals)

&#x20;       |

&#x20;       v

founder approval

&#x20;       |

&#x20;       v

LOCAL-TABLES.md amendment (authoritative)

&#x20;       |

&#x20;       v

Phase 9.5 migration implementation

This is the same discipline the recovery uses for every other authoritative document. It prevents two documents from partially defining the same database. See Section 12 (Correction C3).



5.2 Tables in scope for Phase 9.5

The tables the Agent App reads and writes in Phase 9.5 are the same tables the Client Dashboard reads and writes today, plus the additions this spec proposes (Section 5.4 through 5.6, pending LOCAL-TABLES.md amendment).



Per LOCAL-TABLES.md v1.2, the existing tables fall into four categories:



Category A - Debtor Operational Tables:



debtors, debts, documents, communications, actions, audit\_log.



Category B - Connector Operational Tables:



local\_connectors, local\_connector\_usage, connector\_sync\_state.



Category C - Cache / Mirror Tables:



local\_organization, local\_user, local\_templates.



Category D - Sync Operational Tables:



organization\_keys, sync\_events, sync\_state, sync\_delivery, sync\_peers, history\_records, pending\_events, entity\_field\_state.



The Category D tables are specified in LOCAL-TABLES.md v1.2 and SYNC-ARCHITECTURE.md v1.3. They are not yet migrated in db.rs. Migrating them is Phase 9.6 work (the sync engine), not Phase 9.5. Phase 9.5 uses only organization\_keys (already migrated at v4) and the Category A/B/C tables.



5.3 Its own database, its own device\_id

The Agent App has its own local database file (Section 2.3). This means the Agent App has its own local replica identifier (per SYNC-ARCHITECTURE.md Section 25.6.6). The wire device\_id is exactly this 16-byte identifier. It is generated when the database is first established and is not shared with the Client Dashboard's database.



(device\_id, sequence) is globally unique within the organization. Two local databases used by the same user have different device\_id values and independent sequence namespaces.



5.4 Proposed migration - debtor photo

A new migration block adds a nullable photo\_path column to the debtors table. It follows the same pattern as v3 and v4.



text

ALTER TABLE debtors ADD COLUMN photo\_path TEXT

Wrapped in the standard if current\_version < N block, with PRAGMA user\_version = N at the end.



This migration runs in both apps (shared schema). The Client Dashboard does not display the photo; it holds the column for when a future feature needs it.



The documents table is unchanged. The DocumentCategory::ProfilePhoto enum value remains in the code and is not used by the new UI (the photo is a column on debtors, not a document row). Cleanup of the unused enum value is deferred.



5.5 Proposed migration - calendar events

A new migration block creates the calendar\_events table. It holds the agent's manual calendar entries - birthdays, court dates, auctions, field visits, and other planned events that are not derived from a debt's due date or an action's due date.



text

CREATE TABLE IF NOT EXISTS calendar\_events (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   organization\_id TEXT NOT NULL,

&#x20;   title TEXT NOT NULL,

&#x20;   description TEXT,

&#x20;   start\_date DATETIME NOT NULL,

&#x20;   end\_date DATETIME NOT NULL,

&#x20;   all\_day BOOLEAN DEFAULT 0,

&#x20;   event\_type TEXT NOT NULL DEFAULT 'MANUAL',

&#x20;   debtor\_id TEXT,

&#x20;   data JSON DEFAULT '{}',

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (debtor\_id) REFERENCES debtors(id) ON DELETE SET NULL

)

Indexes:



text

CREATE INDEX IF NOT EXISTS idx\_calendar\_events\_dates ON calendar\_events(start\_date, end\_date)

CREATE INDEX IF NOT EXISTS idx\_calendar\_events\_debtor\_id ON calendar\_events(debtor\_id)

debtor\_id is nullable. A manual event may be linked to a debtor (a court date for a specific case, an auction for a specific collateral), or standalone (a personal reminder). When the linked debtor is deleted, the link is cleared, not the event.



event\_type in the MVP has one value: MANUAL. The PAYMENT\_DUE and FOLLOW\_UP events are not stored in this table; they are derived views over debts and actions (Section 11.7). This keeps the table small and prevents the "generated events" duplication problem the old cloud route had.



On organization\_id in a local table. The organization\_id column in calendar\_events is local organizational context metadata. Its value MUST be derived from the authenticated/trusted organization context (the same value used for the debtors table's organization\_id), and it MUST NOT be accepted as an arbitrary frontend-supplied value. It is used for local queries (filtering events to the current organization) and for consistency with the other local tables. It does not create a cloud tenancy boundary and does not imply that the value crosses the boundary.



This migration is local-only. It runs in both apps (shared schema). Calendar events are not synchronized in the MVP; they are local to the device where they were created.



5.6 Proposed migration - guarantors and pledgers

Two changes, in one migration block:



Add a role column to debtors:



text

ALTER TABLE debtors ADD COLUMN role TEXT NOT NULL DEFAULT 'DEBTOR'

Values: DEBTOR, GUARANTOR, PLEDGER. The default is DEBTOR, so existing rows are unaffected. New rows are set by the UI dropdown.



Add a debtor\_relations linking table:



text

CREATE TABLE IF NOT EXISTS debtor\_relations (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   organization\_id TEXT NOT NULL,

&#x20;   debtor\_id TEXT NOT NULL,

&#x20;   related\_debtor\_id TEXT NOT NULL,

&#x20;   relation\_type TEXT NOT NULL,

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (debtor\_id) REFERENCES debtors(id) ON DELETE CASCADE,

&#x20;   FOREIGN KEY (related\_debtor\_id) REFERENCES debtors(id) ON DELETE CASCADE

)

Indexes:



text

CREATE UNIQUE INDEX IF NOT EXISTS idx\_debtor\_relations\_unique

&#x20;   ON debtor\_relations(debtor\_id, related\_debtor\_id, relation\_type)

CREATE INDEX IF NOT EXISTS idx\_debtor\_relations\_debtor ON debtor\_relations(debtor\_id)

CREATE INDEX IF NOT EXISTS idx\_debtor\_relations\_related ON debtor\_relations(related\_debtor\_id)

relation\_type values: GUARANTOR, PLEDGER. Extensible later.



A relationship is directional in storage (debtor\_id is the primary debtor; related\_debtor\_id is the person related to them), but the query that answers "who guarantees this debtor" and "what does this guarantor guarantee" is the same table read from both columns.



Many-to-many both ways: one guarantor may guarantee multiple debtors; one debtor may have multiple guarantors. Both fall out of the linking table.



Locality of relations in the MVP. Guarantor and pledger records sync as DEBTOR\_CREATED / ENTITY\_UPDATED events, because they are rows in debtors. The relations themselves do not sync in the MVP. debtor\_relations is a local table. Two replicas may hold the same person rows with different relationship graphs. This is a conscious MVP limitation, not a defect. How relations sync in the funded phase is an open item (Section 12).



This migration runs in both apps (shared schema). The Client Dashboard does not display the guarantor panel in Phase 9.5; it holds the tables for when a future feature needs them.



5.7 Anticipated future tables

The following tables are anticipated but are not created in Phase 9.5. Each is named here as an open item (Section 12), not as a schema commitment.



A sync\_message\_events table if the funded-phase per-step message model (Section F-5) needs its own table beyond the sync\_events rows.



A local\_ai\_history table if the funded-phase AI recommendation log needs its own local storage.



A debtor\_relations sync representation if the funded phase chooses to sync the relations as their own events rather than embedding them in the parent debtor's data.



None of these is created now. The rule from the recovery documents is: do not pre-create empty tables for features that do not exist yet. Empty tables become misleading. The spec names the anticipated tables, and the actual schema is added when the task is defined.



5.8 Migration numbering

The migration numbers in Section 5.4 through 5.6 are written as "the next available number" rather than fixed v5/v6/v7, because the migration history is in the working tree and can move.



Before implementation, verify the current run\_migrations state. The developer must read src-tauri/src/db.rs and confirm the highest current PRAGMA user\_version value. The new blocks are appended after it, with numbers incrementing from there. The exact numbers in this document (v5, v6, v7) are based on the state at the time this spec was written (highest is v4). If the state has moved, the numbers move with it.



This is a process safeguard. It prevents a developer from blindly appending blocks at numbers that are already taken and then "fixing" the spec to match the code.



6\. SHARED COMMAND LAYER

6.1 The registration rule

The registration rule is stated in Section 2.2. Applied concretely:



The shared crate holds all functions.



The Client Dashboard's main.rs registers its own generate\_handler! list.



The Agent App's main.rs registers its own generate\_handler! list.



The two lists are not the same.



A command not registered in the Agent App's list is not callable from the Agent App.



6.2 The existing commands (34 registered today)

The current generate\_handler! block in src-tauri/src/main.rs registers 34 commands. Each is marked for the Agent App: USE, DO NOT USE.



Authentication and session:



login - USE.



get\_auth\_token - USE.



get\_salt - USE.



database\_exists - USE.



logout - USE.



get\_organization\_id - USE.



unlock\_database - USE.



is\_database\_unlocked - USE.



enable\_sync - DO NOT USE. See Section 6.4.



Debtor CRUD:



get\_debtors - USE.



get\_debtor - USE.



insert\_debtor - USE.



bulk\_insert\_debtors - DO NOT USE. Bulk insert is an administrative upload path. The Agent App adds debtors one at a time.



update\_debtor - USE.



delete\_debtor - USE.



search\_debtors - USE.



get\_debtor\_count - USE.



get\_dashboard\_stats - DO NOT USE. Stats are admin-side.



Debts:



get\_debts - USE.



insert\_debt - USE.



update\_debt - USE.



delete\_debt - USE.



Communications:



get\_communications - USE.



insert\_communication - USE.



delete\_communication - USE.



Actions:



get\_actions - USE.



insert\_action - USE.



update\_action - USE.



delete\_action - USE.



Documents:



upload\_document - USE.



get\_documents - USE.



delete\_document - USE.



Enrollment package:



export\_enrollment\_package - DO NOT USE. Admin-only. See Section 6.4.



import\_enrollment\_package - USE. The Agent App's one-time setup.



6.3 New commands the Agent App needs in Phase 9.5

Phase 9.5 is local-only. It does not have the sync engine (that is Phase 9.6). The new commands the Agent App needs in Phase 9.5 are:



Debtor photo:



set\_debtor\_photo(debtor\_id: String, file\_path: String) -> Result<(), String> - copies the selected file into the debtor's local files directory and updates the photo\_path column. Uses the existing get\_debtor\_files\_dir helper in db.rs.



get\_debtor\_photo(debtor\_id: String) -> Result<Option<String>, String> - returns the photo\_path value if set, else None.



File open:



open\_local\_file(file\_path: String) -> Result<(), String> - opens the given local file with the OS default application. Uses a Tauri plugin (the exact crate is an implementation choice; the capability is what the spec names).



Calendar events:



get\_calendar\_events(start\_date: String, end\_date: String) -> Result<Vec<CalendarEvent>, String> - returns the manual events in the date range.



insert\_calendar\_event(input: CalendarEventInput) -> Result<CalendarEvent, String> - creates a manual event.



update\_calendar\_event(id: String, input: CalendarEventInput) -> Result<CalendarEvent, String> - updates a manual event.



delete\_calendar\_event(id: String) -> Result<bool, String> - deletes a manual event.



Derived views (read-only queries):



get\_upcoming\_payments(start\_date: String, end\_date: String) -> Result<Vec<UpcomingPayment>, String> - reads debts joined with debtors, filters by due\_date in range, excludes PAID and CANCELLED, returns the debtor name and the amount.



get\_upcoming\_followups(start\_date: String, end\_date: String) -> Result<Vec<UpcomingFollowup>, String> - reads actions joined with debtors, filters by due\_date in range and status PENDING or IN\_PROGRESS.



Guarantor relations:



get\_debtor\_relations(debtor\_id: String) -> Result<Vec<DebtorRelation>, String> - returns the relations for a given debtor.



insert\_debtor\_relation(input: DebtorRelationInput) -> Result<DebtorRelation, String> - creates a relation.



delete\_debtor\_relation(id: String) -> Result<bool, String> - removes a relation.



Each new command follows the same pattern as the existing commands: #\[command], arguments in camelCase from the frontend, State<AppState> for database access, AppHandle where the path is needed.



6.4 The commands the Agent App must not have

enable\_sync - DO NOT REGISTER in the Agent App.



enable\_sync creates the organization key. Looking at the code:



text

let mut key\_material = \[0u8; 32];

rand::rngs::OsRng.fill\_bytes(\&mut key\_material);

conn.execute("INSERT INTO organization\_keys (id, organization\_id, key\_material, created\_at) ...")

It generates a fresh random 32-byte key on this device. It is the key creation operation, not the key distribution operation. It runs once per database, ever.



The organization key is the same value on every device (SYNC-ARCHITECTURE.md Section 6.5). It is created once on the admin's machine, and it is distributed to the other devices via the enrollment package.



If the Agent App ran enable\_sync, it would generate a different key. Two different keys. The agent's device could not decrypt the admin's sync traffic, the handshake would fail, and worse - import\_enrollment\_package refuses if a key already exists ("Sync is already enabled for this organization"), so the agent could then never import the correct key without wiping the database.



enable\_sync is not "hidden and harmless". It is an active hazard. It stays Client Dashboard only.



export\_enrollment\_package - DO NOT REGISTER in the Agent App.



The export produces a package that contains the organization key. Giving an agent the ability to export the organization key is granting them the ability to enroll new devices in the organization. That is an administrative capability. It stays Client Dashboard only.



get\_dashboard\_stats - DO NOT REGISTER in the Agent App.



This command returns total\_debtors, total\_debt, total\_actions for the whole organization. It is the Client Dashboard's home page. The Agent App does not have a home page with organization-wide aggregates.



bulk\_insert\_debtors - DO NOT REGISTER in the Agent App.



This is a bulk upload path. The Agent App adds debtors one at a time (insert\_debtor). Bulk upload is an administrative function on the Client Dashboard.



6.5 Commands the Agent App will gain in Phase 9.6 and beyond

Phase 9.6 adds the sync engine. The sync engine's commands (start sync, stop sync, read sync state) are not in Phase 9.5. They will be named in the Phase 9.6 spec.



The funded-phase connector and AI commands (send SMS, send email, initiate voice call, make an AI call, send bulk SMS) are not in Phase 9.5. They are named conceptually in Sections 8, 9, and 10 of this document. They are not written in Phase 9.5.



6.6 The rule for adding a command later

When a feature needs a new Rust command:



Write the function once in the shared Rust crate, in the appropriate module (db.rs, auth.rs, or a new module such as sync.rs, connectors.rs, compliance.rs).



Register it in the binary that needs it. If both apps need it, register it in both. If only one, register it in one.



Add the UI in that binary.



The other binary is untouched. No rebuild of the other app's UI. No change to the other app's generate\_handler!.



The main.rs of each binary contains application wiring and the generate\_handler! list, not business logic. This keeps main.rs small as features are added.



This is the "LEGO" property. It is what the September 27 entry, Section G-2, means by "add, modify, delete, add some functions without heavy re-building."



7\. SYNC PARTICIPATION

7.1 Topology

The Agent App participates in the synchronization topology defined by SYNC-ARCHITECTURE.md. Operationally, the Client Dashboard is the hub in the MVP organization model (SYNC-ARCHITECTURE.md Section 2; MULTI-USER-CONCEPT.md Section 4), and the Agent App is a spoke. The hub is the designated synchronization peer for the spokes in the MVP topology.



The hub is a topology role, not a data-model identity. The protocol does not treat the hub as permanently special. A peer is a peer.



This specification does not redefine transport. Synchronization transport uses the protocol's permitted paths as defined by the frozen sync architecture: a direct peer-to-peer connection is preferred when the network allows it, and the encrypted relay is the fallback when a direct connection is not possible (SYNC-ARCHITECTURE.md Section 19 and Section 20). The Control Plane assists discovery, signaling, and relay coordination. It is not a participant in the debtor-data protocol. The Agent App does not introduce, restrict, or redefine the transport topology. The phrase "hub-and-spoke" describes the peer relationship, not the transport path.



7.2 The protocol

The Agent App participates in the same protocol the Client Dashboard does. Same event types, same wire format, same handshake, same session keys. The protocol is defined in SYNC-ARCHITECTURE.md v1.3. This spec does not repeat it.



The MVP event set is four types (SYNC-ARCHITECTURE.md Section 22.13.3):



DEBTOR\_CREATED



ENTITY\_UPDATED



ACTION\_CREATED



COMMUNICATION\_LOGGED



The Agent App produces and consumes the same four.



7.3 The organization key

The Agent App holds the organization key, installed by import\_enrollment\_package (Section 4.4). The key is stored inside the SQLCipher database, in the organization\_keys table (the single-row table from migration v4). The key is read by the sync engine after the database is unlocked.



The key is never transmitted to the Control Plane. It is never displayed in the UI.



7.4 The device identity

The Agent App's wire device\_id is the local replica identifier of the Agent App's own database (SYNC-ARCHITECTURE.md Section 25.6.6). It is generated when the Agent App's database is first established. It is not shared with the Client Dashboard's database.



device\_id identifies the synchronization origin, not the human actor. See Section 3.9.



7.5 The outbound message path (D-3 seam)

The outbound message path is specified as two steps:



text

candidates = events not yet delivered to peer

filtered   = filter(candidates, peer)

message    = compose(filtered)

In the MVP, filter is the identity function. It returns everything. One line. No behavior change. No schema change. No protocol change.



In production, filter consults the assignment state and drops events for debtors not assigned to the receiving peer. The sync engine's outbound path is unchanged; only the filter function and the assignment data behind it are added.



This seam is a specification line, not an implementation change. Its cost today is zero. It prevents a redesign when filtering is added later.



Source: D-3 of the September 27 entry.



The limitation, restated plainly: filtering governs future events only. When an agent is unassigned from a debtor, the debtor's historical events are already on that agent's device. Filtering stops new events from arriving; it cannot recall old ones. This is the same property as the multi-user model's revocation caveat.



7.6 The sync indicator

The Agent App shows a sync indicator. The visible states, per GORKA-MVP-SCOPE.md Section 5.2, are: synced / pending / offline. The mapping from the protocol states to the UI is defined in SYNC-ARCHITECTURE.md Section 26.5.



The indicator is per-peer and summarized for the whole device. The exact UI treatment (colors, icons, labels) is defined by the frontend implementation, not by this document. The design vocabulary for colors and shapes is in Section 11.



Phase boundary. Phase 9.5 does not have the sync engine. In Phase 9.5, the sync indicator is a static placeholder - a small display showing "Sync not yet enabled" or an equivalent, non-functional state. It MUST NOT be implemented as a fake sync subsystem that polls, displays counts, or otherwise behaves as if sync were active. In Phase 9.6, the placeholder becomes the functional indicator. A developer must not build any part of Phase 9.6 merely because the UI specification names a sync indicator.



7.7 Sync cadence

Synchronization is event-driven. A state change or event originates on one device and is pushed to the peer within seconds when both peers are online. There is no user-facing "Sync Now" button in the MVP; the on-originate trigger provides freshness.



Events originated while a peer is offline remain in sync\_events and deliver on reconnect (SYNC-ARCHITECTURE.md Section 17 and Section 18.6).



The full cadence is a session policy defined in the Phase 9.6 implementation. This spec records:



Primary trigger: on-originate push.



Secondary trigger: on-launch / on-unlock catch-up.



Safety net: a periodic poll (interval an implementation value, not architecture).



No user-facing "Sync Now" button.



No sync\_now command in the MVP.



Source: SYNC-ARCHITECTURE.md Section 8.2 (session triggers), Section 17 (offline queue), Section 18.6 (recovery after interruption), Section 26.8 (retry policy is implementation).



7.8 How debts and due dates reach the agent (escalation resolved)

The plan view (Section 11.7) depends on the agent's device having the debts and their due dates. The frozen documents are in tension on whether debt data syncs in the MVP:



GORKA-MVP-SCOPE.md Section 8.4 lists debts as synchronized: "carried by DEBTOR\_CREATED and DEBTOR\_UPDATED events on the parent debtor, and by the debt's own change record."



SYNC-ARCHITECTURE.md Section 25.9.2 states that entity types 0x02 (debt) and 0x05 (document) are reserved for the funded phase and MUST NOT appear in an accepted MVP sync event, and that debt and document data "remains local to the device in the MVP".



These two statements can be reconciled, but the reconciliation is not written down in the frozen documents. This is a specification gap.



Founder decision (September 27, 2026): debt data travels inside the parent debtor's data JSON. Debts do not get their own entity type on the wire.



The reconciliation, stated precisely:



Debt remains local as a standalone entity type. It does not appear as a debt entity on the wire. Entity type 0x02 (debt) is not produced or accepted in MVP sync events, consistent with SYNC-ARCHITECTURE.md Section 25.9.2.



In the MVP, debt information that is intentionally part of the synchronized debtor representation may be carried inside the debtor's data\_json field. The DEBTOR\_CREATED event's data\_json payload (type code 0x2005) and the ENTITY\_UPDATED event's data\_json change record (per Section 25.13.1) are the transport.



Two protocol-level rules that follow from this decision:



Rule 1 - Receipt. When the receiving device accepts a DEBTOR\_CREATED or ENTITY\_UPDATED event whose data\_json contains debt data, the receiving device updates its local debts table to reflect the debt data. The local debts table remains the query surface. The plan view (Section 11.7) queries debts directly; it does not parse data\_json at render time. Without this rule, the admin's uploaded debts would arrive in data\_json but never be visible to the agent's plan view.



Rule 2 - Origination. When the agent adds a debt locally (via insert\_debt), the local transaction must also update the parent debtor's data\_json field to reflect the new debt, and append the corresponding ENTITY\_UPDATED event to sync\_events. Without this rule, a debt created locally by the agent would never leave the device.



The exact subset of debt fields carried in data\_json is defined in the LOCAL-TABLES.md and SYNC-ARCHITECTURE.md amendments (Section 12, Correction C2). Candidates: id, amount, currency, status, due\_date, description. The data sub-field of a debt is optional in the wire representation.



What this decision does not require:



No cryptography change. The message encryption is the same regardless of what the payload contains.



No wire-format change. data\_json already exists in DEBTOR\_CREATED (type code 0x2005) and is already in the ENTITY\_UPDATED field table (Section 25.13.1).



No new event type. The four MVP types are unchanged.



Conscious MVP limitation: sync granularity. The data field reconciles as a single unit. Two devices changing two different debts inside the same debtor's data at the same time produce one winner for the whole data value and one losing value in history\_records. This is the same rule the protocol already applies to every field. It is not a defect; it is a deliberate MVP granularity choice.



The concrete consequence: if Device A changes Debt 1's due date and Device B changes Debt 2's status at the same time, the protocol picks one whole data value. The other device's change is recorded in history\_records as a losing value, not silently lost, but it does not win the reconciliation.



Six months from now, someone may ask "why did changing Debt 1 overwrite Debt 2?" The answer will be: because MVP synchronization granularity for debt data is the debtor's data field, not the individual debt. This is the documented limitation. The funded phase may introduce per-debt entity types (entity type 0x02) if finer granularity is needed.



Size limit. data\_json is capped at 1 MiB after canonical serialization (SYNC-ARCHITECTURE.md Section 25.13.2). A debtor with many debts grows that field. This is the practical ceiling on how much debt data can travel inside a single debtor's data. Debtors with unusually large numbers of debts may approach this ceiling; the funded phase may need per-debt entity types for such cases.



Amendment status. The resolution requires a small amendment to SYNC-ARCHITECTURE.md Section 25.9.2 to make the debt-in-data\_json interpretation explicit in the frozen document. It also requires the addition of the two protocol-level rules above (Rules 1 and 2) to the sync architecture, so the receiving and originating behaviors are part of the frozen specification rather than only this Agent App spec.



This document names the amendment as required (Section 12, Correction C2). The amendment itself is a separate task. It is not done here.



8\. COMMUNICATION CENTER

8.1 Where sending happens

Sending happens in the Agent App, on the agent's device, directly to the provider. The admin configures connectors on the Client Dashboard; the agent uses them. This is Section A-1 and A-3 of the September 27 entry.



The provider call does not go through GORKA's cloud. GORKA is not on the path. The message content never reaches GORKA's cloud.



8.2 The connector model

The connectors available to the agent are the connectors the admin has enabled. The admin's enablement is stored locally in the local\_connectors table (Category B, LOCAL-TABLES.md v1.2). The provider credentials are stored in the same table, encrypted by the SQLCipher database key.



The credential storage is the answer to open item A-2a. The credentials live in the local SQLCipher database, encrypted with the local password. They never reach the cloud. They are never displayed in the UI.



The result-shape and status vocabulary carry forward conceptually from the old Electron-era providers (reference only, per the September 27 recovery notes; not ported):



Result: { success, messageId?, status, provider, error? }.



Status: PENDING | SENT | FAILED | DELIVERED.



The register-by-name pattern from the old ProviderRegistry is the model: a fixed set of provider names, each resolved to an implementation. This matches Section C-5 of the September 27 entry (AI providers pluggable, same as SMS/email providers) and N1 (Connection Center as a general integration mechanism).



This section specifies the concept. The implementation of the connector layer is funded-phase work, not Phase 9.5.



Phase boundary. In Phase 9.5, the Communication Tools screen (Section 11.8) is a read-only placeholder. It reads the local local\_connectors table and displays what is there. In Phase 9.5, the table is likely empty (no mechanism exists yet to populate it from the admin's configuration). The screen shows an empty state. No connector sending is implemented. The mechanism by which the admin's connector configuration and credentials reach the agent device is not part of Phase 9.5; it belongs to Phase 9.6 or the funded phase (open item, Section 12).



A Phase 9.5 developer must not invent a mechanism to populate local\_connectors from the cloud or from the admin device. If the table is empty, the screen is empty.



8.3 The single-recipient send flow

From a debtor profile (Section 11.6), the agent sees one button per available connector. A connector's button appears if and only if both conditions hold:



The admin has enabled that connector (local\_connectors.status is connected).



The debtor has the contact field the connector needs.



The contact-field dependency:



Twilio voice, Twilio SMS, Mocean SMS, WhatsApp - need a phone number.



Resend email - needs an email address.



The rule is deterministic. No per-debtor overrides, no manual hiding. When the agent opens the debtor, the page renders itself.



Clicking a connector's button opens the send modal. The modal shows:



The connector name (for example, "Mocean SMS").



The destination (the debtor's phone or email, pre-filled, editable).



The body.



A template picker (parameterized templates from local\_templates, per Architectural Law Section 12).



A single preview of the exact message to be sent.



Send and Cancel.



On send:



The compliance enforcement layer (Section 10) runs for this recipient.



If the compliance layer blocks, the modal shows the reason and does not send.



If the compliance layer allows, the connector reads its credential from local\_connectors, makes the provider call, and records the result.



The result is stored as a new communications row (type = the channel; direction = OUTBOUND; content = the message body; created\_by = the agent's user id).



In the funded phase, this also produces a MESSAGE\_SENT event (Section F-4).



In Phase 9.5, there is no connector layer. The send flow is specified here for the funded phase. In Phase 9.5, the agent can log a communication manually (the existing insert\_communication command) but cannot send through a provider.



8.4 The bulk-action flow

The agent may select a group of debtors from the debtor list or the plan view and send the same text to all of them. The text is generic: no names, no surnames, no individual amounts. Every recipient receives the same body.



The flow:



The agent selects debtors (checkboxes in the list, or a select-all across the current filter).



The agent picks the channel (whichever connectors are available for the selected debtors).



The agent types the body, or picks a non-personalized template.



A single preview of the exact text is shown. No per-recipient preview.



The agent confirms. The app iterates:



For each recipient, run the compliance enforcement layer (Section 10) against the recipient's local state.



If allowed, make the provider call.



Record the result.



The app shows a per-recipient result list: sent, failed, blocked (with reason).



If any sends failed, the app shows a "Retry failed" button. The agent decides whether to retry. No auto-retry.



The reason for per-recipient compliance checks, even with a generic body: quiet hours, contact limits, and opt-out status are per-debtor. A message that is allowed for one recipient may be blocked for another.



8.5 What the agent never sees in the Communication Center

The provider credentials.



The provider account details.



The provider's pricing or rate plan.



Other agents' sent messages unless the agent's local replica holds them (the MVP has full replica; the funded phase narrows this with D-3).



Any admin-side view: usage totals, billing, connector health dashboards.



8.6 Failure handling

Per-message failure is recorded locally. The communication row stores the provider's error message (if any) in its data JSON. The agent sees the failure in the send modal or in the bulk-action result list.



Retry policy:



Single send. The agent can click Send again. The app does not auto-retry.



Bulk send. The app reports per-recipient results. The agent clicks "Retry failed" to retry only the failed recipients. The app does not auto-retry.



This matches the founder's decision on partial failure (Section 3.8).



8.7 Funded-phase status changes

The MVP model is one event per message. The funded phase adds per-step events: MESSAGE\_QUEUED, MESSAGE\_SENT, MESSAGE\_DELIVERED, MESSAGE\_OPENED, MESSAGE\_FAILED (Section F-5). Each is its own event type under the reserved 0x0100 range (SYNC-ARCHITECTURE.md Section 22.13.3).



This is additive. It does not change the MVP event set. It does not require a redesign.



9\. AI COPILOT

9.1 Where AI calls happen

The AI call goes from the agent's device directly to the AI provider. Not through the hub, not through GORKA cloud. No approval by the admin. The agent benefits without a gatekeeper. This is Section C-1 of the September 27 entry.



The provider credential is stored locally, in the same SQLCipher database as the other connector credentials.



9.2 Only metadata leaves the device

Only metadata leaves the device for the AI call. The old Electron context object (name, email, phone, amount, full history) is out. Section C-2.



The AI must help without receiving debtor-identifying data.



9.3 The AI boundary layer

The AI boundary layer runs on the agent's device, between the agent and the AI provider. It inspects what is about to be sent and redacts or blocks debtor-identifying content. Its rulebook comes from legal review (open item C-1), not from engineering.



The DLP shape chosen is Shape 1: redact before sending. The boundary layer scans the agent's free-text, finds names that match a debtor in the local database, replaces them with a placeholder, and sends the redacted text. The AI receives the question without the debtor's identity and answers about the metadata. The agent sees a natural reply. Names that do not match a local debtor pass through harmlessly. Option B for the indicator: a small, unobtrusive visible indicator that a field was redacted, not silent.



9.4 The classification of fields

The classification below is derived from the reconnaissance of the old context.service.ts (reference only, not ported). It shows exactly what the old context object sent and what the new AI boundary layer must strip.



This table is a starting point, not a final privacy classification. Fields marked "proposed for transmission" are proposed by this specification and are subject to the funded-phase legal and privacy review (open item C-1). Until that review concludes, no field is categorically "safe to transmit."



Field	Identifies a debtor?	AI boundary layer disposition

debtor.name	Yes	strip

debtor.email	Yes	strip

debtor.phone	Yes	strip

debtor.id	Yes	strip

debtor.debtAmount (exact)	Yes (unique per debtor)	strip; bucket to a range if the review decides a range is needed

debtor.daysOverdue	Proposed for transmission	subject to review

debtor.debtOrigin	Proposed for transmission as a category only	subject to review

communicationHistory (per-event dates and channels)	Partly; patterns can fingerprint a debtor	proposed: reduce to counts and rates only, subject to review

paymentHistory (per-event dates and amounts)	Yes	strip; proposed: reduce to aggregates, subject to review

contactAttempts (counts, responseRate)	Proposed for transmission	subject to review

indicators (paymentReliability, engagementLevel, communicationPreference, previousPromises, promisesKept)	Proposed for transmission	subject to review

The left-hand column is what the AI must never receive. The middle column describes the reason. The right-hand column is the disposition, and only the "strip" entries are final. Every "subject to review" entry is a proposal, not a decision.



9.5 Multi-provider from the start

The AI provider is pluggable. Gemini for development and early production; ChatGPT, DeepSeek, Claude, and others later. The architecture treats AI providers as pluggable, same as SMS/email providers. Section C-5.



9.6 The AI provider is not the message provider

The message provider necessarily receives the recipient address and the message content - that is what it is for. The AI provider must never receive debtor data. The DLP boundary applies to the AI, not to the message provider. This distinction is explicit in the spec. Section C-6.



9.7 The MVP scope

The MVP AI Copilot does one prompt, one recommendation, one draft (GORKA-MVP-SCOPE.md Section 6.4). Multi-channel drafting, outcome tracking, and structured recommendation across many cases are funded-phase items.



The AI Copilot is not part of Phase 9.5. Phase 9.5 has no AI provider calls. The AI boundary layer is specified here for the funded phase.



9.8 Open items

Four open items remain, named in Section 12:



C-1: the sensitive-field list; a legal input, not a design choice.



C-3a: redaction applied to pasted documents and long text.



C-4: whether the AI receives free-text at all, or only a structured metadata blob.



C-5: how AI provider credentials reach the agent device; same shape as B-5 (rotated credential distribution).



10\. COMPLIANCE ENFORCEMENT

10.1 Cloud declares, local enforces

The cloud holds the rule. The device enforces the rule. The cloud never needs debtor data to enforce a rule, because enforcement is always local. This is Section E-1 of the September 27 entry.



The rule types (the cloud declares them; the device applies them):



Quiet hours (no contact outside a window).



Contact limits (maximum contacts per period per debtor).



Opt-out handling (a debtor who has opted out must not be contacted).



Disclosure text (a required footer or identifier on outbound messages).



10.2 GORKA's scope

GORKA provides the mechanism and the safeguards. GORKA provides the tooling for the client to declare, store, and apply local rules.



This specification does not determine or guarantee the client's legal compliance. The client remains responsible for configuring and using the compliance rules applicable to its operations. Legal wording for customer-facing material is reviewed separately.



10.3 GORKA provides the scaffolding

The Client Dashboard includes a "Local compliance rules" section with fields for quiet hours, contact limits, opt-out handling, and disclosure text. Pre-populated with whatever GORKA knows about common jurisdictions; empty where GORKA does not know. The client fills in their jurisdiction's requirements. Section E-3.



10.4 The compliance enforcement layer

The compliance enforcement layer runs on the sending device, before the provider call. It reads parameters from cloud (the rules) and state from local (the actual debtor, the actual time, the actual history).



The layer runs once per message, not once per batch. This is why the bulk-action flow (Section 8.4) checks per recipient.



10.5 What "block" means per rule type

The founder's decision (Section E-16):



Quiet hours: schedule for the next permitted window. The message is not sent now; it is queued for the next permitted window (if the agent has chosen to schedule; otherwise, the modal shows the next permitted window and the agent decides).



Contact limit: block entirely. The message is not sent.



Opt-out: block entirely, no override. The message is not sent. The opt-out status is a local fact; no cloud lookup is needed.



10.6 The MVP scope

The compliance enforcement layer is not part of Phase 9.5. Phase 9.5 has no sending. The compliance layer is specified here for the funded phase.



10.7 Open item

E-15: the compliance layer needs its own spec section when the funded phase begins. This document names it; the funded phase specifies it.



11\. DESIGN SECTION

11.1 The consistency rule

The primary button color is purple #7C3AED, everywhere, including the entry flow. Red #DC2626 is reserved for the logo, error banners, danger buttons, and destructive confirmation. It is not used for primary actions.



11.2 The design vocabulary

Extracted from the Client Dashboard on September 27, 2026. The Agent App uses the same vocabulary. Do not re-invent.



Color palette:



Accent (primary): #7C3AED



Accent tint: #F4F0FF



Accent tint (icons): #f3e8ff



Brand red: #DC2626 (logo, danger)



Danger: #dc2626



Danger tint: #fef2f2 / #fecaca



Success: #16a34a / #dcfce7



Warning: #ea580c / #ffedd5



Text strong: #111827



Text normal: #374151



Text muted: #6b7280



Text dim: #9ca3af



Text sidebar: #4A4A4A



Border default: #e5e7eb



Border sidebar: #E3E3E3



Background main: #f9fafb



Background sidebar: #FAFAFA



Background card: #FFFFFF



Typography:



Font: system-ui, 'Segoe UI', Roboto, sans-serif



Body: 13-14px



Label: 13px, weight 500



Nav: 16px, weight 400 / 500 active



Page title: 28px, weight bold



Card title: 14px, weight 500, muted



Card value: 24px, weight bold



Section heading: 18px, weight 600



Logo: 24-26px, weight bold, uppercase



Spacing:



Modal padding: 24px



Card padding: 20px



Content padding: 24px



Grid gap: 12-16px



Field spacing: 12px



Shape:



Card radius: 12px



Button/input radius: 8px



Nav item radius: 6px



Icon container radius: 12px



Sidebar width: 240px



Header height: 73px



Nav item height: 36px



Modal width: 440px (max 90vw)



Entry card width: 400px



Shadow:



Card default: 0 1px 3px rgba(0,0,0,0.05)



Card hover: 0 10px 25px rgba(0,0,0,0.08)



Overlay: rgba(0,0,0,0.4)



Icons:



Library: lucide-react



Sidebar: 16px



Header: 18px, strokeWidth 1.7



Card icon: 24px



Close icon: 20px



Components:



card: white, 12px radius, hover lifts 2px + accent border



kpi-card: icon block 48x48 tinted background, title/value/subtitle, clickable



btnPrimary: accent background, white text, 8px radius, 14px font



btnGhost: white background, default border, #374151 text, 8px radius



input: 8px radius, #e5e7eb border, 14px font, padding 8x12



label: 13px, weight 500, #374151



error-banner: danger tint, danger border, danger text, 8px radius



modal: overlay + white box, close top-right, footer ghost Cancel + primary Save



spinner: border trick, top border accent, 40px



avatar: 32px circle, accent background, initials, white text



Layout:



Shell: 240px fixed sidebar + flex column (fixed-height header + scrollable main)



Page: maxWidth 1200px, margin 0 auto, padding 24px



Header row: title + subtitle left, actions/avatar right



KPI grid: repeat(auto-fit, minmax(200px, 1fr))



Modal form: grid gap 12px



Modal footer: flex, gap 8px, justify-content flex-end



11.3 Inconsistencies not carried forward

The reconnaissance found six inconsistencies in the Client Dashboard. The Agent App does not repeat them:



Three different primary button colors across three surfaces (Login red, Unlock blue, workspace purple). Resolved by the consistency rule: purple #7C3AED everywhere.



Two radius conventions (6px on Login, 8px elsewhere). Resolved: 8px.



Two logo implementations. The Agent App uses one.



Two header implementations. The Agent App uses one.



Sidebar.css is orphaned. The Agent App uses one styling approach.



The Login subtitle says "Supervisor Dashboard" (stale). The Agent App's login says "Agent App" and nothing else.



11.4 The main shell

The Agent App's shell follows the Client Dashboard's layout: a 240px fixed sidebar on the left, a fixed-height header at the top, and a scrollable main content area. The sidebar contains the navigation items. The header contains the page title, the sync indicator (Section 7.6 - a static placeholder in Phase 9.5), and the user's avatar / logout control.



11.5 Sidebar navigation

The sidebar items, in order:



Today (or Plan) - the calendar / plan view. Section 11.7.



Debtors - the debtor list. Section 11.6.



Communication Tools - the list of connectors the admin has enabled for this agent. Section 11.8.



Actions - the agent's own actions. Filterable by status. (Reads the local actions table.)



Documents - a cross-debtor document browser. (Reads the local documents table.) Optional; if omitted in Phase 9.5, documents are reached from the debtor profile only.



Copilot - the AI workflow. Section 9.



Settings - local app settings (sync indicator detail, local password change, about).



The exact labels and the exact set are subject to UI review. The spec names the entries that must exist; the developer may adjust wording.



11.6 The debtor profile

The debtor profile is the core screen of the Agent App. It replaces the old reader-only DebtorDetail from the Electron era. It is what makes the Agent App a collection tool, not a messaging app.



The page is laid out as follows.



Header card (top):



Left: the debtor's photo (if set) or a placeholder avatar (initials, accent background). A "Change photo" control on hover or as a small button. Photo is set via set\_debtor\_photo (Section 6.3).



Center-left: name, surname. A role badge if the person's role is not DEBTOR (Section 3.7): GUARANTOR, PLEDGER.



Center: contact details in a compact row - phone, email. Each field is clickable: clicking the phone opens the send-modal for a phone connector; clicking the email opens the send-modal for the email connector.



Right: the debtor's overall state (active / has overdue / paid).



Debt card:



A list of the debtor's debts: amount, currency, status, due date, description.



Actions: add debt, edit debt, delete debt. Uses the existing insert\_debt, update\_debt, delete\_debt commands.



The due dates here feed the plan view (Section 11.7).



Communication buttons row:



One button per available connector (Section 8.3). A connector's button appears if (a) the admin enabled it and (b) the debtor has the required contact field.



Clicking a button opens the send modal for that connector.



This is inline. The agent does not leave the debtor profile to send.



Communications log card:



A list of past communications: type, direction, content preview, timestamp, who logged it.



Add button (manual log, using the existing insert\_communication).



Delete per row (with confirmation).



In the funded phase, sent messages appear here automatically.



Actions card:



A list of the debtor's actions: type, status, assigned\_to, due date, description.



Add, edit, delete. Uses the existing commands.



The due dates here feed the plan view (Section 11.7).



Documents card:



A list of the debtor's documents: file\_name, category, description, uploaded\_by, created\_at.



Upload: uses the existing upload\_document.



Open: uses open\_local\_file (Section 6.3). The file opens in the OS default application.



Delete: uses the existing delete\_document (with confirmation).



Grouping by category is optional; a simple sorted list is acceptable for the MVP.



Guarantors / pledgers card:



A list of persons related to this debtor: their name, role badge (GUARANTOR or PLEDGER), contact summary.



Add: opens a modal to either link an existing person or create a new person (with role GUARANTOR or PLEDGER).



Clicking a person's row opens that person's own debtor profile - the same screen. A guarantor is a full profile, not a sub-panel. This gives the guarantor one home.



Remove: unlinks the relation. The person record itself is not deleted.



AI Copilot panel (funded phase):



A collapsible panel, at the side or bottom. The agent asks the copilot a question, the boundary layer (Section 9) strips debtor-identifying content, the provider call happens, the answer shows.



Not present in Phase 9.5.



11.7 The plan view (calendar)

The plan view is a first-class screen in the Agent App. It is the agent's daily planning surface. It combines three kinds of data:



Manual events from the new calendar\_events table (Section 5.5). These are personal reminders the agent has entered.



Payments due derived from the local debts table, filtered by due\_date.



Follow-ups due derived from the local actions table, filtered by due\_date and status.



The layout:



A calendar view (month / week / day / list - the same view modes the Client Dashboard's FullCalendar uses). Each day cell shows a compact count of what is on that day, colored by kind:



Manual events: blue.



Payments due: red.



Follow-ups due: amber.



Selecting a day opens a day panel (below the calendar, or as a modal):



Manual events first: title, description, linked debtor (if any), edit / delete controls.



Payments due: one row per debtor - surname, name, amount, debt status, last communication, next action.



Follow-ups due: one row per action - debtor name, action type, action status, description.



Navigation from the plan view:



Every row that names a debtor is clickable. Clicking it opens the debtor profile directly (Section 11.6). No need to leave the calendar and search the debtor list.



Bulk-select:



Rows in a day panel can be multi-selected. A "Send reminder to all selected" button feeds the bulk-action flow (Section 8.4).



Period summary:



Selecting a period (this week, this month, a custom range) opens a summary panel above the calendar:



Number of payments due in the period, total amount, number overdue.



Number of follow-ups due in the period.



Number of manual events in the period.



Creating a manual event:



Clicking an empty day (or "Add event") opens a modal:



Title (required).



Description.



Start date / end date (default to the clicked day, or now + 1 hour).



All-day checkbox.



Link to a debtor: a search-and-pick control. Optional. Nullable debtor\_id in the table.



Save.



What the plan view does not do:



It does not store PAYMENT\_DUE or FOLLOW\_UP events. Those are derived views. The calendar\_events table holds only MANUAL rows. This avoids the duplication problem the old cloud route had (its generate route created stored events for every debtor, requiring a uniqueness key to prevent duplicates).



It does not create events from the debtor's debts automatically. The payment-due view is a live query. When the admin changes a debt's due date and the change syncs, the plan view reflects the new date on the next render.



It does not show other agents' manual events. Manual events are local to the device in the MVP (Section 5.5). The funded phase may add synced events.



11.8 The Communication Tools screen

A sidebar entry. Clicking it shows the connectors the admin has enabled for this agent.



Phase boundary. In Phase 9.5, this screen is a read-only placeholder. It reads the local local\_connectors table. In Phase 9.5, the table is likely empty. The screen shows an empty state: "Your administrator has not enabled any communication tools yet. Contact your administrator to enable a channel."



No credential distribution mechanism is implemented in Phase 9.5. No sending is implemented in Phase 9.5. The mechanism by which the admin's configuration reaches the agent is a Phase 9.6 or funded-phase task (open item, Section 12).



Each row, once the table has data (funded phase):



Connector name (for example, "Mocean SMS", "Resend Email", "Twilio Voice").



Status (available / unavailable).



The channels it supports (SMS / Email / Voice / Push).



A one-line note about what it does.



No credentials. No provider account details. No usage totals. No billing.



11.9 What the design does not do

It does not invent new colors or shapes. It uses the vocabulary in Section 11.2.



It does not use MUI (Material UI). The old Electron-era UI used MUI; the new app does not.



It does not copy the old Communication Center UI. The new UI is a debtor-profile-driven flow, not a standalone page with a recipient field.



It does not copy the Client Dashboard's Calendar UI verbatim. The Agent App's plan view is richer: it combines manual events with derived views.



12\. OPEN ITEMS

This section names the items that are not resolved by this spec. No developer invents an answer. Each item is placed in one of three buckets:



A. Blocks Phase 9.5 - must be resolved before Phase 9.5 implementation begins.



B. Does not block Phase 9.5 - can be resolved during or after Phase 9.5.



C. Funded phase - not in the MVP.



A. Blocks Phase 9.5

C2 - Debt-sync resolution must be recorded in the authoritative documents. The founder's decision (debt data travels inside the parent debtor's data\_json) is recorded in Section 7.8 of this spec. It must also be recorded in SYNC-ARCHITECTURE.md Section 25.9.2 (a one-paragraph clarification) and, if the founder chooses, in GORKA-MVP-SCOPE.md Section 8.4. The two protocol-level rules (Rule 1 - receipt, Rule 2 - origination) must be added to SYNC-ARCHITECTURE.md so the receiving and originating behavior is part of the frozen specification. This is a small amendment, not an architecture change. It is a precondition for Phase 9.6, not Phase 9.5, but it should be resolved before Phase 9.5 implementation because the local debts table's role depends on it.



C3 - LOCAL-TABLES.md alignment. The four local schema additions in Section 5.4 through 5.6 (debtors.photo\_path, calendar\_events, debtors.role, debtor\_relations) must be recorded in LOCAL-TABLES.md via its amendment process before implementation. Until then, they are proposals in this spec, not schema.



C4 - Migration numbering verification. Before implementation, read src-tauri/src/db.rs and confirm the current highest PRAGMA user\_version value. Append the new migration blocks after it. The numbers in Section 5.4 through 5.6 (v5, v6, v7) are based on the state at the time this spec was written. If the state has moved, the numbers move with it.



Client Dashboard enrollment export UI. export\_enrollment\_package exists but has no UI. The admin exports via devtools today (the D.3 test). A proper export screen is needed before the Agent App's Step 3 (Enroll) is usable without devtools. This is a Phase 9.5 or 9.6 task. Without it, the Agent App's first-run flow is blocked for any real user.



Second-app identity strings. The Agent App has its own bundle identifier, its own app data folder, its own settings.dat, its own local SQLCipher database, and its own device\_id. This is stated in Section 2.3. The exact strings (bundle identifier, app data folder path, database filename) are chosen at build configuration time and must be recorded before the first build.



Production API endpoint. The current login command (in auth.rs) POSTs to a hardcoded development URL, http://localhost:3000/api/auth/login. Replacing this with the authoritative production API configuration is a controlled configuration task, not a task for the Agent App developer to fix independently during Phase 9.5. The change is small; the discipline is that the endpoint is a single configuration value that is set once, deliberately, and not patched ad hoc.



B. Does not block Phase 9.5

C1 - Sensitive-field list (AI). A legal input, not a design choice. Required before the AI boundary layer is implemented (funded phase). Not required for Phase 9.5.



C3a - Redaction for pasted documents and long text. The MVP boundary layer handles free-text; pasted documents and large text blocks need their own rule. Funded phase.



C4 - AI free-text vs structured metadata. Whether the AI receives free-text at all, or only a structured metadata blob. Funded phase.



C5 - AI provider credential distribution. How AI provider credentials reach the agent device. Same shape as B-5. Funded phase.



E-15 - Compliance layer spec section. The compliance layer needs its own spec section when the funded phase begins. Named here; specified in the funded phase.



E-16 - What "block" means per rule type. Resolved in Section 10.5 from the founder's prior decision. The resolution is a decision to confirm, not a new decision.



Connector configuration distribution. The mechanism by which the admin's connector configuration (and, separately, the provider credentials) reaches the agent's local\_connectors table. In Phase 9.5, the table is empty. In Phase 9.6 or the funded phase, a mechanism is defined. Three shapes are possible: manual re-entry on the agent device, sync via the existing event system, or a Control Plane push. Not decided.



B-5 - Rotated provider credential distribution. How a rotated credential reaches the other devices. Same three shapes. Not decided.



Client Dashboard calendar repair. The Client Dashboard's calendar is inert: it renders, its service calls cloud endpoints that do not exist, and there is no schema for it anywhere. The Agent App's plan view is fresh and local. The Client Dashboard's calendar should be repaired to the same local model in a later phase, so the admin can see organization-wide due-date summaries.



data\_json 1 MiB ceiling. A guardrail (Section 7.8). A practical limit on how much debt data travels inside a single debtor's data. Watch item.



Debt-sync granularity limitation. Two devices changing two different debts inside the same debtor's data concurrently produce one winner. Documented in Section 7.8 as a conscious MVP limitation. Not an open item to resolve; an open item to keep in mind.



Guarantor relation sync. The people sync (they are debtors rows); the relations do not sync in the MVP (debtor\_relations is local). Whether the relations sync in the funded phase, and if so as their own events or embedded in the parent debtor's data, is not decided.



Local-only calendar events. Manual calendar events are local to the device in the MVP. Whether they sync in the funded phase is not decided.



CI/CD for two Tauri apps. How the build produces two installers from one repository, and how CI knows which app is which. Phase 9.5 infrastructure task.



Client Dashboard entry-flow redesign. The Client Dashboard's Set/Enter screens came in from Tauri and use a design that was not chosen by the founder. Bring them into the Login-page design later. Separate workstream.



C. Funded phase

A-6 - Automatic sending. A scheduler that fires when the agent's machine is asleep. Deferred.



F-19a - Pruning mechanism. The funded-phase data retention model.



F-19b - Local vs synced pruning. Whether pruning is local or propagates.



EVENTS - New event types. MESSAGE\_SENT, MESSAGE\_STATUS\_CHANGED, AI\_RECOMMENDATION\_MADE, AGENT\_DECISION\_RECORDED. Additive; Section 22.13.3 reserves codes starting at 0x0100.



DATA - Credit-bureau / data-vendor integration. A distinct feature within the Connection Center. Legal review is a precondition.



C-6 - AI boundary layer spec section. The AI boundary layer needs its own spec section when the funded phase begins.



Per-agent access control (D-3). MVP: all agents see all debtors. Production: sync-layer filtering, using the seam in Section 7.5.



sync\_now button. Not in the MVP. Not needed. Not scheduled.



D1-D12 from SYNC-ARCHITECTURE.md Section 28.3. Per-machine device identity, key rotation, cryptographic offboarding, lost-device recovery, mesh topology, forward-secret session establishment, debt and document synchronization, document content synchronization, AI prompt/response synchronization, cryptographic specialist review, threat model and independent security review, traffic analysis mitigation. All funded phase.



13\. WHAT THIS SPEC DOES NOT DO

It does not write code.



It does not amend ARCHITECTURAL-LAW.md, SYNC-ARCHITECTURE.md, GORKA-MVP-SCOPE.md, MULTI-USER-CONCEPT.md, THREAT-MODEL.md, LOCAL-TABLES.md, CLOUD-TABLES.md, or any other frozen document in this session. Where this document identifies a needed change in a frozen document (Section 12, Corrections C2 and C3), it names it and defers the amendment to the process.



It does not change the cloud schema.



It does not add event types, entity types, message types, or cloud tables.



It does not change the cryptographic primitives.



It does not change the wire format.



It does not start Phase 9.5, Phase 9.6, or Phase 9.7.



It does not resolve the open items in Section 12. It names them and places them in the appropriate bucket.



It does not propose a redesign of any part of the frozen architecture.



It does not port any code from the Electron-era src/frontend/ or src/backend/\_disabled/. Those folders are reference only.



This document is a specification for the founder's review. It becomes the input to Phase 9.5 when the founder approves it.



END OF DOCUMENT

