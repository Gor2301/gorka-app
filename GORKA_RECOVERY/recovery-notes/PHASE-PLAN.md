\# GORKA RECOVERY - PHASE PLAN



Version: 1.1

Date: September 17, 2026 (Phases 9.5, 9.6, 9.7 added)

Purpose: The complete 0-18 phase plan for the GORKA recovery.

Authority: The only source of truth for what each phase means.



Status legend:

&#x20; COMPLETE = all completion criteria met and verified

&#x20; BLOCKED = started but cannot complete until a dependency exists

&#x20; PENDING = not yet started, dependencies not yet satisfied



PHASE 0 - FREEZE AND BACKUP

Status: COMPLETE (September 11, 2026)



PHASE 1 - ARCHITECTURAL LAW

Status: COMPLETE (September 11, 2026, v1.1 Sept 12)



PHASE 2 - DECISION DOCUMENTS

Status: COMPLETE (September 11-12, 2026)



PHASE 3 - CLOUD SCHEMA (19 models, no debtor tables)

Status: COMPLETE (September 12, 2026)



PHASE 3.5 - BACKEND CLEANUP (11 files moved to \_disabled/)

Status: COMPLETE (September 12, 2026)



PHASE 4 - PRISMA GENERATION AND COMPILE

Status: COMPLETE (September 12, 2026)



PHASE 5 - DESTROY AND REBUILD gorka\_test (19 tables)

Status: COMPLETE (September 12, 2026)



PHASE 6 - MANUAL CLOUD SCHEMA VERIFICATION

Status: COMPLETE (September 12, 2026)



PHASE 7 - REGISTRATION

Status: COMPLETE (September 12, 2026)



PHASE 8 - LOGIN AND AUTH

Status: COMPLETE (September 12, 2026)



PHASE 9 - TAURI LOCAL DATABASE VERIFICATION

Status: PARTIAL (September 14, 2026) — debtor CRUD, debtor-attached document upload, debtor detail page, and debt CRUD verified in the desktop app; communication logging frontend pending; action CRUD pending (requires local schema migration v3)



============================================================



PHASE 9.5 - AGENT APP AND CLIENT DASHBOARD, LOCAL ONLY



============================================================



Goal: Both desktop applications exist and work locally, on

separate machines, with no synchronization yet.



Deliverables:



\- Client Dashboard (already exists) continues to work: debtors,

&#x20; debts, documents, communications, actions.

\- Agent App is created as a second Tauri binary in the same

&#x20; repository. Shares the Rust command layer with the Client

&#x20; Dashboard.

\- Both apps open the same SQLCipher local schema. The Agent App

&#x20; gets its own local database file.

\- Registration and login work for the CLIENT role (admin) in the

&#x20; Client Dashboard.

\- Registration and login work for the AGENT role in the Agent App,

&#x20; using credentials provided by the admin.

\- The Agent App has read and write access to the local schema,

&#x20; but only for debtors assigned to that agent. Assignment is local

&#x20; only in this phase; the concept document's sync model is not

&#x20; yet applied.

\- A single-machine demonstration works: the admin runs the Client

&#x20; Dashboard, the same human opens the Agent App on the same

&#x20; machine and performs agent actions.



Out of scope for Phase 9.5:



\- Any synchronization between machines.

\- The encrypted relay.

\- Device identity.

\- Mesh or hub-and-spoke topology.



Completion criteria:



\- Both binaries build successfully.

\- Both apps launch and run.

\- Both apps can perform debtor, action, communication, and

&#x20; document operations against their local SQLCipher databases.

\- The phase is complete when this is verified empirically on a

&#x20; Windows environment.



Source of truth: MULTI-USER-CONCEPT.md §9 (Tier 1 — Local

SQLCipher storage; Client Dashboard and Agent App as two separate

Tauri binaries).



============================================================



PHASE 9.6 - SYNC ENGINE (MVP SCOPE)



============================================================



Goal: Two client-owned machines synchronize debtor data directly,

end-to-end encrypted, with GORKA's Control Plane providing

discovery and an encrypted relay fallback. No debtor data is

stored on GORKA's infrastructure.



Deliverables:



\- Sync engine implemented in the shared Rust crate.

\- Event-based synchronization: state changes and append-only

&#x20; business events.

\- Hub-and-spoke topology for the MVP: the admin's machine is the

&#x20; hub, each agent's machine is a spoke.

\- Direct device-to-device connection when the network allows.

\- Encrypted relay fallback through GORKA's Control Plane when a

&#x20; direct connection is not possible. The relay cannot decrypt.

\- Single organization key model, with the key exported by the

&#x20; admin as an encrypted package and imported by the agent.

\- The sync engine treats device identity and session keys as

&#x20; first-class concepts in the wire format, even though the MVP

&#x20; derives them simply.

\- A local event table and a sync state table in the local schema,

&#x20; separate from the application audit log.

\- A control plane service for discovery and relay coordination.

&#x20; Its only persistent state is connection metadata.

\- A visible sync indicator in both apps: synced / pending /

&#x20; offline.



Acceptance criteria (from MULTI-USER-CONCEPT.md §9, Tier 1):



\- Initial synchronization between two machines.

\- New debtor propagation.

\- State update propagation.

\- Event propagation (append-only, no loss).

\- Offline modification, followed by reconnect and reconciliation.

\- Duplicate prevention.

\- No data loss under normal operation.

\- Direct connection path works.

\- Relay fallback path works.

\- Corrupted or invalid messages are rejected.



All ten criteria must pass before Phase 9.6 is declared complete.



Out of scope for Phase 9.6:



\- Mesh topology (production phase).

\- Per-machine device identity (production phase).

\- Key rotation (production phase).

\- Offboarding and lost-device flows (production phase).

\- Group key management and MLS (production phase).

\- The threat model and independent security review (separate

&#x20; document, before shipping to real customers).



Source of truth: MULTI-USER-CONCEPT.md §3, §4, §6, §7;

ARCHITECTURAL-LAW.md v1.2 §20.



============================================================



PHASE 9.7 - MULTI-USER DEMONSTRATION



============================================================



Goal: A reliable, rehearsable demonstration of multi-user sync

that can be given to investors and prospective clients.



Deliverables:



\- Two laptops, one running the Client Dashboard (admin), one

&#x20; running the Agent App (agent).

\- Both connect to the Control Plane and to each other.

\- The admin creates a debtor. Within seconds, the debtor appears

&#x20; on the agent's machine.

\- The agent logs an action. It appears on the admin's machine.

\- A network capture shows the sync traffic as ciphertext. No

&#x20; readable debtor data appears in any capture.

\- The GORKA Owner Dashboard shows the two machines connected, and

&#x20; shows nothing about the debtors.

\- The client's local data is shown to be encrypted at rest.

\- A written demonstration script, rehearsed at least three times,

&#x20; with a documented recovery procedure for each step in case

&#x20; something fails during the live demonstration.



Out of scope for Phase 9.7:



\- Mesh topology demonstration.

\- Per-device identity demonstration.

\- Any scenario requiring more than two machines.



Completion criteria:



\- The demonstration is reliable: it works on three consecutive

&#x20; rehearsals without changes.

\- A backup video is recorded.

\- The demonstration script is documented in the recovery notes.



Source of truth: MULTI-USER-CONCEPT.md §10.



============================================================



PHASE 10 - AGGREGATE METRICS SYNC

Status: COMPLETE (September 13, 2026)

Delivered: POST /api/metrics/sync in

src/backend/routes/metrics.routes.ts, mounted with

authenticateToken. Writes aggregate\_metrics (upsert per org) and

boundary\_proof\_logs (eventType=METRICS\_SYNC, debtorDataIncluded=

false). Verified against gorka\_test with curl + psql.



PHASE 11 - CLIENT ACTIVITY METRICS SYNC

Status: COMPLETE (September 13, 2026)



PHASE 12 - BOUNDARY PROOF LOGGING SURFACED

Status: COMPLETE (September 13, 2026)



PHASE 13 - CONNECTOR ARCHITECTURE FEASIBILITY

Status: COMPLETE (September 13, 2026)



PHASE 14 - CONNECTOR IMPLEMENTATION

Status: COMPLETE (September 13, 2026)



============================================================

PHASE 14.5 - SUBSCRIPTION BILLING

============================================================



Goal: Implement the GORKA <-> Client SaaS subscription

record-keeping. Distinct from connector compensation. Stripe-

ready schema, no Stripe integration yet.



Status: COMPLETE (September 13, 2026)





PHASE 15 - BOUNDARY / SECURITY TEST

Status: PARTIAL (September 14, 2026) — static review complete; runtime tests deferred pending Tauri frontend



PHASE 16 - PRODUCTION CUTOVER PLAN

Status: PENDING



PHASE 17 - PRODUCTION REBUILD

Status: PENDING



PHASE 18 - END-TO-END TEST

Status: PENDING



SUMMARY TABLE



0     Freeze \& Backup                    COMPLETE

1     Architectural Law                  COMPLETE

2     Decision Documents                 COMPLETE

3     Cloud Schema                       COMPLETE

3.5   Backend Cleanup                    COMPLETE

4     Prisma Generation                  COMPLETE

5     Destroy \& Rebuild gorka\_test       COMPLETE

6     Schema Verification                COMPLETE

7     Registration                       COMPLETE

8     Login \& Auth                       COMPLETE

9     Tauri Local Database Verification  PARTIAL

9.5   Agent App and Client Dashboard     NOT STARTED

&#x20;     (local only)

9.6   Sync Engine (MVP scope)            NOT STARTED

9.7   Multi-User Demonstration           NOT STARTED

10    Aggregate Metrics Sync             COMPLETE

11    Client Activity Metrics Sync       COMPLETE

12    Boundary Proof Logging             COMPLETE

13    Connector Feasibility              COMPLETE

14    Connector Implementation           COMPLETE

14.5  Subscription Billing               COMPLETE

15    Boundary / Security Test           PARTIAL

16    Production Cutover Plan            PENDING

17    Production Rebuild                 PENDING

18    End-to-End Test                    PENDING



END OF PHASE PLAN

