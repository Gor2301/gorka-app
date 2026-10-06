$ErrorActionPreference = 'Stop'
$path = 'C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\RESUME-HERE.md'
Copy-Item $path ($path + '.before-phase0-recon') -Force

$content = @'
# RESUME HERE

**Updated:** 2026-10-06 (Phase 0 reconnaissance complete, execution not started)
**Main machine:** 3b3c1dd
**Cloud machine:** 36dc292 (behind; needs git pull to 3b3c1dd)
**GitHub:** 3b3c1dd

---

## Where we are

Phase 9.6. All four CONNECTOR-MODEL.md Section 14 blockers (A1-A4)
are closed. Phase 0 is the V6 vector recomputation (the A2
follow-up).

Reconnaissance discovered Phase 0 is larger than initially
described. The production code does not source user_id at all, so
closing A2 means threading user_id from login through to the
encoder AND the parser AND the receiving pipeline. 13 files.

Reconnaissance is complete and recorded below. Phase 0 execution
has not started. No code has been changed.

---

## Current task

Write and run the Phase 0 script. 13 files, one cloud trip.

Decision: Option 1 (all 13 files in one slice). The founder chose
Option 1 over Option 2 (split into 0a/0b) specifically to avoid
leaving a temporary empty-string bridge in production code.

Decision: three sub-scripts (A, B, C) run on main before one
cloud trip, not one large 13-file script. If A fails, B and C do
not run. Failures isolate to a group of 7, 4, or 2 files.

---

## Next action

Write and run script A (Rust library, 7 files).
Then script B (Tauri binaries, 4 files).
Then script C (vectors and verifier, 2 files).
Then one cloud trip:
  git pull
  cargo build --workspace
  cargo test --workspace
  node verify/index.mjs
Commit if green. Push. Update RESUME-HERE. Session ends.

---

## The 13 files Phase 0 touches

Script A - Rust library (7 files):

1. shared/src/sync.rs
   Encoder at line 325. Takes 5 args today. Add `created_by: &str`.
   Write 0x5006 TLV after duration. Update doc comment at 317-324.

2. shared/src/sync_parse.rs
   Struct CommunicationLoggedPayload at line 172. Add
   `pub created_by: String`. Parser at line 360. Add 0x5006 read.
   Add required-field check. Update doc comment at 355-359.

3. shared/src/sync_pipeline.rs
   Line 565. Replace `Option::<String>::None` with `&p.created_by`.

4. shared/src/communications.rs
   Function insert_communication at line 70. Add `created_by: &str`
   param. Line 117 writes NULL today - replace with
   `Some(created_by)`. Line 131-137 pass to encoder. Line 159 return
   `created_by: Some(created_by.to_string())`.

5. shared/src/auth_http.rs
   LoginResult at line 46. Add `pub user_id: String`. Constructor at
   line 80-85. Add `user_id: login_data.user.id`.

6. shared/tests/sync.rs
   V6 test at line 329. Add `"user-test-A"` argument. Expected hex at
   line 339. Replace with new 109-byte hex. Comment at line 334
   "five fields" -> "six fields".

7. shared/tests/sync_wire_roundtrip.rs
   Round-trip test at line 129. Add `"user-test-A"` argument. Add
   assertion `p.created_by == "user-test-A"`.

Script B - Tauri binaries (4 files, mirrored pairs):

8. src-tauri/src/auth.rs
   login at 9-31. Add `store.set("user_id", ...)` after line 19.
   Add `get_user_id` function after `get_organization_id` at line 55.
   logout near line 119. Add `store.delete("user_id")`.

9. src-tauri-agent/src/auth.rs
   login at 21-41. Add `store.set("user_id", ...)` after line 29.
   Add `get_user_id` function after `get_organization_id` at line 65.
   logout at 100-111. Add `store.delete("user_id")`.

10. src-tauri/src/main.rs
    insert_communication command at line 458. Add `get_user_id(app)`
    read. Pass `&user_id` to shared::communications::insert_communication.

11. src-tauri-agent/src/main.rs
    Same as 10, at line 380.

Script C - Vectors and verifier (2 files):

12. verify/index.mjs
    Fixtures F at line 103. Add `user_id_A: 'user-test-A'`.
    EXPECTED.V6 at line 135. Replace with new hex.
    buildV6 at line 158. Add `tlvString(0x5006, F.user_id_A)`.

13. GORKA_RECOVERY/recovery-notes/SYNC-TEST-VECTORS-v1.md
    Header note at line 25-37. Update PENDING back to FROZEN.
    V6 entry at line 1001-1087, six sub-edits:
      status at 1009: PENDING -> FROZEN
      inputs at 1015-1039: add created_by line
      operation at 1043: "Five fields" -> "Six fields", add 0x5006
      expected hex at 1065: replace with new 109-byte hex
      structure at 1069-1079: add 0x5006 line
      byte count at 1081: 88 -> 109
    Summary table at 1117: PENDING -> FROZEN, "A2" -> "None".

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

The new V6 input field is created_by = "user-test-A" (the existing
fixture user_id_A in SYNC-TEST-VECTORS-v1.md section 2.2).

Field order per amended Section 25.11.3:
  debtor_id, communication_type, direction, content, duration, created_by

---

## Reconnaissance findings (all confirmed on disk)

Wire layer:
  encode_communication_logged_payload: shared/src/sync.rs:325, 5 args
  CommunicationLoggedPayload struct: shared/src/sync_parse.rs:172, 5 fields
  parse_communication_logged_payload: shared/src/sync_parse.rs:360, reads 0x5001-0x5005

Callers of the encoder (all four):
  shared/src/communications.rs:131   production origination
  shared/src/sync.rs:325             the definition
  shared/tests/sync.rs:330           V6 test
  shared/tests/sync_wire_roundtrip.rs:129  round-trip test

Callers of the parser (all four, all in sync_pipeline.rs):
  202  validate
  326  check entity exists
  359  queue pending
  542  apply

Where created_by is written today (both write NULL):
  shared/src/communications.rs:117   origination
  shared/src/sync_pipeline.rs:565    receiving

Where user_id lives today:
  shared/src/auth_http.rs:38         UserData.id (the stable user id)
  shared/src/auth_http.rs:46-51      LoginResult (does NOT carry it)
  src-tauri/src/auth.rs:16-19        writes 4 keys, no user_id
  src-tauri-agent/src/auth.rs:28-29  writes 2 keys, no user_id
  No JWT decode anywhere in the codebase

Tauri command signatures:
  src-tauri/src/main.rs:458          insert_communication
  src-tauri-agent/src/main.rs:380    insert_communication
  Both read only get_trusted_organization_id today.

Fixtures in the verifier (verify/index.mjs:103):
  No user_id fixture exists. Must be added.
  The vectors-file fixture is user_id_A = "user-test-A".

---

## Rules to remember

- Invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main cannot reliably compile.
- One machine owns a slice at a time. Git is the only handoff.
- Line-based PowerShell edits. Never String.Replace on these files;
  their doubled-newline pattern makes replace-based edits silent and
  unreliable.
- Sanity-check before write. Abort on failure. Backup before every
  edit. Verify with findstr after every edit.
- One commit per coherent change. One push per commit.
- No guessing. Every fact confirmed on disk before the script is
  written.
- When in doubt, stop and ask the founder.

---

## How to use this file

At the start of a new chat: paste this file. That is the brief.
Nothing else is needed.

At slice end: rewrite it with the new state.

If the chat dies unexpectedly: this file is stale by at most one
operation. Paste it. The assistant resumes from the last recorded
state.

---

End of RESUME-HERE.md
'@

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $enc)
Write-Host ("Updated: " + $path)
Write-Host ("Lines: " + ($content -split "`n").Count)
Write-Host 'Backup: RESUME-HERE.md.before-phase0-recon'