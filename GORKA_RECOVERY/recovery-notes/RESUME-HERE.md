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

End of RESUME-HERE.md