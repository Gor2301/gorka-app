# RESUME HERE

**Updated:** 2026-10-07 (Session A shipped: Twilio SMS and Mocean SMS
adapters landed in the shared crate. Rust only, no UI wiring.)
**Main machine:** bf73b5b
**Cloud machine:** bf73b5b (last verified green)
**GitHub:** bf73b5b

---

## Where we are

Two SMS provider adapters now exist in the shared crate, mirroring
the Resend email adapter. Both are registered in the default
connector registry. Neither has a UI surface yet, and neither is
wired to any Tauri command. The catalog's `mvpStatus` for both
stays `COMING_SOON` so the admin sees no change.

This was Session A. The next session (Session B) is the send-from-
agent slice that wires an adapter to a UI button and flips its
`mvpStatus` to LIVE.

Commits added this session, newest first:

  bf73b5b  Mocean SMS adapter (Rust, no UI wiring; HTTP shape unconfirmed)
  30ec7cc  Twilio SMS adapter (Rust, no UI wiring)
  71835a7  RESUME-HERE.md: B4b shipped, Zone 3 declaration wired
  35ad007  Zone 3 declaration gate for BYOP enable + audit row

---

## What this session built

  shared/Cargo.toml
    Added base64 0.22 and serde_urlencoded 0.7. Both were already
    in Cargo.lock transitively (base64 0.22.1, serde_urlencoded
    0.7.1), so the lock file did not change.

  shared/src/connectors/twilio_sms.rs        (new, 587 lines)
    TwilioSmsAdapter. HTTP Basic auth. Form-encoded body to
    https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json.
    test_connection hits .../Accounts/{Sid}.json. 17 unit tests
    including the mandatory credential-leak regression.
    Credential: {"accountSid","authToken"}. Config: {"from"}.

  shared/src/connectors/mocean_sms.rs        (new, 591 lines)
    MoceanSmsAdapter. HTTP Basic auth. Form-encoded body to
    https://rest.moceanapi.com/rest/2/sms. test_connection hits
    .../account/balance. 16 unit tests including credential-leak
    regression. Credential: {"apiKey","apiSecret"}. Config: {"from"}.
    Header comment carries the honest caveat: HTTP shape written
    from general knowledge, NOT yet confirmed against Mocean's
    current docs.

  shared/src/connectors/mod.rs
    Two new module declarations. Two new registry registrations.
    Two new registry tests.

---

## Cloud verification (2026-10-07, commit bf73b5b)

  cargo build --workspace                 PASS. gorka-agent 2
                                          warnings, gorka-client 3,
                                          gorka-shared 9 (was 6;
                                          three new warnings, see
                                          below).
  cargo test --workspace                  107/107 PASS.
                                          Breakdown: shared lib 60,
                                          connector_tables 4,
                                          enrollment 6, sync vectors
                                          9, sync_engine 1,
                                          sync_pipeline 6,
                                          sync_session 2,
                                          sync_wire_roundtrip 19.
                                          35 of the 107 are new this
                                          session (17 Twilio + 16
                                          Mocean + 2 registry).
  node verify\index.mjs                   9/9 PASS. Wire format is
                                          intact; nothing was
                                          changed on the wire.

---

## Warning count change, this session

The shared crate went from 6 warnings to 9. The three new warnings:

  shared/src/connectors/twilio_sms.rs:49
    fields `code` and `status` in Twilio's ErrorBody are never read
    (only `message` is used).

  Two more from around the same struct/pattern.

This mirrors the Resend adapter's existing warning for its own
ErrorBody (`name` and `status_code` never read). The fields exist
so serde deserializes the provider's error body cleanly. Harmless.
Founder's decision: leave it, do not fix. Same policy applies if a
future adapter adds the same warning.

---

## What works today (verified on cloud)

Connectors page (Client Dashboard):
  - Two sections. "GORKA built-in" and "Bring your own".
  - Resend Email: LIVE, Connect/Disconnect flips status. Works.
  - Twilio SMS, Twilio Voice, Mocean SMS, Gemini AI: COMING_SOON,
    disabled button. Unchanged.
  - Custom API (BYOP): LIVE. Add my credentials -> Zone 3
    declaration -> I understand & connect -> ConfigurationModal
    -> Save -> stores locally -> CONNECTED -> Disable ->
    DISCONNECTED. Works.

Zone 3 declaration (B4b, shipped 2026-10-07):
  - Accept writes one row to organization_audit_events per
    enablement, in the same transaction as the enable upsert.
  - Cancel writes nothing.

Sync engine (Phase 9.6, closed earlier):
  - All ten MVP acceptance criteria proven live.
  - Vectors 9/9.

Rust adapters, shared crate:
  - resend-email: registered, tested (live-verified against the
    Resend API earlier).
  - twilio-sms: registered, unit-tested. Not yet called from any
    UI surface.
  - mocean-sms: registered, unit-tested. HTTP shape NOT yet
    confirmed against Mocean's docs.

---

## Known open items

  - Client Dashboard Tailwind pipeline. Still not fixed.
    Inline styles are the workaround. Do not block on it.

  - backend RESEND_API_KEY. Reads process.env.RESEND_API_KEY.
    The .env file has VITE_RESEND_API_KEY. Server-side start
    needs the inline `set RESEND_API_KEY=...`.

  - The backend must start with the inline DATABASE_URL override
    (pooler, gorka_test). Direct Supabase hostname does not
    resolve from AWS Singapore.

  - npx prisma db push always needs
    --schema=prisma/schema.cloud.prisma plus the pooler override.

  - **V6 stale lines.** SYNC-TEST-VECTORS-v1.md near the top still
    says "V6 expected-bytes status is changed from FROZEN to
    PENDING" and the amendment note says recomputation is a
    separate task. In fact the recompute is done: the Rust test at
    shared/tests/sync.rs:339, verify/index.mjs:136, and the vector
    body already carry the post-A2 109-byte hex with 0x5006. Only
    the header note and the summary table contradict. Docs-only.
    Fix in the next docs pass. Founder decision 2026-10-07:
    defer.

  - **Mocean SMS HTTP shape.** Written from general knowledge, not
    yet confirmed against Mocean's current docs. Confirm before
    the first live send. If the shape is wrong, tests still pass
    (they use MockHttpClient); the failure surfaces at first live
    call. Same risk profile as the original Resend adapter.

  - CONNECTION-CENTER.md Section 14 A3 wording ("no existing
    table is changed") was superseded by the in-place correction
    of local_connectors. Cosmetic; correct in a docs pass.

---

## What was deferred from earlier Trips

  B7-static  Backend logging review. Docs-only. Not done.

  5a-vectors  Deterministic hex vectors for the three CONNECTOR
       events (CONNECTOR_ENABLED, CONNECTOR_DISABLED,
       CONNECTOR_CREDENTIAL_REPLACED). Test-only, no source
       change. Two-phase cloud build. Not done.

  Tier 1 declaration  The GORKA-managed path (resend-email) has
       no declaration gate yet. CONNECTION-CENTER.md Section 9
       defines both declarations; only Tier 2 is wired.

  Twilio Voice adapter. Different shape (call initiation, not
       message send). Its own slice.

  Gemini AI adapter. Completions, not messages. Different request
       and response shapes. Its own slice.

---

## Where we go next (candidate order)

  1. **Send-from-agent slice.** Wire an adapter to a UI button.
     The natural pick is Twilio SMS: agent opens a debtor
     profile, sees a "Send SMS" button (visible when the debtor
     has a phone and the connector is enabled), types a message,
     hits Send, adapter makes the provider call, result lands in
     the communications log. Then flip `twilio-sms` `mvpStatus`
     to LIVE in the seed. This is the slice that makes the
     adapter real. Its own cloud trip.

  2. **Session B: Tier 1 declaration gate for resend-email.**
     Mirrors B4b. Decide the audit `eventType` variant
     (TIER1_CONNECTION_ACKNOWLEDGED or reuse). Small.

  3. **V6 doc fix + Mocean HTTP confirm + A3 wording + B7-static.**
     Bundle every docs-only / verification-only item into one
     small docs pass. Fold into any session.

  4. **5a-vectors.** Two-phase cloud build. Standalone.

  5. **Connector event origination.** When a connector is
     enabled through the UI, originate a CONNECTOR_ENABLED event
     so the enablement reaches other devices. Touches the sync
     engine. Its own slice.

---

## Adaptors vs catalog rows

A catalog row makes a connector appear. An adaptor makes it
work. Three adaptors now exist: resend-email, twilio-sms,
mocean-sms. Two still missing: twilio-voice, gemini-ai.

Catalog has six rows. LIVE: resend-email, custom-api. COMING_SOON:
twilio-sms, twilio-voice, mocean-sms, gemini-ai. custom-api has no
adaptor at all; it is a placeholder row that gives the BYOP section
something to show.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot
  reliably compile.
- One machine owns a slice at a time. Git is the only handoff.
- Edits on main. Commit on main, push, pull on cloud, build and
  test and verify on cloud, pull back on main.
- Use content anchors for scripted edits. Never raw line
  indices. Never String.Replace on recovery documents.
- Sanity-check before write. Abort on failure. Verify with
  findstr after every edit.
- PowerShell here-strings: leave a blank line before the
  closing '@.
- npx prisma db push always needs --schema=prisma/schema.cloud.prisma
  plus the pooler DATABASE_URL override.
- Backend start needs the inline DATABASE_URL and RESEND_API_KEY.
- git diff <file> after every edit before moving on.
- Match tool weight to edit size.
- One commit per coherent change. Multi-commit slices are fine,
  all pushed before the single cloud trip.
- No guessing. Every fact confirmed on disk before the script
  is written.
- When in doubt, stop and ask the founder.
- When giving commands to the founder: give the open-file
  command first (notepad <path>), then the edit content, then
  the verify command. One file at a time. Do not batch.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.

At slice end: rewrite it with the new state. Rewritten in
place, not appended to.

If the chat dies unexpectedly: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md