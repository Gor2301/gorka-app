========================================================================

GORKA — MVP SCOPE

========================================================================



Document:    GORKA-MVP-SCOPE.md

Version:     1.1 (frozen)
Date:        September 18, 2026
Status:      FROZEN — approved by the founder on September 18, 2026

Authority:   Subordinate to ARCHITECTURAL-LAW.md v1.3.

&#x20;            Extends MULTI-USER-CONCEPT.md v2.0 (frozen).



========================================================================

1\. PURPOSE AND STATUS OF THIS DOCUMENT

========================================================================



Purpose



This document defines GORKA's MVP in full: every block, every

constraint, every out-of-scope item, and the acceptance criteria

that determine when the MVP is complete.



It is the anchor for the next weeks of work. It is written before

SYNC-ARCHITECTURE.md, because it defines what the sync engine must

do. SYNC-ARCHITECTURE.md then defines how.



Status



DRAFT — awaiting founder review.



Once approved, this document is frozen. Amendments follow the same

process as amendments to the multi-user concept: documented,

approved by the founder, recorded with reasoning.



Authority



This document is subordinate to ARCHITECTURAL-LAW.md (v1.3). Where

the two conflict, the law wins.



It extends MULTI-USER-CONCEPT.md (Version 2.0, frozen). Where the

two conflict, MULTI-USER-CONCEPT.md wins, and this document is

corrected.



It is consistent with PHASE-PLAN.md (v1.1), CLOUD-TABLES.md (v1.2),

LOCAL-TABLES.md (v1.2), and DATA-BOUNDARY-MATRIX.md (v1.2). Where

this document appears to disagree with any of them, the disagreement

is a defect in this document and is to be resolved in favor of the

other document.



What This Document Is



\- The complete scope of GORKA's first complete product.

\- The list of what must work, what must exist, and what is roadmap

&#x20; only.

\- The list of acceptance criteria that determine when the MVP is

&#x20; complete.

\- The reference for any question of the form "is this in the MVP?"



What This Document Is Not



\- Not a technical specification. The technical specification of the

&#x20; sync engine is SYNC-ARCHITECTURE.md.

\- Not a phase plan. The phase plan is PHASE-PLAN.md. This document

&#x20; references phases by number; it does not replace them.

\- Not a schedule. Timeline estimates live in MULTI-USER-CONCEPT.md

&#x20; §11 and are not repeated here.

\- Not a marketing document. The customer-facing statements are

&#x20; defined in ARCHITECTURAL-LAW.md §20.4 and §21.4 and in

&#x20; MULTI-USER-CONCEPT.md §3, and are quoted here only where the MVP

&#x20; must demonstrate them.



How to Read This Document



The primary organizing structure is the three tiers from

MULTI-USER-CONCEPT.md §9:



\- Tier 1 — must work reliably.

\- Tier 2 — must exist and be demonstrable, but simple.

\- Tier 3 — buttons, documentation, or roadmap only.



The MVP is Tier 1 and Tier 2, working. Tier 3 is the roadmap.



Each item inside a tier carries a status line. The status values

are:



\- DELIVERED — built and tested; the tests passed.

\- CODE COMPLETE, NOT YET TESTED — the code exists on disk; the

&#x20; test has not run, usually because the build environment is

&#x20; blocked.

\- NOT STARTED — no code, no document, no artifact yet.

\- ROADMAP ONLY — explicitly out of scope for the MVP; described

&#x20; for completeness only.



Where an item spans several phases, the phase numbers are named.

The phase plan remains the source of truth for phase definitions.



A note on "functional"



Throughout this document, "functional" means the item is present

and works. It does not mean the item is production-hardened.



The MVP is architecturally valid and demonstrably functional, but

deliberately limited. The limitations are named in Section 9 and in

Tier 3 (Section 7). They include, among others: no key rotation, no

offboarding or lost-device flows, no per-machine device identity,

no mesh topology, and no full compliance tooling. These are real

production concerns. They are not in the MVP by design, and their

absence is not a defect.



A note on the recovered ordering



Earlier documents placed SYNC-ARCHITECTURE.md before this document

(MULTI-USER-CONCEPT.md §14; DECISIONS.md, September 17, 2026). The

correct order, decided by the founder, is:



1\. GORKA-MVP-SCOPE.md — this document. Defines what the sync

&#x20;  engine must do.

2\. SYNC-ARCHITECTURE.md — defines how.

3\. Threat model / security review.



The earlier references are to be corrected in a future cleanup

pass. They are noted here so that no future session mistakes the

older ordering for the current one.



A note on the law version



This document is subordinate to ARCHITECTURAL-LAW.md v1.3. The

v1.3 amendment added Section 21, which names the three zones of

data control: GORKA cloud (Zone 1), GORKA-provided mechanisms

(Zone 2), and client-connected third parties (Zone 3). Where this

document refers to the law's promise, the zones, or the boundary,

it refers to the law as it stands at v1.3.



========================================================================

2\. THE MVP IN ONE PARAGRAPH

========================================================================



GORKA's MVP is a working multi-user debt-collection product in which

every client-owned machine holds an independently encrypted replica

of the organization's debtor data; the machines synchronize that

data directly with each other, end-to-end encrypted, brokered by

GORKA's Control Plane but never readable by it; the Client Dashboard

and the Agent App are two separate Tauri desktop applications

sharing a Rust command layer; registration, login, and organization

membership work; one working connector sends real messages through

the client's own provider account; a basic AI Copilot drafts one

recommendation and one message using only local data and the

client's own provider credentials; the Owner Dashboard shows which

machines are connected without showing any debtor; and the whole

thing is demonstrated on two machines side by side, with a network

capture and a key-custody review showing that the Control Plane

receives only encrypted debtor payloads and possesses no key capable

of decrypting them.



The MVP is a working product with constraints, not a

proof-of-concept. Every block above is present and functional in the

MVP. Each block is limited by an explicit list, stated in the tiers

that follow.



"Functional" does not mean production-hardened. The MVP is

architecturally valid and demonstrably functional, but deliberately

limited. Section 9 names the limitations.



The MVP demonstrates one claim:



> GORKA cannot decrypt your debtor data. This is an architectural

> property, not a policy.



It demonstrates that claim by showing it, not by asserting it. The

demonstration is defined in Section 10 of this document, and it

combines two kinds of evidence: a network capture showing that the

traffic on the wire is ciphertext, and a key-custody review showing

that the Control Plane holds no key capable of decrypting that

traffic.



The MVP is Tier 1 and Tier 2, working. Tier 3 is the roadmap.



========================================================================

3\. THE INVARIANT, RESTATED FOR THE MVP

========================================================================



The single most important sentence in GORKA:



> No individual debtor information is stored in GORKA cloud

> infrastructure.



This is not a feature. It is not a policy. It is the architectural

invariant everything else depends on. It cannot be amended. If it

needs to change, GORKA becomes a different product.



The MVP does not weaken it. The MVP is the first complete

demonstration that it holds under multi-user conditions.



\------------------------------------------------------------------------

3.1 The Two Planes and the Three Zones

\------------------------------------------------------------------------



The MVP is built on the two planes named in ARCHITECTURAL-LAW.md

v1.2 §20.1, and it respects the three zones named in v1.3 §21.



The two planes:



Control Plane — GORKA's own cloud infrastructure. Provides:

authentication, organization membership, device registration and

presence, discovery and signaling, encrypted relay coordination,

licensing, customer accounts and billing, aggregate metrics,

boundary proof logs. Never holds debtor data.



Data Plane — the client's own devices, and the encrypted

synchronization between them. Holds all debtor data, all

communications, all documents, all actions, all local audit

records. GORKA is not a participant.



The MVP implements both planes. The Control Plane is real and

running. The Data Plane is the client's machines plus the sync

engine.



The three zones, which the MVP must respect:



Zone 1 — GORKA cloud. Already covered by the invariant. No debtor

data in readable form.



Zone 2 — GORKA-provided mechanisms. Every mechanism GORKA offers

(connectors, the built-in AI Copilot, built-in provider

integrations) must be designed so debtor data cannot pass through

it. The mechanism is the guard. GORKA's obligation in Zone 2 is

prevention.



Zone 3 — Client-connected third parties. If the client connects

GORKA to a third party by a path GORKA does not control, GORKA

warns the client at the point of connection and records the

warning. The client decides. GORKA's obligation in Zone 3 is

warning.



Source: ARCHITECTURAL-LAW.md v1.3 §20.1, §21; MULTI-USER-CONCEPT.md

§3.



\------------------------------------------------------------------------

3.2 What May Live in Cloud Under the MVP

\------------------------------------------------------------------------



Everything allowed in cloud today, plus the two new Control Plane

tables added by the multi-user amendment:



\- Customer/agency data (business identity, contacts).

\- User authentication and profiles.

\- Aggregate metrics (debtor\_count, total\_debt — numbers only).

\- Client behavioral metrics (counts of uploads, deletions, etc.).

\- Support tickets (with PII warning enforced in UI).

\- Cloud audit logs (customer-level actions only).

\- Boundary proof logs (proof no debtor data crossed).

\- Connector catalog and enablement metadata.

\- Connector usage aggregates (counts, not per-debtor).

\- Parameterized message templates ({{debtor\_name}}, {{amount}}).

\- Control Plane connection metadata (device registration,

&#x20; presence, relay session metadata).

\- Encrypted sync payloads in transit through the relay

&#x20; (unreadable by GORKA; never stored).



Source: ARCHITECTURAL-LAW.md v1.2 §8 and §20; DATA-BOUNDARY-

MATRIX.md v1.2 §20.



\------------------------------------------------------------------------

3.3 What May Never Live in Cloud Under the MVP

\------------------------------------------------------------------------



Unchanged from the original law:



\- Debtor names, surnames, phones, emails, addresses.

\- Debtor IDs in any form — not even as metadata.

\- Individual debt amounts, dates, payment history.

\- Message content (SMS, email bodies).

\- Individual action content or assignments.

\- Documents or filenames.

\- AI prompts or responses containing debtor info.

\- Rendered personalized messages.



Source: ARCHITECTURAL-LAW.md v1.2 §2, §7; DATA-BOUNDARY-MATRIX.md

v1.2 §3–§8.



\------------------------------------------------------------------------

3.4 The Rule for Every Decision, Restated

\------------------------------------------------------------------------



Before adding any table, field, or API endpoint in the MVP, ask:



> Does this contain or reference an individual debtor?



\- If yes → local only. Do not add to cloud.

\- If no → cloud is allowed.

\- If unclear → stop. Clarify. Document the decision.



Source: ARCHITECTURAL-LAW.md v1.2 §6.



\------------------------------------------------------------------------

3.5 The Canonical Promise, As the MVP Must Demonstrate It

\------------------------------------------------------------------------



Technical statement (canonical):



> GORKA cannot decrypt your debtor data. This is an architectural

> property, not a policy.



Marketing statement:



> Your debtor data stays under your control. GORKA cannot read it.



The MVP demonstrates the technical statement. The demonstration

combines two kinds of evidence, and it needs both:



1\. A network capture showing that the traffic on the wire is

&#x20;  ciphertext. This shows what an observer on the wire sees. It

&#x20;  does not, by itself, prove that GORKA cannot decrypt.



2\. A key-custody review showing that the Control Plane holds no key

&#x20;  capable of decrypting the traffic. This is the part that makes

&#x20;  "cannot decrypt" a demonstration rather than an assertion. It

&#x20;  shows that the organization key exists only on client devices,

&#x20;  that the Control Plane holds no organization key, no device

&#x20;  private key, and no session key capable of decrypting a captured

&#x20;  payload, and that a captured relay payload cannot be decrypted

&#x20;  using any credential available to the Control Plane.



Neither piece alone is sufficient. Ciphertext on the wire plus no

key to read it is the full statement.



The old formulation — "debtor data never touches GORKA's servers" —

is not used, because it was technically indefensible and has been

replaced.



Source: ARCHITECTURAL-LAW.md v1.3 §20.4, §21; MULTI-USER-CONCEPT.md

§3; BOUNDARY-TEST-PLAN.md §2.4.



\------------------------------------------------------------------------

3.6 What the MVP Does Not Change

\------------------------------------------------------------------------



\- The invariant is not weakened.

\- The definition of debtor data is not changed.

\- The list of architectural violations is not changed.

\- The list of architectural allowances is not changed.

\- The proof test in ARCHITECTURAL-LAW.md §9 is not replaced. The

&#x20; MVP adds a multi-machine proof test (BOUNDARY-TEST-PLAN.md §2.4)

&#x20; on top of the existing one.



Source: ARCHITECTURAL-LAW.md v1.3 §20.6, §21.5.



========================================================================

4\. WHAT IS ALREADY DELIVERED

========================================================================



This section is informational. It is not the organizing principle of

the document. It exists so that a reader can see, in one place,

what the MVP already has, and so that no future session mistakes

delivered work for pending work.



The organizing principle of this document remains the three tiers

(Sections 5, 6, and 7).



The status values used here are those defined in Section 1:

DELIVERED, CODE COMPLETE NOT YET TESTED, NOT STARTED, ROADMAP ONLY.



\------------------------------------------------------------------------

4.1 Recovery and Architecture (Phases 0 through 2)

\------------------------------------------------------------------------



\- Phase 0 — Freeze and Backup. DELIVERED. September 11, 2026.

\- Phase 1 — Architectural Law. DELIVERED. v1.3 as of September 18,

&#x20; 2026.

\- Phase 2 — Decision Documents. DELIVERED. The recovery documents,

&#x20; plus MULTI-USER-CONCEPT.md v2.0.



\------------------------------------------------------------------------

4.2 Cloud Schema and Backend (Phases 3 through 8)

\------------------------------------------------------------------------



\- Phase 3 — Cloud Schema. DELIVERED. 21 tables as of September 17,

&#x20; 2026 (19 original + device\_registrations, relay\_sessions).

\- Phase 3.5 — Backend Cleanup. DELIVERED. 11 files moved to

&#x20; src/backend/\_disabled/.

\- Phase 4 — Prisma Generation. DELIVERED.

\- Phase 5 — Destroy and Rebuild gorka\_test. DELIVERED. 21 tables.

\- Phase 6 — Manual Cloud Schema Verification. DELIVERED.

\- Phase 7 — Registration. DELIVERED. Creates organization + user

&#x20; with CLIENT role.

\- Phase 8 — Login and Auth. DELIVERED. JWT issued; /api/auth/me

&#x20; returns user + organization with no sensitive fields.



Note: the two new Control Plane tables (device\_registrations,

relay\_sessions) exist in CLOUD-TABLES.md v1.2 and in the schema

plan. They have not yet been applied to gorka\_test. Applying them

is part of Phase 9.6 preparation, not Phase 3. This is a known

state, not a defect.



\------------------------------------------------------------------------

4.3 Local Data Plane (Phase 9, partial)

\------------------------------------------------------------------------



Phase 9 — Tauri Local Database Verification. PARTIAL.



Delivered and tested:



\- Item 1 — Debtor-attached document upload. DELIVERED.

\- Item 1b — Debtor detail page at /collections/:id. DELIVERED.

\- Item 2 — Debt CRUD. DELIVERED.

\- Item 3 — Communication logging. DELIVERED.



Not yet tested:



\- Item 4 — Action CRUD. CODE COMPLETE, NOT YET TESTED. Rust

&#x20; commands, migration v3, and frontend are on disk and compiled

&#x20; into the signed binary. Testing is blocked by Smart App Control

&#x20; (SAC) on the founder's main machine. Verification is required

&#x20; before the MVP is complete.



Not yet implemented in the UI, and part of the MVP:



\- The Agent App as a separate Tauri binary (Phase 9.5).

\- The sync engine and its visible indicator (Phase 9.6).

\- The multi-user demonstration (Phase 9.7).



These are addressed in Tier 1 (Section 5).



\------------------------------------------------------------------------

4.4 Metrics, Boundary Proof, Connectors, Billing

(Phases 10 through 14.5)

\------------------------------------------------------------------------



\- Phase 10 — Aggregate Metrics Sync. DELIVERED. POST

&#x20; /api/metrics/sync writes aggregate\_metrics and a

&#x20; boundary\_proof\_logs row.

\- Phase 11 — Client Activity Metrics Sync. DELIVERED. POST

&#x20; /api/activity/sync writes client\_activity\_metrics and a boundary

&#x20; proof log.

\- Phase 12 — Boundary Proof Logging Surfaced. DELIVERED. GET

&#x20; /api/boundary-proofs; Owner Dashboard page at /boundary-proofs.

\- Phase 13 — Connector Architecture Feasibility. DELIVERED.

&#x20; CONNECTOR-LIFECYCLE.md.

\- Phase 14 — Connector Implementation. DELIVERED (backend). Five

&#x20; connector\_catalog rows seeded; enable/disable, usage sync, and

&#x20; billing summary endpoints working. Frontend display is deferred

&#x20; and is part of Tier 2 (Section 6).

\- Phase 14.5 — Subscription Billing. DELIVERED (backend). License

&#x20; model extended with Stripe-ready fields; /api/licenses endpoints

&#x20; working. Stripe integration deferred. Frontend display is part

&#x20; of Tier 2 (Section 6).



These phases are backend-only where noted. The frontend portions

deferred in Phase 14 and Phase 14.5 fall into Tier 2 and are

tracked there.



\------------------------------------------------------------------------

4.5 Boundary / Security Test (Phase 15, partial)

\------------------------------------------------------------------------



Phase 15 — Boundary / Security Test. PARTIAL.



\- Static boundary review (Claim A). DELIVERED. Recorded in

&#x20; BOUNDARY-TEST-PLAN.md §3.

\- Runtime boundary test (Claim B). NOT STARTED. Depends on the

&#x20; Tauri frontend and the sync engine.

\- Aggregation inference test (Claim C). NOT STARTED.

\- Multi-machine relay test (Claim D). NOT STARTED. Depends on

&#x20; Phase 9.6.



The runtime tests are part of MVP acceptance. They are listed in

Section 12 (Acceptance Criteria).



\------------------------------------------------------------------------

4.6 The Multi-User Model (documentation)

\------------------------------------------------------------------------



\- MULTI-USER-CONCEPT.md, Version 2.0, frozen. DELIVERED.

\- ARCHITECTURAL-LAW.md v1.3, Section 20 and Section 21. DELIVERED.

\- DATA-BOUNDARY-MATRIX.md v1.2, Section 20. DELIVERED.

\- CLOUD-TABLES.md v1.2, Section 20. DELIVERED.

\- LOCAL-TABLES.md v1.2, Category D. DELIVERED.

\- PHASE-PLAN.md v1.1, Phases 9.5, 9.6, 9.7. DELIVERED.



The multi-user model is decided and written. It is not yet

implemented. Implementation is Tier 1 (Section 5).



\------------------------------------------------------------------------

4.7 Summary

\------------------------------------------------------------------------



Delivered and tested: Phases 0–8, Phase 9 items 1, 1b, 2, 3,

Phases 10–14.5, Phase 15 static review.



Code complete, not yet tested: Phase 9 item 4.



Not started: Phase 9.5, Phase 9.6, Phase 9.7, Phase 15 runtime

tests.



These three categories correspond to the status lines carried into

the tiers that follow.



========================================================================

5\. TIER 1 — MUST WORK RELIABLY

========================================================================



Tier 1 is what the MVP is. If any item in Tier 1 does not work

reliably, the MVP is not complete.



The items below are restated from MULTI-USER-CONCEPT.md §9 (Tier 1).

Each carries a status line and, where applicable, an explicit

reference to the phase that delivers it.



The status values are those defined in Section 1: DELIVERED,

CODE COMPLETE NOT YET TESTED, NOT STARTED, ROADMAP ONLY.



\------------------------------------------------------------------------

5.1 Local SQLCipher Storage on Each Machine

\------------------------------------------------------------------------



Every client-owned machine stores the organization's debtor data in

a local SQLCipher database, encrypted at rest. The database is

unlocked with a password the client controls. GORKA's cloud never

sees this data.



Status: DELIVERED. The Client Dashboard's local SQLCipher storage

is working and tested (Phase 9, items 1, 1b, 2, 3). It is the

existing baseline that the multi-user work extends.



What remains for Tier 1 under this item:



\- The Agent App must open its own SQLCipher database, on its own

&#x20; machine, with the same schema. Phase 9.5.

\- The local schema must include the three sync tables

&#x20; (sync\_events, sync\_state, sync\_peers) defined in LOCAL-TABLES.md

&#x20; v1.2 Category D. Phase 9.6.



Source: MULTI-USER-CONCEPT.md §9, §3; LOCAL-TABLES.md v1.2.



\------------------------------------------------------------------------

5.2 Multi-User Sync Engine

\------------------------------------------------------------------------



The sync engine makes the client's machines converge toward the

same logical state, without GORKA ever reading the data.



Scope, per MULTI-USER-CONCEPT.md §9 and PHASE-PLAN.md Phase 9.6:



\- Event-based synchronization. State and events are two distinct

&#x20; categories, per MULTI-USER-CONCEPT.md §7.

\- The protocol operates on immutable logical events, not on

&#x20; database-file synchronization and not on blind row replacement.

&#x20; A change made on one machine is expressed as an event (or as a

&#x20; state change governed by the deterministic rule) and applied on

&#x20; the receiving machine. Replacing a whole row with the sender's

&#x20; current values is not the model.

\- Hub-and-spoke topology for the MVP. The admin's machine is the

&#x20; hub. Each agent's machine is a spoke.

\- The hub is a topology role, not a data-model identity. The

&#x20; protocol's events, state records, and peer records must not treat

&#x20; the hub as permanently special. A peer is a peer. Topology is

&#x20; configuration. This is what allows the same protocol to support

&#x20; mesh in the funded phase without redesign.

\- Direct device-to-device connection when the network allows it.

\- Encrypted relay fallback through GORKA's Control Plane when a

&#x20; direct connection is not possible. The relay cannot decrypt.

\- Single organization key model. The key is exported by the admin

&#x20; as an encrypted package and imported by the agent.

\- Device identity and session keys are first-class concepts in the

&#x20; wire format, even though the MVP derives them simply.

\- A visible sync indicator in both apps: synced / pending /

&#x20; offline.



Status: NOT STARTED.



This item cannot begin until SYNC-ARCHITECTURE.md and this document

are written and approved. SYNC-ARCHITECTURE.md defines the wire

format, the ordering rule, and the other open technical questions

that MULTI-USER-CONCEPT.md deliberately leaves open.



The ten acceptance criteria for the sync engine are listed in

Section 12 of this document. They are the same criteria as

MULTI-USER-CONCEPT.md §9.



Source: MULTI-USER-CONCEPT.md §3, §4, §6, §7, §9; PHASE-PLAN.md

Phase 9.6.



\------------------------------------------------------------------------

5.3 Client Dashboard and Agent App as Two Separate Tauri Binaries

\------------------------------------------------------------------------



Both applications exist. They are separate Tauri binaries. They

share a Rust command layer.



The Client Dashboard is what the agency admin uses. It is already

built and working. The Agent App is what the agency's agents use.

It does not yet exist.



Status: NOT STARTED (the Agent App). The Client Dashboard side is

DELIVERED.



What Tier 1 requires:



\- The Agent App is created as a second Tauri binary in the same

&#x20; repository.

\- Both binaries share the Rust command layer.

\- Both open the same SQLCipher local schema. The Agent App uses its

&#x20; own local database file.

\- The Agent App has read and write access to the local schema, for

&#x20; debtors assigned to that agent. Assignment is local only in this

&#x20; phase.



This is Phase 9.5.



Source: MULTI-USER-CONCEPT.md §9 (Tier 1); PHASE-PLAN.md Phase 9.5.



\------------------------------------------------------------------------

5.4 Registration, Login, and Organization Membership

\------------------------------------------------------------------------



Registration creates an organization and a CLIENT user. Login

issues a JWT. Organization membership associates users with an

organization.



Status: DELIVERED for the Client Dashboard and the backend

(Phases 7 and 8). Phase 9.5 extends registration and login to the

AGENT role for the Agent App.



What Tier 1 requires:



\- Registration and login work for CLIENT (admin) in the Client

&#x20; Dashboard. DELIVERED.

\- Registration and login work for AGENT in the Agent App, using

&#x20; credentials provided by the admin. NOT STARTED. This is

&#x20; Phase 9.5.



Source: PHASE-PLAN.md Phases 7, 8, 9.5; MULTI-USER-CONCEPT.md §5.



\------------------------------------------------------------------------

5.5 Action CRUD — Item 4 of Phase 9

\------------------------------------------------------------------------



Action CRUD is part of the existing product. It is not a new MVP

feature. Its code exists on disk and is compiled into the signed

binary. What is missing is verification.



Status: CODE COMPLETE, NOT YET TESTED. Testing is blocked by Smart

App Control (SAC) on the founder's main machine. Verification must

occur before the MVP is complete.



What Tier 1 requires:



\- Action CRUD works end to end in the running desktop app: create,

&#x20; edit, delete, list, persistence across restart. This must be

&#x20; verified once a cloud Windows environment is available.



Source: DECISIONS.md, September 15, 2026 ("Phase 9 Progress —

Item 4" and "SAC investigation and cloud development environment

decision").



\------------------------------------------------------------------------

5.6 One Demonstration of Sync Between Two Machines

\------------------------------------------------------------------------



One demonstration of sync between two machines, meeting the ten

acceptance criteria in Section 12 of this document.



Status: NOT STARTED. This is Phase 9.7.



The demonstration is defined in Section 10 of this document. It

depends on Tier 1 items 5.1 through 5.5 being complete.



Source: MULTI-USER-CONCEPT.md §9 (Tier 1), §10; PHASE-PLAN.md

Phase 9.7.



\------------------------------------------------------------------------

5.7 Tier 1 — Status Summary

\------------------------------------------------------------------------



| Item | Status |

|------|--------|

| Local SQLCipher storage on each machine | DELIVERED for Client Dashboard; Agent App side NOT STARTED |

| Multi-user sync engine (hub-and-spoke, event-based, direct + relay) | NOT STARTED |

| Client Dashboard + Agent App as two Tauri binaries, shared Rust layer | Client Dashboard DELIVERED; Agent App NOT STARTED |

| Registration, login, organization membership | DELIVERED for CLIENT; AGENT side NOT STARTED |

| Action CRUD (Phase 9 item 4) | CODE COMPLETE, NOT YET TESTED |

| One demonstration of sync between two machines | NOT STARTED |



Tier 1 is not complete until every row above is DELIVERED and

verified.



========================================================================

6\. TIER 2 — MUST EXIST AND BE DEMONSTRABLE, BUT SIMPLE

========================================================================



Tier 2 is not "nice to have." Each item in Tier 2 must exist in the

MVP and must be demonstrable. Each item is deliberately kept simple.

Complexity in Tier 2 is out of scope.



The items below are restated from MULTI-USER-CONCEPT.md §9 (Tier 2).

Each carries a status line and, where applicable, an explicit

reference to the phase or workstream that delivers it.



The status values are those defined in Section 1: DELIVERED,

CODE COMPLETE NOT YET TESTED, NOT STARTED, ROADMAP ONLY.



\------------------------------------------------------------------------

6.1 Owner Dashboard — Sync Activity Metadata View

\------------------------------------------------------------------------



The Owner Dashboard shows a metadata-only view of sync activity:

which organizations have how many machines, which are online, how

many relay sessions have occurred, when the last sync happened.

Nothing about the debtors. Because the Owner Dashboard cannot see

debtors, it cannot display them — this is not a limitation, it is

the proof.



Status: NOT STARTED for the new view. The Boundary Proofs page

delivered in Phase 12 is DELIVERED and is part of the same Owner

Dashboard.



What Tier 2 requires:



\- A new view on the Owner Dashboard showing the new Control Plane

&#x20; metadata: device counts per organization, presence, relay session

&#x20; counts, last sync timestamps.

\- No debtor data is shown, ever, because none is available.

\- The Boundary Proofs page already delivered (Phase 12) remains as

&#x20; is.

\- Nothing else on the Owner Dashboard is in scope.



Explicitly out of scope in Tier 2 (see Section 7, Tier 3):



\- The Owner Dashboard pages that currently call non-existent

&#x20; endpoints (Clients, Analytics, Billing, Audit, Dashboard).

&#x20; These are pre-existing conditions and are not to be fixed as

&#x20; part of the MVP.



Source: MULTI-USER-CONCEPT.md §9 (Tier 2); CLOUD-TABLES.md v1.2

§20 (device\_registrations, relay\_sessions).



\------------------------------------------------------------------------

6.2 Marketing Website

\------------------------------------------------------------------------



A minimal marketing website with:



\- A page describing the product.

\- A page describing the data protection promise, in both its

&#x20; technical and marketing forms, as defined in ARCHITECTURAL-LAW.md

&#x20; v1.3 §20.4 and §21.4.

\- A registration form that creates a CLIENT organization and user.

\- A download page with links to the Client Dashboard installer and,

&#x20; when it exists, the Agent App installer.



Status: The existing website exists (gorka-website, a Next.js app;

backed up August 27, 2026). Its current state is not fully

described in the recovery notes. The MVP scope assumes the

existing website is the base and is brought to the state above

with modest effort.



What Tier 2 requires:



\- The registration form is functional and creates a real CLIENT

&#x20; organization and user in the production cloud.

\- The download page links to the Client Dashboard installer for at

&#x20; least one platform. The Agent App installer link is added when

&#x20; the Agent App exists.

\- The data protection promise page uses the canonical technical

&#x20; statement and the marketing statement, exactly as defined in the

&#x20; law. It does not use the old formulation "debtor data never

&#x20; touches GORKA's servers."



Explicitly out of scope:



\- A full marketing site with pricing tiers, customer stories,

&#x20; blog, etc. Those are later work.



Source: MULTI-USER-CONCEPT.md §9 (Tier 2); ARCHITECTURAL-LAW.md

v1.3 §20.4, §21.4.



\------------------------------------------------------------------------

6.3 One Working Connector Through the Communication Center

\------------------------------------------------------------------------



One working connector, through the client's own provider account

(BYO). The MVP does not include a GORKA-managed connector.



Status: NOT STARTED for the end-to-end client-side flow. The

backend side is DELIVERED (Phase 14).



What Tier 2 requires:



\- The client provides their own provider API key (for example,

&#x20; Mocean for SMS).

\- The key is stored locally, encrypted, on the client's machine.

&#x20; It never reaches GORKA's cloud.

\- The Agent App (or Client Dashboard) sends the message directly

&#x20; to the provider. Message content never reaches GORKA's cloud.

\- Only aggregate usage counts are reported to cloud (Phase 14

&#x20; already implements the endpoint; the client-side reporting is

&#x20; in scope for the MVP).

\- The connector's enablement metadata is stored in cloud

&#x20; (client\_connectors). This is already delivered on the backend

&#x20; (Phase 14).



Explicitly out of scope in Tier 2 (see Section 7, Tier 3):



\- A GORKA-managed Mocean path. CONNECTOR-LIFECYCLE.md records

&#x20; Mocean Tier 1 as not yet confirmed. GORKA-managed connectors

&#x20; are a funded-phase question.

\- Other connectors (Twilio, Resend, WhatsApp, voice).



Source: MULTI-USER-CONCEPT.md §9 (Tier 2); CONNECTOR-LIFECYCLE.md;

DATA-BOUNDARY-MATRIX.md §14.



\------------------------------------------------------------------------

6.4 Basic AI Copilot — One Prompt, One Recommendation, One Draft

\------------------------------------------------------------------------



The AI Copilot produces one recommendation and one drafted message

using only local data and the client's own provider credentials.



Status: NOT STARTED.



What Tier 2 requires:



\- One prompt assembled locally, from data that is already on the

&#x20; client's machine.

\- Sent directly from the client's machine to the AI provider's API

&#x20; (Gemini, in the current plan), using the client's own credentials

&#x20; or a GORKA-provided key that is stored locally.

\- The response is received directly by the client's machine.

\- The response is stored locally, in the local SQLCipher database.

\- GORKA's Control Plane is not on the path. There is no

&#x20; GORKA-managed relay for debtor-content prompts.

\- One workflow only. One recommendation. One draft. No further

&#x20; capability is in scope.



The flow:



&#x20;   Client machine

&#x20;       |

&#x20;       |  prompt (assembled locally)

&#x20;       v

&#x20;   AI provider API (Gemini)

&#x20;       |

&#x20;       |  response

&#x20;       v

&#x20;   Client machine — stored locally



&#x20;   GORKA's Control Plane is not on this path.



The zone this flow lives in:



The AI Copilot's flow, as described above, is entirely within the

client's own control. GORKA is not on the path. This is not Zone 2

(GORKA-provided mechanisms) and it is not the built-in connector

case. It is closer to Zone 3 — a client-controlled connection to a

third party — except that GORKA is providing the local mechanism

that assembles the prompt and stores the response, and the mechanism

must itself respect the invariant.



What this means concretely:



\- The mechanism GORKA provides (the local prompt assembler and the

&#x20; local response store) must be designed so that debtor data does

&#x20; not pass through it in a way that would reach GORKA's cloud. The

&#x20; mechanism is the guard, per law §21.2.

\- The client connects to the AI provider with the client's own

&#x20; credentials. GORKA is not the intermediary. The prompt goes

&#x20; directly from the client's machine to the provider.

\- The response goes directly from the provider to the client's

&#x20; machine. GORKA is not on the path.

\- The response is stored locally. It is not sent to GORKA's cloud.

\- If the client connects to a different AI provider by a path GORKA

&#x20; does not control (for example, they wire the app to their own

&#x20; ChatGPT account outside the built-in mechanism), that is Zone 3.

&#x20; GORKA warns. The client decides.



Explicitly out of scope in Tier 2 (see Section 7, Tier 3):



\- Multi-channel drafting.

\- Outcome tracking.

\- Structured recommendation across many cases.

\- Any GORKA-managed AI relay for debtor-content prompts.

\- Any AI prompt or response containing debtor info reaching GORKA's

&#x20; cloud. This is forbidden by the invariant, not deferred.



Source: MULTI-USER-CONCEPT.md §9 (Tier 2); DATA-BOUNDARY-MATRIX.md

§8; RECOVERY-RULES.md Rule 8; ARCHITECTURAL-LAW.md v1.3 §21.



\------------------------------------------------------------------------

6.5 Local Encrypted Data on Disk, Visible in the Demonstration

\------------------------------------------------------------------------



The demonstration must show that the client's local data is

encrypted at rest. A SQLCipher file is unreadable without the

client's password.



Status: DELIVERED. SQLCipher encryption is active and has been

empirically verified (first 16 bytes are not "SQLite format 3").



What Tier 2 requires:



\- The demonstration includes this step: open the SQLCipher file

&#x20; and show that it is not readable.

\- No further implementation work is required for this item.



Source: MULTI-USER-CONCEPT.md §9 (Tier 2), §10; DECISIONS.md,

September 13, 2026 ("Phase 9 — Blocked — September 13, 2026").



\------------------------------------------------------------------------

6.6 Tier 2 — Status Summary

\------------------------------------------------------------------------



| Item | Status |

|------|--------|

| Owner Dashboard sync activity metadata view | NOT STARTED (Boundary Proofs page already DELIVERED) |

| Marketing website with registration and download | Existing website present; state not fully known; work NOT STARTED for the MVP-required additions |

| One working connector through the Communication Center (BYO) | Client-side flow NOT STARTED; backend DELIVERED |

| Basic AI Copilot (one prompt, one recommendation, one draft) | NOT STARTED |

| Local encrypted data on disk, visible in the demonstration | DELIVERED |



Tier 2 is not complete until every row above is DELIVERED and

demonstrable.



========================================================================

7\. TIER 3 — BUTTONS, DOCUMENTATION, ROADMAP ONLY

========================================================================



Tier 3 items are explicitly out of scope for the MVP. They are not

to be implemented, not to be fixed, and not to be started as part

of the MVP work. Where they appear in the product, they appear as

buttons that say "coming soon," documentation, or roadmap entries.



Naming a Tier 3 item in this document is not a commitment to build

it. It is a commitment to not build it during the MVP.



The items below are restated from MULTI-USER-CONCEPT.md §9 (Tier 3)

and from the DECISIONS.md entries that record them as deferred.



The status value for every item in this section is ROADMAP ONLY.



\------------------------------------------------------------------------

7.1 Other Connectors

\------------------------------------------------------------------------



Connectors other than the one BYO connector selected for the MVP

(Section 6.3).



Status: ROADMAP ONLY.



Named as roadmap:



\- Twilio (SMS, voice).

\- Resend (email).

\- WhatsApp.

\- GORKA-managed Mocean (Tier 1). CONNECTOR-LIFECYCLE.md records

&#x20; Mocean Tier 1 as not yet confirmed.

\- Any GORKA-managed connector. GORKA-managed connectors are a

&#x20; funded-phase question.



Source: MULTI-USER-CONCEPT.md §9 (Tier 3); CONNECTOR-LIFECYCLE.md.



\------------------------------------------------------------------------

7.2 Key Rotation, Offboarding, and Lost-Device Flows

\------------------------------------------------------------------------



Status: ROADMAP ONLY. Documented, not implemented.



Named as roadmap:



\- Key rotation for the organization key.

\- Offboarding flows for departing agents.

\- Lost-device flows: remove a device from the organization, rotate

&#x20; the organization key so future traffic is not readable by the

&#x20; lost device.



The critical caveat from MULTI-USER-CONCEPT.md §8 applies and must

be stated plainly when these flows are eventually built:



> Revocation prevents future synchronization. It does not

> guarantee deletion of data already replicated to the device.



Source: MULTI-USER-CONCEPT.md §8, §9 (Tier 3).



\------------------------------------------------------------------------

7.3 Per-Machine Device Identity

\------------------------------------------------------------------------



In the MVP, device identity is the user account. An agent can log

in from any machine. There is no per-machine registration.



In production, each machine is a registered entity within the

organization. Each machine is enrolled, listed, and can be

individually revoked.



Status: ROADMAP ONLY. Documented, planned, not implemented in the

MVP.



The two Control Plane tables (device\_registrations,

relay\_sessions) exist and support the MVP's discovery, presence,

and relay functions. In the MVP, they record user-account-based

device entries. They become the foundation for per-machine

identity in the funded phase.



Source: MULTI-USER-CONCEPT.md §5, §9 (Tier 3); CLOUD-TABLES.md

v1.2 §20.1.



\------------------------------------------------------------------------

7.4 Mesh Topology

\------------------------------------------------------------------------



The MVP uses hub-and-spoke topology. Production uses mesh

topology, in which any two authorized machines in the organization

sync directly with each other and the admin's machine is no longer

a single point of coordination.



Status: ROADMAP ONLY. Documented, planned, not implemented in the

MVP.



Source: MULTI-USER-CONCEPT.md §4, §9 (Tier 3).



\------------------------------------------------------------------------

7.5 Compliance Dashboard

\------------------------------------------------------------------------



A page listing GORKA's guarantees, suitable for showing to

regulators.



Status: ROADMAP ONLY.



The MVP already has the Boundary Proofs page on the Owner

Dashboard (Phase 12, DELIVERED). This is the existing concrete

compliance surface. A dedicated compliance dashboard is a

separate, larger artifact and is not in scope for the MVP.



Source: MULTI-USER-CONCEPT.md §9 (Tier 3).



\------------------------------------------------------------------------

7.6 Full AI Copilot Capability

\------------------------------------------------------------------------



The MVP AI Copilot does one prompt, one recommendation, one

draft (Section 6.4). The full AI Copilot is described in the

roadmap: multi-channel drafting, outcome tracking, structured

recommendation across many cases.



Status: ROADMAP ONLY.



Source: MULTI-USER-CONCEPT.md §9 (Tier 3).



\------------------------------------------------------------------------

7.7 Owner Dashboard Pages That Call Non-Existent Endpoints

\------------------------------------------------------------------------



The Owner Dashboard currently contains pages that call backend

endpoints that do not exist:



\- GET /clients, /clients/:id, and the client actions

&#x20; (verify, suspend, reject, reinstate)

\- GET /analytics/overview

\- GET /analytics/usage

\- GET /audit

\- GET /billing/revenue

\- GET /status



These pages are mock or fail to load. This is a pre-existing

condition, recorded in DECISIONS.md (Phase 12) and in START-HERE.md

§10 as a known issue.



Status: ROADMAP ONLY. Explicitly out of scope for the MVP.



The MVP adds only the new sync activity metadata view (Section

6.1) to the Owner Dashboard. It does not fix, fill in, or

otherwise complete the pre-existing Owner Dashboard pages.



Source: DECISIONS.md, September 13, 2026 (Phase 12); START-HERE.md

§10.



\------------------------------------------------------------------------

7.8 Threat Model and Independent Security Review

\------------------------------------------------------------------------



A written threat model and an independent security review, 3 to 5

pages, are required before shipping to real customers.



Status: NOT IN THE MVP. To be written after this document and

SYNC-ARCHITECTURE.md. See Section 11 (Prerequisites for

Implementation).



This is not a Tier 3 feature. It is a document that must exist

before implementation of the sync engine begins. It is listed here

so that no reader mistakes it for an MVP feature.



Source: MULTI-USER-CONCEPT.md §12, §14; DECISIONS.md, September 17,

2026\.



\------------------------------------------------------------------------

7.9 Tier 3 — Status Summary

\------------------------------------------------------------------------



| Item | Status |

|------|--------|

| Other connectors | ROADMAP ONLY |

| Key rotation, offboarding, lost-device flows | ROADMAP ONLY |

| Per-machine device identity | ROADMAP ONLY |

| Mesh topology | ROADMAP ONLY |

| Compliance dashboard | ROADMAP ONLY |

| Full AI Copilot capability | ROADMAP ONLY |

| Owner Dashboard pages calling non-existent endpoints | ROADMAP ONLY |

| Threat model / independent security review | Not an MVP feature; a prerequisite document (Section 11) |



No item in Tier 3 is to be implemented as part of the MVP work.



========================================================================

8\. THE MVP EVENT SET AND THE SYNCHRONIZED OBJECTS

========================================================================



The sync engine is event-based from the beginning. This section

defines the MVP event set and the exact set of objects the MVP

synchronizes. Both must be pinned down before SYNC-ARCHITECTURE.md

is written, because a developer who is not told what to synchronize

will make assumptions.



Source: MULTI-USER-CONCEPT.md §7; LOCAL-TABLES.md v1.2 Category D

(sync\_events).



\------------------------------------------------------------------------

8.1 The MVP Event Types

\------------------------------------------------------------------------



The MVP populates the sync event table with four event types:



\- DEBTOR\_CREATED — a new debtor record was created on this device.

\- DEBTOR\_UPDATED — a mutable property of an existing debtor was

&#x20; changed on this device.

\- ACTION\_CREATED — a new action was created on this device.

\- COMMUNICATION\_LOGGED — a new communication was logged on this

&#x20; device.



These four are enough to demonstrate the architecture: a new

record crossing from one machine to another, a state change

crossing, and two kinds of append-only events crossing.



No other event types are produced in the MVP.



Source: MULTI-USER-CONCEPT.md §7 (MVP event set).



\------------------------------------------------------------------------

8.2 What Is Deliberately Not in the MVP Event Set

\------------------------------------------------------------------------



The following event types exist in the full model. They are added

in the funded phase. They are not produced in the MVP.



\- PAYMENT\_RECORDED

\- PROMISE\_CREATED

\- PROMISE\_BROKEN

\- CALL\_LOGGED

\- SMS\_SENT

\- EMAIL\_SENT

\- NOTE\_ADDED

\- STATUS\_CHANGED

\- CONTACT\_ATTEMPTED



They are named here only so that no future session mistakes their

absence for a defect.



Source: MULTI-USER-CONCEPT.md §7 (later event types).



\------------------------------------------------------------------------

8.3 Why the Table and Protocol Assume the Full Set

\------------------------------------------------------------------------



The event table, the wire format, and the reconciliation logic are

built from the beginning to hold any event type. The MVP produces

only four, but the architecture does not.



The reason: choosing events now avoids a data migration later.

When the funded phase adds PAYMENT\_RECORDED and the others, it

adds them to a system that already records events. There is no

migration, no schema change to the sync tables, and no change to

the wire format.



Source: MULTI-USER-CONCEPT.md §7.



\------------------------------------------------------------------------

8.4 The Exact Objects Synchronized in the MVP

\------------------------------------------------------------------------



The MVP synchronizes the following objects. The list is exact.

Anything not on the list is not synchronized in the MVP.



Synchronized in the MVP:



\- Debtor records. Fields: id, name, surname, email, phone, data

&#x20; (JSON), created\_at, updated\_at. Synchronized as state

&#x20; (DEBTOR\_CREATED, DEBTOR\_UPDATED).

\- Debts. Fields: id, debtor\_id, amount, currency, status,

&#x20; due\_date, description, data (JSON), created\_at, updated\_at.

&#x20; Synchronized as state (carried by DEBTOR\_CREATED and

&#x20; DEBTOR\_UPDATED events on the parent debtor, and by the debt's

&#x20; own change record).

\- Actions. Fields: id, debtor\_id, type, status, assigned\_to,

&#x20; due\_date, description, data (JSON), created\_at, updated\_at.

&#x20; Synchronized as events (ACTION\_CREATED) and as state for later

&#x20; changes.

\- Communications. Fields: id, debtor\_id, type, direction,

&#x20; content, duration, created\_by, created\_at. Synchronized as

&#x20; append-only events (COMMUNICATION\_LOGGED). Never overwritten.

\- Document metadata. Fields: id, entity\_id, entity\_type,

&#x20; file\_name, file\_type, file\_size, category, description,

&#x20; uploaded\_by, is\_primary, data (JSON), created\_at. Synchronized

&#x20; as metadata.



Deliberately not synchronized in the MVP (metadata only):



\- Document contents. The MVP synchronizes document metadata, not

&#x20; the file itself. The file remains on the device where it was

&#x20; uploaded. Synchronizing document contents across a hub-and-spoke

&#x20; topology is a substantial engineering problem (size, bandwidth,

&#x20; offline behavior, partial transfer, versioning) and is not

&#x20; required by the MVP demonstration. It is a funded-phase item,

&#x20; and it will be added without changing the event table or the

&#x20; wire format, because a document is an object with metadata, and

&#x20; its content transfer is an additional mechanism layered on top.



\- AI prompts and responses. The MVP stores them locally, on the

&#x20; device that produced them. They are not synchronized. They are

&#x20; not in the MVP event set. If and when they become synchronized

&#x20; in the funded phase, they will be appended as new event types

&#x20; without changing the existing ones.



This list is the answer to "what does the MVP synchronize?" If a

future session finds itself synchronizing an object not on this

list, it is expanding the MVP scope, which requires an amendment

to this document.



Source: LOCAL-TABLES.md v1.2 Category A and Category D;

MULTI-USER-CONCEPT.md §7.



\------------------------------------------------------------------------

8.5 State vs. Events — the Two Categories

\------------------------------------------------------------------------



The MVP distinguishes two categories of synchronized data.



State — mutable properties of a record. For example, a debtor's

current name, phone, address, status, or assigned agent. State is

synchronized with deterministic rules. When two machines change

the same field to different values, the most recent change wins,

and the previous value is recorded.



Events — append-only business facts. The four MVP event types

(Section 8.1), and in the funded phase the larger set (Section

8.2). Events are never overwritten. Two agents recording two

communications produce two events. Both survive.



The distinction is not cosmetic. It is the rule that determines

what happens on a conflict. State values reconcile. Events

accumulate.



The sync protocol operates on immutable logical events and on

deterministic state rules. It does not synchronize database files,

and it does not blindly replace rows. This is a hard requirement

of the MVP.



Source: MULTI-USER-CONCEPT.md §7.



\------------------------------------------------------------------------

8.6 "Most Recent" Is Not Wall-Clock Time

\------------------------------------------------------------------------



The MVP event set and the state reconciliation rule both depend on

a precise definition of "most recent." That definition is NOT

wall-clock time. Distributed clocks cannot be trusted to establish

globally correct ordering.



The correct rule — a logical ordering, a sequence number, a

protocol-defined tiebreaker — is defined in SYNC-ARCHITECTURE.md.

It is deliberately left open in this document and in

MULTI-USER-CONCEPT.md.



The local sync event table (LOCAL-TABLES.md v1.2, table D.1)

carries two fields that support the rule:



\- sequence — monotonic per device, for ordering.

\- logical\_clock — protocol-defined ordering.



How these fields are used is part of SYNC-ARCHITECTURE.md.



Source: MULTI-USER-CONCEPT.md §7 ("Most Recent" requires a precise

definition); LOCAL-TABLES.md v1.2 D.1.



\------------------------------------------------------------------------

8.7 The Application Audit Log Is Not the Sync Protocol's Memory

\------------------------------------------------------------------------



There are two separate things, and they must not be merged:



\- The application audit log — a record of who did what, for

&#x20; compliance and human review. It lives in the local audit\_log

&#x20; table (LOCAL-TABLES.md Category A.6).

\- The sync protocol's change history — the events and state

&#x20; changes that machines exchange to reconcile. It lives in the

&#x20; local sync\_events table (LOCAL-TABLES.md Category D.1).



The application audit log is not the sync protocol's source of

truth. The sync protocol maintains its own change history, in its

own table, for its own purpose. This distinction was identified

during external review of the multi-user concept and is essential.



The MVP must keep both. Neither replaces the other.



Source: MULTI-USER-CONCEPT.md §7; LOCAL-TABLES.md v1.2 Category D

(introduction) and A.6.



\------------------------------------------------------------------------

8.8 What the MVP Event Set Does Not Permit

\------------------------------------------------------------------------



The MVP event set does not permit:



\- An event to be overwritten or deleted once created.

\- An event to be produced in cloud. Events live only on the

&#x20; client's devices and travel between them only in encrypted form.

\- The application audit log to be treated as the sync protocol's

&#x20; change history.

\- Wall-clock time to be used as the ordering rule.

\- Any event containing debtor data to be written to GORKA's cloud

&#x20; in readable form.

\- Blind row replacement or database-file synchronization as the

&#x20; sync mechanism. The protocol works on logical events and

&#x20; deterministic state rules.



Source: MULTI-USER-CONCEPT.md §7; DATA-BOUNDARY-MATRIX.md v1.2

§20.3; ARCHITECTURAL-LAW.md v1.3 §20, §21.



========================================================================

9\. OPERATIONAL LIMITATIONS OF THE MVP

========================================================================



The MVP is a working product with constraints. Every constraint is

stated here so that no client, investor, or future engineer

mistakes a deliberate MVP limitation for a defect or for the final

product.



The limitations below are not bugs to be fixed during the MVP.

They are consequences of deliberate scope decisions, and they are

documented in MULTI-USER-CONCEPT.md, ARCHITECTURAL-LAW.md v1.3,

and the DECISIONS.md multi-user entry.



\------------------------------------------------------------------------

9.1 Hub-and-Spoke Topology

\------------------------------------------------------------------------



The MVP uses hub-and-spoke topology. The admin's machine is the

hub. Every agent's machine is a spoke. All sync traffic passes

through the admin's machine.



Consequence: if the admin's machine is offline, agents can still

work locally — their changes queue up — but they cannot see each

other's new changes until the hub returns.



This is not a defect. It is a deliberate choice:



\- Dramatically simpler to build. One connection per machine, not

&#x20; one per pair of machines.

\- Matches a large part of the actual customer base. A professional

&#x20; agency with 10–20+ staff typically has an office machine that is

&#x20; always on.

\- Produces a working demonstration quickly.



The hub is a topology role, not a data-model identity. The protocol

does not treat the hub as permanently special. Production uses mesh

topology. See Section 7.4.



Source: MULTI-USER-CONCEPT.md §4; PHASE-PLAN.md Phase 9.6.



\------------------------------------------------------------------------

9.2 Device Identity Is the User Account

\------------------------------------------------------------------------



In the MVP, device identity is the user account. Agents log in

with credentials provided by the admin. An agent can use GORKA

from any machine by logging in. There is no per-machine

registration.



Consequence: if an agent's machine is stolen, the admin cannot

remove only that machine. The admin can only disable the user

account, which also locks the agent out of their other machines.



For the MVP, with one agent typically using one machine, this is

acceptable.



Production uses combined user + device identity. Each machine is

a registered entity, enrolled, listed, and individually revocable.

See Section 7.3.



Source: MULTI-USER-CONCEPT.md §5.



\------------------------------------------------------------------------

9.3 Single Organization Key — an Explicit MVP Cryptographic

Limitation

\------------------------------------------------------------------------



The MVP uses a single organization-level key, derived from the

organization's identity at setup time. Each sync connection uses

a session key derived from that organization key.



This has a consequence that must be stated plainly, not buried.



MVP cryptographic limitation:



> All authorized devices share the same organization

> data-encryption key. Device-level cryptographic revocation is

> not implemented in the MVP. Removing a user's account prevents

> future synchronization, but it does not invalidate previously

> replicated data or previously obtained keys.



What this means in practice:



\- Every authorized agent's device holds the organization key. Any

&#x20; authorized device can therefore decrypt any replicated data it

&#x20; has received.

\- If a device is lost or an agent leaves, the MVP can disable the

&#x20; user account, but cannot undo the fact that the device already

&#x20; holds the organization key and any data it has replicated.

\- Key rotation, per-device keys, offboarding flows, and lost-device

&#x20; recovery are funded-phase items (Section 7.2). They will be added

&#x20; without redesigning the protocol, because the sync protocol is

&#x20; structured so device identity and session keys are first-class

&#x20; concepts in the wire format, even though the MVP derives them

&#x20; simply.



This limitation is stated in MULTI-USER-CONCEPT.md §8 and §12 and

is repeated here as an explicit MVP limitation, not as a Tier 3

footnote. It is the honest description of what the MVP is.



Source: MULTI-USER-CONCEPT.md §6, §8, §12.



\------------------------------------------------------------------------

9.4 Revocation Prevents Future Sync, Not Existing Copies

\------------------------------------------------------------------------



The MVP does not implement revocation flows (Section 7.2). But the

underlying property must be stated plainly now, because it will

apply as soon as revocation exists:



> Revocation prevents future synchronization. It does not

> guarantee deletion of data already replicated to the device.



Any device that has ever synced holds a local copy of the data it

was authorized to access. This is true of any product that stores

data locally. GORKA cannot delete data on a machine it cannot

reach. That is physics, not policy.



This must be stated plainly in the client-facing documentation so

that no client is surprised later.



Source: MULTI-USER-CONCEPT.md §8.



\------------------------------------------------------------------------

9.5 The Encrypted Relay Is an Operational Necessity

\------------------------------------------------------------------------



The MVP uses GORKA's encrypted relay when a direct connection is

not possible. The relay passes end-to-end encrypted traffic it

cannot decrypt. It may observe connection metadata: which devices

are connected, when, and how much data is passing.



Consequence: the Control Plane sees that two devices communicated,

when, and how much. It does not see what was communicated.



This is what makes the canonical promise defensible. The old

promise — "debtor data never touches GORKA's servers" — was

technically indefensible, because a relay is sometimes required.

The new promise — "GORKA cannot decrypt your debtor data" — is

true in every network configuration.



This must be stated plainly in compliance documentation. A

sophisticated bank's security reviewer may ask.



Source: MULTI-USER-CONCEPT.md §3; ARCHITECTURAL-LAW.md v1.3 §20.3,

§20.4, §21; DATA-BOUNDARY-MATRIX.md v1.2 §20.2.



\------------------------------------------------------------------------

9.6 Control Plane Metadata the MVP Must Be Honest About

\------------------------------------------------------------------------



The Control Plane necessarily sees the metadata required to broker

connections between client devices. In the MVP this includes:



\- Which organization a device belongs to.

\- Which devices belong to which organization.

\- Device presence (online/offline).

\- IP addresses and network endpoints (for discovery and relay).

\- Connection timestamps.

\- Connection attempts (success/failure).

\- Encrypted traffic volume per device pair (for relay capacity

&#x20; planning). No content.



None of this is debtor data. None of it identifies any individual

debtor. None of it reveals what was synchronized, only that

something was.



This must be stated plainly in compliance documentation. It is

recorded in DATA-BOUNDARY-MATRIX.md v1.2 §20.2 and it is repeated

here so that no reader of this document mistakes the Control

Plane's metadata for something it is not.



Source: DATA-BOUNDARY-MATRIX.md v1.2 §20.2; CLOUD-TABLES.md v1.2

§20.1, §20.2.



\------------------------------------------------------------------------

9.7 Wall-Clock Time Is Not the Ordering Rule

\------------------------------------------------------------------------



The MVP does not trust wall-clock time to establish ordering of

synchronized changes. Distributed clocks cannot be trusted for

that purpose.



Consequence: the rule the MVP uses to decide which state change

is "most recent" is not the timestamp on the device. It is a

logical ordering defined in SYNC-ARCHITECTURE.md. See Section 8.6.



Source: MULTI-USER-CONCEPT.md §7.



\------------------------------------------------------------------------

9.8 The MVP Does Not Include Cryptographic Specialist Review

\------------------------------------------------------------------------



The MVP uses established, audited cryptographic libraries. Custom

cryptography is never used.



The MVP does not include a cryptography specialist's review.

Cryptographic primitives are straightforward when using

established libraries, but the surrounding work — nonce

generation, replay protection, message ordering, duplicate

detection, device authentication, protocol versioning, malicious

message handling, and downgrade prevention — is the harder

problem and belongs to the funded phase with specialist security

review.



The MVP is proof the founder can build the whole thing. Funding

turns it into a mature product. See Section 7.8.



Source: MULTI-USER-CONCEPT.md §6, §12.



\------------------------------------------------------------------------

9.9 Third-Party Privacy Boundary

\------------------------------------------------------------------------



"GORKA cannot read it" is not the same as "it never leaves your

machine."



This distinction matters for the AI Copilot (Section 6.4). When

the client's machine sends a prompt to Gemini, the prompt leaves

the client's machine and goes to Gemini's infrastructure. GORKA

is not on the path and cannot read the prompt or the response.

But the data has left the client's machine by the client's own

act, on a path the client controls.



This is the three-zone model, defined in ARCHITECTURAL-LAW.md v1.3

§21:



\- Zone 1 (GORKA cloud): no debtor data in readable form.

\- Zone 2 (GORKA-provided mechanisms): GORKA's obligation is

&#x20; prevention. The mechanism is the guard.

\- Zone 3 (client-connected third parties): GORKA's obligation is

&#x20; warning. The client decides.



The MVP implements all three:



\- Zone 1: the invariant, unchanged.

\- Zone 2: GORKA's built-in mechanisms (connector, AI Copilot's

&#x20; local prompt assembler) are designed so debtor data cannot pass

&#x20; through them to GORKA's cloud.

\- Zone 3: when the client connects GORKA to a third party by a

&#x20; path GORKA does not control, GORKA warns the client at the

&#x20; point of connection and records the warning.



The marketing statement is worded for this case: "your debtor data

stays under your control." It means the client decides. It does

not mean the data never leaves the machine.



Source: ARCHITECTURAL-LAW.md v1.3 §21; MULTI-USER-CONCEPT.md §3;

DATA-BOUNDARY-MATRIX.md §8.



\------------------------------------------------------------------------

9.10 Summary of Operational Limitations

\------------------------------------------------------------------------



| Limitation | Consequence |

|------------|-------------|

| Hub-and-spoke topology | If the hub is offline, agents see no new changes until it returns |

| Device identity is the user account | Cannot revoke a single lost machine without disabling the user |

| Single organization key | No per-device keys, key rotation, offboarding, or lost-device recovery in the MVP. All authorized devices share the same key. |

| Revocation prevents future sync only | Data already replicated to an unreachable device cannot be deleted |

| The encrypted relay is necessary | The Control Plane sees connection metadata: who communicated, when, how much; never content |

| Control Plane metadata | The Control Plane knows devices and presence, not debtors |

| No wall-clock ordering | Ordering uses a logical rule defined in SYNC-ARCHITECTURE.md |

| No specialist crypto review in the MVP | The primitive choices are standard; the protocol design review is a funded-phase item |

| Third-party boundary | If the client connects GORKA to a third party, data leaves the client's machine by the client's own act; GORKA warns and records the warning |

| Document contents not synchronized | Only document metadata is synchronized in the MVP; the file remains on the device where it was uploaded |



None of these limitations is a defect. Each is a deliberate scope

decision. Every one is superseded in the funded phase.



========================================================================

10\. THE DEMONSTRATION

========================================================================



The demonstration is the proof. It is not a slide deck. It is two

machines, side by side, and a few seconds.



The demonstration is Phase 9.7. It depends on Tier 1 (Section 5)

being complete. It is the final acceptance test of the MVP.



Source: MULTI-USER-CONCEPT.md §10; PHASE-PLAN.md Phase 9.7.



\------------------------------------------------------------------------

10.1 The Hardware

\------------------------------------------------------------------------



The demonstration requires two machines that can each run a GORKA

Tauri application.



The specific hardware is not yet decided and does not need to be

decided now. The acceptable configurations are:



\- Two physical laptops.

\- One physical laptop and one cloud Windows environment.

\- Two cloud Windows environments connected from the same

&#x20; operator's session.



The Smart App Control (SAC) block on the founder's current main

machine is a known constraint. The demonstration is designed to

route around it, using a cloud Windows environment for whichever

machine cannot run a signed binary locally.



The decision on which configuration to use is a Phase 9.7 concern,

not a Phase 9.5 or 9.6 concern. It is recorded here as deferred.



Source: MULTI-USER-CONCEPT.md §10; DECISIONS.md, September 15,

2026 (SAC investigation and cloud development environment

decision).



\------------------------------------------------------------------------

10.2 What the Demonstration Shows

\------------------------------------------------------------------------



The demonstration is a single sequence, side by side on two

machines. One machine runs the Client Dashboard (the admin). The

other runs the Agent App (the agent).



The sequence:



1\. Both machines are connected to the Control Plane and to each

&#x20;  other. The sync indicator on each machine shows synced.



2\. The admin creates a debtor on the admin's machine. Within

&#x20;  seconds, the debtor appears on the agent's machine. No refresh.

&#x20;  No manual export.



3\. The agent logs an action on the agent's machine. Within seconds,

&#x20;  it appears on the admin's machine.



4\. A network capture is shown. The sync traffic between the two

&#x20;  machines is ciphertext. No readable debtor data appears in the

&#x20;  capture.



5\. A key-custody review is shown. The organization key exists only

&#x20;  on the client's devices. The Control Plane holds no organization

&#x20;  key, no device private key, and no session key capable of

&#x20;  decrypting a captured payload. An attempt to decrypt a captured

&#x20;  relay payload using Control Plane credentials fails.



6\. The GORKA Owner Dashboard is shown. It displays that the two

&#x20;  machines are connected. It displays nothing about the debtors —

&#x20;  because GORKA cannot see them.



7\. The client's local data is shown to be encrypted at rest. The

&#x20;  SQLCipher file is opened and shown to be unreadable without the

&#x20;  client's password.



That is the demonstration. It is not a slide. It is two machines

and a few seconds.



Source: MULTI-USER-CONCEPT.md §10; BOUNDARY-TEST-PLAN.md §2.4.



\------------------------------------------------------------------------

10.3 What the Demonstration Does Not Show

\------------------------------------------------------------------------



The demonstration does not show:



\- Mesh topology. The MVP is hub-and-spoke.

\- More than two machines. The MVP demonstration is two.

\- Per-machine device identity. The MVP uses user-account identity.

\- Key rotation, offboarding, or lost-device flows. These are

&#x20; funded-phase items.

\- Any GORKA-managed connector. The MVP connector is BYO.

\- A full AI Copilot. The MVP shows one prompt, one recommendation,

&#x20; one draft.

\- Document content synchronization. The MVP synchronizes document

&#x20; metadata only.

\- Any debtor data appearing anywhere on GORKA's infrastructure.



These are not failures. They are deliberate MVP scope decisions,

recorded in Sections 6, 7, 8, and 9.



\------------------------------------------------------------------------

10.4 Rehearsal and Backup Video

\------------------------------------------------------------------------



Phase 9.7 requires that the demonstration be rehearsable and

reliable. Specifically:



\- A written demonstration script, documented in the recovery

&#x20; notes.

\- Rehearsed at least three times.

\- A documented recovery procedure for each step, in case something

&#x20; fails during the live demonstration.

\- A backup video recorded.



The demonstration is complete when it works on three consecutive

rehearsals without changes.



Source: PHASE-PLAN.md Phase 9.7.



\------------------------------------------------------------------------

10.5 What the Demonstration Shows, and Why "Shows" Not "Proves"

\------------------------------------------------------------------------



The demonstration shows the canonical technical statement:



> GORKA cannot decrypt your debtor data. This is an architectural

> property, not a policy.



It shows it by combining two kinds of evidence, both of which are

required:



1\. The debtor record exists on both machines.

2\. The record crossed between them.

3\. The traffic on the wire is ciphertext (network capture).

4\. The Control Plane holds no key capable of decrypting the traffic

&#x20;  (key-custody review).

5\. A captured payload cannot be decrypted using any credential

&#x20;  available to the Control Plane.

6\. GORKA's infrastructure holds nothing readable.

7\. The client's local data is encrypted at rest.



The two kinds of evidence do different jobs:



\- The network capture shows what an observer on the wire sees. It

&#x20; does not, by itself, show that GORKA cannot decrypt.

\- The key-custody review shows that GORKA has no key to decrypt

&#x20; with. That is what makes "cannot decrypt" a demonstration rather

&#x20; than an assertion.



A network capture alone would be too weak a claim. Ciphertext on

the wire plus no key to read it is the full statement.



The demonstration is the MVP's final acceptance test.



Source: ARCHITECTURAL-LAW.md v1.3 §20.4, §21; MULTI-USER-CONCEPT.md

§10; BOUNDARY-TEST-PLAN.md §2.4 (extended proof test).



\------------------------------------------------------------------------

10.6 The Extended Proof Test

\------------------------------------------------------------------------



The demonstration is the human-facing form of the extended proof

test defined in BOUNDARY-TEST-PLAN.md §2.4. The automated version

of the same test is one of the acceptance criteria (Section 12 of

this document).



The extended proof test:



\- Runs two client devices.

\- Synchronizes a debtor record between them through the relay.

\- Captures all traffic on GORKA's infrastructure.

\- Inspects every stored row in device\_registrations and

&#x20; relay\_sessions.

\- Verifies that the captured traffic is ciphertext and the stored

&#x20; rows contain only metadata.

\- Attempts to decrypt a captured payload using every credential

&#x20; available to the Control Plane. The attempt must fail.



Expected result: zero readable debtor data in any GORKA-controlled

log, storage, or captured byte. No key material present. No

successful decryption from the Control Plane's side.



If readable debtor data appears, if any key material is found on

GORKA's infrastructure, or if a Control Plane credential can

decrypt a captured payload, the architecture is broken.



Source: BOUNDARY-TEST-PLAN.md §2.4.



========================================================================

11\. PREREQUISITES FOR IMPLEMENTATION

========================================================================



No implementation of the multi-user model begins until the

prerequisites in this section are met. This is a hard gate. It is

recorded in MULTI-USER-CONCEPT.md §14, in DECISIONS.md (September

17, 2026), and in START-HERE.md §8.



The gate exists for one reason: without these documents, the sync

engine cannot be built without the developer making architectural

assumptions that the concept document deliberately leaves open.

Those assumptions would become unrecorded architecture.



Source: MULTI-USER-CONCEPT.md §14; DECISIONS.md, September 17,

2026; START-HERE.md §8.



\------------------------------------------------------------------------

11.1 The Three Documents

\------------------------------------------------------------------------



Three documents must be written and approved before implementation

begins.



Document 1 — GORKA-MVP-SCOPE.md (this document).



Defines the MVP in full: every block, every constraint, every

out-of-scope item, and the acceptance criteria that determine when

the MVP is complete.



Status: In progress. This document.



Document 2 — SYNC-ARCHITECTURE.md.



The technical specification of the sync engine. It is the document

a developer follows.



Status: NOT STARTED. Written after this document is approved.



Document 3 — Threat model / security review.



Three to five pages. Who can attack what, what GORKA can see, what

a compromised device can do, what happens when a device is lost.



Status: NOT STARTED. Written after SYNC-ARCHITECTURE.md.



Source: MULTI-USER-CONCEPT.md §14; DECISIONS.md, September 17,

2026\.



\------------------------------------------------------------------------

11.2 What SYNC-ARCHITECTURE.md Must Answer

\------------------------------------------------------------------------



This document defines what the sync engine must do. It does not

define how. The following questions are deliberately left open

here and must be answered in SYNC-ARCHITECTURE.md before any code

is written:



\- Device identity.

\- Organization identity.

\- Authentication.

\- Enrollment.

\- Key creation.

\- Key storage.

\- Key distribution.

\- Session-key establishment.

\- Message format.

\- Message IDs.

\- Event IDs.

\- Originating device.

\- Ordering — including the precise rule for "most recent," which

&#x20; must not depend on wall-clock time.

\- Duplicate detection.

\- Acknowledgements.

\- Offline queue.

\- Retry.

\- Conflict resolution — including how state reconciliation and

&#x20; event accumulation interact, and how out-of-order arrival is

&#x20; handled.

\- Direct connection.

\- Relay fallback.

\- Corrupt or invalid message handling.

\- Protocol versioning.

\- Recovery after interruption — including what happens if a

&#x20; connection drops partway through a synchronization.

\- What metadata GORKA sees.

\- What GORKA can never see.



Each of these is a question this document does not answer and

SYNC-ARCHITECTURE.md must.



Source: MULTI-USER-CONCEPT.md §14; DECISIONS.md, September 17,

2026\.



\------------------------------------------------------------------------

11.3 The Order

\------------------------------------------------------------------------



The order is fixed:



1\. GORKA-MVP-SCOPE.md — this document. Defines what the sync

&#x20;  engine must do.

2\. SYNC-ARCHITECTURE.md — defines how.

3\. Threat model / security review.

4\. Implementation begins.



This order was decided by the founder. It corrects an earlier

ordering in MULTI-USER-CONCEPT.md §14 and in the DECISIONS.md

September 17 entry, both of which listed SYNC-ARCHITECTURE.md

first. The earlier references are to be corrected in a future

cleanup pass. See Section 1 of this document.



Source: founder's decision, recorded in this document.



\------------------------------------------------------------------------

11.4 What the Gate Does Not Block

\------------------------------------------------------------------------



The gate blocks implementation of the multi-user model. It does

not block other work that is independent of the sync engine.



Work that may proceed in parallel with the writing of the three

documents:



\- Completing the V2 Cloud (or alternate) Windows development

&#x20; environment setup. This is needed to test Phase 9 item 4 and to

&#x20; build the sync engine later.

\- Testing Phase 9 item 4 (Action CRUD) once the environment is

&#x20; available. Item 4 is already code complete.

\- Bringing the existing marketing website to the MVP-required

&#x20; state (Section 6.2). This is independent of the sync engine.

\- Any documentation cleanup that the founder directs.



Work that may not proceed:



\- Any code for the sync engine.

\- Any schema change to local sync tables beyond what

&#x20; LOCAL-TABLES.md v1.2 Category D already defines.

\- Any application of the two new Control Plane tables

&#x20; (device\_registrations, relay\_sessions) to gorka\_test as part of

&#x20; sync-engine work.

\- Any key-management code.

\- Any relay code.

\- Any change to the wire format.



These are blocked until SYNC-ARCHITECTURE.md and the threat model

are written and approved.



Source: MULTI-USER-CONCEPT.md §14; DECISIONS.md, September 17,

2026\.



\------------------------------------------------------------------------

11.5 Prerequisites Summary

\------------------------------------------------------------------------



| Prerequisite | Status |

|--------------|--------|

| GORKA-MVP-SCOPE.md (this document) | In progress |

| SYNC-ARCHITECTURE.md | NOT STARTED |

| Threat model / security review | NOT STARTED |

| Implementation of the multi-user model | BLOCKED until all three are approved |

| Cloud Windows development environment | NOT YET SET UP (parallel work, does not unblock the gate) |

| Phase 9 item 4 verification | BLOCKED on the cloud environment |



========================================================================

12\. ACCEPTANCE CRITERIA FOR THE MVP

========================================================================



The MVP is complete when every criterion in this section passes.

No criterion may be waived. No criterion may be replaced by a

demonstration that "looks right."



Each criterion is testable. Where a criterion depends on a phase,

the phase is named. Where a criterion depends on a document, the

document is named.



Source: MULTI-USER-CONCEPT.md §9 (Tier 1 acceptance criteria);

PHASE-PLAN.md Phase 9.6; BOUNDARY-TEST-PLAN.md §2.1–§2.4, §7.



\------------------------------------------------------------------------

12.1 Sync Engine Acceptance Criteria (Ten)

\------------------------------------------------------------------------



These ten criteria are the acceptance criteria for the sync engine,

restated from MULTI-USER-CONCEPT.md §9 and PHASE-PLAN.md Phase 9.6.

All ten must pass before Phase 9.6 is declared complete, and thus

before the MVP is complete.



1\. Initial synchronization between two machines.

&#x20;  Two machines, one hub and one spoke, establish their first

&#x20;  synchronization and converge to the same logical state.



2\. New debtor propagation.

&#x20;  A debtor created on one machine appears on the other within the

&#x20;  expected window, with no manual export, no refresh, and no data

&#x20;  loss.



3\. State update propagation.

&#x20;  A change to a mutable property of an existing debtor propagates

&#x20;  and converges, with the deterministic rule applied and the

&#x20;  previous value recorded.



4\. Event propagation (append-only, no loss).

&#x20;  Events propagate and accumulate. No event is overwritten. Two

&#x20;  events of the same type both survive.



5\. Offline modification, followed by reconnect and reconciliation.

&#x20;  A machine modifies its local data while disconnected. When it

&#x20;  reconnects, the changes propagate and the machines reconcile to

&#x20;  the same logical state.



6\. Duplicate prevention.

&#x20;  The same event is not applied twice. Re-sending a message does

&#x20;  not create a duplicate record.



7\. No data loss under normal operation.

&#x20;  Under ordinary use — create, update, disconnect, reconnect,

&#x20;  multiple events — no data is lost.



8\. Direct connection path.

&#x20;  Two machines on a network that allows a direct connection

&#x20;  establish one and synchronize directly.



9\. Relay fallback path.

&#x20;  When a direct connection is not possible, the machines

&#x20;  synchronize through GORKA's encrypted relay, and the relay

&#x20;  cannot decrypt the traffic.



10\. Rejection of corrupted or invalid messages.

&#x20;   A message that is corrupted or invalid is rejected. The

&#x20;   rejecting machine does not apply it, does not crash, and

&#x20;   records the rejection.



Source: MULTI-USER-CONCEPT.md §9 (Tier 1 acceptance criteria);

PHASE-PLAN.md Phase 9.6.



\------------------------------------------------------------------------

12.2 Additional Sync Tests the MVP Must Pass

\------------------------------------------------------------------------



The following tests are required in addition to the ten above.

They test properties the architecture claims. They are not new

architecture; they are stronger tests of the same properties.



Offline and reconnect:



\- Agent goes offline. Agent performs changes. Admin performs

&#x20; changes. Agent reconnects. Both converge correctly, and no change

&#x20; is lost.

\- A machine restarts during synchronization. On restart, the

&#x20; synchronization resumes and no data is lost or corrupted.

\- A connection drops halfway through synchronization. On

&#x20; reconnect, the synchronization resumes from where it stopped and

&#x20; completes.



Relay:



\- Direct connection unavailable. Relay is used. Relay receives

&#x20; ciphertext only. Captured relay traffic contains no readable

&#x20; debtor data.

\- Key custody: the Control Plane has no organization data key.

&#x20; A captured relay payload cannot be decrypted using any credential

&#x20; the Control Plane holds.

\- Relay metadata contains no debtor identifiers. Inspecting the

&#x20; stored rows in device\_registrations and relay\_sessions yields

&#x20; only device and session metadata.



Integrity:



\- Duplicate event does not duplicate the business action. Sending

&#x20; the same event twice produces one record, not two.

\- Events arrive out of order. The receiving machine handles them

&#x20; correctly, applies them in the protocol-defined order, and

&#x20; converges to the correct logical state.

\- Blind row replacement never occurs. If two machines record two

&#x20; events of the same type, both survive. Neither replaces the

&#x20; other.



Source: BOUNDARY-TEST-PLAN.md §2.1–§2.4, §5, §6; MULTI-USER-CONCEPT.md

§7.



\------------------------------------------------------------------------

12.3 Boundary Test Acceptance Criteria (Claims A, B, C, D)

\------------------------------------------------------------------------



The boundary test defines four claims. All four must be proven

before the MVP is complete.



Claim A — Static claim. DELIVERED.



No GORKA cloud table has a field that can hold or reference a

debtor. No backend endpoint accepts or returns a debtor field.



Recorded in BOUNDARY-TEST-PLAN.md §3.



Claim B — Runtime claim. NOT STARTED.



When the Tauri client is used normally, no outbound request from

the client carries any debtor-level value. Tested per

BOUNDARY-TEST-PLAN.md §2.1 (manual) and §2.2 (automated in CI).



Claim C — Inference claim. NOT STARTED.



Even from cloud-side aggregates, a single debtor cannot be

reconstructed. Tested per BOUNDARY-TEST-PLAN.md §2.3.



Claim D — Multi-machine relay claim. NOT STARTED.



The extended proof test for the multi-user case. The relay carries

only ciphertext. The Control Plane stores only metadata.

Decryption keys exist only on the client's devices. Tested per

BOUNDARY-TEST-PLAN.md §2.4.



Source: BOUNDARY-TEST-PLAN.md §1, §2, §7.



\------------------------------------------------------------------------

12.4 Phase 9 Item 4 Acceptance

\------------------------------------------------------------------------



Action CRUD must be verified end to end in the running desktop app

before the MVP is complete.



Required:



\- Create action. Verify it appears in the debtor detail page.

\- Edit action. Verify the change is reflected.

\- Delete action. Verify it is removed.

\- List actions. Verify the list is correct.

\- Persistence across restart. Verify actions survive an app

&#x20; restart.



This is blocked until a cloud Windows environment is available

(Section 11.5).



Source: DECISIONS.md, September 15, 2026 (Phase 9 Progress — Item

4); HANDOFF.md, September 15, 2026.



\------------------------------------------------------------------------

12.5 Phase 9.5 Acceptance (Agent App)

\------------------------------------------------------------------------



The Agent App is complete when:



\- It builds successfully as a second Tauri binary.

\- It launches and runs on its own machine.

\- It opens its own local SQLCipher database.

\- It can perform debtor, action, communication, and document

&#x20; operations against its local database.

\- Registration and login work for the AGENT role, using

&#x20; credentials provided by the admin.

\- It has read and write access to the local schema, for debtors

&#x20; assigned to that agent.



Source: PHASE-PLAN.md Phase 9.5.



\------------------------------------------------------------------------

12.6 Phase 9.7 Acceptance (Demonstration)

\------------------------------------------------------------------------



The demonstration is complete when:



\- It works on three consecutive rehearsals without changes.

\- A backup video is recorded.

\- The demonstration script is documented in the recovery notes.

\- The demonstration shows every step in Section 10.2.

\- No readable debtor data appears in any capture or any GORKA

&#x20; dashboard during the demonstration.

\- The key-custody review is included and demonstrates that the

&#x20; Control Plane holds no key capable of decrypting a captured

&#x20; payload.



Source: PHASE-PLAN.md Phase 9.7; MULTI-USER-CONCEPT.md §10;

BOUNDARY-TEST-PLAN.md §2.4.



\------------------------------------------------------------------------

12.7 Tier 2 Acceptance

\------------------------------------------------------------------------



Each Tier 2 item must be present and demonstrable before the MVP is

complete:



\- Owner Dashboard sync activity metadata view: shows device

&#x20; counts, presence, relay session counts, and last sync

&#x20; timestamps. Shows nothing about debtors. Because none is

&#x20; available.

\- Marketing website: the product page, the data protection

&#x20; promise page (using the canonical technical statement and the

&#x20; marketing statement), the registration form (creating a real

&#x20; CLIENT organization and user in production), and the download

&#x20; page (with at least the Client Dashboard installer).

\- One BYO connector: the client's own API key, stored locally,

&#x20; sending directly to the provider. The key and the message

&#x20; content never reach GORKA's cloud. Aggregate usage counts may

&#x20; be reported.

\- Basic AI Copilot: one prompt, one recommendation, one draft.

&#x20; Assembled locally, sent directly to the AI provider, response

&#x20; stored locally. GORKA's Control Plane not on the path.

\- Local encrypted data on disk, visible in the demonstration.



Source: MULTI-USER-CONCEPT.md §9 (Tier 2); Section 6 of this

document.



\------------------------------------------------------------------------

12.8 Invariant Acceptance

\------------------------------------------------------------------------



The invariant is not weakened by the MVP. This is verified by:



\- The static boundary review (Claim A). DELIVERED.

\- The runtime boundary test (Claim B). Part of Phase 15.

\- The aggregation inference test (Claim C). Part of Phase 15.

\- The extended proof test (Claim D). Part of Phase 15 and

&#x20; Phase 9.6.

\- The demonstration (Section 10). Part of Phase 9.7.



If any of these reveal readable debtor data in GORKA's cloud

infrastructure, in any log, in any stored row, or in any captured

byte, the MVP is not accepted. The architecture is broken and must

be investigated at the level where the failure originates

(Recovery Rule 14).



Source: ARCHITECTURAL-LAW.md v1.3 §9, §20.6, §21.5;

RECOVERY-RULES.md Rule 14; BOUNDARY-TEST-PLAN.md §7.



\------------------------------------------------------------------------

12.9 Acceptance Criteria Summary

\------------------------------------------------------------------------



| Area | Criteria |

|------|----------|

| Sync engine | Ten criteria (Section 12.1) |

| Additional sync tests | Offline, relay, integrity, failure (Section 12.2) |

| Boundary test | Four claims (Section 12.3) |

| Phase 9 item 4 | Action CRUD verified (Section 12.4) |

| Phase 9.5 | Agent App working locally (Section 12.5) |

| Phase 9.7 | Demonstration rehearsed, recorded, documented (Section 12.6) |

| Tier 2 | Five items present and demonstrable (Section 12.7) |

| Invariant | Not weakened; verified by all four claims and the demonstration (Section 12.8) |



The MVP is complete when every criterion in this section passes.



========================================================================

13\. WHAT THIS DOCUMENT DOES NOT DO

========================================================================



This section exists so that no future session mistakes this

document for something it is not, and so that no future session

adds content to it that belongs elsewhere.



\------------------------------------------------------------------------

13.1 It Is Not the Technical Specification

\------------------------------------------------------------------------



This document defines what the MVP must do. It does not define how.



The technical specification of the sync engine is

SYNC-ARCHITECTURE.md. Every open technical question — device

identity, enrollment, key handling, wire format, message IDs,

ordering, duplicate detection, acknowledgements, offline queue,

retry, conflict resolution, direct connection, relay fallback,

corrupt/invalid message handling, protocol versioning, recovery

after interruption, what metadata GORKA sees, what GORKA can never

see, and what "most recent" means without wall-clock time — is

answered there, not here.



If a reader finds themselves wanting to add a wire format detail,

a key derivation step, or an ordering rule to this document, the

reader is in the wrong document. Those belong in

SYNC-ARCHITECTURE.md.



Source: Section 11.2 of this document; MULTI-USER-CONCEPT.md §14.



\------------------------------------------------------------------------

13.2 It Is Not the Phase Plan

\------------------------------------------------------------------------



This document references phases by number. It does not replace

PHASE-PLAN.md. The phase plan is the source of truth for what each

phase means, what it delivers, and its current status.



Where this document and PHASE-PLAN.md appear to disagree about a

phase, the phase plan wins, and this document is corrected.



Source: PHASE-PLAN.md v1.1.



\------------------------------------------------------------------------

13.3 It Is Not the Architectural Law

\------------------------------------------------------------------------



This document is subordinate to ARCHITECTURAL-LAW.md v1.3. Where

the two conflict, the law wins.



This document does not amend the law. It does not add to the list

of architectural violations, does not add to the list of

architectural allowances, and does not change the invariant. It

applies the law to the MVP.



If a reader finds themselves wanting to amend the law through this

document, the reader is in the wrong document. Amendments go

through ARCHITECTURAL-LAW-AMENDMENTS.md, with reasoning, date, and

approval.



Source: ARCHITECTURAL-LAW.md v1.3 §19; ARCHITECTURAL-LAW-

AMENDMENTS.md.



\------------------------------------------------------------------------

13.4 It Is Not a Schedule

\------------------------------------------------------------------------



This document does not contain dates. It does not commit to a

timeline. It does not predict how long any block will take.



Timeline estimates exist in MULTI-USER-CONCEPT.md §11 and are

deliberately not repeated here. They are the shape of the work,

not a commitment.



Source: MULTI-USER-CONCEPT.md §11.



\------------------------------------------------------------------------

13.5 It Is Not a Marketing Document

\------------------------------------------------------------------------



This document is internal. It is written for the founder, future

engineers, and future AI sessions.



The customer-facing statements are defined in ARCHITECTURAL-LAW.md

v1.3 §20.4 and §21.4 (canonical technical statement; marketing

statement) and in MULTI-USER-CONCEPT.md §3. This document quotes

them where the MVP must demonstrate them, and nowhere else.



If a reader finds themselves wanting to soften, sharpen, or expand

the marketing statement in this document, the reader is in the

wrong document. Customer-facing copy lives with marketing, and the

canonical statements live in the law.



Source: ARCHITECTURAL-LAW.md v1.3 §20.4, §21.4.



\------------------------------------------------------------------------

13.6 It Does Not Re-Open Settled Decisions

\------------------------------------------------------------------------



The following decisions are settled and are not to be re-litigated

in this document or in any future session that reads it:



\- The multi-user model is Model B (direct machine-to-machine

&#x20; sync, brokered by GORKA). Model A was rejected.

\- The MVP topology is hub-and-spoke. Production topology is mesh.

\- Sync is event-based from the beginning.

\- The protocol works on immutable logical events, not on

&#x20; database-file synchronization and not on blind row replacement.

\- The hub is a topology role, not a data-model identity.

\- The MVP event set is the four types in Section 8.1.

\- The MVP synchronizes document metadata, not document contents.

\- The MVP synchronizes debtor, debt, action, and communication

&#x20; records, and document metadata. Nothing else is synchronized in

&#x20; the MVP.

\- The canonical promise is "GORKA cannot decrypt your debtor

&#x20; data."

\- The client controls authorization; GORKA provides the mechanism

&#x20; and never holds the decryption keys.

\- The MVP uses a single organization key. Device-level

&#x20; cryptographic revocation is not in the MVP. This is stated as an

&#x20; explicit cryptographic limitation in Section 9.3.

\- Key rotation, offboarding, lost-device flows, per-machine

&#x20; device identity, and mesh topology are funded-phase items.

\- GORKA-managed connectors are not in the MVP. The MVP connector

&#x20; is BYO.

\- The AI Copilot in the MVP is local-only, client-to-provider

&#x20; direct.

\- The three zones of data control are defined in

&#x20; ARCHITECTURAL-LAW.md v1.3 §21.

\- The three documents (this one, SYNC-ARCHITECTURE.md, and the

&#x20; threat model) come before implementation.



If a future session disagrees with any of these, the correct

action is not to revise this document. The correct action is to

read MULTI-USER-CONCEPT.md and DECISIONS.md, and if a change is

still warranted, to amend the source document through the

amendment process.



Source: MULTI-USER-CONCEPT.md (frozen, v2.0); DECISIONS.md,

September 17, 2026; ARCHITECTURAL-LAW.md v1.3 §21.



\------------------------------------------------------------------------

13.7 It Does Not Approve Implementation

\------------------------------------------------------------------------



This document defines the MVP. It does not authorize

implementation.



Implementation of the multi-user model is blocked until all three

prerequisites (Section 11) are written and approved. This document

is one of the three. The other two must follow.



Source: Section 11 of this document; MULTI-USER-CONCEPT.md §14.



\------------------------------------------------------------------------

13.8 What It Does Do

\------------------------------------------------------------------------



For completeness:



\- It defines the MVP in full.

\- It restates the invariant as it applies to the MVP.

\- It names what is already delivered, and what is not.

\- It restates the three tiers and their status.

\- It defines the MVP event set and the exact synchronized objects.

\- It names the operational limitations honestly, including the

&#x20; single-organization-key limitation and the third-party boundary.

\- It defines the demonstration.

\- It names the prerequisites before implementation.

\- It defines the acceptance criteria.

\- It is the anchor for the next weeks of work.



Source: this document.



========================================================================

14\. CLOSING

========================================================================



\------------------------------------------------------------------------

14.1 The MVP in One Sentence

\------------------------------------------------------------------------



GORKA's MVP is a working multi-user debt-collection product in

which every client-owned machine holds an independently encrypted

replica of the organization's debtor data; the machines

synchronize that data directly with each other, end-to-end

encrypted, brokered by GORKA's Control Plane but never readable by

it; and the whole thing is demonstrated on two machines side by

side, with a network capture and a key-custody review showing that

the Control Plane receives only encrypted debtor payloads and

possesses no key capable of decrypting them.



\------------------------------------------------------------------------

14.2 What the MVP Demonstrates

\------------------------------------------------------------------------



The MVP demonstrates one claim:



> GORKA cannot decrypt your debtor data. This is an architectural

> property, not a policy.



It demonstrates that claim by showing it, not by asserting it. The

demonstration is Section 10.



\------------------------------------------------------------------------

14.3 The Invariant, Restated One Final Time

\------------------------------------------------------------------------



> No individual debtor information is stored in GORKA cloud

> infrastructure.



This is not a feature. It is not a policy. It is the architectural

invariant everything else depends on. It cannot be amended. If it

needs to change, GORKA becomes a different product.



The MVP does not weaken it. The MVP is the first complete

demonstration that it holds under multi-user conditions.



\------------------------------------------------------------------------

14.4 The Order of Work

\------------------------------------------------------------------------



1\. GORKA-MVP-SCOPE.md — this document. Defines what the sync

&#x20;  engine must do.

2\. SYNC-ARCHITECTURE.md — defines how.

3\. Threat model / security review.

4\. Implementation begins.



No implementation of the multi-user model begins until all three

documents are written and approved.



\------------------------------------------------------------------------

14.5 The Sentence That Matters Most

\------------------------------------------------------------------------



If a future session remembers nothing else from this document:



> The MVP is Tier 1 and Tier 2, working. Tier 3 is the roadmap.



Everything else in this document explains what that means.



========================================================================

END OF DOCUMENT

========================================================================

