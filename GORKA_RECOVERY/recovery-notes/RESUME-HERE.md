# RESUME HERE

**Updated:** 2026-10-06 (Phase 0 applied on main; cloud test pending)
**Main machine:** 562a7be
**Cloud machine:** 36dc292 or later (needs git pull to reach 562a7be)
**GitHub:** 562a7be

---

## Where we are

Phase 9.6. All four CONNECTOR-MODEL.md Section 14 blockers (A1-A4)
are closed. Phase 0 (the A2 follow-up) is applied on main and
verified on disk. The only thing left in Phase 0 is the cloud
build and test run.

Phase 0 threaded created_by from login through to the wire format
and back. 13 source files were edited, in three sub-scripts (0a,
0b, 0c), each sanity-checked before writing, each verified with
findstr after. A junk-file cleanup followed the Phase 0 commit.

---

## Current task

Run the cloud build and test. If green, commit the result and
update this file. If red, paste the failure.

Do NOT re-run Phase 0a, Phase 0b, or Phase 0c. The source files
already contain the created_by edits. Re-running would fail every
anchor.

---

## Next action

On cloud, four commands in order:

  cd /d C:\gorka-app && git pull
  cd /d C:\gorka-app && cargo build --workspace
  cd /d C:\gorka-app && cargo test --workspace
  cd /d C:\gorka-app && node verify\index.mjs

Expected:
  - cargo test: all tests pass, including the updated V6
  - node verify: 9/9 PASS, with V6 now FROZEN and matching

If cargo test fails: paste the error. Do not commit.
If cargo test passes: no further edits needed on cloud.

---

## Phase 0 result on main (already done, do not redo)

Three commits relevant:

  5bf435b  Phase 0 applied (13 files) plus accidental junk-file
           staging. Superseded by the next commit.
  562a7be  Remove 23 junk files committed by mistake in 5bf435b.
           The 13 intended Phase 0 edits remain untouched.

The 13 files, now on disk with created_by threaded through:

  shared/src/sync.rs                 encoder signature + 0x5006 write
  shared/src/sync_parse.rs           parser struct + 0x5006 read
  shared/src/sync_pipeline.rs        bind &p.created_by instead of NULL
  shared/src/communications.rs       new param, write, pass to encoder
  shared/src/auth_http.rs            LoginResult gains user_id
  src-tauri/src/auth.rs              write user_id, add get_user_id
  src-tauri-agent/src/auth.rs        same (mirror)
  src-tauri/src/main.rs              read user_id, pass to shared
  src-tauri-agent/src/main.rs        same (mirror)
  shared/tests/sync.rs               V6 test: new arg, new expected hex
  shared/tests/sync_wire_roundtrip.rs  round-trip: new arg + assertion
  verify/index.mjs                   fixture + buildV6 + EXPECTED.V6
  SYNC-TEST-VECTORS-v1.md            V6 entry + summary + byte count

---

## The new V6 expected bytes

Size: 109 bytes (was 88).

Hex (single line):
5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c50050000000600000002303150060000000f0000000b757365722d746573742d41

New 21-byte TLV record appended after duration:
  5006            type code
  0000000f        TLV length = 15
  0000000b        inner string length = 11
  757365722d746573742d41   "user-test-A"

Field order per amended Section 25.11.3:
  debtor_id, communication_type, direction, content, duration, created_by

---

## Known loose ends

- The header note at the top of SYNC-TEST-VECTORS-v1.md was
  reverted to its pre-Phase-0 A2 state. It still describes V6 as
  PENDING. That is out of date after Phase 0, but harmless: the
  V6 entry itself (line ~1009) and the summary table (line ~1120)
  both correctly say FROZEN. Do not panic if the header says
  PENDING. It is a cosmetic artifact, and a proper fix is a
  separate small task.

- No JWT decode exists anywhere in the codebase. user_id comes
  from the login response (auth_http.rs UserData.id) and is
  persisted to settings.dat at login. Devices logged in before
  this change will not have user_id in their store; the next
  login will populate it. On a fresh clone or a fresh login,
  this is not an issue.

- The logout blocks in both binaries do not yet delete the
  user_id key. Cosmetic. Add in a future cleanup if desired.

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot reliably
  compile (SAC blocks build-script binaries at unpredictable
  points).
- One machine owns a slice at a time. Git is the only handoff.
- For any future scripted edit to a recovery document or source
  file: use content-anchor pattern (FindUnique returns exactly
  one match or throws). Never use raw line indices. Never use
  String.Replace on these files.
- Sanity-check before write. Abort on failure. Backup before
  every edit. Verify with findstr after every edit.
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