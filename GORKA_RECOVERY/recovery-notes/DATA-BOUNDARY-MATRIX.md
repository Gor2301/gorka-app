\# GORKA DATA BOUNDARY MATRIX



\*\*Version:\*\* 1.0

\*\*Date:\*\* September 11, 2026

\*\*Purpose:\*\* For every kind of data in GORKA, declare where it may live.

\*\*Authority:\*\* This matrix is derived from the Architectural Law.

If a new data type appears, it must be added here before it is stored

anywhere.



\---



\## How to Read This Matrix



| Column | Meaning |

|--------|---------|

| Data type | What kind of information this is |

| Cloud | May it be stored in GORKA cloud (Supabase)? |

| Local | May it be stored in the Tauri client's local SQLite? |

| Notes | Constraint, caveat, or explanation |



Legend:

&#x20; ✅ = allowed

&#x20; ❌ = forbidden

&#x20; ⚪ = optional (either place is acceptable)

&#x20; ⚠️ = allowed with specific conditions



\---



\## 1. GORKA Customer Data



Information about the agency, bank, or collection company that pays

for GORKA.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Organization name | ✅ | ⚪ | Customer metadata |

| Organization client type (AGENCY/BANK/etc.) | ✅ | ⚪ | Classification |

| Organization business address | ✅ | ⚪ | Customer metadata |

| Organization website | ✅ | ⚪ | Customer metadata |

| Organization registration number | ✅ | ⚪ | Business identifier |

| Organization tax ID | ✅ | ⚪ | Business identifier |

| Organization primary contact person name | ✅ | ⚪ | May be personal data — handle per privacy law |

| Organization contact email | ✅ | ⚪ | May be personal data |

| Organization contact phone | ✅ | ⚪ | May be personal data |

| Organization billing email | ✅ | ❌ | GORKA-side billing |

| Organization verification status | ✅ | ⚪ | Account state |

| Organization PII policy acceptance | ✅ | ❌ | Compliance record |

| Organization PII policy version | ✅ | ❌ | Compliance record |

| Organization created\_at / updated\_at | ✅ | ⚪ | Metadata |



\---



\## 2. User and Authentication Data



Information about people who log into GORKA products.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| User email | ✅ | ⚪ | Authentication |

| User password hash | ✅ | ❌ | bcrypt in cloud |

| User name | ✅ | ⚪ | Display |

| User role (OWNER/CLIENT/AGENT) | ✅ | ⚪ | Authorization |

| User isActive flag | ✅ | ❌ | Account status |

| User lastLogin timestamp | ✅ | ⚪ | Session metadata |

| User organization\_id | ✅ | ⚪ | Tenant association |

| JWT session token | ❌ | ✅ | Never stored in cloud; Tauri keychain only |

| Local database encryption password | ❌ | ✅ | Never leaves client machine |



\---



\## 3. Debtor Data (Regulated — Local Only)



Information about individual debtors. \*\*This is the data the

architectural invariant protects.\*\*



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Debtor name | ❌ | ✅ | NEVER cloud |

| Debtor surname | ❌ | ✅ | NEVER cloud |

| Debtor phone number | ❌ | ✅ | NEVER cloud |

| Debtor email address | ❌ | ✅ | NEVER cloud |

| Debtor physical address | ❌ | ✅ | NEVER cloud |

| Debtor government ID | ❌ | ✅ | NEVER cloud |

| Debtor internal ID (any identifier mapping to one person) | ❌ | ✅ | NEVER cloud |

| Debtor identification document | ❌ | ✅ | NEVER cloud |

| Debtor photo | ❌ | ✅ | NEVER cloud |

| Debtor date of birth | ❌ | ✅ | NEVER cloud |

| Debtor employment info | ❌ | ✅ | NEVER cloud |

| Debtor collateral info | ❌ | ✅ | NEVER cloud |

| Debtor guarantor info | ❌ | ✅ | NEVER cloud |

| Debtor risk score | ❌ | ✅ | NEVER cloud |

| Debtor notes | ❌ | ✅ | NEVER cloud |



\---



\## 4. Debt Data (Regulated — Local Only)



Individual debt records.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Individual debt amount | ❌ | ✅ | NEVER cloud |

| Individual debt currency | ❌ | ✅ | NEVER cloud |

| Individual debt due date | ❌ | ✅ | NEVER cloud |

| Individual debt status | ❌ | ✅ | NEVER cloud |

| Individual payment record | ❌ | ✅ | NEVER cloud |

| Individual payment history | ❌ | ✅ | NEVER cloud |



\---



\## 5. Communication Data (Regulated — Local Only)



Communications with debtors.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Message content (SMS/email body) | ❌ | ✅ | NEVER cloud |

| Email subject | ❌ | ✅ | NEVER cloud |

| Call recording | ❌ | ✅ | NEVER cloud |

| Call notes | ❌ | ✅ | NEVER cloud |

| Communication timestamp per debtor | ❌ | ✅ | NEVER cloud |

| Delivery status per debtor | ❌ | ✅ | NEVER cloud |



\---



\## 6. Document Data (Regulated — Local Only)



Documents uploaded by the agency about debtors.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Document content | ❌ | ✅ | NEVER cloud |

| Document filename | ❌ | ✅ | NEVER cloud |

| Document metadata (size, type) | ❌ | ✅ | Keep with content |

| Document upload timestamp per debtor | ❌ | ✅ | NEVER cloud |



\---



\## 7. Action Data (Regulated — Local Only)



Collection actions assigned to debtors.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Individual action content | ❌ | ✅ | NEVER cloud |

| Individual action due date | ❌ | ✅ | NEVER cloud |

| Individual action assigned agent | ❌ | ✅ | NEVER cloud |

| Individual action status | ❌ | ✅ | NEVER cloud |



\---



\## 8. AI Analysis Data (Regulated — Local Only)



AI processing of debtor-related content.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| AI prompt containing debtor info | ❌ | ✅ | NEVER cloud |

| AI response about a debtor | ❌ | ✅ | NEVER cloud |

| AI recommendation about a case | ❌ | ✅ | NEVER cloud |

| AI outcome for a debtor | ❌ | ✅ | NEVER cloud |

| AI feedback on a case | ❌ | ✅ | NEVER cloud |



\---



\## 9. Aggregate Metrics (Cloud Allowed)



Aggregate statistics that describe the portfolio without identifying

any debtor.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Number of debtors (count) | ✅ | ✅ | Aggregate only |

| Total debt amount (sum) | ✅ | ✅ | Aggregate only |

| Number of agents | ✅ | ✅ | Aggregate only |

| Number of active cases | ✅ | ✅ | Aggregate only |

| Average case value | ✅ | ✅ | Aggregate only |

| Last sync timestamp | ✅ | ✅ | Metadata |



\*\*Forbidden even in aggregate:\*\* any value that identifies a single

debtor or is derived from a small enough set that it could be traced

back to an individual.



Example:

&#x20; ✅ "1,845 debtors" — allowed

&#x20; ❌ "1 debtor in Barangay X with ₱7,500" — not allowed (single

&#x20;    record can be reconstructed)



\---



\## 10. Client Behavioral Activity Metrics (Cloud Allowed)



How the client uses the application. Not what's in the data.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Upload operations count (per period) | ✅ | ✅ | Client activity |

| Average upload batch size | ✅ | ✅ | Client activity |

| Delete operations count | ✅ | ✅ | Client activity |

| Actions created per period | ✅ | ✅ | Client activity |

| Messages sent per period (count) | ✅ | ✅ | Client activity |

| Active users count | ✅ | ✅ | Client activity |

| Days active | ✅ | ✅ | Client activity |

| Sync events count | ✅ | ✅ | Client activity |

| Last activity timestamp | ✅ | ✅ | Metadata |

| Average case turnaround (aggregate) | ✅ | ✅ | Aggregate only |



\*\*Forbidden:\*\* any per-debtor timeline, filename, or content.



Example:

&#x20; ✅ "8 uploads this month, average 450 records" — allowed

&#x20; ❌ "Upload of file debtors\_2026-09-11.csv, records 1-500" —

&#x20;    not allowed



\---



\## 11. Templates (Cloud Allowed With Conditions)



Message templates used by the agency.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Parameterized template ({{debtor\_name}}) | ✅ | ✅ | No debtor data |

| GORKA-provided default template | ✅ | ✅ | Customer content |

| Client-customized template (parameterized) | ✅ | ✅ | Customer content |

| Rendered/personalized message | ❌ | ✅ | Debtor-level |

| Template sent history | ❌ | ✅ | Debtor-level |



Rule:

&#x20; Parameterized templates may be stored in cloud.

&#x20; Rendered/personalized communications containing debtor data must

&#x20; remain local.



\---



\## 12. Support System Data (Cloud Allowed With Conditions)



Support tickets between client and GORKA.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Ticket subject | ✅ | ❌ | Must contain no debtor PII |

| Ticket message | ✅ | ❌ | Must contain no debtor PII |

| Ticket replies | ✅ | ❌ | Must contain no debtor PII |

| Ticket internal notes | ✅ | ❌ | GORKA-internal |

| Ticket audit events | ✅ | ❌ | Append-only |

| Notification content | ✅ | ❌ | Metadata |



\*\*Critical:\*\* UI must warn users and require confirmation before

sending support content. Support is a known PII leak vector.



\---



\## 13. Audit Data



Two different audit logs for two different purposes.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Cloud audit: "user logged in" | ✅ | ❌ | Metadata only |

| Cloud audit: "organization created" | ✅ | ❌ | Metadata only |

| Cloud audit: "license changed" | ✅ | ❌ | Metadata only |

| Boundary proof: "metrics sync, no debtor IDs" | ✅ | ✅ | Compliance evidence |

| Local audit: "debtor updated" | ❌ | ✅ | Contains debtor\_id reference |

| Local audit: "SMS sent" | ❌ | ✅ | Contains debtor context |

| Local audit: "document uploaded" | ❌ | ✅ | Contains debtor context |



\*\*Rule:\*\* cloud audit logs may contain \*what happened\* but never

\*to which debtor\*.



\---



\## 14. Connector Data



Integration with external providers.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Connector catalog entry | ✅ | ✅ | Product catalog |

| Client connector enablement | ✅ | ✅ | Metadata/config |

| BYO connector API key | ❌ | ✅ | Local encrypted only |

| GORKA-managed connector credentials | ✅ | ❌ | Server-side secret |

| Connector usage count per period | ✅ | ✅ | Aggregate billing |

| Debtor-level usage record | ❌ | ✅ | Per-debtor trace |



Rule:

&#x20; Aggregate usage allowed in cloud.

&#x20; Per-debtor usage stays local.



\---



\## 15. Platform Data (Cloud Only)



GORKA platform configuration.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Platform settings (key/value) | ✅ | ❌ | GORKA-internal |

| Feature flags | ✅ | ❌ | GORKA-internal |

| Platform announcements | ✅ | ❌ | GORKA-internal |

| Pricing configuration | ✅ | ❌ | GORKA-internal |



\---



\## 16. Billing and Subscription Data



GORKA ↔ client commercial relationship.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Subscription plan | ✅ | ❌ | GORKA-side |

| Subscription status | ✅ | ❌ | GORKA-side |

| Invoice | ✅ | ❌ | GORKA-side |

| Payment method metadata | ✅ | ❌ | Stripe-side token |

| Payment card number | ❌ | ❌ | Never stored — Stripe handles |

| License key | ✅ | ✅ | Cached locally for offline |



\---



\## 17. Connector Billing Data



Billing records for connector usage.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Aggregate usage this month | ✅ | ✅ | Billing |

| Unit price | ✅ | ✅ | Historical — must persist |

| Pricing version | ✅ | ✅ | For invoice stability |

| Billable amount | ✅ | ✅ | Billing |



\*\*Rule:\*\* historical billing records must preserve the pricing that

was applied at the time.



\---



\## 18. Logs and Telemetry



Application logs and error reporting.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Structured app logs (no PII) | ✅ | ✅ | Metadata |

| Error telemetry | ✅ | ✅ | Must sanitize — no request bodies |

| Crash reports | ✅ | ✅ | Must sanitize |

| Performance metrics | ✅ | ✅ | Metadata |

| Any log containing debtor data | ❌ | ✅ | Local only |



\*\*Rule:\*\* error telemetry must never transmit database values,

request payloads, filenames, debtor IDs, stack traces containing

operational data, or other client data.



\---



\## 19. Synchronization Data



Data that crosses the boundary.



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Sync acknowledgment | ✅ | ✅ | Metadata |

| Sync event log | ✅ | ✅ | No debtor data |

| Boundary proof entry | ✅ | ✅ | "Sync N, no debtor IDs" |

| Payload of synced data | ✅ | ✅ | Must contain only aggregates |

| Raw local data being synced | ❌ | ✅ | Never transmitted as-is |



\---



\## Critical Boundary Rules



These are non-negotiable:



1\. \*\*Debtor name, surname, phone, email, address, ID — never in cloud.\*\*

2\. \*\*Individual debt amounts, dates, statuses — never in cloud.\*\*

3\. \*\*Message content, email subject — never in cloud.\*\*

4\. \*\*Document content, filename — never in cloud.\*\*

5\. \*\*Individual actions, assignments — never in cloud.\*\*

6\. \*\*AI prompts or responses containing debtor info — never in cloud.\*\*

7\. \*\*Debtor IDs in any cloud table — never, not even as metadata.\*\*

8\. \*\*Rendered personalized messages — never in cloud.\*\*

9\. \*\*Anything that lets GORKA reconstruct a single debtor record — never in cloud.\*\*



\---



\## What This Document Is For



This matrix is the operational companion to the Architectural Law.



\- Before storing any new data type, find it here.

\- If it's not here, add it before storing.

\- If it's marked ❌ for cloud, it stays local.

\- If it's unclear, stop and clarify.



The matrix is reviewed whenever:



\- A new feature is proposed

\- A new connector is added

\- A new cloud table is designed

\- An existing data type moves location



\*\*The matrix is the reference. The law is the constitution. The

rules are the discipline.\*\*





\---



\## 20. Multi-User Sync Data (v1.2)



\*\*Added:\*\* September 17, 2026.

\*\*Authority:\*\* `ARCHITECTURAL-LAW.md` v1.2, Section 20.

\*\*Context:\*\* The multi-user concept (`MULTI-USER-CONCEPT.md`) introduces data types that did not exist when the original matrix was written. This section classifies them.



The existing rules of this matrix still apply. Only the new data types are described here.



\### 20.1 Encrypted Sync Payloads Between Client Devices



\*\*What it is:\*\* The end-to-end encrypted traffic that carries debtor data from one client-owned device to another during synchronization. It may travel directly (device-to-device) or through GORKA's encrypted relay (when a direct connection is not possible).



\*\*Where it lives:\*\*



| Cloud | Local | Notes |

|-------|-------|-------|

| ⚠️ | ✅ | Allowed in transit through GORKA's Control Plane relay, \*\*never stored\*\*, \*\*never readable\*\* by GORKA |



\*\*The rule:\*\*



> Encrypted sync payloads may pass through GORKA's Control Plane relay, but the relay must not be capable of decrypting them. The relay must not persist them. Not for logging, not for support, not for any reason.



\*\*What may cross:\*\*



\- End-to-end encrypted binary payloads produced by the client's own devices.

\- The payloads are opaque to GORKA. They contain debtor data in encrypted form. GORKA has no key.



\*\*What may NEVER cross:\*\*



\- Debtor data in readable form.

\- The organization's decryption keys.

\- Anything that would allow GORKA to reconstruct debtor data, even with its own full infrastructure access.



\*\*Reasoning:\*\* Direct device-to-device connections cannot always be established (NATs, firewalls, network policies). The relay is an operational necessity. Its inability to decrypt is the boundary.



\*\*Source:\*\* `MULTI-USER-CONCEPT.md` §3; `ARCHITECTURAL-LAW.md` v1.2 §20.3.



\### 20.2 Control Plane Connection Metadata



\*\*What it is:\*\* The metadata the Control Plane necessarily sees in order to broker connections between client devices.



\*\*Examples:\*\*



| Data type | Cloud | Local | Notes |

|-----------|-------|-------|-------|

| Organization ID (already exists) | ✅ | ⚪ | Which organization |

| Device registration records | ✅ | ⚪ | Which devices belong to which organization |

| Device presence (online/offline) | ✅ | ❌ | When devices are online |

| IP addresses / network endpoints | ✅ | ⚪ | Needed for discovery and relay |

| Connection timestamps | ✅ | ⚪ | When connections happen |

| Connection attempts (success/failure) | ✅ | ⚪ | For diagnostics and abuse prevention |

| Encrypted traffic volume per device pair | ✅ | ❌ | For relay capacity planning. No content. |



\*\*The rule:\*\*



> The Control Plane may see the metadata required to broker connections. It may not see anything about the content of the connections.



\*\*What this metadata is NOT:\*\*



\- It is not debtor data.

\- It does not identify any individual debtor.

\- It does not reveal what was synchronized, only that something was.



\*\*What to be honest about with clients:\*\* The Control Plane sees \*that\* two devices communicated, \*when\*, and \*how much\*. It does not see \*what\* was communicated. This must be stated plainly in compliance documentation. A sophisticated bank's security reviewer may ask.



\*\*Source:\*\* `MULTI-USER-CONCEPT.md` §3, §9.



\### 20.3 Sync Events and Change History on Each Device



\*\*What it is:\*\* The append-only record of business events and state changes that each device maintains locally, and which it sends to other devices during synchronization.



\*\*Examples of event types:\*\*



\- `DEBTOR\_CREATED`

\- `DEBTOR\_UPDATED`

\- `ACTION\_CREATED`

\- `COMMUNICATION\_LOGGED`

\- (later, when the product matures) `PAYMENT\_RECORDED`, `PROMISE\_CREATED`, `PROMISE\_BROKEN`, `CALL\_LOGGED`, `SMS\_SENT`, `EMAIL\_SENT`, `NOTE\_ADDED`, `STATUS\_CHANGED`, `CONTACT\_ATTEMPTED`



\*\*Where it lives:\*\*



| Cloud | Local | Notes |

|-------|-------|-------|

| ❌ | ✅ | Every device holds its own copy. Never on GORKA's infrastructure. |



\*\*The rule:\*\*



> Sync events are local-only. They contain debtor identifiers and business facts. They travel between client devices only in encrypted form. They are never stored in GORKA's Control Plane or the relay.



\*\*A note on the application audit log:\*\* The application audit log (which exists today for compliance and human review) and the sync protocol's change history are two different things. The audit log is not the sync protocol's source of truth. Both are local-only. This distinction is stated in `MULTI-USER-CONCEPT.md` §7 and will be detailed in `SYNC-ARCHITECTURE.md`.



\*\*Source:\*\* `MULTI-USER-CONCEPT.md` §7.



\### 20.4 What These New Data Types Do Not Permit



The additions above do not change any existing rule. They do not:



\- Permit debtor data to be stored in the Control Plane.

\- Permit GORKA to hold decryption keys.

\- Permit the relay to log or inspect traffic content.

\- Permit the Control Plane to derive debtor data from connection patterns.

\- Weaken the invariant in Section 1 of the Architectural Law.

\- Weaken the Critical Boundary Rules of this matrix.



\### 20.5 The Proof Test, Extended



The existing proof test (Section 9 of the Architectural Law) is unchanged. The multi-user case adds one test:



\*\*Extended proof:\*\* Run two client devices, synchronize a debtor record between them, capture all traffic on GORKA's infrastructure (Control Plane and relay), and inspect every payload and every log.



\*\*Expected result:\*\*



\- The relay traffic contains only ciphertext. No readable debtor data.

\- The Control Plane logs contain only connection metadata: organization ID, device identifiers, IP addresses, timestamps, byte counts. No debtor data.

\- No stored copy of the encrypted payloads exists anywhere on GORKA's infrastructure.

\- The decryption keys exist only on the client's devices.



If readable debtor data appears in any GORKA-controlled log or storage, the architecture is broken.



\*\*Source:\*\* `ARCHITECTURAL-LAW.md` v1.2 §20.2, §20.3.



\---



\*\*End of v1.2 additions.\*\*











