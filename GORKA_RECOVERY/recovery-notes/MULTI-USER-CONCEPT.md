\# GORKA — Multi-User Data Model: Concept for Partners



\*\*Version:\*\* 2.0 (Frozen)

\*\*Date:\*\* September 17, 2026

\*\*Status:\*\* Approved concept. Basis for `GORKA-MVP-SCOPE.md` and `SYNC-ARCHITECTURE.md`.

\*\*Audience:\*\* Founder, partners, prospective investors, future engineers.

\*\*Authority:\*\* This document extends ARCHITECTURAL-LAW.md. Where the law and this document conflict, the law wins. Where this document and an older spec conflict, this document wins.



\---



\## 1. Why This Document Exists



GORKA's product promise rests on one sentence:



> \*\*Debtor data stays with the client. GORKA never reads it.\*\*



That promise is what makes GORKA different from every other

debt-collection platform. It is why a small agency can adopt GORKA

without hiring a lawyer or an IT department. It is the first question a

regulator or a bank's security team will ask about.



The current architecture respects that promise for a single machine:



\- The Client Dashboard runs on the client's own computer.

\- Its SQLite database is encrypted on that computer.

\- GORKA's cloud holds customer accounts, licensing, billing, and

&#x20; aggregate numbers only. Never debtor data.



This worked while the product assumed \*\*one computer per client\*\*.



GORKA's real customers are \*\*multi-user agencies\*\*: one admin, many

agents, some in the office, some at home, some in the field. They need

to see the same debtors. They need to see each other's work. The admin

needs to see everything the agents do.



That requirement — \*\*multiple machines, same data, no debtor data on

GORKA's servers\*\* — is the hardest problem in the platform. It is the

one that decides whether GORKA can be what it claims to be. That is why

this topic escalated: it is not a feature, it is the foundation.



\---



\## 2. The Two Models That Were Considered



\*\*Model A — GORKA Cloud as the Sync Relay.\*\*



The admin's machine sends debtor data to a GORKA cloud service. The

agent's machine receives it from the same service. GORKA is the

middleman for every change.



\- Advantages: easy to build, standard SaaS pattern, GORKA's servers

&#x20; are always online.

\- Disadvantage: GORKA now holds debtor data, even briefly, even

&#x20; encrypted. The promise becomes harder to defend because the data

&#x20; physically sits on GORKA's infrastructure. A regulator or a bank

&#x20; will hear the difference.



\*\*Model A is rejected.\*\*



\*\*Model B — Direct Machine-to-Machine Sync, Brokered by GORKA.\*\*



The client's machines synchronize with each other. GORKA's servers

help them find each other, then step out of the way. The debtor data

travels from one client-owned machine to another. GORKA never holds

it, never reads it, never sees it in readable form.



\*\*Model B is adopted.\*\*



\---



\## 3. What Model B Actually Means



In plain words:



\- Each machine holds its own copy of the client's debtor data.

&#x20; The admin's copy, each agent's copy.

\- The copies stay in agreement by sending each other the changes

&#x20; they make.

\- When the network allows it, machines sync directly. When it does

&#x20; not — because of NATs, firewalls, or network policies — GORKA

&#x20; operates an encrypted relay that passes the bytes without being

&#x20; able to read them.

\- GORKA's Control Plane does one small job: it helps machines find

&#x20; each other. It sees connection metadata only — which organizations

&#x20; have which machines, when they are online. It never sees debtor

&#x20; data.

\- Everything on the wire is end-to-end encrypted with keys only the

&#x20; client's devices hold.

\- When an agent is offline, nothing happens. Their local copy is

&#x20; frozen at the last sync. When they come back online, sync catches

&#x20; up.



\### The Correct Promise



Not: "Your debtor data never touches our servers."



But:



\*\*Technical / security statement (canonical):\*\*



> \*\*"GORKA cannot decrypt your debtor data. This is an architectural

> property, not a policy."\*\*



\*\*Marketing statement (short form):\*\*



> \*\*"Your debtor data stays under your control. GORKA cannot read

> it."\*\*



Both statements are true, and both belong in the product. The

technical statement is what a bank's security review verifies. The

marketing statement is what a customer reads.



\### Terminology



Two terms are used throughout GORKA's documentation:



\- \*\*Control Plane\*\* — authentication, organization membership,

&#x20; device registration, presence, discovery, signaling, encrypted

&#x20; relay coordination, licensing. GORKA's cloud.

\- \*\*Data Plane\*\* — device-to-device encrypted synchronization of

&#x20; debtor data. GORKA is not a participant.



The phrase "phone book" is used only in partner-facing and

investor-facing material, as a plain-language description of the

Control Plane's discovery role.



\---



\## 4. Topology: Hub-and-Spoke for MVP, Mesh for Production



\### MVP Topology — Hub-and-Spoke



\- The admin's machine is the hub.

\- Every agent's machine is a spoke.

\- All sync traffic passes through the admin's machine.



Why this choice for the MVP:



\- Dramatically simpler to build. One connection per machine, not one

&#x20; per pair of machines.

\- Matches a large part of the actual customer base. A professional

&#x20; agency with 10–20+ staff typically has an office machine that is

&#x20; always on.

\- Produces a working demonstration quickly. Two machines, one hub,

&#x20; one spoke.



What is lost:



If the admin's machine is offline, agents can still work locally —

their changes queue up — but they cannot see each other's new changes

until the hub returns.



Important safety property:



Each device holds an \*\*independently encrypted replica\*\* of the

organization's data. No single device is the permanent master

database. The synchronization protocol's job is to make the replicas

\*\*converge toward the same logical state\*\*. If the hub is corrupted

or destroyed, it can be rebuilt from another replica.



\### Production Topology — Mesh



In the funded version, any two authorized machines in the organization

sync directly with each other. The admin's machine is no longer a

single point of coordination.



\- Why: removes the operational constraint of the MVP. Works for

&#x20; field-based and multi-office agencies.

\- Cost: significantly more complex to build. Requires more

&#x20; engineering and specialist involvement.

\- When: funded phase.



\### Where This Is Recorded



1\. This concept document (this section).

2\. `GORKA-MVP-SCOPE.md`, under "operational limitations."

3\. `SYNC-ARCHITECTURE.md`, with an explicit "MVP topology vs.

&#x20;  production topology" section.

4\. The pitch deck, in one line: "MVP demonstrates hub-and-spoke

&#x20;  sync; production moves to full mesh for field and multi-office

&#x20;  deployments."

5\. `DECISIONS.md`, as a recorded decision with reasoning.



\---



\## 5. Device Identity: User Account for MVP, Combined for Production



\### MVP — Device Identity Is the User Account



\- Agents log in with credentials provided by the admin.

\- An agent can use GORKA from any machine by logging in.

\- There is no per-machine registration in the MVP.

\- Removing an agent means disabling their user account.



Advantages: simple, mobile, matches how most SaaS products work.



Known limitation: if an agent's machine is stolen, the admin cannot

remove only that machine. The admin can only disable the user account,

which also locks the agent out of their other machines. For the MVP,

with one agent typically using one machine, this is acceptable.



\### Production — Combined User + Device Identity



Each machine is a registered entity within the organization.



\- Each machine has its own identity.

\- Each machine is enrolled, listed, and can be individually revoked.

\- Removing one lost machine does not disable the agent's other

&#x20; machines.



Migration cost: real. The enrollment flow, key distribution, and

revocation flow are all new work. The sync protocol is largely

unaffected. This belongs to the funded phase.



\---



\## 6. Cryptography in the MVP



\*\*On disk:\*\* SQLCipher, already in use. Unchanged.



\*\*On the wire:\*\* end-to-end encryption using established, audited

cryptographic libraries. Custom cryptography is never used.



\*\*Key model:\*\* the MVP uses a simple organization-level key model,

derived from the organization's identity at setup time. Each sync

connection uses a session key derived from that organization key.



\*\*Important architectural principle:\*\* the sync protocol is

structured so that \*\*device identity and session keys are

first-class concepts\*\*, even though the MVP derives them simply.

This ensures the funded phase can add per-device identity, key

rotation, and revocation \*\*without redesigning the protocol or the

wire format\*\*.



\*\*Key distribution for the MVP:\*\* the admin exports an encrypted

package, sends it to each agent through any channel the client

chooses, and the agent imports it. Sufficient for a controlled MVP.



\*\*Not implemented in the MVP:\*\* key rotation, per-device keys,

offboarding flows, lost-device recovery, group key management,

message ordering guarantees beyond those required for basic

reconciliation.



\*\*Honest framing for anyone reading this document:\*\*



> The cryptographic primitives are straightforward when using

> established libraries. The difficult work is protocol design

> around them: nonce generation, replay protection, message

> ordering, duplicate detection, device authentication, protocol

> versioning, malicious message handling, and downgrade prevention.

> This work is bounded, and it belongs to the funded phase with

> specialist security review.



\---



\## 7. Sync Model: Events from the Beginning



The synchronization engine is \*\*event-based from the beginning\*\*.

It is not "last-write-wins over the whole database," because that

would silently lose business events in a debt-collection context.



\### Two Categories of Data



\*\*State\*\* — mutable properties of a record:



\- debtor's current name, address, phone

\- debtor's current status

\- debtor's current assigned agent



State is synchronized with deterministic rules. When two machines

change the same field to different values, the most recent change

wins, and the previous value is recorded.



\*\*Events\*\* — append-only business facts:



\- `PAYMENT\_RECORDED`

\- `PROMISE\_CREATED`

\- `PROMISE\_BROKEN`

\- `CALL\_LOGGED`

\- `SMS\_SENT`

\- `EMAIL\_SENT`

\- `NOTE\_ADDED`

\- `STATUS\_CHANGED`

\- `CONTACT\_ATTEMPTED`



Events are never overwritten. Two agents recording two payments

produce two events. Both survive.



\### Why Events Are the Foundation



\- In debt collection, business meaning matters. A payment and a

&#x20; promise are events, not field values.

\- Events reconstruct current state, so nothing is lost if state and

&#x20; events diverge.

\- Events provide the basis for future features: audit reporting,

&#x20; AI analysis, regulatory export.

\- Choosing events now avoids a data migration later, when the

&#x20; funded phase would otherwise have to add events to a database

&#x20; that never recorded them.



\### The Application Audit Log Is Not the Sync Protocol's Memory



There are two separate things:



\- The \*\*application audit log\*\* — a record of who did what, for

&#x20; compliance and human review.

\- The \*\*sync protocol's change history\*\* — the events and change

&#x20; records that machines exchange to reconcile.



The application audit log is not the sync protocol's source of

truth. The sync protocol maintains its own change history, in its

own structure. This distinction is essential and belongs in

`SYNC-ARCHITECTURE.md`.



\### MVP Event Set



The MVP populates the event table with a limited set of event types

— enough to demonstrate the architecture:



\- `DEBTOR\_CREATED`

\- `DEBTOR\_UPDATED`

\- `ACTION\_CREATED`

\- `COMMUNICATION\_LOGGED`



The full set of business events is added as the product matures.

The table, the protocol, and the reconciliation logic all assume

events from the beginning, so no migration is required when the

set expands.



\### "Most Recent" Requires a Precise Definition



The concept says that conflicting state changes use deterministic

rules, and that the most recent change wins. The technical

specification must define what "most recent" actually means.



It cannot simply mean wall-clock time, because distributed clocks

cannot be trusted to establish globally correct ordering. The

correct rule — a logical ordering, a sequence number, a

protocol-defined tiebreaker — belongs in `SYNC-ARCHITECTURE.md`.



\---



\## 8. Key Management: Client Policy, GORKA Mechanism



The client decides \*\*who is authorized\*\* to access their data.

GORKA provides the \*\*secure mechanism\*\* for granting and revoking

that access, without ever possessing the organization's decryption

keys.



Specifically:



\- The client controls authorization — who has access, when they

&#x20; lose it, and under what conditions.

\- GORKA implements the mechanism — the enrollment flow, the key

&#x20; distribution package, the revocation process.

\- GORKA does not possess the decryption keys — not for recovery,

&#x20; not for support, not for any purpose. This is architectural, not

&#x20; policy.



\### Lost Devices



GORKA provides mechanisms:



\- Remove a device from the organization (production only; see

&#x20; Section 5).

\- Rotate the organization key so future traffic is not readable

&#x20; by the lost device.

\- Document the recovery process plainly.



GORKA cannot delete data on a machine it cannot reach. That is

physics, not policy.



\### Critical Caveat



> Revocation prevents future synchronization. It does not guarantee

> deletion of data already replicated to the device.



Any device that has ever synced holds a local copy of the data it

was authorized to access. This is true of any product that stores

data locally, and it must be stated plainly in the documentation

so that no client is surprised later.



\---



\## 9. The MVP — Scope, Structure, Constraints



The MVP is a \*\*working product with constraints\*\*, not a

proof-of-concept. All four blocks are present. Each is limited by

an explicit list.



\### Tier 1 — Must Work Reliably



\- Local SQLCipher storage on each machine. Debtor data lives on

&#x20; the client's devices.

\- Multi-user sync engine. Hub-and-spoke topology. Direct

&#x20; connection when possible, encrypted relay fallback when not.

&#x20; Event-based.

\- Client Dashboard and Agent App as two separate Tauri binaries,

&#x20; sharing a Rust command layer.

\- Registration, login, and organization membership.

\- One demonstration of sync between two machines, meeting the

&#x20; acceptance criteria below.



\*\*MVP acceptance criteria for the sync engine\*\* — all must pass:



\- Initial synchronization between two machines.

\- New debtor propagation.

\- State update propagation.

\- Event propagation (append-only, no loss).

\- Offline modification, followed by reconnect and reconciliation.

\- Duplicate prevention.

\- No data loss under normal operation.

\- Direct connection path.

\- Relay fallback path.

\- Rejection of corrupted or invalid messages.



The investor demonstration does not need to show all of these.

The engineering acceptance tests must.



\### Tier 2 — Must Exist and Be Demonstrable, but Simple



\- Owner Dashboard showing clients, licenses, and a metadata-only

&#x20; view of sync activity.

\- Marketing website with registration and download links.

\- One working connector through the Communication Center (for

&#x20; example, Mocean for SMS).

\- Basic AI Copilot — one prompt, one recommendation, one draft.

&#x20; Real integration, single workflow.

\- Local encrypted data on disk, visible in the demonstration.



\### Tier 3 — Buttons, Documentation, or Roadmap Only



\- Other connectors (Twilio, Resend, WhatsApp) — buttons that say

&#x20; "coming soon."

\- Key rotation, offboarding, lost-device flows — documented, not

&#x20; implemented.

\- Per-machine device identity — documented, planned, not

&#x20; implemented.

\- Mesh topology — documented, planned, not implemented.

\- Compliance dashboard — a simple page listing GORKA's

&#x20; guarantees.

\- Full AI Copilot capability — described in the roadmap.



The MVP is Tier 1 and Tier 2, working. Tier 3 is the roadmap.

Investors see a real, functioning product and understand what

funding would add.



\---



\## 10. The Demonstration



The core proof for investors and prospective clients:



\- Two laptops, side by side. One is the admin's, one is the

&#x20; agent's.

\- The admin creates a debtor. Within seconds, the debtor appears

&#x20; on the agent's machine. No refresh. No manual export.

\- The agent logs an action. It appears on the admin's machine.

\- The data on the wire is unreadable. A network capture shows

&#x20; ciphertext. GORKA cannot decrypt it, because GORKA does not hold

&#x20; the keys.

\- The GORKA Owner Dashboard shows the two machines connected, and

&#x20; shows nothing about the debtors — because GORKA cannot see them.

\- The client's local data is encrypted at rest. The SQLCipher file

&#x20; is unreadable without the client's password.



That is the demonstration. It is not a slide. It is two laptops

and a few seconds.



\---



\## 11. Timeline (Realistic Shape)



This is a serious build. The honest range:



\- Weeks 1–2: cloud Windows environment for building, Tauri

&#x20; toolchain, all four blocks scaffolded.

\- Weeks 3–6: Client Dashboard and Agent App working locally,

&#x20; sharing the schema, SQLCipher and login in place.

\- Weeks 7–10: Sync engine — hub-and-spoke, event-based, direct

&#x20; connection, relay fallback. Two machines in sync. This is the

&#x20; hardest part.

\- Weeks 11–12: Communication Center, one or two connectors. AI

&#x20; Copilot, one workflow.

\- Weeks 13–14: Owner Dashboard views, website pages, registration

&#x20; flow. Basic polish.

\- Weeks 15–16: Demonstration, documentation, investor materials.



Assumes no major discoveries, which is optimistic. It is the honest

shape for someone working intensively with occasional help.



\---



\## 12. What Funding Adds



\- A cryptography specialist to review the key management, protocol

&#x20; design, and security model before shipping.

\- Per-machine device identity, key rotation, offboarding flows,

&#x20; lost-device recovery, group key management.

\- Mesh topology replacing hub-and-spoke.

\- Additional connectors (Twilio, Resend, WhatsApp, voice).

\- A full AI Copilot with multi-channel drafting, outcome tracking,

&#x20; and structured recommendation.

\- A compliance dashboard that clients can show to regulators.

\- A threat model and independent security review.

\- Better hardware, better test environments, and a second

&#x20; engineer.



The MVP is proof of the founder's ability to build the whole

thing. The funding turns the MVP into a mature product.



\---



\## 13. The Decision Recorded



\- Model A is rejected. It breaks GORKA's central promise.

\- Model B is adopted. Direct machine-to-machine sync, brokered by

&#x20; GORKA, end-to-end encrypted, with relay fallback.

\- The promise is reworded honestly. "GORKA cannot decrypt your

&#x20; debtor data" is the canonical technical statement. "GORKA

&#x20; cannot read it" is the marketing statement.

\- MVP topology is hub-and-spoke. Production topology is mesh.

&#x20; Both are labeled explicitly in every relevant document.

\- Device identity: user account for MVP, combined user + device

&#x20; for production.

\- Sync model: event-based from the beginning. Application audit

&#x20; log and sync change history are separate.

\- Key management: the client controls authorization; GORKA

&#x20; provides the mechanism and never holds the keys.

\- Lost devices: a client problem, with GORKA-provided mechanisms.

&#x20; Revocation prevents future sync; it does not delete existing

&#x20; data.

\- The MVP is a working product with constraints, not a

&#x20; proof-of-concept.

\- The sync is the star of the MVP. The crypto is real but simple.



\---



\## 14. What Comes Next



This concept is frozen. No further revision.



The next documents, in order:



1\. `GORKA-MVP-SCOPE.md` — the MVP defined in full: every block,

&#x20;  every constraint, every out-of-scope item. The anchor for the

&#x20;  next weeks of work.

2\. `SYNC-ARCHITECTURE.md` — the technical specification for the

&#x20;  sync engine. Device identity, authentication, key handling,

&#x20;  wire protocol, message format, event structure, conflict

&#x20;  rules, failure modes, and a clear list of what is MVP and what

&#x20;  is deferred. The document a developer follows.

3\. Threat model / security review — three to five pages. Who can

&#x20;  attack what, what GORKA can see, what a compromised device can

&#x20;  do, what happens when a device is lost.

4\. Implementation begins.



Only after those documents are written and approved does any code

get written.



\---



\*\*End of document.\*\*

