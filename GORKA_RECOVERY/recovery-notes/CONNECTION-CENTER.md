# GORKA CONNECTION CENTER



Document:    CONNECTION-CENTER.md

Version:     0.1 (DRAFT)

Date:        October 7, 2026

Status:      DRAFT - awaiting founder review

Authority:   Subordinate to ARCHITECTURAL-LAW.md.

&#x20;            Supersedes CONNECTOR-MODEL.md where they differ. The

&#x20;            connector-model document stays in the repository; this

&#x20;            document records the broader model.



\---



## 1. PURPOSE AND SCOPE



The Connection Center is the Client Dashboard surface where the

admin connects GORKA to third-party vendors. It is not limited to

communication providers. It covers communication tools, AI

providers, and client-supplied data sources.



This document defines the model: what a vendor is, what

categories exist, what the two enablement paths are, what the

admin sees, what the agent sees, and what happens when a vendor

is added or retired.



This document does not define:



&#x20; - the wire format for credential sync (SYNC-ARCHITECTURE.md

&#x20;   Sections 25.14 through 25.16)

&#x20; - the per-provider Rust adapters (each provider gets its own

&#x20;   implementation slice)

&#x20; - the backend provisioning implementation details (recorded

&#x20;   as an implementation note when the first Tier 1 provisioning

&#x20;   path is built)

&#x20; - the compliance rules enforcement layer (separate document,

&#x20;   later phase)



Where this document and CONNECTOR-MODEL.md differ, this document

wins. CONNECTOR-MODEL.md is not amended today; it will be

reconciled when the connector model is next revised.



\---



## 2. WHAT THE CONNECTION CENTER IS



It is the single place where the admin decides which third-party

services GORKA talks to on behalf of the organization.



Two layers, always distinct:



&#x20; Catalog   The list of vendors GORKA knows about. Product data.

&#x20;           Owned by GORKA. Read-only from the client side.

&#x20;           Adding a vendor is a data operation, not a code change.



&#x20; Enablement  The client's decision to activate a vendor for their

&#x20;             organization. One enablement row per (organization,

&#x20;             vendor). Owned by the client.



The catalog is the same for every organization. The enablements

are per organization.



\---



## 3. THE TWO PATHS



Every catalog row offers one or both of two paths.



GORKA-managed path (internal name: TIER1)



&#x20; GORKA holds a master relationship with the vendor, provisions a

&#x20; per-client subaccount or credential on demand, and hands that

&#x20; credential to the client's device. The client never sees the

&#x20; master credential. The subaccount credential reaches the

&#x20; client's device and is stored locally.



&#x20; The admin chooses this path. GORKA's backend performs live

&#x20; provisioning at click time (Option A, chosen for the MVP):

&#x20; the enable request triggers a provider API call, and the

&#x20; response carries the newly created client credential back to

&#x20; the admin's device. GORKA's cloud does not persist that

&#x20; credential.



BYOP path (internal name: TIER2, "bring your own provider")



&#x20; The client has their own business relationship with the vendor.

&#x20; The admin enters the credential directly into GORKA. The

&#x20; credential is stored locally on the admin's device. GORKA's

&#x20; cloud never receives it.



&#x20; GORKA does not provision anything. GORKA cannot revoke the

&#x20; client's credential at the vendor. GORKA's obligations are

&#x20; limited to the local mechanism (storage, distribution to the

&#x20; client's other devices through the encrypted sync channel).



Both paths end with the same thing: a credential stored in the

client's local database, and an enablement row on the client's

device. The difference is only where the credential came from.



\---



## 4. VENDOR CATEGORIES



&#x20; SMS       Text messaging providers (Twilio SMS, Mocean SMS)

&#x20; VOICE     Voice call providers (Twilio Voice)

&#x20; EMAIL     Email providers (Resend, SendGrid)

&#x20; AI        AI completion providers (Gemini, ChatGPT, Claude,

&#x20;           DeepSeek, KIMI, others)

&#x20; CALL      Reserved for future call platforms distinct from VOICE

&#x20; PUSH      Push notification providers

&#x20; DATA      Client-supplied data sources: credit bureaus,

&#x20;           skip-tracing services, any structured-data vendor the

&#x20;           client connects to their GORKA installation.



The list is not closed. A new category is added by writing a new

value in the catalog row. The UI reads the category string and

renders the row accordingly. Adding a category does not require a

code change unless the row needs a new icon.



\---



## 5. THE DATA-VENDOR RULE



GORKA offers communication tools and AI tools as GORKA-managed.

GORKA does not offer data sources as GORKA-managed. Data vendors

are BYOP-only, by design and by rule.



Reason: GORKA has no business relationship with data vendors, no

master credential to them, no ability to provision on the

client's behalf, and no ability to guarantee what data the

vendor returns or how it is handled. The client is the responsible

party for any data source they connect.



Consequences:



&#x20; - A DATA category row always has isManagedByGorka = false.

&#x20; - The UI never shows a "Connect with GORKA" option for a DATA

&#x20;   row.

&#x20; - The Zone 3 declaration (Section 9) applies to every DATA row

&#x20;   unconditionally.



\---



## 6. THE CATALOG ROW, EXTENDED



The connector\_catalog table carries the current fields

(CLOUD-TABLES.md Section 6.1). This document adds two fields:



&#x20; credentialSchema  JSON. Per-vendor definition of the credential

&#x20;                   fields the Configure modal must render. The

&#x20;                   modal reads this and renders the fields. No

&#x20;                   per-vendor React code.



&#x20;                   Example:



&#x20;                   {

&#x20;                     "fields": \[

&#x20;                       {

&#x20;                         "name": "apiKey",

&#x20;                         "label": "API Key",

&#x20;                         "type": "password",

&#x20;                         "required": true,

&#x20;                         "placeholder": "re\_..."

&#x20;                       }

&#x20;                     ]

&#x20;                   }



&#x20; mvpStatus         Already added in Phase 5. Values LIVE or

&#x20;                   COMING\_SOON. Gates the UI button.



Both fields are set when the row is created. Both are read by the

frontend. Neither requires a code change to add or edit.



The pricingConfig field is unrelated and stays as it is.



\---



## 7. THE PAGE LAYOUT



The Connection Center page shows two tables, visually distinct.



Table A - GORKA built-in



&#x20; Rows where isManagedByGorka = true.

&#x20; Columns: vendor name, category, status.

&#x20; Actions: Connect (when disconnected), Disconnect (when

&#x20; connected).

&#x20; States:

&#x20;   - LIVE: action button active.

&#x20;   - COMING\_SOON: action button disabled, labeled

&#x20;     "Coming soon".



Table B - Bring your own



&#x20; Rows where isManagedByGorka = false, plus every row for which

&#x20; the admin chose BYOP.

&#x20; Columns: vendor name, category, status.

&#x20; Actions: Add my credentials (when not configured), Disable

&#x20; (when configured).

&#x20; States:

&#x20;   - LIVE: action button active.

&#x20;   - COMING\_SOON: action button disabled, labeled

&#x20;     "Coming soon".



The two tables are never merged. The admin always knows which

path they are looking at.



\---



## 8. THE CONFIGURE FLOW



For a GORKA-managed vendor:



&#x20; 1. The admin clicks Connect.

&#x20; 2. The client calls POST /api/connectors/enable.

&#x20; 3. The backend, using GORKA's master credential to the vendor,

&#x20;    performs the provisioning operation defined for that vendor.

&#x20; 4. The provider returns the client credential to the backend.

&#x20; 5. The backend returns the credential in the response body.

&#x20; 6. The client stores the credential locally via a Tauri command.

&#x20; 7. The backend does not persist the credential. It exists in

&#x20;    process memory for the duration of the request.



For a BYOP vendor:



&#x20; 1. The admin clicks Add my credentials.

&#x20; 2. The Configure modal opens, reading the credentialSchema from

&#x20;    the catalog row.

&#x20; 3. The admin fills the fields.

&#x20; 4. On submit, the client stores the credential locally via the

&#x20;    same Tauri command.

&#x20; 5. The client calls POST /api/connectors/enable with

&#x20;    credentialsLocation = LOCAL and no credential in the body.

&#x20; 6. The backend writes the enablement row. It never sees the

&#x20;    credential.



The same Tauri command serves both paths. Both paths end with a

credential in the local database and an enablement row.



\---



## 9. THE TWO DECLARATIONS



Two declarations, one per path. Different wording, different

purpose. Both are recorded when accepted (Section 9.3).



Tier 1 declaration (GORKA-managed)



&#x20; An honest disclosure, not a warning. States plainly:



&#x20;   - GORKA provides the mechanism to connect to the vendor.

&#x20;   - Debtor data does not reach GORKA's cloud in readable form.

&#x20;   - Credentials are stored locally on the client's devices.

&#x20;   - Some metadata (session timing, aggregate traffic volume)

&#x20;     reaches GORKA's cloud for operational reasons. This is

&#x20;     unavoidable for the service to function.

&#x20;   - GORKA does not hold the credential used to reach the

&#x20;     vendor for client message sending.



&#x20; Purpose: the client understands what GORKA does and does not

&#x20; see.



Tier 2 declaration (BYOP)



&#x20; A warning, per ARCHITECTURAL-LAW.md Section 21.3. States

&#x20; plainly:



&#x20;   - The third party is outside GORKA's control.

&#x20;   - GORKA does not guarantee the third party's security,

&#x20;     compliance, or data handling.

&#x20;   - The client is responsible for any data transmitted to the

&#x20;     third party.

&#x20;   - The client has reviewed the third party's terms.

&#x20;   - The client may disconnect at any time.



&#x20; Purpose: the client is warned about what GORKA cannot protect

&#x20; against.



Both declarations are shown at the point of connection, before

the enablement is written. Neither is dismissible without

acknowledgment. The acknowledgment is written to

organization\_audit\_events (CLOUD-TABLES.md Section 4.4).



\---



## 10. CREDENTIAL STORAGE



The credential value is stored in the local SQLCipher database,

in the local\_connectors table (LOCAL-TABLES.md Category B.1).

This is unchanged from CONNECTOR-MODEL.md Section 6.9.



The credential never reaches GORKA's cloud. It travels between

the client's own devices only inside the end-to-end encrypted

sync channel, via the CONNECTOR\_ENABLED and

CONNECTOR\_CREDENTIAL\_REPLACED events (SYNC-ARCHITECTURE.md

Sections 25.14 through 25.16).



The Tauri command that writes the credential is the subject of

slice B3. It is one command, one table, one code path. It serves

both enablement paths.



\---



## 11. ADDING A VENDOR



Procedure, no code change:



&#x20; 1. GORKA operations decides the vendor is worth listing.

&#x20; 2. One object is added to the catalog seed array with its

&#x20;    code, name, description, category, provider,

&#x20;    isManagedByGorka, mvpStatus, and credentialSchema.

&#x20; 3. The seed is re-run. The row appears in every client's

&#x20;    catalog.

&#x20; 4. In the Client Dashboard, the new row appears on the

&#x20;    Connection Center page. If its mvpStatus is COMING\_SOON,

&#x20;    the button is disabled. If LIVE, the admin can connect.



When the vendor's adapter is implemented:



&#x20; 1. A Rust module is written in shared/src/connectors/<code>.rs.

&#x20; 2. It is registered in the default adapter registry.

&#x20; 3. The catalog row's mvpStatus is changed from COMING\_SOON to

&#x20;    LIVE in the seed. One line.

&#x20; 4. The seed is re-run.



No UI code changes. No frontend redeploy. The page reads the

catalog dynamically.



\---



## 12. WHAT THE AGENT SEES



Agents do not see the Connection Center. Agents do not see

credentials, provider accounts, prices, or the concept of tiers.



When the admin enables a vendor on the Client Dashboard, the

enablement reaches the agent's device through the existing sync

channel. On the agent's device, the vendor appears as a tool. A

communication vendor appears as a button on the debtor profile

(when the debtor has the required contact field, per

CONNECTOR-MODEL.md Section 5.2). An AI vendor appears as a

Copilot provider. A data vendor appears as a lookup action

(reached through the debtor profile or a future search surface,

still to be designed).



The agent clicks and uses the tool. Nothing else. The agent never

needs to know which path the admin chose or how the credential

reached the device.



\---



## 13. RETIREMENT AND LIFECYCLE



A vendor that is no longer offered by GORKA is retired. Retirement

is a catalog-level operation. The catalog row's lifecycleStatus

moves to RETIRED.



Effect on the UI:



&#x20; - The row disappears from the Connection Center page.

&#x20; - It disappears from the agent's Communication Tools page.

&#x20; - New enablements are not possible.

&#x20; - Existing enablements stay in the database but are hidden.



Only metadata remains, for compliance and audit. The catalog row

itself is preserved so historical enablements can be explained.



RETIRED rows are never reused. A vendor that comes back is added

as a new row with a new lifecycleStatus of ACTIVE.



\---



## 14. OPEN ITEMS



O1  CONNECTOR-MODEL.md reconciliation. The older document

&#x20;   describes tiers as permanent attributes. This document

&#x20;   describes the GORKA-managed path as a current capability.

&#x20;   The reconciliation is a future revision of CONNECTOR-MODEL.md

&#x20;   and is not done today.



O2  credentialSchema format. The example in Section 6 is

&#x20;   illustrative. The exact JSON shape (field types supported,

&#x20;   validation rules, secret field markers) is decided when the

&#x20;   first non-Resend credential flow is built.



O3  Backend provisioning design. Live provisioning (Option A)

&#x20;   is chosen for the MVP. The exact HTTP contract between the

&#x20;   backend and each vendor's provisioning API is defined per

&#x20;   vendor when its adapter is built. The first such vendor is

&#x20;   not yet chosen.



O4  DATA vendor search surface. How the agent reaches a data

&#x20;   vendor's lookup from the debtor profile is not specified

&#x20;   here. It depends on whether the vendor returns structured

&#x20;   data, free text, or both. Deferred.



O5  Declaration versioning. The two declarations will need

&#x20;   version strings so a later revision can be distinguished

&#x20;   from an earlier acknowledgment. Format chosen when the

&#x20;   first declaration is wired.



O6  Data-vendor category icons. The current UI has icons for

&#x20;   SMS, VOICE, EMAIL, AI, PUSH. DATA has none today. A small

&#x20;   UI addition when the first DATA row is added.



\---



## 15. WHAT THIS DOCUMENT DOES NOT DO



&#x20; - It does not write code.

&#x20; - It does not amend any frozen document.

&#x20; - It does not define the wire format for anything.

&#x20; - It does not settle the backend provisioning contract.

&#x20; - It does not specify the compliance rules layer.

&#x20; - It does not supersede SYNC-ARCHITECTURE.md, LOCAL-TABLES.md,

&#x20;   or CLOUD-TABLES.md.



It defines the model, so that the slices that follow (B3, the

first adapter, the Zone 3 re-wire, the credentialSchema modal)

implement one coherent design rather than three partial ones.



\---



End of CONNECTION-CENTER.md

