# RESUME HERE

**Updated:** 2026-10-07 (B3 shipped: BYOP flow works end to end. Connection Center spec added.)
**Main machine:** 4fa8eb8
**Cloud machine:** 4fa8eb8 (last verified green)
**GitHub:** 4fa8eb8

---

## Where we are

The Connection Center works. The Connectors page shows two
sections (GORKA built-in, Bring your own), the demo flow is
verified end to end: BYOP credential entry stores locally and
flips the row to CONNECTED; Tier 1 Connect/Disconnect works.

The session covered more than planned: a Connection Center
spec, B3 (local credential write plus the BYOP flow), and four
bug fixes discovered while demo-testing on cloud.

Commits added this session, newest first:

  4fa8eb8  ConfigurationModal: inline styles
  98a3aa6  Connectors page: inline styles
  b0fc230  Fix: Tailwind content paths + strip Vite template CSS
  937508a  Fix: route api token through Tauri; derive page title
  d8c8509  Fix: remove duplicate pub mod resend_email
  9eb3c79  B3: local credential write + BYOP flow + two-section page
  6ded653  CONNECTION-CENTER.md: model spec (v0.1 draft)
  db31e84  RESUME-HERE.md: mvpStatus shipped, Trip A partial
  5d1a63c  Connector catalog: add mvpStatus flag
  d13ca82  RESUME-HERE.md: Phase 5 closed
  68e775e  Phase 5b: align Connectors.tsx (B1, B2)
  62d332f  Phase 5a: CONNECTOR event wire encoders and decoders

---

## What works today (verified on cloud)

Connectors page:
  - Two sections. "GORKA built-in" and "Bring your own".
  - Six catalog rows visible.
  - Resend Email: LIVE, Connect/Disconnect flips status. Works.
  - Twilio SMS, Twilio Voice, Mocean SMS, Gemini AI: COMING_SOON,
    disabled button.
  - Custom API (BYOP): LIVE, Add my credentials -> modal -> submit
    -> stores locally -> CONNECTED -> Disable -> DISCONNECTED.
    Works.

Header title:
  - Reads "Connectors" when on /connectors, etc. Derived from route.

Auth:
  - API calls carry the JWT. Fixed this session. No 401s on
    Connectors or any other page.

Styling:
  - Client Dashboard does not compile Tailwind utilities.
    Connectors.tsx and ConfigurationModal.tsx now use inline
    styles, matching AppShell.tsx. This is why they render
    correctly. The rest of the app was already inline-styled.

---

## What B3 built

  shared/src/connectors/local_record.rs
    New file. LocalConnectorInput struct and
    upsert_local_connector(conn, org_id, source_device_id, input).
    Writes or updates one row in local_connectors.

  shared/src/connectors/mod.rs
    Adds pub mod local_record;

  src-tauri/src/main.rs
    New Tauri command write_local_connector_credential. Takes
    connector_code, tier, configuration, credential_bytes.
    Reads organization_id from trusted context. Calls the shared
    function. Registered in generate_handler!.

  supervisor-dashboard/src/pages/Connectors.tsx
    Full rewrite. Two sections. Inline styles.

  supervisor-dashboard/src/components/Connectors/ConfigurationModal.tsx
    Full rewrite. Inline styles. Removed the VITE_* reads
    (already done in 5b) and the unused field-set machinery.
    Renders one "API Key" field for BYOP connectors.

  prisma/seed-connectors.ts
    Added a sixth row: custom-api, category DATA, LIVE,
    isManagedByGorka false. This gives the BYOP section
    something to show.

---

## Fixes discovered on cloud this session

  - api.service.ts read the JWT from localStorage, but the token
    lives in Rust settings.dat. Every authenticated call returned
    401. Fixed: uses invoke('get_auth_token').
  - AppShell.tsx hardcoded "Dashboard" as the header title.
    Fixed: derives from useLocation().
  - tailwind.config.js content array did not include
    supervisor-dashboard/src. Tailwind utilities never generated.
    Fixed (partially) but the Client Dashboard still does not
    compile Tailwind, so Connectors.tsx and ConfigurationModal.tsx
    use inline styles instead of classNames.
  - mod.rs had a duplicate `pub mod resend_email;` after a scripted
    insert. Fixed.

---

## Known open items

  - Client Dashboard Tailwind pipeline. tailwind.config.js now
    includes the path, but utilities still do not compile. Do not
    block on it. Connectors and ConfigurationModal use inline
    styles. Other pages work as they were.

  - backend RESEND_API_KEY. The backend reads
    process.env.RESEND_API_KEY. The .env file has
    VITE_RESEND_API_KEY. Server-side start needs an inline
    `set RESEND_API_KEY=...` before `npx tsx src/backend/index.ts`.

  - The backend must be started with the inline DATABASE_URL
    override (pooler, gorka_test). The direct Supabase hostname
    does not resolve from AWS Singapore.

  - npx prisma db push defaults to prisma/schema.prisma, which is
    stale. Always use --schema=prisma/schema.cloud.prisma plus the
    pooler DATABASE_URL override.

---

## What was deferred from earlier Trips

  B4b  Zone 3 declaration. No trigger exists in the current
       catalog (no external_api row, no live code path opens
       DeclarationModal). Reopens when the Connection Center
       gains a generic-API row, which it now has: custom-api.
       So B4b is now buildable. Consider: wire the Zone 3
       declaration to the custom-api BYOP path.

  B7-static  Backend logging review. Docs-only. Not done.

  5a-vectors  Deterministic hex vectors for the three CONNECTOR
       events. Test-only, no source change. Two-phase cloud
       build. Not done.

  5a spec reconciliation  CONNECTOR-MODEL.md Section 14 A3 said
       "no existing table is changed" but A3 actually corrected
       local_connectors in place. Cosmetic; the A3 entry should
       be corrected in a docs pass.

---

## Where we go next (candidate order)

  1. Zone 3 declaration for the custom-api BYOP path. This is
     now the natural next slice: the custom-api row exists, the
     BYOP modal opens, and the missing piece is the declaration
     shown before the modal and the acknowledgment written to
     organization_audit_events. Small commit, one route or one
     parameter on /connectors/enable, one modal reuse, one call.

  2. First non-Resend adapter. Twilio SMS is the natural pick.
     Its own slice. Then flip twilio-sms mvpStatus to LIVE in
     the seed.

  3. B7-static, 5a-vectors. Docs-only and test-only. Can be
     folded into any session.

  4. Connector event origination. When a connector is enabled
     through the UI, originate a CONNECTOR_ENABLED event so the
     enablement reaches other devices. This needs the B3 write
     path to also write to sync_events. Its own slice; needs
     care because it touches the sync engine.

---

## Adaptors vs catalog rows

A catalog row makes a connector appear. An adaptor makes it
work. Resend has an adaptor. Twilio SMS, Twilio Voice, Mocean
SMS, Gemini AI, Custom API do not. Adding a row is a data edit.
Adding an adaptor is a code slice.

The current catalog has six rows. Only resend-email and
custom-api are LIVE. Custom API has no adaptor at all; it is a
placeholder row that gives the BYOP section something to show.

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
  closing '@, or the next line merges with the last. This bit
  us once in 5a.
- npx prisma db push always needs --schema=prisma/schema.cloud.prisma
  plus the pooler DATABASE_URL override.
- Backend start needs the inline DATABASE_URL and RESEND_API_KEY.
- git diff <file> after every edit before moving on.
- Match tool weight to edit size.
- One commit per coherent change.
- No guessing. Every fact confirmed on disk before the script
  is written.
- When in doubt, stop and ask the founder.

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