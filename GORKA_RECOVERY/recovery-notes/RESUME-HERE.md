# RESUME HERE

**Updated:** 2026-10-06 (Phase 1 closed: connectors skeleton on cloud, all green)
**Main machine:** ea8fb49
**Cloud machine:** ea8fb49
**GitHub:** ea8fb49

---

## Where we are

Phase 1 is closed. The gorka-shared::connectors skeleton exists on
all three machines at ea8fb49. Cloud build, workspace tests, and
node verify are green.

Phase 1 added one module and one line. Nothing else changed. No new
dependencies.

The relevant commit:

  ea8fb49  Phase 1: gorka-shared::connectors skeleton

Prior Phase 0 commits, still in history:

  221a771  RESUME-HERE.md: Phase 0 closed.           (docs only)
  dcfe858  Phase 0 build fixes: two doc-comment placements, two
           argument swaps. Found on the first cloud build.
  5bf435b  Phase 0: created_by added to COMMUNICATION_LOGGED.

---

## What Phase 1 delivered

New file: shared/src/connectors/mod.rs (194 lines).

  - ConnectorAdapter trait: `: Send`, three methods
    (send, test_connection, code), object-safe, synchronous.
    Mirrors CONNECTOR-MODEL.md Section 7.2.
  - SendRequest, SendResult, ConnectorError, ConnectorErrorKind:
    the exact shapes from Section 7.3. Debug on all four.
    Display and std::error::Error on ConnectorError.
  - ConnectorCredential { value: Vec<u8>, configuration:
    serde_json::Value }: closes the spec gap in Section 7.4/7.6
    where the type was named but never defined. No Debug derive,
    by design - accidental printing is harder by construction.
  - AdapterFactory: fn(ConnectorCredential) -> Box<dyn
    ConnectorAdapter>. The factory is the boundary between the
    registry and the adapter.
  - ConnectorRegistry: HashMap<&'static str, AdapterFactory>
    with new(), register(), factory(). Unseeded. No provider
    codes hardcoded. No Default impl.

Modified file: shared/src/lib.rs. One line added:

  pub mod connectors;

placed between `communications` and `dashboard`, keeping the
existing alphabetical order.

Six tests, all inline in mod.rs:

  1. registry_new_is_empty
  2. registry_register_then_lookup
  3. registry_lookup_unknown_code_returns_none
  4. factory_persists_after_constructed_adapter_is_dropped
  5. adapter_is_object_safe
  6. connector_error_debug_and_display_are_stable

No new dependencies. serde and serde_json were already present.

---

## Verification at ea8fb49

  cargo build --workspace   green. Pre-existing warnings only:
                            gorka-agent 2, gorka-client 3.
                            Unchanged from Phase 0.
  cargo test --workspace    all pass. connectors 6/6 new;
                            enrollment 6/6; sync 9/9 (V6 included);
                            sync_engine 1/1; sync_pipeline 6/6;
                            sync_session 2/2; sync_wire_roundtrip
                            15/15.
  node verify/index.mjs     9/9 PASS.

---

## What Phase 1 did not do

  - No adapter files (twilio_sms.rs, twilio_voice.rs,
    resend_email.rs, mocean_sms.rs, gemini_ai.rs). Each is added
    when its adapter is implemented.
  - No command registration in either binary.
  - No network code, no async runtime (no tokio, no async_trait).
  - No AppState wiring. CONNECTOR-MODEL.md Section 7.4 says the
    MVP will store the registry in AppState; that is later-phase
    territory.
  - No touch to auth_http.rs, communications.rs, or any sync
    module.
  - No change outside shared/src/lib.rs and shared/src/connectors/.

---

## Where we go next

Phase 2: to be defined by the founder.

---

## Known loose ends

Documentation:

  - CONNECTOR-MODEL.md Section 9.3 and Section 14 item A2 are
    stale. Both still describe the created_by defect as open, but
    Phase 0 applied the A2 amendment and recomputed V6 to the
    109-byte payload. The document is frozen; a proper fix runs
    through the amendment process. Cosmetic. Record; do not fix
    mid-slice.

  - SYNC-TEST-VECTORS-v1.md header note is stale. It describes
    V6 as PENDING. The V6 entry (line ~1009) and the summary
    table (line ~1120) correctly say FROZEN. Cosmetic.

  - RESUME-HERE.md header lag: folded into this rewrite. The
    previous header said dcfe858, which was stale by exactly the
    commit that wrote it. This header reflects ea8fb49, the
    commit that will contain it. The same self-referential lag
    will recur under the current convention. No convention change
    now.

Code:

  - No JWT decode exists. user_id comes from the login response
    (auth_http.rs UserData.id) and is persisted to settings.dat
    at login. Devices logged in before Phase 0 will not have
    user_id in their store until the next login. Design choice,
    not an accident.

  - The /api/auth/login response contract is now load-bearing
    for the local store. If the backend changes the login
    response shape, local user_id becomes empty and events
    become non-compliant at origination. No backend-side test
    guards this. A future slice should add one, plus a local-
    side check that refuses to originate when user_id is empty.

  - The logout blocks in both binaries do not delete the
    user_id key. Cosmetic.

Environment:

  - Cloud has 8 untracked junk files left from an earlier
    slice: b7-meta-check.cjs, build-6b2b-listener.txt,
    build-6b2b.txt, check-columns.ts, relay-check.cjs,
    test-6b2b-listener.txt, test-6b2b.txt, test-output.txt.
    Same category as the 23 cleaned in 562a7be. They do not
    block anything. A future cleanup commit should delete them.

  - Build warning counts at ea8fb49: gorka-agent 2,
    gorka-client 3. Both pre-existing, unchanged from Phase 0.
    Not caused by Phase 1. Not yet investigated. Recorded so a
    future session does not misattribute them to a recent change.

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