# ARCHITECTURAL LAW — AMENDMENTS

**Purpose:** Record every change to `ARCHITECTURAL-LAW.md` with date,
reasoning, and approver.

The Architectural Law is not immutable. But every change must be
documented here.

**The invariant in Section 1 of the Law is not amendable.** If the
invariant needs to change, GORKA becomes a different product. That
is out of scope for this document.

---

## Amendment Log

### v1.1 — September 11, 2026

**Approved by:** GORKA founder (owner of GORKA)

**Reason:** Update the law with discoveries and clarifications from
the September 11, 2026 recovery session.

#### What changed

**1. Added Section: Behavioral Metrics**

The original v1.0 law allowed "aggregate portfolio statistics."
This amendment clarifies that **client behavioral activity metrics**
(how the client uses the app) are also allowed in cloud.

Allowed:

- Upload operations count per period
- Average batch size per upload
- Delete operations count per period
- Actions created per period
- Messages sent per period
- Active users count
- Days active
- Sync events count
- Average case turnaround time (aggregate only)

Forbidden even in behavioral form:

- Individual upload records (filename, contents, record IDs)
- Individual delete records
- Individual action content
- Individual message content
- Per-debtor timelines

**Rationale:** The founder needs to understand client usage patterns
for business decisions (pricing, discounts, retention). These metrics
describe *how the client uses the tool*, not *who the debtors are*.

**2. Added Section: Templates Boundary**

Parameterized templates may be stored in cloud.
Rendered/personalized messages containing debtor data must remain
local.

Examples:

- Allowed in cloud: `"Dear {{debtor_name}}, your balance is {{amount}}..."`
- Not allowed in cloud: `"Dear John Smith, your balance is $4,285..."`

**Rationale:** Templates are customer-owned content. But rendering
them produces debtor data. The parameterization rule cleanly separates
the two.

**3. Added Section: Boundary Proof Logging**

A new category of cloud data is explicitly allowed:
**boundary proof logs** — records demonstrating that no debtor data
crossed the boundary during a specific operation.

Example:

{
"event": "METRICS_SYNC",
"timestamp": "2026-09-11T14:23:05Z",
"organizationId": "org_xyz",
"payloadSummary": { "debtorCount": 18452, "totalDebt": 12840000 },
"debtorDataIncluded": false
}

**Rationale:** For regulators and clients to verify compliance. The
founder needs to be able to show "here is proof that no debtor data
was transmitted."

**4. Added Section: Support System PII Protection**

Support tickets are a known PII leak vector. A client might paste
debtor information into a ticket.

Required mitigations:

- UI must warn before submission
- User must confirm that no debtor data is included
- Confirmation must be auditable

**Rationale:** Support is a legitimate cloud feature. But it needs
enforced guardrails.

**5. Added Section: Role Definitions**

The law now explicitly defines three roles:

- `OWNER` — platform owner (founder of GORKA)
- `CLIENT` — client admin (agency/bank owner)
- `AGENT` — agency employee (future Agent App)

**Rationale:** Consistency across code, docs, and APIs.

**6. Updated: Definition of "Customer Data"**

The original law described customer data as "not regulated."
This was legally imprecise.

Correct framing:

> Cloud storage is permitted for GORKA customer/account data,
> subject to applicable privacy/security requirements, but
> debtor-level data is architecturally prohibited from cloud
> storage.

**Rationale:** A customer contact person's name/email/phone can
constitute personal data under GDPR and similar laws. The law should
reflect this.

**7. Added Section: Connector Data Categories**

Distinguish:

- GORKA-managed connector: catalog, enablement, usage aggregate — allowed in cloud
- BYO connector: client's own API key — local only
- Debtor-level usage: individual records — local only

**Rationale:** Reflects connector addendum decisions made on
September 11, 2026.

**8. Added Section: Zero Production SQL**

The law now includes a process rule: production is frozen between
Phase 2 and Phase 17 of the recovery plan.

**Rationale:** Every previous drift incident started with "let's
just fix this one thing in production."

#### What did NOT change

**The invariant.**

> No individual debtor information is stored in GORKA cloud
> infrastructure.

This is unchanged. Section 1 of the Law remains exactly as written.

All amendments are additive clarifications, not modifications of
the invariant.

---

### v1.2 — September 17, 2026

**Approved by:** GORKA founder (owner of GORKA)

**Reason:** The original law assumed one machine per client. GORKA's
real customers are multi-user agencies. The multi-user case requires
architectural rules the original law did not state. A full concept
document was produced (`MULTI-USER-CONCEPT.md`), reviewed externally,
and frozen. This amendment brings the law into alignment with that
concept.

#### What changed

**1. Added Section 20 — Amendment — Multi-User Data Plane.**

A new section was appended to `ARCHITECTURAL-LAW.md`, with six
subsections:

- **20.1 — The Two Planes.** Formally names the Control Plane
  (GORKA's cloud, no debtor data) and the Data Plane (the client's
  devices, all debtor data, direct encrypted synchronization between
  them).
- **20.2 — Multi-Device Debtor Data.** States that debtor data may
  exist on multiple client-owned devices, each holding an
  independently encrypted replica. The synchronization protocol
  converges the replicas toward one logical state. No single device
  is the permanent master.
- **20.3 — The Encrypted Relay.** Permits GORKA to operate an
  encrypted relay in the Control Plane, which passes end-to-end
  encrypted traffic it cannot decrypt. States explicitly that the
  relay must not be capable of decryption under any configuration,
  including administrative override, support access, or legal
  compulsion.
- **20.4 — The Canonical Promise.** Replaces the looser formulation
  "debtor data never touches GORKA's servers" with the technically
  defensible statement: "GORKA cannot decrypt your debtor data. This
  is an architectural property, not a policy." Separately states the
  marketing version: "Your debtor data stays under your control.
  GORKA cannot read it."
- **20.5 — Reference to the Multi-User Concept.** Names
  `MULTI-USER-CONCEPT.md` as the extended specification, subordinate
  to the law.
- **20.6 — What This Amendment Does Not Change.** Explicitly
  confirms that the invariant, the definition of debtor data, the
  decision rule, the forbiddens, the allows, the proof test, and the
  prohibition on amending the invariant are all unchanged.

#### What did NOT change

- **The invariant.** Section 1 remains exactly as written. No
  individual debtor information is stored in GORKA cloud
  infrastructure.
- **The definition of debtor data.** Section 2 is unchanged.
- **The rule for every decision.** Section 6 is unchanged.
- **The list of violations.** Section 7 is unchanged.
- **The list of allowances.** Section 8 is unchanged.
- **The proof test.** Section 9 is unchanged.
- **The amendment process.** Section 19 is unchanged.

#### Rationale

Three reasons drove the amendment.

**First:** the original law described two data planes (Cloud Control
Plane, Local Debtor Data Plane) in Section 5, but did not name them
precisely enough to distinguish *control* functions from *data*
functions. The multi-user model made this distinction essential. The
amendment adds the precise terminology.

**Second:** the original law said "No individual debtor information
is stored in GORKA cloud infrastructure." That sentence remains true
under the multi-user model, but it does not by itself answer the
question "what happens when two client devices need to exchange
debtor data?" The amendment answers that question: they synchronize
directly, end-to-end encrypted, with GORKA providing only discovery
and, when necessary, an encrypted relay that cannot decrypt the
traffic.

**Third:** the promise *"debtor data never touches our servers"* was
identified during external review as technically indefensible,
because a relay is sometimes required. The amendment replaces it
with a promise that is both strong and true: *"GORKA cannot decrypt
your debtor data."* That statement survives every network
configuration, and it is verifiable.

#### What comes next

The amendment is one of three documents required before
implementation of the multi-user model:

1. `MULTI-USER-CONCEPT.md` — **done**, frozen Version 2.0.
2. `ARCHITECTURAL-LAW.md` v1.2 amendment — **done**.
3. `SYNC-ARCHITECTURE.md` — **not yet written**. This is the
   technical specification of the sync engine and is the document a
   developer follows.

Two further documents follow after `SYNC-ARCHITECTURE.md`:

- A threat model / security review (3–5 pages).
- `GORKA-MVP-SCOPE.md` — the MVP defined in full.

Only after these are written and approved does implementation begin.

#### Relationship to prior versions

The v1.1 amendment (September 11, 2026) was additive to the original
law and addressed behavioral metrics, templates, boundary proof
logging, support PII protection, role definitions, connector data
categories, and the zero-production-SQL rule. The v1.2 amendment is
similarly additive. It does not modify or replace any part of v1.0
or v1.1. It adds rules for a case that the prior versions did not
need to describe, because they assumed one machine per client.

---

### v1.3 — September 18, 2026

**Approved by:** GORKA founder (owner of GORKA)

**Reason:** The v1.0 law and the v1.2 multi-user amendment named two
planes (Control Plane, Data Plane) and stated the invariant. They
did not distinguish between debtor data that leaves the client's
control through a GORKA-provided mechanism and debtor data that
leaves through a path the client chose outside GORKA. The
distinction matters. It determines where GORKA's obligation is
prevention and where it is warning. A bank's security reviewer
will ask what happens if the client connects GORKA to a third
party such as ChatGPT. The law should answer that question, not
only the MVP scope document.

This entry records the amendment that adds Section 21 to
`ARCHITECTURAL-LAW.md`.

#### What changed

**1. Added Section 21 — The Three Zones of Data Control.**

A new section was appended to `ARCHITECTURAL-LAW.md`, with five
subsections:

- **21.1 — The Three Zones.** Names and defines Zone 1 (GORKA
  cloud), Zone 2 (GORKA-provided mechanisms), and Zone 3
  (client-connected third parties). States where debtor data may
  and may not exist in each.
- **21.2 — Zone 2: GORKA's Obligation Is Prevention.** States
  that every GORKA-provided mechanism that touches a third party
  must be designed so debtor data cannot pass through it. The
  mechanism is the guard. The client's choice to enable it does
  not weaken the guard, because the guard is architectural.
- **21.3 — Zone 3: GORKA's Obligation Is Warning.** States that
  GORKA does not forbid the client from connecting to third
  parties GORKA does not control, and provides the mechanism for
  the client to make such a connection. GORKA's obligation is to
  warn at the point of connection, in plain language, with the
  warning recorded and non-blocking. The client decides.
- **21.4 — The Marketing Statement, Restated.** Clarifies what
  "Your debtor data stays under your control" means in the
  presence of Zone 3. It does not mean the data never leaves the
  client's machine; in Zone 3 the client may choose to send it,
  by the client's own act. The wording of the statement is not
  changed. The interpretation is made explicit.
- **21.5 — What This Amendment Does Not Change.** Explicitly
  confirms that the invariant, the definition of debtor data,
  the decision rule, the violations, the allowances, the proof
  test, the two planes in Section 20, and the amendment process
  are all unchanged. Zone 2 and Zone 3 are states of the
  client's interaction with third parties, not new planes.

#### What did NOT change

- **The invariant.** Section 1 remains exactly as written. No
  individual debtor information is stored in GORKA cloud
  infrastructure.
- **The definition of debtor data.** Section 2 is unchanged.
- **The rule for every decision.** Section 6 is unchanged.
- **The list of violations.** Section 7 is unchanged.
- **The list of allowances.** Section 8 is unchanged.
- **The proof test.** Section 9 is unchanged.
- **The two planes.** Section 20 is unchanged. The Control Plane
  remains Zone 1. The Data Plane remains the client's devices.
- **The amendment process.** Section 19 is unchanged.

#### Rationale

Three reasons drove the amendment.

**First:** the v1.2 amendment named the two planes precisely and
stated that GORKA cannot decrypt the debtor data the planes carry.
That statement is true. It did not answer a separate question: what
happens when a client connects GORKA to a third party outside
GORKA's control? The v1.2 amendment left the question open by
silence. A security review of a real deployment will ask it. The
amendment answers it.

**Second:** GORKA offers connectors and AI mechanisms. Every one of
them must itself be safe. If GORKA builds a mechanism and the
mechanism can leak debtor data, the mechanism is defective. The
amendment makes this explicit at the law level: GORKA-provided
mechanisms are the guard. This is stronger than a policy. It is a
rule a future engineer must design against.

**Third:** GORKA does not want to limit what the client can do with
the client's own data. The client may connect to whatever third
parties the client chooses. GORKA's role in that case is not to
forbid, and not to pretend the risk does not exist. It is to warn,
plainly, at the point of connection, and to record that the
warning was given. The marketing statement "your debtor data stays
under your control" was already worded for this case. The
amendment makes the interpretation explicit so that no one mistakes
"under your control" for "never leaves your machine."

#### What comes next

This amendment is one of the documents that must exist before
implementation of the multi-user model. The order is:

1. `GORKA-MVP-SCOPE.md` — in progress.
2. `SYNC-ARCHITECTURE.md` — not yet written.
3. Threat model / security review — not yet written.

The v1.3 amendment is independent of the sync engine and does not
affect the sync engine's design. It clarifies a case the law did
not previously name.

#### Relationship to prior versions

The v1.1 amendment (September 11, 2026) was additive and addressed
behavioral metrics, templates, boundary proof logging, support PII
protection, role definitions, connector data categories, and the
zero-production-SQL rule. The v1.2 amendment (September 17, 2026)
was additive and addressed the multi-user data plane. The v1.3
amendment is similarly additive. It does not modify or replace any
part of v1.0, v1.1, or v1.2. It names a case that the prior
versions did not need to describe, because they did not address a
client that connects GORKA to third parties outside GORKA's
control.

---

## Amendment Process

Any future amendment must:

1. Be documented in this file with date and reason
2. Be approved by the platform owner (OWNER role)
3. Not modify the invariant in Section 1
4. Be reflected in the main `ARCHITECTURAL-LAW.md` with a version bump

**Amendments to the invariant require a fundamental decision about
what GORKA is.** That decision is out of scope for this recovery.

---

## Current Version (Updated September 18, 2026)

**ARCHITECTURAL-LAW.md is at v1.3 as of September 18, 2026.**

Changes made since v1.0:

- v1.1 — Added Behavioral Metrics section
- v1.1 — Added Templates Boundary section
- v1.1 — Added Boundary Proof Logging section
- v1.1 — Added Support System PII Protection section
- v1.1 — Added Role Definitions section
- v1.1 — Updated Customer Data definition (privacy law wording)
- v1.1 — Added Connector Data Categories section
- v1.1 — Added Zero Production SQL section
- v1.2 — Added Section 20 (Multi-User Data Plane), six subsections
- v1.3 — Added Section 21 (The Three Zones of Data Control),
  five subsections

Version history:

- v1.0 — September 11, 2026 (initial)
- v1.1 — September 11, 2026 (session's amendments)
- v1.2 — September 17, 2026 (multi-user data plane amendment)
- v1.3 — September 18, 2026 (three zones of data control amendment)

---

## What This Document Is

This is the append-only log of changes to the architectural
constitution.

Every future amendment gets its own entry above. This document
grows over time. It is never rewritten, only appended.