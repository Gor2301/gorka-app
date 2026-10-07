# RESUME HERE

**Updated:** 2026-10-07 (Zone 3 declaration gate for BYOP + audit row.)
**Main machine:** 35ad007
**Cloud machine:** 35ad007 (last verified green)
**GitHub:** 35ad007

---

## Where we are

The Connection Center works end to end. The Connectors page
shows two sections (GORKA built-in, Bring your own). The BYOP
flow now goes through a Zone 3 declaration gate before the
credential form, and each accepted declaration writes one row
to organization_audit_events (cloud). Tier 1 Connect/Disconnect
still works, unchanged.

This session added B4b: the Zone 3 declaration for the BYOP
path.

Commits added this session, newest first:

  35ad007  Zone 3 declaration gate for BYOP enable + audit row
  df7bc1d  SESSION-HANDOFF.md: companion brief for next session
  8e1bc20  RESUME-HERE.md: B3 shipped, Connection Center verified
  4fa8eb8  ConfigurationModal: inline styles

---

## What works today (verified on cloud)

Connectors page:
  - Two sections. "GORKA built-in" and "Bring your own".
  - Resend Email: LIVE, Connect/Disconnect flips status. Works.
  - Twilio SMS, Twilio Voice, Mocean SMS, Gemini AI: COMING_SOON,
    disabled button.
  - Custom API (BYOP): LIVE. Add my credentials -> DeclarationModal
    -> I understand & connect -> ConfigurationModal -> Save ->
    stores locally -> CONNECTED -> Disable -> DISCONNECTED. Works.
    Cancel on the declaration writes nothing.

Zone 3 declaration (B4b):
  - Renders with header "Third-party connection", red warning
    block ("You are responsible for this third party."), purple
    commitment block ("GORKA's commitment"), Cancel and
    "I understand & connect".
  - Cancel writes no audit row (verified: count stayed at 1).
  - Accept writes exactly one row per enablement, with
    eventType='ZONE_3_CONNECTION_ACKNOWLEDGED', correct
    organizationId, actorId, actorName, and
    details={ connectorCode, tier: 'TIER2' } (verified: count 2,
    newest row fresh, timestamped).

Header title:
  - Reads "Connectors" when on /connectors, etc. Derived from route.

Auth:
  - API calls carry the JWT. No 401s on Connectors.

Styling:
  - Client Dashboard does not compile Tailwind utilities.
    Connectors.tsx, ConfigurationModal.tsx, and now
    DeclarationModal.tsx use inline styles. This is why they
    render correctly.

---

## What B4b built

  supervisor-dashboard/src/components/Connectors/DeclarationModal.tsx
    Full rewrite. Tailwind classNames removed in favour of inline
    styles, matching the rest of the Client Dashboard. Mojibake
    emojis dropped; uses lucide AlertTriangle and ShieldCheck
    icons. Button is primary purple #7C3AED. Wording follows
    CONNECTION-CENTER.md Section 9 Tier 2 declaration.

  supervisor-dashboard/src/services/connectors.service.ts
    enable() gains an optional { zone3Acknowledged?: boolean }.
    Body carries zone3Acknowledged: options?.zone3Acknowledged === true.

  supervisor-dashboard/src/pages/Connectors.tsx
    Added showDeclaration state. handleAddCredentials now opens
    the declaration, not the config. New handleDeclarationAccept
    opens the config. handleByopSave passes
    { zone3Acknowledged: true } to enable(). DeclarationModal
    mounted before ConfigurationModal.

  src/backend/routes/connectors.routes.ts
    enableSchema accepts optional zone3Acknowledged: boolean.
    The upsert is now wrapped in prisma.$transaction. When
    zone3Acknowledged === true, a row is written to
    organizationAuditEvent in the same transaction. Response
    shape unchanged.

---

## Fixes and observations this session

  - None. The slice implemented as planned. The audit query
    already had 1 row before the cancel test because an earlier
    accept had run during the initial click-through; the cancel
    test used that as the baseline.

---

## Known open items

  - Client Dashboard Tailwind pipeline. Still not fixed.
    Inline styles are the workaround. Do not block on it.

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

  - CONNECTION-CENTER.md Section 14 A3 wording: the phrase "no
    existing table is changed" was superseded by the in-place
    correction of local_connectors. Cosmetic; correct in a docs
    pass.

---

## What was deferred from earlier Trips

  B7-static  Backend logging review. Docs-only. Not done.

  5a-vectors  Deterministic hex vectors for the three CONNECTOR
       events. Test-only, no source change. Two-phase cloud
       build. Not done.

  V6 recompute  A2 added created_by to COMMUNICATION_LOGGED at
       TLV type 0x5006 and marked the V6 vector PENDING. The
       Rust and Node.js V6 implementations need recomputing and
       the vectors file updated. Small dedicated slice.

  Tier 1 declaration  The GORKA-managed path (resend-email) has
       no declaration gate yet. Separate slice. CONNECTION-CENTER.md
       Section 9 defines both declarations; only Tier 2 is wired.

---

## Where we go next (candidate order)

  1. First non-Resend adapter. Twilio SMS is the natural pick.
     Mirror shared/src/connectors/resend_email.rs. Register in
     the factory. Flip twilio-sms mvpStatus to LIVE in the seed.
     Its own slice, one cloud trip.

  2. V6 recompute (A2 follow-up). Update
     SYNC-TEST-VECTORS-v1.md, verify/index.mjs, and the Rust
     test. Small slice. Run before or alongside the connector
     implementation.

  3. Tier 1 declaration gate for resend-email. Small, mirrors
     B4b. Reuses the same audit eventType or a variant such as
     TIER1_CONNECTION_ACKNOWLEDGED. Decide the variant before
     writing.

  4. B7-static, 5a-vectors. Docs-only and test-only. Can be
     folded into any session.

  5. Connector event origination. When a connector is enabled
     through the UI, originate a CONNECTOR_ENABLED event so the
     enablement reaches other devices. Touches the sync engine.
     Its own slice.

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
  closing '@, or the next line merges with the last.
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