# RESUME HERE

**Updated:** 2026-10-06 (Phase 2 closed: Resend adapter on cloud, all green)
**Main machine:** 585261e
**Cloud machine:** 585261e
**GitHub:** 585261e

---

## Where we are

Phase 2 is closed. The gorka-shared::connectors module now contains
an HTTP abstraction and the first real provider adapter (Resend
email). Cloud build, workspace tests, and node verify are green.

Phase 2 added two new files and two lines in mod.rs. No new
dependencies. No network calls. Everything goes through an injected
HttpClient trait; tests use MockHttpClient.

The relevant commits, in order:

  7271146  Phase 2: Resend email adapter with HttpClient abstraction
  585261e  Phase 2: test helper avoids Debug requirement on adapter

Prior phase commits, still in history:

  1b9066c  RESUME-HERE.md: Phase 1 closed.
  ea8fb49  Phase 1: gorka-shared::connectors skeleton
  221a771  RESUME-HERE.md: Phase 0 closed.         (docs only)
  dcfe858  Phase 0 build fixes.

---

## What Phase 2 delivered

New file: shared/src/connectors/http.rs.

  - HttpMethod, HttpRequest, HttpResponse, HttpErrorKind,
    HttpError.
  - HttpClient trait: `fn execute(&self, request: &HttpRequest)
    -> Result<HttpResponse, HttpError>`. Send + Sync.
  - HttpRequest carries `redacted_debug()` (method, URL, header
    names only, body length). No Debug derive on HttpRequest:
    headers may carry Authorization: Bearer; an accidental
    `{:?}` is a leak path.
  - MockHttpClient behind #[cfg(test)] with a MockHandle so tests
    can inspect sent requests after the client is moved into the
    adapter. Returns (client, handle) from ::new().

New file: shared/src/connectors/resend_email.rs.

  - ResendEmailAdapter. Implements ConnectorAdapter.
  - Constructor `new(credential, http)` parses:
      value:         JSON {"apiKey": "re_..."}
      configuration: JSON {"from": "sender@example.com"}
    Missing or malformed fields produce LocalConfigurationError
    whose message names the field only, never the value.
  - `send()` builds POST https://api.resend.com/emails with
    Bearer auth, JSON body {from, to, subject?, text}. Success
    (200/201) parses {"id": "..."} into SendResult.
  - `test_connection()` builds GET https://api.resend.com/domains.
    200 -> Ok(()), otherwise mapped error.
  - Error mapping: 401/403 -> AuthenticationFailed; 422 ->
    InvalidRecipient; 429 -> RateLimited; 5xx ->
    ProviderTransientError; other 4xx -> ProviderPermanentError;
    HttpError::Transport or Timeout -> TransportError.
  - No Debug derive on the adapter struct (holds api_key in
    plaintext; Debug would be a leak path).

Modified file: shared/src/connectors/mod.rs. Two lines added
after the `use` block:

  pub mod http;
  pub mod resend_email;

Tests: 12 new in resend_email::tests. All 12 pass. The
credential-leak regression (CONNECTOR-MODEL.md Section 7.8) is
among them. Phase 1's 6 tests in connectors::tests still pass.

The HTTP shape (URLs, header names, response bodies) is a
reasonable default for Phase 2. Phase 3 verifies against the live
Resend API and corrects where reality differs.

---

## Verification at 585261e

  cargo build --workspace   green. Pre-existing warnings only:
                            gorka-agent 2, gorka-client 3.
                            Unchanged from Phase 1.
  cargo test --workspace    all pass. gorka_shared lib: 18 (12 new
                            resend_email + 6 connectors). enrollment
                            6/6; sync 9/9 (V6 included); sync_engine
                            1/1; sync_pipeline 6/6; sync_session
                            2/2; sync_wire_roundtrip 15/15.
  node verify/index.mjs     9/9 PASS.

---

## What Phase 2 did not do

  - No adapter factory registration. The frozen factory signature
    is `fn(ConnectorCredential) -> Box<dyn ConnectorAdapter>`
    (CONNECTOR-MODEL.md Section 7.4). It needs a real HttpClient,
    which does not exist yet. Phase 3 adds it.
  - No Tauri command.
  - No DB.
  - No real network. Everything goes through MockHttpClient in
    tests.
  - No new dependency. serde_json was already present.
  - No Mocean adapter. That was considered first; Resend chosen
    because a live credential exists.

---

## Where we go next

Phase 3: test_connection command + real HttpClient + factory
registration. Roughly:

  - Add a real HttpClient implementation backed by
    reqwest::blocking (already a dependency with the blocking
    feature enabled; first use in this crate).
  - Register the Resend factory in ConnectorRegistry under code
    "resend-email".
  - Add the Tauri command in the Client binary that wires
    test_connection to the ConnectorAdapter trait.
  - Verify the HTTP shape against the live Resend API and correct
    the fixtures in resend_email.rs if reality differs.
  - Prerequisite for live testing: a Resend verified sending
    domain, OR use onboarding@resend.dev as the from. A
    @gmail.com from-address will be rejected by Resend.

Full connector arc, in the numbering used since Phase 0:
Phase 4 = Connectors.tsx alignment; Phase 5 = Tier 2 credential
local write; Phase 6 = Zone 3 audit record; Phase 7 = compliance
rules page; Phase 8 = agent send command; ... Phase 15 =
acceptance. See CONNECTOR-MODEL.md Sections 14.2, 14.3 for the
B/C item lists.

---

## Known loose ends

Build warnings (pre-existing, not from Phase 2):

  - shared/src/db.rs:4 -- unused import
    `use serde_json::Value as JsonValue;`
  - shared/tests/sync_engine.rs:92 -- `let mut conn_b_test`
    does not need `mut`.
  Both predate Phase 2. Recorded so a future session does not
  misattribute them to a recent change. Small cleanup slice
  candidate.

Documentation:

  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale: they describe the created_by defect as open, but
    Phase 0 applied the A2 amendment and recomputed V6 to the
    109-byte payload. Frozen document; a proper fix runs through
    the amendment process. Cosmetic.

  - SYNC-TEST-VECTORS-v1.md header note is stale: it describes V6
    as PENDING. The V6 entry and summary table correctly say
    FROZEN. Cosmetic.

Code:

  - No JWT decode. user_id comes from the login response and is
    persisted to settings.dat at login. Design choice.

  - The /api/auth/login response contract is load-bearing for the
    local store. No backend-side test guards it, and no local
    check refuses to originate when user_id is empty. A future
    slice should add both.

  - The logout blocks in both binaries do not delete the user_id
    key. Cosmetic.

Environment:

  - Cloud has 8 untracked junk files left from an earlier slice:
    b7-meta-check.cjs, build-6b2b-listener.txt, build-6b2b.txt,
    check-columns.ts, relay-check.cjs, test-6b2b-listener.txt,
    test-6b2b.txt, test-output.txt. A future cleanup commit
    should delete them.

  - .env files in the repo contain live credentials
    (RESEND_API_KEY, VITE_GEMINI_API_KEY, JWT_SECRET,
    DATABASE_URL with password). Rotation is deferred until
    pre-launch. Recorded so pre-launch work includes rotating
    every key in .env and moving them out of the repo.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot reliably
  compile (SAC blocks build-script binaries at unpredictable
  points).
- One machine owns a slice at a time. Git is the only handoff.
- Edits on main. Commit on main, push, pull on cloud, build and
  test and verify on cloud, pull back on main.
- For any scripted edit to a recovery document or source file:
  use content anchors (FindUnique returns exactly one match or
  throws). Never use raw line indices. Never use String.Replace
  on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
- Read UTF-8 files as UTF-8, never as ANSI. Emoji in source
  files will be silently corrupted otherwise. For single-line
  edits on files that contain non-ASCII characters, edit by
  hand in a text editor instead of scripting.
- git diff <file> after every edit before moving on. Fastest
  proof of a clean write.
- Match tool weight to edit size. Heavy machinery for multi-
  file, multi-anchor edits. Notepad for one-liners.
- One commit per coherent change.
- No guessing. Every fact confirmed on disk before the script
  is written.
- When in doubt, stop and ask the founder.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.
Nothing else is needed.

At slice end: rewrite it with the new state. This file is
rewritten in place, not appended to. It stays under 250 lines.

If the chat dies unexpectedly: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md