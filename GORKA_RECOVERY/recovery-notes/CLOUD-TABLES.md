\# GORKA CLOUD TABLES



\*\*Version:\*\* 1.0

\*\*Date:\*\* September 11, 2026

\*\*Purpose:\*\* Freeze the list of cloud tables with the four-question

contract for each.

\*\*Authority:\*\* Derived from Architectural Law + Data Boundary Matrix.

If a new cloud table is proposed, it must answer the four questions

here before creation.



\---



\## The Permanent Rule



The cloud schema is not "these exact tables forever."



The permanent rule is:



> Cloud may contain GORKA customer/account information, authentication

> and authorization metadata, billing/subscription information,

> support information, GORKA operational metadata, aggregate

> portfolio statistics, client behavioral metrics, connector

> configuration metadata, connector usage/billing aggregates, and

> compliance/boundary evidence.



> Cloud may NOT contain individual debtor identity, debtor contact

> information, debtor addresses, individual debt records, individual

> payments, individual communications, individual documents,

> debtor-level actions, debtor-level assignments, debtor-level AI

> analysis, or any identifier that allows GORKA to reconstruct an

> individual debtor record.



The tables listed below are the \*\*current approved implementation\*\*

of that rule.



Future tables may be added if they answer the four questions and

comply with the rule.



\---



\## The Four Questions



Every cloud table must answer:



| Q | Question | Purpose |

|---|----------|---------|

| A | Why does it exist? | Justification |

| B | What exact data does it contain? | Field contract |

| C | Can it ever contain debtor-level information? | Boundary check |

| D | Who is allowed to write/read it? | Access control |



If any answer is unclear → the table is not created yet.



\---



\## Category 1 — Core



\### 1.1 organizations



| Q | Answer |

|---|--------|

| A | The customer/agency/bank that pays for GORKA |

| B | Business identity (name, clientType, website, registrationNumber, taxId, address); contact info (contactEmail, contactPhone, primaryContact); account status (verificationStatus); PII policy acknowledgment (piiPolicyAcceptedAt, piiPolicyVersion, piiPolicyAcceptedBy); timestamps |

| C | No. Contains only GORKA customer data. |

| D | Write: OWNER (create), CLIENT\_ADMIN of own org (update). Read: OWNER, own CLIENT\_ADMIN. |



Source: Migration spec v5.0 + Support spec v2.3 additions.



\---



\### 1.2 users



| Q | Answer |

|---|--------|

| A | People who log into GORKA products |

| B | Email, passwordHash, name, role (OWNER/CLIENT/AGENT), isActive, lastLogin, nullable organizationId, timestamps |

| C | No. Contains only user identity and auth metadata. |

| D | Write: OWNER (create), CLIENT\_ADMIN of own org (create AGENT/CLIENT users). Read: OWNER, own org users. |



Source: Migration spec v5.0, role enum simplified.



\---



\### 1.3 agents



| Q | Answer |

|---|--------|

| A | Agent identity metadata (for future Agent App) |

| B | organizationId, name, email, role, status, timestamps |

| C | No. Contains identity metadata only, no collection activity. |

| D | Write: CLIENT\_ADMIN of own org. Read: OWNER, own CLIENT\_ADMIN. |



Source: Migration spec v5.0 + Tauri spec v3.2 §9.



\---



\### 1.4 licenses



| Q | Answer |

|---|--------|

| A | Track GORKA customer subscriptions and billing status |

| B | organizationId, type, status, expiresAt, timestamps |

| C | No. Billing metadata only. |

| D | Write: OWNER only. Read: OWNER, own CLIENT\_ADMIN. |



Source: Migration spec v5.0.



\---



\### 1.5 platform\_settings



| Q | Answer |

|---|--------|

| A | Global GORKA configuration (key/value) |

| B | key, value (JSON), timestamps |

| C | No. Platform-level config, no customer or debtor data. |

| D | Write: OWNER only. Read: OWNER only. |



Source: Migration spec v5.0.



\---



\## Category 2 — Metrics



\### 2.1 aggregate\_metrics



| Q | Answer |

|---|--------|

| A | Snapshot of portfolio-level statistics per client (for business insight) |

| B | organizationId, debtorCount, totalDebt, agentCount, activeCaseCount, lastSyncedAt |

| C | No. Aggregate numbers only. Must never identify a single debtor. |

| D | Write: Tauri app via authenticated sync. Read: OWNER, own CLIENT\_ADMIN. |



Source: Master plan §2.



\---



\### 2.2 client\_activity\_metrics



| Q | Answer |

|---|--------|

| A | Behavioral time-series showing how each client uses the app (for analytics and business decisions) |

| B | organizationId, periodStart, periodEnd, uploadsCount, uploadBatchAvgSize, deletionsCount, actionsCreatedCount, messagesSentCount, activeUsersCount, daysActive, syncEventsCount |

| C | No. Counts and averages only. No per-debtor timeline, filename, or content. |

| D | Write: Tauri app via authenticated sync. Read: OWNER, own CLIENT\_ADMIN. |



Source: This session (Sep 11, 2026).



\---



\## Category 3 — Audit



\### 3.1 cloud\_audit\_logs



| Q | Answer |

|---|--------|

| A | Record customer/account-level actions inside GORKA cloud |

| B | userId, organizationId, action (e.g., "USER\_LOGIN", "ORG\_CREATED"), details (JSON, no debtor data), timestamp |

| C | No. Records "what happened" but never "to which debtor." |

| D | Write: backend (system). Read: OWNER, own CLIENT\_ADMIN. |



Source: Migration spec v5.0.



\---



\### 3.2 boundary\_proof\_logs



| Q | Answer |

|---|--------|

| A | Explicit proof-of-compliance entries for regulators and customers |

| B | organizationId, eventType (e.g., "METRICS\_SYNC", "CONNECTOR\_TOKEN\_ISSUED"), payloadSummary (JSON with counts only), debtorDataIncluded (always false), timestamp |

| C | No. Contains only proof that no debtor data was transmitted. |

| D | Write: backend (system). Read: OWNER, own CLIENT\_ADMIN. |



Source: This session (Sep 11, 2026).



\---



\## Category 4 — Support



\### 4.1 support\_tickets



| Q | Answer |

|---|--------|

| A | Client support requests to GORKA |

| B | ticketNumber (atomic), organizationId, subject, message, category, priority, status, source, openedBy, openedByEmail, openedByName, assignedTo, assignedBy, assignedAt, previousAssignee, escalatedAt, escalatedBy, escalationReason, firstRespondedAt, resolvedAt, closedAt, resolvedBy, closedBy, mergedIntoId, mergedAt, isDeleted, deletedAt, deletedBy, timestamps |

| C | \*\*Potential violation\*\* — client may paste debtor info into message. Mitigation: UI warning + confirmation required (per Support spec v2.3 §6). |

| D | Write: CLIENT\_ADMIN of own org, AGENT (assigned), OWNER (manage). Read: per Support spec v2.3 permission matrix. |



Source: Support spec v2.3.



\---



\### 4.2 support\_ticket\_replies



| Q | Answer |

|---|--------|

| A | Threaded replies within a ticket |

| B | ticketId, message, isInternal, sentBy, sentByName, timestamp |

| C | Same as support\_tickets — mitigated by UI warning and confirmation. |

| D | Per Support spec v2.3 §5.4. Clients never see internal notes. |



Source: Support spec v2.3.



\---



\### 4.3 support\_ticket\_events



| Q | Answer |

|---|--------|

| A | Append-only audit trail of ticket actions |

| B | ticketId, eventType, actorId, actorName, oldValue (JSON), newValue (JSON), metadata (JSON), timestamp |

| C | No debtor data (audit metadata only). |

| D | Write: backend (system, insert-only). Read: OWNER, own CLIENT\_ADMIN (with internal filtering per spec). |



Source: Support spec v2.3.



\---



\### 4.4 organization\_audit\_events



| Q | Answer |

|---|--------|

| A | Org-level append-only audit (e.g., PII\_POLICY\_ACCEPTED) |

| B | organizationId, eventType, actorId, actorName, details (JSON), timestamp |

| C | No debtor data. |

| D | Write: backend (system, insert-only). Read: OWNER, own CLIENT\_ADMIN. |



Source: Support spec v2.3.



\---



\### 4.5 notifications



| Q | Answer |

|---|--------|

| A | In-app and email notifications for users |

| B | userId, type, message, read, link, ticketId, deliveryStatus, emailSentAt, emailError, attemptCount, lastError, timestamp |

| C | No debtor data. |

| D | Write: backend (system). Read: own user only. |



Source: Support spec v2.3.



\---



\### 4.6 ticket\_counter



| Q | Answer |

|---|--------|

| A | Atomic sequence generator for human-readable ticket numbers (GORKA-000123) |

| B | id (always "default"), lastNumber |

| C | No debtor data. |

| D | Write: backend (system). Read: backend (system). |



Source: Support spec v2.3.



\---



\## Category 5 — Templates



\### 5.1 templates



| Q | Answer |

|---|--------|

| A | Message templates owned by GORKA (defaults) or by clients (custom) |

| B | name, subject, content (parameterized), channel, type, description, variables (array), status, organizationId (null for GORKA defaults), timestamps |

| C | \*\*Allowed only if parameterized.\*\* Rendered messages with debtor data are forbidden. UI/API must reject templates containing debtor-specific content. |

| D | Write: OWNER (defaults), CLIENT\_ADMIN of own org (custom). Read: OWNER, all clients (defaults), own org (custom). |



Source: Existing table + this session's clarification.



\---



\## Category 6 — Connectors



\### 6.1 connector\_catalog



| Q | Answer |

|---|--------|

| A | GORKA's product catalog of available connectors |

| B | code, name, description, category, provider, isManagedByGorka, isActive, lifecycleStatus, pricingModel, pricingConfig (JSON), iconUrl, documentationUrl, timestamps |

| C | No. Product catalog only. |

| D | Write: OWNER only. Read: OWNER, all clients. |



Source: Connector addendum.



\---



\### 6.2 client\_connectors



| Q | Answer |

|---|--------|

| A | Which client enabled which connector |

| B | organizationId, connectorCode, status, credentialsLocation (CLOUD/LOCAL), credentialsEncrypted (null for GORKA-managed), connectedAt, disconnectedAt, suspendedReason, timestamps |

| C | No. Contains enablement metadata only. BYO credentials stored locally. |

| D | Write: CLIENT\_ADMIN of own org. Read: OWNER, own CLIENT\_ADMIN. |



Source: Connector addendum.



\---



\### 6.3 connector\_usage



| Q | Answer |

|---|--------|

| A | Usage records for billing (per client, per connector, per period) |

| B | organizationId, connectorCode, periodStart, periodEnd, usageCount, usageUnit, unitPrice, pricingVersion, billableAmount, currency, syncSource, reportedAt |

| C | No. Aggregate counts only. No per-debtor usage records. |

| D | Write: Tauri app via authenticated sync. Read: OWNER, own CLIENT\_ADMIN. |



Source: Connector addendum.



\---



\## Summary Table



| # | Table | Category |

|---|-------|----------|

| 1 | organizations | Core |

| 2 | users | Core |

| 3 | agents | Core |

| 4 | licenses | Core |

| 5 | platform\_settings | Core |

| 6 | aggregate\_metrics | Metrics |

| 7 | client\_activity\_metrics | Metrics |

| 8 | cloud\_audit\_logs | Audit |

| 9 | boundary\_proof\_logs | Audit |

| 10 | support\_tickets | Support |

| 11 | support\_ticket\_replies | Support |

| 12 | support\_ticket\_events | Support |

| 13 | organization\_audit\_events | Support |

| 14 | notifications | Support |

| 15 | ticket\_counter | Support |

| 16 | templates | Templates |

| 17 | connector\_catalog | Connectors |

| 18 | client\_connectors | Connectors |

| 19 | connector\_usage | Connectors |



\*\*Total: 19 tables.\*\*



\---



\## What This Document Does Not Do



\- It does not define every column, type, or constraint. That lives

&#x20; in `schema.cloud.prisma`.

\- It does not freeze the schema forever. Future tables may be added

&#x20; if they answer the four questions and comply with the rule.

\- It does not replace the Architectural Law or the Data Boundary

&#x20; Matrix. It extends them for the cloud side.



\---



\## What Happens Next



When `schema.cloud.prisma` is written (Phase 3), every model in it

must match a table here.



When a new cloud table is proposed (later), it must be added to this

document first.



This document is reviewed whenever:



\- A new cloud table is designed

\- An existing table's purpose changes

\- A boundary question arises


---

## 20. Multi-User Control Plane Tables (v1.2)

**Added:** September 17, 2026.
**Authority:** `ARCHITECTURAL-LAW.md` v1.2, Section 20.
**Context:** The multi-user concept (`MULTI-USER-CONCEPT.md`) introduces Control Plane services — device registration, presence, discovery, encrypted relay coordination — that did not exist when the original 19 tables were frozen. Two new tables are needed.

The four-question contract is filled in for each, as required by this document.

The existing 19 tables are unchanged. The existing rules of this document still apply.

### 20.1 device_registrations

**Category:** Control Plane

| Q | Answer |
|---|--------|
| A | Records which client-owned devices are authorized to participate in the multi-user sync model for a given organization |
| B | id, organization_id, user_id, device_name (human-readable label), device_public_key (or device identity material), registered_at, last_seen_at, is_authorized, revoked_at, revoked_by, device_type (desktop/agent), device_platform (windows/macos/linux), metadata (JSON, non-debtor) |
| C | No. Contains only device and user identity metadata. Never debtor data. Never any identifier that maps to an individual debtor. |
| D | Write: authenticated CLIENT user of the organization (register own device), OWNER (any device). Read: OWNER (all), own CLIENT admin (devices within the organization). |

**Purpose:** The Control Plane's authoritative record of which devices belong to which organization. Supports the discovery, presence, and encrypted relay coordination services. Enables the Owner Dashboard and the Client Dashboard to show the list of authorized devices.

**What it does NOT contain:**

- Debtor names, contacts, addresses, or any identifier that maps to an individual debtor.
- Encrypted sync payloads.
- Decryption keys.
- Any key material that could be used to decrypt sync traffic. The `device_public_key` field, if present, is a public key only. Private keys never leave the device.

**Note on MVP vs. production:** In the MVP, device identity is user-account-based (`MULTI-USER-CONCEPT.md` §5). This table records devices for presence, discovery, and the device list UI. In the production phase, this table becomes the foundation for per-device identity and revocation.

**Source:** `MULTI-USER-CONCEPT.md` §4, §5, §9.

### 20.2 relay_sessions

**Category:** Control Plane

| Q | Answer |
|---|--------|
| A | Tracks active encrypted relay sessions between client devices when a direct device-to-device connection is not possible |
| B | id, organization_id, device_a_id, device_b_id, started_at, ended_at, bytes_transferred, session_status (ACTIVE/ENDED/FAILED), close_reason, metadata (JSON, non-debtor) |
| C | No. Contains only session metadata. Never sees or stores the content of the encrypted traffic. The relay passes ciphertext it cannot decrypt. |
| D | Write: backend (system, automatic on session start/end). Read: OWNER (all), own CLIENT admin (own organization). |

**Purpose:** Operational record of relay sessions. Used for capacity planning, abuse detection, and troubleshooting. This is metadata about *that* a relay was used, *between which devices*, *for how long*, and *how many bytes*. It is never the content of the traffic.

**What it does NOT contain:**

- The content of the encrypted traffic. The relay cannot decrypt it and never stores it.
- Any key material.
- Any debtor data, in any form.

**Session lifecycle:** A row is created when a relay session begins, updated as the session proceeds (bytes transferred, status), and closed when the session ends. Sessions are short-lived. Completed sessions can be retained for a configurable period (for operational analysis) and then purged.

**Persistence rule:** The relay must not store the content of the traffic at any time, not in memory beyond what is required to forward it, not on disk, not in any log. This is architectural. It is stated in `ARCHITECTURAL-LAW.md` v1.2 §20.3.

**What to be honest about with clients:** The relay sees *that* two devices communicated, *when*, and *how much*. It does not see *what* was communicated. This is stated in `DATA-BOUNDARY-MATRIX.md` v1.2 §20.2. The compliance documentation must state it plainly.

**Source:** `MULTI-USER-CONCEPT.md` §3; `ARCHITECTURAL-LAW.md` v1.2 §20.3; `DATA-BOUNDARY-MATRIX.md` v1.2 §20.2.

### 20.3 What These Tables Do Not Permit

The two new tables do not change any existing rule. They do not:

- Permit debtor data in the Control Plane.
- Permit GORKA to hold decryption keys.
- Permit the relay to inspect, log, or store traffic content.
- Permit the Control Plane to reconstruct debtor data from connection metadata.
- Weaken the invariant in Section 1 of the Architectural Law.
- Weaken the Critical Boundary Rules of the Data Boundary Matrix.

### 20.4 Updated Count

Before this amendment: **19 cloud tables.**

After this amendment: **21 cloud tables.**

The 19 original tables are unchanged. Two new tables are added:

- `device_registrations` — Control Plane device list
- `relay_sessions` — Control Plane relay session metadata

### 20.5 The Proof Test, Extended

The existing proof test (Section 9 of the Architectural Law) is unchanged. The multi-user case adds one test, already stated in `DATA-BOUNDARY-MATRIX.md` v1.2 §20.5:

> Run two client devices, synchronize a debtor record between them through the relay, capture all traffic on GORKA's infrastructure, and inspect every stored row in `device_registrations` and `relay_sessions`.

**Expected result:**

- The two tables contain only device and session metadata. No debtor data.
- The relay stored no copy of the encrypted payloads.
- No decryption key material is present anywhere in the Control Plane.

If readable debtor data appears in either table, or if any relay session has persisted payload content, the architecture is broken.

---

**End of v1.2 additions.**







