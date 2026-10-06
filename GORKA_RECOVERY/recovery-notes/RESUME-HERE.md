# RESUME HERE

**Updated:** 2026-10-06 (end of session)

**Main machine:** 4d36e8a
**Cloud machine:** 36dc292 (behind; needs git pull to 4d36e8a)
**GitHub:** 4d36e8a

---

## Where we are

Phase 9.6. CONNECTOR-MODEL.md frozen at v1.0. All four
Section 14 specification-level blockers (A1, A2, A3, A4) were
closed this session. The connector implementation slice is
unblocked at the specification level.

Next slice: V6 vector recomputation (the A2 follow-up).

---

## Current task

Between slices. Nothing in progress. The next slice has not
started.

---

## Next action

On cloud: git pull. Brings cloud to 4d36e8a. Then close the
session cleanly and start the V6 slice in the next session.

---

## Files the next slice touches

- GORKA_RECOVERY/recovery-notes/SYNC-TEST-VECTORS-v1.md
  (V6 section: replace PENDING with the recomputed expected bytes)
- verify/index.mjs
  (Node.js second-implementation: add created_by to V6 computation)
- shared/tests/sync.rs
  (Rust V6 encoder test: add created_by to the input and expected)

Possibly also:

- shared/src/sync.rs (the V6 encoder function, if signature changes)
- src-tauri/src/main.rs (thin adapter, if the encoder is called)

---

## What just happened (previous session)

Four commits, all pushed:

  836d9af  A2 applied (created_by in COMMUNICATION_LOGGED, v1.5)
  f96421e  A1 applied (three CONNECTOR event types, v1.6)
  2273396  A3 applied (local_connectors corrected, compliance_rules)
  7667648  A4 applied (Zone 3 audit record verified)
  4d36e8a  Documentation batch (HANDOFF, SESSION-LOG, START-HERE, DECISIONS)

Four frozen documents amended through their own processes:
SYNC-ARCHITECTURE.md (v1.5, v1.6), LOCAL-TABLES.md (v1.4),
CLOUD-TABLES.md (clarification note only), CONNECTOR-MODEL.md
(Section 14 A2 and A4 entries updated).

---

## Blocked

Nothing currently blocked at the specification level.

Open follow-up items (not blockers):

- CONNECTOR-MODEL.md Section 14 A3 still says "no existing table
  is changed". The actual A3 edit corrected local_connectors in
  place. The A3 wording is superseded by the founder decision and
  should be corrected in a future documentation pass.
- V6 test vector is PENDING. Recomputation is the next slice.

---

## Reference (do NOT re-read whole documents)

For the V6 slice:

- V6 current entry: SYNC-TEST-VECTORS-v1.md, Section 3, find "V6"
- V6 byte format: SYNC-ARCHITECTURE.md, Section 25.11.3 (TLV table)
- created_by field: SYNC-ARCHITECTURE.md, Section 25.13.9
- Rust test pattern: shared/tests/sync.rs, the E1 test
- Node verifier pattern: verify/index.mjs, the E1 function
- Node libraries in use: @noble/ciphers 2.4.0, hash-wasm 4.12.0

For the connector implementation slice (later):

- Full task list: CONNECTOR-MODEL.md Section 14 (B1-B7, C1-C7)
- Adapter trait shape: CONNECTOR-MODEL.md Section 7.2 through 7.4
- Send flow: CONNECTOR-MODEL.md Section 8
- Compliance layer: CONNECTOR-MODEL.md Section 10
- Local tables: LOCAL-TABLES.md, Categories B and F
- Event types: SYNC-ARCHITECTURE.md, Sections 25.14, 25.15, 25.16

---

## Rules to remember

- The invariant: no debtor data in GORKA cloud infrastructure.
- All Rust builds and tests run on cloud. Main can edit docs; main
  cannot reliably compile Rust (SAC blocks build-script binaries
  at unpredictable points).
- One machine owns a slice at a time. Git is the only handoff.
- Line-based PowerShell edits on this repository. Never use
  String.Replace on the recovery documents; their doubled-newline
  format makes replace-based edits silent and unreliable.
- Sanity-check before write. Abort on failure. Backup before every
  edit. Verify with findstr after every edit.
- One commit per coherent change. One push per commit.
- When in doubt, stop and ask the founder. Do not guess.

---

## How to use this file

When opening a new chat: paste this entire file. That is the
brief. Nothing else is needed for the assistant to resume work.

When a slice finishes: update this file with the new state. One
short script, one commit.

When a chat is unexpectedly closed: this file is stale by at most
one operation. Paste it. The assistant resumes from the last
recorded state.

---

End of RESUME-HERE.md

