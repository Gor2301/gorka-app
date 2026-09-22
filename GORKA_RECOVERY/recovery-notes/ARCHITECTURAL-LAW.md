# GORKA Architectural Law

**Version:** 1.3
**Date:** September 18, 2026 (v1.3 amendment applied)
**Status:** Frozen
**Authority:** This document is the highest authority in the GORKA codebase. When code, schema, or database conflicts with this document, the document wins.

---

## 1. The Invariant

> **No individual debtor information is stored in GORKA cloud infrastructure.**

This is not a feature. This is not a policy. This is the architectural invariant everything else depends on.

---

## 2. What "Debtor Data" Means

**Debtor data** is any information about an individual person who owes money to a GORKA customer (agency, bank, collection company).

Specifically, debtor data includes — but is not limited to:

- debtor name
- debtor surname
- debtor phone number
- debtor email address
- debtor physical address
- debtor government ID
- debtor ID (any internal identifier that maps to one person)
- individual debt amount
- individual debt due date
- individual payment history
- individual communication content (SMS, email, call notes)
- individual document
- individual action (task, call, letter, visit)
- individual AI analysis
- individual connector usage

**None of the above may ever be stored in GORKA cloud infrastructure.**

---

## 3. What "Customer Data" Means

**Customer data** is information about a GORKA customer — the agency, bank, or collection company that pays for GORKA.

Customer data includes:

- organization name
- organization contact person
- organization contact email
- organization contact phone
- organization business address
- organization registration number
- organization tax ID
- organization website
- organization client type (AGENCY / BANK / LAW_FIRM / etc.)
- billing information
- subscription / license information

**Customer data may live in GORKA cloud infrastructure, subject to applicable privacy and security requirements.** (See Section 19.)

---

## 4. The Exception — Aggregate Metrics

Aggregate portfolio statistics MAY leave the local machine and be stored in GORKA cloud infrastructure.

Examples of allowed aggregates:

- debtor_count: 18,452
- total_debt: $12,840,000
- agent_count: 34
- actions_count: 82,100
- sms_sent_count: 14,220
- email_sent_count: 9,400

**The rule:**

> Aggregate portfolio statistics may leave the local machine.
> Individual debtor records may not.

The cloud knows: "Customer ABC has 18,452 debtors, totalling $12,840,000."
The cloud does NOT know who those debtors are.

---

## 5. The Two Data Planes

### Cloud Control Plane

Runs on: Supabase (PostgreSQL)
Purpose: Manage GORKA's customers and the GORKA platform.
Contains: Customer data + aggregate metrics + platform configuration.

### Local Debtor Data Plane

Runs on: Tauri app (SQLite + SQLCipher)
Purpose: Manage the agency's debtors and collection operations.
Contains: All debtor data.

---

## 6. The Rule for Every Decision

Before adding any table, field, or API endpoint, ask:

> **"Does this contain or reference an individual debtor?"**

- If YES → local only. Do not add to cloud.
- If NO → cloud is allowed.
- If UNCLEAR → stop. Clarify. Document the decision.

---

## 7. What This Forbids

The following are architectural violations:

1. Adding a `debtors` table to GORKA cloud infrastructure.
2. Adding a `debts`, `communications`, `documents`, or `actions` table to GORKA cloud infrastructure (when they contain debtor-level data).
3. Sending debtor names, contacts, or addresses through any GORKA cloud API.
4. Sending message content to GORKA cloud for any reason.
5. Sending debtor documents to GORKA cloud for any reason.
6. Storing a debtor ID in any GORKA cloud table — even as metadata.
7. Sending debtor data to a cloud AI provider through GORKA infrastructure.
8. Trusting an `organization_id` sent from a client without deriving it from authenticated session state.
9. Using an old schema as justification for a new field.
10. Any "temporary" exception to the invariant.

---

## 8. What This Allows

1. Customer data (organization, user, agent identity, license, support ticket).
2. Aggregate metrics (counts, sums, averages) — without debtor identifiers.
3. Cloud audit logs of customer-level actions (user logged in, organization created, license changed).
4. Connector catalog, client connector enablement, aggregate connector usage.
5. Billing records, subscription records, plan configuration.
6. Platform administration (feature flags, announcements, settings).

---

## 9. The Proof Test

The invariant is proven when this test passes:

1. Insert a fake debtor into the Tauri local database:

Name: John Test Debtor
Phone: +63-XXX-XXX-XXXX
Debt: ₱125,000


2. Use the Tauri app for 10 minutes:
- Search for John Test Debtor
- Create a debt for John
- Send an SMS to John
- Log a communication
- Upload a document

3. Capture every outbound network request.

4. Inspect every payload.

**Expected result:** No request to GORKA cloud infrastructure contains "John Test Debtor", the phone number, the debt amount, a debtor ID, or message content.

If any of these appear, the architecture is broken.

---

## 10. Definitions

**Debtor** — an individual person who owes money to a GORKA customer.

**Customer** — an agency, bank, or collection company that pays GORKA.

**Aggregate** — a count, sum, or average that does not identify any individual debtor.

**Cloud** — GORKA-managed infrastructure (Supabase, Render, any GORKA API server).

**Local** — the Tauri client machine (SQLite database, encrypted files).

**Invariant** — a rule that cannot be broken without the system ceasing to be GORKA.

---

## 11. Behavioral Metrics

The following behavioral activity metrics may leave the local machine and be stored in cloud:

- Number of upload operations per period
- Average batch size per upload
- Number of delete operations per period
- Number of actions created per period
- Number of messages sent per period
- Number of active users in a period
- Days active in a period
- Sync events count
- Average case turnaround time (aggregate only)

The following are forbidden, even in behavioral form:

- Individual upload records (filename, contents, record IDs)
- Individual delete records
- Individual action content
- Individual message content
- Per-debtor timelines

---

## 12. Templates Boundary

Parameterized templates may be stored in cloud.

Rendered/personalized messages containing debtor data must remain local.

Example:
- ✅ Allowed in cloud: `"Dear {{debtor_name}}, your balance is {{amount}}..."`
- ❌ Not allowed in cloud: `"Dear John Smith, your balance is $4,285..."`

---

## 13. Boundary Proof Logging

A category of cloud data is explicitly allowed: **boundary proof logs** — records demonstrating that no debtor data crossed the boundary during a specific operation.

Example:

{
"event": "METRICS_SYNC",
"timestamp": "2026-09-11T14:23:05Z",
"organizationId": "org_xyz",
"payloadSummary": { "debtorCount": 18452, "totalDebt": 12840000 },
"debtorDataIncluded": false
}


These logs support regulator and customer demonstrations.

---

## 14. Support System PII Protection

Support tickets are a known PII leak vector. The support UI must:

1. Warn users before submission
2. Require confirmation that no debtor data is included
3. Make the confirmation auditable

Support content (subject, message, replies) may be stored in cloud, but only when these protections are in place.

---

## 15. Role Definitions

The three roles in GORKA are:

- `OWNER` — platform owner (the founder of GORKA)
- `CLIENT` — client admin (agency/bank owner)
- `AGENT` — agency employee (future Agent App)

---

## 16. Connector Data Categories

**GORKA-managed connectors** (Twilio, Resend, Mocean, Gemini):
- Catalog entry: cloud ✅
- Client enablement: cloud ✅
- Usage aggregate per period: cloud ✅
- Per-debtor usage detail: cloud ❌
- GORKA's master credentials: cloud (server-side only) ✅

**BYO connectors** (client's own APIs):
- Client's API key: cloud ❌ (local only)
- Client enablement metadata: cloud ✅
- Usage per period (aggregate): cloud ✅

---

## 17. Zero Production SQL

Between Phase 2 and Phase 17 of the recovery plan, no production SQL of any kind is permitted.

Not read-only queries.
Not column additions.
Not test data insertion.

Production is frozen until the final cutover.

If you need to inspect production data, restore the most recent backup into a local test database.

---

## 18. Customer Data Privacy Note

Cloud storage is permitted for GORKA customer/account data, subject to applicable privacy and security requirements.

This includes:
- Organization business information
- Organization contact information (may contain personal data — handle accordingly)
- User authentication and profile data
- Billing and subscription data

**Debtor-level data remains architecturally prohibited from cloud storage.**

---

## 19. Amendment

This document may only be amended by explicit decision, documented in `GORKA_RECOVERY/recovery-notes/ARCHITECTURAL-LAW-AMENDMENTS.md`, with:

- The change
- The reasoning
- The date
- The person who approved it

The invariant in Section 1 may not be amended. If the invariant needs to change, GORKA becomes a different product.

---

## 20. Amendment — Multi-User Data Plane (v1.2, September 17, 2026)

**Authority:** Approved by the founder.
**Reason:** The original law assumed one machine per client. GORKA's real customers are multi-user agencies. The multi-user case requires architectural rules that the original law did not state.
**Scope:** Additive. The invariant in Section 1 is unchanged. The definition of debtor data in Section 2 is unchanged. The rule for every decision in Section 6 is unchanged. The forbiddens in Section 7 are unchanged. The allows in Section 8 are unchanged. The proof test in Section 9 is unchanged. This amendment adds rules that the original law did not need to state, because the original law assumed one machine.

### 20.1 — The Two Planes

GORKA's architecture is understood in terms of two planes:

**The Control Plane** — GORKA's own cloud infrastructure. It provides:

- Authentication
- Organization membership
- Device registration and presence
- Discovery and signaling
- Encrypted relay coordination
- Licensing
- Customer accounts and billing
- Aggregate metrics
- Boundary proof logs

The Control Plane never holds debtor data. It may hold connection metadata: which organizations have which devices, when devices are online, which devices are attempting to connect. It may carry end-to-end encrypted traffic between client devices when a direct connection is not possible, but it cannot decrypt it.

**The Data Plane** — the client's own devices, and the encrypted synchronization between them. It holds:

- All debtor data
- All communications
- All documents
- All actions
- All local audit records

GORKA is not a participant in the Data Plane. Debtor data moves directly from one client-owned device to another, encrypted with keys the client controls.

### 20.2 — Multi-Device Debtor Data

Debtor data may exist on more than one device owned by the same client organization.

- Each device holds an **independently encrypted replica** of the organization's debtor data.
- No single device is the permanent master database.
- The synchronization protocol's job is to make the replicas **converge toward the same logical state**.
- If one device is destroyed or corrupted, the others retain their own copies and the organization's data survives.

The following are **permitted** and **expected**:

- Debtor data encrypted at rest on multiple devices owned by the client.
- End-to-end encrypted synchronization of debtor data directly between the client's devices.
- The client's devices connecting to each other directly, discovered through GORKA's Control Plane.
- The client's devices synchronizing through GORKA's Control Plane as an encrypted relay when a direct connection is not possible, without GORKA being able to decrypt the traffic.

The following remain **forbidden**:

- Debtor data stored in readable form in GORKA's Control Plane.
- Debtor data decrypted at any point by any GORKA-controlled system.
- GORKA holding the decryption keys for any client organization.
- Any flow in which GORKA can reconstruct an individual debtor record.

### 20.3 — The Encrypted Relay

GORKA may operate an encrypted relay as part of the Control Plane.

- The relay passes end-to-end encrypted traffic between the client's devices.
- The relay cannot decrypt the traffic it carries.
- The relay may observe connection metadata: which devices are connected, when, and how much data is passing.
- The relay must not be capable of decrypting debtor data under any configuration, including administrative override, support access, or legal compulsion.

The relay exists because direct device-to-device connections cannot always be established, due to NATs, firewalls, and network policies. It is an operational necessity, not an architectural compromise. Its inability to decrypt traffic is the boundary.

### 20.4 — The Canonical Promise

The canonical statement of GORKA's data protection is:

> **GORKA cannot decrypt your debtor data. This is an architectural property, not a policy.**

This replaces the looser formulation "debtor data never touches GORKA's servers," which was not achievable in practice, because encrypted traffic may pass through the relay.

The marketing statement, for customer-facing use, is:

> **Your debtor data stays under your control. GORKA cannot read it.**

Both statements are true. The technical statement is what a security review verifies. The marketing statement is what a customer reads.

### 20.5 — Reference to the Multi-User Concept

The full specification of the multi-user model — topology, device identity, key management, the sync model, and the funded-phase roadmap — is defined in:

> `GORKA_RECOVERY/recovery-notes/MULTI-USER-CONCEPT.md`

That document extends this law. Where the two conflict, this law wins. Where the concept and an older specification conflict, the concept wins.

Amendments to the multi-user model follow the same amendment process as the law itself: documented in `ARCHITECTURAL-LAW-AMENDMENTS.md`, approved by the founder, and recorded with reasoning.

### 20.6 — What This Amendment Does Not Change

The invariant, unchanged:

> **No individual debtor information is stored in GORKA cloud infrastructure.**

The definition of debtor data, unchanged.

The rule for every decision, unchanged:

> **"Does this contain or reference an individual debtor?"** If yes, it belongs local. If no, cloud is possible. If unclear, stop and clarify.

The list of architectural violations, unchanged.

The list of architectural allowances, unchanged.

The proof test, unchanged.

The prohibition on amending the invariant, unchanged.

This amendment adds the multi-user case. It does not touch the single-machine case that the original law already defined.


**This document is the constitution. Everything else is implementation.**


---

## 21. Amendment — The Three Zones of Data Control (v1.3, September 18, 2026)

**Authority:** Approved by the founder.
**Reason:** The original law and the v1.2 multi-user amendment named two planes (Control Plane, Data Plane) and stated the invariant. They did not distinguish between data that leaves the client's control through a GORKA-provided mechanism and data that leaves through a path the client chose outside GORKA. The distinction matters. It determines where GORKA's obligation is prevention and where it is warning.
**Scope:** Additive. The invariant in Section 1 is unchanged. The definition of debtor data in Section 2 is unchanged. The rule for every decision in Section 6 is unchanged. The two planes in Sections 5 and 20 are unchanged. This amendment names a case the prior versions did not need to state, because they assumed either a single machine or a client that did not connect GORKA to other services.

### 21.1 — The Three Zones

GORKA's data model is understood in terms of three zones. Each zone has a different boundary and a different responsibility.

**Zone 1 — GORKA cloud.**

GORKA's own infrastructure. The Control Plane. It provides authentication, organization membership, device registration and presence, discovery and signaling, encrypted relay coordination, licensing, customer accounts and billing, aggregate metrics, and boundary proof logs.

Debtor data may never exist in Zone 1 in readable form. Debtor data may pass through Zone 1 only as end-to-end encrypted traffic in transit through the relay, and the relay cannot decrypt it. Zone 1 is fully governed by the invariant in Section 1 and by the rules in Section 20.

**Zone 2 — GORKA-provided mechanisms.**

Mechanisms GORKA builds and offers to the client. These include GORKA-managed connectors, the built-in AI Copilot, the built-in provider integrations (for example the built-in Gemini connector), and any other path GORKA creates between the client's data and a third party.

GORKA's obligation in Zone 2 is prevention. Every mechanism GORKA offers must be designed so that debtor data cannot pass through it. The mechanism is the guard. The client's choice to enable a GORKA mechanism does not weaken the guard, because the guard is architectural.

**Zone 3 — Client-connected third parties.**

Third-party services the client connects to by a path GORKA does not control. Examples: the client configures GORKA to call their own ChatGPT account, their own Claude account, their own Gemini account by a route that is not GORKA's built-in connector, or any other third-party service outside GORKA's mechanism.

GORKA does not forbid this. GORKA does not limit the client's intentions. GORKA provides the mechanism for the client to make such a connection.

GORKA's obligation in Zone 3 is warning. When the client connects GORKA to a third party outside GORKA's control, GORKA must warn the client that debtor data may leave the client's machine and that the responsibility is the client's. The warning must be shown at the point of connection and must be recorded.

### 21.2 — Zone 2: GORKA's Obligation Is Prevention

Every GORKA-provided mechanism that touches a third party must be designed so that debtor data cannot pass through it.

The rule:

> If a mechanism is offered by GORKA, the mechanism is the guard. Debtor data cannot pass through it in readable form. This is architectural, not policy.

What this means in practice:

- A GORKA-managed connector (for example the built-in Gemini connector) sends only the data the connector is designed to send. It does not send debtor names, contacts, addresses, individual amounts, message content, documents, or any identifier that maps to an individual debtor.
- A GORKA-provided AI mechanism assembles its prompt from non-debtor fields. If a workflow would require a debtor field to reach the provider, the mechanism is not offered, or the field is excluded by design.
- A GORKA-provided mechanism never relies on the client to withhold debtor data. The mechanism withholds it.
- The client's choice to enable a GORKA mechanism does not create a leak path. If a leak path exists in a GORKA-provided mechanism, the mechanism is defective.

The client may still connect to third parties outside GORKA's mechanisms. That is Zone 3, and it is governed by Section 21.3.

Source: this amendment; MULTI-USER-CONCEPT.md §6; CONNECTOR-LIFECYCLE.md (conditions for a GORKA-managed connector, especially Condition 2 and Condition 4).

### 21.3 — Zone 3: GORKA's Obligation Is Warning

GORKA does not forbid the client from connecting GORKA to third parties GORKA does not control. GORKA does not limit the client's intentions. In fact, GORKA provides the mechanism for the client to make such a connection.

GORKA's obligation is to warn.

The rule:

> When the client connects GORKA to a third party outside GORKA's control, GORKA must warn the client that debtor data may leave the client's machine and that the responsibility is the client's.

The warning must be:

- Shown at the point of connection, before the connection is established.
- Written in plain language, not buried in terms of service.
- Recorded. The record is kept so that the warning can be shown to have been given, if a question arises later.
- Non-blocking. GORKA warns; the client decides. GORKA does not prevent the connection.

The warning does not transfer GORKA's obligations under the invariant. The invariant applies to Zone 1 and Zone 2 always. The warning applies only to Zone 3.

Source: this amendment; DATA-BOUNDARY-MATRIX.md §14 (connector data); RECOVERY-RULES.md Rule 8.

### 21.4 — The Marketing Statement, Restated

The marketing statement, defined in Section 20.4, reads:

> Your debtor data stays under your control. GORKA cannot read it.

This amendment clarifies what that statement means in the presence of Zone 3.

"Your debtor data stays under your control" means:

- The client decides what happens to the client's own data.
- The client decides which mechanisms to enable, which third parties to connect, and what data to send through client-controlled paths.
- GORKA does not act on the client's data without the client's decision.

It does not mean:

- The data never leaves the client's machine. In Zone 3, the client may choose to send debtor data to a third party outside GORKA's control. If the client does, the data leaves the client's machine by the client's own act.

"GORKA cannot read it" means:

- GORKA cannot decrypt debtor data in Zone 1. The invariant applies.
- GORKA cannot receive debtor data through Zone 2 mechanisms. The mechanisms are the guard.
- GORKA is not on the path in Zone 3. If the client connects to a third party, the traffic goes between the client and the third party. GORKA is not a participant.

The canonical technical statement, unchanged:

> GORKA cannot decrypt your debtor data. This is an architectural property, not a policy.

The marketing statement, clarified:

> Your debtor data stays under your control. GORKA cannot read it. You decide which mechanisms to enable and which third parties to connect. GORKA warns you when a path is outside its control.

The wording of the marketing statement is not changed. The interpretation is made explicit.

Source: this amendment; Section 20.4 of this law; MULTI-USER-CONCEPT.md §3.

### 21.5 — What This Amendment Does Not Change

The invariant in Section 1 is unchanged. No individual debtor information is stored in GORKA cloud infrastructure.

The definition of debtor data in Section 2 is unchanged.

The rule for every decision in Section 6 is unchanged.

The list of architectural violations in Section 7 is unchanged.

The list of architectural allowances in Section 8 is unchanged.

The proof test in Section 9 is unchanged.

The two planes named in Section 20.1 are unchanged. The Control Plane is still Zone 1. The Data Plane is still the client's devices. Zone 2 and Zone 3 are states of the client's interaction with third parties, not new planes.

The amendment process in Section 19 is unchanged.

This amendment names a case that the prior versions did not need to state. It does not touch any rule the prior versions already defined.







