RESUME-HERE.md — Full Chat Summary and Handoff
Version 2.2 — written at close of the Send-from-Agent (Twilio SMS) code slice.

This one document is both the summary of this chat and the resume state.
Save it at GORKA_RECOVERY\recovery-notes\RESUME-HERE.md. Open it at the start
of the next chat. Everything needed to resume without reconnaissance is here.

================================================================
1. MACHINE STATE AT CLOSE
================================================================

MAIN:    HEAD 03a7a67. Pushed. origin/main = 03a7a67. Clean tree except
         untracked CHAT-HANDOFF-DUMP.txt and make-dump.ps1.
CLOUD:   03a7a67 after last pull. Build PASS (Agent 2 / Client 3 / shared 9
         warnings). Tests 112/112. Live demo NOT run — see §2c.

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
- shared/tests/sync_pipeline.rs — five new tests (see §3).

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
Tier 1 is honest disclosure, Tier 2 is a warning. Two declarations,
one per tier. One audit event type per tier makes compliance queries
trivial without JSONB extraction.

================================================================
2c. SLICE 4 — SEND-FROM-AGENT (TWILIO SMS) — CODE COMPLETE
================================================================

GOAL (achieved in code)
An Agent user, on a debtor profile, clicks Send SMS next to the phone.
A modal opens. On send, the Agent reads the twilio-sms credential from
its local SQLCipher, calls the Twilio adapter, receives a provider
message id, and writes a communications row. That row originates a
COMMUNICATION_LOGGED sync event, which propagates back to the Client.

WHAT SHIPPED
- shared/src/connectors/local_record.rs: read_local_connector_credential.
  Returns Option<LocalConnectorSecret> with credential_value and parsed
  configuration. The struct name makes the secret explicit; no other
  read path returns credential_value.
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

LIVE DEMO — NOT RUN. Blocked by a missing code path.
  The Client UI routes connectors by catalog.isManagedByGorka:
    Tier 1 (isManagedByGorka: true) → Connect button → /api/connectors/enable
      → audit row + cloud client_connectors CONNECTED. Does NOT write
      local_connectors. Does NOT originate CONNECTOR_ENABLED.
    Tier 2 (isManagedByGorka: false) → Add my credentials → the
      write_local_connector_credential Tauri command → local write + event.
  twilio-sms is isManagedByGorka: true, so clicking Connect on the Client
  does not deliver the credential to the Agent. The Agent's Send modal
  finds zero SMS connectors and the demo stalls at the modal step.

  This is NOT a bug in Slice 4. It is the gap between Tier 1's UI path
  (built, writes audit only) and Tier 1's credential provisioning path
  (not built, funded phase). Tier 1 credential transit from GORKA cloud
  to the Client device is the missing slice.

  THREE WAYS FORWARD — pick one when the next session opens:
    A. Build the Tier 1 provisioning slice. Largest, most correct.
    B. Flip twilio-sms isManagedByGorka to false temporarily, use the BYOP
       path, enter real Twilio credentials in the ConfigurationModal.
       Works today, contradicts the founder's model, needs unwinding.
    C. Invoke write_local_connector_credential directly from the Client
       Tauri devtools console. Proves the wire path; requires real Twilio
       credentials for the send to hit the network.

  RECOMMENDATION: A. Build the provisioning slice. It is the missing
  piece and it is the path the product is designed to use.

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
  Cancel-negative for Tier 1. The code path is structurally identical to
  Tier 2's (verified in B4b). Run before the next Tier 1 change: disconnect
  Resend, click Connect, click Cancel, verify no new audit row.
  Slice 4 live demo. Blocked. See §2c.

================================================================
4. KNOWN BEHAVIORS BY DESIGN — NOT BUGS
================================================================

CLIENT DISABLE DOES NOT REACH THE AGENT
  Disabling custom-api on the Client leaves the Agent card ENABLED. By design.
  CONNECTOR_DISABLED origination was never built. The receiver recognizes the
  event and returns Ok(AckOutcome::Rejected) — nothing is written, the batch
  continues. Pending the SYNC-ARCHITECTURE.md amendment in §7.

TIER 1 CONNECTORS DO NOT SYNC
  resend-email (and twilio-sms) connect on the Client but do not appear on the
  Agent. By design. Only the BYOP Tier 2 path calls
  write_local_connector_credential, which is the event-originating write.
  Tier 1 sync is the provisioning slice in §14 item 2.

TIER 1 AUDIT EVENT NAME
  TIER1_CONNECTION_ACKNOWLEDGED is distinct from
  ZONE_3_CONNECTION_ACKNOWLEDGED. Do not merge them. Different
  declarations, different legal weight, different audit rows.

================================================================
5. SECURITY — ACTION REQUIRED
================================================================

The Supabase pooler password and the Resend API key were pasted into the chat
log twice. Both are compromised. Rotate:

  1. Supabase dashboard — reset the pooler database password.
  2. Resend dashboard — revoke re_... and issue a new key.

Do this before the next live run. Never paste either value into a chat again.
Every command in §6 uses placeholders.

================================================================
6. RUN COMMANDS — THE FIXED RUNBOOK
================================================================

This section exists because an earlier version of this file lacked it and
every new chat re-derived these commands. Do not delete it. Do not guess.
Values are placeholders — fill them in yourself.

LAYOUT FACTS (these cost real time to rediscover):
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
    npx tsx src/backend/index.ts
  Wait for "listening on port 3000". Leave running.

Terminal 2 — Client vite
    cd /d C:\gorka-app
    npm run dev
  Wait for "Local: http://localhost:5173/". Leave running.

Terminal 3 — Agent vite
    cd /d C:\gorka-app\agent-dashboard
    npm run dev
  Wait for "Local: http://localhost:XXXX/". It must be 5174. If it is not,
  stop — something else is on 5173.

Terminal 4 — Client Tauri window
    cd /d C:\gorka-app
    cargo run --bin gorka-client
  Window opens. Log in, unlock.

Terminal 5 — Agent Tauri window
    cd /d C:\gorka-app
    cargo run --bin gorka-agent
  Window opens. Log in, unlock.

ALTERNATIVE (one command per app, spawns its own vite):
    Client:  cd /d C:\gorka-app            &&  npm run tauri:dev
    Agent:   cd /d C:\gorka-app\src-tauri-agent && npx tauri dev
  The five-terminal form is preferred for a demo — the vite port lines stay
  visible.

DEMO SEQUENCE — SLICE C (works today)
  Client: Connectors page. Custom API card. If CONNECTED, click Disable.
          Click Add my credentials. Zone 3 declaration opens. Accept.
          Enter a dummy credential. Save.
  Agent:  Communication Tools. Card appears within 2-3 seconds.
          custom-api, TIER2, ENABLED. No credential shown.
  Proof:  Restart the Agent (Terminal 5). Log in, unlock. Card persists.

DEMO SEQUENCE — SLICE 4 (blocked, see §2c)
  Requires Tier 1 provisioning first.

================================================================
7. ARCHITECTURE DEFECT — ESCALATED, NOT FIXED
================================================================

SYNC-ARCHITECTURE.md §12.9 states the order-independence invariant: same
accepted events produce the same final state, regardless of arrival order.

§25.15.5 and §25.16.5 (CONNECTOR_DISABLED, CONNECTOR_CREDENTIAL_REPLACED)
contain arrival-order-dependent behavior: "REPLACED on a missing row is a
no-op, and a later ENABLED wins." That can produce different final states
depending on arrival order.

The defect is confirmed by reading the document. §12.9 is a hard invariant
with no carve-out. §25.14.6 concedes the violation in writing: "The MVP does
not add a deterministic protocol-order tie-break for CONNECTOR records,
because the deployment model rules out the case."

RESOLUTION TAKEN (Slice C)
The slice narrowed to CONNECTOR_ENABLED only. DISABLED and REPLACED are
recognized, validated, and deferred. The deferred guard returns
Ok(AckOutcome::Rejected) — not Err, because Err propagates out of
process_sync_message and kills the whole batch. Ok(Rejected) is a clean
per-event outcome: the transaction drops, nothing is written, the batch
continues.

THREE OPTIONS — DECISION STILL OPEN
  A. Restore conformance. Add winning_logical_clock / winning_device_id /
     winning_sequence columns to local_connectors. Every CONNECTOR event's
     apply compares its protocol tuple against the stored tuple using §12.6.
     Earlier tuple loses; state does not change. DISABLED becomes soft-delete.
     §25.14.6's punt is deleted. Requires a migration, a LOCAL-TABLES.md edit,
     three section amendments, and a code slice.
  B. Amend §12.9 to carve out CONNECTOR records. One sentence. Permanently
     weakens a MUST clause. §25.15.5 and §25.16.5 stay as written.
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
  No entity_field_state rows — §25.14.5 excludes CONNECTOR from field-level
  reconciliation.

RECONNAISSANCE FINDINGS — DO NOT RE-DERIVE
  - Parsers already exist in shared/src/sync_parse.rs for all three CONNECTOR
    payloads. Encoders in shared/src/sync.rs. Both committed.
  - upsert_local_connector does NOT open a transaction; rusqlite::Transaction
    derefs to Connection, so calling it inside a caller-owned tx works.
  - originate_event requires an open transaction and does not commit.
  - JSON.stringify is NOT RFC 8785. Adequate for the current single-key config.
  - §25.14.4 does not require connector_code to exist in the catalog. The
    pipeline accepts any non-empty code. UI must handle unknown codes.
  - §25.14.5 says store payload.tier as transmitted. Receiver does not re-derive.
  - Client's source_device_id is the placeholder "local-device". The receiver
    stores the real wire device_id hex. The two need not match.
  - process_event returns Result<AckOutcome, String>. Err propagates out of
    process_sync_message via ?.
  - log_audit signature: fn log_audit(conn: &Connection, action: &str,
    debtor_id: Option<&str>, record_count: i64, details: &str)
    at shared/src/db.rs:735. Writes to table audit_log, column action.
  - communications::insert_communication ALREADY originates a
    COMMUNICATION_LOGGED sync event (lines 140 and 198). The send path does
    not need to originate it again.
  - shared/src/connectors/http_reqwest.rs is production-ready. Real
    reqwest::blocking client, 30s connect / 60s read timeouts.
  - Twilio credential JSON is {"accountSid","authToken"}. Config is {"from"}.
    The adapter validates both at construction.

================================================================
9. ENDPOINTS
================================================================

src/backend/routes/connectors.routes.ts, mounted at /api/connectors behind
authenticateToken:

  GET   /api/connectors          caller's org enablements
  GET   /api/connectors/catalog  active catalog rows
  POST  /api/connectors/enable   { connectorCode, credentialsLocation:'LOCAL',
                                   zone3Acknowledged?: boolean,
                                   tier1Acknowledged?: boolean }
  POST  /api/connectors/disable  { connectorCode }

Other relevant routes: POST /api/auth/login, GET /api/auth/me,
POST /api/metrics/sync, POST /api/activity/sync, GET /api/boundary-proofs,
POST /api/connector-usage/sync, GET /api/billing/*, GET /api/licenses/*,
POST /api/licenses/set-plan.

No new endpoints in Slice C or Slice 4. Credential sync is device-to-device;
GORKA cloud is not on the path.

================================================================
10. FILE INVENTORY
================================================================

REFERENCE FILES (on disk, needed for context)
  shared/src/sync.rs              encoders (all three CONNECTOR encoders)
  shared/src/sync_parse.rs        parsers (all three CONNECTOR parsers)
  shared/src/sync_handshake.rs    AckOutcome enum
  shared/src/db.rs                log_audit at line 735; audit_log at 746
  shared/src/connectors/mod.rs    ConnectorAdapter trait, ConnectorCredential,
                                  SendRequest, SendResult (now Serialize),
                                  ConnectorRegistry, build_default_registry
  shared/src/connectors/http.rs, http_reqwest.rs   HttpClient trait + real client
  shared/src/connectors/resend_email.rs   adapter pattern
  shared/src/connectors/twilio_sms.rs     adapter, production-ready
  shared/src/connectors/mocean_sms.rs     adapter, HTTP shape unconfirmed
  shared/src/communications.rs    insert_communication + delete_communication
  shared/src/storage.rs           AppStorage
  src-tauri-agent/src/auth.rs     get_organization_id
  src-tauri-agent/src/main.rs     generate_handler! block
  agent-dashboard/src/pages/DebtorProfilePage.tsx
                                  Phone row: Send SMS button; modal mount
  prisma/seed-connectors.ts       six connector rows

RECOVERY DOCUMENTS
  GORKA_RECOVERY/recovery-notes/RESUME-HERE.md       this file
  GORKA_RECOVERY/recovery-notes/CONNECTION-CENTER.md model spec
  GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md   older spec
  GORKA_RECOVERY/recovery-notes/SYNC-ARCHITECTURE.md v1.6
  GORKA_RECOVERY/recovery-notes/LOCAL-TABLES.md      v1.4
  GORKA_RECOVERY/recovery-notes/CLOUD-TABLES.md
  GORKA_RECOVERY/recovery-notes/AGENT-APP-SPEC.md    v1.3
  GORKA_RECOVERY/recovery-notes/GORKA-MVP-SCOPE.md   v1.1
  GORKA_RECOVERY/recovery-notes/MULTI-USER-CONCEPT.md v2.0
  GORKA_RECOVERY/recovery-notes/RECOVERY-RULES.md    14 rules

SCHEMA
  prisma/schema.cloud.prisma
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

  resend-email    LIVE          adapter yes            Tier 1 Connect (declaration)
  twilio-sms      LIVE          adapter yes            Tier 1 Connect (no form yet)
  mocean-sms      COMING_SOON   adapter yes            no UI yet
  twilio-voice    COMING_SOON   no adapter             none
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
  - One commit per coherent change. Multi-commit slices are fine; all pushed
    before the single cloud trip.
  - npx prisma db push always needs --schema=prisma/schema.cloud.prisma plus
    the pooler DATABASE_URL override.
  - PowerShell here-strings: blank line before closing '@.
  - When giving commands to the founder: open-file command first
    (notepad <path>), then the edit content, then the verify command. One file
    at a time. Do not batch.
  - Whole-file replacement: output the whole file. Do not do incremental
    anchor edits across many turns. They produce wrong-file edits and stale
    state.
  - When in doubt, stop and ask. Do not guess.

================================================================
14. SLICE PLAN — DONE, IN FLIGHT, REMAINING
================================================================

DONE (prior sessions)
  gorka-shared::connectors skeleton (trait, types, registry).
  Adapters: resend-email (live-verified), twilio-sms (production-ready),
            mocean-sms (unit-tested, HTTP shape unconfirmed).
  B1, B2  Connectors.tsx alignment.
  B3      Tier 2 credential local write.
  B4      Zone 3 audit record (BYOP path).
  B4b     Zone 3 declaration gate.
  C5      Credential-leak regression per adapter.
  Session A  Twilio SMS and Mocean SMS adapters.
  Slice C    Connector enablement sync. §2.
  Slice 1    Tier 1 declaration gate. §2b.
  Agent restart test — passed.

DONE (this session)
  Slice 4 — Send-from-agent (Twilio SMS), code only. §2c.
  Live demo deferred; see §2c for the blocker.

IN FLIGHT
  None. Everything pushed.

REMAINING — DEPENDENCY ORDER, NOT SCHEDULE
  1. Rotate credentials. §5. Supabase pooler password, Resend key.
  2. TIER 1 PROVISIONING SLICE. Blocks the Slice 4 demo. Design: how does a
     GORKA-managed connector's credential travel from GORKA's cloud to the
     Client device, and how does the Client's write_local_connector_credential
     get called from the Tier 1 Connect path? This is the missing piece. §2c.
  3. SYNC-ARCHITECTURE.md amendment — resolve §25.15.5/§25.16.5 vs §12.9.
     Then CONNECTOR_DISABLED and CONNECTOR_CREDENTIAL_REPLACED origination
     and apply.
  4. Slice 4 live demo. After 2.
  5. Compliance rules page (B5, B6) — Client Dashboard page writing
     compliance_rules locally.
  6. Compliance enforcement layer — preflight check in the send flow.
  7. Second send path (Resend email) — proves the pattern generalises.
  8. Copilot command (C3, C4) + AI boundary layer — the largest remaining
     block. Redaction rules, placeholder system, Gemini adapter, structural
     tests.
  9. Tier 1 credential transit verification (B7) — review-only.
 10. Acceptance — end-to-end: enable a connector, send a message, verify
     communication row, sync event, compliance checks, credential never left
     the device.

DOCS-ONLY / TEST-ONLY (fold into any session)
  - V6 stale lines in SYNC-TEST-VECTORS-v1.md (two "PENDING" lines).
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
  - Slice 4 live demo deferred, blocked by the missing Tier 1 provisioning
    path (§2c).
  - Cloud cargo build needs TMP/TEMP override (§6).
  - .bak files in working tree, untracked. Delete at leisure.
  - CHAT-HANDOFF-DUMP.txt and make-dump.ps1 untracked at root.
  - Client disable does not propagate to Agent (§4).
  - Tier 1 connectors do not sync (§4).
  - Mocean SMS HTTP shape unconfirmed against current docs.
  - twilio-voice and gemini-ai adapters not built.
  - Tier 1 provisioning — funded phase.
  - SYNC-ARCHITECTURE §7 A/B/C decision — not made.

================================================================
16. HOW TO USE THIS FILE
================================================================

  At the start of a new chat: paste this file. That is the brief.
  At slice end: rewrite it in place. Do not append.
  If the chat dies unexpectedly: this file is stale by at most one operation.
  Paste it.

End of RESUME-HERE.md