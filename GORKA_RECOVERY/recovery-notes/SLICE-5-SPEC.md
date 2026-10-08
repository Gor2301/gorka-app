SLICE-5-SPEC.md — Both Channels (Tier 1 + BYOP), Agent Communication Card

Version 1.0 — drafted 2026-10-08.



This is the implementation-ready spec for Slice 5. It is self-contained:

a new chat needs this file and RESUME-HERE.md v2.3, and nothing else, to

begin work without reconnaissance.



================================================================

1\. GOAL

================================================================



Two channels for every connector, side by side.



TIER 1 (GORKA-managed)

&#x20; GORKA holds the credential. Admin clicks "Connect (GORKA)". GORKA's

&#x20; credential is delivered to the Client device over the existing enable

&#x20; call, written locally, and synced to the Agent. Admin never sees a key.



BYOP (customer-managed)

&#x20; Admin clicks "Use my own account". A provider-specific form collects

&#x20; the credential. Same local write, same sync. Admin's own account sends.



Both channels converge at exactly one point: the existing Tauri command

write\_local\_connector\_credential. Everything downstream of that command

was built in Slice 4 and works. Slice 5 builds the two upstream paths.



Additionally: the Agent's Debtor Profile page becomes the action surface,

with a Communication card listing every enabled connector, grouped by

channel (SMS, Email, Voice). Voice is a "coming soon" placeholder.



================================================================

2\. FOUNDER'S VISION — AGENT-FACING UX

================================================================



Two distinct Agent pages:



&#x20; Communication Tools (glance)

&#x20;   Shows every enabled connector. This is the agent's morning

&#x20;   orientation. Unchanged from Slice C, maybe copy tweak only.



&#x20; Debtor Profile (action surface)

&#x20;   Where the agent works. All enabled connectors reachable here.

&#x20;   Choose the connector, act. If admin changes the set on the Client,

&#x20;   sync updates both pages.



The Debtor Profile card is the primary new work of this slice.



================================================================

3\. DECISIONS LOCKED

================================================================



&#x20; Two-buttons-on-one-card       YES  (Option B, confirmed)

&#x20; Backend credential storage    Environment variables on the backend.

&#x20;                               MVP shortcut. Documented in §9 as a

&#x20;                               known limitation.

&#x20; Resend tier 1                 LIVE this slice.

&#x20; Twilio tier 1                 DORMANT this slice. Env vars unset.

&#x20;                               Button appears; click returns a clear

&#x20;                               error.

&#x20; Voice calling                 PLACEHOLDER ONLY. "Coming soon" modal.

&#x20;                               No fake call UI, no fake DB rows.

&#x20; Agent Communication card      Grouped by channel (SMS, Email, Voice).



================================================================

4\. CLIENT DASHBOARD — CARD LAYOUT

================================================================



Every catalog card changes shape.



If catalog.isManagedByGorka === true (Tier 1 eligible):

&#x20; \[Connect (GORKA)]   \[Use my own account]



If catalog.isManagedByGorka === false (BYOP only):

&#x20; \[Use my own account]



The `isManagedByGorka` flag keeps its meaning: "GORKA offers a Tier 1

credential for this connector." BYOP is now offered on every card.



No seed change required. No DB migration.



================================================================

5\. TIER 1 PATH — DETAIL

================================================================



FLOW

&#x20; 1. Admin clicks "Connect (GORKA)".

&#x20; 2. Existing Tier 1 declaration modal opens (built in Slice 1).

&#x20; 3. Accept.

&#x20; 4. Client calls connectorsService.enable(code, { tier1Acknowledged: true }).

&#x20; 5. Backend writes the audit row (Slice 1) and additionally returns the

&#x20;    credential in the response body.

&#x20; 6. Client invokes write\_local\_connector\_credential with the returned

&#x20;    credential.

&#x20; 7. write\_local\_connector\_credential originates CONNECTOR\_ENABLED.

&#x20; 8. Sync delivers to Agent.



BACKEND CHANGE

&#x20; src/backend/routes/connectors.routes.ts

&#x20;   For connectors where the backend holds a GORKA credential, the

&#x20;   enable response gains a `credential` field:

&#x20;     {

&#x20;       success: true,

&#x20;       data: { ...clientConnectorRow },

&#x20;       credential: {

&#x20;         value: <base64 or utf8 string>,

&#x20;         configuration: <JSON object>

&#x20;       }

&#x20;     }

&#x20;   For connectors where no GORKA credential is configured, the field

&#x20;   is omitted and the client shows a clear error after the click.



&#x20; Credentials are read from environment variables in the route handler.



ENVIRONMENT VARIABLES (backend)

&#x20; GORKA\_RESEND\_API\_KEY          Resend API key

&#x20; GORKA\_RESEND\_FROM             From address (e.g. noreply@gorka.click)

&#x20; GORKA\_TWILIO\_ACCOUNT\_SID      Twilio account SID (leave unset for MVP)

&#x20; GORKA\_TWILIO\_AUTH\_TOKEN       Twilio auth token (leave unset for MVP)

&#x20; GORKA\_TWILIO\_FROM             Twilio from number (leave unset for MVP)



&#x20; No .env change is required if these are supplied inline when the

&#x20; backend is started. If put into .env, they are auto-loaded by the

&#x20; backend's existing dotenv path.



CLIENT CHANGE

&#x20; supervisor-dashboard/src/services/connectors.service.ts

&#x20;   enable() currently returns EnablementRow | null. Change to return

&#x20;   the full body so the caller can read the credential field:

&#x20;     async enable(code, options): Promise<{

&#x20;       row: EnablementRow | null;

&#x20;       credential?: { value: string; configuration: Record<string, any> };

&#x20;     }>

&#x20;   All existing callers updated.



&#x20; supervisor-dashboard/src/pages/Connectors.tsx

&#x20;   handleTier1Confirm calls enable(). If the response contains a

&#x20;   credential, it invokes write\_local\_connector\_credential with the

&#x20;   credential value (encoded to bytes) and the configuration (JSON

&#x20;   string), then reloads. If no credential is returned, it shows an

&#x20;   error: "GORKA-managed {name} is not configured on this server."



&#x20; Credential encoding for write\_local\_connector\_credential:

&#x20;   - Resend: value is the API key as UTF-8 bytes. Configuration is

&#x20;     {"from": "<GORKA\_RESEND\_FROM>"}.

&#x20;   - Twilio: value is the JSON string {"accountSid": "...", "authToken": "..."}

&#x20;     encoded to UTF-8 bytes. Configuration is {"from": "<GORKA\_TWILIO\_FROM>"}.



SECURITY NOTE

&#x20; The credential is returned in the HTTP response body over TLS, held

&#x20; briefly in the Client's JS memory, and written to local SQLCipher. It

&#x20; never touches the cloud database. It is never logged. Reviewers should

&#x20; confirm: no `console.log` of the response body, no winston log of the

&#x20; response, no Prisma write of the credential. This is B7 territory and

&#x20; is documented as an open item in RESUME-HERE §15.



================================================================

6\. BYOP PATH — DETAIL

================================================================



FLOW

&#x20; 1. Admin clicks "Use my own account".

&#x20; 2. Existing Zone 3 declaration modal opens (B4b).

&#x20; 3. Accept.

&#x20; 4. Provider-specific form opens (NEW — replaces the generic

&#x20;    ConfigurationModal for these two codes).

&#x20; 5. Save.

&#x20; 6. Client invokes write\_local\_connector\_credential (existing).

&#x20; 7. Event fires. Sync delivers.



NEW COMPONENTS

&#x20; supervisor-dashboard/src/components/Connectors/ResendByopModal.tsx

&#x20;   Fields:

&#x20;     API Key              (password input, required)

&#x20;     From address         (email input, required, default "onboarding@resend.dev")

&#x20;   On save:

&#x20;     credentials = { apiKey }

&#x20;     config      = { from }

&#x20;   Produces:

&#x20;     value = apiKey as UTF-8 bytes

&#x20;     configuration = JSON.stringify(config)



&#x20; supervisor-dashboard/src/components/Connectors/TwilioByopModal.tsx

&#x20;   Fields:

&#x20;     Account SID          (text, required, starts with "AC")

&#x20;     Auth Token           (password, required)

&#x20;     From number          (phone, required, E.164 format "+...")

&#x20;   On save:

&#x20;     credentials = { accountSid, authToken }

&#x20;     config      = { from }

&#x20;   Produces:

&#x20;     value = JSON.stringify(credentials) as UTF-8 bytes

&#x20;     configuration = JSON.stringify(config)



CONNECTORS.TSX ROUTING

&#x20; handleAddCredentials(row) currently always opens the generic

&#x20; ConfigurationModal. Change:

&#x20;   if (row.catalog.code === 'resend-email')  → ResendByopModal

&#x20;   if (row.catalog.code === 'twilio-sms')    → TwilioByopModal

&#x20;   else                                       → ConfigurationModal (existing)



&#x20; State becomes a string modal-type union:

&#x20;   const \[byopModal, setByopModal] = useState<'resend' | 'twilio' | 'generic' | null>(null);

&#x20; Or keep three booleans. Either works.



CUSTOM-API

&#x20; Unchanged. Uses the generic ConfigurationModal. That is the

&#x20; "bring your own anything" path.



================================================================

7\. AGENT DEBTOR PROFILE — COMMUNICATION CARD

================================================================



New component:

&#x20; agent-dashboard/src/components/CommunicationCard.tsx

&#x20; agent-dashboard/src/components/CommunicationCard.css



Reads local\_connectors via localDB.listLocalConnectors() on mount.



Groups by channel derived from the connector code:

&#x20; endsWith("-sms")   → SMS

&#x20; endsWith("-email") → Email

&#x20; endsWith("-voice") → Voice

&#x20; else               → Other (shown last, or hidden — decide on first run)



Renders one button per connector, grouped under a small section header.



Example rendering (when custom-api, resend-email, twilio-sms enabled):



&#x20; SMS

&#x20;   \[Twilio SMS]      (opens SendMessageModal preset to twilio-sms)

&#x20; Email

&#x20;   \[Resend Email]    (opens SendMessageModal preset to resend-email)

&#x20; Voice

&#x20;   \[Call]            (opens CallComingSoonModal)

&#x20;                     (Voice button always shown, even if no voice

&#x20;                      connector is enabled — the placeholder is

&#x20;                      independent of enablement for MVP)



&#x20; Also shows only channels that have at least one enabled connector,

&#x20; EXCEPT Voice which is always shown as a placeholder.



Empty state:

&#x20; No connectors enabled. Ask your administrator.



MOUNT

&#x20; agent-dashboard/src/pages/DebtorProfilePage.tsx

&#x20;   Place the card above the Debts card, below the identity card.

&#x20;   Remove the "Send SMS" button from the phone row (its function is

&#x20;   subsumed by the Communication card).

&#x20;   Remove the showSendSms state and the SendSmsModal mount.



================================================================

8\. SENDMESSAGEMODAL — GENERALIZATION

================================================================



Replace SendSmsModal.tsx with SendMessageModal.tsx.



&#x20; Props:

&#x20;   debtorId, debtorName,

&#x20;   presetConnectorCode?: string,      (undefined = pick from list)

&#x20;   onClose, onSent



&#x20; Reads connectors on mount. Filters to status==='ENABLED'.

&#x20; If presetConnectorCode is provided and it is in the list, preselect it.

&#x20; Otherwise preselect the first.



&#x20; Field shown for recipient:

&#x20;   If connector code endsWith '-sms'   → "Phone"  (initial value = debtor.phone)

&#x20;   If connector code endsWith '-email' → "Email"  (initial value = debtor.email)

&#x20;   Otherwise                           → "Recipient"



&#x20; Body: textarea (same as Slice 4).



&#x20; On send:

&#x20;   Calls localDB.sendConnectorMessage with the selected connector code.

&#x20;   The Agent's send\_connector\_message command (Slice 4) is unchanged.

&#x20;   On success, calls onSent.



&#x20; CSS: rename SendSmsModal.css → SendMessageModal.css, class names

&#x20; send-sms-modal\_\_\* → send-message-modal\_\_\*.



DEBTOR PROFILE USAGE

&#x20; Communication card buttons open SendMessageModal with the appropriate

&#x20; preset connector code. The card itself handles picking the code.



================================================================

9\. VOICE PLACEHOLDER

================================================================



New component:

&#x20; agent-dashboard/src/components/CallComingSoonModal.tsx

&#x20; agent-dashboard/src/components/CallComingSoonModal.css



Content:

&#x20; Header:  "Voice calling"

&#x20; Body:    "Voice calling is coming soon. To place a call today,

&#x20;           use your own phone."

&#x20; Footer:  \[Close]



&#x20; No form. No timer. No fake DB write. No communication row.



&#x20; The modal exists so the shape of the eventual product is visible to

&#x20; anyone using the demo. It is deliberately a placeholder.



================================================================

10\. FILES TOUCHED — COMPLETE LIST

================================================================



BACKEND

&#x20; src/backend/routes/connectors.routes.ts               (edit)



CLIENT DASHBOARD

&#x20; supervisor-dashboard/src/services/connectors.service.ts  (edit)

&#x20; supervisor-dashboard/src/pages/Connectors.tsx            (edit)

&#x20; supervisor-dashboard/src/components/Connectors/ResendByopModal.tsx  (new)

&#x20; supervisor-dashboard/src/components/Connectors/ResendByopModal.css  (new)

&#x20; supervisor-dashboard/src/components/Connectors/TwilioByopModal.tsx  (new)

&#x20; supervisor-dashboard/src/components/Connectors/TwilioByopModal.css  (new)



AGENT DASHBOARD

&#x20; agent-dashboard/src/components/CommunicationCard.tsx      (new)

&#x20; agent-dashboard/src/components/CommunicationCard.css      (new)

&#x20; agent-dashboard/src/components/CallComingSoonModal.tsx    (new)

&#x20; agent-dashboard/src/components/CallComingSoonModal.css    (new)

&#x20; agent-dashboard/src/components/SendMessageModal.tsx       (new, replaces SendSmsModal.tsx)

&#x20; agent-dashboard/src/components/SendMessageModal.css       (new, replaces SendSmsModal.css)

&#x20; agent-dashboard/src/pages/DebtorProfilePage.tsx           (edit)



DOCS

&#x20; GORKA\_RECOVERY/recovery-notes/RESUME-HERE.md   (v2.3 → v2.4 at slice close)

&#x20; GORKA\_RECOVERY/recovery-notes/SLICE-5-SPEC.md  (this file)



NOT TOUCHED

&#x20; Any Rust file. Slice 5 is TypeScript + backend only.

&#x20; prisma/seed-connectors.ts. isManagedByGorka stays as-is.

&#x20; Any sync-related code. The wire is unchanged.



================================================================

11\. COMMITS — IN ORDER

================================================================



Group 1 — Tier 1 delivery (3 commits)

&#x20; 1. backend: return GORKA Tier 1 credential from enable

&#x20;    src/backend/routes/connectors.routes.ts

&#x20; 2. connectors.service: enable returns credential alongside row

&#x20;    supervisor-dashboard/src/services/connectors.service.ts

&#x20;    (updates all callers)

&#x20; 3. Connectors.tsx: two buttons on Tier 1 cards; write Tier 1 credential

&#x20;    supervisor-dashboard/src/pages/Connectors.tsx



Group 2 — BYOP forms (3 commits)

&#x20; 4. client: ResendByopModal

&#x20;    new component + CSS

&#x20; 5. client: TwilioByopModal

&#x20;    new component + CSS

&#x20; 6. Connectors.tsx: route by code to the right BYOP modal

&#x20;    supervisor-dashboard/src/pages/Connectors.tsx



Group 3 — Agent action surface (3 commits)

&#x20; 7. agent: SendMessageModal (replaces SendSmsModal)

&#x20;    2 new files, 2 deleted files, DebtorProfilePage updated

&#x20; 8. agent: CommunicationCard

&#x20;    new component + CSS

&#x20; 9. agent: mount CommunicationCard on debtor profile

&#x20;    DebtorProfilePage.tsx (remove old Send SMS button, mount card)



Group 4 — Voice placeholder (1 commit)

&#x20; 10. agent: CallComingSoonModal



Group 5 — Docs (1 commit at slice close)

&#x20; 11. RESUME-HERE: v2.4, Slice 5 complete



Total: 11 commits.



================================================================

12\. CLOUD CHECKS

================================================================



&#x20; cargo build --workspace     PASS (no Rust changes; expect cache hit

&#x20;                             or quick rebuild)

&#x20; cargo test --workspace      112/112 (unchanged; Slice 5 adds no tests)

&#x20; node verify\\index.mjs       9/9 (unchanged)



&#x20; No Prisma migration. No seed re-run.



&#x20; IMPORTANT: set TMP and TEMP to C:\\cargo-tmp before cargo on cloud.

&#x20; See RESUME-HERE §6.



================================================================

13\. LIVE DEMO — AFTER SLICE 5

================================================================



PRECONDITION

&#x20; Backend running with GORKA\_RESEND\_API\_KEY and GORKA\_RESEND\_FROM set.

&#x20; GORKA\_TWILIO\_\* deliberately unset.



CLIENT

&#x20; 1. Connectors page.

&#x20; 2. Resend Email card shows two buttons: \[Connect (GORKA)]

&#x20;    \[Use my own account].

&#x20; 3. Click Connect (GORKA). Tier 1 declaration. Accept.

&#x20; 4. Card flips to CONNECTED. No error.

&#x20; 5. (Optional) Repeat on a second connector with BYOP:

&#x20;    e.g. custom-api → "Use my own account" → generic modal → dummy key.



AGENT

&#x20; 6. Communication Tools page shows both enabled connectors.

&#x20;    (The glance page.)

&#x20; 7. Open a debtor profile.

&#x20; 8. Communication card shows:

&#x20;      SMS       (nothing enabled yet — hidden)

&#x20;      Email     \[Resend Email]

&#x20;      Voice     \[Call]

&#x20; 9. Click Resend Email. SendMessageModal opens preset to resend-email,

&#x20;    Email field prefilled from debtor.email.

&#x20; 10. Compose and send.

&#x20; 11. Communications row appears. Sync event fires.

&#x20; 12. On the Client, the COMMUNICATION\_LOGGED event arrives.



VOICE

&#x20; 13. Click Call on the Communication card.

&#x20; 14. "Voice calling is coming soon." modal appears. Close.



DORMANT TWILIO TIER 1

&#x20; 15. Twilio SMS card shows both buttons.

&#x20; 16. Click Connect (GORKA). Tier 1 declaration. Accept.

&#x20; 17. Error appears: "GORKA-managed Twilio SMS is not configured on

&#x20;     this server." No local write. No event.



================================================================

14\. WHAT IS NOT IN THIS SLICE

================================================================



&#x20; Tier 1 credential transit verification (B7) — separate review.

&#x20; Real Twilio Tier 1 credentials — env vars stay unset.

&#x20; Voice calling — placeholder only, no adapter.

&#x20; Compliance enforcement — separate slice.

&#x20; Any Rust change — none expected.

&#x20; Any seed change — none.



================================================================

15\. RECONNAISSANCE FINDINGS — CARRY FORWARD

================================================================



From prior sessions, still valid:

&#x20; write\_local\_connector\_credential is the single convergence point.

&#x20; It accepts (connector\_code, tier, configuration, credential\_bytes)

&#x20; and originates CONNECTOR\_ENABLED inside a transaction.

&#x20; The Agent receives it via the sync channel. Slice 4 built the send

&#x20; side. Do not re-derive any of this.



&#x20; The backend's dotenv path loads root .env. If GORKA\_\* vars are placed

&#x20; there, they are available to the route handler via process.env.

&#x20; If not, set them inline when starting the backend.



&#x20; connectors.routes.ts currently returns { success, data } — check

&#x20; the exact shape before adding a credential field. Slice 1 already

&#x20; modified this file (added tier1Acknowledged handling).



&#x20; Connectors.tsx handleTier1Confirm already exists (from Slice 1).

&#x20; Slice 5 extends it, does not replace it.



&#x20; DebtorProfilePage.tsx already has SendSmsModal mount and showSendSms

&#x20; state (from Slice 4). Slice 5 removes both and mounts the new card.



&#x20; SendSmsModal.tsx (Slice 4) is a working modal. Slice 5 renames and

&#x20; generalizes it. Do not rewrite from scratch — extend the Slice 4 file.



================================================================

16\. FIRST ACTIONS IN THE NEW CHAT

================================================================



&#x20; 1. Paste RESUME-HERE.md v2.3 and this file.

&#x20; 2. On main:

&#x20;      git log --oneline -3

&#x20;      git status --short

&#x20;    Confirm HEAD 602008f and clean tree.

&#x20; 3. Read src/backend/routes/connectors.routes.ts in full.

&#x20;    This is the file commit 1 modifies; it must be seen before editing.

&#x20; 4. Begin commit 1.



Do not start with anything else. The first edit depends on reading

connectors.routes.ts as it stands at commit 602008f.



End of SLICE-5-SPEC.md

