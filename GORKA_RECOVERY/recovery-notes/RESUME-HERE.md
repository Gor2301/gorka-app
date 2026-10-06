# RESUME HERE

**Updated:** 2026-10-06 (Phase 0 closed: cloud build, tests, and node verify all green)
**Main machine:** dcfe858
**Cloud machine:** dcfe858
**GitHub:** dcfe858

---

## Where we are

Phase 0 is closed. All four CONNECTOR-MODEL.md Section 14 blockers
(A1-A4) were closed at the spec level in a previous slice. Phase 0
was the A2 follow-up, and it is now finished end to end: applied on
main, built on cloud, tested on cloud, verified on cloud, committed,
pushed, and pulled back to main.

Phase 0 threaded created_by from the login response all the way to
the COMMUNICATION_LOGGED wire format and back. 13 source files were
edited on main in three sub-scripts (0a, 0b, 0c), each sanity-checked
before write and verified with findstr after. Four build-blocking
defects were then found and fixed on the first real cloud build
(see below). Build, tests, and Node verify are now all green.

The relevant commits, in order:

  5bf435b  Phase 0 applied (13 files) plus accidental junk staging.
  562a7be  Remove 23 junk files committed by mistake in 5bf435b.
  65482ac  Update RESUME-HERE.md to reflect Phase 0 applied on main.
  dcfe858  Phase 0 build fixes: two doc-comment placements and
           two argument swaps. Found on the first cloud build.

---

## What Phase 0 delivered

Origination path:

  - login response carries UserData.id; auth_http.rs LoginResult
    gains user_id
  - both Tauri binaries persist user_id to settings.dat at login
    (src-tauri/src/auth.rs and src-tauri-agent/src/auth.rs each add
    get_user_id and store the id)
  - both binaries' insert_communication commands read user_id from
    AppState and pass it to the shared function
  - shared/src/communications.rs accepts created_by and writes it to
    the row and to the wire

Receiving path:

  - shared/src/sync_parse.rs reads 0x5006 and requires it
  - shared/src/sync_pipeline.rs binds &p.created_by instead of NULL

Tests and vectors:

  - shared/tests/sync.rs V6 updated to the 109-byte payload
  - shared/tests/sync_wire_roundtrip.rs round-trip updated
  - verify/index.mjs fixture and EXPECTED.V6 updated
  - SYNC-TEST-VECTORS-v1.md V6 entry, summary table, and encoded
    value updated (the header note at the top of that file is still
    stale; see loose ends)

New V6 TLV record appended after duration:

  5006            type code
  0000000f        TLV length = 15
  0000000b        inner string length = 11
  757365722d746573742d41   "user-test-A"

Field order per amended Section 25.11.3:
  debtor_id, communication_type, direction, content, duration, created_by

---

## What was fixed on cloud

Four compile errors, all found on the first real cloud build. None
had been visible on main because main cannot reliably compile.

  1. shared/src/sync.rs: a stray "/// created_by 0x5006 required"
     doc line had landed inside the parameter list of
     encode_communication_logged_payload. Rust rejects doc comments
     in that position. Fixed by moving the line above the pub fn.

  2. shared/src/sync_parse.rs: same defect on
     parse_communication_logged_payload. Same fix.

  3. src-tauri/src/main.rs: insert_communication was called with
     the last two arguments in the wrong order
     (&user_id, input) instead of (input, &user_id). Fixed.

  4. src-tauri-agent/src/main.rs: same call, same fix.

No wire-format change. The 109-byte V6 vector is correct as-is and
is what passed.

---

## Where we go next

Phase 1: gorka-shared::connectors skeleton.

A new module with a trait, types, and a registry. Compiles
standalone. Does not touch user identity or the communications path.
Does not depend on Phase 0's findings. The foundation the connector
work will stand on.

The connector-model planning documents are at
GORKA_RECOVERY/recovery-notes/CONNECTOR-MODEL.md. Sections 1-14 are
the map. Section 14 lists the four A-series blockers (all closed).

One planning note that carries forward: Phase 8 (the send command)
has to source created_by at origination the same way Phase 0 now
does for communications. The pattern is established - read user_id
from AppState, pass it into the shared function, write it to the row
and to the wire. Phase 8 repeats the pattern; it does not invent it.

---

## Known loose ends

- SYNC-TEST-VECTORS-v1.md header note is stale. It still describes
  V6 as PENDING. The V6 entry itself (line ~1009) and the summary
  table (line ~1120) correctly say FROZEN. Cosmetic. A proper fix
  is a small separate task.

- No JWT decode exists anywhere in the codebase. user_id comes from
  the login response (auth_http.rs UserData.id) and is persisted to
  settings.dat at login. Devices logged in before Phase 0 will not
  have user_id in their store until the next login. On a fresh clone
  or a fresh login, this is not an issue. The "no JWT decode"
  property is a design choice, not an accident.

- The /api/auth/login response contract is now load-bearing for the
  local store. If the backend ever changes the login response shape,
  the local user_id becomes empty and events become non-compliant
  at origination. There is no backend-side test guarding this.
  A future slice should add one, plus a local-side check that
  refuses to originate an event when user_id is empty.

- The logout blocks in both binaries do not delete the user_id key.
  Cosmetic. Add in a future cleanup if desired.

- Cloud has 8 untracked junk files left over from an earlier slice:
  b7-meta-check.cjs, build-6b2b-listener.txt, build-6b2b.txt,
  check-columns.ts, relay-check.cjs, test-6b2b-listener.txt,
  test-6b2b.txt, test-output.txt. Same category as the 23 cleaned
  in 562a7be. They do not block anything. A future cleanup commit
  should delete them.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot reliably
  compile (SAC blocks build-script binaries at unpredictable
  points).
- One machine owns a slice at a time. Git is the only handoff.
- For any scripted edit to a recovery document or source file:
  use content anchors (FindUnique returns exactly one match or
  throws). Never use raw line indices. Never use String.Replace
  on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
- Read UTF-8 files as UTF-8, never as ANSI. Emoji in source files
  will be silently corrupted otherwise. For single-line edits on
  files that contain non-ASCII characters, edit by hand in a text
  editor instead of scripting.
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