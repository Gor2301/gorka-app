RESUME-HERE.md — Full Chat Summary and Handoff
Version 2.4 — written at close of Slice 5.

STRUCTURE OF THIS FILE
  Sections 1–16 are the v2.3 snapshot. Preserved as-is, on purpose.
  They are the plan as it stood before Slice 5 ran. Read them for the
  baseline: what we intended, what we assumed, what we thought was next.
  APPENDIX A (after §16) is the v2.4 update: what Slice 5 actually
  shipped, what running it taught us, the redesigned plan, new open
  items, and process amendments.
  Where the appendix and the body conflict, the appendix wins. The body
  stays visible so drift is easy to see.

This one document is both the summary of this chat and the resume state.
Save it at GORKA_RECOVERY\recovery-notes\RESUME-HERE.md. Open it at the start
of the next chat. Everything needed to resume without reconnaissance is here.

READ ALONGSIDE
  GORKA_RECOVERY/recovery-notes/SLICE-5-SPEC.md — the spec Slice 5
  implemented. Kept as the historical record of what Slice 5 was meant
  to be.

================================================================
1. MACHINE STATE AT CLOSE
================================================================

MAIN:    HEAD 602008f. Pushed. origin/main = 602008f. Clean tree except
         untracked CHAT-HANDOFF-DUMP.txt and make-dump.ps1.
CLOUD:   at 03a7a67 after last pull. Will pick up 602008f on next pull.
         Build PASS, tests 112/112. Live demo of Slice 4 not yet run
         (unblocked by Slice 5 — see §2c).

Commits since the prior origin/main of 8991746:

Slice C — Connector enablement sync (ten commits, HEAD b435e55):
  b435e55  tests: CONNECTOR_ENABLED apply, deferred dispatch, read-model exclusion
  59e69cd  agent-dashboard: Communication Tools reads local_connectors
  0d5d88c  agent: add list_local_connectors command
  a80d468  local_record: derive Serialize on LocalConnectorRow
  a15b83a  main.rs: route write_local_connector_credential through upsert_local_connector_with_event
  94600e9  sync_pipeline: import OptionalExtension
  0e0597f  local_record: read model, list helper, and event-originating upsert
  947b00a  sync_engine: add CONNECTOR event and connector entity name maps
  868a047  sync_pipeline: accept CONNECTOR_ENABLED, defer DISABLED and REPLACED
  e195d46  sync_events: add CONNECTOR event and entity constants

Handoff doc v2.0:
  7ca2ae8  RESUME-HERE: v2.0, Slice C closed, run commands fixed

Slice 1 — Tier 1 declaration gate (four commits, HEAD 6cad294):
  6cad294  connectors.routes: Tier 1 acknowledgement writes audit row
  a025f47  connectors.service: enable() gains tier1Acknowledged
  d313b55  Connectors.tsx: Tier 1 Resend connect opens declaration gate
  8ad418d  DeclarationModal: accept tier prop and render Tier 1 variant

Handoff doc v2.1:
  be71350  RESUME-HERE: v2.1, Slice 1 and restart test closed

Slice 4 — Send-from-agent (Twilio SMS) (seven commits, HEAD 03a7a67):
  03a7a67  agent: remove unused ConnectorAdapter import
  f7f9a83  agent: remove duplicate #[command] attribute on list_local_connectors
  115f582  seed-connectors: flip twilio-sms to LIVE
  5a8dbb3  agent-dashboard: send SMS from debtor profile
  bcea29f  agent: add test_connector_connection and send_connector_message
  5a78569  connectors: derive Serialize on SendResult
  4093cc0  local_record: add read_local_connector_credential

Handoff doc v2.2:
  602008f  RESUME-HERE: v2.2, Slice 4 code complete, live demo deferred

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -6
    git status --short

================================================================
2. SLICE C — CONNECTOR ENABLEMENT SYNC — COMPLETE
================================================================

GOAL (achieved)
Admin enables a connector on the Client. The credential and configuration
travel through the existing encrypted sync channel inside a CONNECTOR_ENABLED
event. Within seconds the connector appears on the Agent's Communication Tools
page. The agent user never types or sees the credential.

DEMO VEHICLE
custom-api — Tier 2 / BYOP. Client UI drives a working path to it.

WHAT SHIPPED
- shared/src/sync_events.rs — EVENT_CONNECTOR_ENABLED / DISABLED /
  CREDENTIAL_REPLACED constants; ENTITY_CONNECTOR constant.
- shared/src/sync_pipeline.rs — CONNECTOR_ENABLED accepted end to end;
  DISABLED and REPLACED recognized, validated, and deferred; apply writes
  local_connectors + audit entry; no entity_field_state rows; OptionalExtension
  imported.
- shared/src/sync_engine.rs — event_type_code and entity_type_code entries.
- shared/src/connectors/local_record.rs — LocalConnectorRow (read model, no
  credential_value, derives Serialize); upsert_local_connector_with_event
  (transactional write + originate_event); list_local_connectors.
- src-tauri/src/main.rs — write_local_connector_credential routes through
  upsert_local_connector_with_event.
- src-tauri-agent/src/main.rs — list_local_connectors command, registered in
  generate_handler! next to get_debtor_count.
- agent-dashboard/src/services/local.db.ts — LocalConnector interface,
  listLocalConnectors().
- agent-dashboard/src/pages/CommunicationToolsPage.tsx — reads on mount, one
  card per row, exact spec 11.8 sentence preserved as empty state.
- agent-dashboard/src/pages/CommunicationToolsPage.css — grid, card, badge
  classes added; empty-state classes unchanged.
- shared/tests/sync_pipeline.rs — five new tests.

================================================================
2b. SLICE 1 — TIER 1 DECLARATION GATE — COMPLETE
================================================================

GOAL (achieved)
Mirror the B4b Zone 3 declaration gate for Tier 1 connectors. The
Client connects resend-email through a declaration modal. On accept,
the enable request carries tier1Acknowledged: true; the backend
writes one organization_audit_events row with eventType =
'TIER1_CONNECTION_ACKNOWLEDGED' in the same transaction as the
client_connectors upsert. Cancel writes nothing.

WHAT SHIPPED
- DeclarationModal.tsx accepts a `tier` prop ('TIER1' | 'TIER2').
  Tier 1 renders a blue info box ("How this works") and a Tier 1
  commitment list. Tier 2 path unchanged.
- Connectors.tsx: handleConnect opens the declaration with tier='TIER1'
  and handleDeclarationAccept routes to handleTier1Confirm. The BYOP
  path (handleAddCredentials) still opens tier='TIER2'.
- connectors.service.ts: enable() gains optional { tier1Acknowledged?: boolean }.
- connectors.routes.ts: enableSchema accepts optional tier1Acknowledged.
  Conditional organizationAuditEvent.create with eventType =
  'TIER1_CONNECTION_ACKNOWLEDGED', details = { connectorCode, tier: 'TIER1' },
  inside the same prisma.$transaction as the upsert.

DESIGN DECISION — audit event name
Distinct event type, not a reuse of ZONE_3_CONNECTION_ACKNOWLEDGED.
One audit event type per tier.

================================================================
2c. SLICE 4 — SEND-FROM-AGENT (TWILIO SMS) — CODE COMPLETE
================================================================

GOAL (achieved in code)
An Agent user, on a debtor profile, opens a modal, composes a message.
On send, the Agent reads the connector's credential from its local
SQLCipher, calls the provider adapter, receives a provider message id,
and writes a communications row. That row originates a
COMMUNICATION_LOGGED sync event, which propagates back to the Client.

WHAT SHIPPED
- shared/src/connectors/local_record.rs: read_local_connector_credential.
  Returns Option<LocalConnectorSecret> with credential_value and parsed
  configuration. The struct name makes the secret explicit.
- shared/src/connectors/mod.rs: SendResult derives Serialize so Tauri
  commands can return it to the frontend.
- src-tauri-agent/src/main.rs: test_connector_connection and
  send_connector_message. Both read the credential locally, build an
  adapter from build_default_registry, and call the trait methods.
  send_connector_message also writes a communications row via
  communications::insert_communication, which originates the
  COMMUNICATION_LOGGED sync event.
- agent-dashboard/src/services/local.db.ts: SendResult and
  SendConnectorMessageInput interfaces, plus testConnectorConnection and
  sendConnectorMessage wrappers.
- agent-dashboard/src/components/SendSmsModal.tsx (new): composer with
  connector picker, recipient field, message body, send button.
- agent-dashboard/src/components/SendSmsModal.css (new).
- agent-dashboard/src/pages/DebtorProfilePage.tsx: Send SMS button on the
  phone row, modal mount, refresh on send.
- prisma/seed-connectors.ts: twilio-sms mvpStatus flipped COMING_SOON → LIVE.

LIVE DEMO — DEFERRED, UNBLOCKED BY SLICE 5
  Root cause of the deferral: the Client UI routes connectors by
  catalog.isManagedByGorka. Tier 1 connectors go through
  /api/connectors/enable, which writes an audit row but does NOT write
  local_connectors or originate CONNECTOR_ENABLED. twilio-sms is
  isManagedByGorka:true, so the credential never reaches the Agent.

  Slice 5 builds the missing paths — Tier 1 credential delivery and a
  provider-specific BYOP form — and the demo becomes runnable. See
  SLICE-5-SPEC.md.

================================================================
2d. SLICE 5 — PLANNED, NOT STARTED
================================================================

SLICE-5-SPEC.md is the implementation-ready spec. Summary:

  Goal: both channels (Tier 1 + BYOP) for every connector, plus an
  Agent Communication card on the debtor profile that lists every enabled
  connector grouped by channel.

  Eleven commits in five groups. TypeScript and backend only. No Rust.
  No schema migration. No seed change.

  Locked decisions:
    Two buttons on one card (Connect (GORKA) + Use my own account).
    Backend stores GORKA credentials in environment variables (MVP
    shortcut, documented).
    Resend Tier 1 live. Twilio Tier 1 dormant (env vars unset).
    Voice: "coming soon" placeholder modal only.
    Agent Communication card grouped by channel.

  See SLICE-5-SPEC.md for the full spec, file list, commit order,
  demo script, and first actions.

================================================================
3. VERIFICATION
================================================================

CLOUD, at 03a7a67:
  cargo build --workspace     PASS. Warnings unchanged:
                              Agent 2, Client 3, shared 9.
  cargo test --workspace      112/112 PASS. Baseline 107 + 5 from Slice C.
                              Slice 4 adds no Rust tests — the send path is
                              exercised by the live demo, which is deferred.
  node verify\index.mjs       9/9 PASS (verified at b435e55, unchanged since).

The five Slice C tests, all green:
  connector_enabled_accepted_and_applied
  connector_disabled_is_deferred_without_mutation
  connector_credential_replaced_is_deferred_without_mutation
  local_connector_read_model_excludes_credential
  list_local_connectors_shape_and_order

KNOWN BENIGN WARNING
The shared test binary emits one `linker_messages` lint note. Not from our
code. Present before this slice. Not a concern.

PROVEN LIVE (screenshots taken)
  Slice C — Client BYOP enables custom-api; Agent Communication Tools shows
  the card after sync, and after a full Agent process restart.
  Slice 1 — Client Resend Connect → Tier 1 declaration → accept. Cloud DB
  query shows one TIER1_CONNECTION_ACKNOWLEDGED row with actor test@example.com
  and details {"tier":"TIER1","connectorCode":"resend-email"}.

NOT YET PROVEN
  Cancel-negative for Tier 1. Run before the next Tier 1 change:
  disconnect Resend, click Connect, click Cancel, verify no new audit row.
  Slice 4 live demo. Unblocked by Slice 5.

================================================================
4. KNOWN BEHAVIORS BY DESIGN — NOT BUGS
================================================================

CLIENT DISABLE DOES NOT REACH THE AGENT
  Disabling custom-api on the Client leaves the Agent card ENABLED. By design.
  CONNECTOR_DISABLED origination was never built. The receiver recognizes the
  event and returns Ok(AckOutcome::Rejected) — nothing is written, the batch
  continues. Pending the SYNC-ARCHITECTURE.md amendment in §7.

TIER 1 CONNECTORS DO NOT SYNC — UNTIL SLICE 5
  Before Slice 5, resend-email (and twilio-sms) connect on the Client but do
  not appear on the Agent. Only the BYOP Tier 2 path calls
  write_local_connector_credential. Slice 5 adds the Tier 1 credential
  delivery so this becomes false.

TIER 1 AUDIT EVENT NAME
  TIER1_CONNECTION_ACKNOWLEDGED is distinct from
  ZONE_3_CONNECTION_ACKNOWLEDGED. Do not merge them.

================================================================
5. SECURITY — ACTION REQUIRED
================================================================

The Supabase pooler password and the Resend API key were pasted into the chat
log twice. Both are compromised. Rotate:

  1. Supabase dashboard — reset the pooler database password.
  2. Resend dashboard — revoke re_... and issue a new key.

Do this before the next live run. Never paste either value into a chat again.
Every command in §6 uses placeholders.

NEW IN SLICE 5
  Backend env vars GORKA_RESEND_API_KEY and GORKA_RESEND_FROM will hold
  GORKA's own Resend credential. These are also secrets. Handle with the
  same discipline. Never paste them into a chat.

================================================================
6. RUN COMMANDS — THE FIXED RUNBOOK
================================================================

This section exists because an earlier version of this file lacked it and
every new chat re-derived these commands. Do not delete it.

LAYOUT FACTS
  - The repo root C:\gorka-app IS the Client Dashboard. Its package.json is
    named "supervisor-dashboard". There is NO supervisor-dashboard\ folder.
  - The backend has NO package.json. It runs directly from root.
  - There is NO tsx or ts-node in node_modules\.bin. Node 24 strips TypeScript
    natively; `npx tsx` fetches tsx from the registry on first use.
  - cargo run --bin does NOT trigger beforeDevCommand. The vite server must be
    already running, or the Tauri window loads an empty page.
  - Client vite binds 5173. Agent vite binds 5174. Agent tauri.conf.json
    expects 5174. If 5173 is occupied, the ports shift and the Agent fails.
  - The root .env points DATABASE_URL at the DIRECT Supabase host
    (db.<ref>.supabase.co:5432), which is NOT reachable from the cloud
    machine. Every cloud command that touches the DB must set DATABASE_URL
    inline to the pooler URL. Prisma Client does NOT auto-load .env when a
    script is run directly with `node`; import 'dotenv/config' at the top of
    the script, or set the variable in the shell first.
  - The cloud default Temp folder causes cargo link failures with LNK1104
    "cannot open file lnk{...}.tmp" on this VM. Fix: set TMP and TEMP to
    C:\cargo-tmp before cargo build in every cloud terminal. The setting is
    per-terminal and does not survive a new window. Not disk space; not
    antivirus; confirmed to be the default Temp location.

FIVE TERMINALS. Order matters.

Terminal 1 — Backend
    cd /d C:\gorka-app
    set DATABASE_URL=<pooler url>
    set RESEND_API_KEY=<resend key>
    set GORKA_RESEND_API_KEY=<gorka resend key>       (Slice 5+)
    set GORKA_RESEND_FROM=<from address>              (Slice 5+)
    npx tsx src/backend/index.ts
  Wait for "listening on port 3000". Leave running.

Terminal 2 — Client vite
    cd /d C:\gorka-app
    npm run dev
  Wait for "Local: http://localhost:5173/".

Terminal 3 — Agent vite
    cd /d C:\gorka-app\agent-dashboard
    npm run dev
  Wait for "Local: http://localhost:5174/". If it is not 5174, stop.

Terminal 4 — Client Tauri window
    cd /d C:\gorka-app
    cargo run --bin gorka-client
  Window opens. Log in, unlock.

Terminal 5 — Agent Tauri window
    cd /d C:\gorka-app
    cargo run --bin gorka-agent
  Window opens. Log in, unlock.

DEMO SEQUENCE — SLICE 5 (see SLICE-5-SPEC.md §13)

================================================================
7. ARCHITECTURE DEFECT — ESCALATED, NOT FIXED
================================================================

SYNC-ARCHITECTURE.md §12.9 states the order-independence invariant: same
accepted events produce the same final state, regardless of arrival order.

§25.15.5 and §25.16.5 (CONNECTOR_DISABLED, CONNECTOR_CREDENTIAL_REPLACED)
contain arrival-order-dependent behavior. §25.14.6 concedes the violation
in writing: "The MVP does not add a deterministic protocol-order tie-break
for CONNECTOR records, because the deployment model rules out the case."

RESOLUTION TAKEN (Slice C)
The slice narrowed to CONNECTOR_ENABLED only. DISABLED and REPLACED are
recognized, validated, and deferred. The deferred guard returns
Ok(AckOutcome::Rejected) — not Err, because Err propagates out of
process_sync_message and kills the whole batch.

THREE OPTIONS — DECISION STILL OPEN
  A. Restore conformance. Add winning_logical_clock / winning_device_id /
     winning_sequence columns to local_connectors. Protocol-order tie-break
     on every CONNECTOR event. DISABLED becomes soft-delete. §25.14.6's
     punt is deleted. Requires migration + LOCAL-TABLES.md + three section
     amendments + a code slice.
  B. Amend §12.9 to carve out CONNECTOR records. One sentence. Weakens a
     MUST clause permanently.
  C. Tombstone table. Same tie-break as A, DISABLED writes a tombstone row.
     Overkill for single-origination-source deployment.

RECOMMENDATION: Option A. Not yet decided by the founder.

================================================================
8. FROZEN WIRE FORMAT (SYNC-ARCHITECTURE.md §25.14.3)
================================================================

CONNECTOR_ENABLED payload, fields in fixed order:

  connector_code    0x6001  UTF-8 string
  tier              0x6002  UTF-8 string (TIER1 or TIER2)
  credential_value  0x6003  binary blob (must not be empty)
  configuration     0x6004  UTF-8 string (RFC 8785 canonical JSON; may be empty)
  enabled_at        0x6005  u64

Event type code 0x0005. Entity type code 0x06 (connector).

RECEIVING BEHAVIOR (§25.14.5)
  Query local_connectors for (organization_id, connector_code).
  Absent  -> INSERT with status = 'ENABLED', source_device_id = event.device_id hex.
  Present -> UPDATE the same fields.
  Write audit entry SYNC_CONNECTOR_ENABLED.
  Advance logical clock (done by process_event).
  Append to sync_events (done by process_event).
  No entity_field_state rows.

RECONNAISSANCE FINDINGS — DO NOT RE-DERIVE
  - Parsers in shared/src/sync_parse.rs for all three CONNECTOR payloads.
    Encoders in shared/src/sync.rs. Both committed.
  - upsert_local_connector does NOT open a transaction; rusqlite::Transaction
    derefs to Connection, so calling it inside a caller-owned tx works.
  - originate_event requires an open transaction and does not commit.
  - JSON.stringify is NOT RFC 8785. Adequate for the current single-key config.
  - §25.14.4 does not require connector_code to exist in the catalog.
  - §25.14.5 says store payload.tier as transmitted.
  - Client's source_device_id is the placeholder "local-device".
  - process_event returns Result<AckOutcome, String>. Err propagates out of
    process_sync_message via ?.
  - log_audit: fn log_audit(conn: &Connection, action: &str, debtor_id:
    Option<&str>, record_count: i64, details: &str) at shared/src/db.rs:735.
  - communications::insert_communication ALREADY originates a
    COMMUNICATION_LOGGED sync event (lines 140 and 198).
  - shared/src/connectors/http_reqwest.rs is production-ready.
  - Twilio credential JSON is {"accountSid","authToken"}. Config is {"from"}.
  - Resend credential JSON is {"apiKey"}. Config is {"from"}.

================================================================
9. ENDPOINTS
================================================================

src/backend/routes/connectors.routes.ts, mounted at /api/connectors:

  GET   /api/connectors          caller's org enablements
  GET   /api/connectors/catalog  active catalog rows
  POST  /api/connectors/enable   { connectorCode, credentialsLocation:'LOCAL',
                                   zone3Acknowledged?: boolean,
                                   tier1Acknowledged?: boolean }
                                 Slice 5 adds: response includes optional
                                 `credential` field for Tier 1 connectors.
  POST  /api/connectors/disable  { connectorCode }

Other routes: POST /api/auth/login, GET /api/auth/me, POST /api/metrics/sync,
POST /api/activity/sync, GET /api/boundary-proofs, POST /api/connector-usage/sync,
GET /api/billing/*, GET /api/licenses/*, POST /api/licenses/set-plan.

No new endpoints in Slice 5. Credential sync is device-to-device.

================================================================
10. FILE INVENTORY
================================================================

REFERENCE FILES
  shared/src/sync.rs              encoders
  shared/src/sync_parse.rs        parsers
  shared/src/sync_handshake.rs    AckOutcome enum
  shared/src/db.rs                log_audit at 735; audit_log at 746
  shared/src/connectors/mod.rs    ConnectorAdapter, ConnectorCredential,
                                  SendRequest, SendResult (Serialize),
                                  ConnectorRegistry, build_default_registry
  shared/src/connectors/http.rs, http_reqwest.rs
  shared/src/connectors/resend_email.rs
  shared/src/connectors/twilio_sms.rs
  shared/src/connectors/mocean_sms.rs
  shared/src/communications.rs
  shared/src/storage.rs
  src-tauri-agent/src/auth.rs
  src-tauri-agent/src/main.rs
  agent-dashboard/src/pages/DebtorProfilePage.tsx
  agent-dashboard/src/components/SendSmsModal.tsx (Slice 4, will be replaced)
  prisma/seed-connectors.ts

RECOVERY DOCUMENTS
  GORKA_RECOVERY/recovery-notes/RESUME-HERE.md       this file (v2.3)
  GORKA_RECOVERY/recovery-notes/SLICE-5-SPEC.md      next slice spec
  GORKA_RECOVERY/recovery-notes/CONNECTION-CENTER.md model spec
  GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md   older spec
  GORKA_RECOVERY/recovery-notes/SYNC-ARCHITECTURE.md v1.6
  GORKA_RECOVERY/recovery-notes/LOCAL-TABLES.md      v1.4
  GORKA_RECOVERY/recovery-notes/CLOUD-TABLES.md
  GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md    v1.3
  GORKA_RECOVERY/recovery-notes/GORKA-MVP-SCOPE.md   v1.1
  GORKA_RECOVERY/recovery-notes/MULTI-USER-CONCEPT.md v2.0
  GORKA_RECOVERY/recovery-notes/RECOVERY-RULES.md

SCHEMA (prisma/schema.cloud.prisma)
  OrganizationAuditEvent    line 280
  ConnectorCatalog          line 343
  ClientConnector           line 364

SEED (prisma/seed-connectors.ts)
  twilio-sms     LIVE           isManagedByGorka: true
  twilio-voice   COMING_SOON    isManagedByGorka: true
  resend-email   LIVE           isManagedByGorka: true
  mocean-sms     COMING_SOON    isManagedByGorka: true
  gemini-ai      COMING_SOON    isManagedByGorka: true
  custom-api     LIVE           isManagedByGorka: false

================================================================
11. ADAPTOR INVENTORY vs CATALOG
================================================================

  resend-email    LIVE          adapter yes            Tier 1 + BYOP (Slice 5)
  twilio-sms      LIVE          adapter yes            Tier 1 (dormant) + BYOP (Slice 5)
  mocean-sms      COMING_SOON   adapter yes            no UI yet
  twilio-voice    COMING_SOON   no adapter             placeholder (Slice 5)
  gemini-ai       COMING_SOON   no adapter             none
  custom-api      LIVE          no adapter (placeholder) BYOP + Zone 3

Rule: a catalog row makes a connector appear. An adapter makes it work.
Adding a row is a data edit. Adding an adapter is a code slice.

================================================================
12. FOUNDER'S DIRECTION — NON-NEGOTIABLE
================================================================

  - Admin connects once. Every agent device sees the tool. No alternative flow.
  - The agent user never types or sees the provider credential. The Agent
    application stores it in local SQLCipher and uses it to send.
  - All catalog rows are GORKA-managed unless explicitly BYOP. The label is
    aspirational until the adapter and provisioning exist. Tier 1 provisioning
    is funded phase.
  - Data vendors (credit bureaus, skip tracing) are BYOP-only. Always.
  - Retired vendors disappear from the UI. Metadata remains for compliance.
  - Two declarations, one per tier. Tier 1 is honest disclosure; Tier 2 is a
    warning. Both are wired.
  - Connector catalog changes are data operations, not code.

AGENT-FACING UX VISION (locked 2026-10-08, drives Slice 5)
  Two distinct Agent pages, two distinct jobs:

  Communication Tools page — the GLANCE.
    Shows every enabled connector. The agent's morning orientation.
    Read-only. Unchanged from Slice C.

  Debtor Profile page — the ACTION SURFACE.
    Where the agent works. All enabled connectors reachable from here.
    Grouped by channel (SMS, Email, Voice). Agent chooses a connector,
    the action modal opens with that connector preselected.

  Sync keeps both pages honest. Admin changes the set on the Client,
  both Agent pages update.

  Do not add per-connector actions to the Communication Tools page. That
  page is a status view. Acting happens from the debtor profile.

================================================================
13. WORKING RULES
================================================================

  - Invariant: no debtor data in GORKA cloud infrastructure.
  - All Rust builds and tests run on cloud. Main cannot reliably compile.
  - One machine owns a slice at a time. Git is the only handoff.
  - Edits on main. Commit on main, push, pull on cloud, build/test/verify on
    cloud, pull back on main.
  - Content anchors only for scripted edits. Never raw line indices. Never
    String.Replace on recovery documents.
  - findstr treats spaces as OR. Use /C:"literal" for exact matches.
  - Verify with findstr after every edit. git diff before commit.
  - One commit per coherent change. Multi-commit slices are fine.
  - npx prisma db push always needs --schema=prisma/schema.cloud.prisma plus
    the pooler DATABASE_URL override.
  - When giving commands to the founder: open-file command first
    (notepad <path>), then the edit content, then the verify command. One file
    at a time. Do not batch.
  - Whole-file replacement: output the whole file. Do not do incremental
    anchor edits across many turns. They produce wrong-file edits.
  - When in doubt, stop and ask. Do not guess.

================================================================
14. SLICE PLAN — DONE, IN FLIGHT, REMAINING
================================================================

DONE (prior sessions)
  gorka-shared::connectors skeleton (trait, types, registry).
  Adapters: resend-email (live-verified), twilio-sms (production-ready),
            mocean-sms (unit-tested).
  B1, B2  Connectors.tsx alignment.
  B3      Tier 2 credential local write.
  B4      Zone 3 audit record (BYOP path).
  B4b     Zone 3 declaration gate.
  C5      Credential-leak regression per adapter.
  Session A  Twilio SMS and Mocean SMS adapters.
  Slice C    Connector enablement sync. §2.
  Slice 1    Tier 1 declaration gate. §2b.
  Agent restart test — passed.
  Slice 4    Send-from-agent (Twilio SMS), code only. §2c.

IN FLIGHT
  None.

NEXT
  SLICE 5 — Both channels + Agent Communication card. §2d and
  SLICE-5-SPEC.md. Implementation-ready.

REMAINING — DEPENDENCY ORDER, NOT SCHEDULE
  1. Rotate credentials. §5.
  2. SLICE 5. §2d. Eleven commits. TypeScript + backend only.
  3. Slice 4 live demo. After 2.
  4. SYNC-ARCHITECTURE.md amendment — resolve §25.15.5/§25.16.5 vs §12.9.
     Then CONNECTOR_DISABLED and CONNECTOR_CREDENTIAL_REPLACED origination
     and apply.
  5. Compliance rules page (B5, B6).
  6. Compliance enforcement layer — preflight check in the send flow.
  7. Second send path (Resend email) — proves the pattern generalises.
  8. Copilot command (C3, C4) + AI boundary layer — largest block.
  9. Tier 1 credential transit verification (B7) — review-only.
 10. Acceptance — end-to-end.

DOCS-ONLY / TEST-ONLY
  - V6 stale lines in SYNC-TEST-VECTORS-v1.md.
  - Mocean SMS HTTP shape confirm against current docs.
  - CONNECTION-CENTER.md §14 A3 wording.
  - 5a-vectors — three CONNECTOR event hex vectors.
  - Registry invariant test (C6).
  - Client-side canonicalization of configuration when it gains multiple keys.

================================================================
15. OPEN ITEMS
================================================================

  - Credentials not yet rotated (§5).
  - Cancel-negative for Tier 1 not yet run (§3).
  - Slice 4 live demo — runs after Slice 5.
  - Cloud cargo build needs TMP/TEMP override (§6).
  - .bak files in working tree, untracked. Delete at leisure.
  - CHAT-HANDOFF-DUMP.txt and make-dump.ps1 untracked at root.
  - Client disable does not propagate to Agent (§4).
  - Mocean SMS HTTP shape unconfirmed against current docs.
  - twilio-voice and gemini-ai adapters not built.
  - SYNC-ARCHITECTURE §7 A/B/C decision — not made.

================================================================
16. HOW TO USE THIS FILE
================================================================

  At the start of a new chat: paste this file AND SLICE-5-SPEC.md. That is
  the brief. Both together are self-contained.
  At slice end: rewrite this file in place. Do not append.
  If the chat dies unexpectedly: this file is stale by at most one operation.

================================================================
APPENDIX A — SLICE 5 CLOSE (added v2.4, 2026-10-09)
================================================================

A.0 — WHY THIS APPENDIX EXISTS

  Sections 1–16 above are the v2.3 snapshot. They were written before
  Slice 5 ran. Several of their assumptions turned out to be wrong, and
  the plan in §14 was rewritten as a result. Both versions are kept so
  the drift is visible and the old plan can be consulted if a question
  arises about what we thought before.

  Where the body and the appendix conflict, the appendix wins.

================================================================
A.1 — MACHINE STATE AT SLICE 5 CLOSE
================================================================

MAIN:    HEAD 9358b60 plus the appendix commit that follows it.
         Pushed through 9358b60. Clean tree except untracked
         CHAT-HANDOFF-DUMP.txt and make-dump.ps1.
CLOUD:   at 9358b60. Slice 5 built, tested, and live-verified.
         Cloud is currently closed.

Slice 5 commits (13 code commits, cdde504..9358b60):

  cdde504  backend: return GORKA Tier 1 credential from enable
  c56c699  connectors.service: enable returns credential alongside row
  5d98815  Connectors.tsx: two buttons on Tier 1 cards; write Tier 1 credential
  638ffdf  client: ResendByopModal
  a56dead  client: TwilioByopModal
  b052d62  Connectors.tsx: route by code to the right BYOP modal
  a6179ba  agent: SendMessageModal (replaces SendSmsModal)
  6357779  agent: CommunicationCard and CallComingSoonModal; mount on debtor profile
  f505bd8  DebtorProfilePage: fix JSX sibling error from CommunicationCard mount
  daf01dd  agent: fix Button variant (ghost, not secondary)
  61b01ae  backend: wrap GORKA Resend credential as JSON envelope ({apiKey})
  3d593aa  agent: SendMessageModal collects a subject for email; filter dropdown
  9358b60  agent: derive communication type from connector channel

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -6
    git status --short

================================================================
A.2 — WHAT SLICE 5 SHIPPED
================================================================

GOAL (achieved, live-verified)
  Two channels for every connector. Tier 1 delivers GORKA's credential
  from the backend to the admin's device; BYOP collects the admin's own
  credential. Both converge at write_local_connector_credential. Agent
  debtor profile gains a Communication card grouped by channel.

  The v2.3 §2d entry titled "SLICE 5 — PLANNED, NOT STARTED" is now
  historical. Read it for what Slice 5 was supposed to be. Read §A.3
  below for what running it actually revealed.

================================================================
A.3 — FINDINGS — WHAT RUNNING THE CODE TAUGHT US
================================================================

This is the section the body of the file could not have. Every entry
below was discovered by doing the thing, not by planning it.

F1. REGISTRATION / ONBOARDING IS A HARD GAP, NOT A LATER FEATURE
    Slice 5's demo could not send until `user_id` was added by hand to
    the Agent's settings.dat. Root cause: the Agent's auth flow writes
    `user_id` on login, but the pilot's Agent had never run a real
    login — it was hand-populated with mock values, and `user_id` was
    not among them.
    Bigger picture: the whole registration path is unbuilt.
      - No marketing-site registration exists. There is no way for an
        admin to create an organization through the product.
      - No admin-creates-agent-user flow exists. AGENT-APP-SPEC §4
        says "credentials the admin has provided" but never says how.
      - Every current login is either a real backend login against a
        manually seeded user, or a hand-populated settings.dat.
    This is not a Slice 5 defect. It is a subsystem that predates
    Slice 5 and was standing in the way the whole time.

F2. SLICE 4 SHIPPED A LATENT TYPE ERROR
    SendSmsModal.tsx used Button variant="secondary", which ButtonVariant
    (agent-dashboard/src/components/primitives/Button.tsx) does not
    accept. It is 'primary' | 'ghost' | 'danger'. Never compiled because
    Slice 4 did not run `npm run build` on agent-dashboard. Fixed in
    daf01dd.

F3. SLICE 4'S RUST SEND HARDCODED COMMUNICATION TYPE AS "SMS"
    send_connector_message wrote r#type: "SMS".to_string() unconditionally.
    When Slice 5 generalized the UI to email, the adapter was sending
    emails but the communications rows said SMS. Fixed in 9358b60 with
    communication_type_for(connector_code) → SMS/EMAIL/CALL.

F4. THE RESEND CREDENTIAL FORMAT DISAGREED WITH THE ADAPTER
    SLICE-5-SPEC §5 said the backend should return the Resend API key
    as raw UTF-8 bytes. The Rust adapter (resend_email.rs) parses the
    credential as JSON and expects {"apiKey": "..."}. Twilio was
    already correct because the spec said to JSON-wrap it. Fixed in
    61b01ae by wrapping the Resend value in the same shape.

F5. EMAIL NEEDS A SUBJECT — SLICE 4'S MODAL NEVER HAD ONE
    SendMessageModal was generalized from SMS, where subject does not
    exist. Resend returns HTTP 422 with "Missing `subject` field" when
    it is absent. Fixed in 3d593aa by adding a Subject input shown only
    when the selected connector ends in -email.

F6. COMPILE-TIME AND DEMO-TIME DEFECTS ARE DIFFERENT CLASSES
    Two bugs (F7, F8 below) were caught by `npm run build`. Three bugs
    (F3, F4, F5) were caught only by actually running the send against
    a real provider. cargo and node verify caught none of the five.
    This is why the cloud trip rule in §A.7 exists.

F7. JSX SIBLING ERROR (compile-time)
    CommunicationCard was placed inside {!isRelated && (...)} in
    DebtorProfilePage, giving that JSX expression two children. tsc
    error TS2657. Fixed in f505bd8 by moving CommunicationCard out of
    the conditional.

F8. BUTTON VARIANT (compile-time)
    See F2. Fixed in daf01dd.

F9. COMMUNICATION TOOLS PAGE DOES NOT RE-RENDER ON SYNC
    Newly-enabled connectors appear on the Agent's Communication Tools
    page only after a manual refresh. The page reads on mount only. Sync
    delivers within seconds — the rendering does not follow. Small UX
    gap, not a correctness bug.

F10. VITE WATCHER DIES WHEN CARGO REBUILDS
    Root vite.config.ts watches the whole repo including target/. During
    cargo build it hits EBUSY on target\debug\deps\gorka_agent.exe and
    the vite process crashes. Restarting Terminal 2 recovers it. Proper
    fix: add server.watch.ignored for **/target/** in vite.config.ts.
    Not done.

F11. THE AGENT'S settings.dat IS HAND-POPULATED
    The demo depends on a hand-edited settings.dat with a hardcoded
    user_id. If that file is lost, the Agent hits "No user ID found" on
    the first send. Recorded here so a future session knows why the
    Agent can log in "for real" and still depend on a stale artifact.

================================================================
A.4 — DEVIATIONS FROM SLICE-5-SPEC
================================================================

D1. Commit count. Spec §11 planned 11 commits. Delivered 13 (plus the
    appendix commit). The extra two are compile-time fixes (f505bd8,
    daf01dd); the extra three are demo-driven fixes (61b01ae, 3d593aa,
    9358b60). Neither class existed in the spec's plan.

D2. Commit grouping. Spec Groups 3 and 4 were merged. The card owns
    the modal and the placeholder; splitting produced commits where
    nothing mounted what was built.

D3. .css files for the two BYOP modals. Spec §10 listed .css files.
    Delivered inline-styled, matching the sibling ConfigurationModal.tsx.

D4. Credential gate. Spec §5 described the credential as returned "for
    connectors where the backend holds a GORKA credential." Delivered
    with an additional tier1Acknowledged === true gate.

D5. Twilio SID pattern. Spec §6 said "starts with AC". Delivered with
    ^AC[0-9a-fA-F]{32}$.

D6. The spec's claim that the Agent's send path was unchanged was wrong.
    See F3. This is the one deviation that is a spec error, not a spec
    gap.

================================================================
A.5 — REVISED PLAN
================================================================

This section supersedes v2.3 §14's "REMAINING — DEPENDENCY ORDER" list.
The old list treated registration as a solved prerequisite. It is not.
Everything downstream of the send path depends on identity working.

DONE (all prior sessions, plus Slice 5)
  gorka-shared::connectors skeleton. All three adapters.
  B1, B2, B3, B4, B4b, C5. Session A.
  Slice C    Connector enablement sync.
  Slice 1    Tier 1 declaration gate.
  Slice 4    Send-from-agent (Twilio SMS) — code complete; live-verified
             through the Resend Email path on 2026-10-08.
  SLICE 5    Both channels + Agent Communication card. Code-verified on
             cloud and live-verified 2026-10-08.

IN FLIGHT
  None.

NEXT — RECOMMENDED, IN ORDER

  1. REGISTRATION / ONBOARDING.
     The registration gap (F1) is the top blocker. Nothing else lands on
     a real client without it. Its own slice, or likely its own block of
     slices. Deserves a planning session before any code.
     Deliverables to scope:
       - Marketing-site registration: admin creates an organization.
       - Organization creation writes the first user (role CLIENT or OWNER).
       - Admin-creates-agent-user flow: invite, initial password, role
         assignment. Nothing in AGENT-APP-SPEC or MULTI-USER-CONCEPT
         covers this today.
       - Enrollment package export UI on the Client (AGENT-APP-SPEC §12
         open item: "export_enrollment_package exists but has no UI").
       - Frozen doc amendments likely required:
         MULTI-USER-CONCEPT §5 (device identity), AGENT-APP-SPEC §4.

  2. SYNC-ARCHITECTURE.md §7 A/B/C decision (unchanged from v2.3 §7).
     Then CONNECTOR_DISABLED and CONNECTOR_CREDENTIAL_REPLACED
     origination and apply.

  3. B7 credential-transit review (CONNECTOR-MODEL.md §14.2 item B7).

  4. Cancel-negative for Tier 1 (v2.3 §3 NOT PROVEN).

REMAINING — DEPENDENCY ORDER, NOT SCHEDULE
  1. Compliance rules page (B5, B6).
  2. Compliance enforcement layer — preflight check in the send flow.
  3. Twilio SMS BYOP send. Same adapter pattern as Resend; different
     adapter. Small verification slice.
  4. Copilot command (C3, C4) + AI boundary layer — largest block.
  5. Acceptance — end-to-end.

DOCS-ONLY / TEST-ONLY (additive to v2.3 §14's list)
  - vite.config.ts: server.watch.ignored for **/target/** (F10).
  - V6 stale lines in SYNC-TEST-VECTORS-v1.md.
  - Mocean SMS HTTP shape confirm.
  - CONNECTION-CENTER.md §14 A3 wording.
  - 5a-vectors — three CONNECTOR event hex vectors.
  - Registry invariant test (C6).

================================================================
A.6 — NEW OPEN ITEMS (additive to v2.3 §15)
================================================================

  - REGISTRATION / ONBOARDING GAP. Top of the list. §A.5 NEXT item 1.
  - Agent settings.dat user_id was added by hand for the demo. §F11.
    Depends on item above to become a non-issue.
  - Communication Tools page does not re-render on sync. §F9.
  - Vite watcher EBUSY on cargo build. §F10.
  - Slice 4/5 live demo — CLOSED 2026-10-08.
  - Slice 5 cloud verification — CLOSED 2026-10-08.
  - All other v2.3 §15 items remain open.

================================================================
A.7 — PROCESS AMENDMENTS
================================================================

P1. MAIN CANNOT RUN CARGO. SAC blocks it. All builds, tests, and
    type-checks run on cloud. v2.3 §6's runbook said "cloud trip"; it
    did not say main cannot build at all. The distinction matters:
    main is edit-only.

P2. THE CLOUD TRIP MUST INCLUDE BOTH `npm run build` COMMANDS.
    Not just cargo. F6 is the reason: cargo and node verify caught
    none of the five Slice 5 defects. Both `npm run build` commands
    (root for Client, agent-dashboard for Agent) are the only gate
    that catches TypeScript errors. Both are `tsc && vite build`; the
    tsc step is the type-check.

P3. THE CLOUD TRIP IS ALSO THE LIVE DEMO MACHINE. Cloud is not just
    for compile-verification; it is where the five terminals run.
    Demo-driven defects (F3, F4, F5) are a distinct class from
    compile-driven defects (F7, F8). Both classes belong in the close
    process.

P4. DEMO-DRIVEN FIXES ARE THEIR OWN COMMITS. A defect that only
    appears when the code runs against a real provider is worth its
    own commit and its own line in the deviation record. It is
    evidence about the spec.

P5. RESUME-HERE IS NOW APPEND-ONLY. The v2.3 rule ("At slice end:
    rewrite this file in place. Do not append.") is superseded. New
    slices add an appendix; existing sections are not rewritten.
    Rationale: the v2.4 rewrite destroyed the baseline and made drift
    invisible. See A.0.

P6. BEFORE EDITING RECOVERY DOCS, THE CURRENT COMMITTED VERSION IS
    THE SOURCE OF TRUTH. Restore from git if the working copy is
    uncertain:

        git checkout <commit> -- <path>

    Never edit a recovery doc that might already be modified. The
    committed version is what future sessions will trust.

================================================================
END OF APPENDIX A
================================================================

================================================================
APPENDIX B — CONNECTOR READINESS SPEC, STEP 1 (MEDIUM)
(added v2.5, 2026-10-09)
================================================================

B.0 — WHY THIS APPENDIX EXISTS

Appendix A (v2.4) closed Slice 5. The 2026-10-09 session reworked the
connector UI model and produced a spec for the next slice. That spec
was originally drafted as a standalone file,
CONNECTOR-READINESS-SPEC.md. The founder asked for consolidation:
too many separate specs, direction drifts across them. The standalone
file was deleted and its content lives here instead.

From v2.5 forward, RESUME-HERE is the single source of state AND the
current plan. New standalone spec documents only when there is
genuinely new territory (the AI boundary layer is one such case).

Where this appendix and any earlier section of RESUME-HERE conflict,
this appendix wins.

================================================================
B.1 — GOAL
================================================================

Restructure the Client's Connectors page into:

  GORKA built-in table    catalog rows with isManagedByGorka = true.
                          One card per row. One button per card:
                          "Connect (GORKA)".

  BYOP section            three sub-tables, each with its own header
                          and its own visible boundary:
                            A. Use my own account          (build now)
                            B. New connectors — coming soon (placeholder)
                            C. Data sources — coming soon   (placeholder)

Build Path B: a schema-driven modal. The catalog row carries a
`credentialSchema` JSON field. One generic modal reads it and renders
whatever fields the schema names. Adding a connector is a seed edit
plus an adapter. No new frontend components.

Ship the backend enable-if-absent rule so a second add of the same
provider is a silent no-op at the database level.

Retire the second button ("Use my own account") on Tier 1 cards and
the phrase itself. Delete the two Slice 5 per-connector BYOP modals.

================================================================
B.2 — DECISIONS LOCKED
================================================================

  1. Rule A. isManagedByGorka decides the table. A vendor appears in
     exactly one top-level table. Tier 1 vendors are GORKA built-in
     only. No second button on any card.

  2. Path B. Schema-driven modal, driven by credentialSchema on the
     catalog row. No per-connector React components.

  3. Q1-B-1. The BYOP sub-table A dropdown reads the catalog, filtered
     by: credentialSchema is present AND mvpStatus is 'LIVE'. No
     hardcoded provider list in the frontend.

  4. Q2. Flip mocean-sms mvpStatus from COMING_SOON to LIVE in the
     seed. Its adapter exists. Its schema will be filled in.

  5. Q3. Three BYOP sub-tables. A is functional. B and C are
     placeholders (headers, subtitles, disabled buttons).

  6. Q4 + follow-up. Two protections against duplicate adds:
       a. UI: dropdown hides providers already added.
       b. Backend: enable-if-absent. A second enable for a
          (organization, connector) whose row is already CONNECTED
          is a silent no-op. Returns the existing row. Adds
          alreadyEnabled: true to the response. No write.

  7. Silent handling of alreadyEnabled. The Client closes the modal
     and reloads. No popup, no banner.

  8. Voice stays a placeholder. No change.

  9. No Rust change. No sync change. No new event type.

================================================================
B.3 — FILES CHANGED
================================================================

EDITED
  prisma/schema.cloud.prisma
  prisma/seed-connectors.ts
  src/backend/routes/connectors.routes.ts
  supervisor-dashboard/src/services/connectors.service.ts
  supervisor-dashboard/src/components/Connectors/ConfigurationModal.tsx
  supervisor-dashboard/src/pages/Connectors.tsx

DELETED
  supervisor-dashboard/src/components/Connectors/ResendByopModal.tsx
  supervisor-dashboard/src/components/Connectors/TwilioByopModal.tsx

UNCHANGED
  supervisor-dashboard/src/components/Connectors/DeclarationModal.tsx
  Any Rust file.
  Any sync file.
  Any other backend route.
  The Agent's pages and components.

================================================================
B.4 — SCHEMA CHANGE
================================================================

In prisma/schema.cloud.prisma, ConnectorCatalog model, add one
nullable field after documentationUrl (currently line 357):

    credentialSchema  Json?    @map("credential_schema")

Nullable. Existing rows unaffected. One Prisma migration.

================================================================
B.5 — SEED CHANGE
================================================================

Two edits to prisma/seed-connectors.ts.

B.5.1 — Add a credentialSchema value to every row object.
  All six rows receive one. See B.8 for exact values.

B.5.2 — Add credentialSchema to the upsert update block:
    credentialSchema: c.credentialSchema,
  Without this, existing rows keep their old null value on re-seed.
  This exact bug is documented in SESSION-HANDOFF §5.7.

B.5.3 — Flip mocean-sms mvpStatus: 'COMING_SOON' -> 'LIVE'.
  One line. Nothing else changes in that row.

Do not change any isManagedByGorka value.

================================================================
B.6 — BACKEND CHANGE
================================================================

File: src/backend/routes/connectors.routes.ts, POST /enable handler.

Replace the transaction body. New behaviour: enable-if-absent.

  1. Look up the existing client_connectors row for
     (organizationId, connectorCode).

  2. If the row exists AND status === 'CONNECTED':
     - Do not write.
     - Do not create the tier1/zone3 acknowledgement audit row
       again (re-recording would be a false history).
     - Build the response with alreadyEnabled: true.
     - For tier1Acknowledged: still call getGorkaCredential. If
       configured, include it (fresh device can receive the
       credential without re-provisioning).

  3. If the row does not exist, or exists with status DISCONNECTED:
     - Proceed as today: upsert to CONNECTED, write audit row if
       acknowledged, build response without alreadyEnabled.

Response shape:
  { success: true, data: <row>, alreadyEnabled?: true,
    credential?: { value, configuration } }

The unique constraint on (organizationId, connectorCode) stays.
It is the final safety net; the check above is the intended path.

No schema change. No new column. No new table.

================================================================
B.7 — CLIENT SERVICE TYPES
================================================================

File: supervisor-dashboard/src/services/connectors.service.ts

Add:

    export interface CredentialField {
      name: string;
      label: string;
      type: 'password' | 'text' | 'email' | 'tel';
      required: boolean;
      placeholder?: string;
      default?: string;
    }

    export interface CredentialSchema {
      credentials: CredentialField[];
      configuration: CredentialField[];
    }

Add to CatalogEntry:
    credentialSchema?: CredentialSchema | null;

Add to EnableResponse:
    alreadyEnabled?: boolean;

Update the `enable` method's return to include
`alreadyEnabled: body?.alreadyEnabled`.

No method signature changes.

================================================================
B.8 — CREDENTIALSCHEMA FORMAT AND VALUES
================================================================

B.8.1 — Format

{
  "credentials": [
    { "name": "apiKey", "label": "API Key", "type": "password",
      "required": true, "placeholder": "re_..." }
  ],
  "configuration": [
    { "name": "from", "label": "From address", "type": "email",
      "required": true, "default": "onboarding@resend.dev" }
  ]
}

Two arrays. credentials becomes the credential value blob
(JSON.stringify of the keyed object). configuration becomes the
configuration blob (JSON.stringify). Matches the existing
handleByopSave(config, credentials) contract exactly.

Field types supported in the modal: password, text, email, tel.
Required: boolean. Placeholder and default: optional strings.
Default pre-populates the input on open.

B.8.2 — Per-connector values

resend-email
  credentials: [{ name: "apiKey", label: "API Key",
    type: "password", required: true, placeholder: "re_..." }]
  configuration: [{ name: "from", label: "From address",
    type: "email", required: true, default: "onboarding@resend.dev" }]

twilio-sms
  credentials: [{ name: "accountSid", label: "Account SID",
    type: "text", required: true, placeholder: "AC..." },
    { name: "authToken", label: "Auth Token", type: "password",
    required: true }]
  configuration: [{ name: "from", label: "From number",
    type: "tel", required: true, placeholder: "+1..." }]

mocean-sms
  credentials: [{ name: "apiKey", label: "API Key",
    type: "password", required: true },
    { name: "apiSecret", label: "API Secret", type: "password",
    required: true }]
  configuration: [{ name: "from", label: "Sender name",
    type: "text", required: true, default: "GORKA" }]

twilio-voice (COMING_SOON; schema recorded now, no adapter yet)
  credentials: [{ name: "accountSid", ... }, { name: "authToken", ... }]
  configuration: [{ name: "from", ... }]

gemini-ai (COMING_SOON; schema recorded now, no adapter yet)
  credentials: [{ name: "apiKey", label: "API Key",
    type: "password", required: true }]
  configuration: []

custom-api
  credentials: [{ name: "apiKey", label: "API Key",
    type: "password", required: true }]
  configuration: []

Note on twilio-voice and gemini-ai: placeholders documenting intent.
Their adapters, when built, revise the schema if the shape differs.

================================================================
B.9 — CONFIGURATIONMODAL REWRITE
================================================================

File: supervisor-dashboard/src/components/Connectors/ConfigurationModal.tsx

Current state: hardcoded credentialFields with a single apiKey input.

New state: render from a credentialSchema prop.

Props:
  isOpen: boolean
  onClose: () => void
  onSave: (config: Record<string, any>,
           credentials: Record<string, any>) => void
  connectorName: string
  provider: string
  credentialSchema: CredentialSchema | null   <-- new

Render:
  - If credentialSchema null or empty, disabled message + disabled
    submit.
  - Section "Credentials" per credentials[].
  - Section "Configuration" per configuration[] (omit if empty).
  - Input by type: password, text, email, tel.
  - label from field.label with red * if required.
  - placeholder from field.placeholder if present.
  - default from field.default on open only.
  - required attribute if field.required.

State: two Record<string, any> objects, initialized on open from
each field's default (or empty string). Reset on close.

On submit: onSave(configuration, credentials). Same order as today.

Styling unchanged.

================================================================
B.10 — CONNECTORS.TSX RESTRUCTURE
================================================================

File: supervisor-dashboard/src/pages/Connectors.tsx

10.1 — Remove imports of ResendByopModal and TwilioByopModal.
       Add `import type { CredentialSchema } ...`.
10.2 — Remove ByopModalKind and byopModalKindFor.
10.3 — Replace byopModal state with:
         showConfigModal: boolean
         selectedByopProvider: string
10.4 — Layout
       Header row unchanged.
       SECTION 1: GORKA built-in — title, subtitle, cards one
         button each (see B.11).
       SECTION 2: Bring your own — title, subtitle, three stacked
         sub-tables A, B, C.
         A. "Use my own account" — <select> + [Add] above a grid;
            empty-state if no BYOP entries.
         B. "New connectors" — disabled button "Add (coming soon)".
         C. "Data sources" — disabled button "Add (coming soon)".
10.5 — Dropdown eligibility
       const byopEligible = rows.filter(r =>
         r.catalog.credentialSchema &&
         r.catalog.mvpStatus === 'LIVE' &&
         (!r.enablement || r.enablement.status !== 'CONNECTED')
       );
       Under the seed after B.5.3: resend-email, twilio-sms,
       mocean-sms.
10.6 — Handlers
       handleConnect, handleTier1Confirm, handleDisconnect:
         unchanged, except handleTier1Confirm early-returns when
         result.alreadyEnabled.
       handleByopProviderSelect: sets selectedByopProvider.
       handleByopAdd: opens Zone 3 declaration (TIER2); on accept
         opens the schema-driven modal.
       handleByopSave(config, credentials): same body as today,
         reads selectedByopProvider for the code.
       closeConfigModal: resets both.
10.7 — Modal mounts
       DeclarationModal: two triggers (Tier 1 connect; BYOP add).
       ConfigurationModal: gains credentialSchema prop.
       Remove ResendByopModal and TwilioByopModal mounts.

================================================================
B.11 — GORKA BUILT-IN CARD
================================================================

  Not connected, LIVE:      one button "Connect (GORKA)"
  Not connected, COMING_SOON: disabled "Coming soon"
  Connected:                button "Disconnect"
  (no second button on any card)

================================================================
B.12 — BYOP CARD
================================================================

Same card shape as GORKA built-in.
  Connected: button "Disconnect"

A BYOP card appears when:
  - the org's client_connectors row for that code exists, AND
  - the code's catalog row has a credentialSchema, AND
  - the code is not already rendered in the GORKA built-in table.

Under Rule A: one vendor, one card. If an admin BYOPs resend-email
(Tier 1 vendor), the GORKA built-in Resend card shows CONNECTED and
no second card appears. Correct. The path used is not displayed on
the card; it is recorded in the local record and the audit event.

================================================================
B.13 — CLOUD TRIP
================================================================

One cloud trip after the code commits are pushed.

  cd /d C:\gorka-app && git pull && set TMP=C:\cargo-tmp && set TEMP=C:\cargo-tmp && set DATABASE_URL=<pooler url> && npx prisma db push --schema=prisma\schema.cloud.prisma && npx prisma generate --schema=prisma\schema.cloud.prisma && npx tsx prisma/seed-connectors.ts && cargo build --workspace && cargo test --workspace && node verify\index.mjs && cd supervisor-dashboard && npm run build && cd ..\agent-dashboard && npm run build && cd ..

Expected:
  prisma db push    adds one nullable column. No destructive prompts.
  prisma generate   regenerates the client with credentialSchema.
  seed              six rows updated; mocean-sms mvpStatus = LIVE.
  cargo build       cache hit; no Rust touched.
  cargo test        unchanged.
  node verify       9/9 unchanged.
  npm run build x2  both pass.

Do not run prisma db push without --schema. Do not answer Y to any
drop-table prompt; if one appears, stop and report.

================================================================
B.14 — LIVE TEST
================================================================

Five terminals on cloud. Backend with GORKA_RESEND_API_KEY and
GORKA_RESEND_FROM set. GORKA_TWILIO_* unset.

CLIENT — Connectors page
  1. Page loads. Two sections with visible boundary.
  2. GORKA built-in: five cards, one button each.
  3. No card has a second button. No "Use my own account" text.
  4. BYOP: three sub-tables visible (A functional, B and C
     placeholders with disabled buttons).
  5. Tier 1 Resend: Connect -> declaration -> CONNECTED.
  6. Resend Disconnect -> DISCONNECTED.
  7. Tier 1 Twilio SMS: Connect -> error "not configured".
     (Dormant-Tier-1 regression.)
  8. Tier 1 Mocean SMS: Connect -> error "not configured".

BYOP sub-table A
  9. Dropdown shows Resend Email, Twilio SMS, Mocean SMS.
 10. Pick Resend -> Add -> declaration -> schema modal
     (API Key + From). Fill, save. Card appears CONNECTED.
 11. Dropdown hides Resend.
 12. GORKA built-in Resend also shows CONNECTED (same row).
 13. Stale-tab re-add: silent no-op, single card.

 14-16. Repeat for Mocean, then Twilio as BYOP.
 17. Dropdown empties.

AGENT — regression only
 18. Communication Tools page renders the same set.
 19. Open a debtor. Communication card renders.
 20. Optional: send via a working connector. Confirm unchanged.

If any step fails, STOP and report. Do not improvise during the
live test.

================================================================
B.15 — OUT OF SCOPE — FLAGGED FOR LATER SLICES
================================================================

  B.15.1 Reinstall / lost local credential. Admin enables Resend
    Tier 1 on Device A. Reinstalls. Local DB empty. Card shows
    CONNECTED from the cloud row. No local credential. No re-fetch
    button. Pre-existing gap, own slice.
  B.15.2 Generic HTTP adapter (Step 1.5). Makes sub-tables B and C
    real. Detailed in §B.16.
  B.15.3 Data-source display surface. Sub-table C, when built,
    returns structured data. No display surface today.
  B.15.4 Credential rotation. No "Reconnect" button. Admin
    Disconnects, then Adds again. Current model.
  B.15.5 Optimistic locking. The enable-if-absent rule (B.6)
    closes duplicate-add. Concurrent overwrite from two tabs is
    still possible. A `version` column + 409 response is the
    standard fix. Deferred.
  B.15.6 Tier indicator on connected cards. Not shown today.

================================================================
B.16 — STEP 1.5 (NEXT SLICE AFTER THIS ONE): GENERIC HTTP ADAPTER
================================================================

Recorded here so the next session does not re-derive it.

B.16.1 — Why "paste credentials" is not enough.
The credential is data. It says "here is a key". It does not say
what to do with it. To make the HTTP call, the Agent needs compiled
code that knows: URL, auth style (Bearer / Basic / header / query),
body shape (JSON / form / query), and response mapping. Today that
knowledge lives in each provider's Rust adapter. No adapter in the
registry = nothing to call.

B.16.2 — Four pieces of work.
  1. Description format (schema + seed): ~1 hour.
  2. Generic Rust adapter (generic_http.rs): 3-5 hours including
     credential-leak regression test.
  3. Admin form (method / URL / auth / body / response mapping):
     4-6 hours usable; ~30 min for a raw JSON textarea (defeats
     the point).
  4. SSRF guardrails (HTTPS-only, IP deny-list): ~1 hour.
     Decision for the founder: the Agent making outbound calls to
     admin-supplied URLs is a new network capability. Not a default.

B.16.3 — Realistic costs.
  Full version: 10-16 hours. Multi-session.
  Narrow version: 6-10 hours including cloud trip and live test.
  Ultra-narrow: 3-4 hours, UX bad enough to undercut the point.

B.16.4 — Why not in Step 1.
  Step 1 is 4-6 hours and ships now. Step 1.5 is a day of work and
  needs its own spec. Folding it in stalls Step 1.

B.16.5 — custom-api has no adapter today.
  custom-api is a catalog row (isManagedByGorka=false, LIVE). The
  card shows a button. It looks like it works. There is no adapter
  behind it. Nothing sends. Step 1 hides it (it is not in the
  BYOP-eligible dropdown because it is not in the plan for
  sub-table A; it does not appear in the GORKA built-in table
  because isManagedByGorka is false). It returns when Step 1.5
  gives it a working generic adapter.

================================================================
B.17 — COMMITS — IN ORDER
================================================================

Group 1 — Schema and seed (2 commits)
  1. schema: add credentialSchema to ConnectorCatalog
  2. seed: add credentialSchema to all rows; flip mocean-sms to LIVE

Group 2 — Backend enable-if-absent (1 commit)
  3. backend: enable-if-absent rule

Group 3 — Client service types (1 commit)
  4. connectors.service: CredentialField, CredentialSchema,
     alreadyEnabled

Group 4 — Modal rewrite (1 commit)
  5. ConfigurationModal: render from credentialSchema

Group 5 — Page restructure (2 commits)
  6. Connectors.tsx: three sub-tables, dropdown, delete per-
     connector BYOP routing
  7. delete ResendByopModal.tsx and TwilioByopModal.tsx

Group 6 — Docs (1 commit at slice close)
  8. RESUME-HERE v2.5 (this appendix)

Total: 8 commits.

================================================================
B.18 — FIRST ACTIONS AFTER APPROVAL
================================================================

  1. Founder approves this appendix.
  2. Read the exact on-disk state of each file before editing
     (schema block, seed block, backend handler, service file,
     modal, page).
  3. Edit in the order of B.17.
  4. Verify each edit with findstr / Select-String before commit.
  5. Push all commits.
  6. Cloud trip (B.13).
  7. Live test (B.14).
  8. Close the slice: RESUME-HERE stays at v2.5, no new file.

No edits start until the founder approves this appendix.

================================================================
================================================================
APPENDIX C — STEP 1 CLOSE (added v2.6, 2026-10-09)
================================================================

STATUS: CODE COMPLETE ON MAIN. CLOUD VERIFICATION PENDING.
        The cloud trip for f872e9b has not yet run. Live test
        not yet run. This appendix is written from the state of
        the code, not from a verified live run. If cloud fails,
        amend this appendix in place (it is current, not
        historical) or add Appendix D with the findings.

================================================================
C.0 — WHY THIS APPENDIX EXISTS
================================================================

Appendix B is the spec Slice/Step 1 implemented. This appendix
records what Step 1 actually shipped, the findings from the first
live run, the fixes, and the decisions made mid-slice that amend
Appendix B. Sections 1–16 and Appendices A/B are unchanged; this
is additive.

Where this appendix and earlier sections conflict, this appendix
wins. Appendix B remains the historical record of what Step 1
was meant to be.

================================================================
C.1 — MACHINE STATE
================================================================

MAIN:    HEAD f872e9b. Pushed to origin/main. Working tree
         clean except CHAT-HANDOFF-DUMP.txt and make-dump.ps1
         (untracked, known).

CLOUD:   at e944453. Has not yet pulled 4b24231 or f872e9b.
         Has not run the credentialSource migration or the
         ApplyNotifier build. First action next session.

Commits added this session:

  dd26719  schema: add credentialSchema to ConnectorCatalog
  976876b  seed: add credentialSchema to all rows; flip mocean-sms
           to LIVE
  e944453  connectors: enable-if-absent; schema-driven BYOP modal;
           two-table UI
  4b24231  connectors: credentialSource field; card placement by
           source; roll back failed Tier 1 connect; hide
           custom-api from BYOP dropdown
  f872e9b  sync_engine: optional ApplyNotifier callback; agent
           emits connector-sync; Communication Tools page
           re-reads on event

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -5
    git status --short

================================================================
C.2 — WHAT STEP 1 SHIPPED
================================================================

GOAL (from Appendix B)
  Restructure the Client's Connectors page into a GORKA built-in
  table and a BYOP section with three sub-tables (A functional,
  B and C placeholders). Schema-driven modal. Enable-if-absent
  backend. Delete the two per-connector BYOP modals.

DELIVERED
  - prisma/schema.cloud.prisma — ConnectorCatalog gains
    credentialSchema Json?. ClientConnector gains
    credentialSource String?.
  - prisma/seed-connectors.ts — credentialSchema on five rows
    (custom-api's is omitted to keep it out of the BYOP dropdown);
    mocean-sms flipped to LIVE.
  - src/backend/routes/connectors.routes.ts — enable-if-absent
    rule; credentialSource computed from tier1/zone3
    acknowledgments and written to both create and update paths;
    getGorkaCredential unchanged.
  - supervisor-dashboard/src/services/connectors.service.ts —
    CredentialField, CredentialSchema, credentialSchema on
    CatalogEntry, credentialSource on EnablementRow,
    alreadyEnabled on EnableResponse.
  - ConfigurationModal.tsx — rewritten to render entirely from a
    credentialSchema prop. No per-connector React code.
  - Connectors.tsx — GORKA built-in section, BYOP section with
    three sub-tables, schema-driven modal mount, sections split
    by credentialSource (Rule C).
  - ResendByopModal.tsx and TwilioByopModal.tsx — deleted.
  - shared/src/sync_engine.rs — ApplyNotifier type alias;
    optional field on DiscoveryConfig and ListenerConfig;
    threaded through start_engine_connect, start_engine_listen,
    run_engine, run_session; call site in run_session wrapped in
    catch_unwind.
  - shared/tests/sync_engine.rs — two fixtures gain
    apply_notifier: None.
  - src-tauri-agent/src/main.rs — notifier closure in
    start_engine_inner that emits "connector-sync" via the
    AppHandle.
  - src-tauri/src/main.rs — Client passes apply_notifier: None.
  - agent-dashboard/src/pages/CommunicationToolsPage.tsx —
    listener-first registration, generation-counter guarded
    reads, cleanup invalidation. Page auto-refreshes on
    connector-sync.

================================================================
C.3 — FINDINGS AND RESOLUTIONS
================================================================

From the first live run (client and agent against a live backend
and DB), six findings were recorded. Five are resolved in this
slice; one is deferred.

  F12  Failed Connect (GORKA) left the row CONNECTED.
       RESOLVED in 4b24231. Frontend rolls back via disable()
       when the backend returns no credential.

  F13  custom-api appeared in the BYOP dropdown.
       RESOLVED in 4b24231. custom-api's credentialSchema is
       omitted from the seed, so the eligibility filter excludes
       it. It returns when a generic adapter exists (Step 1.5
       was going to build one; see C.8 for why that shrank).

  F14  Card placement ignored credential source.
       RESOLVED in 4b24231. New field credentialSource on
       ClientConnector. Sections split by source. See C.4.

  F15  custom-api stuck on Agent after Client disabled it.
       DEFERRED. Known design gap. Belongs with the
       CONNECTOR_DISABLED origination work (§7 A/B/C decision
       still pending).

  F16  twilio-sms missing on Agent after Client connected it.
       RESOLVED as a side-effect of F12. With rollback, the row
       no longer gets stuck CONNECTED-without-credential; the
       CONNECTOR_ENABLED event either originates correctly or
       not at all.

  F17  Communication Tools page did not auto-refresh on sync.
       RESOLVED in f872e9b. Engine notifier → Tauri event →
       frontend re-read. See C.5.

================================================================
C.4 — RULE C — CARD PLACEMENT BY CREDENTIAL SOURCE
(amends Appendix B §B.2 decision 1)
================================================================

Founder direction, from the live test:

  The section is the answer to "whose account is this on?" An
  admin glancing at the page sees which connectors GORKA is
  paying for and which ones the customer is. No guessing. The
  card lives where the credential came from.

Rule C, as implemented:

  GORKA credential       → card in GORKA built-in
  BYOP credential        → card in Bring your own, even when
                           the connector is GORKA-managed
  Unconnected            → GORKA built-in by default (the offer),
                           also in the BYOP dropdown as the
                           alternative
  Disconnected           → returns to GORKA built-in

Rule A (Appendix B §B.2) placed cards purely by the catalog flag
isManagedByGorka. Rule C supersedes it.

Implementation:
  - ClientConnector.credentialSource is set by the backend enable
    handler: tier1Acknowledged === true → 'GORKA';
    zone3Acknowledged === true → 'BYOP'.
  - The frontend splits sections on this field, not on
    isManagedByGorka.

================================================================
C.5 — F17 DESIGN AS IMPLEMENTED
================================================================

The design is captured inline below and in the session chat
that produced it. File it as a standalone spec only after the
cloud trip and live test pass. What was built matches the
design described in this section:

  - shared/src/sync_engine.rs — ApplyNotifier type alias

  - shared/src/sync_engine.rs — ApplyNotifier type alias
    (Arc<dyn Fn() + Send + Sync>). Optional field on
    DiscoveryConfig and ListenerConfig.
  - Call site: run_session, in the Some(frame) arm, immediately
    after handle_incoming(...)? returns Ok. Post-commit,
    outside any transaction, on the engine thread. Wrapped in
    std::panic::catch_unwind(AssertUnwindSafe(...)) because the
    engine thread is unsupervised.
  - Agent — closure that captures AppHandle and calls
    app.emit("connector-sync", ()). Result discarded.
  - Client — apply_notifier: None. No behavior change.
  - Frontend — listener registered first, initial read after.
    Generation counter guards stale reads. Cleanup invalidates
    any in-flight read.

Post-commit invariant, verified from source:
process_event (shared/src/sync_pipeline.rs line ~102) opens
conn.transaction() and calls tx.commit() on both Accept paths
(prerequisite-pending and applied). When handle_incoming returns
Ok, every event has committed or was a no-write reject.

Panic policy, decided:
  The engine thread is unsupervised (run_engine has no
  catch_unwind, no is_finished check, no status flip on panic).
  A notifier panic would silently kill the engine. Therefore the
  call is wrapped. The panic payload is discarded; the engine
  continues. Logging the payload via eprintln! in the Err arm is
  a one-line refinement available later.

================================================================
C.6 — PROCESS AMENDMENTS
================================================================

P-A. DOCS AFTER VERIFICATION.
     Documentation for a slice is written only after the cloud
     trip AND the live test pass. Writing docs for unverified
     code wastes work and produces unreliable docs. This
     appendix is written with a STATUS line because the cloud
     trip has not yet run.

P-B. THREE-COMMIT STRUCTURE PER SLICE, NOT EIGHT.
     Appendix B §B.17 planned eight commits. In practice, cloud
     fails at the first bad step in a chain, and the chain output
     itself localises the failure. The batching that emerged:
       - schema + seed                    (data shape)
       - backend + service + UI + deletes (behaviour and UI)
       - docs                             (at slice close)

P-C. NO GUESSING ON ANCHORS.
     When the exact on-disk text of a target block is not in
     hand, read it first (Get-Content | Select-Object -Skip N
     -First M) and derive the anchor from the output. Never
     propose an anchor from memory.

P-D. FEWER ROUND TRIPS.
     Whole-file replacements for files whose structure is
     already known. Anchored edits in files we have read. No
     intermediate commit per file.

P-E. FOUNDER'S TIME ABOVE PROCESS PURITY.
     Don't turn one command into five round trips. State the
     whole plan, run it, paste the tail. Diagnose only on
     failure.

================================================================
C.7 — PILOT-STAGE SECURITY POLICY
(supersedes §5)
================================================================

Founder direction, from this session:

  The system is pre-product. No users, no customers. No debtor
  data in GORKA cloud (existing invariant). The pilot
  credentials protect a test database and a test email account.
  Exposure is recoverable. Rotating credentials every session is
  process overhead that stalls the actual work.

Policy, in force:

  - If a credential appears in a chat: note it in one line and
    continue. Do not block.
  - Credentials do not go into git-tracked files or recovery
    docs. This stands.
  - Rotation is deferred until there is a real product with real
    users. Rotate before the first real customer.

During this session, the Supabase pooler password and the Resend
API key were both pasted into the chat log. Per the policy above,
noted and not blocking.

§5 is superseded. Do not enforce rotation on future sessions
until this policy is revised.

================================================================
C.8 — REVISED QUEUE
================================================================

Supersedes §14 and Appendix A §A.5's "NEXT — RECOMMENDED, IN
ORDER" list.

DONE
  Prior slices (see Appendix A).
  Step 1  Connector UI restructure. Code complete on main.
          Cloud verification pending.

IN FLIGHT
  Cloud trip + live test for f872e9b.

NEXT — IN ORDER

  1. CLOUD TRIP + LIVE TEST for f872e9b. First action.
     On pass: mark C.1 status line as verified.
     On fail: amend C.1 with the failure; fix on main; re-push.

  2. STEP 1.5 — MORE KNOWN PROVIDERS. Shrunk from Appendix B
     §B.16's "generic HTTP adapter" plan. The SSRF decision
     (see C.8.A below) rules out admin-typed URLs, so Step 1.5
     becomes "additional provider adapters, same UI." Sub-table
     B stays a placeholder. Its own spec before any code.

  3. AI COPILOT + AI BOUNDARY LAYER. Moves near front. Same
     tier as Step 1.5. Own planning session first.

  4. STEP 1.6 — DATA-SOURCE DISPLAY SURFACE. Sub-table C when
     built. Smaller than Step 1.5.

  5. COMPLIANCE RULES PAGE (B5, B6).

  6. COMPLIANCE ENFORCEMENT LAYER — preflight check in the send
     flow. Includes the two outbound-contact rules from C.8.B.

  7. SYNC-ARCHITECTURE §7 A/B/C DECISION, then
     CONNECTOR_DISABLED and CONNECTOR_CREDENTIAL_REPLACED
     origination and apply.

  8. TWILIO SMS BYOP SEND VERIFICATION.

  9. B7 CREDENTIAL-TRANSIT REVIEW — review-only.

 10. CANCEL-NEGATIVE FOR TIER 1 — 5-minute test.

 11. REGISTRATION / ONBOARDING BLOCK. Its own planning session,
     then its own slices. Includes marketing-site registration,
     org creation, admin-creates-agent-user flow, enrollment
     package export UI.

 12. ACCEPTANCE — end-to-end.

C.8.A — OUTBOUND REQUEST DESTINATION RULE
  The Agent only calls known providers (a GORKA-maintained list).
  It does not accept admin-typed URLs. This removes the SSRF
  surface that Step 1.5 was scoped to guard against. Step 1.5
  shrank accordingly.

C.8.B — OUTBOUND RECIPIENT RULES
  Two rules, to be enforced in the compliance preflight:
   1. Outbound goes to profile contacts only: debtor,
      guarantors, pledgers. Add contact first if none.
   2. Off-profile channels (agent's own phone, corporate
      directory) stay off-system — not routed through the
      connector, not logged as a connector event.

================================================================
C.9 — OPEN ITEMS
================================================================

New this session:
  - Cloud trip + live test for f872e9b. Pending.
  - F17 design is captured inline in C.5. No standalone file.
  - Cargo.lock drift: main's committed Cargo.lock is behind
    main's committed Cargo.toml. Cosmetic. One-commit fix
    whenever.
  - custom-api Client DB row is DISCONNECTED from the test.
    After re-seed, has no credentialSchema. Verify on next live
    test that it does not appear in the dropdown.

Carried from §15 and Appendix A §A.6 (unchanged unless noted):
  - Registration / onboarding gap (own block, C.8 item 11).
  - Agent settings.dat user_id added by hand for the demo.
  - Communication Tools page sync re-render — CLOSED by F17.
  - Vite watcher EBUSY on cargo build.
  - Client disable does not propagate to Agent (F15).
  - Mocean SMS HTTP shape unconfirmed against current docs.
  - Twilio Voice and Gemini AI adapters not built.
  - Cancel-negative for Tier 1 not yet run.
  - .bak files and untracked dump files. Delete at leisure.

================================================================
C.10 — WHAT REMAINS PENDING FOR THIS SLICE
================================================================

Step 1 is not closed until:
  1. Cloud pull brings 4b24231 and f872e9b into cloud.
  2. Cloud trip passes: prisma db push adds credential_source;
     prisma generate regenerates; seed re-runs; cargo build
     compiles the ApplyNotifier change; cargo test remains
     112/112; node verify remains 9/9; both npm run build pass.
  3. Live test confirms: F12 (rollback), F13 (custom-api
     absent), F14 (card placement follows source), F17 (page
     auto-refreshes on sync).
  4. C.1 STATUS line is updated from "CODE COMPLETE ON MAIN.
     CLOUD VERIFICATION PENDING." to "CLOSED. Cloud trip and
     live test passed YYYY-MM-DD."

Until all four are done, do not start Step 1.5.

================================================================
END OF APPENDIX C
================================================================


================================================================
APPENDIX D — STEP 1 CLOSE AND SESSION FINDINGS
(added v2.7, 2026-10-10)
================================================================

D.0 — WHY THIS APPENDIX EXISTS

Appendix C recorded Step 1 code complete but cloud
verification pending. The cloud trip and live test ran on
2026-10-09/10. This appendix records the result, the
findings, and the credential-handling change that came out
of it.

Where this appendix conflicts with C.1's state block, this
appendix wins. C.1 is historical.

================================================================
D.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:    HEAD cd6a67f plus this appendix commit. Pushed.
         Working tree clean except the two known untracked
         files.

CLOUD:   at cd6a67f. Full cloud trip passed. Live test
         passed. Backend running. Five terminals may be
         open or closed at the founder's discretion.

Step 1 commits added since Appendix C:

  859172c  sync_engine: restore missing Duration import
           clobbered by ApplyNotifier insertion
  89ed725  agent: import Emitter trait for AppHandle::emit
           in sync notifier
  893d86e  connectors: Rule C filter checks CONNECTED state
           and isManagedByGorka; fixes F18 F19 F20
  192d3cb  F17 diagnostic: eprintln in notifier, console.log
           in listener
  db81b87  revert F17 diagnostics
  e7eca18  recovery-notes: CREDENTIALS.md
  c7b42ae  add pilot-creds.bat
  58d30ca  rotate Resend API key (dead)
  6618eec  rotate Resend key to re_XK7FAF5z for
           auto-revoke test (dead)
  cd6a67f  secrets out of git: pilot-creds.bat becomes
           template; values live in gitignored
           pilot-creds.local.bat

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -8
    git status --short

================================================================
D.2 — STEP 1 CLOSED
================================================================

CLOUD TRIP — PASSED

  prisma db push          PASS — added credential_source
  prisma generate         PASS
  seed                    PASS — six rows; mocean-sms LIVE
  cargo build --workspace PASS — after F21 and F22 fixed
  cargo test --workspace  112/112 PASS
  node verify             9/9 PASS
  Client npm run build    PASS
  Agent npm run build     PASS

LIVE TEST — PASSED

  F12  Tier 1 rollback on missing credential    VERIFIED
  F13  custom-api out of BYOP dropdown          VERIFIED
  F14  Rule C placement for BYOP rows           VERIFIED
  F17  Agent auto-refresh on sync               VERIFIED
       (after the Agent binary was rebuilt —
       see F23)
  F18  custom-api in GORKA built-in             VERIFIED FIXED
  F19  Legacy NULL credentialSource rows        VERIFIED FIXED
  F20  Disconnect makes card vanish             VERIFIED FIXED

  End-to-end send via Resend Tier 1: VERIFIED. Real email
  delivered to the founder's inbox on 2026-10-10.

================================================================
D.3 — FINDINGS THIS SESSION (F18–F23)
================================================================

F18  custom-api appeared in GORKA built-in.
     RESOLVED in 893d86e. The Rule C filter only checked
     credentialSource !== 'BYOP', so unconnected
     non-GORKA-managed rows with null source landed in
     GORKA built-in. Filter now also checks
     isManagedByGorka for non-connected rows.

F19  Legacy rows with NULL credentialSource (connected
     before the field existed) landed in GORKA built-in.
     RESOLVED in 893d86e. Backend writes credentialSource
     on every connect, so a fresh connect fixes the row.

F20  Disconnect made the card vanish from both sections.
     RESOLVED in 893d86e. Filter now branches on CONNECTED
     status first, then source, then isManagedByGorka.

F21  The ApplyNotifier insertion clobbered an existing
     `use std::time::Duration;` import in sync_engine.rs.
     Detected by cargo build on the first cloud trip.
     Fixed in 859172c.

F22  AppHandle::emit requires the `Emitter` trait in scope
     in Tauri 2.x. The ApplyNotifier closure called emit
     without importing the trait. Detected by cargo build
     on the same trip. Fixed in 89ed725.

F23  The running Agent binary was stale. The first F17
     live test "failed" because the Agent process was
     built before the Emitter fix (89ed725). The binary on
     disk had the fix; the process running in the window
     did not. After Ctrl+C and rebuild, F17 passed.
     No code change. Process rule recorded in D.9.

================================================================
D.4 — SECRET-MANAGEMENT INCIDENT
================================================================

On 2026-10-09/10, three Resend API keys were pushed to
GitHub in CREDENTIALS.md and pilot-creds.bat. Each was
auto-revoked by Resend within minutes of the push being
allowed through GitHub's secret scanning block.

Confirmation came in three forms:

  1. curl against api.resend.com returned
     "API key is invalid" minutes after a push.
  2. The key disappeared from the Resend dashboard's
     API keys list.
  3. Resend sent an email: "We received an alert from
     GitHub secret scanning that your API key was
     mistakenly exposed on GitHub. We automatically
     deleted your API key."

Root cause: Resend and GitHub have a partnership. GitHub
secret scanning reports leaked Resend keys to Resend.
Resend auto-revokes them. This is by design and cannot be
turned off.

Consequence: the policy in Appendix C §C.7 ("credentials
go into recovery notes, in git, on both machines") cannot
be honored for Resend keys. The provider revokes them.

Resolution: see D.5.

================================================================
D.5 — NEW CREDENTIAL PATTERN
================================================================

Secrets live on cloud only. Not in git. Never.

  pilot-creds.bat          in git. Template. No values.
                           Calls pilot-creds.local.bat if
                           present.

  pilot-creds.local.bat    gitignored. Cloud only. Holds
                           the real values. Never committed.

  CREDENTIALS.md           in git. Documents which env
                           vars are required and where
                           they live. No values.

Cloud is the only machine that needs credentials. Main is
edit-only. It never runs the backend, cargo, or the live
test.

Backup: if cloud is wiped, pilot-creds.local.bat is lost.
Keep one copy outside git (desktop text file, password
manager, USB). Restore by copying back to
C:\gorka-app\pilot-creds.local.bat.

Launch: none of this affects the product. In production
the backend runs on a host; its secrets live in the host's
dashboard. The Agent never reads a key from disk — it
receives credentials over encrypted sync and stores them
in local SQLCipher. This has been the architecture since
Slice 5. It works.

================================================================
D.6 — REVISED CLOUD RUNBOOK
================================================================

Every terminal that needs DB, backend, cargo, or Prisma
starts with `call pilot-creds.bat`.

TERMINAL 1 — Backend

    cd /d C:\gorka-app && call pilot-creds.bat && npx tsx src/backend/index.ts

  Wait for "Express server running on http://localhost:3000"
  and "✅ PostgreSQL connected successfully". Leave running.

TERMINAL 2 — Client vite

    cd /d C:\gorka-app && npm run dev

  Wait for "Local: http://localhost:5173/".

TERMINAL 3 — Agent vite

    cd /d C:\gorka-app\agent-dashboard && npm run dev

  Must bind 5174. If it binds 5173 or 5175, stop and fix.

TERMINAL 4 — Client Tauri

    cd /d C:\gorka-app && call pilot-creds.bat && cargo run --bin gorka-client

TERMINAL 5 — Agent Tauri

    cd /d C:\gorka-app && call pilot-creds.bat && cargo run --bin gorka-agent

CLOUD TRIP — one command, one terminal

    cd /d C:\gorka-app && git pull && call pilot-creds.bat && npx prisma db push --schema=prisma\schema.cloud.prisma && npx prisma generate --schema=prisma\schema.cloud.prisma && npx tsx prisma/seed-connectors.ts && cargo build --workspace && cargo test --workspace && node verify\index.mjs && npm run build && cd agent-dashboard && npm run build && cd ..

  Note: the Client build runs from the repo root
  (C:\gorka-app). There is no supervisor-dashboard\
  folder. Appendix B §B.13 said `cd supervisor-dashboard`
  — that was wrong. The root IS the Client.

================================================================
D.7 — REVISED QUEUE
================================================================

Supersedes C.8.

DONE
  Prior slices (see Appendix A).
  Step 1  Connector UI restructure. CLOSED 2026-10-10.
          Cloud trip and live test passed. Findings
          F12–F23 recorded in C.3 and D.3.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. STEP 1.5 — MORE KNOWN PROVIDERS. Additional provider
     adapters behind the same schema-driven UI. Sub-table
     B stays a placeholder. Own spec before any code.

  2. AI COPILOT + AI BOUNDARY LAYER. Own planning session.

  3. STEP 1.6 — DATA-SOURCE DISPLAY SURFACE.

  4. COMPLIANCE RULES PAGE (B5, B6).

  5. COMPLIANCE ENFORCEMENT LAYER — preflight check.

  6. SYNC-ARCHITECTURE §7 A/B/C DECISION, then
     CONNECTOR_DISABLED and CONNECTOR_CREDENTIAL_REPLACED.

  7. TWILIO SMS BYOP SEND VERIFICATION.

  8. B7 CREDENTIAL-TRANSIT REVIEW.

  9. CANCEL-NEGATIVE FOR TIER 1 — 5-minute test.

 10. REGISTRATION / ONBOARDING BLOCK.

 11. ACCEPTANCE — end-to-end.

================================================================
D.8 — OPEN ITEMS
================================================================

New this session:
  - F15 remains open: Client disable does not propagate
    to the Agent. Deferred to queue item 6.
  - Communication Tools page shows event metadata, not
    credential health. A card showing TIER1 / ENABLED /
    green badge can still have a dead credential behind
    it. Logged as a design gap; own slice, own decision.

Carried from §15 and Appendix A §A.6 (unchanged):
  - Registration / onboarding gap (queue item 10).
  - Agent settings.dat user_id added by hand for the demo.
  - Vite watcher EBUSY on cargo build.
  - Mocean SMS HTTP shape unconfirmed against current docs.
  - Twilio Voice and Gemini AI adapters not built.
  - .bak files and untracked dump files. Delete at leisure.

Resolved this session:
  - Cargo.lock drift — discarded on cloud, not re-committed.
  - F17-SPEC.md dangling reference — removed in 192d3cb
    and 746b90f.
  - Secrets in git — resolved by D.5 pattern.

================================================================
D.9 — PROCESS AMENDMENTS
================================================================

P-F. THE RUNNING BINARY IS NOT THE SOURCE.
     After a code change, the running application is
     still the old binary until the process is restarted.
     A live test that does not restart the affected
     process is testing the wrong code. F23 is the
     example: F17's first "failure" was a stale Agent
     built before 89ed725. Rule: after every Rust
     change, Ctrl+C the affected process, rebuild,
     relaunch, then test.

P-G. CLOUD IS THE ONLY PLACE RUST COMPILE ERRORS
     ARE CAUGHT. Main cannot run cargo (SAC blocks it).
     F21 and F22 are the third and fourth compile-time
     defects in two slices. The cloud trip is not
     optional; it is the only gate.

P-H. SECRETS DO NOT GO IN GIT.
     Supersedes C.7 and CREDENTIALS.md's founder
     instruction. Not because of policy preference —
     because Resend auto-revokes any key pushed to
     GitHub. See D.4. Values live in
     pilot-creds.local.bat on cloud only. Docs describe
     requirements, never values.

P-I. CREDENTIALS ARE LOADED VIA pilot-creds.bat.
     Every terminal that needs DB, backend, cargo, or
     Prisma starts with `call pilot-creds.bat`. This
     replaces the inline `set "DATABASE_URL=..."` pattern
     used in §6 and B.13.

P-J. ONE APPENDIX PER SESSION, NOT APPEND-AND-EDIT.
     Appendix C's edit-in-place rule was a one-time
     exception because C was current, not historical.
     From v2.7 forward, session findings append a new
     appendix. Do not edit prior appendices.

================================================================
END OF APPENDIX D
================================================================


================================================================
APPENDIX E — CONNECTOR EVENT ORDER: THREE COMMITS CLOSED
(added v2.8, 2026-10-11)
================================================================

E.0 — WHY THIS APPENDIX EXISTS

CONNECTOR-EVENT-ORDER-SPEC.md v1.0 was frozen at f39519f.
This session implemented all three STOP-gated commits and ran
the Commit 3 live test. This appendix records what shipped,
what the live test proved, the environment discoveries, and
the one open item left on the table. Where it conflicts with
D.8's "F15 remains open", this appendix wins: F15 is CLOSED.

================================================================
E.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:    HEAD 9811137. Pushed to origin/main.
CLOUD:   at 9811137. Full workspace test suite green.

Commits added this session, oldest first:

  a29b4e8  migration v10 + recovery utility (Commit 1/3)
  b253ae0  gorka-recover: use query_row for PRAGMA key
  9134e85  sync_pipeline: order-aware CONNECTOR apply; add
           DISABLED dispatch (Commit 2/3)
  95a2e76  sync_pipeline tests: replace deferred-DISABLED with
           tombstone/wipe/stale/read-gate tests
  0115014  sync_pipeline: CONNECTOR_DISABLED has no prerequisite
  fee397d  Client origination: disable_local_connector (Commit 3/3)
  a5fab27  gorka-recover: --password mode
  c4366a9  gorka-recover: read_line instead of read_to_string
  34a0b94  gorka-recover: version subcommand
  5dc5b53  gorka-recover: restore inspect match arm
  9811137  local_record: list_local_connectors excludes DISABLED

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -15
    git status --short

================================================================
E.2 — WHAT SHIPPED
================================================================

COMMIT 1 — migration v10 + recovery utility  (a29b4e8)

  db.rs
    - if current_version < 10 block. Adds three columns to
      local_connectors:
        winning_logical_clock INTEGER NOT NULL DEFAULT -1
        winning_device_id    BLOB    NOT NULL DEFAULT X''
        winning_sequence     INTEGER NOT NULL DEFAULT -1
    - Backfill UPDATE with WHERE EXISTS guard. A row without a
      matching event is not updated, so ALTER TABLE defaults
      remain and the subsequent check can diagnose explicitly.
    - Check 1 (existence): fails if any row lacks a matching
      CONNECTOR_ENABLED or CONNECTOR_DISABLED event.
    - Check 2 (status provenance): fails if any row's status
      disagrees with the type of its protocol-latest matching
      event. Verifies status only, not tier / credential /
      configuration.
    - All three steps run inside one transaction. Any failure
      returns Err before commit; SQLite rolls back DDL and DML;
      PRAGMA user_version stays at 9.
    - Added pub fn run_migrations_for_tests. Test-only helper.

  recover.rs (new)
    - inspect, plan_for_row, repair_dry_run, repair_apply.
    - Uses the real protocol_order_less and the real payload
      decoders. No parallel comparator; no parallel parser.
    - SafeRow and SafeEvent do not carry credential_value or
      configuration. Structural enforcement, not a convention.

  src-tauri-agent/src/bin/gorka-recover.rs (new)
    - CLI wrapper. Auto-discovered by Cargo as bin
      "gorka-recover". No Cargo.toml change needed.

  shared/tests/migration_v10.rs (new)
    - MT1–MT9, MT11, MT12. Eleven automated tests.
    - MT10 is a manual procedure documented in spec §9.4.

COMMIT 1 bug fixes this session:

  b253ae0  gorka-recover used conn.execute for PRAGMA key.
           rusqlite rejects row-returning PRAGMAs on execute.
           Fixed: conn.query_row, mirroring db.rs.

  a5fab27  Added --password mode: read the local password, read
           the salt from settings.dat, derive the key with
           db::derive_key. Same derivation the app uses.

  c4366a9  read_line instead of read_to_string on interactive
           stdin. read_to_string waits for EOF, which never comes
           from a terminal.

  34a0b94  version subcommand: print PRAGMA user_version and the
           table list. Read-only diagnostic.

  5dc5b53  Restore the inspect match arm. It was accidentally
           replaced (not added alongside) when version was added.

COMMIT 2 — apply path and dispatch  (9134e85)

  apply_connector_enabled is order-aware:
    - Reads (id, winning_logical_clock, winning_device_id,
      winning_sequence) for the (organization, code).
    - incoming_wins = protocol_order_less(existing tuple,
      incoming tuple). If the row is absent, incoming wins.
    - Stale ENABLED against an existing row: no-op.
    - Winning ENABLED: UPDATE with credential, config, tier,
      source_device_id, updated_at, and the new winning tuple.
    - First-time insert: INSERT with the winning tuple from the
      event.

  apply_connector_disabled is new:
    - No existing row: INSERT a tombstone.
        tier = '', status = 'DISABLED',
        credential_value = X'', configuration = ''
        source_device_id = hex(event.device_id)
        created_at = updated_at = ms_to_rfc3339(event.created_at)
        winning tuple from event
    - Existing row and incoming wins: UPDATE to a tombstone. Tier,
      credential_value, and configuration are wiped.
    - Stale DISABLED against an existing row: no-op.
    - Idempotent.

  Dispatch:
    - EVT_CONNECTOR_DISABLED => apply_connector_disabled added.
    - Pre-dispatch guard reduced from
        DISABLED | REPLACED
      to
        REPLACED only.

  prerequisite_exists:
    - EVT_CONNECTOR_ENABLED => Ok(true)
    - EVT_CONNECTOR_DISABLED => Ok(true)   <-- was missing,
      fell into _ => false, caused DISABLED to be treated as
      pending and never applied. Fixed in 0115014.

  Tests: 95a2e76. The stale test
    connector_disabled_is_deferred_without_mutation
  was replaced with five new tests:
    connector_disabled_creates_tombstone_when_row_absent
    connector_disabled_after_enabled_wipes_credential
    connector_stale_enabled_after_disabled_loses
    t22_read_credential_on_disabled_row_returns_none
    t23_read_credential_on_enabled_row_returns_some

COMMIT 3 — Client origination  (fee397d)

  local_record.rs:
    - disable_local_connector_with_event. One transaction:
        UPDATE local_connectors SET status='DISABLED', tier='',
          credential_value=X'', configuration='',
          source_device_id=?, updated_at=?
        WHERE organization_id = ? AND connector_code = ?
        then originate_event(EVENT_CONNECTOR_DISABLED).
      Both commit together or neither does.

  src-tauri/src/main.rs:
    - disable_local_connector command. Registered in
      generate_handler!.
    - Passes "local-device" as source_device_id (matches the
      existing convention from write_local_connector_credential).

  supervisor-dashboard/src/pages/Connectors.tsx:
    - handleDisconnect now calls the local command after the
      cloud disable. Local failure is logged, not surfaced.
      The cloud record is authoritative; the local tombstone
      reconciles on the next sync.

  local_record.rs (9811137):
    - list_local_connectors SQL gains "AND status = 'ENABLED'".
      Without it, the Communication Tools page renders the
      tombstone as a live card.

================================================================
E.3 — LIVE TEST RESULT (Commit 3 acceptance gate)
================================================================

Agent DB inspected at:
  C:\Users\Administrator\AppData\Roaming\click.gorka.agent\data\gorka-agent.db

Command:
  target\debug\gorka-recover.exe --password <settings.dat> inspect <db>

Before disconnect:

  row ea8f534a-ece6-4afd-9288-0df1a6980333
    code=resend-email org=cmty0xrxw0000c4q4mvtpqjqv
    tier=TIER1 status=ENABLED
    winning=(600, fd3d113825791dd3975757da50a8aa5f, 331)
    latest_event: CONNECTOR_ENABLED clock=600 seq=331
    status_consistent: true
    tuple_matches_latest: true

After disconnect (5 seconds later):

  row ea8f534a-ece6-4afd-9288-0df1a6980333
    code=resend-email org=cmty0xrxw0000c4q4mvtpqjqv
    tier= status=DISABLED
    winning=(604, fd3d113825791dd3975757da50a8aa5f, 332)
    latest_event: CONNECTOR_DISABLED clock=604 seq=332
    status_consistent: true
    tuple_matches_latest: true

Communication Tools page on the Agent: Resend Email card
disappeared without any user action.

All three facts confirmed:
  1. Tombstone written (tier='', status='DISABLED').
  2. Credential wiped (credential_value is empty).
  3. UI hidden (list_local_connectors excludes DISABLED).

Gate PASSED.

================================================================
E.4 — FINDINGS THIS SESSION
================================================================

FG1  gorka-recover used conn.execute for PRAGMA key.
     rusqlite rejects row-returning PRAGMAs on execute. Fixed:
     conn.query_row, mirroring db.rs. Commit b253ae0.

FG2  gorka-recover read stdin with read_to_string. Blocks
     on interactive input; read_to_string waits for EOF which
     never comes from a terminal. Fixed: read_line.
     Commit c4366a9.

FG3  EVT_CONNECTOR_DISABLED was missing from
     prerequisite_exists. It fell into the _ => false arm, so
     DISABLED was treated as a pending event and was never
     dispatched to apply_connector_disabled. It was still
     logged, still advanced the clock, but the row was never
     tombstoned. Found by the failing sync_pipeline tests.
     Fixed in 0115014.

FG4  list_local_connectors did not filter DISABLED rows. The
     Communication Tools page would have shown the dead card
     even though the credential was wiped. Fixed: WHERE
     organization_id = ?1 AND status = 'ENABLED'. Commit
     9811137.

FG5  The Agent DB under %APPDATA%\com.gorka.agent is a stale
     leftover from a bundle-identifier rename. The live Agent
     uses %APPDATA%\click.gorka.agent, user_version = 10, all
     tables present. The stale folder is at user_version = 7
     and was never migrated. Not a defect. Environment note.
     Do not confuse the two in future sessions.

FG6  Cloud disk filled during a build (24 GB in target/).
     cargo clean reclaimed 24 GB, full rebuild took 26 minutes.
     target/ is regenerable; nothing was lost.

FG7  The live test surfaced three ghost rows:
       custom-api   tier=TIER2 status=ENABLED
       mocean-sms   tier=TIER2 status=ENABLED
       twilio-sms   tier=TIER2 status=ENABLED
     These agents hold ENABLED rows for connectors whose Client
     side is DISCONNECTED. All three entered that state BEFORE
     Commit 3 existed. Their latest event is CONNECTOR_ENABLED;
     no CONNECTOR_DISABLED was ever originated for them. This
     is the historical F15 gap, still visible on the Agent for
     pre-fix disconnects. See E.7 for the recommended fix.

================================================================
E.5 — PROCESS AMENDMENTS
================================================================

P-K. RECOVERY TOOL MUST MATCH THE APP'S KEY PATH.
     gorka-recover supports two key modes:
       - hex key on stdin (MT10 procedure, §9.2)
       - --password <settings.dat>: read the local password,
         read the salt from settings.dat, derive with
         db::derive_key, same as the app.
     Both paths use db::derive_key. Do not invent a second
     derivation.

P-L. target/ IS DISPOSABLE.
     When cloud disk fills, cargo clean is the first stop.
     Nothing in target/ is authored; it regenerates on the
     next build. Not source. Not data.

P-M. ONE APPENDIX PER SESSION, DO NOT EDIT PRIOR APPENDICES.
     (P-J restated because it came up again. This appendix is
     new. Appendix D is untouched.)

P-N. THE UI IS NOT THE PROOF. THE DB IS THE PROOF.
     A live test that watches a card disappear proves the page
     re-rendered. It does not prove the row changed. For any
     slice that mutates local state, the acceptance gate must
     include a before/after read of the local DB. This session
     used gorka-recover inspect for that. Future slices should
     do the same.

P-O. BUNDLE IDENTIFIER IS A DATA PATH. DO NOT RENAME LIGHTLY.
     The application's local DB path resolves from the Tauri
     bundle identifier (click.gorka.agent, click.gorka.client).
     A rename leaves the old folder on disk, un-migrated, and
     silently skipped at runtime. The two folders can sit side
     by side for months before anyone notices. If a rename
     happens, run a one-time migration or delete the old
     folder, and record it.

================================================================
E.6 — ENVIRONMENT NOTES
================================================================

Local data paths on the cloud machine:

  Client  %APPDATA%\click.gorka.client\data\gorka-client.db
  Agent   %APPDATA%\click.gorka.agent\data\gorka-agent.db
  Agent   %APPDATA%\com.gorka.agent\data\gorka-agent.db
          (stale; user_version = 7; ignore)
  Client  %APPDATA%\gorka\client\data\gorka-client.db
          (stale; ignore)

Local password on the pilot machine: Password123.
This is a pilot-machine local DB password, not a provider
credential. Noted once for future sessions; not a rotation
item under §C.7.

================================================================
E.7 — OPEN ITEMS
================================================================

O1  THREE GHOST ROWS ON THE AGENT (FG7).
    custom-api, mocean-sms, twilio-sms show ENABLED on the
    Agent's Communication Tools page while the Client side is
    DISCONNECTED. Pre-fix history.

    Recommended fix: extend gorka-recover with a
    `disable <connector_code>` subcommand. It calls
    disable_local_connector_with_event, which tombstones the
    row and originates a CONNECTOR_DISABLED event. The event
    reaches the Client; the Client no-ops because the cloud
    row is already DISCONNECTED. Final state correct on both
    sides.

    This inverts the intended direction of the event (Client
    originates). It is a repair operation, not normal flow.
    Document it as such in the recovery tool's header.

    Alternative: leave them. Logged as history. Not
    recommended — the Communication Tools page keeps lying.

    Do this first thing next session.

O2  COMMUNICATION TOOLS PAGE SHOWS EVENT METADATA, NOT
    CREDENTIAL HEALTH.
    A card showing TIER1 / ENABLED / green badge can still have
    a dead credential behind it. Design gap, not a bug. Own
    decision, own slice. Carried from D.8.

O3  CONNECTOR_CREDENTIAL_REPLACED REMAINS DEFERRED.
    Payload lacks tier. REPLACED-first arrival cannot construct
    a row. Own spec. The tie-break columns added this session
    unblock the apply path once the spec is written.

O4  CARRIED FORWARD FROM D.8, UNCHANGED:
    - Registration / onboarding gap.
    - Agent settings.dat user_id added by hand.
    - Vite watcher EBUSY on cargo build.
    - Mocean SMS HTTP shape unconfirmed.
    - Twilio Voice and Gemini AI adapters not built.
    - Cancel-negative for Tier 1 not yet run.
    - .bak files and untracked dump files.

================================================================
E.8 — QUEUE
================================================================

DONE
  CONNECTOR-EVENT-ORDER-SPEC v1.0. All three commits. F15 CLOSED.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. O1: gorka-recover `disable <connector_code>` subcommand.
     Clear the three ghost rows. Small slice.
  2. O2: Communication Tools page — credential health, not just
     event metadata. Own decision.
  3. STEP 1.5 — More known providers. Own spec before code.
  4. AI Copilot + AI boundary layer. Own planning session.
  5. STEP 1.6 — Data-source display surface.
  6. COMPLIANCE RULES PAGE (B5, B6).
  7. COMPLIANCE ENFORCEMENT LAYER — preflight check.
  8. CONNECTOR_CREDENTIAL_REPLACED. Own spec.
  9. TWILIO SMS BYOP SEND VERIFICATION.
 10. B7 CREDENTIAL-TRANSIT REVIEW.
 11. CANCEL-NEGATIVE FOR TIER 1 — five-minute test.
 12. REGISTRATION / ONBOARDING BLOCK.
 13. ACCEPTANCE — end-to-end.

================================================================
APPENDIX F — SLICE 1 CLOSE
(added v2.9, 2026-10-12)
================================================================

F.0 — WHY THIS APPENDIX EXISTS

Appendix E closed CONNECTOR-EVENT-ORDER-SPEC v1.0 and left
the queue pointing at the AI Copilot planning session. This
session ran that planning session (Part II appended) and then
implemented and live-verified Slice 1: opt-out enforcement
and disclosure text.

Where this appendix conflicts with E.8's queue, this appendix
wins.

================================================================
F.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:   HEAD 28af4fd. Pushed. Clean tree except the two
        known untracked files (CHAT-HANDOFF-DUMP.txt,
        make-dump.ps1).

CLOUD:  at 28af4fd. Full workspace test green. Cloud closed
        at founder's discretion after the final workspace run.

Commits added this session, oldest first:

  16c4dc5  compliance: slice 1 opt-out guard and disclosure
           append
  d1779cf  agent: register set_debtor_opt_out and
           get_disclosure_text; guard send_connector_message
  dfbdb6c  slice 1: opt-out enforcement, disclosure append,
           opt-out UI, compliance settings
  2a2724b  agent: disclosure text settings UI
  c4015ba  compliance: user-facing block messages and
           SEND_BLOCKED audit row
  28af4fd  slice 1: restore correct disclosure test assertion

  Note: the push of 2a2724b reported a range of
  75af862..2a2724b. The commit 75af862 is not one this
  session is aware of creating. Verify with git log at
  resume before assuming the list above is complete.

  Note: c87c855 (Part II appended to
  CONNECTOR-EVENT-ORDER-SPEC) was already on origin/main at
  session start.

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -10
    git status --short

================================================================
F.2 — WHAT SLICE 1 SHIPPED
================================================================

Per Part II §II.17.1 and the Slice 1 mini spec (v1.2).

1a — Opt-out enforcement.

  - shared/src/compliance.rs (new). Contains:
      Channel enum (Email / Sms / Voice) with as_str and
      display_name.
      ComplianceBlock enum with user_message() and
      rule_name().
      channel_for_connector_code() -> Option<Channel>.
      get_opt_out().
      check_opt_out() wrapping check_opt_out_inner().
      set_debtor_opt_out().
      get_disclosure_text().
      set_disclosure_text().
      append_disclosure_idempotent().

  - Guard call inserted in send_connector_message in
    src-tauri-agent/src/main.rs, between the DB lock and
    read_local_connector_credential.
    test_connector_connection has no guard (it does not
    contact the debtor).

  - check_opt_out fails closed on unknown connector codes,
    malformed data, and missing debtor rows.

  - On block, a SEND_BLOCKED audit_log row is written with
    connector code and rule name. Best-effort; a logging
    failure does not change the enforcement decision.

  - Toggle UI on the Agent debtor profile (Contact
    preferences card, three checkboxes).

  - Opt-out stored in debtors.data.opt_out.<channel>.
    Whole-blob ENTITY_UPDATED. Matches Part II §II.17.1.

1b — Disclosure text append.

  - compliance_rules already existed (migration v9).
    set_disclosure_text is its first production writer.
    INSERT ... id = 1 on first write; UPDATE after.

  - Client "Local compliance rules" section added to
    ComplianceReport.tsx.

  - Agent "Compliance" card added to SettingsPage.tsx.

  - Composer (SendMessageModal.tsx): raw draft kept separate
    from preview. Preview derived from (rawDraft,
    disclosure) via finalBodyFor(). Sent body is the
    transformed body, not the raw draft.

  - The append is idempotent against the last non-empty
    line. Whitespace-only disclosure is treated as empty.

Tests: shared/tests/slice1_compliance.rs. 42 tests. All
green on cloud.

Full workspace test at close: all suites green.

Live-verified on 2026-10-12:

  - Opt-out set -> send blocked with user-facing message
    ("This debtor has opted out of Email. Contact them
    through another channel or update their record.").
    No communications row. No email sent.
  - Opt-out cleared -> send succeeds; real email delivered
    via Resend; disclosure appended exactly as previewed.

================================================================
F.3 — FINDINGS THIS SESSION
================================================================

FG8   communication_type_for returns "NOTE" for unknown
      connector codes. Latent Slice 5 gap: a send through an
      unrecognized connector would have written a
      communications row typed NOTE. Fixed by construction
      in Slice 1: channel_for_connector_code returns
      Option<Channel>, and check_opt_out refuses None
      before the send path runs.

FG9   Vite watcher EBUSY (F10 in Appendix E's carried
      items). Still open. Crashed the Client vite during the
      live test when cargo rebuilt the client binary.
      Recovered by restarting vite after the build finished.
      Root fix (server.watch.ignored for **/target/**) is
      one line in vite.config.ts; not done this session.

FG10  Test assertion for
      get_disclosure_text_returns_value lost twice during
      the session. Applied correctly the first time, then
      clobbered by a later edit to the same file. Caught by
      cloud test. Reapplied. Root cause: multiple notepad
      edit passes on the same file across a long turn; a
      stale buffer or a wrong anchor reverted the fix.

FG11  Command chaining wedged the cloud terminal
      repeatedly. `set VAR=x` on the same line as a later
      command does not affect that command (cmd expands the
      whole line first). Double pipes nest subshells and do
      not clean up. Recovery: close the terminal, open a
      fresh one, run one command per line.

FG12  The root package.json is named "supervisor-dashboard"
      and builds the Client. The Client's source lives in
      supervisor-dashboard/src/, aliased by @ in
      vite.config.ts. The supervisor-dashboard/ folder has
      no package.json and cannot be built from. Appendix
      D's D.6 note already said "There is no
      supervisor-dashboard\ folder"; this session read past
      it and wasted time. Restated in P-U.

FG13  Two Slice 1 gaps found during live testing were
      fixed in-slice, not deferred:
        - error message was Rust Debug output; now
          user_message() copy per CONNECTOR-MODEL.md §10.9.
        - no SEND_BLOCKED audit row was written; now
          written inside check_opt_out via db::log_audit.

================================================================
F.4 — PROCESS AMENDMENTS
================================================================

P-Q   ONE COMMIT PER SLICE, BULK AT THE END.
      Do not commit per file. Write all files for the slice
      on main, commit once at slice close, push once.
      Additional commits within a slice are for defects
      found after the bulk commit.

P-R   NEVER CHAIN COMMANDS IN THE CLOUD TERMINAL.
      One line, one Enter, wait for prompt. No &&. No
      double pipes. If a step needs an environment
      variable, it goes on its own line, Enter, then the
      command on the next line. FG11 is the evidence.

P-S   `set VAR=x` AFFECTS NOTHING ON THE SAME LINE.
      cmd expands the whole line before executing. Split.

P-T   BEFORE A FOLLOW-UP EDIT TO A FILE, RE-VERIFY THE
      ANCHOR.
      After any file has been edited more than once in a
      session, run findstr / Select-String against the
      exact line you intend to anchor to before issuing
      the next edit. Do not trust memory of the file's
      state across long turns. FG10 is the evidence.

P-U   ROOT IS THE CLIENT. supervisor-dashboard/ IS A SOURCE
      FOLDER, NOT AN APP.
      Build the Client from C:\gorka-app.
      `cd supervisor-dashboard && npm run build` fails; the
      folder has no package.json. The Agent builds from
      C:\gorka-app\agent-dashboard. Restates D.6's note;
      recorded again because the same mistake happened
      twice.

P-V   ONE APPENDIX PER SESSION (restated, P-M / P-J).
      Do not edit prior appendices.

================================================================
F.5 — ENVIRONMENT NOTES
================================================================

Local data paths (unchanged from Appendix E):

  Client  %APPDATA%\click.gorka.client\data\gorka-client.db
  Agent   %APPDATA%\click.gorka.agent\data\gorka-agent.db

Cloud temp: set TMP and TEMP to C:\cargo-tmp before every
cargo command. Two separate lines. See P-S.

Vite ports: Client 5173, Agent 5174. If 5174 is held by a
stale node.exe, kill it by PID via taskkill /F /PID <n>.
Do not kill PID 8 or any System-owned listener.

================================================================
F.6 — OPEN ITEMS
================================================================

New this session:

  - FG9: vite watcher EBUSY on cargo build. One-line fix in
    vite.config.ts. Unfixed.
  - Vite config warning on `__dirname` in both vite configs.
    Cosmetic. Vite plans to disable configLoader: 'native'.
    Fix is import.meta.dirname. Not urgent.
  - The 75af862 commit in the 2a2724b push range. Verify at
    resume.

Carried from Appendix E §E.7, unchanged:

  - O1: three ghost rows on the Agent.
  - O2: Communication Tools page shows event metadata, not
    credential health.
  - O3: CONNECTOR_CREDENTIAL_REPLACED remains deferred.
  - O4 items: registration/onboarding gap; Agent
    settings.dat user_id; Mocean HTTP shape; voice/Gemini
    adapters; cancel-negative test; .bak files.

================================================================
F.7 — QUEUE
================================================================

DONE
  CONNECTOR-EVENT-ORDER-SPEC v1.0. F15 CLOSED.
  SLICE 1 (Part II §II.17) — opt-out enforcement and
  disclosure text. CLOSED 2026-10-12. Live-verified.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. SLICE 2 — Deterministic Context Engine and fallback.
     Part II §II.16. Local context from existing tables.
     Rule-based recommendation using canonical enums and
     deterministic calculations. Offline-capable. No
     external calls. Own mini spec before code.

  2. SLICE 3 — AI boundary and adapters.
     Typed outbound request, canonical serialization,
     boundary validator. Gemini and OpenAI-compatible
     adapters. Base URL network controls.

  3. SLICE 4 — Strategy Engine and fact validation.

  4. SLICE 5 — Recommendation lifecycle, reservation,
     contact limits, and UI.

  5. SLICE 6 — Integrated security and regression tests.

  Then the carried items from Appendix E §E.8:
  6.  O1 ghost-row fix (deferred by founder).
  7.  O2 Communication Tools credential health.
  8.  STEP 1.5 — More known providers.
  9.  STEP 1.6 — Data-source display surface.
 10.  CONNECTOR_CREDENTIAL_REPLACED.
 11.  TWILIO SMS BYOP SEND VERIFICATION.
 12.  B7 CREDENTIAL-TRANSIT REVIEW.
 13.  CANCEL-NEGATIVE FOR TIER 1.
 14.  REGISTRATION / ONBOARDING BLOCK.
 15.  ACCEPTANCE — end-to-end.

================================================================
F.8 — WHAT THIS APPENDIX DOES NOT DO
================================================================

  It does not amend Part II. Part II's Slice 1 is now
  implemented; Part II stands.
  It does not reopen CONNECTOR-EVENT-ORDER-SPEC Part I.
  It does not decide any remaining O1/O2 question.
  It does not promote Slice 2 to started. Slice 2 needs its
  own mini spec before code.

================================================================
END OF APPENDIX F
================================================================

================================================================
APPENDIX G — SLICE 2 CLOSE
(added v3.0, 2026-10-12)
================================================================

G.0 — WHY THIS APPENDIX EXISTS

Appendix F closed Slice 1 (opt-out enforcement and disclosure
text) and pointed at Slice 2. This session ran Slice 2:
Deterministic Context Engine and fallback. Code, tests, cloud
verification, and the Part II §II.3 amendment are all complete.

Where this appendix conflicts with F.7's queue, this appendix
wins.

================================================================
G.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:   HEAD 7cab903 plus the appendix commit that follows.
        Pushed through 7cab903.

CLOUD:  at 7cab903. Full workspace test green. Closed.

Commits added this session, oldest first:

  0052dd7  slice 2: context engine and deterministic fallback
  7cab903  slice 2: fix seed_debt call sites in fallback test

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -5
    git status --short

================================================================
G.2 — WHAT SLICE 2 SHIPPED
================================================================

Two modules, both new, both shared-crate, both local-only:

shared/src/context.rs
  - Context struct: debtor + communicationHistory + debts +
    indicators.
  - FallbackInput struct: exact integer/float values, local only,
    never serialized.
  - build_context(conn, org_id, debtor_id, reference_time).
  - build_fallback_input(conn, org_id, debtor_id, reference_time).
  - Internal DebtorFacts loaded once; both projections derive
    from it. No double reads.
  - Debt counting: totalCount = status != 'CANCELLED';
    paidCount = status = 'PAID'; overdueCount = non-paid,
    non-cancelled, due_date < reference_time; amountRange = sum
    of unpaid in the primary currency.
  - Primary currency = most common among unpaid debts; ties
    alphabetical. No FX conversion.
  - Communications: CALL -> voiceCount, NOTE excluded from
    channel counts and rates, counted only in totalCount.
  - Banding: amount, days overdue, response rate, payment
    reliability, engagement level.
  - communicationPreference tie-break alphabetical.

shared/src/recommendation.rs
  - Canonical enums: Priority, Tone, Timing, Channel.
  - fallback(days_overdue, response_rate) -> Recommendation.
  - Strict boundaries: > 60, > 30, < 0.2.
  - timing always Within3Days (fixed in this slice).

Shared crate changes:
  - shared/src/lib.rs: pub mod context; pub mod recommendation;

Tests: 38 new.
  - shared/tests/slice2_context.rs: 27 tests.
  - shared/tests/slice2_fallback.rs: 11 tests.

Full workspace test at close: 202/202 pass.

Live test: none. Slice 2 is Rust-only. No UI. No network.

================================================================
G.3 — DEVIATIONS FROM PART II §II.3
================================================================

Part II §II.3 named paymentHistory and promisesKeptRatio. No
local payments or promises tables exist. Slice 2 substitutes
what can be computed.

The substitution is recorded as an amendment appended to
CONNECTOR-EVENT-ORDER-SPEC.md Part II, immediately after the
Part II END COPY marker. The amendment is additive; the original
§II.3 text is unchanged.

Future slices (3 through 6) must validate against the Slice 2
shape, not the original §II.3 shape. When payments and promises
become first-class local tables, that amendment is superseded by
a new amendment.

Summary of substitution:

  §II.3 field                      Slice 2 result
  ------------------------------   -----------------------------
  debtor.amountRange               produced (primary currency)
  debtor.daysOverdueRange          produced
  debtor.debtOriginCategory        omitted (no local source)
  communicationHistory counts      produced (CALL -> voiceCount)
  communicationHistory response    produced (excl NOTE)
  paymentHistory.*                 substituted with debts.*
  indicators.paymentReliability    produced
  indicators.engagementLevel       produced (excl NOTE)
  indicators.communicationPref     produced (tie alphabetical)
  indicators.promisesKeptRatio     omitted (no local source)

================================================================
G.4 — FINDINGS THIS SESSION
================================================================

FG14  Part II §II.3 assumed a payments table and a promises
      representation. Neither exists in the local schema. The
      deviation is now recorded as a Part II amendment. No code
      in Slice 2 depends on the missing tables.

FG15  debt due_date is populated per debt on insert. Reliable
      when the operator enters it. Missing due_date is treated
      as "not overdue" by the context engine; the tests cover
      this with a22 and 2a-21.

FG16  Currency is a per-debt free-text field, default "USD". No
      consistency is enforced anywhere. Slice 2 does not sum
      across currencies; it selects one primary currency and
      sums only that. Mixed-currency debtors are handled
      deterministically.

FG17  One test file call-site mistake in slice2_fallback.rs
      (six arguments passed to a five-argument helper). Caught
      by cloud compile on the first run. Fixed in 7cab903.

FG18  Notepad on Windows encodes § as Â§ in these recovery
      files. Existing appendices already carry the artifact.
      findstr for a literal § does not match; use PowerShell
      Get-Content or findstr on ASCII substrings only. Cosmetic;
      do not fix.

================================================================
G.5 — PROCESS AMENDMENTS
================================================================

P-W   TEST FILE HELPERS DO NOT SHARE A SIGNATURE.
      seed_debt in slice2_context.rs takes (id, amount,
      currency, status, due_date). seed_debt in
      slice2_fallback.rs takes (id, amount, status, due_date).
      Different files, different helpers. When a call site is
      added to one file, check the local helper's signature, not
      the other file's. FG17 is the evidence.

P-X   WHEN A TEST FAILS FOR A REASON YOU DID NOT EXPECT, LOOK
      FOR A FIXTURE BUG BEFORE SUSPECTING PRODUCTION CODE.
      Caught twice this session: the a17 "5000" collision (band
      label vs forbidden substring) was a fixture bug, not a
      privacy leak. The seed_debt argument mismatch was a call
      site bug, not a logic bug.

P-Y   ONE APPENDIX PER SESSION (restated, P-M / P-J / P-V).
      Do not edit prior appendices.

================================================================
G.6 — ENVIRONMENT NOTES
================================================================

Unchanged from Appendix F:

  Client data path: %APPDATA%\click.gorka.client\data\
                    gorka-client.db
  Agent  data path: %APPDATA%\click.gorka.agent\data\
                    gorka-agent.db
  Cloud temp: set TMP and TEMP to C:\cargo-tmp. Two separate
              lines. See P-S.

================================================================
G.7 — OPEN ITEMS
================================================================

New this session:

  - None. Slice 2 is closed with no new open items.

Carried from Appendix F §F.6, unchanged:

  - FG9: vite watcher EBUSY on cargo build. Unfixed.
  - Vite config `__dirname` warning. Cosmetic.
  - O1: three ghost rows on the Agent.
  - O2: Communication Tools page shows event metadata, not
    credential health.
  - O3: CONNECTOR_CREDENTIAL_REPLACED remains deferred.
  - O4 items: registration/onboarding gap; Agent settings.dat
    user_id; Mocean HTTP shape; voice/Gemini adapters;
    cancel-negative test; .bak files.

================================================================
G.8 — QUEUE
================================================================

DONE
  CONNECTOR-EVENT-ORDER-SPEC v1.0. F15 CLOSED.
  SLICE 1 (Part II §II.17) — opt-out enforcement and
  disclosure text. CLOSED 2026-10-12.
  SLICE 2 (Part II §II.16) — Context Engine and deterministic
  fallback. CLOSED 2026-10-12.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. SLICE 3 — AI boundary and adapters.
     Typed outbound request, canonical serialization, boundary
     validator (Part II §II.4). Gemini and OpenAI-compatible
     adapters (Part II §II.6, §II.7). Base URL network
     controls (Part II §II.5.2, §II.5.3). Semantic-identity
     acceptance tests. Secret-leak regression.
     Own mini spec before code. This is the first slice that
     reaches the network. Larger than Slice 2.

  2. SLICE 4 — Strategy Engine and fact validation.

  3. SLICE 5 — Recommendation lifecycle, reservation,
     contact limits, and UI.

  4. SLICE 6 — Integrated security and regression tests.

  Then the carried items from Appendix E §E.8 / F.7:
  5.  O1 ghost-row fix (deferred by founder).
  6.  O2 Communication Tools credential health.
  7.  STEP 1.5 — More known providers.
  8.  STEP 1.6 — Data-source display surface.
  9.  CONNECTOR_CREDENTIAL_REPLACED.
 10.  TWILIO SMS BYOP SEND VERIFICATION.
 11.  B7 CREDENTIAL-TRANSIT REVIEW.
 12.  CANCEL-NEGATIVE FOR TIER 1.
 13.  REGISTRATION / ONBOARDING BLOCK.
 14.  ACCEPTANCE — end-to-end.

================================================================
G.9 — WHAT THIS APPENDIX DOES NOT DO
================================================================

  It does not amend Part II beyond the §II.3 amendment block.
  It does not reopen CONNECTOR-EVENT-ORDER-SPEC Part I.
  It does not decide any remaining O1/O2 question.
  It does not promote Slice 3 to started. Slice 3 needs its
  own mini spec before code. Slice 3's scope touches the
  network and credentials; the mini spec must address
  SSRF guardrails, semantic-identity tests, and the base URL
  network controls before any code.

================================================================
END OF APPENDIX G
================================================================

End of RESUME-HERE.md


================================================================
APPENDIX H — SLICE 3 CLOSE
(added v3.1, 2026-10-12)
================================================================

H.0 — WHY THIS APPENDIX EXISTS

Appendix G closed Slice 2 and pointed at Slice 3. This session
ran Slice 3 in three sub-slices (3a, 3b, 3c): the AI boundary
layer, the Gemini and OpenAI-compatible adapters with refusing
production transport, and the network controls. Where this
appendix conflicts with G.8's queue, this appendix wins.

================================================================
H.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:   HEAD includes the Appendix H commit that follows.
        Working tree clean except the two known untracked
        files (CHAT-HANDOFF-DUMP.txt, make-dump.ps1).

CLOUD:  at the same commit, after the final cloud trip for
        3c.

Slice 3 commits, in order:

  3a (boundary layer):
    df8eb02  slice 3a: AI boundary layer

  3b (adapters, refusing production transport):
    e2e3b14  slice 3b: Gemini and OpenAI-compatible adapters
    c84790f  slice 3b fix: clone inner MockHttpClient in provider
    c883d1c  slice 3b fix: PartialEq on ConnectorErrorKind
    e3cd7d0  slice 3b fix: extract_value handles array indices

  3c (network controls):
    fdec4f1  slice 3c: network controls
    75f9bb2  slice 3c fix: use .err() for non-Debug Box<dyn HttpClient>
    bda8d0a  slice 3c fix: bracket-strip IPv6 host;
             double-append test targets full_path_for
    (plus the manual-tests commit)

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -15
    git status --short

================================================================
H.2 — WHAT SLICE 3 SHIPPED
================================================================

3a — AI boundary layer (no network).

  shared/src/connectors/ai_request.rs     RawOutboundAiRequest,
                                          RawRequestOptions
  shared/src/connectors/ai_boundary.rs    parse_and_validate,
                                          validate_typed,
                                          BoundaryBlock,
                                          CanonicalAiRequest
  shared/src/connectors/ai_mapping.rs     ProviderEnvelopeMapping,
                                          FieldLocation,
                                          FieldMapping,
                                          FixedConstant,
                                          verify_semantic_identity
  shared/tests/slice3a_boundary.rs        22 tests

  shared/src/context.rs gained Deserialize + deny_unknown_fields
  on the five serialized structs. FallbackInput unchanged.
  shared/Cargo.toml gained serde_jcs 0.2.0.

  Decisions applied: D1(a) manual Value walk with dotted paths;
  D2 DisallowedOption { name: String }; D3 three-case rule for
  unknown keys (top-level -> UnknownField, inside context ->
  UnknownField with dotted path, inside request_options ->
  DisallowedOption); D4 float canonicalization asserted in
  3a-14 against RFC 8785 vectors; D5 SendRequest constructed
  with all four fields; D6 validate_typed stays pub(crate).

3b — AI adapters, refusing production transport.

  shared/src/connectors/transport.rs        HttpClientProvider,
                                            RefusingHttpClientProvider,
                                            MockHttpClientProvider
                                            (test-gated)
  shared/src/connectors/base_url.rs         ValidatedBaseUrl,
                                            validate_static,
                                            validate_resolution (stub)
  shared/src/connectors/gemini_ai.rs        GeminiAiAdapter
  shared/src/connectors/openai_compatible.rs OpenAiCompatibleAdapter
  shared/tests/slice3b_gemini.rs            18 tests
  shared/tests/slice3b_openai.rs            14 tests

  shared/Cargo.toml gained a test-mock-provider feature and a
  dev-dependency on self. shared/src/connectors/http.rs's
  testing module was re-gated from #[cfg(test)] to
  #[cfg(any(test, feature = "test-mock-provider"))] so
  integration test files can see MockHttpClient.

  Gemini uses x-goog-api-key header, not query string.
  OpenAI uses Authorization: Bearer. Neither adapter touches
  ReqwestHttpClient in the automated suite. Both factories in
  build_default_registry pass RefusingHttpClientProvider.

3c — Network controls.

  base_url.rs fully implemented:
    - validate_resolution (reject-if-any; pick first permitted)
    - is_prohibited (full IANA IPv4 27-entry and IPv6 26-entry
      deny-lists; IPv4-mapped IPv6 recurses on embedded v4)
    - SystemResolver via std::net::ToSocketAddrs
    - ValidatedBaseUrl::port()

  http_reqwest.rs gained:
    - ReqwestHttpClient::pinned(host, ip, port) -> Result<Self,
      ConnectorError>. The Result prevents a panic on a builder
      failure. No .expect(). Uses .redirect(Policy::none()),
      .no_proxy(), .resolve(host, addr). TLS verification and
      SNI preserved.

  transport.rs rewritten:
    - Trait signature changed to build(&self, base: &ValidatedBaseUrl).
    - PinnedReqwestProvider replaces RefusingHttpClientProvider.
      Refusing is deleted from the source tree.
    - MockHttpClientProvider signature updated.
    - PinnedReqwestProvider::system() convenience constructor.

  gemini_ai.rs, openai_compatible.rs:
    - Production factory now uses PinnedReqwestProvider::system().
    - Call site: self.http_provider.build(&self.validated_base).

  slice3b_gemini.rs:
    - Deleted 3b-17 (production_provider_refuses_to_build_client)
      and 3b-18 (adapter_with_production_provider_cannot_send).
      Their semantic replacement is 3c-31.
    - 3b-14 TransportError sub-case replaced with a deterministic
      failing-resolver call against PinnedReqwestProvider.

  slice3c_base_url.rs (new): 33 tests
  slice3c_manual.rs (new): 2 #[ignore] tests (3c-M1, 3c-M2)

================================================================
H.3 — VERIFICATION
================================================================

CLOUD at Slice 3 close:

  cargo test -p gorka-shared --test slice3a_boundary
    22 passed; 0 failed

  cargo test -p gorka-shared --test slice3b_gemini
    16 passed; 0 failed (18 minus 2 deleted)

  cargo test -p gorka-shared --test slice3b_openai
    14 passed; 0 failed

  cargo test -p gorka-shared --test slice3c_base_url
    33 passed; 0 failed

  cargo test -p gorka-shared --test slice3c_manual -- --ignored --nocapture
    2 passed; 0 failed

  cargo test --workspace
    total 294 passed; 0 failed

MANUAL ACCEPTANCE (recorded 2026-10-12):

  3c-M1: TLS chain rejection on pinned address.
    Observed: "error trying to connect: A certificate chain
    processed, but terminated in a root certificate which is
    not trusted by the trust provider. (os error -2146762487)"
    Chain rejection, not hostname mismatch. PASS.

  3c-M2: Proxy env bypass by pinned client.
    Observed: "proxy listener got = 0 connection(s)" with
    HTTPS_PROXY set to a live local listener. PASS.

================================================================
H.4 — FINDINGS THIS SESSION
================================================================

FG19  Url::host_str() returns IPv6 literals with brackets,
      e.g. "[::1]". parse::<IpAddr>() on "[::1]" fails, so the
      IP-literal check in validate_static passed IPv6 literals
      through. Fixed in bda8d0a by trimming brackets before
      parsing.

FG20  The double-append rejection for /chat/completions lives
      in ValidatedBaseUrl::full_path_for, not in validate_static.
      validate_static accepts any well-formed HTTPS URL; the
      adapter's later call to full_path_for is what rejects a
      base that already ends with the suffix. Test 3c-10's
      original framing called validate_static directly and
      asserted the wrong surface. Fixed in bda8d0a to call
      full_path_for.

FG21  Notepad's Replace All did not fire reliably in several
      files this session (context.rs partial replacements).
      PowerShell .Replace() and -replace are deterministic.
      Whole-file rewrites via notepad are also reliable.
      Anchor-based incremental edits across many turns are the
      failure mode.

FG22  `Set-Content -Value $array -NoNewline` flattens an array
      to one line (concatenates elements with no separator).
      The intended newline-separated write requires -Value with
      -join "`n" or omitting -NoNewline. Spliced line-range
      replacements with -NoNewline destroyed
      slice3c_base_url.rs mid-session and required full rewrite.
      Use -join or don't use -NoNewline for multi-line writes.

FG23  #[cfg(test)] items are not visible to integration tests
      (shared/tests/ are separate crates). The 3b session worked
      around this with a crate feature gate
      (test-mock-provider) plus a dev-dependency on self. The
      pattern is general and should be used for any test-only
      surface an integration test needs.

FG24  reqwest::Url is available transitively through reqwest.
      No new dependency was needed for URL parsing.

================================================================
H.5 — PROCESS AMENDMENTS
================================================================

P-Z   ANCHOR-BASED EDITS ACROSS MANY TURNS ARE UNRELIABLE.
      Prefer whole-file rewrites for files under ~600 lines.
      For larger edits, use PowerShell .Replace / -replace
      with exact on-disk anchors, verified with findstr
      immediately before the edit. Never trust memory of the
      file's state. FG21 and FG22 are the evidence.

P-AA  NEVER USE -NoNewline WITH A MULTI-LINE ARRAY IN
      Set-Content. Use -join "`n" or omit -NoNewline.
      FG22 is the evidence.

P-BB  ALL COMPILE-TIME FAILURES IN SLICE 3 WERE CAUGHT ON
      CLOUD, NOT ON MAIN. Six across three sub-slices. Cloud
      is the only cargo gate. Restated from P-G because it
      remains the load-bearing process rule for this project.

P-CC  TEST-ONLY SURFACES MUST BE VISIBLE TO INTEGRATION TESTS.
      Use a crate feature (test-mock-provider pattern) rather
      than #[cfg(test)]. FG23 is the evidence.

P-DD  ONE APPENDIX PER SESSION (restated, P-J / P-M / P-V /
      P-Y). Do not edit prior appendices. This appendix is new.

================================================================
H.6 — OPEN ITEMS
================================================================

New this session:

  - None. Slice 3 is closed with no new open items beyond
    the ones carried forward.

Carried from Appendix G §G.7, unchanged:

  - FG9: vite watcher EBUSY on cargo build. Unfixed.
  - Vite config __dirname warning. Cosmetic.
  - O1: three ghost rows on the Agent.
  - O2: Communication Tools page shows event metadata, not
    credential health.
  - O3: CONNECTOR_CREDENTIAL_REPLACED remains deferred.
  - O4 items: registration/onboarding gap; Agent
    settings.dat user_id; Mocean HTTP shape; voice/Gemini
    adapters (the Gemini adapter itself is now built; the
    catalog row is still COMING_SOON); cancel-negative test;
    .bak files.

Notably resolved this session:

  - The Gemini AI adapter exists. The catalog row mvpStatus
    remains COMING_SOON; a later session flips it when the
    Copilot command is wired.

================================================================
H.7 — QUEUE
================================================================

DONE
  CONNECTOR-EVENT-ORDER-SPEC v1.0. F15 CLOSED.
  SLICE 1 (Part II §II.17) — opt-out enforcement and
  disclosure text. CLOSED 2026-10-12.
  SLICE 2 (Part II §II.16) — Context Engine and deterministic
  fallback. CLOSED 2026-10-12.
  SLICE 3 (Part II §II.4, §II.5.2, §II.5.3, §II.6, §II.7) —
  AI boundary, adapters, network controls. CLOSED 2026-10-12.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. SLICE 4 — Strategy Engine and fact validation.
     Part II §II.8 through §II.11. Own mini spec before code.

  2. SLICE 5 — Recommendation lifecycle, reservation,
     contact limits, and UI.

  3. SLICE 6 — Integrated security and regression tests.

  Then the carried items from Appendix E §E.8 / F.7 / G.8:

  4.  O1 ghost-row fix (deferred by founder).
  5.  O2 Communication Tools credential health.
  6.  STEP 1.5 — More known providers.
  7.  STEP 1.6 — Data-source display surface.
  8.  CONNECTOR_CREDENTIAL_REPLACED.
  9.  TWILIO SMS BYOP SEND VERIFICATION.
 10.  B7 CREDENTIAL-TRANSIT REVIEW.
 11.  CANCEL-NEGATIVE FOR TIER 1.
 12.  REGISTRATION / ONBOARDING BLOCK.
 13.  ACCEPTANCE — end-to-end.

================================================================
H.8 — WHAT THIS APPENDIX DOES NOT DO
================================================================

  It does not amend Part II beyond the §II.3 amendment block
  already recorded in Appendix G.
  It does not reopen CONNECTOR-EVENT-ORDER-SPEC Part I.
  It does not decide any remaining O1/O2 question.
  It does not promote Slice 4 to started. Slice 4 needs its
  own mini spec before code.

================================================================
END OF APPENDIX H
================================================================

================================================================
APPENDIX I — SLICE 4 CLOSE
(added v3.2, 2026-10-13)
================================================================

I.0 — WHY THIS APPENDIX EXISTS

Appendix H closed Slice 3 and pointed the queue at Slice 4
(Strategy Engine and fact validation). The frozen Slice 4
mini spec v1.0 was produced in a prior session. This session
implemented it: four new modules, two new test files, two
edits, one bulk commit plus one defect-fix commit, cloud
verification green at 350/350.

Where this appendix conflicts with H.7's queue, this
appendix wins.

================================================================
I.1 — MACHINE STATE AT CLOSE
================================================================

MAIN:   HEAD ab4a61f plus the Appendix I commit that follows.
        Pushed. Working tree clean except the two known
        untracked files (CHAT-HANDOFF-DUMP.txt, make-dump.ps1).

CLOUD:  at ab4a61f. Full workspace test green (350/350).

Commits added this session, oldest first:

  25d06b2  slice 4: strategy engine and fact validation
  ab4a61f  slice 4 fix: cover absent/non-string/missing
           provider_response answer cases

Safe resume check:

    cd /d C:\Users\kucha\gorka-app
    git log --oneline -5
    git status --short

================================================================
I.2 — WHAT SLICE 4 SHIPPED
================================================================

Per SLICE 4 MINI SPEC v1.0 (FROZEN), Sections 5-8.

New modules (shared/src/):

  prompts.rs           PROMPT_VERSION, SYSTEM_PROMPT,
                       USER_MESSAGE_TEMPLATE. Fixed templates.
                       No debtor data placeholders.

  strategy.rs          StrategySource, StrategyOutcome,
                       StrategyError, analyze(). The fallback
                       contract: build_fallback_input runs
                       first; failure there is Err; every AI-side
                       failure returns Ok(Fallback).

  fact_validation.rs   ClaimType, ClaimSource, Verification,
                       ClaimFlag, FactValidationError,
                       validate_draft(). Five claim types.
                       Read-only DB. Deterministic comparison.

  claim_resolution.rs  ResolutionChoice, ResolutionRecord,
                       ResolutionError, resolve_claim().
                       Stale-flag rejection via draft_id.
                       In-memory records only. No persistence.

Edited:

  shared/src/lib.rs              four pub mod lines
  shared/src/recommendation.rs   serde derives on the four
                                 enums; no logic change

New test files (shared/tests/):

  slice4_strategy.rs           19 tests
  slice4_fact_validation.rs    37 tests

Total new tests: 56. Workspace went from 294 to 350.

Not touched: any adapter, any HTTP client, any Tauri binary,
any frontend, any migration, compliance.rs, ai_boundary.rs,
ai_request.rs, ai_mapping.rs, base_url.rs, transport.rs,
context.rs. Per Section 3.

================================================================
I.3 — DEVIATIONS FROM SLICE 4 MINI SPEC v1.0
================================================================

D1. Section 9 items #2, #3, #14 dropped as unreachable.

    #2 "Context build failure -> Ok(Fallback)":
       build_fallback_input and build_context both call
       load_facts on the same connection with the same args.
       If one succeeds, the other cannot independently fail.
       The branch in analyze is defensive only.

    #3 "Boundary rejection via analyze -> Ok(Fallback)":
       analyze builds the request internally from fixed
       prompt constants and a Context that serializes into
       the accepted schema. No caller-supplied input can
       produce a BoundaryBlock through the analyze signature.
       Boundary rejection is covered by slice3a_boundary.rs
       against parse_and_validate directly.

    #14 "Fallback path: zero adapter.send calls":
       the earliest reachable AI-path failure is the adapter
       itself. Any fallback caused by an AI-side failure
       occurs after send() has been called once. The
       one-call expectation on the AI path is covered by
       strategy_ai_path_calls_adapter_exactly_once.

    Reasons recorded in the header comment of
    slice4_strategy.rs.

D2. Section 6.5 step 2 names RawOutboundAiRequest as the value
    to serialize. That type derives Deserialize only, and
    ai_request.rs is in Section 3's not-touched list. The
    implementation builds a serde_json::json! value with the
    same shape and passes it through parse_and_validate. Same
    boundary, same result. Recorded as an implementation note
    in the header of strategy.rs.

D3. Section 8.3 EditRemoved contract. Founder direction adopted
    to resolve the span-equality-vs-removed contradiction:

      flag.draft_id > current_draft_id   -> StaleFlag
      flag.draft_id == current_draft_id  -> ClaimStillPresent
                                            (no edit since flag)
      flag.draft_id < current_draft_id   -> bounds check, then
                                            equality check,
                                            then Ok(EditRemoved)

    A global substring check was considered and rejected: a
    draft may contain the same phrase twice, and a global check
    would refuse resolution when an unrelated occurrence remains.
    The span-not-edit-mapping limitation is documented verbatim
    in the module header of claim_resolution.rs, with the
    caller workflow that makes it safe (re-validate after every
    edit; resolve the stale flag only when the matching claim is
    absent from the fresh flag set).

D4. Section 7.5 CalendarDate detection is DD-MM-YYYY
    (day 01-31, month 01-12). YYYY-MM-DD is not detected.
    Founder direction in this session. DB storage is RFC 3339;
    the verification path parses both sides to NaiveDate and
    compares dates, not strings.

D5. Section 11 said "One bulk commit." Delivered two: the bulk
    commit 25d06b2 plus defect-fix commit ab4a61f. P-Q permits
    a follow-up commit when a defect is found after the bulk.
    See I.4 FG24.

D6. Section 9 reachability audit. Before any test file was
    written, every planned test was checked for a concrete
    setup path through the frozen public interface. The three
    unreachable cases (D1) were removed from the file before
    the cloud trip; the remaining 16 strategy cases and 33
    fact-validation cases were confirmed reachable. The
    audit itself was the reason two cloud trips were not
    wasted on tests that could not have passed.

================================================================
I.4 — FINDINGS THIS SESSION
================================================================

FG24  The mock adapter carried three unused MockBehavior
      variants (NoAnswerField, NoProviderResponse,
      NonStringAnswer) from the initial test draft. Rust
      warned "never constructed" on the strategy test binary.
      The variants represented Section 6.5 step 5 coverage
      (answer absent, non-string, provider_response absent)
      that had been declared but not tested. Fixed by adding
      the three tests, not by deleting the variants. Commit
      ab4a61f.

FG25  Notepad on Windows saved a file to the wrong path or
      with a .txt suffix three times in this session when the
      target did not already exist. The reliable pattern is
      the one already documented in prior appendices: confirm
      the on-disk state with `type <path>` before pasting;
      if the file does not exist, open notepad with the full
      path and answer Yes to the create-file prompt; use
      Save-as-type All Files (*.*) to prevent a .txt suffix;
      verify with `dir <path>` immediately after saving.

FG26  An earlier draft of fact_validation.rs carried a stray
      placeholder use statement (use crate::fact_validation_
      types::*;) from a mis-paste. Caught by the fifth findstr
      pattern on the file (fact_validation_types) at
      verification time, before the cloud trip. The pattern
      set now includes that pattern permanently as a guard.

================================================================
I.5 — PROCESS AMENDMENTS
================================================================

P-EE  UNREACHABLE TESTS ARE DROPPED AND THE REASON IS
      DOCUMENTED, NOT IGNORED.
      When a mini spec names a test whose setup path does
      not exist through the frozen public interface, the
      test is removed from the acceptance file, not
      #[ignore]d. The reason is recorded in the test file's
      header, together with the interface change that would
      make the test possible in a future slice. FG24 is one
      example of the cost of carrying declared-but-unreached
      coverage; the fix is not to hide it under #[ignore],
      it is to close it with a reachable test or remove it
      with a written reason.

P-FF  A REACHABILITY AUDIT IS RUN BEFORE THE FIRST TEST
      IS WRITTEN.
      Every planned test must name a concrete setup path
      through the frozen public interface: an input to the
      entry function, a mock injected at a defined seam, a
      DB row, or a literal value of a public type. Tests
      that fail the audit are addressed with the founder
      before any code is written. This session's audit
      caught three unreachable cases and avoided two cloud
      trips.

P-GG  THE FIVE-OR-MORE VERIFY PATTERN FOR A NEW FILE
      INCLUDES A NEGATIVE GUARD.
      When a new file is written and its content was pasted
      from a chat, the verification pattern set includes at
      least one pattern that must NOT appear (a stray
      identifier from an earlier bad paste). Absence of the
      negative match confirms the file was replaced whole,
      not appended to. FG26 is the evidence.

================================================================
I.6 — OPEN ITEMS
================================================================

New this session:

  - None. Slice 4 is closed with no new open items beyond
    the ones carried forward.

Carried from Appendix H Section H.6, unchanged:

  - FG9: vite watcher EBUSY on cargo build. Unfixed.
  - Vite config __dirname warning. Cosmetic.
  - O1: three ghost rows on the Agent.
  - O2: Communication Tools page shows event metadata, not
    credential health.
  - O3: CONNECTOR_CREDENTIAL_REPLACED remains deferred.
  - O4 items: registration/onboarding gap; Agent
    settings.dat user_id; Mocean HTTP shape; voice adapter;
    cancel-negative test; .bak files. (The Gemini adapter
    itself is built; its catalog row is still COMING_SOON.)

Notably resolved this session:

  - None from prior open items. Slice 4 was additive.

================================================================
I.7 — QUEUE
================================================================

DONE
  CONNECTOR-EVENT-ORDER-SPEC v1.0. F15 CLOSED.
  SLICE 1 (Part II Section II.17) — opt-out enforcement and
    disclosure text. CLOSED 2026-10-12.
  SLICE 2 (Part II Section II.16) — Context Engine and
    deterministic fallback. CLOSED 2026-10-12.
  SLICE 3 (Part II Section II.4, II.5.2, II.5.3, II.6,
    II.7) — AI boundary, adapters, network controls.
    CLOSED 2026-10-12.
  SLICE 4 (Part II Sections II.8-II.11) — Strategy Engine
    and fact validation. CLOSED 2026-10-13.

IN FLIGHT
  None.

NEXT — IN ORDER

  1. SLICE 5 — Recommendation lifecycle, reservation,
     contact limits, and UI. Own mini spec before code.
     First slice that persists recommendation state and
     touches the send path. Larger than Slice 4.

  2. SLICE 6 — Integrated security and regression tests.

  Then the carried items from Appendix E Section E.8 /
  F.7 / G.8 / H.7:

  3.  O1 ghost-row fix (deferred by founder).
  4.  O2 Communication Tools credential health.
  5.  STEP 1.5 — More known providers.
  6.  STEP 1.6 — Data-source display surface.
  7.  CONNECTOR_CREDENTIAL_REPLACED.
  8.  TWILIO SMS BYOP SEND VERIFICATION.
  9.  B7 CREDENTIAL-TRANSIT REVIEW.
 10.  CANCEL-NEGATIVE FOR TIER 1.
 11.  REGISTRATION / ONBOARDING BLOCK.
 12.  ACCEPTANCE — end-to-end.

================================================================
I.8 — WHAT THIS APPENDIX DOES NOT DO
================================================================

  It does not amend Part II. Part II stands.
  It does not reopen CONNECTOR-EVENT-ORDER-SPEC Part I.
  It does not decide any remaining O1/O2 question.
  It does not promote Slice 5 to started. Slice 5 needs
  its own mini spec before code.

================================================================
END OF APPENDIX I
================================================================
