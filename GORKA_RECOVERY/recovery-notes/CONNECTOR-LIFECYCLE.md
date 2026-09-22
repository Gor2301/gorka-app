\# GORKA CONNECTOR LIFECYCLE



Version: 1.0 (draft)

Date: September 13, 2026

Phase: 13 — Connector Architecture Feasibility

Status: DRAFT — awaiting founder review



Purpose: Define the permanent rule and process for how connectors

are assessed, added, replaced, and retired in GORKA. Apply the

rule to the four prototype connectors currently under consideration

(Twilio, Resend, Mocean, Gemini). Establish that connector

reassessment is permanent, not one-off.



Authority: Architectural Law §16 (Connector Data Categories),

Data Boundary Matrix §14 (Connector Data), Recovery Rule 8 (do not

assume an external provider supports GORKA-issued temporary

credentials), Recovery Rule 13 (do not start connector work while

Phases 3-12 are unstable).



============================================================

1\. SCOPE AND PHILOSOPHY

============================================================



Connectors are not permanent fixtures. Providers change their

terms, pricing, and technical capabilities over time. What works

at prototype stage may not work at launch. What works at launch

may not work at enterprise. Providers may be replaced.



Therefore:



\- Connectors are integrated to solve a current need, at a current

&#x20; stage, under current provider terms.

\- Every connector is re-assessed whenever circumstances change:

&#x20; at launch, at enterprise transition, and on any provider-side

&#x20; change that could affect the boundary.

\- A connector that no longer satisfies GORKA's conditions is

&#x20; deprecated and replaced. This is a normal operation, not a

&#x20; failure.

\- The mechanism for adding, replacing, and retiring connectors

&#x20; must be simple, reliable, and require minimal code change.



This document defines the rule and the process. It is permanent.

The specific providers listed in Section 5 are current, not

permanent.



============================================================

2\. THE TWO TIERS OF CONNECTOR

============================================================



GORKA recognizes two categories of connector:



Tier 1 — GORKA-Managed Connector (built-in).



&#x20; GORKA integrates with the provider under GORKA's account.

&#x20; GORKA issues per-client credentials or sub-accounts so that

&#x20; usage is attributable per client.

&#x20; GORKA pays the provider. GORKA charges the client per period.

&#x20; GORKA's cloud receives usage metadata (counts, timestamps,

&#x20; per-period totals) — never debtor-level content.



Tier 2 — Client BYO Connector.



&#x20; The client connects their own provider account directly.

&#x20; GORKA's cloud receives only the enablement flag

&#x20; (which connector, enabled yes/no, credentials\_location = LOCAL).

&#x20; GORKA does not see usage, does not pay, does not charge.

&#x20; The client is solely responsible for their relationship with

&#x20; the provider.



A given connector may be offered in both tiers, at the client's

choice. The client selects the tier when enabling the connector.



============================================================

3\. THE RULE — CONDITIONS FOR A GORKA-MANAGED CONNECTOR

============================================================



A provider may be integrated as a Tier 1 (GORKA-managed) connector

only if ALL of the following hold:



Condition 1 — Per-client attribution.

&#x20; The provider must permit GORKA to create per-client credentials,

&#x20; sub-accounts, or projects, such that usage is attributable per

&#x20; client without GORKA seeing message content.



Condition 2 — Direct content path.

&#x20; The content of any transaction (message body, email body, AI

&#x20; prompt, AI response) must flow client → provider directly, not

&#x20; client → GORKA → provider. GORKA cloud must never be a relay

&#x20; for content.



Condition 3 — Usage reporting for reconciliation.

&#x20; The provider must offer a usage-reporting mechanism that GORKA

&#x20; can query per client, per period, for billing reconciliation.



Condition 4 — No debtor content in GORKA cloud.

&#x20; The provider's integration must not require GORKA cloud to

&#x20; receive or store debtor-level content or identifiers: no phone

&#x20; numbers, no email addresses, no message bodies, no names, no

&#x20; individual records.



Condition 5 — Terms permit intermediary billing.

&#x20; The provider's terms of service must permit GORKA to act as the

&#x20; billing intermediary between the client and the provider.



Condition 6 — Disclaimer coverage.

&#x20; The client-facing connector page must include a reminder that

&#x20; for Tier 2 (BYO) connectors, GORKA is not responsible for the

&#x20; provider's handling of data. (Disclosure page already exists in

&#x20; the client dashboard. Content is a standard reminder; no

&#x20; special text is required.)



If any condition fails, the connector is offered only as Tier 2

(BYO) — or not at all.



============================================================

4\. THE PROCESS — ADD, REPLACE, RETIRE

============================================================



\## Adding a connector



1\. Assess the provider against all six conditions in Section 3.

2\. Record the assessment. Result: Tier 1, Tier 2 only, or rejected.

3\. Add a row to `connector\_catalog`:

&#x20;    code, name, category, provider, isManagedByGorka,

&#x20;    lifecycleStatus = 'ACTIVE', pricingModel, pricingConfig.

4\. If the connector fits an existing category and provider SDK, no

&#x20;  code change is required beyond the catalog row.

5\. If the connector requires a new category or SDK, add a code

&#x20;  adapter (the one place code changes).

6\. Publish to clients. Clients enable or ignore.



\## Replacing a connector



Triggered when a provider no longer meets the conditions.



1\. Mark `connector\_catalog.lifecycleStatus = 'DEPRECATED'`.

2\. Block new enablements for that connector.

3\. Preserve existing `client\_connectors` rows as historical record.

4\. Notify affected clients (through existing notification system).

5\. Add the replacement connector via the Adding process.

6\. After a grace period, mark `lifecycleStatus = 'RETIRED'`.



\## Retiring a connector



1\. Mark `connector\_catalog.lifecycleStatus = 'RETIRED'`.

2\. Disable new enablement.

3\. Preserve historical `connector\_usage` rows for billing

&#x20;  integrity — they reference the catalog row by code.

4\. Do not delete the catalog row. Historical records depend on it.



============================================================

5\. CURRENT PROTOTYPE ASSESSMENT

============================================================



The four connectors currently under consideration are Twilio,

Resend, Mocean, and Gemini. They are assessed at prototype depth.

Full assessment will be repeated at launch and again at

enterprise transition.



Each entry lists: what is known, what is unknown, and current

status.



\## Twilio



What is known:

\- Supports subaccounts. Per-client attribution is achievable.

\- Access Tokens (JWTs) permit client-side direct calls without

&#x20; GORKA seeing content.

\- Usage Records API allows per-subaccount querying for billing.

\- Free tier available for prototype.



What is unknown:

\- Enterprise pricing terms for GORKA's aggregate volume.

\- Whether the client will accept a GORKA-issued Access Token

&#x20; versus their own Twilio subaccount.



Current status: Feasible for both tiers at prototype.

Re-assess at launch.



\## Resend



What is known:

\- Static API key model. Per-key scoping with domain restriction.

\- Free tier available for prototype.

\- Whether per-key usage attribution is sufficient for billing

&#x20; needs is not yet confirmed.



What is unknown:

\- Whether GORKA can create one key per client and reliably

&#x20; attribute usage per key from Resend's reporting.

\- Whether enterprise terms permit intermediary billing.



Current status: Feasible for Tier 2 (BYO) at prototype.

Tier 1 feasibility depends on per-key attribution confirmation.

Re-assess at launch.



\## Mocean



What is known:

\- Static API token model.

\- Free tier available for prototype.



What is unknown:

\- Whether Mocean offers sub-accounts or per-key attribution.

\- Whether enterprise terms permit intermediary billing.



Current status: Feasible for Tier 2 (BYO) at prototype.

Tier 1 feasibility not yet confirmed.

Re-assess at launch.



\## Gemini



What is known:

\- Two paths: Google AI Studio (static API key) and Vertex AI

&#x20; (GCP service accounts, OAuth tokens, per-project attribution).

\- Vertex AI's per-project model supports Tier 1 cleanly.

\- Free tier available through AI Studio for prototype.



What is unknown:

\- Whether the client will accept a GCP project under GORKA's

&#x20; control (Vertex) or prefer their own Google account (BYO).

\- Cost model for enterprise volume.



Current status: Feasible for Tier 1 via Vertex AI.

Feasible for Tier 2 via AI Studio API key.

Re-assess at launch.



============================================================

6\. HOW THE SCHEMA SUPPORTS THIS

============================================================



The cloud schema already contains the fields required for the

process above. No schema change is introduced by this document.



connector\_catalog:

\- code              — stable identifier.

\- isManagedByGorka  — distinguishes Tier 1 (true) from catalog-only

&#x20;                     entries.

\- lifecycleStatus   — ACTIVE / DEPRECATED / RETIRED.

\- isActive          — quick on/off toggle without retiring.

\- pricingModel      — e.g., PASS\_THROUGH, MARKUP, INCLUDED.

\- pricingConfig     — JSON for per-connector pricing rules.



client\_connectors:

\- organizationId    — which client enabled.

\- connectorCode     — which catalog entry.

\- status            — CONNECTED / DISCONNECTED.

\- credentialsLocation — CLOUD (Tier 1) or LOCAL (Tier 2).

\- credentialsEncrypted — present only for Tier 1 CLOUD; null for

&#x20;                        Tier 2 (BYO credentials never leave the

&#x20;                        client machine).



connector\_usage:

\- organizationId    — per-client.

\- connectorCode     — per-connector.

\- periodStart/End   — reconciliation window.

\- usageCount        — number of operations.

\- usageUnit         — e.g., SMS, EMAIL, TOKEN.

\- unitPrice         — frozen at time of usage.

\- pricingVersion    — frozen at time of usage.

\- billableAmount    — usageCount \* unitPrice.

\- syncSource        — for audit.



These fields are already defined in schema.cloud.prisma. The

lifecycle process does not require schema change.



============================================================

7\. CLIENT DISCLAIMER

============================================================



A disclosure reminder exists in the client dashboard's connector

page. It states that for client BYO (Tier 2) connectors, GORKA is

not responsible for how the provider stores or processes data.



This document references the disclaimer but does not define its

text. The text is the responsibility of the client dashboard

implementation.



============================================================

8\. WHAT THIS DOCUMENT DOES NOT DO

============================================================



\- It does not implement any connector.

\- It does not commit to specific providers as permanent.

\- It does not define pricing amounts or enterprise contracts.

\- It does not modify the cloud schema.

\- It does not modify the backend or frontend code.

\- It does not replace the Architectural Law or the Data Boundary

&#x20; Matrix. It extends them for the connector domain.



============================================================

9\. RE-ASSESSMENT SCHEDULE

============================================================



Connectors are re-assessed:



\- Before launch (Phase 16/17 window).

\- At enterprise transition.

\- On any provider-side change that could affect the boundary

&#x20; (terms, pricing, auth model, sub-account support).

\- On any GORKA-side change that alters the connector tier model.



Re-assessment uses the six conditions in Section 3. The outcome

is recorded in DECISIONS.md.



============================================================

END OF DOCUMENT

============================================================

