GORKA CONNECTOR MODEL



Document:    CONNECTOR-MODEL.md

Version:     1.0

Date:        October 6, 2026

Status:      FROZEN

Authority:   Subordinate to ARCHITECTURAL-LAW.md v1.3



========================================================================

1\. PURPOSE, SCOPE, AND STATUS

========================================================================



1.1 What this document is



The technical specification for how the two GORKA applications - the

Client Dashboard and the Agent App - interact with third-party

communication providers (Twilio, Resend, Mocean, and future providers)

and with the AI provider (Gemini).



It defines the two-sided model:



&#x20; - On the admin side, how a connector is enabled, configured, and

&#x20;   given credentials, on the Client Dashboard.

&#x20; - On the agent side, how an enabled connector is used to send a

&#x20;   message to a debtor, from the Agent App.

&#x20; - Between them, how the admin's enablement reaches the agent

&#x20;   devices, what travels, and what does not.



It is a specification. It does not write code.



1.2 What this document covers



&#x20; - The connector catalog (which providers exist).

&#x20; - The admin enable/disable flow.

&#x20; - Credential storage on the admin device (local only).

&#x20; - Credential distribution to agent devices.

&#x20; - The provider adapter pattern in the shared Rust command layer.

&#x20; - The single-recipient send flow on the agent device.

&#x20; - Message logging and sync of outbound communications.

&#x20; - Compliance enforcement hooks (quiet hours, contact limits,

&#x20;   opt-out).

&#x20; - Aggregate usage reporting (metadata only, existing

&#x20;   connector\_usage cloud table).

&#x20; - The AI Copilot connector (Gemini) as a special case.

&#x20; - The Zone 3 declaration (client-connected third parties outside

&#x20;   GORKA's control).

&#x20; - Open items.



1.3 What this document does not cover



&#x20; - The connector catalog schema and lifecycle. CONNECTOR-LIFECYCLE.md

&#x20;   and CLOUD-TABLES.md define the catalog table and the

&#x20;   ACTIVE/DEPRECATED/RETIRED lifecycle. This document references

&#x20;   them; it does not redefine them.

&#x20; - The sync engine. SYNC-ARCHITECTURE.md defines it. This document

&#x20;   uses the existing event types and delivery bookkeeping. It does

&#x20;   not add a new wire format except as named in Section 14.

&#x20; - The three-zone model. ARCHITECTURAL-LAW.md Section 21 defines it.

&#x20;   This document references it.

&#x20; - The AI boundary layer. AGENT-APP-SPEC.md Section 9 defines it.

&#x20;   This document references it.

&#x20; - The compliance enforcement layer's rule types. AGENT-APP-SPEC.md

&#x20;   Section 10 defines them. This document wires the enforcement

&#x20;   point into the send flow.

&#x20; - Bulk sending. AGENT-APP-SPEC.md Section 8.4 defines the flow.

&#x20;   This document treats it as a funded-phase item.

&#x20; - Voice and attachments. Deferred. Recorded as an open item in

&#x20;   Section 14.



1.4 Authority and relationships



Subordinate to ARCHITECTURAL-LAW.md v1.3. Where the two conflict,

the law wins.



Consistent with:



&#x20; - GORKA-MVP-SCOPE.md v1.1 (frozen). MVP tier definitions.

&#x20; - SYNC-ARCHITECTURE.md v1.4 (frozen). Event types, reconciliation,

&#x20;   wire format.

&#x20; - AGENT-APP-SPEC.md v1.3 (frozen). Agent UI, compliance layer,

&#x20;   AI boundary layer.

&#x20; - CONNECTOR-LIFECYCLE.md v1.0 (draft). Tier 1 / Tier 2, the

&#x20;   six-condition rule.

&#x20; - CLOUD-TABLES.md v1.2 (frozen). Connector catalog, enablement,

&#x20;   usage.

&#x20; - DATA-BOUNDARY-MATRIX.md v1.2 (frozen). Connector data

&#x20;   classification.

&#x20; - THREAT-MODEL.md v1.0 (frozen). Residual risks R7 and R8

&#x20;   (compromised device).



Where this document appears to contradict any of them, the frozen

document wins and this document is corrected, unless this document

names the contradiction and it is resolved through the amendment

process for the frozen document.



1.5 Decisions settled at the start of this session



Four decisions were settled during the October 5, 2026 design

session, before Section 1 was written. They are recorded here so the

reader has them in hand before reaching the sections they shape.



&#x20; D1 - Credential distribution. SETTLED.

&#x20;   Credentials for a connector are entered once, on the admin's

&#x20;   device, in the Client Dashboard. They are stored only in the

&#x20;   admin's local SQLCipher database. They are distributed to agent

&#x20;   devices through a dedicated encrypted sync event, using the

&#x20;   existing sync channel. Agents never see or type provider

&#x20;   credentials. The GORKA cloud never holds the credential of

&#x20;   either a Tier 1 subaccount or a Tier 2 BYOP key. Detail in

&#x20;   Section 6.



&#x20;   Credential distribution is itself a security boundary, not

&#x20;   merely another sync event. Section 6 defines the boundary in

&#x20;   full.



&#x20; D1b - Tier 1 and Tier 2 credential origins. SETTLED.

&#x20;   Tier 1 (GORKA-managed): GORKA's master credential lives in

&#x20;   GORKA's cloud, server-side only, as permitted by

&#x20;   ARCHITECTURAL-LAW.md Section 16. GORKA creates one subaccount

&#x20;   per client organization. The subaccount credential is what

&#x20;   reaches the client's devices, distributed like a Tier 2

&#x20;   credential. The agent device calls the provider directly.

&#x20;   GORKA's cloud is not on the send path. Section 3 states the

&#x20;   precise capability boundary of GORKA's master credential, per

&#x20;   provider.

&#x20;   Tier 2 (BYOP): the client's own provider credential is entered

&#x20;   on the admin's device, stored locally, and distributed to agent

&#x20;   devices by the same mechanism. GORKA's cloud is never on the

&#x20;   path and never holds the credential.



&#x20; D2 - Client Connectors.tsx. SETTLED.

&#x20;   The current Client Connectors.tsx page calls backend endpoints

&#x20;   that do not exist on the current backend. It is pre-recovery

&#x20;   UI, never wired to the Phase 14 backend. CONNECTOR-MODEL.md

&#x20;   documents the intended shape. The code fix lands in the

&#x20;   implementation phase, with BYOP treated as its own sub-slice.



&#x20; D3 - ConfigurationModal.tsx env-var reads. PROPOSED, not yet

&#x20; confirmed.

&#x20;   The file reads default credentials from import.meta.env.VITE\_\*

&#x20;   variables. If those values are ever set at build time, they are

&#x20;   baked into the shipped JS bundle. This is a boundary concern.

&#x20;   Proposed disposition: documented in Section 14, removed in the

&#x20;   implementation phase. Awaiting confirmation.



&#x20; D4 - Agent send-path timing. PROPOSED, not yet confirmed.

&#x20;   The send path is a distinct slice. It does not close Phase 9.6.

&#x20;   Proposed disposition: planned in Section 14, executed after this

&#x20;   document is frozen. Awaiting confirmation.



&#x20; Communication content and replication. SETTLED.

&#x20;   For text communications (SMS bodies, email plaintext, call

&#x20;   notes), the full content syncs to every authorized device in

&#x20;   the organization. This is the design choice referred to as

&#x20;   "Option A" in the session discussion. The reasoning: an agency

&#x20;   that cannot reproduce what its agents told a debtor cannot

&#x20;   answer a dispute or a regulator's request. The cost - each

&#x20;   device holds a replica of every communication - is documented

&#x20;   in Section 9 and accepted. Voice and attachments are separate;

&#x20;   they are not covered by this decision and are recorded as an

&#x20;   open item in Section 14.



&#x20;   Three separate flows are involved in a single outbound message:

&#x20;   the local GORKA replica on each authorized device, the sync

&#x20;   between GORKA devices, and the provider transmission. Section

&#x20;   9 names each and never collapses them.



1.6 The sentence that matters most in this document



A connector is a GORKA-provided mechanism. Debtor data does not pass

through it in readable form to GORKA's cloud.



This is the Zone 2 obligation from ARCHITECTURAL-LAW.md Section

21.2, restated for the connector context.



1.7 Section map



&#x20; Section 1   Purpose, scope, and status

&#x20; Section 2   The two planes and the three zones

&#x20; Section 3   The connector catalog

&#x20; Section 4   Admin enable/disable

&#x20; Section 5   The agent view

&#x20; Section 6   Credential storage and distribution

&#x20; Section 7   Provider adapters in the shared crate

&#x20; Section 8   Single-recipient send flow

&#x20; Section 9   Message logging and sync

&#x20; Section 10  Compliance enforcement hooks

&#x20; Section 11  Aggregate usage reporting

&#x20; Section 12  AI Copilot as a connector

&#x20; Section 13  Zone 3 declaration

&#x20; Section 14  Open items



========================================================================

END OF SECTION 1

========================================================================



========================================================================

2\. THE TWO PLANES AND THE THREE ZONES

========================================================================



This section places connectors, connector credentials, and the send

path within the two-plane and three-zone model defined by

ARCHITECTURAL-LAW.md Sections 20 and 21.



It is a positioning section. It names where each connector-related

thing lives, before later sections describe how each thing works.



It is deliberately short. Every later section that touches a plane or

a zone refers back to this one.



2.1 The two planes



Control Plane (Zone 1)

&#x20; GORKA's own cloud. Supabase PostgreSQL and the Express backend.

&#x20; Holds the connector catalog, client enablement metadata, aggregate

&#x20; connector usage, and (for Tier 1 connectors) GORKA's master

&#x20; credentials to the provider. Never holds the credential that a

&#x20; client's device uses to send a message to a debtor.



Data Plane

&#x20; The client's own devices and the encrypted synchronization between

&#x20; them. Holds every connector credential that the client's devices

&#x20; use to reach a provider, every outbound message content, every

&#x20; inbound provider response, and the local connector cache. GORKA is

&#x20; not a participant in this plane.



2.2 The three zones



Zone 1 — GORKA cloud

&#x20; GORKA's obligation is the invariant. No individual debtor

&#x20; information is stored in GORKA cloud infrastructure, in readable

&#x20; form, at any time.



&#x20; What lives in Zone 1 for connectors:

&#x20;   - The connector catalog (provider name, category, capabilities,

&#x20;     pricing metadata). Product metadata. Permitted.

&#x20;   - Client enablement records (which organization has which

&#x20;     connector enabled). Metadata. Permitted.

&#x20;   - Aggregate connector usage (counts per connector, per period).

&#x20;     Metadata. Permitted.

&#x20;   - For Tier 1 connectors: GORKA's master credential to the

&#x20;     provider, server-side only. Permitted by ARCHITECTURAL-LAW.md

&#x20;     Section 16, with the capability boundary defined in Section 3

&#x20;     of this document.



&#x20; What never lives in Zone 1 for connectors:

&#x20;   - The credential that a client's device uses to reach a provider.

&#x20;     For both Tier 1 subaccount credentials and Tier 2 BYOP

&#x20;     credentials, the value never enters GORKA's cloud.

&#x20;   - Outbound message content.

&#x20;   - Inbound provider responses that contain message content.

&#x20;   - Any identifier mapping to an individual debtor.



Zone 2 — GORKA-provided mechanisms

&#x20; Every connector is a GORKA-provided mechanism. GORKA's obligation

&#x20; in Zone 2 is prevention. The mechanism is the guard.



&#x20; What this means concretely for connectors:

&#x20;   - The mechanism (the Client Dashboard connector UI, the Agent App

&#x20;     send flow, the shared Rust adapter layer, the sync channel that

&#x20;     distributes credentials) is designed so debtor data cannot pass

&#x20;     through it to GORKA's cloud.

&#x20;   - The agent device sends directly to the provider. GORKA's cloud

&#x20;     is not on the send path for any message to a debtor.

&#x20;   - The client's choice to enable a connector does not create a

&#x20;     leak path. If a leak path exists in a GORKA-provided mechanism,

&#x20;     the mechanism is defective, and the defect is repaired at the

&#x20;     mechanism, not by relying on the client.



Zone 3 — Client-connected third parties

&#x20; A third-party service the client connects to by a path GORKA does

&#x20; not control. Examples: the client wires GORKA to their own OpenAI

&#x20; account, their own credit-bureau API, or any other service outside

&#x20; GORKA's mechanism.



&#x20; GORKA's obligation in Zone 3 is warning. The warning is shown at

&#x20; the point of connection, recorded, and non-blocking. The client

&#x20; decides. GORKA does not prevent the connection.



&#x20; Section 13 of this document defines the Zone 3 declaration that

&#x20; the Client Dashboard already implements.



2.3 Where each connector-related thing lives



&#x20; Thing                                    Zone      Notes

&#x20; ---------------------------------------  --------  ---------------------

&#x20; Connector catalog                        Zone 1    Product metadata

&#x20; Client enablement record                 Zone 1    Metadata

&#x20; Aggregate connector usage                Zone 1    Counts only

&#x20; GORKA master credential (Tier 1)         Zone 1    Server-side only

&#x20; Tier 1 subaccount credential (value)     Data      Local only

&#x20; Tier 2 BYOP credential (value)           Data      Local only

&#x20; Credential metadata (tier, status)       Zone 1    No value. No

&#x20;                                                    fingerprint. No

&#x20;                                                    version.

&#x20; Local connector cache on each device     Data      Mirrors enablement

&#x20; Outbound message content                 Data      Never Zone 1

&#x20; Inbound provider responses with content  Data      Never Zone 1

&#x20; AI prompt / response with debtor data    Data      Never Zone 1

&#x20; AI boundary layer (redaction)            Data      Runs on client device



&#x20; Note on credential metadata. Section 2.3 lists tier and status as

&#x20; the only credential-adjacent metadata permitted in Zone 1 for the

&#x20; MVP. Fingerprint and version are not listed. The funded phase may

&#x20; add them, following Section 3.6. The MVP does not require them.



2.4 The three data flows that must stay separate



The document distinguishes three separate data flows. They are not

the same flow, and later sections must never collapse them.



&#x20; Flow 1 - Local GORKA replica

&#x20;   The connector's enablement and every outbound message content

&#x20;   exist on each authorized device in the client's organization,

&#x20;   inside that device's SQLCipher database. The credential's

&#x20;   replication is scoped by Section 6. Section 2 does not assume

&#x20;   that every authorized device receives every credential; that

&#x20;   question is answered by the distribution rule in Section 6.



&#x20; Flow 2 - Sync between GORKA devices

&#x20;   Enablement changes, credential changes, and communication events

&#x20;   travel between the client's own devices through the sync channel

&#x20;   defined in SYNC-ARCHITECTURE.md. The traffic is end-to-end

&#x20;   encrypted. GORKA's Control Plane may route it but cannot read it.



&#x20; Flow 3 - Provider transmission

&#x20;   For a single outbound operation, the agent's device sends to the

&#x20;   provider only the information that provider's API requires to

&#x20;   execute the operation. For an SMS provider, that is typically the

&#x20;   destination phone number, the sender identity, and the message

&#x20;   body. For an email provider, that is typically the recipient

&#x20;   address, the sender, the subject, and the body. The exact

&#x20;   minimum-information set is defined per provider in Section 8.

&#x20;   Section 2 does not enumerate a single universal set, because

&#x20;   providers differ. GORKA's cloud is not a participant in any of

&#x20;   these transmissions.



&#x20; These three flows carry the same message body in different scopes.

&#x20; Flow 1 is the durable local copy on each device. Flow 2 is the

&#x20; encrypted transport of that copy between the client's own devices.

&#x20; Flow 3 is the one-time transmission of the body to the provider

&#x20; the client chose. They do not overlap. No section of this document

&#x20; treats them as one.



2.5 What Section 2 does not do



&#x20; It does not define how a connector is enabled. Section 4 does.

&#x20; It does not define the credential distribution mechanism.

&#x20;   Section 6 does.

&#x20; It does not define the send flow. Section 8 does.

&#x20; It does not define the AI boundary layer. AGENT-APP-SPEC.md

&#x20;   Section 9 does.

&#x20; It does not amend any zone or plane. It applies them to the

&#x20;   connector domain.



========================================================================

END OF SECTION 2

========================================================================



========================================================================

3\. THE CONNECTOR CATALOG

========================================================================



This section defines the connector catalog: what it is, where it lives,

what it contains, and what it does not contain. It also defines the

capability boundary for the Tier 1 master credential, because that

boundary is a property of the catalog and of GORKA's relationship with

each provider.



3.1 Purpose



The connector catalog is the list of providers GORKA offers. It is a

product catalog. It tells the admin which connectors exist, what each

connector does, which channel it belongs to, and whether GORKA offers

it as a Tier 1 (GORKA-managed) or Tier 2 (BYOP) service.



The catalog is a cloud table. It is product metadata. It contains no

client credentials and no debtor data.



3.2 Where the catalog lives and who writes it



Table:      connector\_catalog

Location:   Zone 1, GORKA's cloud database

Writer:     GORKA operations only (seed script, migration).

Reader:     Both apps, over authenticated API calls.

Lifecycle:  Defined by CONNECTOR-LIFECYCLE.md: ACTIVE, DEPRECATED,

&#x20;           RETIRED.



The catalog is populated by prisma/seed-connectors.ts. That script

is idempotent and uses upsert on the catalog row's stable code key.

It does not reference the stale prisma/seed.ts. It does not touch any

other table.



3.3 The current catalog rows



At the time of this document's writing, five rows are seeded. Each row

is one provider-capability pair, not one provider. Twilio appears

twice because Twilio SMS and Twilio Voice are distinct capabilities

with distinct pricing and, potentially, distinct lifecycle decisions.



&#x20; code          name            category  provider  managedByGorka

&#x20; ------------  --------------  --------  --------  ---------------

&#x20; twilio-sms    Twilio SMS      SMS       Twilio    true

&#x20; twilio-voice  Twilio Voice    VOICE     Twilio    true

&#x20; resend-email  Resend Email    EMAIL     Resend    true

&#x20; mocean-sms    Mocean SMS      SMS       Mocean    false

&#x20; gemini-ai     Gemini AI       AI        Google    false



Every current row is a single provider-capability pair. The

isManagedByGorka flag means: GORKA currently offers a GORKA-managed

provisioning path for this connector in the MVP, in which GORKA

holds a master credential to the provider and creates per-client

subaccounts or per-client keys. When the flag is false, the

connector is offered as Tier 2 (BYOP) only: the client enters their

own provider credential, and GORKA holds no master credential for

that provider.



The MVP catalog currently has three Tier 1 rows (twilio-sms,

twilio-voice, resend-email) and two Tier 2-only rows (mocean-sms,

gemini-ai). The reasoning for each is in Section 3.5.



BYOP is not a separate catalog row. It is a mode of use of an

existing row, defined in Section 4. A single mocean-sms row, with

isManagedByGorka = false, means "Mocean SMS is available, as BYOP

only." A future confirmation of Mocean subaccount support flips the

flag to true and adds a subsection to Section 3.5; it does not

create a new row.



The lifecycleStatus of every current row is ACTIVE. isActive is true

for every current row.



3.4 The catalog row schema



The catalog row carries:



&#x20; code                 The stable identifier. Never changes once set.

&#x20;                      Used by client\_connectors and connector\_usage

&#x20;                      to reference the row.

&#x20; name                 Display name, e.g. "Twilio SMS".

&#x20; description          One-line description.

&#x20; category             SMS | VOICE | EMAIL | AI | PUSH.

&#x20; provider             Vendor name, e.g. "Twilio", "Resend".

&#x20; isManagedByGorka     Tier 1 availability flag.

&#x20; isActive             Quick on/off toggle that does not retire.

&#x20; lifecycleStatus      ACTIVE | DEPRECATED | RETIRED.

&#x20; pricingModel         PASS\_THROUGH | MARKUP | INCLUDED.

&#x20; pricingConfig        JSON. Per-connector pricing rules. For MVP

&#x20;                      the markupPercent is 0.

&#x20; iconUrl              Optional.

&#x20; documentationUrl     Optional.



No field in the catalog row is client-specific. No field holds a

credential. No field holds a debtor identifier.



3.5 The capability boundary for the Tier 1 master credential



For each Tier 1 connector, GORKA holds a master credential to the

provider. This subsection states, for each current Tier 1 provider,

what GORKA's master credential can do and what it does not do.



The rule this subsection enforces:



&#x20; GORKA's master credential is used only for provisioning, lifecycle

&#x20; management, and aggregate usage reporting. It is never used to send

&#x20; a debtor message, to read message content, or to impersonate a

&#x20; client subaccount.



3.5.1 Twilio (Tier 1)



Master credential capabilities that GORKA uses:



&#x20; - Create a subaccount per client organization.

&#x20; - Read subaccount metadata (SID, friendly name, date created,

&#x20;   status).

&#x20; - Read subaccount usage records for billing reconciliation.

&#x20; - Read subaccount balance.

&#x20; - Suspend or close a subaccount when the client relationship ends.



Master credential capabilities that GORKA does not exercise:



&#x20; - Reading message content in a client subaccount. (Twilio's

&#x20;   platform technically allows a master account to reach subaccount

&#x20;   message records. GORKA commits, procedurally and in code, not to

&#x20;   do this. The commitment is recorded here so a future

&#x20;   implementation cannot drift into it silently.)

&#x20; - Sending a message as a client subaccount.

&#x20; - Impersonating a subaccount for any purpose other than the

&#x20;   suspension and closure operations named above.

&#x20; - Modifying a subaccount's configuration after provisioning.

&#x20;   Client-side configuration changes are the client's own concern.



What reaches the client's devices:



&#x20; The subaccount's own credential (an API key pair scoped to that

&#x20; subaccount). This is the credential the agent device uses to send.

&#x20; It is distributed to the client's devices by the mechanism defined

&#x20; in Section 6, not through GORKA's cloud.



3.5.2 Resend (Tier 1)



Master credential capabilities that GORKA uses:



&#x20; - Create one API key per client organization, scoped to a sending

&#x20;   domain the client has verified.

&#x20; - Read per-key aggregate usage.

&#x20; - Revoke a key when the client relationship ends.



Master credential capabilities that GORKA does not exercise:



&#x20; - Reading message content.

&#x20; - Sending as the client's key.

&#x20; - Accessing the client's audience or contact lists.



What reaches the client's devices:



&#x20; The per-client API key. Same distribution mechanism as Twilio.



3.5.3 Mocean (Tier 1 not applicable in MVP)



CONNECTOR-LIFECYCLE.md records Mocean Tier 1 as not yet confirmed.

Mocean's subaccount support is not verified. Until it is verified,

Mocean is offered as Tier 2 (BYOP) only. The MVP catalog reflects

this with isManagedByGorka = false.



For the MVP this means: there is no GORKA master credential for

Mocean. The client enters their own Mocean credential, and it is

distributed to the client's devices by the mechanism in Section 6.



If Mocean subaccount support is confirmed in a future phase, the

flag flips to true, a subsection stating the master credential's

capability boundary is added here, and the provisioning code is

written. The change is additive; it does not require a new catalog

row.



3.5.4 Gemini (Tier 1 not applicable in MVP)



The MVP catalog marks gemini-ai with isManagedByGorka = false. GORKA

does not currently have a reseller or partner arrangement for Gemini

access. There is no GORKA master credential for Gemini in the MVP.



The client uses Gemini through their own credentials (BYOP). The AI

boundary layer runs on the client's device and prevents

debtor-identifying content from reaching the AI provider. See Section

12 and AGENT-APP-SPEC.md Section 9.



If a reseller or partner arrangement is established in a future

phase, the flag flips to true, Section 3.5 gains a subsection

stating the master credential's capability boundary, and the

provisioning code is written.



3.5.5 The general rule for future Tier 1 providers



The pattern above generalizes. When a new provider is added to the

catalog as Tier 1, Section 3.5 must be extended with a subsection

for that provider, stating:



&#x20; - What the master credential can do, that GORKA uses.

&#x20; - What the master credential can do, that GORKA commits not to do.

&#x20; - What reaches the client's devices.



The commitment is procedural as well as technical. Some providers'

master credentials technically allow more than the boundary above.

Where that is the case, the boundary is a commitment recorded here

and enforced in code (the provisioning module in GORKA's backend

must not call the send or content-read endpoints on a client's

subaccount).



The catalog itself does not carry this boundary. The boundary is a

property of the integration, documented here and enforced in the

provisioning code. A future session that adds a new Tier 1 provider

must add a subsection here before the provider's integration code is

written.



3.6 Credential fingerprints and version — MVP choice



In the October 5, 2026 design session, a proposal was raised to

permit Zone 1 to hold a credential fingerprint and a credential

version. The fingerprint would identify "which credential is on

which device" without exposing the credential value.



The MVP choice is: no fingerprint in Zone 1, and no version number

in Zone 1. Both are deferred to the funded phase.



Reasoning:



&#x20; - A fingerprint is a hash of the credential. If the hash is a

&#x20;   plain SHA-256 of the credential value, an attacker who sees the

&#x20;   fingerprint can attempt an offline brute force against the

&#x20;   credential. Whether that attack succeeds depends on how

&#x20;   unguessable the credential is, which is not GORKA's decision to

&#x20;   make.

&#x20; - A safe fingerprint is an HMAC of the credential, keyed with a

&#x20;   secret that never leaves the client's device. That is

&#x20;   implementable but adds a key management problem of its own.

&#x20; - The MVP does not need either. Credential versioning is a

&#x20;   funded-phase concern: a single credential per connector per

&#x20;   organization is sufficient for the MVP.

&#x20; - If a future phase needs to identify which credential is on which

&#x20;   device, the HMAC-keyed approach is preferred, with the key held

&#x20;   by the admin's device and never transmitted. That decision is

&#x20;   recorded here so the next session does not accidentally

&#x20;   introduce a plain-hash fingerprint.



For the MVP, Zone 1's client\_connectors row carries no fingerprint

and no credential version. The row carries only: which connector is

enabled, its status, and the credentialsLocation value (LOCAL for

MVP, CLOUD for funded-phase Tier 1 where applicable).



3.7 How the catalog changes



Adding a provider, changing a provider's capabilities, or retiring a

provider follows CONNECTOR-LIFECYCLE.md:



&#x20; Add:     assess provider against the six conditions in the

&#x20;          lifecycle document, add a catalog row, extend Section

&#x20;          3.5 if Tier 1, deploy the adapter in the shared Rust

&#x20;          crate.

&#x20; Change:  update the catalog row, and if a capability boundary

&#x20;          changed, update Section 3.5.

&#x20; Deprecate: mark lifecycleStatus = DEPRECATED, block new

&#x20;          enablements, notify clients.

&#x20; Retire:  mark lifecycleStatus = RETIRED, disable new enablement,

&#x20;          preserve historical rows for billing.



No change to the catalog ever changes the credential that a client's

device already holds. A credential change on the provider side is

handled by the mechanism in Section 6, not by catalog edits.



3.8 What Section 3 does not do



&#x20; It does not define enable/disable. Section 4 does.

&#x20; It does not define credential storage or distribution. Section 6

&#x20;   does.

&#x20; It does not define the send flow. Section 8 does.

&#x20; It does not define the AI Copilot flow. Section 12 does.

&#x20; It does not define the client\_connectors table in detail.

&#x20;   CLOUD-TABLES.md defines it. This section references it as the

&#x20;   table that joins the catalog to a client organization.

&#x20; It does not amend CONNECTOR-LIFECYCLE.md. Where the two overlap,

&#x20;   CONNECTOR-LIFECYCLE.md is authoritative for the process and

&#x20;   Section 3 is authoritative for the current catalog's content.



========================================================================

END OF SECTION 3

========================================================================



========================================================================

4\. ADMIN ENABLE / DISABLE

========================================================================



This section defines the admin side: what the admin sees, what the

admin clicks, what the backend does, and where the credential is

entered. It covers both enablement flows (Tier 1 and Tier 2) and the

disable flow.



It is the Client Dashboard side of the connector model. The agent

side (how an enabled connector is used) is Section 8. The credential

distribution to agent devices is Section 6.



4.1 Purpose and placement



The admin is the only role that manages connectors. The admin

enables a connector, provides or provisions its credential, and

thereby makes it available to every authorized agent in the

organization.



The admin does not send messages to debtors from the Client

Dashboard. This is the September 27 A-2 decision and the Client's

role boundary: the Client Dashboard manages; the Agent App sends.



4.2 Where this lives in the two applications



Cloud (Zone 1):

&#x20; - The connector catalog. Section 3.

&#x20; - The per-client enablement record (client\_connectors row). Which

&#x20;   organization has which connector enabled, in which tier, in

&#x20;   which status.

&#x20; - Aggregate usage. Section 11.



Admin's device (Data Plane):

&#x20; - The credential value for the connector.

&#x20; - The connector's per-organization configuration (for example the

&#x20;   "from" phone number or sender email the admin chose).



Neither the credential value nor the connector's per-organization

configuration reaches Zone 1 for either tier.



4.3 The current backend endpoints



Three endpoints exist on the current backend, mounted at

/api/connectors, behind authenticateToken:



&#x20; GET  /api/connectors           List the caller's organization's

&#x20;                                enablement records. OWNER sees all

&#x20;                                organizations; other roles see their

&#x20;                                own only.

&#x20; POST /api/connectors/enable    Create or update an enablement record

&#x20;                                for the caller's organization.

&#x20;                                Currently accepts only

&#x20;                                credentialsLocation = LOCAL. Rejects

&#x20;                                CLOUD. The rejection message reads:

&#x20;                                "CLOUD credentials not yet available.

&#x20;                                Use LOCAL (bring your own

&#x20;                                credentials)."

&#x20; POST /api/connectors/disable   Set the enablement record's status to

&#x20;                                DISCONNECTED.



Each endpoint validates the catalog row exists and is ACTIVE before

acting. The enable endpoint upserts on (organizationId,

connectorCode).



Under the connector model, both Tier 1 and Tier 2 use LOCAL for

credentialsLocation. Tier 1 does not mean "credential lives in

cloud." Tier 1 means "GORKA provides the provisioning mechanism for

the client's subaccount, and the subaccount's own credential is

distributed to the client's devices." The subaccount credential is

LOCAL, on the client's devices, not in GORKA's cloud.



The backend's current LOCAL-only rule is therefore correct for the

MVP. CLOUD credentialsLocation is a funded-phase concept that does

not apply while D1 is in force.



4.4 The admin experience



The Client Dashboard's Connectors page shows every row of the

catalog, with the organization's current enablement state for each

row:



&#x20; - Which connector it is (name, provider, category).

&#x20; - Whether the organization has it enabled.

&#x20; - Whether it is Tier 1 or Tier 2 (derived from

&#x20;   isManagedByGorka on the catalog row).

&#x20; - Status of the organization's enablement record: CONNECTED,

&#x20;   DISCONNECTED, or ERROR.



Each row offers one primary action whose label and behavior depend

on the current state and tier:



&#x20; Tier 1, not yet enabled:      "Enable"

&#x20; Tier 1, enabled:              "Disable"  (and "Test connection")

&#x20; Tier 2, not yet configured:   "Configure"

&#x20; Tier 2, configured:           "Disable"  (and "Test connection")



The word "Connect" is not used. It is ambiguous between "the admin

has enabled this connector in GORKA" and "the device has reached the

provider successfully." The actions are "Enable"/"Disable" for

enablement and "Test connection" for reachability. This is a

deliberate terminology choice for this document and for the UI it

describes.



4.5 Tier 1 enable flow



The Tier 1 enable flow has two steps. The admin performs one; GORKA's

backend performs the other.



Step 1 — GORKA provisioning. When the admin clicks "Enable" on a

Tier 1 connector, the admin's device calls the enable endpoint. The

backend, using GORKA's master credential to that provider, performs

the provisioning operation defined in Section 3.5 for that provider:



&#x20; Twilio:  create a subaccount for the client organization, and

&#x20;          issue the subaccount's own API credentials.

&#x20; Resend:  create a per-client API key scoped to a sending domain

&#x20;          the client has verified.

&#x20; (Mocean and Gemini are not Tier 1 in the MVP; no provisioning step.)



Step 2 — credential handover. The provider returns the newly created

subaccount credential to GORKA's backend. The backend returns it, in

the response body of the enable request, to the admin's device over

the existing authenticated TLS channel. The admin's device stores

the credential locally. The backend does not write the credential to

its database.



The credential exists in GORKA's backend process memory for the

duration of the enable request. It is not persisted in Zone 1 in any

form. It is not logged. It is not re-readable by the backend after

the response is sent.



The admin sees a confirmation: "Twilio SMS enabled. The connector is

ready for your agents." The admin never sees the credential itself.

It is not displayed in the UI. It is not copyable. It is on the

admin's device, stored encrypted by SQLCipher, ready to be

distributed to agent devices by the mechanism in Section 6.



4.6 Tier 2 enable flow



The Tier 2 flow has one step. The admin performs it in full.



When the admin clicks "Configure" on a Tier 2 connector, the admin's

device opens a form. The form asks for the fields the provider's API

requires. For Mocean SMS in the MVP those are apiKey and apiSecret.

For a future BYOP email provider they would be the provider's API

key and possibly a from-address.



The admin types the credential into the form. The form submits to a

local Tauri command, not to a remote API. The Tauri command writes

the credential directly to the local SQLCipher database. No network

hop occurs for the credential value.



The admin's device then calls the enable endpoint with

credentialsLocation = LOCAL. The backend writes the enablement

record. The credential value is not part of that request. The

backend never sees it.



The admin sees a confirmation: "Mocean SMS enabled. The connector is

ready for your agents." As in the Tier 1 flow, the admin never sees

the credential again after typing it.



The critical architectural point: in the current pre-recovery code,

the ConfigurationModal submits its values through

connectorsService.connectConnector(), which calls

api.post('/connectors/${id}/connect', data). That call would send

the credential to GORKA's cloud. That is a boundary violation in the

current UI. The intended shape replaces the remote call with a local

Tauri command. The change is a code fix, not a design change. It is

in scope for the implementation phase; Section 4.10 records it.



4.7 The disable flow



When the admin clicks "Disable" on an enabled connector, the admin's

device calls the disable endpoint. The backend sets the enablement

record's status to DISCONNECTED and records disconnectedAt. The

catalog row is unaffected; the connector remains available for the

organization to re-enable.



What happens to the credential on the admin's device is defined by

Section 6. Two options are possible and Section 6 picks one:



&#x20; - The credential is retained locally until re-enabled.

&#x20; - The credential is deleted locally on disable.



The disable flow's effect on agent devices is also defined by

Section 6. Section 4 states only that the enablement record's status

changes, and that the change is propagated to the organization's

devices through the sync channel.



An admin cannot disable a connector if another admin in the same

organization has it enabled with a pending sync delivery. Concurrency

on the enablement record is handled by the existing upsert semantics

of the enable endpoint. The MVP does not require optimistic

concurrency control on this record. This is recorded as a possible

funded-phase concern.



4.8 What is written where at enable time



&#x20; Zone 1 (GORKA cloud), client\_connectors row:

&#x20;   id

&#x20;   organizationId

&#x20;   connectorCode

&#x20;   status                   CONNECTED

&#x20;   credentialsLocation      LOCAL

&#x20;   connectedAt              now

&#x20;   disconnectedAt           null

&#x20;   suspendedReason          null



&#x20; Zone 1 (GORKA cloud), nothing else:

&#x20;   No credential value.

&#x20;   No credential fingerprint.

&#x20;   No credential version.

&#x20;   No per-client configuration (from-address, sender number, etc.).



&#x20; Data Plane (admin's device), local SQLCipher:

&#x20;   The credential value.

&#x20;   The per-client configuration the connector needs (from-address,

&#x20;   sender number, etc.).

&#x20;   A local cache row mirroring the enablement record.

&#x20;   A pending outbound event, in the sync\_events table, that will

&#x20;   carry the enablement change (and, per Section 6, the credential)

&#x20;   to the organization's other devices.



4.9 The connector's per-organization configuration



Some connectors need a per-organization configuration beyond the

credential. Twilio SMS needs a "from" phone number. Resend needs a

"sender" email address and a verified sending domain. Mocean SMS

needs a sender identity.



Where does this configuration live?



It lives on the admin's device, stored locally, alongside the

credential. It is part of the same connector definition that

Section 6 distributes. The backend's client\_connectors row does not

carry it.



The reason: the per-organization configuration is not debtor data,

but it is client-operational data that the agent's device needs at

send time, and it is meaningless without the credential it pairs

with. Keeping credential and configuration together, on the client's

devices, is the simpler model and matches the invariant's spirit:

nothing operational about a specific client's setup reaches GORKA's

cloud unless it must.



If a future phase requires Zone 1 to know the from-number (for

example, for aggregate usage reporting by number), that would be a

decision to record and justify. The MVP does not need it.



4.10 The current UI's intended shape vs its current state



The Client Dashboard's Connectors.tsx page today is pre-recovery

code. It calls backend endpoints that do not exist on the current

backend:



&#x20; /connectors/types

&#x20; /connectors/:id

&#x20; /connectors/:id/connect

&#x20; /connectors/:id/connect-auto

&#x20; /connectors/:id/test

&#x20; /connectors/:id/disconnect



None of those routes exist. Only GET /api/connectors, POST

/api/connectors/enable, and POST /api/connectors/disable exist.

The page also expects a different row shape than the current

endpoint returns.



The intended shape for the implementation phase is:



&#x20; - The page reads GET /api/connectors to obtain the organization's

&#x20;   enablement records and reads the catalog to display the

&#x20;   catalog rows.

&#x20; - "Enable" on a Tier 1 row calls POST /api/connectors/enable with

&#x20;   credentialsLocation = LOCAL and stores the credential the

&#x20;   response body returns.

&#x20; - "Configure" on a Tier 2 row opens the credential form. On

&#x20;   submit, the credential is written locally through a Tauri

&#x20;   command, and POST /api/connectors/enable is called with

&#x20;   credentialsLocation = LOCAL and no credential in the body.

&#x20; - "Disable" calls POST /api/connectors/disable.

&#x20; - "Test connection" calls a new Tauri command that attempts a

&#x20;   harmless provider call (a balance lookup or a test endpoint

&#x20;   the provider offers) using the locally stored credential.

&#x20;   That command is defined in Section 8, because it uses the same

&#x20;   adapter as the send flow.



The current page's endpoints and row shape are the intended shape's

approximate ancestor. The intended shape is what a future

implementation must produce. The old endpoints are recorded here so

that the difference is not mistaken for an implementation error.



4.11 What Section 4 does not do



&#x20; It does not define the credential distribution mechanism. Section

&#x20;   6 does. Section 4 ends with the credential stored on the admin's

&#x20;   device.

&#x20; It does not define the send flow. Section 8 does.

&#x20; It does not define the agent's view of the enabled connectors.

&#x20;   Section 5 does.

&#x20; It does not define the sync event that carries the enablement

&#x20;   change. Section 6 does.

&#x20; It does not fix the current UI's code. That is an implementation

&#x20;   phase task.

&#x20; It does not define the Tier 1 master credential's capability

&#x20;   boundary. Section 3.5 does.

&#x20; It does not define how the credential is stored at rest on the

&#x20;   admin's device. SQLCipher and the local storage rules defined

&#x20;   in SYNC-ARCHITECTURE.md Section 7.1 and in the local schema

&#x20;   apply.



========================================================================

END OF SECTION 4

========================================================================



========================================================================

5\. THE AGENT VIEW

========================================================================



This section defines what an agent sees: how an enabled connector

becomes visible in the Agent App, where on the screen it appears,

and what the agent can do with it. It is the UI-level view. The

send flow that a click leads into is Section 8. The mechanism by

which the agent's device learned that the connector exists is

Section 6.



5.1 Purpose and placement



The agent is a collection worker. The agent does not manage

connectors, does not configure credentials, does not choose

providers. The agent opens a debtor's profile, and the connectors

the admin has made available are there.



This is the "ready-to-go" principle. The admin decides what is

available. The agent uses it. No credential is typed, no provider

name is researched, no setup step stands between the agent and the

contact action.



5.2 What the agent sees on the debtor profile



The debtor profile is the core screen of the Agent App, defined in

AGENT-APP-SPEC.md Section 11.6. It shows the debtor's contact

details, debts, communications, actions, documents, photo, and

relations.



Section 5 adds nothing to that layout. It applies a rule to the

Communication buttons row, which AGENT-APP-SPEC.md Section 11.6

already names: "One button per available connector."



The rule is deterministic. A connector's button appears on a

debtor's profile if and only if both conditions hold:



&#x20; 1. The admin has enabled that connector for the organization,

&#x20;    and the agent's device has learned that through the sync

&#x20;    channel. See Section 6.

&#x20; 2. The debtor has the contact field the connector needs.



The contact-field dependency, from AGENT-APP-SPEC.md Section 8.3:



&#x20; Twilio voice, Twilio SMS, Mocean SMS, WhatsApp    need a phone

&#x20; Resend email                                      needs an email



The rule is not configurable per debtor, per agent, or per case.

There are no manual hiding controls, no per-debtor overrides, no

agent-level preferences. The page renders itself from the two

conditions.



5.3 What a button looks like and does



Each button carries the connector's display name (for example,

"Mocean SMS" or "Resend Email") and the channel icon. It does not

carry the provider account, the sender address, the phone number,

or any other account-level detail. The agent sees "Mocean SMS," not

"Mocean account 4123."



Clicking a button opens the send modal. The modal's layout is

defined in AGENT-APP-SPEC.md Section 8.3: destination (pre-filled

from the debtor's contact field, editable), body, template picker,

single preview, Send and Cancel. The send flow itself is Section 8.



5.4 What the agent does not see



This is a hard boundary, restated from Section 1.3 of

AGENT-APP-SPEC.md and from CONNECTOR-LIFECYCLE.md:



&#x20; - The provider's credential, in any form.

&#x20; - The provider's account details (account SID, subaccount name,

&#x20;   sending number, sender domain, key name).

&#x20; - The provider's pricing or rate plan.

&#x20; - The connector's per-organization configuration (from-number,

&#x20;   from-address, sender identity).

&#x20; - Any indication of which tier the connector is (Tier 1 vs Tier 2

&#x20;   is invisible in the Agent App; it is an admin-side concept).

&#x20; - Other agents' sent messages, unless the agent's local replica

&#x20;   already holds them via the sync channel. Under the Option A

&#x20;   replication decision from Section 1.5, every device holds every

&#x20;   outbound communication. The agent can therefore see another

&#x20;   agent's message in the debtor's Communications card. That is

&#x20;   the design.



The agent sees the connector's name and the action it performs.

Nothing else.



5.5 The local connector cache on the agent device



The agent's device does not query GORKA's cloud for "which

connectors are enabled." That would put the cloud on the read path

of every debtor profile render and would make the Agent App depend

on a live network call to draw a button.



Instead, the agent's device holds a local cache of the

organization's enabled connectors. The cache is a local table. Its

contents are the catalog metadata for each enabled connector (name,

category, provider-visible name) plus the local configuration the

connector needs at send time (from-address, from-number) plus, per

Section 6, the credential itself.



The cache is populated and updated by the sync channel. When the

admin enables, disables, or reconfigures a connector, an event

travels to the organization's devices. On each device, the cache

is updated in the same transaction that accepts the event.



This is why the Agent App draws buttons from local state and why it

does not show "loading connectors" spinners. The state is on the

device.



The exact table, its schema, and the event that populates it are

defined in Section 6. Section 5 states only that the cache exists

and is the source of the button-rendering decision.



The local record contains secrets and configuration that the

adapter needs. The UI projection from that record contains only

the fields the agent is allowed to see: the connector's name and

its channel category, both of which are catalog metadata, not

client data. Section 6.4 states this distinction as an

architectural rule.



5.6 The Communication Tools page



AGENT-APP-SPEC.md Section 11.8 defines a Communication Tools page

as a sidebar entry. In Phase 9.5, that page is a read-only

placeholder. Its exact sentence is: "Your administrator has not

enabled any communication tools yet. Contact your administrator to

enable a channel."



Once the connector model is implemented, that page becomes a real

list:



&#x20; For each connector enabled by the admin:

&#x20;   - Connector name (for example "Mocean SMS").

&#x20;   - The channels it supports (SMS, Email, Voice).

&#x20;   - A one-line note about what it does.



&#x20; The page does not show:

&#x20;   - Credentials, in any form.

&#x20;   - Provider account details.

&#x20;   - Usage totals.

&#x20;   - Billing.



&#x20; The page is informational. The agent does not configure anything

&#x20; here. Its purpose is to answer "what can I do from this device?"

&#x20; without requiring the agent to open a debtor's profile to find

&#x20; out.



If no connector is enabled by the admin, the page shows the empty

state sentence above.



5.7 The agent's role in the connector model



Stated once, plainly, so a later section does not blur it:



&#x20; The agent is the sender of record. The agent chooses the

&#x20; connector, chooses the message body, and presses Send.



&#x20; The admin is the enabler of record. The admin chooses which

&#x20; connectors the organization has, provides or provisions the

&#x20; credentials, and provides the per-organization configuration.



&#x20; GORKA is the mechanism provider. GORKA builds the adapter, the

&#x20; sync channel that carries the credential, the send flow, and the

&#x20; boundary layer for AI. GORKA is not on the path of any message

&#x20; to a debtor.



&#x20; The provider is the third party that executes the send. The

&#x20; provider receives the information its API requires and nothing

&#x20; more. It is not a participant in the sync channel or in GORKA's

&#x20; systems.



These four roles are distinct. They do not overlap. Section 8

applies them to the send flow.



5.8 What Section 5 does not do



&#x20; It does not define the credential distribution mechanism or the

&#x20;   local connector cache's schema. Section 6 does.

&#x20; It does not define the send flow that a button click opens.

&#x20;   Section 8 does.

&#x20; It does not define the single-recipient modal's layout in full.

&#x20;   AGENT-APP-SPEC.md Section 8.3 does.

&#x20; It does not define the bulk-action flow. AGENT-APP-SPEC.md

&#x20;   Section 8.4 does, and it is a funded-phase item.

&#x20; It does not define the AI Copilot's UI. AGENT-APP-SPEC.md

&#x20;   Section 11.6 does.

&#x20; It does not amend AGENT-APP-SPEC.md. Where the two overlap,

&#x20;   AGENT-APP-SPEC.md is authoritative for the UI layout, and

&#x20;   Section 5 is authoritative for the connector-specific

&#x20;   rendering rule.



========================================================================

END OF SECTION 5

========================================================================



========================================================================

6\. CREDENTIAL STORAGE AND DISTRIBUTION

========================================================================



This section defines how a connector's credential reaches an agent's

device, where it is stored, and what rules govern its distribution,

replacement, and removal. It is the security boundary that the

October 5, 2026 session identified as the section's primary

obligation.



It answers, explicitly, the questions the Section 2 review carried

forward:



&#x20; - Which devices receive which credential.

&#x20; - Whether every authorized device receives it.

&#x20; - Whether the Client (admin) and Agent devices receive identical

&#x20;   credentials.

&#x20; - Whether credentials can be revoked independently.

&#x20; - What happens on agent compromise and offboarding.

&#x20; - Whether the credential is ever displayed back to the user.

&#x20; - Whether it is stored encrypted locally after receipt.

&#x20; - Whether credential updates and replacement are supported.

&#x20; - What happens on disable.

&#x20; - What happens on newly enrolled devices.



6.1 Purpose and the security framing



Credential distribution is itself a security boundary. It is not

merely another synchronization event. Once a device holds a provider

credential, that device can act on the provider's API as the client

organization. A device that can send as the organization is a device

that must be trusted with the ability to send as the organization.



This section states the rule and the limitations plainly. It does

not hide the residual risk. It does not pretend that the MVP can do

what the funded phase will do.



The section's authority is Section 3.5 (which provider credentials

exist) and Section 4.5/4.6 (how the credential is first created or

entered). Section 6 begins where Section 4 ends: the credential is

on the admin's device, ready to be distributed.



6.2 What is being distributed, at the logical level



For each enabled connector, three things are associated with the

client organization:



&#x20; 1. The credential value. An opaque blob. Its internal structure

&#x20;    is provider-specific. For Twilio it is a subaccount SID and

&#x20;    auth token pair. For Resend it is a scoped API key. For Mocean

&#x20;    it is an API key and secret pair. For a future BYOP provider

&#x20;    it is whatever that provider requires.



&#x20;    The sync engine treats the credential value as opaque bytes. It

&#x20;    does not parse it. It does not validate it. Its structure is a

&#x20;    private matter between the enable flow that wrote it (Section

&#x20;    4.5 or 4.6) and the adapter that reads it (Section 7).



&#x20; 2. The per-organization configuration. Also provider-specific.

&#x20;    For Twilio SMS this is the from-number. For Resend Email this

&#x20;    is the sender address and the verified sending domain. For

&#x20;    Mocean SMS this is the sender identity.



&#x20; 3. The enablement metadata. The connector code, the tier, the

&#x20;    status (enabled or disabled), and the timestamps.



These three things travel together. Section 6 defines the rule for

distributing all three. It does not separate them.



6.3 The local record, at the logical level



Each device in the organization holds one local record per connector

per organization. At the logical level, the record contains:



&#x20; connectorCode         The catalog's stable code key. Identifies

&#x20;                       the connector.

&#x20; organizationId        The device's own organization.

&#x20; tier                  TIER1 or TIER2. Derived from the catalog's

&#x20;                       isManagedByGorka flag at enable time.

&#x20; status                ENABLED or DISABLED. Mirrors the cloud's

&#x20;                       client\_connectors.status.

&#x20; credentialValue       The opaque credential blob. See Section

&#x20;                       6.2.

&#x20; configuration         The per-organization configuration. See

&#x20;                       Section 6.2.

&#x20; sourceDeviceId        The device instance id of the device that

&#x20;                       originated the most recent write to this

&#x20;                       record. For traceability, not for

&#x20;                       authorization.

&#x20; createdAt             Local wall clock of the first write.

&#x20; updatedAt             Local wall clock of the most recent write.



No fingerprint. No credential version. Section 3.6 rules both out

for the MVP.



The physical table is a local table, added to the local schema by an

amendment to LOCAL-TABLES.md. Its exact column types are defined in

that amendment, not here.



The local record is inside the SQLCipher database. It is protected

at rest by the same encryption as every other local row. See Section

6.9.



6.4 The local connector cache is not a separate thing



The Section 5 review flagged a distinction worth stating precisely.

Section 5.5 said the local cache holds "the credential itself" and

also that the agent UI does not show provider-account details. Both

are true. The resolution is that the cache and the credential are

not two separate stores; they are the same local record, viewed from

two angles.



The single local record from Section 6.3 is:



&#x20; - Read by the sync engine, to accept and apply updates.

&#x20; - Read by the send path (Section 8), which projects the

&#x20;   credential value and the configuration into the adapter that

&#x20;   performs the send.

&#x20; - Read by the Agent UI, which projects only the connector code,

&#x20;   the tier, and the status. Never the credential value. Never

&#x20;   the configuration. Never the sourceDeviceId.



The rule, stated once: the local record contains secrets and

configuration that the adapter needs. The UI projection from that

record contains only the fields the agent is allowed to see (the

connector's name and its channel category, both of which are catalog

metadata, not client data).



A future implementation that projects the credential value or the

configuration into the UI is wrong, regardless of how convenient it

would be for debugging. The rule is architectural, not aesthetic.



6.5 The distribution rule, stated precisely



The rule for which devices receive which credential:



&#x20; Every authorized device in the client's organization receives

&#x20; every enabled connector's credential and configuration.



Three clarifications:



&#x20; 1. "Authorized device" means a device that holds the organization

&#x20;    key, has unlocked its local database, and is participating in

&#x20;    the sync channel. A newly enrolled device is authorized as

&#x20;    soon as the enrollment import completes. See Section 6.7.



&#x20; 2. "Every enabled connector's credential" means every connector

&#x20;    whose enablement record in client\_connectors has status =

&#x20;    CONNECTED. A disabled connector's credential is not held on

&#x20;    any device. See Section 6.6.



&#x20; 3. There is no per-device scoping in the MVP. Every authorized

&#x20;    device receives the same set of credentials. A future funded-

&#x20;    phase capability may introduce per-device scoping (for example,

&#x20;    "this agent is authorized to use SMS but not voice"). The MVP

&#x20;    does not. If the funded phase adds it, the change is additive:

&#x20;    a targeting field on the distribution event, not a redesign.



This is the answer to the Section 2 review's question about whether

"every authorized agent" is a blanket rule. It is. Deliberately. The

reasoning is in Section 6.6.



6.6 Why every authorized device receives every credential



The MVP's communication model is: the agent acts from the device

that is nearest to the debtor at the moment the contact is made.

Field agents work from a laptop in a car. Office agents work from a

desktop. An agent may use any of their organization's devices at

any time. Forcing the agent to check "does this device have the

credential I need?" would defeat the ready-to-go principle in

Section 5.1.



Additionally, the replication model is Option A. Every authorized

device holds every outbound communication. Every authorized device

holds every debtor record. Every authorized device holds every

enabled connector's credential. This is the same model. It is not a

special case for credentials.



The cost is the one already documented in Section 1.5: a compromised

device holds every credential the organization has enabled. That is

the R7 and R8 residual risk from THREAT-MODEL.md. It is accepted for

the MVP.



6.7 Newly enrolled devices



A newly enrolled device receives the credentials through the initial

sync.



The enrollment flow is defined in SYNC-ARCHITECTURE.md Section 5.5.

The device imports an enrollment package, installs the organization

key, and begins synchronizing. During the initial sync, it pulls the

full event history from its peer, including the events that carry

connector enablement and credential changes.



There is no separate credential enrollment step. The agent does not

type anything. The admin does not do anything extra. The device

receives the credentials as part of the same sync that delivers the

debtors.



This is why Section 5.5 says the agent's device can draw buttons

from local state without contacting the cloud. The local state

arrived with the debtors.



6.8 Enable, replace, disable, and re-enable



The four lifecycle flows, each stated as a rule.



Enable.

&#x20; Covered in Section 4.5 (Tier 1) and Section 4.6 (Tier 2). At

&#x20; completion, the admin's device holds the credential and

&#x20; configuration. The admin's device originates a

&#x20; CONNECTOR\_ENABLED event (see Section 6.11). Every other

&#x20; authorized device accepts the event in the same transaction that

&#x20; applies it, and now holds the credential.



&#x20; The event carries the credential as opaque bytes. The sync

&#x20; channel encrypts the event with the session key, which is

&#x20; derived from the organization key. The credential is therefore

&#x20; doubly protected in transit: it is inside an authenticated,

&#x20; encrypted sync message, and its value is meaningless outside the

&#x20; provider's API.



Replace.

&#x20; When the credential changes — for example, the admin rotates the

&#x20; provider's API key, or a Tier 1 provider issues a new subaccount

&#x20; credential — the admin's device originates a

&#x20; CONNECTOR\_CREDENTIAL\_REPLACED event. The event carries the new

&#x20; credential value. Every device overwrites its local record's

&#x20; credentialValue field with the new value.



&#x20; The old value is not retained. The local transaction that applies

&#x20; the event replaces the value. There is no history record of the

&#x20; old credential. This differs from the debtor-state model, where

&#x20; losing values are preserved in history\_records. Credentials are

&#x20; not debtor state, and there is no compliance reason to keep an

&#x20; old credential. Keeping it would only increase the attack surface

&#x20; on a compromised device.



Disable.

&#x20; When the admin disables a connector, the admin's device

&#x20; originates a CONNECTOR\_DISABLED event. Every device, including

&#x20; the admin's own device, deletes its local record for that

&#x20; connector. The credential value, the configuration, and the

&#x20; enablement metadata are removed together.



&#x20; Deleting rather than marking disabled is a deliberate choice. A

&#x20; disabled record that still held the credential would let a

&#x20; compromised device use the connector out-of-band, without ever

&#x20; re-enabling it through the sync channel. Deleting removes that

&#x20; possibility. The cost is friction on re-enable: see below.



Re-enable.

&#x20; When the admin re-enables a connector after a disable, the enable

&#x20; flow from Section 4.5 or 4.6 runs again in full. For Tier 1, GORKA

&#x20; provisions a new subaccount credential. For Tier 2, the admin

&#x20; re-enters the credential through the local form.



&#x20; There is no "re-enable with the previous credential" path. The

&#x20; previous credential no longer exists on any device. This is the

&#x20; clean rule; a future funded-phase optimization could cache the

&#x20; admin's credential in an encrypted local backup, but the MVP does

&#x20; not.



The four flows share one property: at every point in every flow, at

most one version of a credential exists. There is no window in which

an old credential and a new credential coexist on the same device.

This is a deliberate simplification for the MVP.



6.9 Storage at rest



The credential is stored inside the local SQLCipher database. It is

protected by the same encryption as every other local row: the

database is encrypted with a key derived from the user's local

password via Argon2id.



What this protection means:



&#x20; - With the database locked, the credential is unreadable.

&#x20; - With the database unlocked, the credential is readable by any

&#x20;   process on the device that can access the database file through

&#x20;   the running application.



What this protection does not mean:



&#x20; - It does not protect the credential from a user who has already

&#x20;   unlocked the database and whose process is compromised. That is

&#x20;   residual risk R5 from THREAT-MODEL.md.

&#x20; - It does not add a second, independent encryption layer over the

&#x20;   credential itself. Adding one whose key lives on the same

&#x20;   unlocked device would not reduce the MVP's primary threat: an

&#x20;   attacker who has already unlocked the database and controls the

&#x20;   process. A hardware-backed key, an OS credential vault, or a

&#x20;   separate trust domain could materially change the threat model.

&#x20;   None of those is present in the MVP. If the funded phase adds

&#x20;   one, the credential's storage changes as part of that work.

&#x20;   Until then, one encryption layer on the same unlocked device is

&#x20;   the correct model.



The credential is treated as opaque bytes throughout its local

lifetime. The local schema stores it as a BLOB. Its internal

structure — JSON, concatenated fields, provider-specific — is

decided by the adapter that writes and reads it, and is not

interpreted by the local schema or the sync engine.



6.10 Offboarding and device compromise — the MVP limitation



This subsection states the MVP's limitation plainly. It is not a

defect. It is a scope decision, and it is recorded here because a

future session, a security review, or a bank's compliance reviewer

will ask.



What the MVP can do when a device is lost, stolen, compromised, or

belonging to a departing agent:



&#x20; - Disable the user's GORKA account. Prevents future

&#x20;   authentication. Prevents future synchronization. See

&#x20;   SYNC-ARCHITECTURE.md Section 8.6.

&#x20; - Remove the user's device\_registrations row. Limits future

&#x20;   sessions to the extent peers check the list.



What the MVP cannot do:



&#x20; - Delete the credential from a device GORKA cannot reach.

&#x20; - Invalidate a credential that has already been distributed.

&#x20; - Rotate the organization key.

&#x20; - Perform cryptographic offboarding of a device.



Stated directly: revocation prevents future synchronization. It does

not remove data or credentials already on the device. This is the

same property as the multi-user model's revocation caveat

(ARCHITECTURAL-LAW.md Section 8, MULTI-USER-CONCEPT.md Section 8). It

is the accepted residual risk R7 and R8 from THREAT-MODEL.md.



The mitigation available in the MVP is procedural, not cryptographic:



&#x20; - Disable the departing user's account.

&#x20; - On the provider side, revoke the credential the departing user's

&#x20;   device holds. This is done through the provider's own console or

&#x20;   API, using GORKA's master credential (for Tier 1) or the admin's

&#x20;   own provider access (for Tier 2). The MVP's enable flow

&#x20;   supports this: when the admin next enables or replaces the

&#x20;   connector, a new credential is provisioned, and the old one is

&#x20;   invalidated at the provider.

&#x20; - Optionally, the admin can trigger a credential replacement

&#x20;   without disabling the connector. This issues a new credential

&#x20;   to every remaining device. The old credential, still on the

&#x20;   departed device, will fail at the provider.



The provider-side revocation is the actual mechanism. The sync

channel cannot remove the credential from the departed device, but

it can make it useless by rotating what every other device holds.



The distinction to preserve: sync cannot revoke a credential. The

sync channel can deliver a replacement. Revocation — making the old

credential stop working — happens at the provider, using the

provider's own revocation mechanism. For Tier 1 that mechanism is

available to GORKA through the master credential. For Tier 2 it is

available to the admin through the client's own provider account.

The security boundary against a departed device is the provider-side

invalidation, not the sync channel.



The funded phase adds D2 (key rotation), D3 (cryptographic

offboarding), and D4 (lost-device recovery flow). Those capabilities

change the cryptographic model. Section 6 does not.



6.11 The distribution events



The distribution uses new event types in the sync protocol. The

current MVP event set is four types (DEBTOR\_CREATED, ENTITY\_UPDATED,

ACTION\_CREATED, COMMUNICATION\_LOGGED). None of them fits connector

enablement.



Section 6 therefore requires an amendment to SYNC-ARCHITECTURE.md

Section 9.2 adding three new event types:



&#x20; CONNECTOR\_ENABLED              Code 0x0005, provisional.

&#x20; CONNECTOR\_DISABLED             Code 0x0006, provisional.

&#x20; CONNECTOR\_CREDENTIAL\_REPLACED  Code 0x0007, provisional.



The codes are provisional until the amendment is applied and the

codes are frozen in SYNC-ARCHITECTURE.md. The amendment is named in

Section 14 (Open Items).



At the logical level, each event carries:



&#x20; CONNECTOR\_ENABLED:

&#x20;   connectorCode

&#x20;   tier                     TIER1 or TIER2

&#x20;   credentialValue          opaque bytes

&#x20;   configuration            provider-specific

&#x20;   enabledAt                originating device's wall clock



&#x20; CONNECTOR\_DISABLED:

&#x20;   connectorCode

&#x20;   disabledAt               originating device's wall clock



&#x20; CONNECTOR\_CREDENTIAL\_REPLACED:

&#x20;   connectorCode

&#x20;   credentialValue          opaque bytes, new value

&#x20;   configuration            provider-specific, new value

&#x20;   replacedAt               originating device's wall clock



The wire format is defined in the corresponding amendment. The

events follow the same rules as the existing MVP event types:

event\_id, device\_id, sequence, logical\_clock, event\_type,

entity\_type, entity\_id, payload, created\_at. The entity\_type is

CONNECTOR (a new entity type code, tentative 0x06). The entity\_id is

the connectorCode.



The events are encrypted with the session key exactly as the

existing events are. They use the same handshake, the same session,

the same delivery bookkeeping, the same duplicate detection. There

is nothing new in the transport. There are only new event types and

new payloads.



The credential value is carried in the payload as a byte blob. It is

not parsed by the sync engine. It is not validated by the sync

engine. It is not transformed. It is written to the local record as

received.



The amendment to SYNC-ARCHITECTURE.md must cover, at minimum:



&#x20; - Three event type codes: CONNECTOR\_ENABLED, CONNECTOR\_DISABLED,

&#x20;   CONNECTOR\_CREDENTIAL\_REPLACED.

&#x20; - One entity type code: CONNECTOR.

&#x20; - The payload schema for each event type.

&#x20; - The wire encoding of the credential blob, the configuration

&#x20;   blob, and the metadata fields.

&#x20; - NULL and empty semantics, where applicable.

&#x20; - Receiving, validation, and reconciliation behavior.

&#x20; - The exact byte-level form the TLV field defines for each new

&#x20;   field.



The amendment is additive. It does not change the transport, the

handshake, the session model, or the delivery bookkeeping. It adds

new event types and a new entity type to an existing protocol.



The amendment is a hard gate between this document and the

implementation of credential distribution. Section 14 records it as

the top open item.



6.12 The credential is never displayed back to the user



This subsection restates a rule that appears in several places, so

that it is impossible to miss.



The credential is never displayed to the agent, in any UI, in any

state. Not in the Communication Tools page. Not in the send modal.

Not in a debug console. Not in an error message. Not in a log.



The credential is never displayed to the admin after the moment it

is created. For Tier 1, that moment is when the enable response body

carries it: the admin's device consumes the value, writes it to the

local record, and does not display it. For Tier 2, that moment is

when the admin types it into the local form: the value is not

echoed back to the screen after submission.



There is no "view credential" button. There is no "reveal" toggle.

There is no clipboard action that copies the credential. There is no

export path that includes the credential.



If a future phase needs to display a credential-derived identifier

to the admin (for example, "the credential ending in 4C8A"), the

display uses only the last four characters of the value and is

treated as a display convenience, not as a state the admin can act

on. The MVP does not do this.



6.13 What Section 6 does not do



&#x20; It does not define the enable flow that produces the credential.

&#x20;   Section 4 does.

&#x20; It does not define the send flow that consumes the credential.

&#x20;   Section 8 does.

&#x20; It does not define the provider adapter interface. Section 7 does.

&#x20; It does not define the new event types' wire format in full. The

&#x20;   amendment to SYNC-ARCHITECTURE.md does. Section 6 defines only

&#x20;   the logical payload.

&#x20; It does not add the local table. An amendment to LOCAL-TABLES.md

&#x20;   does. Section 6 defines only the logical record.

&#x20; It does not amend SYNC-ARCHITECTURE.md. It names the amendment

&#x20;   needed. Section 14 records it as an open item.

&#x20; It does not modify the organization key model. The credential is

&#x20;   distributed inside the same encrypted channel that the

&#x20;   organization key secures. The credential is not encrypted with

&#x20;   a separate key. The organization key is sufficient; a second

&#x20;   key would only add another secret to lose.



========================================================================

END OF SECTION 6

========================================================================



========================================================================

7\. PROVIDER ADAPTERS IN THE SHARED CRATE

========================================================================



This section defines the code layer that turns an abstract "send a

message" request into a provider-specific API call. It is the

mechanism-side half of the connector model: what the shared Rust

crate contains, what its interface looks like, how providers plug in,

and where the boundary between the connector layer and the sync

layer sits.



It does not write code. It defines the shape.



7.1 Placement in the repository



Adapters live in gorka-shared, the shared Rust crate created in

Phase 9.5. Both Tauri binaries depend on gorka-shared. Both compile

it. A new module is added:



&#x20; shared/src/connectors/

&#x20;   mod.rs                    The trait, the registry, and shared

&#x20;                             types.

&#x20;   twilio\_sms.rs             The Twilio SMS adapter.

&#x20;   twilio\_voice.rs           The Twilio Voice adapter.

&#x20;   resend\_email.rs           The Resend Email adapter.

&#x20;   mocean\_sms.rs             The Mocean SMS adapter.

&#x20;   gemini\_ai.rs              The Gemini AI adapter. See Section 12

&#x20;                             for its special treatment.



The Client binary registers the management commands (test connection,

balance query) that the Client's Connectors page needs. The Agent

binary registers the send command the Agent App needs. Both commands

delegate to the same gorka-shared module.



This is the same pattern used everywhere else in gorka-shared. The

module holds the logic. Each binary's main.rs holds the thin Tauri

wrapper and the registration list.



7.2 The adapter trait



Every adapter implements one trait. The trait is provider-agnostic.

It uses only the vocabulary of a "message" and a "result." It does

not name any provider.



At the logical level:



&#x20; pub trait ConnectorAdapter {

&#x20;     /// Send one message. Never retries internally. The caller

&#x20;     /// decides retry policy.

&#x20;     fn send(\&self, request: \&SendRequest)

&#x20;         -> Result<SendResult, ConnectorError>;



&#x20;     /// Verify that the credential works. Performs the provider's

&#x20;     /// safest non-message credential validation available for this

&#x20;     /// connector — a balance read, an account metadata read, or

&#x20;     /// an equivalent read-only operation the provider exposes.

&#x20;     /// Never sends a real debtor message merely to test a

&#x20;     /// credential.

&#x20;     fn test\_connection(\&self) -> Result<(), ConnectorError>;



&#x20;     /// The connector code this adapter handles.

&#x20;     fn code(\&self) -> \&'static str;

&#x20; }



The trait takes \&self. The adapter does not own the credential long

term. The credential is supplied at construction time; the adapter

holds it for the duration of one operation and does not persist it.



A future funded-phase method (query balance, provision subaccount)

would be added to the trait or to a separate provisioning trait, not

folded into the send trait. The MVP does not need it.



The trait is defined at the logical level as synchronous. In the

implementation, the network calls inside send() and test\_connection()

are asynchronous operations and must not block the Tauri runtime

thread. The exact mechanism — tokio, an async trait, an executor on

a worker thread — is an implementation choice that must reconcile

with the async model already present in gorka-shared for the HTTP

half of auth. This subsection names the requirement; it does not

choose the mechanism.



7.3 The shared types



SendRequest, SendResult, and ConnectorError are defined in the same

module. They are provider-neutral.



&#x20; SendRequest {

&#x20;     /// The recipient address. For SMS, a phone number. For

&#x20;     /// email, an email address. Provider-specific validation

&#x20;     /// belongs in the adapter, not here.

&#x20;     to: String,



&#x20;     /// The message body. For email, the HTML or plain-text

&#x20;     /// body. For SMS, the text. For a future voice call, the

&#x20;     /// script or the call parameters.

&#x20;     body: String,



&#x20;     /// The subject line. Only used by channels that have one.

&#x20;     /// Optional.

&#x20;     subject: Option<String>,



&#x20;     /// The sender identity. From-number, from-address, sender

&#x20;     /// id. Copied from the connector's local configuration.

&#x20;     from: String,

&#x20; }



&#x20; SendResult {

&#x20;     /// Whether the provider accepted the send.

&#x20;     success: bool,



&#x20;     /// The provider's own identifier for this message. Used for

&#x20;     /// delivery-status correlation if the provider supports it.

&#x20;     provider\_message\_id: Option<String>,



&#x20;     /// The provider's status string, as the provider named it.

&#x20;     /// Not normalized.

&#x20;     provider\_status: Option<String>,



&#x20;     /// The provider's own response payload, unmodified. Kept for

&#x20;     /// local debugging and compliance. Never sent to GORKA's

&#x20;     /// cloud. Never returned through the sync channel.

&#x20;     provider\_response: Option<serde\_json::Value>,

&#x20; }



&#x20; ConnectorError {

&#x20;     /// A closed set of error categories that the caller can

&#x20;     /// reason about. Not a free string.

&#x20;     kind: ConnectorErrorKind,



&#x20;     /// A short human-readable message. Never includes the

&#x20;     /// credential value. Never includes the debtor's full

&#x20;     /// message content.

&#x20;     message: String,



&#x20;     /// The provider's raw error response, if the provider sent

&#x20;     /// one and it is safe to keep. Never includes the credential

&#x20;     /// value.

&#x20;     provider\_response: Option<serde\_json::Value>,

&#x20; }



&#x20; ConnectorErrorKind {

&#x20;     /// The credential was rejected by the provider. The admin

&#x20;     /// needs to re-enable or replace.

&#x20;     AuthenticationFailed,



&#x20;     /// The recipient address was rejected by the provider.

&#x20;     /// Malformed phone number, undeliverable email address.

&#x20;     InvalidRecipient,



&#x20;     /// The provider rate-limited the request.

&#x20;     RateLimited,



&#x20;     /// The provider returned a transient error. A retry may

&#x20;     /// succeed.

&#x20;     ProviderTransientError,



&#x20;     /// The provider returned a permanent error.

&#x20;     ProviderPermanentError,



&#x20;     /// The network between the device and the provider failed.

&#x20;     /// The message may or may not have been accepted.

&#x20;     TransportError,



&#x20;     /// A local error before the request was made: the connector

&#x20;     /// is not configured, the configuration is incomplete, the

&#x20;     /// credential is missing from the local record.

&#x20;     LocalConfigurationError,



&#x20;     /// The response from the provider could not be parsed.

&#x20;     /// The message may or may not have been accepted.

&#x20;     ResponseParseError,

&#x20; }



The kinds are the adapter's contract with its caller. The caller —

Section 8's send flow — switches on them. It does not parse error

strings. New kinds are added by amending this enumeration, not by

adding a string.



Implementation checklist for the types:



&#x20; - provider\_response is treated as sensitive. It may contain

&#x20;   recipient information, provider account metadata, or provider

&#x20;   error detail that names the account. It never enters audit\_log,

&#x20;   sync\_events, telemetry, tracing, generic error serialization,

&#x20;   or UI notifications. It is kept in the local communications

&#x20;   row's data field only, for local debugging.

&#x20; - SendRequest.body is message content. It is plaintext inside the

&#x20;   process. It is never returned through the sync channel except

&#x20;   as part of the standard COMMUNICATION\_LOGGED event defined in

&#x20;   Section 9. It is never included in an error message.

&#x20; - ConnectorError.message never includes the credential value.

&#x20;   Never includes the full message body. It includes the

&#x20;   provider's own error code if one exists, but not the credential

&#x20;   or the body.



7.4 The registration pattern



Adapters are registered by name. A registry maps the catalog's code

to the adapter that handles it.



&#x20; pub struct ConnectorRegistry {

&#x20;     factories: HashMap<\&'static str, AdapterFactory>,

&#x20; }



&#x20; pub type AdapterFactory =

&#x20;     fn(ConnectorCredential) -> Box<dyn ConnectorAdapter>;



&#x20; impl ConnectorRegistry {

&#x20;     pub fn new() -> Self { ... }



&#x20;     /// Called once at application startup.

&#x20;     pub fn register(\&mut self, code: \&'static str,

&#x20;                     factory: AdapterFactory) { ... }



&#x20;     pub fn factory(\&self, code: \&str)

&#x20;         -> Option<\&AdapterFactory>

&#x20;     { ... }

&#x20; }



Registration happens once, at startup, in each binary's main.rs.

The registry is not a global. It is passed to the send flow as a

parameter, or stored in the binary's AppState. The MVP uses

AppState because the send command already has access to it.



The registry holds factories, not adapters. Each call constructs the

adapter with the credential it needs for that call:



&#x20; 1. The send flow reads the local record.

&#x20; 2. It extracts credentialValue and configuration.

&#x20; 3. It looks up the factory in the registry.

&#x20; 4. It constructs the adapter with the credential.

&#x20; 5. It calls send().

&#x20; 6. It drops the adapter.



The credential lives only for the duration of the call. This is the

correct MVP shape. If a later phase needs to cache constructed

adapters, it does so by amending this subsection.



Invariant: the registry contains no credential material and retains

no constructed adapter containing credential material. It maps

codes to factories. Factories are pure functions. After a send or a

test returns, the adapter is dropped and the credential bytes it

held are no longer reachable from any long-lived structure in the

process. This is testable: a unit test constructs the registry,

performs a send, and inspects the registry's contents to confirm it

holds factories only.



7.5 What the adapter does not do



The adapter is intentionally narrow. It does not:



&#x20; - Decide retry policy. It performs one attempt. The caller decides

&#x20;   whether to try again.

&#x20; - Read from or write to the local database. It receives its

&#x20;   inputs and returns its outputs. It has no database handle.

&#x20; - Emit sync events. It does not know the sync protocol exists.

&#x20; - Know about debtors, debts, actions, or communications. Its

&#x20;   vocabulary is SendRequest and SendResult. It does not know what

&#x20;   a debtor is.

&#x20; - Log the credential. Ever. Not on error, not on success, not on

&#x20;   connection failure.

&#x20; - Validate the debtor's identity. It validates the recipient

&#x20;   address format only, in the way the provider's API requires.



The adapter is the smallest possible translation layer between the

send flow's vocabulary and the provider's API.



7.6 Where the credential is decrypted



The credential is stored in the local record as opaque bytes

(Section 6.9). It is encrypted at rest only by SQLCipher, not by a

second layer. So the adapter receives plaintext bytes.



The path is:



&#x20; 1. The send flow reads the local record.

&#x20; 2. It extracts the credentialValue and the configuration.

&#x20; 3. It passes them to the adapter's factory.

&#x20; 4. The factory constructs the adapter.

&#x20; 5. The adapter reads the fields it needs from the credential and

&#x20;    calls the provider.



At no point in this path does the credential enter a log, an error

message, a network call to GORKA's cloud, or a UI element. The

adapter is the end of the line: after it, the credential is spent.



7.7 The transaction boundary with the sync layer



The sync layer and the connector layer have one interaction: they

share the local record. The sync layer writes to it (when a

CONNECTOR\_ENABLED or CONNECTOR\_CREDENTIAL\_REPLACED event is

applied). The connector layer reads from it (when a send or a test

is performed). They do not share memory. They do not share state.

They interact only through the database row.



This is deliberate. The sync layer does not know what a Twilio auth

token looks like. The connector layer does not know that a sync

channel exists. The two can be developed, tested, and replaced

independently.



The opacity rule from Section 6.11 — the sync engine does not

parse, validate, or transform the credential — is what makes this

separation possible. If the sync engine interpreted the credential,

the two layers would be coupled.



7.8 The tests each adapter provides



Each adapter provides its own tests. The tests are in the shared

crate's test folder.



At minimum, each adapter's tests cover:



&#x20; - Constructing the adapter with a valid credential.

&#x20; - Constructing the adapter with a credential that is missing a

&#x20;   required field.

&#x20; - Formatting a SendRequest into the provider's API shape.

&#x20; - Parsing a successful provider response into a SendResult.

&#x20; - Parsing a failed provider response into a ConnectorError with

&#x20;   the correct kind.

&#x20; - The credential-leak regression test. This test is mandatory

&#x20;   for every adapter. It asserts that the credential value never

&#x20;   appears in:

&#x20;     - a successful SendResult;

&#x20;     - an authentication error;

&#x20;     - a malformed-request error;

&#x20;     - a transport error;

&#x20;     - a provider error response;

&#x20;     - a parsing error;

&#x20;     - the Debug or Display output of any type the adapter defines;

&#x20;     - the Tauri-facing error serialization that the command

&#x20;       returns to the frontend.

&#x20;   The test is written first, before any other adapter test,

&#x20;   because it is easy to break silently and hard to notice later.



The adapter tests do not call the real provider. They use the

provider's documented response shapes as fixtures. A live smoke

test against the real provider is a manual test, run once when the

adapter is created and once when the provider's API changes. It is

not part of the automated suite.



7.9 What the adapter does not solve



The adapter is a code shape. It does not solve three problems that

belong elsewhere:



&#x20; 1. Retry and idempotency. The adapter performs one attempt. The

&#x20;    send flow decides whether to try again. Idempotency keys, if

&#x20;    the provider supports them, are added by the send flow, not

&#x20;    by the adapter. Section 8 covers this.



&#x20; 2. Compliance enforcement. The adapter does not check quiet

&#x20;    hours, contact limits, or opt-out status. Those checks happen

&#x20;    in the send flow, before the adapter is called. Section 10

&#x20;    covers this.



&#x20; 3. Message logging. The adapter does not write to the

&#x20;    communications table. The send flow does, after the adapter

&#x20;    returns. Section 9 covers this.



The adapter's narrow scope is what makes it testable. If it grew to

include any of the above, it would be harder to reason about, and

the boundary between "what GORKA's adapter does" and "what GORKA's

send flow does" would blur.



7.10 The AI adapter is a special case



The gemini\_ai.rs adapter implements the same trait, but its send

method does not send a message to a debtor. It sends a prompt to

Gemini. Its SendRequest's to field is not used. Its body field

carries the prompt after the AI boundary layer has redacted it.



The special treatment is defined in Section 12. Section 7 states

only that the AI connector uses the same trait and the same

registration pattern, so that the code is uniform. Whether the

prompt's content is safe to send is the boundary layer's job, not

the adapter's.



7.11 What Section 7 does not do



&#x20; It does not define the send flow that calls the adapter.

&#x20;   Section 8 does.

&#x20; It does not define the credential's local storage. Section 6

&#x20;   does.

&#x20; It does not define the AI boundary layer. Section 12 does.

&#x20; It does not define how a connection test is exposed in the

&#x20;   Client UI. Section 4.10 references it; the actual command is a

&#x20;   thin Tauri wrapper registered in the Client binary.

&#x20; It does not write code. It defines the code shape.



========================================================================

END OF SECTION 7

========================================================================



========================================================================

8\. SINGLE-RECIPIENT SEND FLOW

========================================================================



This section defines what happens on the agent's device when the

agent picks a connector, types a message, and presses Send. It is

the operational heart of the connector model. Every later section

refers back to it: Section 9 writes the communication row after it

succeeds; Section 10 gates it before it starts; Section 11 reports

aggregate usage from what it produces.



It also settles the "sender of record" question carried forward

from Section 5's review.



8.1 Purpose and placement



The agent is on a debtor's profile. The debtor's contact field for a

channel is present. The admin has enabled a connector that serves

that channel. A button has rendered (Section 5). The agent clicks

it.



The send flow is what runs from that click to the durable local

record of the outbound communication.



8.2 The five phases



The flow has five phases, in this order:



&#x20; 1. Compose. The agent fills in the modal.

&#x20; 2. Preflight. Configuration and compliance checks run. Section

&#x20;    10 defines the compliance rules; this section defines when

&#x20;    they run.

&#x20; 3. Send. The Send phase performs one initial adapter attempt. It

&#x20;    does not perform any automatic retry. The adapter itself never

&#x20;    retries (Section 7.2). Section 8.7 defines why the MVP does

&#x20;    not retry at this phase, even for errors that might at first

&#x20;    look retriable.

&#x20; 4. Persist. The communication row is written locally, and the

&#x20;    COMMUNICATION\_LOGGED event is originated.

&#x20; 5. Report. The modal closes with a result the agent can see.



The phases are sequential. A failure in any phase stops the flow

at that phase; later phases do not run. A partial result is never

written: either the communication row is written with a definite

outcome, or nothing is written.



The single exception is a TransportError or a ProviderTransientError

in phase 3, which is covered in Section 8.7. It is the case where

"the provider may or may not have accepted the message" is the only

honest statement.



8.3 Phase 1 — Compose



The modal's layout is defined in AGENT-APP-SPEC.md Section 8.3.

This section adds three rules the modal must respect.



Rule 1 — the destination is pre-filled but editable.

&#x20; Pre-filled from the debtor's contact field for the connector's

&#x20; channel. The agent may edit it. The edited value is what the

&#x20; adapter receives. This is necessary: an agent may know the

&#x20; debtor's new number before the debtor's record does.



Rule 2 — a template may fill the body.

&#x20; The template picker reads from local\_templates (LOCAL-TABLES.md

&#x20; Category C.3). A template renders against the debtor's local

&#x20; data. The rendered body is placed in the modal's body field. The

&#x20; agent may edit it after rendering. The rendered value is what

&#x20; the adapter receives.



Rule 3 — a single preview is shown.

&#x20; The modal displays the exact text that will be sent. There is no

&#x20; hidden transformation between what the agent sees and what the

&#x20; adapter receives. This is a hard rule: the send flow never

&#x20; modifies the body after the preview. If a transformation is

&#x20; needed, it happens before the preview.



8.4 Phase 2 — Preflight



Preflight runs before the adapter is called. It is a sequence of

deterministic checks against local state. It is not a network call.



The checks, in order:



&#x20; 1. Configuration check. The connector's local record exists and

&#x20;    has a credential value and a from-address. If either is

&#x20;    missing, the flow stops with a LocalConfigurationError, and

&#x20;    the modal shows: "This connector is not fully configured.

&#x20;    Ask your administrator to re-enable it."

&#x20; 2. Compliance check. The compliance enforcement layer defined in

&#x20;    AGENT-APP-SPEC.md Section 10 runs. It reads the local rules

&#x20;    (quiet hours, contact limits, opt-out status, disclosure

&#x20;    text) and the local debtor state. If it blocks, the flow

&#x20;    stops with a ComplianceBlocked error, and the modal shows

&#x20;    the specific reason the layer returned. See Section 10 for

&#x20;    the rules themselves.



If preflight passes, the flow moves to phase 3.



Preflight is intentionally cheap. It is a set of local reads. The

agent sees the Send button's loading state through the whole of

phases 2 and 3.



Preflight produces two categories of failure, and neither is a

ConnectorError. They are send-flow errors, produced by the flow

itself before any adapter is constructed. The send flow's result

type therefore has three variants, not one:



&#x20; SendOutcome::Sent(SendResult)              // adapter succeeded

&#x20; SendOutcome::Failed(SendFlowError)         // preflight or persist

&#x20; SendOutcome::TransportUncertain            // see Section 8.7



&#x20; SendFlowError {

&#x20;     kind: SendFlowErrorKind,

&#x20;     message: String,

&#x20; }



&#x20; SendFlowErrorKind {

&#x20;     ConfigurationMissing,     // credential or from-address absent

&#x20;     ComplianceBlocked {       // Section 10's layer returned a block

&#x20;         rule: ComplianceRule,

&#x20;         reason: String,

&#x20;     },

&#x20;     PersistFailed,            // phase 4's transaction failed

&#x20; }



ConnectorError, defined in Section 7.3, is the adapter's error. It

is not the send flow's error. The two are distinct types. The

adapter is not aware that compliance exists (Section 7.5 says so).

The compliance layer is not aware that adapters exist. The send

flow is the only place where the two meet.



8.5 Phase 3 — Send



Phase 3 is the adapter call. It is one call, not a retry loop.



The flow:



&#x20; 1. Read the connector's local record.

&#x20; 2. Extract credentialValue and configuration.

&#x20; 3. Look up the adapter's factory in the registry (Section 7.4).

&#x20; 4. Construct the adapter with the credential.

&#x20; 5. Build a SendRequest from the modal's state.

&#x20; 6. Call adapter.send(request).

&#x20; 7. Drop the adapter.

&#x20; 8. The result is a SendResult or a ConnectorError.



The adapter is constructed fresh for this call and dropped at its

end. The credential is not retained by the registry, by the send

flow, or by any long-lived structure. Section 7.4's invariant is

what makes this possible.



The send flow does not retry inside phase 3. Retry is defined in

Section 8.7 and lives outside the adapter.



Invariant: the SendRequest built in step 5 does not contain the

credential. The credential is passed to the adapter through

construction (step 4). The request carries only message data and

configuration-derived values (to, body, subject, from). The adapter

combines the two internally. This keeps accidental serialization of

the credential into logs, error reports, or debug output much

harder: the credential is never part of a type that has a Debug

implementation, a Serialize implementation, or a Display

implementation that a careless `?` or `format!` could reach.



8.6 Phase 4 — Persist



Phase 4 runs after the adapter returns. Its job is to write the

durable local record of what happened.



Three writes, in one transaction:



&#x20; 1. A new row in the local communications table. The schema is

&#x20;    LOCAL-TABLES.md Category A.4, unchanged. Fields:

&#x20;      id                  new UUIDv4

&#x20;      debtor\_id           the debtor's local id

&#x20;      type                CALL | EMAIL | SMS | NOTE, derived from

&#x20;                          the connector's channel

&#x20;      direction           OUTBOUND

&#x20;      content             the exact body that was sent, after any

&#x20;                          agent edit and after the preview

&#x20;      duration            null (see Section 8.6.1)

&#x20;      created\_by          the agent's user\_id, from the local

&#x20;                          session (SYNC-ARCHITECTURE.md Section

&#x20;                          25.13.9)

&#x20;      created\_at          the device's local wall clock

&#x20;      data                a JSON object (see Section 8.6.2)



&#x20; 2. A new row in the local sync\_events table: a

&#x20;    COMMUNICATION\_LOGGED event carrying the fields above. This is

&#x20;    the standard MVP event from SYNC-ARCHITECTURE.md Section 9.2.

&#x20;    No new event type is needed for the outbound message itself.



&#x20; 3. A new row in the local audit\_log table (Category A.6). This is

&#x20;    the compliance trail, not the sync trail.



The three writes commit together. If any fails, none commits, and

the modal shows "Could not save the record of this message. The

message may have been sent. Check the debtor's history." That last

sentence is honest: the provider may have accepted the send even

though the local write failed.



8.6.1 Duration for voice calls



The MVP's send flow does not implement voice calls. When it does

(funded phase), duration is populated from the provider's own call

report, and the send flow does not write the communications row

until the call ends, not when it starts. The MVP records this

requirement so a future implementation does not write a row at the

start of a call and then try to update it later, which would break

the append-only model the communications table is part of.



8.6.2 The communications.data JSON



The `data` JSON on the communications row carries the send-flow's

provider-specific facts that do not fit the standard columns:



&#x20; {

&#x20;   "connector\_code": "twilio-sms",

&#x20;   "provider": "Twilio",

&#x20;   "provider\_message\_id": "SM...",

&#x20;   "provider\_status": "queued",

&#x20;   "provider\_response": { ... },   // see Section 8.6.3

&#x20;   "send\_result": "SENT",          // or "TRANSPORT\_UNCERTAIN"

&#x20;   "idempotency\_key": "..."        // see Section 8.7

&#x20; }



This is local data. It is inside the local SQLCipher database. It

is not part of the COMMUNICATION\_LOGGED event's payload. It stays

on the originating device. Section 9.4 states this as a rule.



8.6.3 What may not go in communications.data



The following must never appear in the communications.data JSON:



&#x20; - The credential value.

&#x20; - Any part of the credential.

&#x20; - The full provider\_response if it contains the credential. It

&#x20;   does not; providers do not echo credentials. But if a provider

&#x20;   ever did, the adapter strips it before returning.

&#x20; - The recipient's pre-edit value, if the agent edited the

&#x20;   destination. Only the actual destination that was used is

&#x20;   recorded.

&#x20; - Any value the adapter's error type is documented not to carry

&#x20;   (Section 7.3).



The rule for provider\_response is: it is included if and only if

it is small, contains no credential material, and is useful for

local debugging. When in doubt, the adapter's send result carries

only provider\_message\_id and provider\_status, and the response is

dropped. This is a conservative default.



8.7 Retry policy



The MVP performs zero automatic retries. No error kind is retried

by the send flow. Every send attempt is one adapter call, one

outcome, one decision.



This is a deliberate choice, made after reviewing the error

taxonomy in Section 7.3.



The reasoning:



&#x20; - A definite rejection (AuthenticationFailed, InvalidRecipient,

&#x20;   ProviderPermanentError) is final for this send. No retry is

&#x20;   meaningful.

&#x20; - RateLimited is final for this send in the MVP. The provider

&#x20;   refused the request before accepting it. A retry might succeed

&#x20;   after a delay, but the MVP does not implement scheduled

&#x20;   retries. The modal surfaces the reason and the agent decides.

&#x20; - A transport failure (TransportError) may mean the provider

&#x20;   accepted the message and the response was lost on the way back.

&#x20;   Retrying risks a duplicate send.

&#x20; - A provider transient error (ProviderTransientError) carries the

&#x20;   same ambiguity. Some providers report a transient error after

&#x20;   having accepted and queued the message. Retrying risks a

&#x20;   duplicate send in exactly the same way as a transport failure.



The MVP cannot distinguish, from the error alone, whether a

transport failure or a provider transient error occurred before or

after the provider accepted the message. The honest position is

that both are uncertain.



Therefore the rule is: no automatic retry for any error kind. The

send flow produces one of three outcomes for phase 3 (see Section

8.4):



&#x20; - SendOutcome::Sent(result) — the adapter returned Ok. The row is

&#x20;   written with send\_result = "SENT" (or the provider's own status

&#x20;   if it returned one, in provider\_status).

&#x20; - SendOutcome::Failed(error) — the adapter returned a definite

&#x20;   rejection. The row is not written. The failure is recorded in

&#x20;   audit\_log. See Section 8.8.

&#x20; - SendOutcome::TransportUncertain — the adapter returned a

&#x20;   TransportError or a ProviderTransientError. The row is written

&#x20;   with send\_result = "TRANSPORT\_UNCERTAIN". See Section 8.8.



The modal's message for TransportUncertain:



&#x20; "The provider did not confirm delivery. The message may or may

&#x20; not have been sent. Check the provider's dashboard before

&#x20; resending."



The agent decides whether to send again. A resend is a new

communication row and a new COMMUNICATION\_LOGGED event with a new

id. The two records coexist. The system does not guess.



A note on provider-specific classification. It is possible, in

principle, to inspect each provider's error documentation and

classify specific error codes as "definitely pre-acceptance" versus

"possibly post-acceptance". The MVP does not do this. A future

phase that adds it does so by amending this subsection, not by

changing the adapter's error taxonomy (Section 7.3).



8.8 Phase 5 — Report



After phase 4 commits, the modal closes and the debtor's

Communications card refreshes with the new row. If the outcome was

successful, the row appears with a normal direction and type badge.

If the outcome was TRANSPORT\_UNCERTAIN, the row appears with the

same badges plus a small warning indicator. If the outcome was a

definite rejection, no row is written; the modal shows the error

and the agent decides what to do next.



A definite rejection is not recorded as a communication row. The

reason: the communications table is the log of actual communications

with the debtor, and a rejected send is not one. The rejection is

recorded in audit\_log, which is the compliance trail, not the

communications log.



8.9 The sender of record



Section 5's review flagged the phrase "the agent is the sender of

record" as a claim to verify in Section 8. This subsection settles

it.



What "sender of record" means in the GORKA model:



&#x20; - The communications row carries created\_by = the agent's

&#x20;   user\_id. The user\_id is the same value on every device in the

&#x20;   organization. It identifies the human whose business action

&#x20;   the event records.

&#x20; - The communications row's data JSON carries connector\_code and

&#x20;   provider, so the audit trail knows which connector performed

&#x20;   the send and which provider received it.

&#x20; - The sync event for the communication carries device\_id = the

&#x20;   originating device instance. The device\_id identifies the

&#x20;   synchronization origin (SYNC-ARCHITECTURE.md Section 25.6.6).

&#x20;   It does not identify the human.

&#x20; - The event's created\_by field carries the user\_id, per

&#x20;   SYNC-ARCHITECTURE.md Section 25.13.9.



"Sender of record" therefore means: the human whose user\_id is on

the row. It does not mean the device, and it does not mean GORKA.

The agent initiated the send, the agent's user\_id is the attribution

on the row, and the row is the authoritative local record of the

send.



The admin's role is separate. The admin enabled the connector. The

admin does not appear on the communications row unless the admin

themselves sends a message (which, per Section 4.1, they do not do

from the Client Dashboard in the MVP). If an admin wants to send

as a collection worker, they install the Agent App and their send

appears with their own user\_id, exactly the same as any other

agent's.



The provider is a third party. It is named on the row for audit

purposes, but it is not the sender of record in any business sense.

GORKA is not on the path. Neither GORKA nor the provider holds the

attribution.



8.10 Idempotency



The MVP does not implement idempotency keys on the provider side,

and it does not perform any automatic retry that would need them.

The reasoning is in Section 8.7.



The MVP's duplicate prevention is:



&#x20; - The Send button in the modal is disabled during phases 2 and

&#x20;   3, and re-enabled after phase 4 commits. This prevents a

&#x20;   double-click from producing two submissions.

&#x20; - No automatic retry is performed for any error kind. The agent

&#x20;   decides whether to send again.

&#x20; - If the agent chooses to send again, the send is a new

&#x20;   communication row and a new COMMUNICATION\_LOGGED event. The two

&#x20;   rows coexist in the debtor's history. This is not deduplication;

&#x20;   it is honest accounting.



The communications.data JSON carries an idempotency\_key field

(Section 8.6.2) for future use. The MVP computes it from

(organization\_id, debtor\_id, message\_hash) and stores it locally.

The MVP does not send it to the provider. The field exists so that

a funded-phase implementation that adds provider-side idempotency

or local uniqueness constraints has the value already present on

each row.



The idempotency\_key field, in the MVP, does not enforce anything.

It is metadata. A future section that gives it enforcement must

state the enforcement mechanism explicitly, in that section.



8.11 What Section 8 does not do



&#x20; It does not define the modal's layout. AGENT-APP-SPEC.md Section

&#x20;   8.3 does.

&#x20; It does not define the compliance rules. Section 10 does.

&#x20; It does not define the communication row's sync semantics.

&#x20;   Section 9 does.

&#x20; It does not define the adapter's interface. Section 7 does.

&#x20; It does not define the bulk-send flow. AGENT-APP-SPEC.md Section

&#x20;   8.4 does, and it is a funded-phase item.

&#x20; It does not define what happens to a TransportError's ledger

&#x20;   reconciliation on the provider side. That is the agent's

&#x20;   operational responsibility, and the modal's message tells the

&#x20;   agent what to check.

&#x20; It does not add a new sync event type for outbound messages. The

&#x20;   existing COMMUNICATION\_LOGGED event carries the record.



========================================================================

END OF SECTION 8

========================================================================



========================================================================

9\. MESSAGE LOGGING AND SYNC

========================================================================



This section defines how the local record of an outbound communication

becomes part of the organization's synchronized data. It is where the

Option A replication decision from Section 1.5 is applied to a single

message: the local row, the sync event that carries it, and the

relationship between those two and the provider transmission.



It is not about the mechanics of writing the row. Section 8 defines

that. Section 9 begins after the row is committed locally, and

describes how it travels.



9.1 Purpose and placement



When the send flow in Section 8 completes, three durable facts exist

locally:



&#x20; 1. A row in the communications table.

&#x20; 2. A row in the sync\_events table, carrying the COMMUNICATION\_LOGGED

&#x20;    event for that communication.

&#x20; 3. A row in the audit\_log table, recording the attempt and its

&#x20;    outcome for compliance.



Section 9's job is to state what each of those is, what each is for,

and what happens to the sync event.



The section does not add new event types. It uses the existing

COMMUNICATION\_LOGGED event, which is one of the four MVP types

(SYNC-ARCHITECTURE.md Section 9.2). No new event type is needed for

the outbound message. The event already has the fields the row

needs.



9.2 The three flows for one message



Section 2.4 named three data flows that this document must never

collapse. Applied to a single outbound message, they are:



&#x20; Flow 1 — Local GORKA replica

&#x20;   The communications row and the sync\_events row exist in this

&#x20;   device's SQLCipher database. The message content is in the

&#x20;   communications row's content column. Both rows are durable.

&#x20;   Both are protected at rest by SQLCipher.



&#x20; Flow 2 — Sync between GORKA devices

&#x20;   The COMMUNICATION\_LOGGED event in sync\_events will be delivered

&#x20;   to the organization's other authorized devices through the

&#x20;   sync channel defined in SYNC-ARCHITECTURE.md. The event carries

&#x20;   the message content in its payload. The event is encrypted

&#x20;   with the session key, end to end. GORKA's Control Plane may

&#x20;   route the encrypted event but cannot read it.



&#x20; Flow 3 — Provider transmission

&#x20;   The message content was already transmitted to the provider by

&#x20;   the adapter (Section 8.5). The provider has accepted the

&#x20;   message or has not. That transmission is finished. It is

&#x20;   independent of flows 1 and 2. Nothing in Section 9 re-sends

&#x20;   the message to the provider.



These three flows are distinct. Flow 1 is the local copy on the

sending device. Flow 2 is the encrypted propagation of that copy to

the other devices. Flow 3 is the one-time provider call, already

completed.



Section 9 is about Flow 2.



9.3 What travels in the COMMUNICATION\_LOGGED event



The COMMUNICATION\_LOGGED event carries the same fields that the

existing MVP event carries for any communication (SYNC-ARCHITECTURE.md

Section 25.11). The connector model does not change the event's

payload schema. It uses the schema that already exists.



The event payload contains, per SYNC-ARCHITECTURE.md §25.11.3, the

following fields: debtor\_id, communication\_type, direction, content,

and (optional) duration.



A reconciliation defect exists in the frozen spec: §25.13.9 states

that created\_by is present in COMMUNICATION\_LOGGED, but §25.11.3

does not list it and the V6 test vector does not encode it. Section

9 relies on created\_by being present. The defect is recorded in

Section 14 as an open item. Until the amendment is applied, this

section's reference to created\_by is a reference to the field as

§25.13.9 defines it, not to a field that §25.11.3's TLV table

currently carries.



The event's standard envelope fields (event\_id, device\_id,

sequence, logical\_clock, event\_type, entity\_type, entity\_id,

created\_at) are set by the sync engine as for any event.



The communications.data JSON (Section 8.6.2) is not part of the

event payload. It stays in the local row only. This is the

distinction the friend's review of Section 7.3 emphasized:

provider\_response is a potentially large and sensitive local

object, and it must not travel through the sync channel.



The rule, stated once:



&#x20; The event carries the message and its attribution. It does not

&#x20; carry the provider's response, the credential, the connector's

&#x20; per-organization configuration, or any debugging metadata.



9.4 What stays local-only



Three things stay on the sending device and are not part of the sync

stream:



&#x20; - The communications row's data JSON, including the provider's

&#x20;   response, the provider's message id, and the idempotency key.

&#x20;   These are locally useful and potentially large. They are not

&#x20;   replicated. If a future phase needs to correlate delivery

&#x20;   status across devices, it does so by introducing a new event

&#x20;   (for example, a COMMUNICATION\_DELIVERY\_UPDATED event) that

&#x20;   carries only the status field, not the provider's response.



&#x20; - The audit\_log row for the send. The audit log is a compliance

&#x20;   trail. It is separate from the sync protocol's history

&#x20;   (SYNC-ARCHITECTURE.md Section 9.7). It does not travel.



&#x20; - The credential and the connector's per-organization

&#x20;   configuration. They belong to the local record defined in

&#x20;   Section 6, and that record's own sync is defined in Section 6,

&#x20;   not here.



9.5 The Option A consequence for this section



Section 5.4 stated, for the agent's UI, that under the Option A

decision an agent can see another agent's outbound message in the

debtor's Communications card. Section 9 states the mechanism that

produces that outcome.



When agent A sends a message on device A, the flow is:



&#x20; Device A writes the communications row and the COMMUNICATION\_LOGGED

&#x20; event.

&#x20; Device A delivers the event to the organization's hub (the

&#x20; admin's device), and to any other peer the topology connects it

&#x20; to, through the normal sync delivery model

&#x20; (SYNC-ARCHITECTURE.md Section 18).

&#x20; The hub forwards the event to the organization's other spokes as

&#x20; normal delivery (SYNC-ARCHITECTURE.md Section 18.3).

&#x20; Every device that accepts the event writes its own communications

&#x20; row with the same id and content.



This is the same mechanism the existing COMMUNICATION\_LOGGED event

has always used. Section 9 does not introduce it. It documents the

consequence: every authorized device in the organization ends up

holding every outbound message.



That is Option A. It is the design. The section does not re-open it.



9.6 The write transaction on the receiving device



On any device that accepts the COMMUNICATION\_LOGGED event, the

acceptance transaction is defined by SYNC-ARCHITECTURE.md Section

25.11.5. It is unchanged by the connector model. Summarized:



&#x20; 1. Check the event\_id against sync\_events. If the event\_id is

&#x20;    already present, it is a duplicate and is skipped.

&#x20; 2. Append the event to sync\_events.

&#x20; 3. Advance the logical clock.

&#x20; 4. Insert a communications row with the same id as the event's

&#x20;    entity\_id and the fields from the payload.

&#x20; 5. Write an audit\_log row.

&#x20; 6. Commit.



Steps 1 through 6 are one transaction. This is the standard

acceptance pipeline. The connector model does not change it.



One consequence worth naming: the communications row on the

receiving device does not have a data JSON populated from the

sending device's provider response. That field is empty on the

receiving device. It has never held the provider response because

the response is local-only (Section 9.4). This is expected. The

receiving device knows the message was sent; it does not know the

provider's internal status string. If the sending device later

learns of a delivery status change from the provider, the funded-

phase approach would be a new event type carrying the updated

status, not a mutation of the original communications.data.



9.7 The TransportUncertain case



Section 8.7 introduces a case where the sending device writes a

communications row with send\_result = "TRANSPORT\_UNCERTAIN". The

row exists. The COMMUNICATION\_LOGGED event is originated. Every

device in the organization ends up with the same row.



The receiving device does not need to know that the send was

uncertain. The event's payload does not carry the send\_result

field. The communications row on every device carries the same

content and the same attribution. What differs is that on the

sending device, the local data JSON carries send\_result =

"TRANSPORT\_UNCERTAIN", and on every other device, the local data

JSON is empty.



This is deliberate. Every device receives the same synchronized

communication facts: the content, the debtor, the agent, the

timestamp, the direction, the channel. Those facts are identical on

every replica.



Every device does not receive the same complete local row. The

communications table's data JSON is local provider-interaction

metadata. On the sending device it carries the provider's response

and the send result. On every other device it is empty. The row's

identity is the same; the row's data column is not.



The rule for future sections and future readers: when this document

says "the same communication exists on every device," it means the

synchronized communication facts, not a byte-for-byte identical

row. Provider-interaction metadata is a local fact about the

sending device, not a communication fact.



If the agent re-sends (Section 8.7), a new communication row is

written. Its content may be identical to the first. Its id is

different. Its event\_id is different. Every device ends up with

two rows in the debtor's history, reflecting the two attempts the

agent made. This is the honest record.



9.8 What Section 9 does not do



&#x20; It does not define the local schema of the communications table.

&#x20;   LOCAL-TABLES.md Category A.4 does.

&#x20; It does not define the COMMUNICATION\_LOGGED payload's wire

&#x20;   format. SYNC-ARCHITECTURE.md Section 25.11 does.

&#x20; It does not define the delivery bookkeeping or the retry of

&#x20;   event delivery. SYNC-ARCHITECTURE.md Section 18 does.

&#x20; It does not add a new event type for outbound messages. It uses

&#x20;   the existing one.

&#x20; It does not add a delivery-status event. Delivery status

&#x20;   correlation is a funded-phase item. Section 14 records it.

&#x20; It does not re-open the Option A decision. It applies it.

&#x20; It does not conflate the three flows. Each is named and each is

&#x20;   kept in its scope.



========================================================================

END OF SECTION 9

========================================================================



========================================================================

10\. COMPLIANCE ENFORCEMENT HOOKS

========================================================================



This section defines where compliance enforcement runs in the send

flow, where the rules live, how they reach the agent's device, and

what each rule kind does when it blocks. It is the connector model's

application of the compliance layer that AGENT-APP-SPEC.md Section

10 already names.



It does not define the rule types themselves. AGENT-APP-SPEC.md

Section 10.1 defines them: quiet hours, contact limits, opt-out

handling, and disclosure text. It does not define what "block"

means for each rule type. AGENT-APP-SPEC.md Section 10.5 does. It

defines where and how those rules meet the send flow defined in

Section 8 of this document.



10.1 Purpose and the local-first compliance model



Compliance enforcement is local. The agent's device runs the

checks. The device holds the rules and the debtor state the checks

need. No network call is made to determine whether a message may be

sent.



This is the "cloud declares, local enforces" principle from

AGENT-APP-SPEC.md Section 10.1, applied concretely. The cloud holds

the agency's rules. The device applies them.



The reason it must be local:



&#x20; - A network call per send would make the send path depend on

&#x20;   connectivity. An agent working offline would be unable to send

&#x20;   compliant messages.

&#x20; - A network call per send would put the cloud on the path of every

&#x20;   send attempt, which is precisely what Section 2.4 says must not

&#x20;   happen.

&#x20; - The check requires debtor state (contact attempts, opt-out

&#x20;   status), which lives locally and cannot be sent to the cloud

&#x20;   without violating the invariant.



Therefore: rules on the cloud, but cached locally. Debtor state

local. Enforcement local.



10.2 Where the rules live and how they reach the device



Two categories of compliance data, with two different lifecycles.



Agency-level rules.

&#x20; Quiet hours, contact limits, disclosure text, and the list of

&#x20; jurisdictions the agency operates in. These are agency policy.

&#x20; They contain no debtor data. They identify no individual.



&#x20; Where they live in the MVP: on the client's devices, in the local

&#x20; SQLCipher database, in a compliance\_rules local record. They are

&#x20; entered by the admin in the Client Dashboard (this is a Client

&#x20; Dashboard feature that does not exist yet; Section 10.11 records

&#x20; it as an implementation-phase task).



&#x20; Are they synced to other devices? No, not in the MVP. They are

&#x20; entered on the admin's device and, for the MVP, the admin's

&#x20; device and the agent devices are set up by the same admin in the

&#x20; same organization. The MVP does not require the admin to enter

&#x20; the rules twice. Section 10.2.1 states how.



Per-debtor state.

&#x20; Contact history (used for contact limits), opt-out status per

&#x20; channel, and previously-kept promises. These identify a debtor.

&#x20; They must remain local. They already do: they are derived from

&#x20; the communications, actions, and debtors tables, which are all

&#x20; local.



&#x20; Opt-out status is the one per-debtor fact that needs explicit

&#x20; storage. It is stored on the debtor record, in the debtor's data

&#x20; JSON. When a debtor opts out of a channel, the device writes a

&#x20; new ENTITY\_UPDATED event for that debtor with a change record for

&#x20; the opt-out field. The change propagates to the organization's

&#x20; other devices through the existing sync channel. No new event

&#x20; type is needed. The opt-out state is debtor state and uses the

&#x20; debtor-state mechanism.



10.2.1 The agency-level rules in the MVP



The MVP does not sync the agency-level rules from the admin's

device to the agent devices through the sync channel. Two

alternative paths:



Option A — Local entry per device.

&#x20; The admin enters the rules on each device once, during setup.

&#x20; This is tedious but workable for a pilot with two or three

&#x20; devices.



Option B — Local entry on the admin device, distributed through

the sync channel as a new event.

&#x20; A new event type, COMPLIANCE\_RULES\_UPDATED, carries the rules as

&#x20; a JSON blob from the admin's device to the others. Every device

&#x20; overwrites its local rules record when it accepts the event.



Option B is the correct model, but it requires a fourth new event

type, in addition to the three connector events from Section 6.

The MVP does not include it. Option A is the MVP's working

approach: the admin enters the rules on each device during setup.



The MVP can switch to Option B without changing any other part of

this document, because the rules are already a local record and the

enforcement path is already local. Adding the event and its handler

is additive. Section 14 records Option B as a funded-phase

improvement.



10.3 The local rule record



The MVP's local rule record is a single-row table:



&#x20; quiet\_hours\_enabled      boolean

&#x20; quiet\_hours\_timezone     text, e.g. "Asia/Manila"

&#x20; quiet\_hours\_start        time, e.g. "21:00"

&#x20; quiet\_hours\_end          time, e.g. "08:00"

&#x20; quiet\_hours\_days         JSON array of weekday numbers

&#x20; quiet\_hours\_action       BLOCK | SCHEDULE | ALLOW

&#x20; contact\_limit\_enabled    boolean

&#x20; contact\_limit\_count      integer

&#x20; contact\_limit\_period     DAY | WEEK | MONTH

&#x20; disclosure\_text          text

&#x20; updated\_at               datetime



The physical schema is defined in an amendment to LOCAL-TABLES.md.

Section 10 defines the logical fields.



If the record does not exist (fresh install, admin has not yet

entered rules), the enforcement layer treats every check as ALLOW.

This is the correct MVP default: an agency that has not configured

rules is not silently blocking its own sends. It is not a compliance

stance; it is a recognition that enforcement is the client's choice

and the client has not yet made a choice.



The word for the ALLOW that comes from an unconfigured rule is

"no configured rule blocked," not "compliant." The distinction

matters for audit. A future audit log that reads

"COMPLIANCE\_PASSED" implies an affirmative determination. A log

that reads "NO\_CONFIGURED\_RULE\_BLOCK" describes the true state:

the engine did not find a rule that applies. Section 10.9's result

type uses "NO\_CONFIGURED\_RULE\_BLOCK" as the allow case in its

audit path. The user-facing copy in the UI is not affected; this

distinction is for the audit trail.



An empty or missing disclosure\_text is also ALLOW. The disclosure

is appended when it exists; its absence is not a block.



10.4 Where enforcement runs in the send flow



Compliance enforcement runs inside the preflight phase, Section

8.4, step 2. It runs after the configuration check and before the

adapter is called.



The sequence within step 2:



&#x20; 1. Read the local compliance\_rules record. If absent, skip to

&#x20;    step 6 (allow).

&#x20; 2. Quiet hours check.

&#x20; 3. Contact limit check.

&#x20; 4. Opt-out check.

&#x20; 5. Disclosure text append (a transformation, not a check).

&#x20; 6. Return.



Steps 2, 3, and 4 are the checks. Each returns ALLOW or BLOCK (with

a reason). If any returns BLOCK, the enforcement layer stops and

the send flow stops with a ComplianceBlocked error. The specific

rule that blocked is named in the error, so the modal can show the

right message.



Step 5 is different from the others. It does not block. It

transforms. If disclosure\_text is present, it is appended to the

message body before the preview is shown. Because Section 8.3's

Rule 3 requires the preview to reflect the exact body that will be

sent, the disclosure is appended before the preview, not after it.



That ordering matters. If the disclosure were appended after the

preview, the agent would see one body and the provider would

receive another. Section 8.3 forbids that.



The invariant this sequence protects (from Section 8.3, Rule 3) is:

the body shown in the preview is the body sent to the provider.



The consequence: if the agent edits the body after the preview is

shown, the compliance transformation must re-run on the edited body

before the send. The flow is:



&#x20; compose → transform (append disclosure)

&#x20;   → preview (shows transformed body)

&#x20;   → agent edits → transform again on the edited body

&#x20;   → preview again (shows the new transformed body)

&#x20;   → send



The MVP's modal implements this by running the transform on every

keystroke or on a debounced timer after the agent stops typing.

The transform is a deterministic string append; running it

repeatedly is safe as long as it is idempotent. The disclosure

append is made idempotent by checking whether the disclosure is

already the last line of the body before appending.



Implementation note: a modal that runs the transform once and

never re-runs it after the agent types is wrong, even if the

agent's edit looks small. Section 8.3's Rule 3 is not

conditional.



10.5 The quiet hours rule



Reads quiet\_hours\_enabled. If false, ALLOW.



If true, reads the current time in the configured timezone, checks

whether it falls in the configured window on the configured

weekdays, and returns:



&#x20; - ALLOW if outside the quiet window.

&#x20; - BLOCK if inside the quiet window and quiet\_hours\_action is

&#x20;   BLOCK.

&#x20; - ALLOW\_WITH\_SCHEDULE if inside the quiet window and

&#x20;   quiet\_hours\_action is SCHEDULE. In the MVP, SCHEDULE is

&#x20;   treated as BLOCK, because the MVP does not implement

&#x20;   scheduled sends. The modal message tells the agent the

&#x20;   message would be allowed after the quiet window ends.

&#x20; - ALLOW if inside the quiet window and quiet\_hours\_action is

&#x20;   ALLOW. (The agency has explicitly chosen not to enforce.)



The MVP does not implement scheduled sends. A future phase that

adds a message queue on the client device can honor SCHEDULE. The

rule's presence in this section is forward-compatible: the config

already accepts SCHEDULE, and the enforcement path already knows

how to recognize it. Turning SCHEDULE into a real deferred send is

additive.



10.6 The contact limit rule



Reads contact\_limit\_enabled. If false, ALLOW.



If true, reads the local communications table for the debtor in

the configured period, counting OUTBOUND communications of the

following types: CALL, SMS, EMAIL. The NOTE type is not counted.

The reasoning: a note is an internal record, not a contact with

the debtor. It does not enter a channel the debtor experiences.

Section 10.6's predicate is the rule; a future amendment may add

NOTE as configurable, but the MVP does not.



The predicate matches what the communications table's type column

already distinguishes. The table uses the same four values (CALL,

EMAIL, SMS, NOTE, per LOCAL-TABLES.md Category A.4). The MVP's

contact-limit rule counts the three that are actual contacts.



If the count is below contact\_limit\_count, ALLOW. If the count is

at or above the limit, BLOCK.



The check is per debtor, across all outbound channels. This is the

conservative reading of "contact limit": the agency does not want

to overwhelm a debtor, so a mix of SMS, email, and calls still

counts against the same limit. A funded-phase variation could

count per channel.



The check reads the local communications table, which includes

rows synced from other devices (Section 9). This means the check

reflects the whole organization's contact activity with the

debtor, not just the current device's. The agent's device knows

that another agent called the debtor twice today, and can enforce

the limit accordingly.



The check is a local database query. It is fast.



The query reads communications rows filtered by debtor\_id and

created\_at. LOCAL-TABLES.md Category A.4 lists an index on

debtor\_id. It does not list an index on (debtor\_id, created\_at).

For the MVP's scale — a single debtor's communications are dozens

of rows, not thousands — the existing debtor\_id index is

sufficient. A future phase that grows the table to the point where

the range query against created\_at matters adds a composite index

via an amendment to LOCAL-TABLES.md. Section 10 does not require

the composite index in the MVP. This note is the pre-implementation

consistency check.



10.7 The opt-out rule



Reads the debtor's opt-out status for the connector's channel. The

status is stored in the debtor's data JSON as a per-channel flag.

See Section 10.2.



The opt-out field is a first-class change record, not a nested

blob. It uses the same change-record mechanism that ENTITY\_UPDATED

defines for any field: the change record names the field (for

example "opt\_out.sms") and carries the value ("true" or "false").

This means:



&#x20; - The reconciliation algorithm (SYNC-ARCHITECTURE.md Section

&#x20;   25.9.9) applies per field, as it does for any other debtor

&#x20;   field.

&#x20; - Two devices that set different opt-out values for the same

&#x20;   channel reconcile deterministically by the standard protocol

&#x20;   order. The losing value is recorded in history\_records.

&#x20; - The field is not hidden inside a JSON sub-object that bypasses

&#x20;   the field-level machinery.



The convention "opt\_out.<channel>" is not a change to the wire

format. It is a field-name convention within the existing

ENTITY\_UPDATED payload. The channel is a suffix; the field is

still named in the change record the same way the existing schema

names any other changeable field.



If the flag for the connector's channel is set, BLOCK. This is

unconditional. The opt-out cannot be overridden from the agent's

device. AGENT-APP-SPEC.md Section 10.5 states this: "Opt-out:

block entirely, no override."



If the flag is not set, ALLOW.



The MVP supports opt-out per channel. A debtor may have opted out

of SMS but not of email. The check reads the flag for the specific

channel the connector serves.



Opt-in restoration (a debtor who opted out and then opted back in)

is not implemented in the MVP. The flag can be cleared by the

admin through the debtor's edit form, which produces an

ENTITY\_UPDATED event. That is the MVP's mechanism for correction.



10.8 The disclosure rule



Reads disclosure\_text. If empty, do nothing. If present, appends

it to the message body, separated from the body by a newline.



The append happens before the preview (Section 10.4, step 5). The

preview shows the body with the disclosure already included.



The disclosure is not a block. It is a transformation. There is no

"the disclosure failed" case. Either the disclosure text is

present and is appended, or it is absent and nothing happens.



The MVP does not support per-channel disclosure text. One text

applies to all channels. A funded-phase variation could add

per-channel text; the local record would gain columns, and the

enforcement would read the right one.



10.9 The enforcement result type



Section 8.4 already names SendFlowErrorKind::ComplianceBlocked.

This section defines what populates it:



&#x20; ComplianceBlocked {

&#x20;     rule:     QuietHours | ContactLimit | OptOut,

&#x20;     reason:   a short, human-readable string,

&#x20; }



The rule value identifies which check blocked. The reason is the

message the modal shows. Examples:



&#x20; QuietHours  "This debtor is outside the permitted contact

&#x20;             window. Try again after 08:00 Asia/Manila."

&#x20; ContactLimit "This debtor has reached the contact limit

&#x20;             (3 outbound messages in the last 7 days)."

&#x20; OptOut      "This debtor has opted out of SMS. Contact them

&#x20;             through another channel or update their record."



The reason strings are the modal's user-facing copy. They are not

localized in the MVP. A funded-phase phase can add localization.



The disclosure rule does not produce a ComplianceBlocked. It cannot

block.



10.10 What the compliance layer does not do



The compliance layer does not:



&#x20; - Contact the cloud. All checks are local.

&#x20; - Contact the provider. The compliance layer runs before the

&#x20;   adapter.

&#x20; - Modify the credential or the connector configuration.

&#x20; - Write any log that includes the message body.

&#x20; - Enforce rules the agency has not configured. A rule that is

&#x20;   disabled or absent is ALLOW. The MVP does not apply a "default

&#x20;   rule set" beyond the empty case.

&#x20; - Override an opt-out. Never. This is the one check that is

&#x20;   absolute.

&#x20; - Distinguish Tier 1 from Tier 2 connectors. Compliance runs the

&#x20;   same way regardless of who provisioned the credential.

&#x20; - Block the AI Copilot. The AI connector's flow does not pass

&#x20;   through the send flow; Section 12 defines its own compliance

&#x20;   approach (which is minimal: the AI boundary layer is the

&#x20;   relevant mechanism).

&#x20; - Assume the agency's rules are synchronized across devices in

&#x20;   the MVP. They are not. Section 10.2.1 defines the local-entry

&#x20;   approach. A device that was not configured by the admin returns

&#x20;   "no configured rule blocked" for every check. This is the

&#x20;   accepted MVP limitation. Section 14 records it, and the

&#x20;   Client Dashboard's configuration page (implementation-phase

&#x20;   task) should display "Rules on this device were last updated

&#x20;   at YYYY-MM-DD HH:MM" prominently, so the admin cannot

&#x20;   reasonably assume that configuring the Client configured every

&#x20;   Agent.



10.11 What Section 10 does not do



&#x20; It does not define the rule types. AGENT-APP-SPEC.md Section 10.1

&#x20;   does.

&#x20; It does not define the "block" meanings per rule type in general.

&#x20;   AGENT-APP-SPEC.md Section 10.5 does. Sections 10.5 through 10.8

&#x20;   of this document apply those meanings to the local record.

&#x20; It does not define the local schema in physical form. An

&#x20;   amendment to LOCAL-TABLES.md does.

&#x20; It does not implement the Client Dashboard's "Local compliance

&#x20;   rules" configuration page. That is a Client Dashboard feature.

&#x20;   Section 10.7 of the Agent App spec references it. Section 4 of

&#x20;   this document does not.

&#x20; It does not add a compliance\_rules sync event. It records

&#x20;   COMPLIANCE\_RULES\_UPDATED as a funded-phase improvement in

&#x20;   Section 14.

&#x20; It does not add a per-channel disclosure. Funded phase.

&#x20; It does not add scheduled sends for the SCHEDULE quiet-hours

&#x20;   action. Funded phase.

&#x20; It does not add per-channel contact limits. Funded phase.



========================================================================

END OF SECTION 10

========================================================================



========================================================================

11\. AGGREGATE USAGE REPORTING

========================================================================



This section defines the counts that leave the client's device and

reach GORKA's cloud as aggregate connector usage. It is the one

place in the connector model where a fact about a send reaches

Zone 1.



It does not carry debtor data. It does not carry message content. It

carries counts. The section's job is to state what is counted,

when, by whom, where it goes, and what it does not contain.



11.1 Purpose and placement



Connector usage reporting exists for three purposes:



&#x20; 1. Billing. The client is invoiced per period for connector usage.

&#x20; 2. Analytics. The Owner Dashboard shows aggregate connector

&#x20;    activity across the platform.

&#x20; 3. Provider reconciliation. GORKA-managed connectors (Tier 1)

&#x20;    require GORKA to reconcile its own provider bills against the

&#x20;    usage it invoiced the client.



All three purposes need counts. None of them need content.



The cloud table that holds the counts is `connector\_usage`. It is

defined in CLOUD-TABLES.md Section 6.3. Section 11 does not

redefine it. It defines what GORKA's devices send to it.



11.2 What is counted



For each enabled connector, per period, the following counts:



&#x20; - The number of outbound sends.

&#x20; - Broken out by outcome: sent, transport-uncertain, failed.

&#x20; - Broken out by channel.

&#x20; - The period's start and end dates.



A "send" is one adapter attempt (Section 8.5). The vocabulary

matches Section 8.7's final send-result values. Section 11 does

not reinterpret adapter errors; it consumes the final locally

recorded send\_result from the communications row's data JSON.



Voice is not implemented in the MVP. The MVP's channels are SMS

and EMAIL. When voice is implemented in a funded phase, the unit

question — calls or minutes — becomes relevant. Section 11.2

records the choice for that phase: the MVP's choices of "message"

and "email" as units are the precedent; a voice connector that is

billed per minute would add "minute" as a fourth unit alongside a

count of calls, in two separate fields (a call count and a minute

total). That resolution is deferred until voice is designed. The

MVP does not need it.



11.3 What is not counted



The following never leave the device, in any form, under any

circumstance:



&#x20; - The recipient address.

&#x20; - The message content.

&#x20; - The debtor's id, name, or any identifier that maps to one

&#x20;   debtor.

&#x20; - The provider's response payload.

&#x20; - The provider's message id.

&#x20; - The credential or any part of the credential.

&#x20; - The connector's per-organization configuration (from-number,

&#x20;   from-address, sender identity).

&#x20; - The agent's user\_id.

&#x20; - The wire device\_id.



The aggregate counts carry no per-debtor and no per-agent

dimension. They are organization-level totals per connector per

period.



Section 11.3's list is unchanged. It forbids the device\_id from

leaving the device. Section 11.7 introduces a separate, server-

generated identifier whose purpose is deduplication, not device

tracking. The two are distinct:



&#x20; - The wire device\_id: the local replica identifier. It never

&#x20;   leaves the device. It is never sent to the cloud in any

&#x20;   endpoint, in any payload, at any time.

&#x20; - The contribution token: an opaque UUID the server generates

&#x20;   the first time a device reports for a given (organization,

&#x20;   connector, period). The device caches it locally and sends it

&#x20;   on subsequent reports for the same period, so the server can

&#x20;   deduplicate. The token is not derived from the device\_id. It

&#x20;   does not encode the device identity. It is meaningless outside

&#x20;   the (organization, connector, period) key. It is not exposed

&#x20;   in any Owner Dashboard view, in any analytics, or in any

&#x20;   exported report.



11.4 Where the counting happens



The counting happens on each device, locally, from the

communications rows the device holds. There is no separate counter

process.



A device holds a communications row for every outbound message

that has been synced to it, regardless of which device originated

the send (Section 9.5). If two devices each sent a message to two

different debtors, both devices hold both rows. Counting from the

local table would double-count.



The rule that resolves this:



&#x20; A device counts only the communications rows whose event origin

&#x20; is the device itself.



The device\_id on the sync event identifies the origin. A

communications row whose event was originated by this device has

event.device\_id == this device's id. A communications row that

arrived from a peer has event.device\_id != this device's id.



Counting the rows whose event origin is this device gives the

device its own contribution. The organization's total is the sum

of the contributions from all devices.



This is why the cloud table is built from per-device contributions,

not from one device that counted everything.



The implementation must have a deterministic way to associate a

communications row with its originating sync event. The current

schema associates them by id: the communications row's id is the

event's entity\_id (SYNC-ARCHITECTURE.md Section 25.11.5). The

event's device\_id is therefore reachable by joining the

communications row to sync\_events on entity\_id = communications.id

and event\_type = COMMUNICATION\_LOGGED. The join is expected to be

fast because sync\_events is indexed by (entity\_type, entity\_id)

per LOCAL-TABLES.md Category D.1.



If a future schema change moves that association, Section 11 must

be amended. Until then, the join in this paragraph is the

mechanism.



11.5 When the counting happens



Per period, driven by the device's own schedule:



&#x20; - At the end of the period, if the device is online.

&#x20; - At the next opportunity, if the device was offline at period

&#x20;   end.

&#x20; - On demand, if the admin triggers a manual sync from the Client

&#x20;   Dashboard.



The MVP does not implement a background scheduler. The counting

and reporting happen when the device's sync engine is running and

the period's boundary has passed. If the device is offline at the

period boundary, the report is deferred until the device comes

online.



The period is calendar-month. A future phase that needs weekly or

daily reporting adds it via a new periodicity parameter. The MVP

uses calendar-month.



Resubmission. A device may report the same period more than once.

The first report for a period is authoritative at that moment.

If the device later learns of an additional qualifying send in the

same period (for example, a communication row whose sync event

arrived late), it reports again. The cloud's rule:



&#x20; - The cloud computes the sum across contribution tokens for the

&#x20;   (organization, connector, period) key.

&#x20; - A report whose contribution\_token is already seen for that key

&#x20;   replaces the previous contribution from the same token.

&#x20; - A report whose contribution\_token is new is added.

&#x20; - A report whose contribution is smaller than the previous one

&#x20;   from the same token is accepted as a correction (the device is

&#x20;   allowed to lower its own count).



The cloud never adds a duplicate of the same token's report. The

server-side handler stores the current value per token, not an

append log. The deduplication is deterministic.



The MVP does not implement a "close the period" step. A period's

totals can change until the next period's data starts arriving.

A funded phase that needs frozen closed periods adds that

mechanism explicitly.



11.6 Where the report goes



The device sends the report to GORKA's cloud, over the existing

authenticated HTTPS channel. The endpoint is the existing

`/api/connector-usage/sync` route, defined in the Phase 14 work

and recorded in CLOUD-TABLES.md Section 6.3. It is not a new

endpoint.



The request body carries:



&#x20; {

&#x20;   connectorCode,

&#x20;   periodStart,

&#x20;   periodEnd,

&#x20;   usageCount,

&#x20;   usageUnit,           // "message" for SMS, "email" for EMAIL

&#x20;   outcomes: {

&#x20;     sent,

&#x20;     transport\_uncertain,

&#x20;     failed

&#x20;   },

&#x20;   contributionToken    // server-assigned on first report;

&#x20;                        // omit on the very first report for a

&#x20;                        // (connector, period)

&#x20; }



The request body does not carry organizationId. The backend reads

it from the JWT (the existing authenticateToken middleware). The

device does not choose the organization; the organization is the

device's authenticated identity.



The device does not send the counts for another device. It sends

its own contribution. The cloud aggregates.



11.7 What the cloud does with the report



The cloud writes one row in `connector\_usage` per (organization,

connector, period, contribution\_token). The contribution token is

the server-generated deduplication key described in Section 11.3.

It is not the wire device\_id. It is not exposed to any reader of

the table beyond the deduplication logic inside the write handler.



The cloud writes one row in `boundary\_proof\_logs` for the sync,

with eventType = CONNECTOR\_USAGE\_SYNC and debtorDataIncluded =

false. The payload summary contains only the counts and the

connector code. This is the same pattern the existing metrics and

activity sync endpoints use.



The cloud does not write the report anywhere else. It does not

join the counts to anything that could reconstruct per-debtor or

per-agent activity. The counts are organization-level.



The Owner Dashboard reads `connector\_usage` for the aggregate

view. See Section 11.8. The Client Dashboard reads the same table

for the client's own view.



11.8 What the Owner Dashboard sees



The Owner Dashboard's connector analytics view shows:



&#x20; - Total sends per connector, per period, across the platform.

&#x20; - Per-organization totals for one organization, when the Owner

&#x20;   is investigating.

&#x20; - Outcomes broken out (sent, transport-uncertain, failed).

&#x20; - Nothing about debtors. Nothing about agents. Nothing about

&#x20;   individual messages.



The Owner Dashboard cannot see a message's content. It cannot see

which debtor received which message. It cannot see which agent

sent which message. It sees the same aggregate shape GORKA's cloud

already holds for the existing metrics and activity tables.



11.9 The connection to billing



For Tier 1 connectors, the cloud's `connector\_usage` table is the

source of the client's monthly connector invoice. The billing

route defined in Phase 14.4 (`/api/billing/summary`) reads from

the same table. Section 11 does not add a billing mechanism; it

feeds the existing one.



For Tier 2 connectors, the client pays the provider directly.

GORKA does not invoice for Tier 2 usage. The cloud still records

the aggregate counts, because the Owner Dashboard's analytics view

shows them, and because a future phase may want to display

per-connector activity to the admin.



11.10 The manual "sync now" option



Section 11.5 mentions an admin-triggered manual sync. The MVP

implements this as a Client Dashboard button that triggers the

same reporting flow the automatic period-boundary uses. The button

does not introduce a new code path; it triggers the same counting

and reporting logic on demand.



The Agent App does not have a manual sync button. Agents do not

manage usage reporting. Reporting is an admin-side operational

concern, and the Client Dashboard is where the admin operates.



11.11 What Section 11 does not do



&#x20; It does not define the `connector\_usage` cloud table. CLOUD-

&#x20;   TABLES.md Section 6.3 does.

&#x20; It does not define the `/api/connector-usage/sync` endpoint.

&#x20;   Phase 14.3 does.

&#x20; It does not define the billing summary. Phase 14.4 does.

&#x20; It does not define an Owner Dashboard view. The Owner Dashboard

&#x20;   is a separate application; its view of connector\_usage is

&#x20;   whatever that application renders.

&#x20; It does not add an event type. Usage reporting is a direct

&#x20;   HTTPS call to the cloud, not a sync event. The counts do not

&#x20;   travel between the client's devices; each device sends its own

&#x20;   contribution directly.

&#x20; It does not add per-agent or per-debtor dimensions. Those are

&#x20;   forbidden by Section 11.3.

&#x20; It does not define a background scheduler. The MVP reports at

&#x20;   period boundaries when the device is running, and on manual

&#x20;   trigger. A funded phase that needs guaranteed timely reporting

&#x20;   adds a scheduler.

&#x20; It does not add a periodicity parameter. The MVP uses

&#x20;   calendar-month. A funded phase that needs weekly or daily

&#x20;   reporting adds it.



========================================================================

END OF SECTION 11

========================================================================



========================================================================

12\. AI COPILOT AS A CONNECTOR

========================================================================



This section defines the AI Copilot's placement in the connector

model. It is the decision point left open by Section 7.10: whether

the Gemini adapter stays on the unified ConnectorAdapter trait or

needs its own.



It does not define the AI boundary layer's rulebook. That is

AGENT-APP-SPEC.md Section 9. It does not redefine the AI Copilot's

UI. That is AGENT-APP-SPEC.md Section 11.6. It defines how the AI

connector fits the connector model's plumbing, and it settles the

trait question.



12.1 The trait decision



The Gemini adapter stays on the unified ConnectorAdapter trait.

Section 7.10's condition — that Section 12 must demonstrate the

unified trait is not semantically misleading — is satisfied by the

mapping in this section.



The trait's vocabulary is:



&#x20; SendRequest {

&#x20;     to, body, subject, from

&#x20; }



&#x20; SendResult {

&#x20;     success, provider\_message\_id, provider\_status,

&#x20;     provider\_response

&#x20; }



&#x20; ConnectorError {

&#x20;     kind, message, provider\_response

&#x20; }



Mapping the AI call onto this vocabulary:



&#x20; SendRequest.to            Not used. The AI provider is not

&#x20;                           addressed. The field is empty.

&#x20; SendRequest.body          The prompt, after the AI boundary layer

&#x20;                           has redacted it.

&#x20; SendRequest.subject       Not used. Empty.

&#x20; SendRequest.from          Not used. Empty.



&#x20; SendResult.success        Whether the AI provider returned a

&#x20;                           usable response.

&#x20; SendResult.provider\_      The AI provider's own identifier for the

&#x20;   message\_id              call, if it returns one. Used for

&#x20;                           debugging. Not synchronized.

&#x20; SendResult.provider\_      The provider's status string, if it

&#x20;   status                  returns one. For Gemini this is

&#x20;                           typically "completed" or absent.

&#x20; SendResult.provider\_      The provider's full response. For the

&#x20;   response                AI connector this is the AI's answer.

&#x20;                           It is treated as sensitive, per Section

&#x20;                           7.3's rule. It is never synchronized.

&#x20;                           It is never displayed in a raw form.

&#x20;                           Its content is what the AI boundary

&#x20;                           layer's caller (the Copilot) reads and

&#x20;                           presents to the agent.



&#x20; ConnectorError.kind       Reused. AuthenticationFailed means the

&#x20;                           Gemini credential is invalid.

&#x20;                           InvalidRecipient is never used.

&#x20;                           RateLimited means the AI provider

&#x20;                           rate-limited the call.

&#x20;                           ProviderTransientError and

&#x20;                           ProviderPermanentError apply as for

&#x20;                           any provider.

&#x20;                           TransportError applies.

&#x20;                           LocalConfigurationError applies.

&#x20;                           ResponseParseError applies.



The vocabulary is not ideal. The field names `to`, `from`, and

`subject` are meaningless for an AI call. But the trait is used at

the adapter boundary, not at the UI boundary. The Copilot UI never

sees a SendRequest; it calls a Copilot-specific command that

constructs a SendRequest internally, with the unused fields set

empty. The meaningless fields are invisible to anyone except the

adapter author.



The alternative — a separate AIAdapter trait — would introduce:



&#x20; - A second registry.

&#x20; - A second credential distribution path.

&#x20; - A second test pattern.

&#x20; - A second set of secret-leak invariants.

&#x20; - A second place where the connector model's boundaries must be

&#x20;   enforced.



The cost of the second trait outweighs the cost of three unused

fields. Section 7.10's condition is met: the trait is not

semantically misleading in practice, only in the abstract. The

abstract mismatch is recorded here, so a future reader is not

surprised by it.



Implementation safeguard: the generic validation that the Copilot

and the send flow apply to a SendRequest must not be applied

indiscriminately. The send flow validates that `to` and `from` are

non-empty for messaging connectors. The Copilot does not. The AI

adapter must not reject an empty `to`, `from`, or `subject`. The

validation lives in the caller, not in the adapter and not in a

shared validation helper that both callers use. If a future phase

extracts a shared SendRequest validator, it must be parameterized

by connector kind, or the AI path must bypass it.



12.2 The AI connector's differences from a messaging connector



The AI connector shares the plumbing but has four material

differences from a messaging connector.



Difference 1 — the direction of the data.

&#x20; A messaging connector sends a message to a debtor. The debtor is

&#x20; the recipient of the information.

&#x20; The AI connector sends a prompt to a provider and receives an

&#x20; answer. The prompt is the input; the answer is the output. The

&#x20; AI provider is a tool, not a recipient.



Difference 2 — what leaves the device.

&#x20; A messaging connector sends the message body to the provider.

&#x20; That body is intended for the debtor.

&#x20; The AI connector sends a prompt to the provider. That prompt

&#x20; must contain no debtor-identifying information. The AI boundary

&#x20; layer enforces this before the adapter is called.



Difference 3 — where the content is stored.

&#x20; A messaging connector's content becomes a communications row and

&#x20; syncs to every device (Section 9).

&#x20; The AI connector's prompt and response are stored locally on the

&#x20; originating device only. AGENT-APP-SPEC.md Section 8.4 states:

&#x20; "The MVP stores them locally, on the device that produced them.

&#x20; They are not synchronized."



Difference 4 — the compliance layer's role.

&#x20; A messaging connector's send passes through the compliance layer

&#x20; (Section 10).

&#x20; The AI connector's call does not. Compliance rules about quiet

&#x20; hours, contact limits, and opt-out are about contacting debtors.

&#x20; An AI call is not a contact with a debtor. The AI connector's

&#x20; relevant boundary is the AI boundary layer, not the compliance

&#x20; layer.



The four differences are not accommodated by the trait; they are

accommodated by the calling code. The Copilot's command in each

Tauri binary constructs a SendRequest differently, reads the

response differently, stores it differently, and does not call the

compliance layer. The trait itself does not need to know.



12.3 What the AI connector does not do



The AI connector does not:



&#x20; - Log the prompt or the response anywhere except the local AI

&#x20;   history table. AGENT-APP-SPEC.md Section 5.7 names

&#x20;   local\_ai\_history as an anticipated table; the MVP does not

&#x20;   create it. Until it exists, the Copilot's responses are stored

&#x20;   in memory for the session only. Persisting them is a

&#x20;   funded-phase task recorded in Section 14.

&#x20; - Send the prompt or the response through the sync channel.

&#x20;   They stay local.

&#x20; - Pass through the compliance layer.

&#x20; - Appear in the communications table. An AI call is not a

&#x20;   communication with a debtor.

&#x20; - Appear in the connector\_usage aggregates. Section 11.2's

&#x20;   counts are for messaging connectors. The AI connector's

&#x20;   usage is not reported in the MVP. A funded phase that bills

&#x20;   for AI calls adds them to the aggregate. The MVP does not.

&#x20; - Be enabled by the admin without an explicit opt-in. The admin

&#x20;   enabling the Gemini connector is the opt-in. Until the admin

&#x20;   enables it, no AI calls are made. Section 4's enable flow

&#x20;   applies unchanged.



The provider\_response field is not persisted by any generic

connector infrastructure. The messaging flow persists what it

chooses into the communications row's data JSON, per Section

8.6.2. The AI flow persists nothing in the MVP: the response is

held in memory for the session and discarded when the panel

closes. No shared code, no generic SendResult handler, and no

logging layer reads provider\_response and writes it anywhere. This

is a structural rule, not a policy. If a future phase adds AI

history persistence, it adds it as an AI-specific step, not as a

generic adapter consequence.



12.4 The AI boundary layer's placement



The AI boundary layer runs on the agent's device, inside the

Copilot command, before the adapter is called.



The sequence:



&#x20; 1. The agent types a question in the Copilot panel.

&#x20; 2. The Copilot command reads the debtor's context from local

&#x20;    state (the context engine, per AGENT-APP-SPEC.md Section 9).

&#x20; 3. The Copilot command runs the AI boundary layer over the

&#x20;    prompt. The layer redacts any debtor-identifying content

&#x20;    (names that match a local debtor, contact fields, exact

&#x20;    amounts). See AGENT-APP-SPEC.md Section 9.3 for the layer's

&#x20;    rules.

&#x20; 4. The Copilot command constructs a SendRequest with the

&#x20;    redacted prompt in the body field.

&#x20; 5. The Copilot command looks up the AI adapter in the registry,

&#x20;    constructs it with the Gemini credential from the local

&#x20;    connector record, and calls send().

&#x20; 6. The adapter calls the Gemini API with the redacted prompt.

&#x20; 7. The adapter returns a SendResult whose provider\_response is

&#x20;    the AI's answer.

&#x20; 8. The Copilot command takes the answer, presents it to the

&#x20;    agent, and stores it locally.



At no point in this sequence does the unredacted prompt leave the

device. The adapter is the boundary: whatever is in SendRequest.body

when the adapter is called, is what the provider receives. The

boundary layer runs before construction, not inside the adapter.



The rule: the adapter does not redact. The adapter does not have a

redactor. The adapter is dumb about content. The boundary layer is

the only place where redaction happens. If a future change moves

redaction into the adapter, it violates the separation and this

section.



Structural safeguard: the Copilot command is the only code path

that constructs a SendRequest for the Gemini adapter, and it always

runs the boundary layer first. No other command, in either binary,

looks up the Gemini adapter in the registry. The Gemini adapter's

factory is registered with the registry (Section 7.4), so in

principle any caller could construct it — but no other caller does.

The safeguard is a code-review invariant and a test: a test

constructs the Copilot command and asserts the boundary layer ran

before the adapter was constructed; a second test asserts that the

registry cannot be reached to construct the Gemini adapter without

the boundary layer having run in the same call stack. This is not

enforceable by types alone; it is enforceable by test and by review.



12.5 Where the Gemini credential comes from



The Gemini credential is stored and distributed exactly like any

other connector's credential. Section 6 applies in full. The

distinctions:



&#x20; - Gemini is BYOP in the MVP (Section 3.5.4). GORKA does not hold

&#x20;   a master credential for Gemini. The admin enters the client's

&#x20;   Gemini API key through the Tier 2 flow (Section 4.6).

&#x20; - The credential is stored in the local record like any other

&#x20;   credential.

&#x20; - The credential is distributed to agent devices through the

&#x20;   CONNECTOR\_ENABLED event, like any other credential (Section

&#x20;   6.11).

&#x20; - The credential is not displayed to the agent, not logged, not

&#x20;   included in any error, and is spent after one call. Section 6.9

&#x20;   through 6.12 apply unchanged.



The AI credential's lifecycle is not special. It uses the connector

model's plumbing without exception.



12.6 The AI Copilot's UI



The Copilot panel is defined in AGENT-APP-SPEC.md Section 11.6. It

is a collapsible panel, at the side or bottom of the debtor profile.

The agent types a question; the boundary layer redacts; the provider

call happens; the answer shows.



This section does not redefine the UI. It states only that the UI

calls the Copilot command, and the Copilot command uses the AI

connector through the same registry, factory, and adapter pattern as

the messaging connectors.



12.7 What Section 12 does not do



&#x20; It does not define the AI boundary layer's rules. AGENT-APP-SPEC.md

&#x20;   Section 9 does.

&#x20; It does not define the Copilot UI. AGENT-APP-SPEC.md Section 11.6

&#x20;   does.

&#x20; It does not add a new trait. Section 7.10's unified trait is used.

&#x20; It does not add an AI-specific event type. AI prompts and

&#x20;   responses stay local.

&#x20; It does not add AI usage to the aggregates in Section 11. That

&#x20;   is a funded-phase item.

&#x20; It does not create the local\_ai\_history table. That is a funded-

&#x20;   phase item recorded in Section 14.

&#x20; It does not change the credential distribution mechanism. The

&#x20;   Gemini credential uses Section 6 unchanged.



========================================================================

END OF SECTION 12

========================================================================



========================================================================

13\. ZONE 3 DECLARATION

========================================================================



This section defines the Zone 3 declaration: the warning the Client

Dashboard shows when the admin connects GORKA to a third-party

service GORKA does not control.



The Client Dashboard already implements this declaration. The

existing DeclarationModal.tsx in the Connectors components folder

is the surface. Section 13 documents it, places it in the connector

model, and states what it must and must not say. It does not

redesign it.



13.1 Purpose and the law



ARCHITECTURAL-LAW.md Section 21.3 states GORKA's Zone 3 obligation:



&#x20; When the client connects GORKA to a third party outside GORKA's

&#x20; control, GORKA must warn the client that debtor data may leave

&#x20; the client's machine and that the responsibility is the client's.



The warning must be:



&#x20; - Shown at the point of connection, before the connection is

&#x20;   established.

&#x20; - Written in plain language, not buried in terms of service.

&#x20; - Recorded. The record is kept so that the warning can be shown

&#x20;   to have been given, if a question arises later.

&#x20; - Non-blocking. GORKA warns; the client decides. GORKA does not

&#x20;   prevent the connection.



Section 13 applies this to the connector model's `external\_api`

path. The existing modal is the mechanism. Section 13 documents

what it must carry and what it must not.



13.2 When the declaration is shown



The Zone 2 / Zone 3 criterion, stated once:



&#x20; Zone 2 is a GORKA-provided mechanism for a specific, known

&#x20; provider. GORKA built an adapter that knows what the provider is

&#x20; and how to talk to it. GORKA can design the mechanism so that

&#x20; debtor data does not pass through it to GORKA's cloud. The

&#x20; obligation is prevention; the mechanism is the guard.



&#x20; Zone 3 is a connection the client makes by a path GORKA does not

&#x20; specifically control, to a service GORKA does not know the

&#x20; specifics of. GORKA provides a generic mechanism (for example, a

&#x20; configurable HTTP client) that the client fills in. GORKA cannot

&#x20; design a guard, because GORKA does not know what the target

&#x20; service is or what data the client intends to send. The

&#x20; obligation is warning.



The criterion is not "whose credential is it." A Tier 2 (BYOP)

connector uses the client's own credential, but the path through

GORKA's adapter for that provider is still a GORKA-provided

mechanism for a known provider. It is Zone 2. The mechanism — the

adapter — is the guard, and it is designed so that debtor data

does not pass through it to GORKA's cloud.



Under this criterion, the classification of the MVP's connectors:



&#x20; twilio-sms      Zone 2. GORKA's Twilio SMS adapter.

&#x20; twilio-voice    Zone 2. GORKA's Twilio Voice adapter.

&#x20; resend-email    Zone 2. GORKA's Resend adapter.

&#x20; mocean-sms      Zone 2. GORKA's Mocean adapter. The credential

&#x20;                 is the client's, but the path is GORKA's.

&#x20; gemini-ai       Zone 2. GORKA's Gemini adapter.

&#x20; external\_api    Zone 3. GORKA's generic HTTP client, configured

&#x20;                 by the client to reach a service GORKA does not

&#x20;                 know the specifics of.



The declaration is shown for `external\_api`. It is not shown for

the five cataloged connectors, because each of them is a GORKA-

provided mechanism for a known provider.



The rule is general, not a per-connector choice. When a future

phase adds a new connector, the criterion determines its zone:



&#x20; - If GORKA builds a specific adapter for a named provider, the

&#x20;   connector is Zone 2.

&#x20; - If GORKA offers a generic mechanism the client configures to

&#x20;   reach a target GORKA does not know, the connector is Zone 3,

&#x20;   and the declaration applies.



A future connector that is Zone 3 for a reason other than

`external\_api` (for example, a "bring your own AI provider"

connector that lets the client wire GORKA to an arbitrary AI

endpoint) reuses the same declaration. The declaration is

parameterized by the third party's name. The mechanism does not

change.



The existing modal is the current UI reference. The architecture

order remains: ARCHITECTURAL-LAW, then CONNECTOR-MODEL, then

implementation. The existing DeclarationModal.tsx is not the

source of truth; the law and this section are.



13.3 What the declaration says



The existing modal's content is the reference. Section 13 does not

rewrite it. It states the four elements the modal must carry, in

any wording the Client Dashboard chooses:



&#x20; Element 1 — the third party's name.

&#x20;   The modal names the service the client is about to connect.

&#x20;   The current modal reads "You are about to connect GORKA to:

&#x20;   <connectorName>."



&#x20; Element 2 — what GORKA is not responsible for.

&#x20;   The modal states that GORKA provides the technical capability

&#x20;   to connect, but does not control and is not responsible for the

&#x20;   third party's data handling, security, or compliance. The

&#x20;   current modal lists four items: security practices, storage and

&#x20;   processing, compliance, and breaches.



&#x20; Element 3 — what the client is acknowledging.

&#x20;   The modal states that the client has reviewed the third party's

&#x20;   terms, assumes responsibility for data transmitted, and may

&#x20;   disconnect at any time.



&#x20; Element 4 — GORKA's own commitment.

&#x20;   The modal states that the client's data remains on the client's

&#x20;   infrastructure by default, that no data is shared without the

&#x20;   client's consent, and that third-party credentials are

&#x20;   encrypted at rest. The current modal states these three items.



The fourth element's wording must be literally true in the exact

connector flow. Once the admin deliberately connects a provider

and sends a message, the message leaves the client's machine and

reaches the provider. The "by default" and "without consent"

phrasing is what preserves the accuracy: the default is local, and

any transmission is the result of the admin's decision. Any UI

revision of the modal must keep this exception unmistakable.



All four elements are present in the existing modal. Section 13

does not require changes to its wording, only to its consistency

with the connector model.



13.4 What the declaration must not say



The declaration must not:



&#x20; - Guarantee anything about the third party. GORKA does not

&#x20;   control the third party. The declaration cannot promise that

&#x20;   the third party is compliant, secure, or reliable.

&#x20; - Claim that GORKA can read the data that passes to the third

&#x20;   party. GORKA is not on the path. The declaration states that

&#x20;   the client may send data; it does not state that GORKA can see

&#x20;   it.

&#x20; - Imply that the declaration transfers GORKA's obligations under

&#x20;   the invariant. The invariant applies to Zone 1 and Zone 2

&#x20;   always. The Zone 3 declaration applies only to Zone 3.

&#x20; - Be dismissible without acknowledgment. The current modal is a

&#x20;   full-page declaration with a Cancel and an "I UNDERSTAND \&

&#x20;   CONNECT" button. There is no "do not show again" path. The

&#x20;   admin must actively accept on each connection. This is

&#x20;   correct. If a future phase adds a "remember this choice"

&#x20;   option, it must persist the acknowledgment in the

&#x20;   organization\_audit\_events table with the timestamp and the

&#x20;   actor, so that the record of the warning having been given is

&#x20;   preserved.



13.5 The record of the warning



ARCHITECTURAL-LAW.md §21.3 states that the warning "must be

recorded": the record is kept so that the warning can be shown to

have been given, if a question arises later. This is a law-level

requirement. It is in scope for the MVP.



When the admin clicks "I UNDERSTAND \& CONNECT," the Client

Dashboard writes one row in the cloud's `organization\_audit\_events`

table:



&#x20; eventType       ZONE\_3\_CONNECTION\_ACKNOWLEDGED

&#x20; organizationId  the admin's organization, from the JWT

&#x20; actorId         the admin's user\_id

&#x20; actorName       the admin's display name at the time of the

&#x20;                 acknowledgment

&#x20; details         {

&#x20;                   connectorCode:  the catalog code being enabled

&#x20;                   thirdPartyName: the third party's display name

&#x20;                 }

&#x20; createdAt       the server's timestamp



The row is written before the enable request is sent, or in the

same request. If the acknowledgment is not recorded, the connection

is not established. This ordering ensures that the record exists

whenever the connection exists.



The MVP's `organization\_audit\_events` table already exists (CLOUD-

TABLES.md Category 4.4). No schema change is needed. The write is

one INSERT. The endpoint that receives it is either a small

addition to `connectors.routes.ts` (`POST /api/connectors/acknowledge-

zone-3`) or a parameter on the existing `POST /api/connectors/

enable` call. The choice is an implementation detail; the requirement

is that the row is written.



The existing `DeclarationModal.tsx` does not currently write this

record. Its `onAccept` handler sets local state and calls `onSave`.

Wiring the write is an implementation-phase task, not a design

change. Section 14 records it as an MVP implementation task.



If a future phase adds a "remember this choice" option, the record

for the remembered choice is the same row, written once with an

additional flag. The MVP does not include a "remember" option, so

every Zone 3 connection produces a fresh row.



13.6 The declaration's relationship to the credential form



The existing Client Dashboard flow is: declaration first, then the

configuration form. The admin reads the warning, accepts, and then

enters the credential for the third-party service.



Under the connector model, this order is preserved. The

declaration comes first. The credential form comes second. The

two are separate modals because they serve separate purposes: one

informs, one configures.



The credential form for an `external\_api` connector stores the

client's credential in the local record (Section 6), like any

other Tier 2 connector. The credential does not go to GORKA's

cloud, regardless of the fact that the connector is Zone 3. Zone 3

is about the send path, not about the credential's storage.



13.7 What the declaration is not



The declaration is not:



&#x20; - A contract. It is a warning. GORKA's obligations and the

&#x20;   client's obligations are defined by GORKA's terms of service

&#x20;   and by applicable law. The declaration does not create new

&#x20;   obligations; it makes the existing posture visible at the

&#x20;   point of choice.

&#x20; - An indemnity. It does not shift liability for GORKA's own

&#x20;   conduct. It records the client's decision to connect.

&#x20; - A blocker. The client can decline by clicking Cancel. The

&#x20;   client can also proceed without GORKA's involvement by

&#x20;   connecting to the third party outside GORKA entirely. GORKA's

&#x20;   role in Zone 3 is warning, not gatekeeping.



13.8 What Section 13 does not do



&#x20; It does not redesign the modal. The existing DeclarationModal.tsx

&#x20;   is the current UI reference. Section 13 documents the

&#x20;   requirement; the law and this section are the authority.

&#x20; It does not define the configuration form that follows. Section

&#x20;   4.6 does, in its Tier 2 form.

&#x20; It does not write the audit record in code. Section 14 records

&#x20;   the record as an MVP implementation task.

&#x20; It does not define other Zone 3 categories. If the funded phase

&#x20;   adds them, it reuses the declaration.

&#x20; It does not amend ARCHITECTURAL-LAW.md Section 21. It applies it.



========================================================================

END OF SECTION 13

========================================================================



========================================================================

14\. OPEN ITEMS

========================================================================



This section consolidates every item that this document has

identified as deferred, blocked, or awaiting implementation. It is

the section that makes the document honest about what it has not

resolved.



The items are grouped by category. Within each category, they are

listed in the order they appear in the document, not in order of

priority.



14.1 Amendments to frozen documents required before implementation



The following are hard blockers. Implementation of the affected

parts of the connector model cannot begin until these amendments

are applied to the frozen documents through their amendment

processes.



A1. SYNC-ARCHITECTURE.md amendment — connector event types.

&#x20;   Section 6.11 requires three new event types:

&#x20;     CONNECTOR\_ENABLED

&#x20;     CONNECTOR\_DISABLED

&#x20;     CONNECTOR\_CREDENTIAL\_REPLACED

&#x20;   and one new entity type:

&#x20;     CONNECTOR

&#x20;   The amendment defines: the event type codes, the entity type

&#x20;   code, the payload schema for each event, the wire encoding of

&#x20;   the credential blob, the configuration blob, and the metadata

&#x20;   fields, the NULL and empty semantics, and the receiving,

&#x20;   validation, and reconciliation behavior.



&#x20;   The amendment is additive. It does not change the transport,

&#x20;   the handshake, the session model, or the delivery bookkeeping.



&#x20;   HARD BLOCKER for credential distribution (Sections 6, 7, 8).



A2. SYNC-ARCHITECTURE.md amendment — created\_by in

&#x20;   COMMUNICATION\_LOGGED.

&#x20;   Section 9.3 found a defect: §25.13.9 states that created\_by is

&#x20;   present in COMMUNICATION\_LOGGED, but §25.11.3 does not list it

&#x20;   in the payload's TLV table, and the V6 test vector does not

&#x20;   encode it.



&#x20;   Resolution: add created\_by to §25.11.3 as a required payload

&#x20;   field, with a new type code (0x5006 is the next free number in

&#x20;   that block), and update the V6 vector accordingly.



&#x20;   HARD BLOCKER for any implementation of COMMUNICATION\_LOGGED

&#x20;   that depends on created\_by being present, which includes the

&#x20;   send flow in Section 8.



A3. LOCAL-TABLES.md amendment — connector local record and

&#x20;   compliance rules record.

&#x20;   Section 6.3 defines a local table for the connector's

&#x20;   credential, configuration, and enablement metadata. Section

&#x20;   10.3 defines a local table for the compliance rules. Section

&#x20;   6.4 references the cache/UI distinction.



&#x20;   The amendment adds two new local tables and their indexes. The

&#x20;   cache is the same record as Section 6.3's connector record,

&#x20;   viewed from two angles; it is not a third table. The amendment

&#x20;   is additive; no existing table is changed.



&#x20;   BLOCKER for implementation of Sections 6 and 10.



A4. CLOUD-TABLES.md verification — the organization\_audit\_events

&#x20;   table.

&#x20;   Section 13.5 requires that the Zone 3 acknowledgment is

&#x20;   recorded in `organization\_audit\_events`. That table already

&#x20;   exists (CLOUD-TABLES.md Category 4.4). The verification, if

&#x20;   any, is only to confirm that the table's columns support the

&#x20;   ZONE\_3\_CONNECTION\_ACKNOWLEDGED event type. If they do, no

&#x20;   amendment is needed.



&#x20;   BLOCKER for the Zone 3 audit record (Section 13.5).



14.2 Implementation-phase tasks — Client Dashboard code



The following are code changes to the existing Client Dashboard.

They are not design changes. The connector model is the design.



B1. Fix the Connectors.tsx page's endpoints.

&#x20;   Section 4.10 documents the current page's calls to non-existent

&#x20;   endpoints (`/connectors/types`, `/:id/connect`, `/:id/connect-

&#x20;   auto`, `/:id/test`, `/:id/disconnect`). The intended shape is

&#x20;   documented in Section 4.10. The fix is to align the page with

&#x20;   the intended shape.



B2. Remove the import.meta.env.VITE\_\* reads from

&#x20;   ConfigurationModal.tsx.

&#x20;   Section 1.5's D3 item. Verify on disk which VITE\_\* variables

&#x20;   are read, whether any .env file in the repo or on the build

&#x20;   machine sets them, and then remove the reads. Replace with the

&#x20;   D1 credential flow (local Tauri command, not a cloud call).



B3. Replace the Tier 2 credential submission path.

&#x20;   Section 4.6 documents the current ConfigurationModal's cloud

&#x20;   POST to `/connectors/:id/connect`. That is a boundary

&#x20;   violation. Replace with a local Tauri command that writes the

&#x20;   credential to the local SQLCipher database, then call POST

&#x20;   `/api/connectors/enable` with credentialsLocation = LOCAL and

&#x20;   no credential in the body.



B4. Wire the Zone 3 acknowledgment record.

&#x20;   Section 13.5 defines the write. The existing DeclarationModal's

&#x20;   onAccept handler must trigger the write before the enable call.



B5. Add the "Local compliance rules" configuration page.

&#x20;   AGENT-APP-SPEC.md Section 10.3 names the page; Section 10.7 of

&#x20;   this document references it. The MVP's local rules record

&#x20;   (Section 10.3) is populated by this page.



B6. Display "rules last configured at" on each device.

&#x20;   Section 10.10. The Client Dashboard's configuration page shows

&#x20;   the local rules record's updated\_at, so the admin sees which

&#x20;   device's rules may be stale.



B7. Build the Tier 1 credential transit verification.

&#x20;   Section 4.5's implementation-phase verification. Before the

&#x20;   Tier 1 enable flow ships, review the backend's request logging,

&#x20;   error logging, tracing/APM, exception serialization, and

&#x20;   response/error handling to confirm that the credential that

&#x20;   transits through the backend's process memory is not persisted,

&#x20;   logged, traced, or serialized anywhere.



14.3 Implementation-phase tasks — Agent App code



C1. Register the send command.

&#x20;   Section 8's flow, registered in the Agent binary. Thin wrapper

&#x20;   around gorka-shared's connector module.



C2. Register the test-connection command.

&#x20;   Section 4.10 references it. The Client binary registers it.



C3. Build the Copilot command.

&#x20;   Section 12.4's flow. The Agent binary registers it. The

&#x20;   Copilot command runs the AI boundary layer before constructing

&#x20;   the SendRequest.



C4. Structural enforcement of the boundary layer path.

&#x20;   Section 12.4. A test asserts that the Copilot command cannot

&#x20;   construct a Gemini adapter without the boundary layer having

&#x20;   run.



C5. The credential-leak regression test for every adapter.

&#x20;   Section 7.8. Written before the adapter's other tests.



C6. The registry invariant test.

&#x20;   Section 7.4. A test constructs the registry, performs a send,

&#x20;   and inspects the registry's contents to confirm it holds

&#x20;   factories only.



C7. Verify the /api/connector-usage/sync route's organizationId

&#x20;   source.

&#x20;   Section 11.6. If the route reads organizationId from the body,

&#x20;   amend it to read from the JWT.



14.4 Funded-phase items



The following are deferred from the MVP by conscious decision. They

are recorded so that no future session mistakes their absence for

an oversight.



D1.  Credential fingerprints and versions in Zone 1.

&#x20;    Section 3.6. Deferred. If added, the HMAC-keyed approach is

&#x20;    preferred, with the key held by the admin's device.



D2.  Organization-wide compliance policy synchronization.

&#x20;    Section 10.2.1's Option B. A new COMPLIANCE\_RULES\_UPDATED

&#x20;    event.



D3.  Per-channel disclosure text. Section 10.8.



D4.  Per-channel contact limits. Section 10.6.



D5.  Scheduled sends honoring the SCHEDULE quiet-hours action.

&#x20;    Section 10.5.



D6.  Opt-in restoration beyond the admin-edits-the-record MVP

&#x20;    path. Section 10.7.



D7.  Voice connector. Sections 8.6.1 and 11.2. The voice unit

&#x20;    question (calls vs minutes) is deferred until voice is

&#x20;    designed.



D8.  Weekly or daily usage-reporting periodicity. Section 11.5.



D9.  Frozen closed periods for usage reporting. Section 11.5.



D10. Background scheduler for usage reporting when the device is

&#x20;    offline at a period boundary. Section 11.5.



D11. AI usage in aggregates. Section 12.3. AI's usage vocabulary

&#x20;    (requests, tokens, model, cost) is different from the

&#x20;    messaging vocabulary and belongs in its own model.



D12. local\_ai\_history local table. Section 12.3. The MVP holds

&#x20;    AI responses in memory only.



D13. Delivery-status correlation event.

&#x20;    COMMUNICATION\_DELIVERY\_UPDATED or equivalent. Section 9.4.

&#x20;    A new narrow event that carries only the status field, never

&#x20;    the whole communications.data JSON.



D14. Message-queue-based retry on the client device.

&#x20;    Section 8.7. The MVP does not retry; the agent decides.



D15. Provider-side idempotency keys. Section 8.10.



D16. Multiple Tier 1 providers beyond Twilio and Resend.

&#x20;    Section 3.5. Each new provider adds a subsection to 3.5

&#x20;    before its provisioning code is written.



D17. Tier 1 for Mocean, pending confirmation of subaccount

&#x20;    support. Section 3.5.3.



D18. A reseller or partner arrangement for Gemini. Section 3.5.4.

&#x20;    If established, Gemini becomes Tier 1.



D19. "Remember this choice" for Zone 3 acknowledgments.

&#x20;    Section 13.5.



D20. Additional Zone 3 categories beyond external\_api, if the

&#x20;    funded phase adds any. Section 13.2. Each reuses the existing

&#x20;    declaration.



D21. Background report scheduling, cryptography specialist review,

&#x20;    threat model review, and the other items already listed in

&#x20;    SYNC-ARCHITECTURE.md Section 28.3.



14.5 Cross-document findings to resolve



E1. created\_by in COMMUNICATION\_LOGGED. See A2.

E2. The /api/connector-usage/sync route's organizationId source.

&#x20;   See C7.

E3. The existing DeclarationModal's audit record. See B4 and

&#x20;   Section 13.5.

E4. The existing ConfigurationModal's env-var reads. See B2.



14.6 What this section does not do



It does not prioritize. Priority is a work-planning decision, not a

specification decision.



It does not assign owners. The recovery's process assigns owners at

the start of each phase.



It does not close items that the document has already resolved. Only

items that are genuinely still open appear here.



It does not restate items from SYNC-ARCHITECTURE.md Section 28.3

that the connector model does not touch. Those remain in that

document's list. The exception is D21, which explicitly aggregates

them.



It does not amend any document. It records what the amendments

must say. The amendments are applied through their own processes.



========================================================================

END OF SECTION 14

========================================================================



========================================================================

END OF DOCUMENT

========================================================================









