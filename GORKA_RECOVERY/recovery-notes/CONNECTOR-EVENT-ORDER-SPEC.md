CONNECTOR-EVENT-ORDER SPEC

Version 1.0 — FROZEN

Date frozen: 2026-10-11

Supersedes: all prior drafts (v1–v11)

Status: APPROVED FOR IMPLEMENTATION. Three STOP-gated commits. No further spec revisions unless implementation reveals a defect.



Reviewer verdict: GO. Category 3 clarification applied (see §7.3). Scope narrow, no further speculative requirements.



1\. Summary

The sync engine is multi-originator by design. The codebase already implements a deterministic tie-break (entity\_field\_state + protocol\_order\_less). CONNECTOR events were deliberately excluded (sync\_pipeline.rs:677). That exclusion is the defect.



This spec brings CONNECTOR\_ENABLED and CONNECTOR\_DISABLED into the existing tie-break pattern, using the existing tuple, the existing comparator, and the existing migration mechanism. CONNECTOR\_CREDENTIAL\_REPLACED remains deferred.



F15 (Client disable does not propagate to Agent) and conformance (§12.9) are the same defect: fixing disconnect propagation requires applying CONNECTOR\_DISABLED, which requires conformance.



Deliverables:



Migration v10 on the local SQLCipher database: three new ordering columns, backfill from durable event history, two fail-closed checks.



Order-aware apply path for ENABLED and DISABLED. Tombstone representation for DISABLED-before-ENABLED.



Atomic Client origination of CONNECTOR\_DISABLED on disconnect.



gorka-recover — a first-party recovery utility for the case where migration v10 fails.



Tests MT1–MT12 and T1–T24.



2\. Current state — verified from source

Working tree at main HEAD 17effa1. Line numbers cited.



2.1 local\_connectors (db.rs:645)

sql

CREATE TABLE IF NOT EXISTS local\_connectors (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   connector\_code TEXT NOT NULL,

&#x20;   organization\_id TEXT NOT NULL,

&#x20;   tier TEXT NOT NULL,

&#x20;   status TEXT NOT NULL,

&#x20;   credential\_value BLOB NOT NULL,

&#x20;   configuration TEXT NOT NULL,

&#x20;   source\_device\_id TEXT NOT NULL,

&#x20;   created\_at DATETIME NOT NULL,

&#x20;   updated\_at DATETIME NOT NULL

);

UNIQUE INDEX idx\_local\_connectors\_org\_code (organization\_id, connector\_code);

No ordering columns. Every column NOT NULL.



2.2 sync\_events (db.rs:482)

sql

CREATE TABLE IF NOT EXISTS sync\_events (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   organization\_id TEXT NOT NULL,

&#x20;   device\_id BLOB NOT NULL,

&#x20;   event\_type TEXT NOT NULL,

&#x20;   entity\_type TEXT NOT NULL,

&#x20;   entity\_id TEXT,

&#x20;   payload BLOB NOT NULL,

&#x20;   sequence INTEGER NOT NULL,

&#x20;   logical\_clock INTEGER NOT NULL,

&#x20;   created\_at DATETIME NOT NULL,

&#x20;   local\_received\_at DATETIME NOT NULL,

&#x20;   UNIQUE (device\_id, sequence)

);

event\_type is TEXT via event\_type\_string(event.event\_type).



entity\_type is TEXT via entity\_type\_string = "connector" (sync\_pipeline.rs:998).



entity\_id is TEXT; for CONNECTOR events holds connector\_code.



payload is BLOB; the durable source for reconstruction (see §8).



created\_at is RFC 3339 TEXT, same format as local\_connectors.created\_at.



No pruning. No DELETE FROM sync\_events in the codebase.



2.3 protocol\_order\_less (sync\_pipeline.rs:948)

rust

fn protocol\_order\_less(

&#x20;   a\_clock: i64, a\_dev: \&\[u8], a\_seq: i64,

&#x20;   b\_clock: i64, b\_dev: \&\[u8], b\_seq: i64,

) -> bool {

&#x20;   if a\_clock != b\_clock { return a\_clock < b\_clock; }

&#x20;   match a\_dev.cmp(b\_dev) {

&#x20;       std::cmp::Ordering::Less => true,

&#x20;       std::cmp::Ordering::Greater => false,

&#x20;       std::cmp::Ordering::Equal => a\_seq < b\_seq,

&#x20;   }

}

Returns true iff a is protocol-earlier than b. Total order on (clock, device\_id bytes, sequence). Byte comparison, not text.



2.4 Existing tie-break pattern (reconcile\_field, sync\_pipeline.rs:\~793)

Reads (winning\_event\_id, winning\_logical\_clock, winning\_device\_id, winning\_sequence) from entity\_field\_state. winning\_device\_id is BLOB. Uses protocol\_order\_less. CONNECTOR was excluded.



2.5 Every write path to local\_connectors

Verified by source search across shared/src/, src-tauri/src/, src-tauri-agent/src/. Two paths:



upsert\_local\_connector\_with\_event (local\_record.rs:47–73) — Client-side BYOP write. Transactional, writes row and originates event.



apply\_connector\_enabled (sync\_pipeline.rs:701–726) — Agent-side receive. Invoked inside process\_event, which writes append\_event\_to\_log (line 153) and calls apply\_event in the same transaction, then commits.



No third path. local\_connectors was introduced in Slice C. Source references retained in the working evidence log.



Residual risk: dynamically-built SQL strings could exist without a literal local\_connectors reference. Noted.



2.6 CONNECTOR events excluded from tie-break (sync\_pipeline.rs:677)

/// No entity\_field\_state rows are written for CONNECTOR events



2.7 DISABLED deferred pre-dispatch (sync\_pipeline.rs:\~135)

rust

if matches!(

&#x20;   event.event\_type,

&#x20;   EVT\_CONNECTOR\_DISABLED | EVT\_CONNECTOR\_CREDENTIAL\_REPLACED

) {

&#x20;   return Ok(AckOutcome::Rejected);

}

Fires before clock advance, event log append, prerequisite check, and dispatch. Nothing is written.



2.8 Dispatch table (sync\_pipeline.rs:445)

No DISABLED or REPLACED arm.



2.9 Send-side ordering (sync\_engine.rs compute\_undelivered)

Per-origin ascending within origin (ORDER BY sequence ASC). Single-originator = sequence-ordered. Multi-originator = non-deterministic interleave.



2.10 Ack bookkeeping (sync\_engine.rs add\_delivered\_sequence)

Watermark + gap\_set. Cumulative ack. Does not cause out-of-order sends.



2.11 Duplicate filter

UNIQUE (device\_id, sequence).



2.12 Migration mechanism (db.rs:169)

Version-gated via PRAGMA user\_version. Nine versions. Each block: open transaction, DDL, bump, commit. Transactional. Idempotent.



2.13 Wire format (frozen)

CONNECTOR\_ENABLED: 0x6001 code, 0x6002 tier, 0x6003 credential, 0x6004 config, 0x6005 enabled\_at.



CONNECTOR\_DISABLED: 0x6001 code, 0x6006 disabled\_at.



CONNECTOR\_CREDENTIAL\_REPLACED: 0x6001 code, 0x6003 credential, 0x6004 config, 0x6007 replaced\_at.



Event type 0x0005. Entity type 0x06. Unchanged by this spec.



2.14 Decoders (existing)

parse\_connector\_enabled\_payload (sync\_parse.rs)



parse\_connector\_disabled\_payload (sync\_parse.rs)



parse\_connector\_credential\_replaced\_payload (sync\_parse.rs, deferred use)



3\. Gate 1 — verified ordering guarantee

Single originator: the apply path receives events in strictly ascending sequence order (§2.9–§2.11).



Multiple originators: ordering is not guaranteed. Two origins can share sequence numbers; cross-origin interleaving is non-deterministic. The tie-break is required.



§25.14.6's assumption ("single originator rules out the case") holds only for the current Client-only origination. That is a UI accident, not an architecture constraint. The engine is multi-originator capable; the Agent already originates a different event family.



4\. Gate 2 — tombstone state

4.1 The problem

DISABLED can arrive before ENABLED in multi-originator deployment. If apply\_connector\_disabled requires an existing row, the disable is lost. A later ENABLED inserts the row and the connector appears enabled.



4.2 Tombstone representation

Do not relax NOT NULL constraints. Populate a tombstone:



Column	Value

id	new UUID v4

connector\_code	from DISABLED event's entity\_id

organization\_id	from incoming event

tier	''

status	'DISABLED'

credential\_value	X'' (empty blob)

configuration	''

source\_device\_id	lowercase hex of DISABLED event's device\_id

created\_at	from DISABLED event's created\_at

updated\_at	same

winning\_logical\_clock	DISABLED event's logical\_clock

winning\_device\_id	DISABLED event's device\_id bytes

winning\_sequence	DISABLED event's sequence

4.3 Invariants enforced in code (every write path)

Any status='DISABLED' row has credential\_value=X'', configuration='', tier=''. Test-enforced.



A winning ENABLED against a DISABLED row replaces the tombstone: status='ENABLED', credential/config/tier populated from event payload, winning tuple updated.



A stale ENABLED against a DISABLED row: no-op.



A winning DISABLED against an ENABLED row: status='DISABLED', credential/config/tier wiped, winning tuple updated.



A stale DISABLED against an ENABLED row: no-op.



Disable applied twice: idempotent.



Every credential-use path independently gates on status. read\_local\_connector\_credential returns None when status != 'ENABLED', regardless of the row's actual credential bytes.



4.4 Reviewer's scenario

E1 = ENABLED(100, A, 10). E2 = DISABLED(105, A, 11).



Agent receives E2 first. Row absent. Tombstone inserted with winning=(105, A, 11), status=DISABLED.



Agent receives E1 second. protocol\_order\_less(105, A, 11, 100, A, 10) = false. E1 loses. No-op.



Final state: DISABLED. ✓



4.5 Read-model acceptance criteria

Disabled row remains in the database as an ordering tombstone.



The Agent's Communication Tools page does not display it as an available connector. list\_local\_connectors excludes status='DISABLED' (or UI filters; exclusion tested).



No send path or test-connection path uses a cleared credential from a disabled row. read\_local\_connector\_credential gates on status='ENABLED'.



A later winning ENABLED restores a complete, active row.



5\. Gate 3 — migration semantics

5.1 The reviewer's scenario

Row established by E1 (100, A, 10). If winning metadata defaults to a low value, a stale E0 (99, A, 9) arriving later could win. Migration must prevent this.



5.2 Migration strategy: backfill + existence check + status provenance check

Three steps, all fail-closed, inside one transaction.



Step 1 — backfill. For rows with at least one matching event, update the three new columns from the latest matching event's tuple.



Guard: the UPDATE has a WHERE EXISTS clause. Rows without a matching event are not updated. Their columns retain the ALTER TABLE default. This prevents a NOT NULL constraint violation during the UPDATE and lets Check 1 diagnose explicitly.



Step 2 — existence check. Count rows still lacking a matching event. Fail if any.



Step 3 — status provenance check. Every row's status must match the type of its latest matching event. Fail on any mismatch.



Matching rule. A "matching latest event" for a row is the CONNECTOR\_ENABLED or CONNECTOR\_DISABLED event for (row.organization\_id, row.connector\_code) that is protocol-latest per protocol\_order\_less on (logical\_clock, device\_id, sequence).



Status provenance verifies status and only status. It does not verify tier, credential\_value, or configuration. This limitation is deliberate and documented; MT8 makes it explicit.



Migration is version-gated (if current\_version < 10), transactional, idempotent.



rust

if current\_version < 10 {

&#x20;   let tx = conn.transaction()?;



&#x20;   tx.execute("ALTER TABLE local\_connectors ADD COLUMN winning\_logical\_clock INTEGER NOT NULL DEFAULT -1", \[])?;

&#x20;   tx.execute("ALTER TABLE local\_connectors ADD COLUMN winning\_device\_id BLOB NOT NULL DEFAULT X''", \[])?;

&#x20;   tx.execute("ALTER TABLE local\_connectors ADD COLUMN winning\_sequence INTEGER NOT NULL DEFAULT -1", \[])?;



&#x20;   // Step 1 — backfill only rows with matching events.

&#x20;   tx.execute(

&#x20;       "UPDATE local\_connectors

&#x20;        SET winning\_logical\_clock = (

&#x20;                SELECT se.logical\_clock FROM sync\_events se

&#x20;                WHERE se.organization\_id = local\_connectors.organization\_id

&#x20;                  AND se.entity\_type = 'connector'

&#x20;                  AND se.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;                  AND se.entity\_id = local\_connectors.connector\_code

&#x20;                ORDER BY se.logical\_clock DESC, se.device\_id DESC, se.sequence DESC

&#x20;                LIMIT 1),

&#x20;            winning\_device\_id = (

&#x20;                SELECT se.device\_id FROM sync\_events se

&#x20;                WHERE se.organization\_id = local\_connectors.organization\_id

&#x20;                  AND se.entity\_type = 'connector'

&#x20;                  AND se.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;                  AND se.entity\_id = local\_connectors.connector\_code

&#x20;                ORDER BY se.logical\_clock DESC, se.device\_id DESC, se.sequence DESC

&#x20;                LIMIT 1),

&#x20;            winning\_sequence = (

&#x20;                SELECT se.sequence FROM sync\_events se

&#x20;                WHERE se.organization\_id = local\_connectors.organization\_id

&#x20;                  AND se.entity\_type = 'connector'

&#x20;                  AND se.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;                  AND se.entity\_id = local\_connectors.connector\_code

&#x20;                ORDER BY se.logical\_clock DESC, se.device\_id DESC, se.sequence DESC

&#x20;                LIMIT 1)

&#x20;        WHERE EXISTS (

&#x20;            SELECT 1 FROM sync\_events se2

&#x20;            WHERE se2.organization\_id = local\_connectors.organization\_id

&#x20;              AND se2.entity\_type = 'connector'

&#x20;              AND se2.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;              AND se2.entity\_id = local\_connectors.connector\_code)",

&#x20;       \[],

&#x20;   )?;



&#x20;   // Step 2 — existence check.

&#x20;   let unmatched: i64 = tx.query\_row(

&#x20;       "SELECT COUNT(\*) FROM local\_connectors lc

&#x20;        WHERE NOT EXISTS (

&#x20;            SELECT 1 FROM sync\_events se

&#x20;            WHERE se.organization\_id = lc.organization\_id

&#x20;              AND se.entity\_type = 'connector'

&#x20;              AND se.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;              AND se.entity\_id = lc.connector\_code)",

&#x20;       \[], |row| row.get(0),

&#x20;   )?;

&#x20;   if unmatched > 0 {

&#x20;       return Err(format!(

&#x20;           "migration 10 failed: {} local\_connectors rows have no matching event. \\

&#x20;            Rollback. See CONNECTOR-EVENT-ORDER-SPEC §5.5.",

&#x20;           unmatched

&#x20;       ));

&#x20;   }



&#x20;   // Step 3 — status provenance check.

&#x20;   let mismatched: i64 = tx.query\_row(

&#x20;       "SELECT COUNT(\*) FROM local\_connectors lc

&#x20;        WHERE lc.status != (

&#x20;            SELECT CASE se.event\_type

&#x20;                WHEN 'CONNECTOR\_ENABLED' THEN 'ENABLED'

&#x20;                WHEN 'CONNECTOR\_DISABLED' THEN 'DISABLED'

&#x20;                ELSE 'UNKNOWN' END

&#x20;            FROM sync\_events se

&#x20;            WHERE se.organization\_id = lc.organization\_id

&#x20;              AND se.entity\_type = 'connector'

&#x20;              AND se.event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20;              AND se.entity\_id = lc.connector\_code

&#x20;            ORDER BY se.logical\_clock DESC, se.device\_id DESC, se.sequence DESC

&#x20;            LIMIT 1)",

&#x20;       \[], |row| row.get(0),

&#x20;   )?;

&#x20;   if mismatched > 0 {

&#x20;       return Err(format!(

&#x20;           "migration 10 failed: {} local\_connectors rows have status inconsistent with their \\

&#x20;            latest matching event. Rollback. See §5.5.",

&#x20;           mismatched

&#x20;       ));

&#x20;   }



&#x20;   tx.execute("PRAGMA user\_version = 10", \[])?;

&#x20;   tx.commit()?;

}

5.3 Why this is safe

Backfill ordering mirrors protocol\_order\_less. First row is protocol-latest.



entity\_type = 'connector' matches encoder output.



All three steps run before version bump, inside the transaction. return Err propagates without commit; transaction dropped; SQLite rolls back.



No sentinel semantics. No silent success.



SQLite BLOB ordering matches Rust \&\[u8] — MT6 verifies.



5.4 Rollback behaviour

When migration returns Err:



tx goes out of scope without tx.commit().



rusqlite::Transaction Drop issues ROLLBACK.



All DDL and DML inside the block is undone.



PRAGMA user\_version remains at 9.



local\_connectors schema is unchanged (three columns absent).



local\_connectors and sync\_events rows are unchanged.



MT3 and MT7 verify all six points. The test harness must not itself commit or modify the DB in ways that mask migration behaviour.



5.5 Recovery procedure

Preserve the database first. Copy the SQLCipher file to a safe location. It is evidence. Do not modify the original until the copy exists.



Never delete data to force migration success.



sync\_events is read-only evidence. No recovery path modifies it.



Path 1 — Inspect sync\_events. If an event exists but the query missed it, fix the query and re-run.



Path 2 — Repair local\_connectors via gorka-recover. See §8.



Path 3 — Recreate the row cleanly (last resort). Only with preserved database copy and documented approval:



Delete the local\_connectors row.



Disconnect and reconnect the connector on the Client, generating a fresh CONNECTOR\_ENABLED.



New row gets a real winning tuple.



Not routine. Removes evidence. Use only after Paths 1 and 2 are ruled out. The unique index on (organization\_id, connector\_code) may cause a reconnect to update or conflict with the existing row; Path 3 requires prior deletion.



Reconnect alone does not repair an unmatched row.



5.5.1 Recovery when startup is blocked

If migration v10 fails, run\_migrations returns Err, which propagates through init\_db and prevents the local DB from opening. The application cannot start. No UI is available.



A SQLCipher-capable command-line tool is required. Ordinary sqlite3 cannot open a SQLCipher database without SQLCipher support compiled in.



Supported options:



sqlcipher — the reference SQLCipher CLI.



sqlite3 built with SQLCipher (verify with PRAGMA cipher\_version;).



Key handling. See §9.



Inspection queries must not print credentials.



text

sqlcipher C:\\path\\to\\gorka-agent.db

sqlite> PRAGMA key = '...';

sqlite> PRAGMA cipher\_version;

sqlite> SELECT user\_version FROM pragma\_user\_version;

sqlite> SELECT id, connector\_code, organization\_id, tier, status,

&#x20;               source\_device\_id, created\_at, updated\_at,

&#x20;               winning\_logical\_clock, winning\_device\_id, winning\_sequence

&#x20;        FROM local\_connectors;

sqlite> SELECT id, organization\_id, device\_id, event\_type, entity\_type,

&#x20;               entity\_id, logical\_clock, sequence, created\_at

&#x20;        FROM sync\_events

&#x20;        WHERE entity\_type = 'connector';

Rule: credential\_value and configuration are never selected by an interactive query. SELECT \* is forbidden on local\_connectors. The recovery utility reads them internally and never displays them.



5.6 Migration tests (local SQLCipher DB)

\#	Scenario	Expected

MT1	Fresh local DB	user\_version = 10

MT2	Existing v9, all rows matched and status-consistent	Migration succeeds, v10, winning\_\* matches protocol-latest event per row

MT3	Existing v9, one unmatched row	Migration fails at Check 1 (not at UPDATE), rolls back. v9. Three new columns absent. local\_connectors rows unchanged. sync\_events unchanged.

MT4	MT2 rerun	Idempotent; v10, winning\_\* unchanged

MT5	Equal clock, different devices	Winner matches byte-level comparator

MT6	Two device\_id BLOBs differing in first byte; equal clock and sequence	Direct assertion: SQLite ORDER BY device\_id DESC LIMIT 1 and Rust \&\[u8]::cmp select the same BLOB. Both stored as BLOBs (typeof(device\_id) = 'blob'). Same byte arrays, same direction.

MT7	Existing v9, row status inconsistent with latest event	Migration fails at Check 2, rolls back, v9, no data modified

MT8	Existing v9, status consistent but tier/configuration disagree with latest event payload	Migration succeeds — status provenance check does not inspect these fields. Documents the scope of the guarantee.

MT9	Inconsistent row in a v10 DB; gorka-recover repair --apply	Row becomes consistent and matches what a normal apply would have produced. Sentinel credential and config values never appear in stdout or stderr across inspect, repair --dry-run, and repair --apply.

MT10	Key-entry procedure (§9) executed against a test DB	PSReadLine history file does not contain the key. No SQLCipher CLI process ran with the key in argv. No sentinel appeared in output. $plain variable cleared. Does not assert memory erasure.

MT11	Malformed payload; gorka-recover repair --apply	Exits failure with sanitized error. Before/after snapshot: user\_version unchanged, local\_connectors row count unchanged, every row byte-identical (including credential and config, compared in Rust), sync\_events byte-identical. No sentinel in stdout/stderr. DB still openable and queryable.

MT12	Three matching events where SQL ordering and Rust ordering could diverge	Utility selects the event that protocol\_order\_less selects as latest. Query does not silently impose SQL ordering first.

6\. Apply-path rule (ENABLED and DISABLED only)

text

fn apply\_connector\_enabled(tx, org, event):

&#x20;   parse payload (tier, credential\_value, configuration, enabled\_at)

&#x20;   existing = SELECT \* FROM local\_connectors WHERE org AND code



&#x20;   incoming\_wins = match existing {

&#x20;       None => true,

&#x20;       Some(row) => protocol\_order\_less(

&#x20;           row.winning\_logical\_clock, row.winning\_device\_id, row.winning\_sequence,

&#x20;           event.logical\_clock, event.device\_id, event.sequence,

&#x20;       )

&#x20;   }



&#x20;   if !incoming\_wins: return



&#x20;   if existing is None:

&#x20;       INSERT row from payload, status='ENABLED', winning tuple from event

&#x20;   else:

&#x20;       UPDATE row, status='ENABLED', tier, credential\_value, configuration,

&#x20;                    source\_device\_id = hex(event.device\_id),

&#x20;                    updated\_at = event.created\_at,

&#x20;                    winning\_logical\_clock, winning\_device\_id, winning\_sequence

&#x20;       WHERE id = existing.id

text

fn apply\_connector\_disabled(tx, org, event):

&#x20;   parse payload (connector\_code, disabled\_at)

&#x20;   existing = SELECT \* FROM local\_connectors WHERE org AND code



&#x20;   incoming\_wins = ... (same logic as above)



&#x20;   if !incoming\_wins: return



&#x20;   if existing is None:

&#x20;       INSERT tombstone per §4.2

&#x20;   else:

&#x20;       UPDATE row, status='DISABLED', tier='', credential\_value=X'',

&#x20;                    configuration='',

&#x20;                    source\_device\_id = hex(event.device\_id),

&#x20;                    updated\_at = event.created\_at,

&#x20;                    winning\_logical\_clock, winning\_device\_id, winning\_sequence

&#x20;       WHERE id = existing.id

All reads and writes occur inside the outer apply transaction. No new transaction. No write before the comparison passes.



7\. Dispatch and deferral changes

7.1 Remove DISABLED from pre-dispatch guard

rust

// AFTER (DISABLED arm removed, REPLACED preserved)

if matches!(event.event\_type, EVT\_CONNECTOR\_CREDENTIAL\_REPLACED) {

&#x20;   return Ok(AckOutcome::Rejected);

}

REPLACED remains deferred and rejected by the existing pre-dispatch guard. The guard is preserved exactly, minus the DISABLED arm.



7.2 Add DISABLED dispatch arm

rust

EVT\_CONNECTOR\_ENABLED => apply\_connector\_enabled(...),

EVT\_CONNECTOR\_DISABLED => apply\_connector\_disabled(...),

REPLACED has no dispatch arm (unreachable due to the guard).



7.3 Client origination — atomic

Client disconnect updates local state and originates CONNECTOR\_DISABLED in one transaction, following the upsert\_local\_connector\_with\_event pattern.



Acceptance gate: after disconnect, either both the local state change and the event are committed, or neither. Tested (T21).



7.4 Ack outcome

DISABLED returns Accepted on apply. No DISABLED events exist in any log today.



8\. gorka-recover — recovery utility

8.1 What it is

A first-party Rust binary, shipped alongside gorka-agent.exe, built by cargo build --workspace. Used when migration v10 fails on a real device. Opens the local SQLCipher database with the key, inspects local\_connectors and sync\_events, repairs inconsistent rows using the existing decoders.



Path: src-tauri-agent/src/bin/gorka-recover.rs or equivalent. Not part of the normal app UI.



8.2 Modes

gorka-recover inspect — lists connector rows and their winning tuples; for each row, prints whether a matching event exists and whether status is consistent. Never prints credential\_value or configuration.



gorka-recover repair --dry-run — computes the repair for each inconsistent row; prints what would change. Does not write.



gorka-recover repair --apply — performs the repair inside a single transaction. Aborts on any decode error or identity mismatch; nothing is written.



Key is read from stdin (§9).



8.3 Ordering rule — use protocol\_order\_less

The utility selects the latest matching event in Rust, not in SQL.



Query sync\_events without any ORDER BY:



sql

SELECT id, device\_id, sequence, logical\_clock, event\_type, entity\_type,

&#x20;      entity\_id, payload, created\_at

FROM sync\_events

WHERE organization\_id = ?1

&#x20; AND entity\_type = 'connector'

&#x20; AND event\_type IN ('CONNECTOR\_ENABLED', 'CONNECTOR\_DISABLED')

&#x20; AND entity\_id = ?2

Fold using protocol\_order\_less:



rust

let mut best: Option<EventRow> = None;

for row in rows {

&#x20;   best = match best {

&#x20;       None => Some(row),

&#x20;       Some(b) => {

&#x20;           if protocol\_order\_less(

&#x20;               b.logical\_clock, \&b.device\_id, b.sequence,

&#x20;               row.logical\_clock, \&row.device\_id, row.sequence,

&#x20;           ) {

&#x20;               Some(row)

&#x20;           } else {

&#x20;               Some(b)

&#x20;           }

&#x20;       }

&#x20;   };

}

Result: the utility's notion of "latest" is defined by the exact same comparator as the application. No SQL-ordering assumption.



8.4 Repair categories

Three categories, defined by what the current row says versus what the latest event says.



Category 1 — Unmatched row. No matching event exists.



Action: abort with a sanitized error identifying the row by (organization\_id, connector\_code). Do not guess. Do not write.



Category 2 — Status-inconsistent row. A matching event exists; the row's status disagrees with the event type.



Action: rebuild the row from the event.



ENABLED event → full row from decoded payload (tier, credential\_value, configuration, source\_device\_id, updated\_at, winning tuple).



DISABLED event → tombstone (tier='', credential\_value=X'', configuration='', source\_device\_id, updated\_at, winning tuple).



Category 3 — Content or tuple inconsistency (event-decodable). A matching event exists; status matches; but one or more event-derived fields disagree with the winning event.



Clarification (from the v11 review): Category 3 has two sub-cases.



3a — Tuple-only inconsistency. Status, tier, credential\_value, and configuration all agree with the winning event's decoded payload. Only (winning\_logical\_clock, winning\_device\_id, winning\_sequence) disagrees.



Action: update only the three tuple columns. Do not touch status, tier, credential, or configuration.



3b — Content inconsistency. One or more of tier, credential\_value, configuration disagrees with the winning event's decoded payload.



Action: rebuild the row from the winning event, same as Category 2. Compare fields internally, never printing values.



If the event cannot be decoded or identity validation fails → abort without writing. This is Category 1 behaviour applied to a decode failure.



8.5 Identity verification (before any write)

Before applying any repair:



SELECT id FROM local\_connectors WHERE organization\_id = ?1 AND connector\_code = ?2 — expect exactly one row. If zero or more than one, abort.



Verify decoded.connector\_code == sync\_events.entity\_id == local\_connectors.connector\_code. Any mismatch aborts.



8.6 What is never written

sync\_events — never written by the utility.



Any row in a different organization\_id.



Any column other than those specified for the category.



8.7 Credential-safe output — structural enforcement

The utility defines two structs:



rust

struct SafeRow {

&#x20;   id: String,

&#x20;   connector\_code: String,

&#x20;   organization\_id: String,

&#x20;   tier: String,

&#x20;   status: String,

&#x20;   source\_device\_id: String,

&#x20;   created\_at: String,

&#x20;   updated\_at: String,

&#x20;   winning\_logical\_clock: i64,

&#x20;   winning\_device\_id\_hex: String,

&#x20;   winning\_sequence: i64,

&#x20;   // NO credential\_value

&#x20;   // NO configuration

}



struct SafeEvent {

&#x20;   id: String,

&#x20;   event\_type: String,

&#x20;   logical\_clock: i64,

&#x20;   sequence: i64,

&#x20;   device\_id\_hex: String,

&#x20;   // NO payload

&#x20;   // NO decoded fields

}

All Display and diagnostic output uses SafeRow and SafeEvent. Credential and configuration are held as byte buffers only inside the repair transaction and never routed to stdout, stderr, or any error message.



Errors are enums with field names, not values:



rust

enum RecoverError {

&#x20;   NoMatchingEvent { organization\_id: String, connector\_code: String },

&#x20;   StatusMismatch { row\_id: String, expected: String, actual: String },

&#x20;   DecodeFailed { event\_id: String, category: \&'static str },

&#x20;   IdentityMismatch { row\_id: String, event\_id: String },

&#x20;   DuplicateRow { organization\_id: String, connector\_code: String },

&#x20;   // ...

}

Decode errors report the category ("missing tier field", "invalid TLV") and the event ID. Never the payload bytes. Never the decoded value.



8.8 Constraints

sync\_events is read-only.



local\_connectors writes only.



No credential or configuration is printed at any verbosity level.



Decoder failures abort with a clear error and a row identifier, never with the payload contents.



The utility does not connect to the network.



8.9 Tests

MT9: seed a test DB with credential\_value = b"SENTINEL\_CREDENTIAL\_DO\_NOT\_PRINT" and configuration = "SENTINEL\_CONFIG\_DO\_NOT\_PRINT". Run inspect, repair --dry-run, repair --apply. Assert neither sentinel appears in stdout or stderr. Assert no substring SENTINEL appears.



MT11: seed a malformed payload. Before/after snapshot per §5.6.



MT12: three matching events where SQL ordering and Rust ordering could diverge. Assert the utility selects the protocol\_order\_less winner.



9\. Key handling

9.1 Preferred mechanism

Check the application's existing key-opening path first (src-tauri-agent/src/main.rs, shared/src/db.rs). If the app already reads the key from a supported source (environment variable, config), use that same source for recovery. Do not build a separate wrapper if one is not needed.



9.2 Fallback: PowerShell wrapper

If no supported mechanism exists, the fallback is a PowerShell wrapper with session history disabled.



Procedure:



Open PowerShell for the recovery session.



Disable PSReadLine history persistence for this session:



powershell

Set-PSReadLineOption -HistorySaveStyle SaveNothing

Session-only. Does not modify the persisted history file.



Prompt for the key with echo suppressed:



powershell

$key = Read-Host -Prompt "SQLCipher key" -AsSecureString

Convert to plaintext in a local variable:



powershell

$plain = \[System.Net.NetworkCredential]::new("", $key).Password

Reject control characters:



powershell

if ($plain -match "\[\\x00-\\x1F\\x7F]") { throw "key contains control characters" }

Escape single quotes for SQL:



powershell

$escaped = $plain -replace "'", "''"

Build the recovery SQL as a here-string, with the escaped key interpolated, piped to the CLI's stdin:



powershell

$sql = @"

PRAGMA key = '$escaped';

PRAGMA cipher\_version;

SELECT user\_version FROM pragma\_user\_version;

"@

$sql | \& sqlcipher.exe "C:\\path\\to\\gorka-agent.db"

Clear variables:



powershell

$plain = $null

Remove-Variable key, plain, escaped, sql

Close PowerShell.



Tested character set: single quotes, backslashes, high-bit bytes (if permitted by the key format), maximum supported length. Documented in RECOVERY-RULES.md.



Preferred over: sqlcipher -key '...' on the command line (argv exposure), interactive PRAGMA key with history enabled (history file exposure), persistent SQLCIPHER\_KEY env var (child process and dump exposure), or a .sqliterc config file (file exposure).



9.3 Honest scope

This method reduces exposure through shell history, process arguments, logs, and files. It does not guarantee that the key is erased from process memory. .NET SecureString and String cannot be reliably zeroed by the caller. The threat model here is accidental exposure, not a hostile observer with memory access.



9.4 Test (MT10)

Assert, after a full recovery session:



PSReadLine history file does not contain the key.



No SQLCipher CLI process ran with the key in argv.



No SENTINEL string appeared in any output.



$plain variable cleared in the session.



Does not assert memory erasure. Does not claim history checks prove the key never existed in memory.



10\. Comparison tuple

Tuple: (logical\_clock: i64, device\_id: BLOB, sequence: i64)

Comparator: protocol\_order\_less (sync\_pipeline.rs:948). No parallel implementation.

Storage:



sql

winning\_logical\_clock INTEGER NOT NULL DEFAULT -1,

winning\_device\_id BLOB NOT NULL DEFAULT X'',

winning\_sequence INTEGER NOT NULL DEFAULT -1

Defaults are placeholders only. After migration, every row's stored tuple equals the tuple of its protocol-latest matching event. Asserted directly, not inferred from -1 absence.



11\. Credential removal — logical only

After DISABLED wins: credential\_value = X'', configuration = '', tier = ''. Row no longer exposes or uses the previous credential. Stale events cannot restore it.



Physical erasure (SQLite pages, WAL, SQLCipher key handling) is out of scope. Tracked as a separate spec.



12\. Test matrix (apply-path tests)

\#	Scenario	Expected

T1	\[ENABLED(100,A,10)] alone	ENABLED, winning=(100,A,10)

T2	\[ENABLED(100,A,10), DISABLED(105,A,11)]	DISABLED, credential empty, winning=(105,A,11)

T3	\[DISABLED(105,A,11), ENABLED(100,A,10)]	DISABLED, winning=(105,A,11)

T4	\[E(100,A,10), D(105,A,11), E(100,A,10)]	DISABLED

T5	\[DISABLED(105,A,11)] alone	tombstone, DISABLED

T6	\[D(105,A,11), E(100,A,10)] no prior row	tombstone survives

T7	\[E(100, A\_bytes, 10), E(100, B\_bytes, 5)], A\_bytes < B\_bytes	B wins; verify winning\_device\_id = B\_bytes

T8	\[E(100,A,10), E(100,A,9)]	A10 wins; verify winning\_sequence = 10

T9	Migration + stale event	stale loses

T10	Migration all matched and consistent	v10

T15	Migration one unmatched	fails, rolls back

T16	Migration rerun	idempotent

T17	Disable applied twice	idempotent

T18	Stale ENABLED after tombstone	tombstone unchanged

T19	(reserved — REPLACED)	out of scope

T20	Backfill equal-clock diff-device	byte-level comparator

T21	Local mutation + event origination fail	no inconsistent committed state

T22	read\_local\_connector\_credential on DISABLED row containing a deliberately non-empty credential (inconsistent fixture)	returns None — gates on status, not the tombstone invariant

T23	read\_local\_connector\_credential on ENABLED row	returns Some(credential) — guard does not over-reject

T24	Send path and test-connection path on DISABLED connector	Both use read\_local\_connector\_credential; both return a hard error before attempting to use any credential

Assertion standard: each test verifies final stored row and winning tuple, not just return value.



13\. Frozen surfaces — not touched

Wire format (all CONNECTOR payload shapes).



Event type codes, entity type codes.



Engine handshake, session lifecycle, ack loop.



Pipeline transaction boundary.



sync\_state, sync\_delivery, sync\_events schemas.



The ApplyNotifier from Step 1.



Non-CONNECTOR event families.



REPLACED dispatch (deferred).



The privacy boundary: no debtor data in GORKA cloud.



14\. Doc amendments required

SYNC-ARCHITECTURE.md §25.14.5 — tie-break rule, reference protocol\_order\_less.



SYNC-ARCHITECTURE.md §25.14.6 — remove punt. Replace: "CONNECTOR events participate in the standard protocol-order tie-break described in §25.14.5."



SYNC-ARCHITECTURE.md §25.15.5 — DISABLED apply rule, tombstone, credential wipe.



SYNC-ARCHITECTURE.md §25.16.5 — REPLACED remains deferred and rejected by the existing pre-dispatch guard. Own spec pending. Deferral reason: payload lacks tier; REPLACED-first arrival cannot construct a row without a pending-state mechanism.



LOCAL-TABLES.md — three new columns, tombstone representation, read-model exclusion (§4.5), recovery procedure (§5.5).



RECOVERY-RULES.md — §5.5 paths, §5.5.1 startup-blocked recovery via SQLCipher CLI, §9.2 tested character set, preserve-database-first rule, Path 3 not routine, sync\_events read-only.



RESUME-HERE.md — F15 closed; new open items.



15\. Implementation plan — three STOP-gated commits

Commit 1 — Migration and schema

Changes:



if current\_version < 10 block with three new columns on local\_connectors.



Backfill UPDATE with WHERE EXISTS guard.



Check 1 (existence).



Check 2 (status provenance).



gorka-recover utility (src-tauri-agent/src/bin/gorka-recover.rs).



Acceptance gate (local SQLCipher DB):



MT1–MT12 pass.



MT3 and MT7 verify complete schema and row data unchanged.



MT9 verifies sentinel values never appear across all three modes.



MT11 verifies byte-identical before/after on failure.



MT12 verifies Rust-comparator selection.



Every row's stored tuple equals its matching event's tuple.



STOP if any test fails. Preserve the DB. Investigate. Never edit sync\_events. Never delete rows to force success.



Commit 2 — Apply path and dispatch

Changes:



apply\_connector\_enabled becomes order-aware.



Add apply\_connector\_disabled.



Remove DISABLED from pre-dispatch guard.



Add DISABLED dispatch arm.



T22–T24 read-path gate.



Acceptance gate: cloud trip; ≥112/112 existing tests plus new T-tests; sync\_wire\_roundtrip unchanged.



Commit 3 — Client origination

Changes:



Transactional disconnect operation: update local state + originate CONNECTOR\_DISABLED in one transaction.



Test T21.



Acceptance gate: live test — Client disconnect causes Agent to mark DISABLED and wipe credential. Verified by reading the Agent's local DB before and after, and confirming the Communication Tools page no longer shows the connector.



Timing: half-day to one-day planning only. STOP gates determine completion.



16\. Open items

Forensic credential erasure. Separate spec. Applies codebase-wide.



REPLACED spec. Own spec when Client has rotation UI. Must address payload-lacks-tier.



source\_device\_id TEXT vs winning\_device\_id BLOB. Cosmetic.



Dynamically-built SQL writes to local\_connectors. String search may miss; residual risk noted in evidence log.



\--skip-migration flag. Future enhancement for recovery when startup is blocked.



17\. Reviewer approval

v11 verdict: GO for implementation, with the Category 3 clarification applied (incorporated in §8.4).



Implementation gates (from v11):



Check existing key-opening path before building a wrapper.



Reuse the actual application comparator and payload decoders.



Resolve Category 3 consistency check.



Pass MT9, MT11, and existing sync tests.



Inspect the final diff and verify the build before committing.



"Let's stop polishing the paper and start proving the code."



APPENDIX — Revision history

The following drafts preceded this frozen version. Each is retained for the record.



v1–v2: initial draft and reviewer corrections on tombstone representation, comparison tuple, migration.



v3: Gate 1 verification from source, tombstone design, comparator identified.



v4: REPLACED removed from scope; fail-closed migration replaced sentinel.



v5: migration NOT EXISTS check, entity\_type = 'connector' predicate, historical write paths enumerated, comparator tests use byte arrays.



v6: status provenance check added, MT6 verifies SQLite/Rust BLOB ordering equivalence, T22 credential read path gate, recovery Path 3 qualified.



v7: Check 2 claim narrowed to status provenance only, MT8 documents the boundary, §5.5.1 startup-blocked recovery, sync\_events read-only.



v8: backfill WHERE EXISTS guard (fixes NOT NULL crash), recovery Path 2 full reconstruction, SQLCipher CLI named.



v9: sync\_events.payload confirmed as durable source, history-safe key entry method.



v10: recovery queries use explicit non-secret columns, gorka-recover utility introduced, honest key-handling scope.



v11: Rust comparator for utility ordering, three repair categories, credential-safe output enforced structurally, decisive MT11.



End of frozen specification.



Status: FROZEN 2026-10-11. Approved for implementation.
Next action: Commit 1 only. Do not proceed to Commit 2 until local SQLCipher migration gates (MT1–MT12) pass.


PART II — AI COPILOT AND COMPLIANCE ENFORCEMENT
Version: 1.0 — FROZEN
Date frozen: 2026-10-11
Status: APPROVED FOR IMPLEMENTATION. STOP-gated slices.
Companion to: Part I of this file (CONNECTOR-EVENT-ORDER-SPEC v1.0). Part II inherits the primitives frozen in Part I: the protocol_order_less tie-break, tombstone semantics, fail-closed migration pattern, and connector lifecycle (CONNECTOR_ENABLED, CONNECTOR_DISABLED). Nothing in Part II reopens Part I.

Reviewer verdict: GO for freeze (2026-10-11). No further spec revisions except implementation defects.

Supersedes: every prior AI Copilot draft (v0.1 through v0.7a) and the August 2026 cloud AI spec.

II.1 Architecture fit
GORKA is local-first. Debtor data lives on the client's devices. It does not go to a GORKA cloud. No cloud service is in the middle of any Copilot flow.

The Agent device calls the AI provider directly. Same pattern as SMS and email. Credential is the client's own (BYOP) or GORKA-provisioned (Tier 1, funded phase). Device → provider.

There is no cloud AI endpoint, no cloud AI table, no cloud AI state.

The Copilot is a connector, mechanically. Same catalog row, same enable flow, same credential distribution through encrypted sync, same tombstone on disable. One Copilot connector per AI provider the client chooses to enable.

On legal responsibility. The BYOP model establishes who contracts for the AI service. It does not establish that GORKA is legally uninvolved in the data flow. GORKA's mechanisms shape what data reaches the provider; that shaping is a GORKA decision and a release gate. See II.11.5.

II.2 Scope
II.2.1 What we build (MVP)
AI provider abstraction and registry supporting multiple providers without code changes for the OpenAI-compatible class (II.6).

Gemini adapter and OpenAI-compatible adapter, both implementing the existing ConnectorAdapter trait (II.7).

Enablement of AI providers through the existing BYOP flow (Tier 2).

Context Engine producing a small, allowlisted context (II.3).

Strategy Engine calling the provider, receiving strictly structured output (II.8).

Deterministic fallback producing a rule-based recommendation when the provider fails (II.9).

Fact validation layer with bounded detection scope (II.10).

AI boundary layer validating a typed request at a single enforcement point (II.4).

Copilot panel on the Agent's debtor profile page (II.12).

Recommendation lifecycle with statuses, expiration, durable send-attempt record, defined outcomes (II.11).

Opt-out enforcement, optional contact-limit configuration, optional disclosure text (II.13).

Data enrichment — BYOP connector category, reserved only (II.14).

II.2.2 What we do not build (MVP)
Feature	Status	Reason
Web scraping of any kind	Never built	GORKA's own code does not scrape.
Automatic third-party contact discovery	Never built	—
Predictive ML / probability percentages	Not built	No data; LLMs cannot calibrate.
Learning system / A-B prompt testing	Not built	No labeled outcomes yet.
Autonomous prompt modification	Never built	—
Autonomous sending or automatic retries	Never built	—
Cross-device AI recommendation history	Not built in MVP	II.15.
SMS and voice drafting	Deferred	Email first.
Psychology / "understands the debtor" language	Never used	—
AI usage in billing aggregates	Deferred	—
Data enrichment adapters / lookups	Reserved, not built	II.14.
Universal quiet-hours engine	Never built	II.13.
Timezone-based send blocking	Never built	II.13.
Any cloud AI endpoint or cloud AI storage	Never built	—
II.3 The Context Engine
Where it runs. On the Agent device. Local tables only. No cloud call.

Allowlist. Only the fields listed here may leave the device. The list is the boundary.

json
{
  "debtor": {
    "amountRange": "5000-7500",
    "daysOverdueRange": "30-60",
    "debtOriginCategory": "INVOICE"
  },
  "communicationHistory": {
    "totalCount": 5,
    "emailCount": 3,
    "smsCount": 1,
    "voiceCount": 1,
    "responseRateBand": "LOW"
  },
  "paymentHistory": {
    "totalCount": 1,
    "partialCount": 1,
    "missedCount": 0
  },
  "indicators": {
    "paymentReliability": "POOR",
    "engagementLevel": "LOW",
    "communicationPreference": "EMAIL",
    "promisesKeptRatio": "PARTIAL"
  }
}
Not in the allowlist, does not leave the device: debtor name, surname, email, phone (any form); exact debt amount; invoice or debt reference; message bodies; documents; third-party enrichment; any field not listed above.

Coarse representations, not exact values. Exact values and combinations of exact values can identify a person after direct identifiers are removed. Bands mitigate this.

Indicators are computed locally by deterministic rules. Not by the AI.

The allowlist is enforced in two independent places. The Context Engine only produces allowlisted fields. The boundary layer (II.4) validates the complete serialized request. Two checks, same rule.

Subject to legal review.

II.4 The AI boundary layer
Where it runs. On the Agent device, in the Copilot command.

II.4.1 The single enforcement point
The Copilot command constructs a typed OutboundAiRequest.

The boundary validator validates it.

The validated form is captured as a canonical semantic object.

The adapter receives the canonical semantic object and translates it into its provider's HTTP envelope.

The adapter may not add, remove, reorder, or alter any prompt content, context field, or request option during translation.

II.4.2 The typed request
text
OutboundAiRequest {
  systemPrompt: String,          // from a fixed template, parameters only from the allowlist
  userMessage: String,           // from a fixed template, parameters only from the allowlist
  context: AllowedContext,       // the exact shape in II.3, no additional fields
  model: String,                 // from connector configuration
  requestOptions: RequestOptions // a fixed allowlist of options
}
II.4.3 Validation rules
Fields. No field outside the typed structure. Unknown fields fail.

Values. Each value matches its declared type: string enums where declared, integers within declared bounds, no free-form strings.

Embedded identifiers. systemPrompt and userMessage scanned for: known debtor identifiers, email-shaped strings, phone-shaped strings, currency amounts outside declared ranges, invoice-shaped tokens. Any match fails.

Request options. Only options on the fixed allowlist.

Any rule failure blocks the request. No fallback inside the boundary. A failed request falls through to the deterministic fallback (II.9).

II.4.4 What the boundary does not claim
It validates structure and known patterns. It does not guarantee no identifying information can ever reach the provider. A malicious or unusually shaped identifier could pass. The boundary reduces exposure; it is not an absolute guarantee. The legal release gate (II.11.5) determines what is acceptable.

II.4.5 Semantic-identity acceptance test
Byte-identity of the entire provider-bound body is not achievable — Gemini and OpenAI use different envelopes. The correct test is semantic identity with an explicit per-provider field mapping.

For each adapter:

A table maps every canonical field to the provider's body location. Example: systemPrompt → contents[0].parts[0].text for Gemini; messages[0].content for OpenAI-compatible.

The test walks the mapping, compares each field individually, and asserts the provider body contains only mapped locations.

An unmapped location fails the test.

If a provider's format cannot be mapped unambiguously, the test fails closed.

Three tests:

Positive: valid request → provider body round-trips to equal the validated form.

Negative: invalid request never reaches the adapter.

Injection: a fixture adapter attempts to add a field during translation; the mapping walk catches it.

II.4.6 Credentials
Credentials are never part of the OutboundAiRequest. Supplied to the adapter at construction time, separate from the canonical payload. Never in prompts, canonical bytes, or audit logs.

II.4.7 Logging
The sanitized request is logged locally for audit: field names only, no values. Never to a cloud.

II.4.8 Two-placeholder pattern
The draft the agent edits uses real values, restored deterministically from the context by rendering approved tokens. The rationale uses placeholders. Restoration is deterministic render of approved tokens into permitted fields. The draft is not trusted because restoration succeeded — fact validation (II.10) runs on the final message.

II.5 Model and provider configuration
The model identifier is a configuration value. Not hardcoded. No provider model string appears in code. Stored in the connector's configuration JSON.

The provider is a catalog row. Not hardcoded. II.6 defines the catalog architecture.

II.5.1 Config-only changes — Disable → Re-enable
The MVP does not introduce a separate configuration-update event. To change a model, base URL, or any other configuration-only field:

The client disables the connector. Originates CONNECTOR_DISABLED.

The client re-enables with the new configuration. Originates CONNECTOR_ENABLED, whose payload carries configuration.

Verification status (Slice 0, closed):

On CONNECTOR_DISABLED, apply_connector_disabled writes a tombstone. Confirmed in code.

On re-enable, apply_connector_enabled writes the full payload with the winning tuple. Confirmed.

A device that missed the disable but received the re-enable: the re-enable has a later clock, wins. Confirmed by protocol_order_less.

A stale disable arriving after the re-enable: loses. Confirmed.

read_local_connector_credential gates on status = 'ENABLED'. Confirmed in local_record.rs.

Agent send path (send_connector_message) and test path (test_connector_connection) both route through read_local_connector_credential and refuse on None. Confirmed in src-tauri-agent/src/main.rs.

UX cost: disable wipes the credential on every device. Re-enable must therefore supply a new credential. Tier 1 provision; Tier 2 re-enter.

On gemini-2.5-flash as default. The seed row ships with gemini-2.5-flash. Availability and free-tier eligibility are verified at implementation.

II.5.2 Base URL network controls
Because the adapter carries an API credential, a URL-validation failure is a credential-disclosure risk, not merely a connectivity problem.

Static validation, at configuration save:

Must be HTTPS.

Must not be an IP address literal (IPv4 or IPv6). IPv6 literals in brackets rejected.

Must not contain embedded credentials (user:pass@host).

Hostname displayed on the connector card.

Resolution-time validation, at every request:

Hostname resolved before connection.

Resolved address must be public. Loopback, private, link-local, multicast, reserved rejected. Applies to IPv4 and IPv6.

The address actually connected to is the one validated. DNS rebinding prevented by using the validated resolved address for the connection.

Redirect handling:

Follow redirects only within the same origin.

Cross-origin redirects rejected.

No credential forwarded to any redirect destination.

If the client cannot enforce this, redirects disabled entirely.

Tests: IPv4 and IPv6 loopback, private, link-local, multicast rejected. DNS rebinding simulation rejected. Cross-origin redirect rejected; credentials not forwarded. Embedded credentials rejected at save.

II.5.3 Implementation acceptance condition (addendum 3)
When the implementation pins a validated IP address to prevent DNS rebinding, the following must also hold:

TLS certificate and hostname verification. The certificate presented by the pinned address must be validated against the intended hostname, not the pinned IP. Pinning the IP must not disable SNI, hostname verification, or certificate chain validation.

Proxy configuration. If the HTTP client is configured to use a proxy, the proxy must not bypass the address-validation policy. Either the proxy is disabled for AI provider calls, or the proxy's resolved destination is subject to the same validation.

These are Slice 3 acceptance conditions. Verified with a test that attempts a TLS connection to a pinned address presenting the wrong certificate, and a test that attempts a call through a misconfigured proxy.

II.6 Extensible AI provider catalog
The requirement. The catalog is open. Gemini today. Paid Gemini tiers, ChatGPT, KIMI, Claude, DeepSeek, others later. Adding a provider does not require re-architecting anything.

II.6.1 Catalog identity vs registry factory
Two separate concepts:

The catalog row identifies a specific provider. chatgpt, kimi, gemini-ai are catalog rows.

The registry maps a catalog row's code to an adapter factory.

Multiple catalog codes can map to the same factory. chatgpt, kimi, and deepseek map to the OpenAI-compatible factory, which reads base_url and model from each row's configuration.

II.6.2 Adapter identity
The ConnectorAdapter::code() method returns a &'static str. The current implementation's contract (catalog identity vs adapter-family identity) is verified in Slice 3. The invariant: provider/catalog identity is distinct from adapter-family identity, and the registry knows which catalog code produced which adapter.

II.6.3 Three levels of extensibility
Level 1 — Model within a provider. Config value. No code.

Level 2 — OpenAI-compatible provider verified to meet the contract. Seed a catalog row. No code. Applies to providers verified against: authentication shape, structured output support, error response shape, and the chat-completions request/response contract.

Level 3 — Provider with a unique API contract. A new adapter, one small code slice. Same shape as resend-email or mocean-sms.

II.6.4 MVP adapters
Two adapters ship:

Gemini — Google's API shape. Used by gemini-ai.

OpenAI-compatible — serves any verified provider. Used by chatgpt, kimi, and any future OpenAI-compatible provider.

Adding a new OpenAI-compatible provider: one seed row. Adding a new model to an existing provider: one config value. Adding a unique-API provider: one small adapter slice.

II.7 The AI adapters
Two adapters in the MVP, both implementing ConnectorAdapter.

Gemini adapter. Posts to Google's generate-content endpoint with the model from config.

OpenAI-compatible adapter. Posts to {base_url}/chat/completions with the model from config.

Both receive the credential at construction, separate from the canonical payload. Both drop at end of call. Both carry the credential-leak regression test.

Neither adapter redacts, builds the prompt, validates facts, or enforces compliance. Those run before construction. The adapter's only job is transport.

The adapter receives the canonical semantic object and may not modify it. See II.4.5.

Neither adapter reads or writes the database. Neither emits sync events.

The adapter is not an enforcement boundary. A successful adapter call is not authorization to send.

II.8 Strategy Engine and structured output
The prompt. One system prompt, one user message containing the context JSON. The system prompt instructs the model to return JSON only.

The response schema (strict):

json
{
  "recommendation": {
    "channel": "EMAIL",
    "priority": "HIGH",
    "tone": "FIRM",
    "timing": "WITHIN_24_HOURS",
    "rationale": "..."
  },
  "draft": {
    "subject": "...",
    "body": "..."
  },
  "riskFlags": ["LOW_RESPONSE_RATE"]
}
Canonical enums (shared by the AI schema and the fallback):

Priority: LOW | NORMAL | HIGH

Tone: FRIENDLY | FIRM | URGENT | FINAL_NOTICE

Timing: WITHIN_24_HOURS | WITHIN_3_DAYS | WITHIN_7_DAYS

Channel: EMAIL (only channel in the MVP)

The fallback (II.9) maps to the same enums. One schema.

Local schema validation, regardless of provider features. Even if a provider claims JSON mode or structured output, the local parser validates against the schema. Rejects: missing fields, unknown enum values, wrong types, free text. No salvage. Falls through to fallback.

modelVersion is not trusted from the response. The record uses the configured model name from connector configuration and the local promptVersion from the Copilot code.

Rationale scope. Model-generated text. Labeled "AI explanation — unverified." Constrained to a small structured form. No free-form narrative. Not subject to fact validation. Not allowed to introduce facts as UI facts. Does not appear in the sent email.

No auto-generation. Manual trigger only. Regeneration limit: three per debtor per session.

II.9 Deterministic fallback
If the provider fails or returns malformed output, the Agent gets a recommendation from local rules. No AI call. Offline-capable.

Deterministic inputs:

days_overdue — integer from the debt's due date.

response_rate_numeric — replies / total outbound. If total is zero, treated as 0.0.

promises_kept_numeric — promises kept / promises made. If made is zero, treated as 0.0.

Band-to-numeric mapping. II.3 uses bands for the AI allowlist. The fallback uses numeric values internally. Both are derived from the same local counts. No band-to-numeric conversion.

Fallback rules:

text
if days_overdue > 60 and response_rate_numeric < 0.2:
    → EMAIL, priority HIGH, tone URGENT
elif days_overdue > 30 and promises_kept_numeric < 0.5:
    → EMAIL, priority NORMAL, tone FIRM
elif days_overdue > 30:
    → EMAIL, priority NORMAL, tone FIRM
else:
    → EMAIL, priority NORMAL, tone FRIENDLY
Missing data. No due date → days_overdue = 0 → FRIENDLY case.

Order of implementation: fallback first, AI on top.

II.10 Fact validation layer
The invariant. No draft with unresolved detected claims can be sent. The draft is shown to the agent with flags; the send button is disabled until claims are resolved.

Supported claim types in the MVP:

Claim type	Detection	Verification
Dollar amount	Regex on currency-shaped tokens	Cross-checked against the debtor's debt records
Calendar date	Regex on date-shaped tokens	Cross-checked against due dates and event dates
Invoice / reference number	Regex on reference-shaped tokens	Cross-checked against records in the local database
Prior promise or payment	Pattern match against phrasing templates	Must be backed by a row in actions or payments
Legal or credit consequence	Exact match against a fixed template list	Must match one of the templates
The bounded scope is explicit. The validator does not claim to detect every possible factual claim. A claim that does not match a supported type is not flagged, not verified, not blocked. The absence of a flag is not proof of truth. The spec and UI state this plainly.

II.10.1 Claim resolution
When a claim is flagged, the agent has two actions:

Edit the draft to remove the claim. No longer present. Revalidation passes.

Resolve the claim with a database-supported value. The agent selects the correct value from the local database. The draft is rewritten. Revalidation confirms the claim matches the database.

A resolution producing a value differing from the database is rejected.

Resolution record. Local: which claim, what value selected, user_id, timestamp.

Subsequent edits invalidate the resolution. Re-runs the validator. New claim requires new resolution.

Validation runs on the final message immediately before send.

If a claim cannot be verified against the database, the only resolution is to remove it.

What this does not do. It does not make the draft legally safe. It makes it factually accurate within the supported claim types.

II.11 Recommendation lifecycle and send safety
II.11.1 Statuses
PENDING, ACCEPTED, REJECTED, SENT, EXPIRED, SEND_UNCERTAIN.

One canonical status per state:

SENT — confirmed success only.

SEND_UNCERTAIN — uncertain attempt.

No ambiguous "SENT with an uncertain flag."

II.11.2 Expiration
Expires when any of these change since creation:

Debt amount or debt status.

Communication count for the debtor.

Opt-out flags for the debtor (any channel).

The configured expiration window passes (default 72 hours).

Snapshot. Hash of a canonical serialization:

Canonical form. Fixed field order (alphabetical), normalized: amounts as integer cents; dates as RFC 3339 UTC; counts as integers; booleans as 0/1; missing values as null.

Hash algorithm. SHA-256 over the canonical UTF-8 bytes.

Storage. Stored on the recommendation at creation time.

Recomputed on load and in the send command. A mismatch expires.

II.11.3 Send-command guarantees
Refuses unless all are true at the moment of the call:

Recommendation exists with status ACCEPTED.

Belongs to the current debtor.

Not EXPIRED and not superseded.

Final edited draft passes fact validation.

Opt-out flags allow the send.

Contact-limit configuration, if set, allows the send. Not active until Slice 5.

Connector credential present and connector is ENABLED.

Configuration-only-change window is not in progress.

Local locking. Inside one local database transaction:

Recompute freshness snapshot.

Read contact-limit count.

Read opt-out flag.

Write contact-limit reservation — a row in local send_reservations.

Write send-attempt record — a row in send_attempts.

Transaction commits. Provider call happens after commit. Concurrent local sends cannot pass the contact-limit check while the reservation is present.

What this does not guarantee. Across disconnected devices, no local mechanism prevents two independent reservations. Documented in II.13.2.

II.11.4 Send outcomes and durable attempt record
Durable attempt record before the provider call. Written in the same transaction as the reservation. Commits before the provider call.

text
send_attempts {
  id: UUID,
  recommendation_id: UUID,
  debtor_id: UUID,
  organization_id: UUID,
  connector_code: TEXT,
  attempted_at: DATETIME,
  state: TEXT,               -- IN_PROGRESS | CONFIRMED_SUCCESS | CONFIRMED_FAILURE | UNCERTAIN
  finalized_at: DATETIME,
  payload_snapshot: BLOB     -- see addendum 1
}
State transitions:

Event	Attempt state	Reservation	Communication	Recommendation
Before call	IN_PROGRESS	Written	—	ACCEPTED
Confirmed success	CONFIRMED_SUCCESS	Converted	Written	SENT
Confirmed failure	CONFIRMED_FAILURE	Released	Not written	ACCEPTED or REJECTED
Uncertain (timeout, lost response)	UNCERTAIN	Retained	Not written	SEND_UNCERTAIN
Crash before provider response	Recovery: UNCERTAIN	Retained	Not written	SEND_UNCERTAIN
Crash after provider response	Recovery: UNCERTAIN	Retained	Not written	SEND_UNCERTAIN
Recovery must be idempotent. Each recovery step keys on the attempt's id and prior state. Applying the same step twice is a no-op.

Uncertain-reservation resolution:

Prior state	Trigger	Result
UNCERTAIN	Agent confirms delivery	Reservation converts to communication
UNCERTAIN	Agent confirms not delivered	Reservation released
UNCERTAIN	Agent cannot confirm	Reservation retained indefinitely
UNCERTAIN	No agent action, TTL elapsed (default 30 days)	Reservation retained; UI shows overdue
Uncertainty does not release the reservation. Only an explicit "not delivered" confirmation releases it.

The provider call and local writes remain non-atomic. The reservation-then-attempt pattern is the recovery mechanism, not a distributed transaction.

No automatic retry, ever. For any outcome. The agent decides.

II.11.5 Legal release gate
Preconditions for release, not engineering choices:

Legal review of the outbound context allowlist (II.3).

Legal review of the prompt templates.

Legal review of provider terms for each AI provider the client enables.

Documented decision on whether local-only persistence (II.15) meets the intended use.

Legal review blocks release to real customers. It does not block local engineering. Slices 2 through 5 may proceed in-house with the release gate documented.

II.12 The Copilot UI
Collapsed state. Header with "Copilot" and a click-to-open indicator.

Expanded state:

Debtor snapshot. Name, amount, days overdue, contact availability. All local.

Trigger. "Analyze debtor." Manual. No auto.

Loading state. Shown immediately.

Recommendation. Channel, priority, tone, timing.

Rationale. Labeled "AI explanation — unverified." Structured form (II.8).

Draft. Subject and body. Restored real values for editing. "Regenerate" (up to 3 per session) and "Edit."

Claim flags. Mismatches appear inline.

Actions. "Accept and Review" opens a composer with the draft prefilled. "Reject" discards. Sending is a separate explicit action inside the composer.

When no AI provider is enabled. "Copilot is not enabled. Ask your administrator."

On the enabling role. The same role that enables any other connector. No new permissions model.

II.13 Compliance and contact handling
II.13.1 Scope
GORKA is a SaaS platform serving clients across many jurisdictions, time zones, and business models. GORKA does not impose a universal contact schedule, does not enforce time-of-day restrictions, and does not determine the legally permitted contact time for any jurisdiction.

Contact timing is the client's responsibility. GORKA provides the mechanism; the client decides how to use it. This mirrors the Zone 3 declaration that applies to client-connected data sources.

The MVP does not implement a quiet-hours engine, does not perform timezone-based blocking, and does not enforce jurisdiction-specific rules.

II.13.2 Opt-out handling
Opt-out is a legal fact, not a business preference.

Stored on the debtor record as a per-channel flag.

Reaches other devices through the existing ENTITY_UPDATED sync event.

Send path checks the flag immediately before calling the connector, against the state available on the current device.

If set, the send is blocked. No override from the Agent device. Admin can clear the flag through the debtor's edit form.

The guarantee, stated precisely. Opt-out is enforced against the Agent's locally available state. Cross-device propagation is best-effort. An Agent that is offline or has stale local data may not yet know that an opt-out was recorded on another device. The system does not claim organization-wide prevention of sends after an opt-out. It enforces the flag against the state the device has, at the moment of the send.

Whole-blob data concurrency limitation (addendum 2). Additionally, debtors.data is synchronized as a whole blob under ENTITY_UPDATED. Two devices that concurrently modify different keys in the same debtor's data object produce a single winner. The losing change — including an opt-out flag if it loses — is not preserved. This limitation is a property of the existing whole-blob event model, not of the Copilot feature. It applies to every field stored in data, not only opt-out.

The MVP does not introduce per-key reconciliation for data. If per-key reconciliation becomes a requirement, it is a separately scoped change to the frozen sync architecture, not an expansion of this feature.

The MVP does not block sends on stale sync state. Whether to block sends when local state is stale is a separate policy decision not defined in this draft.

II.13.3 Contact limits
A client may configure a contact limit. Configuration is local per device. Not synced.

Contact-limit enforcement is not active until Slice 5. The configuration field exists. The send path does not consult it in Slice 1.

II.13.4 Disclosure text
If the client configures a disclosure text, it is appended to the outgoing message body before the preview is shown. If not configured, nothing is appended. No default.

No repeated appending. The composer checks whether the disclosure is already the last line before appending. Reopening the preview does not duplicate.

II.13.5 Honest language
Anywhere the spec or the UI mentions compliance: "configurable controls to support applicable regulatory requirements." Never "FDCPA compliance built in." Never claim enforcement the system does not provide.

II.13.6 What is not built
Universal quiet-hours engine.

Timezone-based send blocking.

Jurisdiction-specific rules.

Organization-wide rule synchronization.

Any claim that the system guarantees compliance with any jurisdiction's requirements.

Any claim that opt-out is enforced organization-wide across disconnected devices.

II.13.7 Existing schema
The compliance_rules table (migration v9) has columns for quiet hours. Those columns become unused. They remain in the schema. No migration in the MVP to drop them.

II.14 Data enrichment (reserved)
MVP scope: no enrichment lookup or enrichment data transmission is part of the MVP AI flow.

No enrichment adapter. No lookup. No enriched data. No external data source is enabled or read.

On "no data leaves the device." The approved allowlisted context (II.3) is sent to the AI provider as a normal part of the Copilot flow. That is the only outbound data. Enrichment data is not sent to the AI in the MVP because no enrichment exists in the MVP.

When a future phase adds enrichment, any externally sourced field requires an explicit field-level disclosure decision and legal review before use in the AI flow. Until then, the field remains local.

Architectural reservation:

Data connector category, already reserved.

DataSourceAdapter trait with lookup(), in the spec, not the code.

external field in the Context object, reserved, always null in MVP.

BYOP sub-table already present as a placeholder.

Deferred. Which provider(s) to integrate. LookupQuery / LookupResult shapes. On-demand vs cached lookup. Interaction with fact validation. Any use of externally sourced fields in the AI flow.

II.15 What syncs and what stays local
Syncs.

Connector enablement and credential (AI providers and any future data connector). Uses existing CONNECTOR_ENABLED and CONNECTOR_DISABLED.

Opt-out flags. Uses existing ENTITY_UPDATED on the debtor record.

Actual sent communications. Uses existing COMMUNICATION_LOGGED.

Does not sync.

AI prompts and responses.

Recommendations, outcomes, drafts.

The send_attempts and send_reservations tables.

Enriched data.

Contact-limit settings.

Disclosure-text settings.

Copilot outcome vs communication record:

Copilot outcome — local fact: "the AI recommended X, the agent accepted it, the send resulted in Y." Local only.

Communication record — actual sent message. Syncs through COMMUNICATION_LOGGED. Does not carry AI rationale or draft history.

MVP default. Local-only persistence of recommendations and outcomes. Explicit limitation: no cross-device AI recommendation history in the MVP. If a customer requires the AI recommendation and its outcome to be visible on other devices or to survive device loss, that is a separately scoped audit-and-sync design. The limitation must be stated in the UI, in customer documentation, and in any onboarding material.

II.16 Implementation slices
Slice 0 — Approve the concept. Closed. All gates verified.

Slice 1 — Opt-out enforcement + disclosure text. Frozen scope in II.17. No reservation lifecycle. No contact limits.

Slice 2 — Deterministic Context Engine and fallback. Local context from existing tables. Rule-based recommendation using canonical enums (II.8) and deterministic calculations (II.9). Works offline, sends nothing external.

Slice 3 — AI boundary and adapters. Typed outbound request, canonical serialization, boundary validator (II.4). Gemini and OpenAI-compatible adapters. Base URL network controls (II.5.2 and II.5.3). Tests: secrets cannot reach requests or logs; embedded identifiers caught; semantic-identity round-trip; injection caught.

Slice 4 — Strategy Engine and fact validation. Strict parse with canonical enums and local schema validation. Fall back on failure. Bounded fact validator (II.10). Claim resolution semantics.

Slice 5 — Recommendation lifecycle, reservation, contact limits, and UI. Local persistence. Expiration snapshot with canonical serialization. Regeneration limits. Review/composer flow. Durable send_attempts and send_reservations. Recovery scan. Three send outcomes. Contact-limit enforcement becomes active here. Re-enforce all preconditions in Rust.

Slice 6 — Integrated security and regression tests. Offline/stale rules, opt-out changes, concurrent sends, provider failures, malformed output, altered drafts, expiration, credential leakage, embedded identifiers, base-URL attack scenarios, uncertain outcomes, crash recovery.

Each slice gets a written acceptance result and a STOP/GO decision.

II.17 Slice 1 — frozen scope
II.17.1 What Slice 1 does
Slice 1a — Opt-out enforcement.

Opt-out stored in debtors.data JSON under key opt_out. Per channel: {"opt_out": {"email": true, "sms": false, "voice": false}}.

Read in Rust inside send_connector_message. If set for the connector's channel, refuse.

Connector-to-channel mapping is explicit and stable. Determined by the connector code, not the recommendation:

Connector code	Channel
resend-email	email
* ends in -sms	sms
* ends in -voice	voice
The check uses the actual connector being called, not the channel the Copilot recommended.

UI toggle on the debtor profile to set/clear the flag. The toggle reads the current data blob, sets or clears the key, and writes the whole blob back inside the same transaction that originates an ENTITY_UPDATED.

The merge is whole-blob replace. Confirmed in apply_entity_updated. There is no key-level merge. The toggle therefore must not clobber unrelated data keys; it reads the existing blob, mutates the opt_out key, and writes the full blob.

Enforcement is in Rust, in the send command. UI-only enforcement is insufficient.

The opt-out toggle reads the current data blob, sets or clears the opt_out key, and writes the full blob back in the same transaction that originates the ENTITY_UPDATED. This preserves unrelated keys at the moment of the write. It does not prevent a concurrent write from another device from losing the flag under the whole-blob event ordering.

Slice 1b — Disclosure text append.

Read compliance_rules.disclosure_text. If non-empty, append to the composer body.

The composer runs the append once. Idempotent: checks whether the disclosure is already the last line before appending.

Edit and reopen do not duplicate.

Appended before preview, so the preview shows the exact outgoing message.

II.17.2 Acceptance tests (written before code)
Opt-out (1a):

Set opt_out.email = true on debtor X. Send via resend-email refuses with a clear error.

Send via an SMS connector to the same debtor is not blocked by the email flag.

Clear opt_out.email. Send succeeds.

Set opt_out.email on device A. Sync. Device B refuses the send.

Set opt_out.email while device B is offline. Device B does not know until sync. Documented as the stated limitation.

Set opt_out.email while another data key exists. Verify the other key is not clobbered.

On device A, set opt_out.email = true. On device B (offline), change an unrelated data key. Bring device B online. Verify which change wins under protocol_order_less, and verify the losing change is recorded in history_records — not silently lost.

Verify the winner's outcome is the state on both devices after sync.

Disclosure text (1b):

Set disclosure text. Open composer. Verify appended.

Edit body. Verify not appended twice.

Save and reopen. Verify not appended twice.

Clear disclosure text. Open composer. Verify nothing appended.

II.17.3 What Slice 1 does not include
Contact-limit enforcement. Deferred to Slice 5. Reason: enforcement requires the reservation lifecycle. A simple count-then-send in Slice 1 is vulnerable to concurrent local sends. Contact limits are not active until Slice 5.

Any reservation logic.

Any send-attempt record.

Any new event type.

Any protocol amendment.

Any migration.

II.17.4 Reconnaissance required before Slice 1 code
Three items must be verified in the current codebase before Slice 1 implementation:

debtors.data JSON shape and mutation path. How the field is serialized, updated, and consumed.

ENTITY_UPDATED merge behavior for data. Whether it is whole-blob replace or key-level merge. If the latter, the toggle implementation differs.

compliance_rules fields. Which columns are populated today, which are unused, whether the disclosure_text column is already present.

No code before these three are read.

II.18 Open questions
Q1 — Persistence. Closed: local-only MVP, explicit limitation, separate design if a customer requires cross-device.

Q2 — Configurable AI model. Closed: config-only changes use Disable → Re-enable. Verified safe in Slice 0.

Q3 — Legal review of transmitted fields. Open. Required before real-customer release. Does not block local engineering.

Q4 — Placeholder pattern. Closed.

Q5 — Data enrichment boundary. Closed.

II.19 What Part II does not do
Does not write code.

Does not amend any frozen document. No protocol amendments are required for this feature.

Does not settle Q3 legal review.

Does not build multiple AI providers today — only the abstraction.

Does not build data enrichment today — only the reserved shape.

Does not build cross-device AI recommendation history.

Does not build scheduled, autonomous, or bulk AI.

Does not build any scraping path.

Does not build a universal compliance engine.

Does not claim any compliance guarantee the system does not provide.

II.20 Addendum — freeze clarifications (2026-10-11)
Addendum 1 — II.11.4, immutable send-payload recovery
The send_attempts table gains one column:

text
payload_snapshot: BLOB  -- canonical serialization of the exact outgoing request
What it contains. The exact bytes handed to the adapter — recipient, subject, body, connector code, and the connector's configuration fields used in the request.

When it is written. Same transaction as the attempt row, before the provider call. If the transaction commits, the snapshot exists. If it does not commit, no provider call happens.

What it is used for. Only during recovery. On an uncertain outcome or a crash-recovery scan, the snapshot is read to reconstruct the message for display, for the agent's confirmation, and for the communication record if the agent confirms delivery.

What it is not. Not synced. Not AI history. Not exposed in the UI except during the recovery flow. Local to the device.

Deletion. The snapshot is deleted in the same transaction that finalizes the attempt and commits any corresponding communication record.

Addendum 2 — II.13.2 and II.17.1, whole-blob data concurrency limitation
See II.13.2 for the full statement, and II.17.1 for the toggle-level statement. The limitation is documented, not fixed. Fixing it would change the frozen sync semantics for every data-carrying entity. Out of scope.

Addendum 3 — II.5.3, network-security implementation acceptance
See II.5.3.

II.21 Freeze record
Reviewer verdict: GO for freeze (2026-10-11).

The addendum resolves:

Immutable send-payload recovery (Addendum 1).

Whole-blob data concurrency limitation (Addendum 2).

TLS hostname verification and proxy handling (Addendum 3).

Next action: Slice 1 reconnaissance. Inspect the three code paths in II.17.4. No code before those are read.

End of Part II.

END COPY

================================================================
PART II — §II.3 AMENDMENT (added 2026-10-12, Slice 2 close)
================================================================

The local schema does not contain a payments table or a promises
representation. Part II §II.3 named fields that cannot be computed
from existing tables. Slice 2 substituted what can be computed.

This block records the substitution. It is additive. No other
Part II text changes.

Fields named in §II.3 and their Slice 2 disposition:

  debtor.amountRange
    Produced. Sum of unpaid debts in the debtor's primary currency,
    banded. Primary currency = most common among unpaid debts;
    ties broken alphabetically.

  debtor.daysOverdueRange
    Produced. Days from the oldest past-due unpaid debt's due date
    to the reference time, banded.

  debtor.debtOriginCategory
    Omitted. No local source.

  communicationHistory.{totalCount, emailCount, smsCount, voiceCount}
    Produced. Counts from communications. CALL maps to voiceCount.
    NOTE is excluded from email/sms/voice counts; it is still
    counted in totalCount.

  communicationHistory.responseRateBand
    Produced. inbound / outbound, both excluding NOTE. Bands:
    NONE (0 outbound), LOW (<0.2), MEDIUM (0.2..0.5), HIGH (>=0.5).

  paymentHistory.{totalCount, partialCount, missedCount}
    Substituted with debts.{totalCount, paidCount, overdueCount}:
      totalCount   = debts with status != 'CANCELLED'
      paidCount    = debts with status = 'PAID'
      overdueCount = non-paid, non-cancelled debts with a non-null
                     due date before the reference time

  indicators.paymentReliability
    Produced. paidCount / totalCount. Bands: NO_DATA (0 debts),
    POOR (<0.3), FAIR (0.3..0.7), GOOD (>=0.7).

  indicators.engagementLevel
    Produced. inbound / (inbound + outbound), both excluding NOTE.
    Bands: LOW (<0.2), MEDIUM (0.2..0.5), HIGH (>=0.5). Zero
    debtor-facing communications maps to LOW.

  indicators.communicationPreference
    Produced. Channel with the highest outbound count (excluding
    NOTE). Tie-break alphabetical: EMAIL < SMS < VOICE. Null when
    no outbound non-NOTE communications exist.

  indicators.promisesKeptRatio
    Omitted. No local source.

Subsequent slices (3 through 6) must validate against this shape,
not the original §II.3 shape. When payments and promises become
first-class local tables in a future slice, this amendment is
superseded by a new amendment that restores the original fields.

================================================================
END OF §II.3 AMENDMENT
================================================================

SLICE 5 — MINI SPEC v1.0 (FROZEN)
Strategy Engine lifecycle, send safety, and the Copilot UI.

Status: FROZEN 2026-10-13.
Authority: Part II §II.11, §II.12, §II.13.3.
Depends on: Slice 4 (frozen), Slice 1 (frozen), Slice 3 (frozen).
Supersedes: every prior Slice 5 draft (v0.1 through v0.5).
Does not reopen: Part I, CONNECTOR-EVENT-ORDER-SPEC, Slice 4, any frozen surface.

1. Goal
After Slice 5, the Agent can:

Trigger an AI analysis of a specific debtor from the debtor profile page.

Receive a persisted recommendation (PENDING initially; ACCEPTED on agent approval; REJECTED on discard).

Edit the drafted message, resolve fact-validation flags, and send it through the existing connector stack with all §II.11.3 preconditions enforced in Rust.

Survive a crash mid-send without leaving a communication row out of sync with the attempt record.

Recover from an uncertain send attempt by confirming or denying delivery.

See contact-limit enforcement applied to Copilot sends.

See the AI provider status page in the sidebar.

No cloud AI. No new sync events. No change to the connector stack. No new wire formats.

2. Scope discipline
In scope:

Local tables: recommendations (v11), send_reservations and send_attempts (v12).

Two new nullable columns on communications (v12): connector_code TEXT, send_attempt_id TEXT.

Persistence and lifecycle for recommendations.

Expiration snapshot with SHA-256.

The send command send_recommendation with the seven active preconditions.

Reservation-then-attempt pattern.

Startup recovery scan.

Contact-limit storage (existing compliance_rules columns) plus enforcement and per-device editor UI.

Copilot panel on the debtor profile.

Copilot status page in the sidebar.

Refusal semantics: if the AI connector is disabled mid-session, the analysis command returns a clear user-facing refusal.

Out of scope:

Sync of recommendations or attempts to other devices (§II.15).

Cross-device reconciliation of contact limits (§II.13.3).

New event types.

Any change to send_connector_message (the raw-send command).

The two-placeholder pattern (§II.4.8). Deferred.

Auto-retries.

Any quiet-hours enforcement (Part II §II.13.6).

Secure erasure of the payload snapshot from SQLite journals, WAL files, or storage media. This spec performs logical deletion only (sets the column to NULL). Physical erasure is a separate concern.

Multi-process access to the local Agent database. Slice 5 requires single-instance ownership of the Agent application (§7). If two instances can open the same SQLCipher file, the recovery contract below does not hold, and a lease-based protocol would be required — deferred.

3. Files
New (Rust, shared):

shared/src/recommendation_store.rs

shared/src/send_safety.rs

shared/src/copilot.rs

shared/tests/slice5_recommendation_store.rs

shared/tests/slice5_send_safety.rs

New (Rust, agent binary):

Six new #[command] fns in src-tauri-agent/src/main.rs.

If the Agent binary does not currently enforce single-instance, tauri-plugin-single-instance is added in Phase 5b. Precondition of Phase 5b's STOP gate.

New (TypeScript, agent-dashboard):

src/components/CopilotPanel.tsx + .css

src/components/CopilotFlagList.tsx + .css

src/pages/CopilotPage.tsx + .css

src/services/local.db.ts additions

Edited:

shared/src/db.rs — migration v11 (Phase 5a); migration v12 (Phase 5b).

shared/src/communications.rs — new insert_communication_in_tx(&Transaction, ...); existing insert_communication becomes a thin wrapper.

shared/src/lib.rs — three pub mod.

agent-dashboard/src/pages/DebtorProfilePage.tsx — mount CopilotPanel Card.

agent-dashboard/src/components/SendMessageModal.tsx — optional prefill prop.

agent-dashboard/src/components/Sidebar.tsx — one new nav item.

agent-dashboard/src/App.tsx — one new route.

Not touched: strategy.rs, fact_validation.rs, claim_resolution.rs, prompts.rs, any adapter, any sync module, src-tauri/src/main.rs.

Dependency added: sha2 = "0.10" in shared/Cargo.toml.

4. Decisions locked
Two-placeholder pattern. Deferred. Slice 5 ships without it.

Superseded definition. Any other PENDING or ACCEPTED recommendation for the same organization and debtor is superseded by a new insertion, inside the same transaction, by explicit status transition to REJECTED and superseded_by = new_id. No timestamp comparison.

Validation consumption. Rust re-runs validation against the exact final payload. Frontend resolution records are advisory.

Rationale/risk_flags. Columns on the recommendation row. risk_flags as a validated JSON array. Rationale labeled "AI explanation — unverified".

Contact-limit editor. Agent Settings page. Effective limit displayed read-only in the debtor Copilot panel.

Discard-from-ACCEPTED. Not offered in Slice 5. mark_rejected accepts only PENDING. After CONFIRMED_FAILURE, the recommendation returns to ACCEPTED and remains available for retry until expiry. Any future discard-from-ACCEPTED requires an explicit state-machine change.

5. Schema
5.1 Migration v11 — Phase 5a
sql
CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    ai_connector_code TEXT NOT NULL,
    created_by TEXT NOT NULL,

    source TEXT NOT NULL,                -- 'AI' | 'FALLBACK'
    channel TEXT NOT NULL,
    priority TEXT NOT NULL,
    tone TEXT NOT NULL,
    timing TEXT NOT NULL,
    draft_subject TEXT,
    draft_body TEXT NOT NULL,
    rationale TEXT,
    risk_flags TEXT NOT NULL DEFAULT '[]',
    prompt_version TEXT NOT NULL,

    status TEXT NOT NULL,                -- PENDING | ACCEPTED | REJECTED | SENT | EXPIRED | SEND_UNCERTAIN
    created_at DATETIME NOT NULL,
    decided_at DATETIME,
    superseded_by TEXT,

    snapshot_hash TEXT NOT NULL,

    FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
);
CREATE INDEX idx_recommendations_debtor
    ON recommendations(organization_id, debtor_id, created_at DESC);
CREATE INDEX idx_recommendations_org_status
    ON recommendations(organization_id, status);
Version gate: if current_version < 11 { ... PRAGMA user_version = 11 ... }. Transactional. Idempotent.

5.2 Migration v12 — Phase 5b
sql
CREATE TABLE IF NOT EXISTS send_reservations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    connector_code TEXT NOT NULL,
    channel TEXT NOT NULL,               -- 'email' | 'sms' | 'voice'
    reserved_at DATETIME NOT NULL,
    released_at DATETIME,
    release_reason TEXT                  -- 'CONVERTED' | 'RELEASED' | NULL
);
CREATE INDEX idx_send_reservations_window
    ON send_reservations(organization_id, debtor_id, channel, reserved_at);
CREATE INDEX idx_send_reservations_active
    ON send_reservations(organization_id, debtor_id, channel, released_at);

CREATE TABLE IF NOT EXISTS send_attempts (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL,
    reservation_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    connector_code TEXT NOT NULL,        -- the DELIVERY provider for this attempt
    attempted_at DATETIME NOT NULL,
    state TEXT NOT NULL,                 -- IN_PROGRESS | CONFIRMED_SUCCESS | CONFIRMED_FAILURE | UNCERTAIN
    finalized_at DATETIME,
    payload_snapshot BLOB,               -- NULL after terminal finalization
    FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE RESTRICT,
    FOREIGN KEY (reservation_id) REFERENCES send_reservations(id) ON DELETE RESTRICT
);
CREATE INDEX idx_send_attempts_state
    ON send_attempts(organization_id, state, attempted_at);
CREATE INDEX idx_send_attempts_recommendation
    ON send_attempts(organization_id, recommendation_id);

ALTER TABLE communications ADD COLUMN connector_code TEXT;
ALTER TABLE communications ADD COLUMN send_attempt_id TEXT;
CREATE INDEX idx_communications_send_attempt
    ON communications(organization_id, send_attempt_id);
Deletion contract (table comment):

A recommendation with a linked send attempt cannot be deleted. Every attempt is retained for the lifetime of its recommendation, in every state. Terminal attempts are not purged.

Consequence: deleting a debtor whose recommendations have linked attempts fails. This is the intended behavior: the system refuses to silently destroy the evidence of a send, whether confirmed, failed, or uncertain. The UI surfaces the constraint at the point of debtor deletion as Cannot delete: this debtor has send attempts on record.

Idempotence. Version-gated. Transactional. Each v11 and v12 block is preceded by a defensive column-existence check via PRAGMA table_info for any ALTER TABLE ADD COLUMN; if a column already exists, the corresponding statement is skipped. This is duplicate-column protection, not tamper detection. It does not verify type, nullability, or constraints.

6. Module recommendation_store.rs
6.1 Public types
rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecommendationStatus {
    Pending, Accepted, Rejected, Sent, Expired, SendUncertain,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecommendationRow {
    pub id: String,
    pub organization_id: String,
    pub debtor_id: String,
    pub ai_connector_code: String,
    pub created_by: String,
    pub source: StrategySource,
    pub channel: Channel,
    pub priority: Priority,
    pub tone: Tone,
    pub timing: Timing,
    pub draft_subject: Option<String>,
    pub draft_body: String,
    pub rationale: Option<String>,
    pub risk_flags: Vec<String>,
    pub prompt_version: String,
    pub status: RecommendationStatus,
    pub created_at: DateTime<Utc>,
    pub decided_at: Option<DateTime<Utc>>,
    pub superseded_by: Option<String>,
    pub snapshot_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoreError {
    NotFound,
    Superseded(String),
    Expired,
    WrongStatus {
        current: RecommendationStatus,
        expected: RecommendationStatus,
    },
    DbError(String),
}

pub const EXPIRATION_WINDOW_HOURS: i64 = 72;
6.2 Public functions
rust
pub fn insert_pending(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    ai_connector_code: &str,
    created_by: &str,
    outcome: &StrategyOutcome,
    now: DateTime<Utc>,
) -> Result<RecommendationRow, StoreError>;

pub fn get(conn: &Connection, org_id: &str, id: &str) -> Result<RecommendationRow, StoreError>;

pub fn list_for_debtor(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    limit: usize,
) -> Result<Vec<RecommendationRow>, StoreError>;

// Class A — user-driven transitions. Refuse a superseded row.
pub fn mark_accepted(conn: &mut Connection, org_id: &str, id: &str, now: DateTime<Utc>) -> Result<(), StoreError>;
pub fn mark_rejected(conn: &mut Connection, org_id: &str, id: &str, now: DateTime<Utc>) -> Result<(), StoreError>;

// Class B — attempt finalization transitions.
// pub(crate). Callable only from send_safety.
pub(crate) fn mark_sent(conn: &mut Connection, org_id: &str, id: &str, now: DateTime<Utc>) -> Result<(), StoreError>;
pub(crate) fn mark_send_uncertain(conn: &mut Connection, org_id: &str, id: &str, now: DateTime<Utc>) -> Result<(), StoreError>;

pub fn check_freshness(conn: &mut Connection, org_id: &str, id: &str, now: DateTime<Utc>) -> Result<(), StoreError>;

pub fn compute_snapshot_hash(conn: &Connection, org_id: &str, debtor_id: &str) -> Result<String, StoreError>;
6.3 insert_pending semantics
text
BEGIN.
1. new_id := Uuid::new_v4().
2. snapshot_hash := compute_snapshot_hash(conn, org_id, debtor_id)?.
3. UPDATE recommendations
     SET status = 'REJECTED',
         decided_at = ?now,
         superseded_by = ?new_id
     WHERE organization_id = ?
       AND debtor_id = ?
       AND id != ?new_id
       AND status IN ('PENDING', 'ACCEPTED').
4. INSERT INTO recommendations (...) VALUES (...).
COMMIT.
Supersession runs before the INSERT so the new id is available and the UPDATE cannot target the new row. Both statements commit together.

source mapped from StrategySource::Ai → 'AI', StrategySource::Fallback → 'FALLBACK'. Enum mappings by explicit match against canonical strings; any future variant added to those enums fails to compile here, which is the desired safety net.

risk_flags serialized with serde_json::to_string. Empty vec → '[]'.

6.4 Transition rules
Function	Class	Precondition on status	Precondition on superseded_by	New status
mark_accepted	A	PENDING	IS NULL	ACCEPTED, decided_at = now
mark_rejected	A	PENDING	IS NULL	REJECTED, decided_at = now
mark_sent	B	ACCEPTED	ignored	SENT, decided_at = now
mark_send_uncertain	B	ACCEPTED	ignored	SEND_UNCERTAIN, decided_at = now
Any status precondition failure → WrongStatus { current, expected }. A row with superseded_by IS NOT NULL on a Class A call → Superseded(new_id).

mark_rejected is PENDING-only. No in-flight guard is provided or needed: begin_send requires ACCEPTED, so a PENDING row cannot have a linked IN_PROGRESS attempt. After a CONFIRMED_FAILURE returns a recommendation to ACCEPTED, the recommendation is available for retry; it is not user-rejectable. Discard-from-ACCEPTED is not offered in Slice 5.

All transitions are scoped by (organization_id, id). Wrong-org id → NotFound.

6.5 check_freshness
text
1. Load row (org, id). Not found → NotFound.
2. If status = EXPIRED → return Err(Expired).
3. If status is not ACCEPTED or PENDING → return Ok(()) (freshness is only
   meaningful for sendable states).
4. current_hash := compute_snapshot_hash(current DB state).
5. If current_hash != row.snapshot_hash OR (now - row.created_at).num_hours() > 72:
     BEGIN.
     UPDATE recommendations SET status='EXPIRED', decided_at=?now
       WHERE organization_id=? AND id=? AND status IN ('ACCEPTED','PENDING').
     COMMIT.
     Return Err(Expired).
6. Return Ok(()).
The UPDATE commits before Err(Expired) is returned. A stale recommendation is not left apparently sendable.

6.6 Snapshot specification
Canonical JSON structure (keys alphabetical at every level; produced via serde_jcs::to_string):

json
{
  "amount_cents_total": <i64>,
  "communication_count": <i64>,
  "debt_status_counts": { "<STATUS>": <i64>, ... },
  "debtor_id": "<string>",
  "opt_out": { "email": <bool>, "sms": <bool>, "voice": <bool> }
}
Field sources:

amount_cents_total: sum of debts.amount for debts with status NOT IN ('PAID','CANCELLED') and currency == primary_currency, converted to cents. Primary currency matches context.rs: most common among unpaid debts; ties alphabetical. No unpaid debts → 0.

communication_count: COUNT(*) from communications for the debtor, all types including NOTE.

debt_status_counts: SELECT status, COUNT(*) FROM debts WHERE debtor_id=? GROUP BY status. BTreeMap; JCS sorts keys.

debtor_id: literal.

opt_out: from debtors.data.opt_out; missing keys false; malformed data → all three false. The snapshot is a data-reduction, not a policy decision; a stable conservative hash is the correct outcome.

Hash: sha2::Sha256 over the JCS-serialized bytes; hex lowercase, 64 chars.

Cents conversion:

rust
fn to_cents(amount: f64) -> Result<i64, StoreError> {
    const MAX_ABS_AMOUNT: f64 = 1_000_000_000_000.0;
    if !amount.is_finite() || amount.abs() > MAX_ABS_AMOUNT {
        return Err(StoreError::DbError(
            "debt amount outside supported range".to_string(),
        ));
    }
    Ok((amount * 100.0).round() as i64)
}
Sum uses checked_add; overflow → DbError("snapshot amount overflow"). Error messages never include the offending amount.

6.7 Module header
Documents: the Class A vs Class B distinction and the reason (attempt finalization must remain possible on a superseded row; user-driven transitions must not revive one); the snapshot canonical form and hash; the pub(crate) visibility of Class B helpers.

7. Module send_safety.rs
7.1 Single-instance precondition
Slice 5 requires at most one Agent process can open the local database at any time. Under this precondition:

At startup, any send_attempts row in IN_PROGRESS is, by definition, an orphan from a prior process that has exited. No timestamp threshold, no process identity.

At any other moment, there are no orphan IN_PROGRESS rows: every such row belongs to the current process and its provider call is either active or about to finalize.

The claim is "no other process can be running now," enforced by the plugin, not by a heuristic.

7.2 Types
rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttemptState {
    InProgress, ConfirmedSuccess, ConfirmedFailure, Uncertain,
}

pub struct AttemptRow {
    pub id: String,
    pub recommendation_id: String,          // NOT NULL
    pub reservation_id: String,
    pub debtor_id: String,
    pub organization_id: String,
    pub connector_code: String,
    pub attempted_at: DateTime<Utc>,
    pub state: AttemptState,
    pub finalized_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SafetyError {
    ContactLimitExceeded { limit: i64, window_hours: i64, current: i64 },
    RecommendationNotAccepted,
    RecommendationExpired,
    RecommendationSuperseded(String),
    OptOut { channel: Channel },
    ConnectorNotEnabled,
    AttemptNotConfirmable,
    AttemptNotFound,
    SnapshotMissing,
    SnapshotInvalid,
    InconsistentFinalizedState { attempt_id: String },
    DbError(String),
}

pub const RECOVER_AFTER_MINUTES: i64 = 30;  // retained for logging; not used as a filter
7.3 Public functions
rust
pub fn check_contact_limit(
    conn: &Connection,
    org_id: &str,
    debtor_id: &str,
    channel: Channel,
    now: DateTime<Utc>,
) -> Result<(), SafetyError>;

pub fn begin_send(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    recommendation_id: &str,
    connector_code: &str,
    payload_snapshot: &[u8],
    now: DateTime<Utc>,
) -> Result<(AttemptRow, String), SafetyError>;

pub fn finalize_success(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    created_by: &str,
    now: DateTime<Utc>,
) -> Result<String, SafetyError>;

pub fn finalize_failure(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError>;

pub fn finalize_uncertain(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError>;

pub fn confirm_delivered(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    created_by: &str,
    now: DateTime<Utc>,
) -> Result<String, SafetyError>;

pub fn confirm_not_delivered(
    conn: &mut Connection,
    org_id: &str,
    attempt_id: &str,
    now: DateTime<Utc>,
) -> Result<(), SafetyError>;

pub fn recover_at_startup(
    conn: &mut Connection,
    now: DateTime<Utc>,
) -> Result<u32, SafetyError>;

pub fn read_snapshot(
    conn: &Connection,
    org_id: &str,
    attempt_id: &str,
) -> Result<Vec<u8>, SafetyError>;
recover_at_startup takes no org_id: it scans the whole local database. The Agent may be single-org today, but recovery must not silently leave other orgs' attempts unresolved.

7.4 begin_send — two-phase freshness
text
Phase 1 (freshness check, separate committed transaction):

1. Load recommendation (org, id).
2. Recompute snapshot.
3. If snapshot changed OR window exceeded OR superseded:
     BEGIN.
     UPDATE recommendations SET status='EXPIRED', decided_at=?now
       WHERE organization_id=? AND id=? AND status='ACCEPTED'.
     COMMIT.
     Return Err(RecommendationExpired).
   Else proceed to Phase 2.

Phase 2 (transactional reservation + attempt):

BEGIN.
4. SELECT recommendation. Require status='ACCEPTED', superseded_by IS NULL.
5. Re-run check_opt_out → on block, rollback, Err(OptOut).
6. Re-run check_contact_limit → on block, rollback, Err(ContactLimitExceeded).
7. Re-verify connector ENABLED → on failure, rollback, Err(ConnectorNotEnabled).
8. INSERT reservation (released_at=NULL).
9. INSERT attempt (state='IN_PROGRESS', payload_snapshot=?).
COMMIT.
Return (AttemptRow, reservation_id).
The Phase 1 commit is deliberate: a stale recommendation is not left apparently sendable. The Phase 1 UPDATE is a no-op if the status is no longer ACCEPTED; the caller still receives RecommendationExpired. Failure at any Phase 2 step leaves no reservation and no attempt.

7.5 recover_at_startup
Runs once, after DB unlock and before any command can execute against the database (see §7.11).

text
BEGIN.
1. SELECT id, organization_id, recommendation_id FROM send_attempts
     WHERE state = 'IN_PROGRESS'.
   Under the single-instance precondition every such row is an orphan.
   No time, process, or organization filter.
2. transitioned := 0.
3. For each attempt:
   a. UPDATE send_attempts SET state='UNCERTAIN' WHERE id=?.
   b. transitioned += 1.
   c. Load recommendation (attempt.recommendation_id, attempt.organization_id).
      If not found → rollback, Err(InconsistentFinalizedState { attempt_id }).
      If recommendation.superseded_by IS NOT NULL: no status change.
      Else if recommendation.status = 'ACCEPTED':
        UPDATE recommendations SET status='SEND_UNCERTAIN' WHERE id=?.
      Else: no status change.
COMMIT.
Return transitioned.
Return value: the number actually transitioned from IN_PROGRESS to UNCERTAIN in this call. Idempotent: a second call selects zero rows. Never calls the provider.

A missing recommendation row is a data-integrity failure, not a normal case. Rollback, no silent skip, no partial recovery.

7.6 finalize_success and confirm_delivered — snapshot-derived
text
BEGIN.
1. Load attempt (org, id).
   finalize_success: require state IN_PROGRESS.
   confirm_delivered: require state UNCERTAIN.
   Idempotent case: if state is already CONFIRMED_SUCCESS, look up the
   linked communication and return its id. If none is found, return
   Err(InconsistentFinalizedState { attempt_id }).
2. Load snapshot. If NULL → rollback, Err(SnapshotMissing).
3. Parse with SendAttemptSnapshot::from_json (deny_unknown_fields).
   Any parse failure → rollback, Err(SnapshotInvalid).
4. Cross-record validation:
   a. snapshot.connector_code == attempt.connector_code.
   b. snapshot.recommendation_id == attempt.recommendation_id.
   c. snapshot.debtor_id == attempt.debtor_id.
   d. snapshot.debtor_id == reservation.debtor_id.
   e. channel_for_connector_code(snapshot.connector_code)
        == Some(channel_from(snapshot.channel)).
   f. attempt.organization_id == org_id
        == reservation.organization_id
        == recommendation.organization_id.
   g. recommendation.debtor_id == attempt.debtor_id.
   Any failure → rollback, Err(SnapshotInvalid).
5. Load recommendation. If superseded_by IS NOT NULL:
     do not change recommendation status.
   Else if recommendation.status = 'ACCEPTED':
     UPDATE recommendations SET status='SENT' WHERE id=?.
   Else:
     leave unchanged.
6. insert_communication_in_tx with:
     content     = snapshot.final_body
     subject     = snapshot.subject
     to          = snapshot.to
     connector_code  = attempt.connector_code
     send_attempt_id = attempt.id
     type        = channel_for_connector_code(attempt.connector_code)
7. UPDATE send_attempts
     SET state='CONFIRMED_SUCCESS', finalized_at=?now, payload_snapshot=NULL
     WHERE id=?.
8. UPDATE send_reservations
     SET released_at=?now, release_reason='CONVERTED'
     WHERE id=?.
COMMIT.
The communication body is taken from the snapshot, never from the frontend.

Snapshot structure:

rust
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SendAttemptSnapshot {
    pub to: String,
    pub subject: Option<String>,
    pub from: String,
    pub final_body: String,
    pub connector_code: String,
    pub channel: String,
    pub recommendation_id: String,
    pub debtor_id: String,
    pub created_at: String,
}
No credential or authorization token is in the snapshot. from is the sender address, not a secret. A unit test asserts the serialized snapshot JSON contains none of the credential bytes.

7.7 finalize_failure and confirm_not_delivered
text
BEGIN.
1. Load attempt (org, id). Require the relevant source state
   (IN_PROGRESS for finalize; UNCERTAIN for confirm).
   Idempotent case: already CONFIRMED_FAILURE → verify the reservation is
   released with release_reason='RELEASED'. Otherwise → Err(InconsistentFinalizedState).
2. Load recommendation.
3. If recommendation.superseded_by IS NOT NULL:
     UPDATE recommendations SET status='REJECTED', decided_at=?now WHERE id=?.
   Else:
     UPDATE recommendations SET status='ACCEPTED', decided_at=?now WHERE id=?.
4. UPDATE send_attempts
     SET state='CONFIRMED_FAILURE', finalized_at=?now, payload_snapshot=NULL
     WHERE id=?.
5. UPDATE send_reservations
     SET released_at=?now, release_reason='RELEASED'
     WHERE id=?.
COMMIT.
A superseded recommendation never silently returns to a usable state. The attempt is finalized; the recommendation remains REJECTED.

7.8 finalize_uncertain — supersession preserved
text
BEGIN.
1. Load attempt (org, id). Require state IN_PROGRESS. Already UNCERTAIN → no-op Ok.
2. UPDATE send_attempts SET state='UNCERTAIN', finalized_at=NULL WHERE id=?.
3. Load recommendation.
   If superseded_by IS NOT NULL: no status change (remains REJECTED).
   Else if status = 'ACCEPTED':
     UPDATE recommendations SET status='SEND_UNCERTAIN' WHERE id=?.
   Else: no status change.
4. Reservation retained.
COMMIT.
Explicit rule: a recommendation superseded while its attempt was in flight stays REJECTED after the attempt becomes UNCERTAIN. The attempt remains visible, retains its snapshot, and permits confirmation. The UI surfaces unresolved attempts independently of the recommendation's status.

7.9 Manual confirmation gate
confirm_delivered and confirm_not_delivered accept only state='UNCERTAIN'. Any other state → Err(AttemptNotConfirmable). Crash recovery flow: recover_at_startup first, then confirmation.

7.10 read_snapshot gate
Returns Err(SnapshotMissing) if the attempt's payload_snapshot IS NULL, and Err(AttemptNotConfirmable) if the state is not UNCERTAIN. It exists only for the recovery display flow. It is not a message-history API.

7.11 Single-instance startup contract
Required ordering in the Agent startup sequence:

Process launched.

Single-instance enforcement takes effect. If another instance already holds the app, this launch exits before touching any file.

SQLCipher database opened with its key.

run_migrations executes.

recover_at_startup runs.

Tauri command handlers become callable.

UI is enabled.

Invariant: no command that reads or writes send_attempts can execute before step 5 completes. The exact mechanism that enforces step 6 (tauri::Builder ordering vs. a startup state flag) is verified in reconnaissance at the start of Phase 5b. The contract requires the invariant; the implementation chooses the mechanism.

7.12 Contact-limit counting
Counts reservations where:

reserved_at >= now - {24|168|720}h from compliance_rules.contact_limit_period (DAY/WEEK/MONTH), AND

released_at IS NULL (held, including uncertain), OR

release_reason = 'CONVERTED' (successful contacts).

Excludes release_reason = 'RELEASED' (known failures).

All queries scope by organization_id first.

7.13 Idempotent finalization
All four finalization functions check state at step 1. If already in the target terminal state:

finalize_success / confirm_delivered on CONFIRMED_SUCCESS: return the linked communication id. If absent → Err(InconsistentFinalizedState).

finalize_failure / confirm_not_delivered on CONFIRMED_FAILURE: verify reservation released with release_reason='RELEASED'. Otherwise → Err(InconsistentFinalizedState).

finalize_uncertain on UNCERTAIN: no-op Ok.

Prevents duplicate communications and duplicate COMMUNICATION_LOGGED events.

8. Module copilot.rs
rust
pub fn analyze_debtor(
    conn: &mut Connection,
    org_id: &str,
    debtor_id: &str,
    model: &str,
    adapter: &dyn ConnectorAdapter,
    now: DateTime<Utc>,
) -> Result<RecommendationRow, CopilotError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CopilotError {
    AiConnectorUnavailable,
    NoDebtor,
    StoreError(String),
    DbError(String),
}
Flow:

Confirm at least one AI connector is enabled and can be constructed. If none → Err(AiConnectorUnavailable).

strategy::analyze(...).

recommendation_store::insert_pending(...) (which supersedes prior in the same transaction).

Return the row.

AI connector selection: first enabled connector in the catalog whose code is a registered AI provider, ordered gemini-ai, then openai-compatible, then any future entries in registration order. The selected code is recorded as ai_connector_code on the recommendation row.

analyze_debtor neither receives nor stores any process identity.

9. Command surface
Six new #[command] fns in src-tauri-agent/src/main.rs:

rust
#[command] fn analyze_debtor(debtor_id: String, app, state) -> Result<RecommendationRow, String>;

#[command] fn list_recommendations_for_debtor(
    debtor_id: String,
    app,
    state,
) -> Result<Vec<RecommendationView>, String>;

#[command] fn decide_recommendation(id: String, decision: String, app, state) -> Result<(), String>;

#[command] fn send_recommendation(
    input: SendRecommendationInput,
    app,
    state,
) -> Result<SendRecommendationResult, String>;

#[command] fn list_copilot_providers(app, state) -> Result<Vec<CopilotProviderRow>, String>;

#[command] fn confirm_uncertain_attempt(
    attempt_id: String,
    delivered: bool,
    app,
    state,
) -> Result<ConfirmResult, String>;
rust
pub struct SendRecommendationInput {
    pub recommendation_id: String,
    pub connector_code: String,          // DELIVERY provider
    pub to: String,
    pub subject: Option<String>,
    pub draft_body: String,              // raw, no disclosure applied
}

pub struct SendRecommendationResult {
    pub communication_id: Option<String>,
    pub attempt_id: String,
    pub uncertain: bool,
    pub failure_reason: Option<String>,
}

pub struct ConfirmResult {
    pub communication_id: Option<String>,
    pub attempt_id: String,
}

pub struct RecommendationView {
    pub row: RecommendationRow,
    pub uncertain_attempt_id: Option<String>,  // populated when an UNCERTAIN attempt is linked
}
list_recommendations_for_debtor returns every status, ordered created_at DESC. RecommendationView carries the optional uncertain attempt id so the UI can surface the confirm/deny buttons even when the recommendation is REJECTED.

confirm_uncertain_attempt carries no process identity, no body, no subject. Actor identity comes from get_user_id(app).

send_recommendation flow:

text
1. Load recommendation (org, id). Require ACCEPTED, not superseded.
2. Read disclosure_text from compliance_rules.
3. final_body := append_disclosure_idempotent(&input.draft_body, &disclosure_text).
4. validate_draft(conn, org_id, debtor_id, subject, final_body, 0).
   Block on Mismatch or Unverifiable. Verified flags do not block.
   (draft_id = 0: Slice 4's draft_id is UI-only bookkeeping for resolve_claim's
    stale-flag check. The send-time gate revalidates the exact final payload;
    the value is inert here.)
5. Read-only preflight: check_opt_out, check_contact_limit, connector enabled.
6. Read credential. Build adapter. Any failure → return Err, nothing written.
7. Canonicalize the exact final payload (to, subject, final_body, connector_code,
   from). begin_send handles Phase 1 freshness and Phase 2 reservation+attempt.
8. adapter.send(&SendRequest{ to, subject, from, body: final_body }).
9. On Ok(success=true)  → finalize_success(conn, org, attempt_id, user_id, now).
   On Ok(success=false) → finalize_failure(conn, org, attempt_id, now).
   On Err(_)            → finalize_uncertain(conn, org, attempt_id, now).
Bounded claim wording (module header):

The send-time gate enforces the implemented verification rules. It does not guarantee factual correctness in every possible draft. A claim that does not match a supported Slice 4 claim type is not detected, not flagged, not blocked. The absence of a blocking flag is not proof of truth.

"Sent via" in the UI reads from the communication row's connector_code, or from the linked send_attempt.connector_code. Never from recommendation.ai_connector_code. The two roles are distinct in the schema and never merged for display.

10. Preconditions
§II.11.3 lists eight. Slice 5 activates seven:

Recommendation exists with status ACCEPTED. ✓

Belongs to the current debtor. ✓

Not EXPIRED and not superseded. ✓

Final edited draft passes fact validation. ✓

Opt-out flags allow the send. ✓

Contact-limit configuration, if set, allows the send. ✓

Connector credential present and connector is ENABLED. ✓

~~Configuration-only-change window is not in progress.~~ Dropped.

Precondition 8's rationale: local-first architecture provides no "change pending" signal to the Agent. The Agent knows only that the DISABLED event has arrived or not. Once it arrives, precondition 7 covers the send. The window before arrival is a property of eventual consistency, not a condition this precondition can enforce. The runtime refusal at analyze_debtor (Q6) covers the analysis-time case; the send-time equivalent is precondition 7.

11. UI — Copilot panel (debtor profile)
Mounted as a new Card in DebtorProfilePage.tsx immediately after CommunicationCard.

Collapsed: header Copilot with chevron; subtitle AI drafts a message for {debtor.name}. Nothing is sent without your approval.

Expanded, pre-run: Analyze debtor button. Footnote: Recommendations expire 72 hours after creation.

Expanded, loading: spinner + Analyzing…

Expanded, PENDING:

Source badge: AI (blue) or Fallback — AI unavailable (amber).

Recommendation block: Channel, Priority, Tone, Timing.

Rationale (AI only): prefixed AI explanation — unverified:.

Draft: Subject + Body, Edit button.

Claim flags via CopilotFlagList.

Actions: Accept and Review (opens SendMessageModal prefilled) or Reject.

Footer: Expires {created_at + 72h}.

Expanded, ACCEPTED: Accepted. Edit and send from the composer, or let it expire.

Expanded, SENT: Sent via {connector_code} at {decided_at}.

Expanded, SEND_UNCERTAIN: amber message The provider did not confirm delivery. The message may or may not have been sent. Buttons Confirm delivered / Confirm not delivered.

Expanded, connector unavailable: Q6 message.

Unresolved attempt on a REJECTED recommendation: the panel displays a small amber sub-card: Unresolved send attempt from {attempted_at}. with the confirm/deny buttons. Uncertainty is visible even when the recommendation is not sendable.

Contact-limit footnote (read-only): if compliance_rules.contact_limit_enabled = 1, display Daily contact limit: {count} per {period} or equivalent. Otherwise No contact limit set.

12. UI — Copilot status page (sidebar)
New route /copilot, new sidebar entry between Communication Tools and Settings.

Sections: Header; Providers (list of enabled AI connectors, read-only); How it works (Part II §II.3 summary); What to expect (72h expiration; fallback labeling; unverified rationale; blocking claim types); Disclosure (from compliance_rules.disclosure_text or empty-state).

No actions.

13. Test inventory
Behavioral cases are the acceptance criterion. Counts are estimates.

slice5_recommendation_store.rs (~32 tests):

Persistence and round-trip (6); snapshot hash (8); lifecycle transitions (8); supersession (4); freshness (4); scoping and constraints (2). Specific behaviors:

insert_pending writes one row; every field round-trips.

Fallback source: source = FALLBACK, rationale = None, risk_flags = [].

AI source: source = AI, rationale present, risk_flags preserved.

Snapshot hash: 64-char lowercase hex; stable across identical state; changes on debt amount, debt status, communication count, opt-out flip; unchanged on a non-primary-currency debt.

to_cents overflow → DbError("debt amount outside supported range"); message does not contain the amount.

mark_accepted PENDING → ACCEPTED; on ACCEPTED → WrongStatus.

mark_rejected PENDING → REJECTED; on ACCEPTED → WrongStatus.

mark_sent ACCEPTED → SENT.

mark_send_uncertain ACCEPTED → SEND_UNCERTAIN.

Class A transitions refuse a superseded row.

Class B transitions ignore superseded_by and proceed.

All transitions with wrong org_id → NotFound.

Supersession: prior PENDING and prior ACCEPTED superseded by a new PENDING; prior REJECTED untouched; other debtor untouched; superseded_by recorded.

check_freshness passes on unchanged state; marks EXPIRED on amount change; marks EXPIRED on 72h window; Err(Expired) on already-EXPIRED with no re-write.

get wrong org → NotFound.

Cascade delete on debtor delete.

slice5_send_safety.rs (~44 tests):

Contact-limit disabled → Ok; below limit → Ok; at limit → Err.

Windows DAY / WEEK / MONTH.

Converted reservations count toward the limit; released (failed) do not; held (unresolved) do.

begin_send requires ACCEPTED; refuses expired, superseded, opt-out, connector disabled, contact-limit.

begin_send Phase 1 commits status='EXPIRED' before returning RecommendationExpired.

After Phase 1, the recommendation is not ACCEPTED in the DB.

begin_send happy path: reservation + attempt IN_PROGRESS.

begin_send on failure: no reservation, no attempt.

Snapshot round-trips via read_snapshot; read_snapshot on non-UNCERTAIN → error.

finalize_success: attempt CONFIRMED_SUCCESS; reservation CONVERTED; communication written with connector_code and send_attempt_id; COMMUNICATION_LOGGED originated; snapshot NULL; recommendation SENT.

finalize_failure: attempt CONFIRMED_FAILURE; reservation RELEASED; no communication; snapshot NULL; recommendation ACCEPTED.

finalize_uncertain: attempt UNCERTAIN; reservation held; snapshot retained; recommendation SEND_UNCERTAIN.

finalize_uncertain on superseded recommendation: attempt UNCERTAIN; recommendation stays REJECTED; snapshot retained.

recover_at_startup flips all IN_PROGRESS regardless of age.

recover_at_startup iterates across organizations.

recover_at_startup is idempotent within one call.

recover_at_startup returns the number actually transitioned.

recover_at_startup on missing recommendation → InconsistentFinalizedState, rollback, no partial.

confirm_delivered on UNCERTAIN: full finalize; snapshot NULL.

confirm_delivered on a superseded recommendation's UNCERTAIN attempt: communication written; recommendation stays REJECTED.

confirm_delivered on IN_PROGRESS → AttemptNotConfirmable.

confirm_not_delivered on a superseded recommendation's UNCERTAIN attempt: reservation released; recommendation stays REJECTED.

Cross-record validation: mismatched connector_code, recommendation_id, debtor_id (snapshot vs attempt), debtor_id (snapshot vs reservation), channel inconsistency, recommendation.debtor_id != attempt.debtor_id — each → SnapshotInvalid, no writes.

Snapshot JSON contains no credential bytes.

Idempotent finalize_success retry when the linked communication is missing → InconsistentFinalizedState.

Idempotent finalize_success retry when the linked communication exists → Ok with same id.

Idempotent finalize_failure retry → Ok with verification of released reservation.

No test calls adapter.send twice for the same attempt.

Migration re-run with columns already present → no-op.

Migration rollback path: forced failure after one ALTER → user_version unchanged, columns absent.

Orchestration tests (~10):

analyze_debtor with no AI connector enabled → AiConnectorUnavailable.

analyze_debtor with one enabled → PENDING row, correct source and ai_connector_code.

analyze_debtor supersedes prior.

send_recommendation on a draft with an unresolved Unverifiable claim → Err, no writes.

send_recommendation on a draft with a Verified claim → proceeds.

send_recommendation applies disclosure before validating the final body (assert the body sent contains disclosure and equals the validated body).

Two sequential insert_pending calls under simulated concurrency yield one PENDING.

send_recommendation with recommendation superseded between preflight and begin_send → RecommendationExpired or RecommendationNotAccepted, no reservation.

14. Phased implementation plan
Phase 5a — Recommendation persistence.
Files: recommendation_store.rs, migration v11 in db.rs, lib.rs, slice5_recommendation_store.rs. No command surface, no UI.
STOP gate: all tests green; PRAGMA user_version = 11; migration re-run safe; organization-scoped access verified; diff inspected.

Phase 5b — Send safety and orchestration.
Files: send_safety.rs, copilot.rs, migration v12 in db.rs, communications.rs refactor, six commands in agent binary, slice5_send_safety.rs. No UI.
First action: source reconnaissance on the Agent startup sequence. Verify single-instance enforcement is active and precedes database open; verify recover_at_startup is reachable before any command can execute against the database. If either fails, the recovery design reopens and a lease-based protocol is required.
STOP gate: all tests green; PRAGMA user_version = 12; migration re-run safe; snapshot lifecycle verified; disclosure and final-body validation enforced in Rust; no auto-retries; send_connector_message unchanged; single-instance verified; diff inspected.

Phase 5c — Copilot UI.
Files: all TypeScript.
STOP gate: cloud trip includes both npm run build commands; all six commands wired; frontend cannot bypass Rust checks; Slice 4 flag-resolution behavior consistent; live end-to-end test from Analyze → Send → SEND_UNCERTAIN simulation → Confirm delivered.

At every gate: inspect the actual diff, run the relevant tests, do not advance on the spec's word alone.

15. What this spec does not do
Does not define the two-placeholder pattern (deferred).

Does not sync anything new.

Does not add an event type.

Does not re-open Part I.

Does not touch any AI provider HTTP shape.

Does not change send_connector_message.

Does not guarantee factual correctness of drafts beyond the Slice 4 verification rules.

Does not guarantee secure erasure of snapshot bytes from SQLite journals, WAL files, or storage media.

Does not support multi-process access to the local Agent database.

16. First actions after freeze
Apply the corresponding removals to the Slice 5a mini spec's §5.4 and §5.7 (no forward-compatible in-flight guard; mark_rejected is PENDING-only). Freeze Slice 5a — MINI SPEC v1.0.

Begin Phase 5a: run its three verification checks, then write the test file.

Respect the Phase 5a STOP gate before beginning Phase 5b.

Phase 5b's first action is source reconnaissance on the Agent startup sequence and single-instance enforcement.

17. Open items
Phase 5b first action — source reconnaissance. Verify the single-instance plugin is active, enforcement precedes database open, and recover_at_startup runs before any command can touch send_attempts. If any of these fail, the recovery design reopens and a lease-based protocol is required. Until verified, the recovery contract in §7.5 is provisional.

Deletion semantics. The RESTRICT contract blocks debtor deletion while linked attempts exist. UI must surface the constraint. Documented; not a blocker.

Snapshot erasure. Logical deletion only. Physical erasure tracked as a separate concern in Part I §11.

APPENDIX — Revision history
v0.1 — Initial draft.

v0.2 — First review: migration split (v11/v12), claim-validation gate (blocking vs verified), UNCERTAIN-only manual confirmation, snapshot lifecycle, contact-limit counting, Rust-side disclosure, preflight ordering, deterministic supersession, org scoping.

v0.3 — Second review: payload_snapshot made nullable (logical deletion), process_run_id introduced, snapshot-derived confirmation, AI vs delivery provider identity separated (ai_connector_code vs connector_code), freshness commit-before-Err, supersession-aware finalization.

v0.4 — Third review: process_run_id removed in favor of a single-instance precondition; recover_at_startup replaces mark_stale_attempts_uncertain; recovery becomes startup-only; error-message hygiene; idempotent finalization consistency error.

v0.5 — Fourth review: send_attempts.recommendation_id made NOT NULL with ON DELETE RESTRICT; debtor_id added to SendAttemptSnapshot; recover_at_startup scans all organizations; startup ordering contract documented; Class A/B helper visibility enforced; retry integrity for all finalization paths.

v1.0 — FROZEN 2026-10-13 — Fifth review corrections: mark_rejected is PENDING-only (discard-from-ACCEPTED not offered); nullable-ID branch removed from recover_at_startup (missing recommendation is a hard error); recommendation-to-debtor cross-check added to finalization validation.

End of frozen specification.




================================================================
SLICE 5c - MINI SPEC v1.0 (FROZEN)
================================================================

Title: Copilot UI
Status: FROZEN 2026-10-14
Authority: Frozen Slice 5 spec Â§11 and Â§12; Part II Â§II.12.
Depends on: Slice 5b closed (six commands shipped and verified).
Does not reopen: Part I, Part II, Slice 5a, Slice 5b, any frozen surface.


1. GOAL

After Slice 5c, the Agent can:

- See a Copilot panel on the debtor profile page.
- Trigger an analysis, see a persisted recommendation, edit the
  draft, see advisory fact-validation flags, accept or reject.
- Send the accepted draft through a delivery connector via
  send_recommendation.
- Confirm or deny delivery when the send result is SEND_UNCERTAIN.
- See a status page under /copilot in the sidebar.

One new Rust command. No migration. No new sync events. No changes
to the six commands that shipped in 5b.


2. SCOPE

2.1 In scope

- New components: CopilotPanel.tsx, CopilotFlagList.tsx,
  CopilotPage.tsx (each with .css).
- Edits: DebtorProfilePage.tsx, SendMessageModal.tsx,
  Sidebar.tsx, App.tsx, local.db.ts.
- One new Tauri command: validate_draft_for_copilot. Registered
  in generate_handler!.
- Client-side regeneration counter (per debtor, per session).

2.2 Out of scope

- Any migration.
- Any change to the six commands that shipped in 5b.
- Claim resolution persistence. claim_resolution remains
  in-memory; 5c does not call it.
- Replacing SendMessageModal for the direct send path.
- Any AI-side change.
- Any change to send_connector_message.


3. PRE-FREEZE RECONNAISSANCE (RESOLVED 2026-10-14)

3.1 Claim flag display - Option A approved

One new command. Thin Tauri boundary over the existing Slice 4
validator. No parallel detection.

3.2 ClaimFlagView - resolved contract

Reconnaissance findings: ClaimType, ClaimSource, Verification,
ClaimFlag, and FactValidationError derive only Debug, Clone/Copy,
PartialEq/Eq. No serde derives anywhere. No Display impl on
FactValidationError.

Decision: manual mapping in main.rs. No derives added to Slice 4's
frozen enums.

    #[derive(serde::Serialize)]
    struct ClaimFlagView {
        claim_type: &'static str,        // "DollarAmount" | "CalendarDate" | "InvoiceRef"
                                         // | "PriorPromisePayment" | "LegalOrCreditConsequence"
        source: &'static str,            // "Subject" | "Body"
        span_start: usize,
        span_end: usize,
        matched_text: String,
        verification_kind: &'static str, // "Verified" | "Mismatch" | "Unverifiable"
        db_value: Option<String>,        // Some(...) for Verified/Mismatch; None for Unverifiable
        draft_id: u64,
    }

3.3 Command contract

    #[tauri::command]
    fn validate_draft_for_copilot(
        debtor_id: String,
        subject: Option<String>,
        body: String,
        app: tauri::AppHandle,
        state: tauri::State<AppState>,
    ) -> Result<Vec<ClaimFlagView>, String>;

- Org scoping from get_trusted_organization_id(&app). Never from
  the frontend.
- Calls fact_validation::validate_draft and nothing else.
- No tx.execute of any kind. Read-only query path.
- draft_id = 0. Inert - no freshness guarantee is claimed.
- Ok(vec![]) means "no flags detected." Err(String) means "the
  command failed." These must be distinguishable in the UI.
- Errors map via format!("{:?}", e).

3.4 Validation vs authorization boundary

Three invariants:

1. No state transition. The command cannot accept, reject,
   expire, or send. Read-only.
2. Not a green light. send_recommendation re-validates the exact
   final body after disclosure append. A clean panel result may
   still fail at send.
3. No pre-blocking. Accept remains available with flags present.
   The composer surfaces send_recommendation's error inline.

send_recommendation remains the authoritative enforcement boundary.


4. FILES

4.1 New (agent-dashboard)

- src/components/CopilotPanel.tsx + CopilotPanel.css
- src/components/CopilotFlagList.tsx + CopilotFlagList.css
- src/pages/CopilotPage.tsx + CopilotPage.css

4.2 Edited (agent-dashboard)

- src/services/local.db.ts - new TS interfaces and wrapper
  functions.
- src/pages/DebtorProfilePage.tsx - mount <CopilotPanel ...>
  after CommunicationCard.
- src/components/SendMessageModal.tsx - add mode and prefill
  props.
- src/components/Sidebar.tsx - one nav item between Communication
  Tools and Settings.
- src/App.tsx - one route /copilot.

4.3 Edited (Rust)

- src-tauri-agent/src/main.rs - one new #[command], one
  registration.

4.4 Not touched

- shared/src/send_safety.rs, shared/src/copilot.rs,
  shared/src/recommendation_store.rs, all sync modules, all
  adapters, shared/src/fact_validation.rs,
  shared/src/claim_resolution.rs.
- send_connector_message.


5. TYPESCRIPT TYPES

    export interface RecommendationView {
      id: string;
      organization_id: string;
      debtor_id: string;
      ai_connector_code: string;
      created_by: string;
      source: "AI" | "FALLBACK";
      channel: "Email" | "Sms" | "Voice";
      priority: "Low" | "Normal" | "High";
      tone: "Friendly" | "Firm" | "Urgent" | "FinalNotice";
      timing: "Within24Hours" | "Within3Days" | "Within7Days";
      draft_subject: string | null;
      draft_body: string;
      rationale: string | null;
      risk_flags: string[];
      prompt_version: string;
      status: "PENDING" | "ACCEPTED" | "REJECTED" | "SENT"
            | "EXPIRED" | "SEND_UNCERTAIN";
      created_at: string;
      decided_at: string | null;
      superseded_by: string | null;
      snapshot_hash: string;
      uncertain_attempt_id: string | null;
    }

    export interface SendRecommendationInput {
      recommendation_id: string;
      connector_code: string;
      to: string;
      subject: string | null;
      draft_body: string;
    }

    export interface SendRecommendationResult {
      communication_id: string | null;
      attempt_id: string;
      uncertain: boolean;
      failure_reason: string | null;
    }

    export interface ConfirmResult {
      communication_id: string | null;
      attempt_id: string;
    }

    export interface CopilotProviderRow {
      connector_code: string;
      tier: string;
      model: string | null;
    }

    export interface ClaimFlagView {
      claim_type: "DollarAmount" | "CalendarDate" | "InvoiceRef"
                | "PriorPromisePayment" | "LegalOrCreditConsequence";
      source: "Subject" | "Body";
      span_start: number;
      span_end: number;
      matched_text: string;
      verification_kind: "Verified" | "Mismatch" | "Unverifiable";
      db_value: string | null;
      draft_id: number;
    }

Note on enum serialization: channel, priority, tone, timing arrive
as Rust unit variant names - PascalCase strings - because 5b's
RecommendationView uses the default serde representation. 5c.0
confirmed this against shared/src/recommendation.rs which derives
serde::Serialize. If live JSON shows a different shape, update
this section before wiring the UI.


6. COPILOTPANEL STATE MACHINE

State            | Trigger                                | Content
-----------------+----------------------------------------+--------
Collapsed        | Default                                | Header "Copilot" + chevron. Subtitle: "AI drafts a message for {name}. Nothing is sent without your approval."
Not enabled      | list_copilot_providers() returns []    | "Copilot is not enabled. Ask your administrator." No Analyze button.
Pre-run          | Providers present, no recommendation   | "Analyze debtor" button. Footnote: "Recommendations expire 72 hours after creation."
Loading          | Analyze clicked                        | Spinner + "Analyzing...". Button disabled.
PENDING          | status="PENDING"                       | Source badge (AI blue / Fallback amber). Channel/Priority/Tone/Timing. Rationale (AI only) prefixed "AI explanation - unverified:". Subject + Body, Edit button. CopilotFlagList. Actions: "Accept and Review", "Reject". Footer: "Expires {created_at + 72h}". Regenerate button (up to 3 per session).
ACCEPTED         | status="ACCEPTED"                      | "Accepted. Edit and send from the composer, or let it expire." Draft and flags shown. "Open composer" button.
SENT             | status="SENT"                          | "Sent via {connector_code} at {decided_at}." Read-only.
EXPIRED          | status="EXPIRED"                       | Grey message. "Analyze debtor" available again.
SEND_UNCERTAIN   | status="SEND_UNCERTAIN" or             | Amber block: "The provider did not confirm delivery. The message may or may not have been sent." Buttons: "Confirm delivered" / "Confirm not delivered".
                 | uncertain_attempt_id present           |
REJECTED with    | status="REJECTED" and                  | Amber sub-card: "Unresolved send attempt from {attempted_at}." with confirm/deny buttons.
uncertain attempt| uncertain_attempt_id present           |

6.1 Live flag updates on draft edit

- Debounce: 300 ms after the last keystroke. No call while typing.
- Stale-response guard: each call carries a monotonic request_id
  (useRef<number>). A response is applied only if request_id ===
  latest_request_id.
- Cancel on unmount: useEffect cleanup increments
  latest_request_id.
- Empty vs error: Ok([]) shows "No claims detected." below the
  draft. Err(message) shows a red inline block "Could not validate
  draft: {message}." Previous flags remain visible with a visible
  "may be stale" indicator.

6.2 Regeneration

In PENDING state, a "Regenerate" button. Calls analyze_debtor
again; the prior recommendation is superseded by insert_pending
automatically. Counter is a useState keyed by debtor_id, cap 3,
client-side only, reset on panel unmount.

6.3 Loading and error states

Every command wrapped in try/catch. Errors render a red inline
block with the error string. No silent failures.


7. SENDMESSAGEMODAL INTEGRATION

Two new props:

    mode?: "direct" | "copilot";       // default "direct"
    prefill?: {
      recommendation_id?: string;
      subject?: string | null;
      body?: string;
      to?: string;
      connector_code?: string;
    };

Behavior:

- mode="direct" - unchanged. Calls sendConnectorMessage.
- mode="copilot" - on send, calls sendRecommendation({
  recommendation_id, connector_code, to, subject, draft_body }).
    - { uncertain: false, communication_id } - success toast,
      close, panel refreshes.
    - { uncertain: true } - close modal, panel shows
      SEND_UNCERTAIN. Attempt ID from result retained.
    - Err(...) - inline error, no panel change.
- Prefill populates connector, to, subject, body. User can edit.
- Disclosure preview: composer calls get_disclosure_text and
  appends client-side FOR PREVIEW ONLY. Rust backend remains
  authoritative and appends the disclosure itself inside
  send_recommendation. The frontend never sends the appended
  body. No double-append.
- Connector picker: reuse SendMessageModal's existing picker,
  filtered to enabled connectors matching the recommendation's
  channel.


8. COPILOTPAGE

Route /copilot, sidebar entry between Communication Tools and
Settings.

Sections, no actions:

- Header. "Copilot".
- Providers. Renders list_copilot_providers(). Table: connector
  code, tier, model. If empty: "No AI provider is enabled for
  this organization on this device."
- How it works. Static text summarizing the allowlist from Part
  II Â§II.3. Source of truth is that document.
- What to expect. Bullet list: 72-hour expiration; fallback
  labeling; rationale is unverified; fact-validation flag types
  block at send.
- Disclosure. Reads get_disclosure_text(). If non-empty,
  read-only block. If empty: "No disclosure text configured."


9. TEST INVENTORY

9.1 Executable - cloud trip

Both npm run build commands must pass:

- Root (C:\gorka-app) - Client.
- C:\gorka-app\agent-dashboard - Agent.

This is the type-check gate. No new frontend test file in 5c.

9.2 Live end-to-end (cloud trip)

1. Open debtor with no recommendation. Panel Pre-run.
2. Click Analyze. Loading -> PENDING.
3. Verify draft and flags render.
4. Edit draft, click Accept and Review. Composer opens prefilled.
5. Choose enabled email connector and send.
6. Case A: success - panel shows SENT with delivery connector code.
7. Case B: uncertain - SEND_UNCERTAIN, click "Confirm delivered".
   Panel SENT.
8. Case C: uncertain - SEND_UNCERTAIN, click "Confirm not
   delivered". Panel returns to ACCEPTED.
9. Reject path: fresh recommendation, click Reject. Panel
   REJECTED.
10. Regenerate path: click Regenerate 3 times. Fourth disabled.
11. Not-enabled path: disable AI connector on Client, sync, open
    panel. Shows not-enabled message.
12. Status page: navigate /copilot. All sections render.
12a. Edit draft, type currency token not in debts. Within ~1s,
     new flag appears. No send.
12b. Type fast 2 seconds. One validation call fires on final
     value.
12c. Force validation error. Panel shows red error block.
     Previous flags remain. Panel recovers.
12d. Accept with Mismatch flag. Composer opens. Send fails
     inline with the flag's matched_text.

9.3 Code-inspection checks

- validate_draft_for_copilot calls
  fact_validation::validate_draft and nothing else. No parallel
  detection.
- validate_draft_for_copilot performs no tx.execute of any kind.
- send_recommendation still calls validate_draft against the
  final body after disclosure append.
- SendMessageModal in direct mode calls only sendConnectorMessage.
- In copilot mode, calls only sendRecommendation. No path calls
  both.
- No component reads ai_connector_code for display as "sent via".
- The panel never calls mark_sent or mark_send_uncertain
  directly.
- useEffect cleanup cancels in-flight promise handlers on
  unmount.
- Accept button is never conditionally disabled on flag presence.


10. IMPLEMENTATION SEQUENCE

1. 5c.0 - Reconnaissance. COMPLETE 2026-10-14.
2. 5c.1 - TS types and service wrappers in local.db.ts. No UI.
3. 5c.2 - CopilotFlagList.tsx.
4. 5c.3 - CopilotPanel.tsx + .css.
5. 5c.4 - SendMessageModal.tsx prefill + mode.
6. 5c.5 - DebtorProfilePage.tsx mount.
7. 5c.6 - CopilotPage.tsx + Sidebar.tsx + App.tsx.
8. 5c.7 - Rust command validate_draft_for_copilot.
9. 5c.8 - Cloud trip: both npm run build passes; live
   end-to-end test.
10. 5c.9 - Appendix M. Written after the cloud trip passes.

No phase-level STOP gate. The gate is the cloud trip: both builds
pass AND live end-to-end test passes.


11. WHAT THIS SPEC DOES NOT DO

- Does not change the six commands that shipped in 5b.
- Does not implement claim resolution.
- Does not add a design system. Reuses existing primitives.
- Does not add frontend unit tests. Slice 5c is verified by build
  plus live test.
- Does not sync Copilot state across devices.
- Does not reopen Part I or Part II.


12. WHAT 5c DOES NOT DO WITH FLAGS

- Does not implement claim resolution. resolve_claim is not
  called.
- Does not persist resolution records.
- Does not track a draft_id version. Every flag call uses
  draft_id = 0.
- Does not add a "Resolve" button. Flags are informational in 5c.
- Does not disable Accept on flags.
- Does not block the composer's send button on flags.
  send_recommendation is the block.

If any of these turns out to be needed for the panel to be
useful, that is a separate slice with its own spec.


13. FOUNDER DECISIONS (LOCKED 2026-10-14)

1. Composer connector picker - CONFIRMED. Reuse
   SendMessageModal's existing picker, filtered to connectors
   matching the recommendation's channel. No parallel picker.
2. Disclosure preview - CONFIRMED. Client-side append via
   get_disclosure_text for preview parity. Rust backend remains
   authoritative and must not double-append.
3. Accept with claim flags - CONFIRMED. Accept remains available
   when flags are present. The panel informs; the send path
   validates and blocks.


14. REVIEWER VERDICT

GO - Slice 5c Mini Spec v1.0. Frozen 2026-10-14.

All six reviewer requirements captured:

1. Reuse existing validator; no parallel detection - Â§3.1, Â§9.3.
2. Exact flag-view schema from source - Â§3.2, Â§3.3.
3. No state-changing side effects - Â§3.4, Â§9.3.
4. Live updates with debounce and stale-response protection -
   Â§6.1.
5. Send-time validation authoritative - Â§3.4, Â§12.
6. Distinguish validation errors from valid empty result - Â§6.1.


END OF SLICE 5c MINI SPEC v1.0
================================================================

================================================================
PART III - SLICE 6 MINI SPEC v1.0 (FROZEN)
================================================================

Title:  Integrated Security and Regression Tests
Status: FROZEN 2026-10-14
Authority: Part II Section II.16
Depends on: Slices 1 through 5c closed (RESUME-HERE Appendix N)
Does not reopen: any frozen surface
Reviewer verdict: GO. Both conditions from the prior review
  addressed by Sections 3.2, 3.4, and 17.

================================================================
1. GOAL
================================================================

Close the Copilot block with cross-component integration
tests. Prove privacy, sync, concurrency, and send-safety
guarantees hold when the shipped pieces operate together.
No new features. One approved production extraction. Defect
fixes only for demonstrated defects.

================================================================
2. SCOPE
================================================================

2.1 In scope

  - Nine new integration-test files under shared/tests/.
  - One approved production extraction (Section 3.2).
  - Defect-driven fixes, each its own commit, each with
    evidence.
  - One close appendix in RESUME-HERE.md.

2.2 Out of scope

  - Any feature, event type, wire format, migration, or UI
    change.
  - Any change to send_connector_message.
  - Broad refactors. Only the extraction in Section 3.2.
  - Revision of frozen Slice 5 requirements.
  - Carried items from RESUME-HERE Appendix N.6.

================================================================
3. FROZEN CORRECTIONS
================================================================

3.1 Validation order - source-confirmed

send_recommendation (src-tauri-agent/src/main.rs 1188-1335),
verified against source:

  1199  load recommendation
  1202  read disclosure_text
  1205  final_body = append_disclosure_idempotent(raw, disclosure)
  1209  validate_draft(subject, final_body, draft_id=0)
  1218  block on Mismatch or Unverifiable
  1236  check_opt_out
  1239  channel_for_connector_code
  1241  check_contact_limit
  1244  read_local_connector_credential
  1252  build from
  1259  build ConnectorCredential
  1267  build adapter
  1269  build SendAttemptSnapshot
  1280  snapshot.to_json()
  1282  begin_send
  1299  adapter.send
  1302  match send_result
  1303    Ok(success)     -> finalize_success
  1314    Ok(!success)    -> finalize_failure
  1324    Err(_)          -> finalize_uncertain
  1335  return SendRecommendationResult

Slice 6 tests assert this order. A rejected draft leaves
zero rows in send_attempts and send_reservations.

3.2 Orchestration boundary - APPROVED EXTRACTION

Fact B, confirmed. The send sequence is owned by
send_recommendation (1188-1335). No shared orchestrator
exists.

Fix: new file shared/src/send_orchestration.rs with

  pub fn execute_send(
      conn: &mut Connection,
      org_id: &str,
      user_id: &str,
      input: SendRecommendationInput,
      now: DateTime<Utc>,
  ) -> Result<SendRecommendationResult, SendError>;

Move the body of send_recommendation (from line 1199 to line
1334) into execute_send. Move SendRecommendationInput and
SendRecommendationResult from src-tauri-agent/src/main.rs to
the shared crate. The Tauri command becomes a thin wrapper
that derives org_id and user_id from the trusted source and
delegates to execute_send.

Behavior-preserving extraction. The executable logic,
statement ordering, error behavior, transaction boundaries,
and function-level control flow remain unchanged. Only the
minimum module-boundary changes are permitted: use statements,
pub / pub(crate) visibility required by the new module
boundary, type-path updates resulting from the move, and the
Tauri wrapper delegating to execute_send. Any additional
change - reordering, refactoring, altered error strings, added
logging, changed function signatures beyond the move - is a
defect in the extraction and STOPs the extraction commit
pending approval.

Trusted identity. Org and user identity derivation remain in
the Tauri wrapper. get_trusted_organization_id(&app) and
crate::auth::get_user_id(app.clone()) are not moved. The
frontend never supplies either.

Credential hygiene in error strings. No credential-bearing
data is introduced into error strings or logs by the move.
Error strings are copied unchanged.

Approval status: approved as the smallest necessary testable
boundary. Any additional production change requires separate
approval.

Commit order: extraction is commit 1 of the slice, before any
test file.

3.3 Confirmed-only gap rule

Section 5 lists confirmed gaps only, each with a source cite.
Suspected gaps pending read are not acted on.

3.4 Pre-extraction baseline

Baseline recorded at HEAD 1ece566 (main, origin/main), the
commit at which this spec is frozen. This is the checkpoint
the extraction commit is measured against.

  HEAD commit hash         1ece566
  Workspace build          PASS (Finished, known benign warnings only)
  Workspace test           449 passed, 3 ignored, 0 failed
  Known warnings (benign)  gorka-recover linker PDB note
                           auth.rs::is_unlocked is never used
                           Vite __dirname configLoader warning
                           bundle size > 500 kB (frontend only)
  New npm build state      Client PASS, Agent PASS, at HEAD 99fb39b
                           (unchanged since; 1ece566 touched docs only)

Post-extraction expectation:

  cargo build --workspace  PASS, warnings unchanged
  cargo test --workspace   449 passed, 3 ignored, 0 failed, unchanged

If the post-extraction result differs from the baseline - any
new warning, any test count change, any failure - STOP.
Reconcile before proceeding. Do not adjust the expected count
to match the observed result. The baseline is a fact; the
expected count is derived from it.

Final workspace test after all new tests are added:

  cargo test --workspace  449 + N new tests, 0 failed
                          N determined by the test inventory as
                          implemented, not by the estimate in
                          Section 7.

All new test files are included in the workspace test command.
No test is run in isolation for the acceptance gate. Individual
test binaries may be run during development, but the acceptance
check is always cargo test --workspace.

================================================================
4. SLICE 6.0 - SOURCE VERIFICATION STATUS
================================================================

Complete. The following were read against source:

  - send_recommendation body (1188-1335)
  - send_safety.rs public and private surface, including
    begin_send (455-580) and recover_at_startup (582-697)
  - insert_communication_in_tx (communications.rs 70-165)
  - apply_entity_updated and reconcile_field /
    history_records write sites (sync_pipeline.rs 513-539,
    1000-1080)
  - check_opt_out and append_disclosure_idempotent
    (compliance.rs 165-224, 365-380)
  - SendAttemptSnapshot struct (send_safety.rs 144-154)
  - Cat 11 and Cat 12 test bodies (slice5_send_safety.rs
    604-960)

Cats 7, 9, 10 citations verified by name against the test
inventory. Assertions to be recorded in the close appendix.

================================================================
5. CONFIRMED GAP MATRIX
================================================================

| # | Req (II.16) | Existing test | Assertion as read | Gap | New test |
|---|---|---|---|---|---|
| 1.1 | Offline opt-out propagation | none | - | confirmed | slice6_offline_stale::client_opt_out_reaches_agent_and_blocks |
| 1.2 | Unrelated key preserved through sync blob | none | - | confirmed | slice6_offline_stale::unrelated_key_survives_entity_updated |
| 1.3 | Two-replica loser in history_records | none | - | confirmed | slice6_offline_stale::protocol_order_loser_recorded_in_history |
| 1.4 | Empty-blob round-trip | none | - | confirmed | slice6_offline_stale::empty_blob_round_trip |
| 1.5 | Clear-flag unblocks | partial (slice1_compliance::toggle_true_then_false_round_trip) | toggle round-trip only; no sync | partial | slice6_offline_stale::clear_opt_out_after_sync_unblocks |
| 2.1 | Multi-key blob through ENTITY_UPDATED | none | - | confirmed | slice6_opt_out_sync::multi_key_blob_preserved |
| 2.2 | Re-apply idempotent | none | - | confirmed | slice6_opt_out_sync::reapply_is_idempotent |
| 2.3 | Cross-org scoping | none | - | confirmed | slice6_opt_out_sync::cross_org_scoped |
| 2.4 | Per-channel independence | partial (slice1_compliance::opt_out_email_flag_does_not_block_sms) | local only | partial | slice6_opt_out_sync::per_channel_independence_through_sync |
| 3.1 | Two sequential begin_send same rec | none | - | confirmed | slice6_concurrency::second_begin_send_refuses |
| 3.2 | Two recs same debtor at limit | none | - | confirmed | slice6_concurrency::second_rec_contact_limit_blocked |
| 3.3 | Racing insert_pending deterministic | none | - | confirmed | slice6_concurrency::racing_insert_one_pending_one_superseded |
| 3.4 | Boundary n vs n+1 | partial (slice5_send_safety::contact_limit_at_limit_returns_error) | unit-level only | covered | - |
| 3.5 | Held vs released counting | covered (slice5_send_safety::contact_limit_converted_counts, _released_does_not_count) | - | - | - |
| 3.6 | busy_timeout lock path | covered (#[ignore] test exists) | - | - | - |
| 4.1 | Err -> finalize_uncertain chain | none | - | confirmed | slice6_provider_failures::err_chain_to_finalize_uncertain |
| 4.2 | Ok(false) -> finalize_failure chain | none | - | confirmed | slice6_provider_failures::failure_chain |
| 4.3 | Ok(true) -> finalize_success chain | none | - | confirmed | slice6_provider_failures::success_chain |
| 4.4 | No auto-retry after uncertain | none | - | confirmed | slice6_provider_failures::no_auto_retry |
| 4.5 | Second attempt blocked until resolved | none | - | confirmed | slice6_provider_failures::second_attempt_blocked |
| 5.1 | Malformed bytes -> SnapshotInvalid, rollback | none | - | confirmed | slice6_malformed::malformed_bytes_finalize_success_rolls_back |
| 5.2 | Malformed on finalize_failure | none | - | confirmed | slice6_malformed::malformed_bytes_finalize_failure_rolls_back |
| 5.3 | NULL snapshot -> SnapshotMissing | none | - | confirmed | slice6_malformed::null_snapshot_returns_missing |
| 5.4 | Missing field -> SnapshotInvalid | none | - | confirmed | slice6_malformed::missing_field_invalid |
| 5.5 | Cross-record mismatch (existing) | covered (3 tests) | error only | partial | slice6_malformed::cross_record_asserts_db_state |
| 6.1 | Altered draft blocks before begin_send | partial (slice4_fact_validation) | detect only | partial | slice6_altered_drafts::mismatch_blocks_before_begin_send |
| 6.2 | Unverifiable blocks | partial | detect only | partial | slice6_altered_drafts::unverifiable_blocks |
| 6.3 | Verified proceeds | partial | detect only | partial | slice6_altered_drafts::verified_proceeds |
| 6.4 | validated_equals_sent | none | - | confirmed | slice6_altered_drafts::frozen_order_validated_equals_sent |
| 6.5 | Rejected draft leaves 0 rows | none | - | confirmed | slice6_altered_drafts::rejected_leaves_zero_rows |
| 8.1 | Sentinel absent from payload_snapshot | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_snapshot |
| 8.2 | Sentinel absent from communications | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_comm |
| 8.3 | Sentinel absent from audit_log (block) | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_blocked_audit |
| 8.4 | Sentinel absent from audit_log (success) | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_insert_comm_audit |
| 8.5 | Sentinel absent from Err strings | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_err |
| 8.6 | Sentinel absent from read-model | none | - | confirmed | slice6_credential_leak::sentinel_absent_from_list_outputs |
| 8.7 | Positive control | none | - | confirmed | slice6_credential_leak::sentinel_present_in_credential_store |
| 11.1 | Full chain: begin -> Err -> uncertain -> confirm_delivered | partial (2 unit tests) | no chain | partial | slice6_uncertain::full_chain_to_confirm_delivered |
| 11.2 | Comm body equals snapshot body | none | - | confirmed | slice6_uncertain::comm_body_equals_snapshot |
| 11.3 | Superseded confirm_delivered keeps REJECTED | none | - | confirmed | slice6_uncertain::superseded_confirm_delivered |
| 11.4 | Superseded confirm_not_delivered keeps REJECTED | none | - | confirmed | slice6_uncertain::superseded_confirm_not_delivered |
| 11.5 | read_snapshot Some -> None | partial (read_snapshot_only_on_uncertain) | Some -> refuses | covered | - |
| 11.6 | Idempotent confirm x 2 | partial (finalize_uncertain_is_idempotent) | - | - | - |
| 11.7 | confirm_delivered on IN_PROGRESS -> AttemptNotConfirmable | partial (via read_snapshot_only_on_uncertain) | - | - | - |
| 12.1 | Multi-org scan | none | - | confirmed | slice6_crash_recovery::multi_org_scan |
| 12.2 | Missing recommendation rollback | none | - | confirmed | slice6_crash_recovery::missing_recommendation_rollback |
| 12.3 | Superseded recommendation untouched | none | - | confirmed | slice6_crash_recovery::superseded_recommendation_untouched |
| 12.4 | Snapshot retained post-recovery | none | - | confirmed | slice6_crash_recovery::snapshot_retained_post_recovery |
| 12.5 | Idempotent second call | covered (recover_at_startup_is_idempotent) | - | - | - |
| 12.6 | Confirm after recovery writes comm from snapshot | none | - | confirmed | slice6_crash_recovery::confirm_after_recovery_uses_snapshot |

Confirmed gaps: 38. Partial: 9. Covered: 10.

================================================================
6. TEST FILE LAYOUT
================================================================

Nine files, no tenth. Orchestration tests live inside
slice6_altered_drafts.rs and slice6_provider_failures.rs,
calling execute_send directly.

  1. slice6_offline_stale.rs       Cat 1
  2. slice6_opt_out_sync.rs        Cat 2
  3. slice6_concurrency.rs         Cat 3
  4. slice6_provider_failures.rs   Cat 4
  5. slice6_malformed.rs           Cat 5
  6. slice6_altered_drafts.rs      Cat 6
  7. slice6_credential_leak.rs     Cat 8 (priority, first)
  8. slice6_uncertain.rs           Cat 11
  9. slice6_crash_recovery.rs      Cat 12

================================================================
7. TEST INVENTORY
================================================================

Per Section 5. Total new: approximately 47 tests. Counts are
estimates; acceptance is by covered behavior. The final
implemented count N is recorded in the close appendix.

================================================================
8. FROZEN VALIDATION-ORDER INVARIANT
================================================================

  - No test asserts validate_draft before
    append_disclosure_idempotent.
  - frozen_order_validated_equals_sent is present in
    slice6_altered_drafts.rs.
  - A rejected draft leaves zero rows in send_attempts and
    send_reservations.

================================================================
9. ORCHESTRATION CONTRACT
================================================================

Section 3.2. Behavior-preserving extraction. No reordering.
Tests call execute_send. The Tauri command delegates. The
reviewer inspects the complete diff before accepting the
extraction commit.

================================================================
10. CREDENTIAL-LEAKAGE ASSERTIONS
================================================================

Sentinel-based. Absence asserted at every prohibited surface
(Section 5 rows 8.1 through 8.7). A positive control asserts
the sentinel is present in the credential store before the
call. Acceptance is absence from prohibited persisted
content, not merely one field.

================================================================
11. CONCURRENCY ASSERTIONS
================================================================

Transactional outcomes, not return values. begin_send uses
TransactionBehavior::Immediate (send_safety.rs line 469).
Where determinism is not achievable in-process, the test
asserts the sequential-order outcome and the limitation is
recorded in the close appendix.

================================================================
12. UNCERTAIN-OUTCOME LIFECYCLE
================================================================

Full sequences and both superseded paths (Section 5 rows 11.1
through 11.4).

================================================================
13. MALFORMED-SNAPSHOT ROLLBACK ASSERTIONS
================================================================

Error and resulting database state (Section 5 rows 5.1
through 5.5). Assertion of the returned error alone is
insufficient.

================================================================
14. EVIDENCE-BASED EXCLUSIONS
================================================================

Cats 7, 9, 10 receive no new file. The close appendix cites
the existing test name and the assertion read from source for
each requirement. If any requirement is not substantiated on
the final read, a new test is added despite the exclusion.

================================================================
15. DEFECT POLICY
================================================================

  - A test that fails against existing production code is a
    Slice 6 defect (FD6-NN).
  - Reproduce. Document: failing assertion, database state,
    git commit hash. Classify: bug / spec gap / test bug.
  - STOP. Request approval before fixing.
  - Each fix is its own commit, paired with the failing test
    that exposed it.
  - No silent scope expansion. No bundled cleanup. No
    unrelated refactoring.

================================================================
16. STOP GATES
================================================================

  G1  Slice 6.0 complete. DONE.
  G2  Spec frozen. Part III appended. Pushed. Before any code.
  G3  Extraction commit pushed, reviewed by diff against the
      Section 3.2 permitted-changes list.
  G4  Tests implemented in priority order:
        credential-leak
        altered drafts
        provider failures
        uncertain
        malformed
        concurrency
        crash recovery
        offline/stale
        opt-out sync
        exclusions
  G5  On test failure against production: STOP. Request
      approval before fixing.
  G6  Cloud verification (Section 17).
  G7  Close appendix.

================================================================
17. CLOUD VERIFICATION PLAN
================================================================

Cloud is the only cargo/npm-build machine (process rule P-G).

After the extraction commit only:

    cd /d C:\gorka-app
    git pull
    set TMP=C:\cargo-tmp
    set TEMP=C:\cargo-tmp
    call pilot-creds.bat
    cargo build --workspace
    cargo test --workspace

Baseline reference Section 3.4. Post-extraction expected
result matches the baseline exactly: 449 passed, 3 ignored,
0 failed. Any deviation STOPs the extraction.

Both npm builds are re-run because the extraction touches
Rust only; the frontend should be unchanged, but both builds
are part of the standard cloud trip (process rule P2).

    npm run build
    cd agent-dashboard
    npm run build
    cd ..

After the tests, with no further production change:

Same commands. Expected result: 449 + N new tests, 0 failed,
where N is the implemented count from the final test inventory.
The approximately 47 estimate in Section 7 is planning
guidance, not the acceptance criterion. Acceptance is by
behavior per Section 5.

If a defect fix was made:

Same commands, plus a focused live test of the changed
behavior. For a credential-leak fix: run a real send with the
sentinel credential, then read-only query the local DB and
audit log; assert zero matches. Not merely a successful send.

================================================================
18. WHAT THIS SPEC DOES NOT DO
================================================================

  - No new feature.
  - No new event type, wire format, migration, or UI change.
  - No OS-level multi-process concurrency test.
  - No literal subprocess crash test.
  - Does not reopen any frozen slice.
  - Does not revise Slice 5 requirements to fit the test plan.
  - Does not test what cannot be tested in-process.

================================================================
19. FOUNDER DECISIONS LOCKED
================================================================

  Q1  Tests first. One approved extraction. No speculative
      production changes.
  Q2  In-process replicas exercising the real sync-processing
      path. No OS-level multi-process simulation.
  Q3  Synthetic crash-state recovery via recover_at_startup.
      Accurate terminology: crash-state recovery semantics,
      not a literal process crash.
  Q4  Nine test files. No tenth.
  Q5  Cloud trip as the primary gate. Focused live test only
      if a defect fix was made.
  Q7  Append Part III to CONNECTOR-EVENT-ORDER-SPEC.md.
  Q8  Fact B confirmed. Extraction per Section 3.2.

================================================================
20. OPEN ITEMS CARRIED
================================================================

  OI-3  strategy::analyze silently discards AI-path failures.
  OI-4  fallback_outcome produces an empty draft.
  OI-6  decided_at renders full RFC 3339 with microseconds.
  Three unused-import warnings in slice5_send_safety.rs.
  O1    Ghost rows on the Agent (deferred by founder).
  O2    Communication Tools credential health.
  STEP 1.5  More known providers.
  STEP 1.6  Data-source display surface.
  CONNECTOR_CREDENTIAL_REPLACED.
  TWILIO SMS BYOP SEND VERIFICATION.
  B7 CREDENTIAL-TRANSIT REVIEW.
  CANCEL-NEGATIVE FOR TIER 1.
  REGISTRATION / ONBOARDING BLOCK.
  ACCEPTANCE - end-to-end.

================================================================
21. REVIEWER PRECONDITIONS - STATUS
================================================================

  1. Confirmed gaps against source. DONE (Sections 4, 5).
  2. Corrected disclosure/validation ordering. DONE (Section 3.1).
  3. Integration tests exercise real orchestration. DONE
     (Section 3.2). Extraction approved.

Conditions A and B from the prior review:

  A. Behavior-preserving extraction defined. DONE (Section 3.2).
  B. Pre-extraction baseline recorded. DONE (Section 3.4).

================================================================
22. REVISION HISTORY
================================================================

  v0.9  2026-10-14. DRAFT.
  v1.0  2026-10-14. Orchestration Fact B confirmed against
        source. Extraction proposed. Validation order
        source-confirmed. Snapshot surface source-confirmed.
        Gap matrix populated from source reads. Cat 3, 5,
        11, 12 gaps confirmed. Cat 4, 6 gaps confirmed.
        Sections 3.2 and 17 revised per reviewer Conditions
        A and B. Section 3.4 baseline added.

================================================================
23. FREEZE CONDITIONS
================================================================

All met. Freeze accepted on the conditions:

  1. This Part III appended to CONNECTOR-EVENT-ORDER-SPEC.md.
  2. Committed and pushed.
  3. Extraction commit landed and reviewed by diff.
  4. Extraction-stage build and test compared against the
     Section 3.4 baseline.
  5. Tests added in the Section 16 G4 order.

The extraction itself remains unverified until its diff and
its test results have been examined.

================================================================
END OF PART III - SLICE 6 MINI SPEC v1.0
================================================================

================================================================
24. ADAPTER INJECTION SEAM (amendment 2026-10-14)
================================================================

24.0 Why this amendment exists

Section 3.2's extraction made the send sequence testable
from shared/tests/. It did not make the adapter injectable.
As extracted, execute_send constructs its adapter internally
via build_default_registry() and calls adapter.send() on the
production adapter. Slice 6 test rows 4.1-4.5, 6.1-6.3,
8.1-8.7, and 11.1-11.4 require observing the orchestration's
response to specific adapter outcomes (Err, Ok(false),
Ok(true)) and to specific credential states, without making
network calls.

Discovered during Slice 6 test drafting, before any test was
written. STOP gate G5 in Section 16 was invoked. The reviewer
approved a narrowly scoped production change (Option B).

24.1 Approved change

Add a second public function in shared/src/send_orchestration.rs:

  pub fn execute_send_with_adapter(
      conn: &mut Connection,
      org_id: &str,
      user_id: &str,
      input: SendRecommendationInput,
      now: DateTime<Utc>,
      adapter: &dyn ConnectorAdapter,
  ) -> Result<SendRecommendationResult, SendError>;

execute_send(...) is unchanged as the production entry point.
Its body becomes a delegation:

  1. Load credential via read_local_connector_credential.
  2. Build ConnectorCredential.
  3. Build adapter via build_default_registry().factory(...).
  4. Call execute_send_with_adapter(..., adapter.as_ref()).

execute_send_with_adapter(...) owns the full orchestration.
Its body is the current body of execute_send, with two
changes:

  - the credential is still loaded (connector-enabled
    precondition preserved, and 'from' still extracted from
    configuration);
  - the adapter is not constructed; the injected
    &dyn ConnectorAdapter is used in place of the constructed
    one.

24.2 Contract

Behavior-preserving with respect to execute_send. The
following remain identical between the pre-change and
post-change execute_send paths:

  - Order of operations (recommendation load, disclosure
    append, validate_draft, check_opt_out,
    channel_for_connector_code, check_contact_limit,
    credential load, snapshot construction, begin_send,
    adapter.send, finalize_*).
  - Every error string.
  - Every transaction boundary.
  - The use of the loaded credential for the 'from' field.
  - The connector-enabled check via
    read_local_connector_credential returning Some.

The injected adapter MUST NOT bypass any precondition. Tests
that call execute_send_with_adapter still seed a real
local_connectors row, still require the connector to be
ENABLED, still pass through opt-out and contact-limit checks.

24.3 Test usage

Tests in slice6_provider_failures.rs, slice6_uncertain.rs,
slice6_altered_drafts.rs, and slice6_credential_leak.rs call
execute_send_with_adapter with a deterministic FakeAdapter
that:

  - implements ConnectorAdapter;
  - records the number of send() calls (for no-auto-retry
    assertions);
  - records the last SendRequest (for validated-equals-sent
    assertions);
  - returns a configurable outcome: Ok(success=true),
    Ok(success=false), or Err(ConnectorError).

The FakeAdapter makes no network calls.

24.4 Boundary between orchestration and adapter

Orchestration-level credential tests (slice6_credential_leak.rs)
prove that the credential does not reach the local persisted
surfaces (snapshot, communications, audit_log, error strings).
They do not prove what a real adapter sends over HTTP. That
boundary is covered by the adapter-level credential-leak
regression tests in slice3b_gemini.rs and slice3b_openai.rs,
which remain unchanged.

24.5 Commit and review

The change is a follow-up commit, not an amendment to the
extraction commit 5b48a00. Reviewed by diff against the
extraction commit. Reviewer inspects: signature change,
delegation body, preservation of every order and error
string. The extraction commit is not touched.

24.6 Spec acceptance criteria - unchanged

Section 5 rows 4.x, 6.x, 8.x, 11.x retain their acceptance
criteria. Option A (primitive-only coverage) is explicitly
rejected as a downgrade. Tests must exercise the full
orchestration via execute_send_with_adapter.

================================================================
END OF AMENDMENT - SECTION 24
================================================================

================================================================
SLICE 6 CLOSE - SPEC STATUS
(added 2026-10-15)
================================================================

Slice 6 is CLOSED. Status of Part III:

  Section 3.1  Validation order       - applied, verified
  Section 3.2  Extraction             - applied (5b48a00)
  Section 3.4  Baseline               - 449 / 3 / 0
  Section 5    Gap matrix             - all rows resolved
  Section 16   G1-G7 gates            - all passed
  Section 17   Cloud verification     - passed, EXIT=0
  Section 24   Adapter injection seam - applied (06f4c4b)

One defect found in the frozen spec itself, recorded here
and in RESUME-HERE Appendix O.4:

  Section 5 row 5.2 is over-specified. Malformed snapshot
  bytes on finalize_failure do not produce SnapshotInvalid.
  finalize_failure does not parse the snapshot (Slice 5
  spec Section 7.7). The test was corrected to assert the
  actual contract; the row 5.2 text stands as historical
  and is superseded by Appendix O.4.

  Revised row 5.2 text:
    "Malformed bytes on finalize_success -> SnapshotInvalid,
     rollback. Malformed bytes on finalize_failure -> no
     error; the failure path does not parse the snapshot,
     clears it, sets CONFIRMED_FAILURE, releases the
     reservation with reason RELEASED, writes no
     communication."

Final workspace test count after Slice 6:
  493 passed, 3 ignored, 0 failed.

================================================================
END OF SLICE 6 CLOSE - SPEC STATUS
================================================================


================================================================
PART IV - SLICE 8 MINI SPEC v1.0 (FROZEN)
================================================================

Status: FROZEN 2026-10-15
Authority: AGENT-APP-SPEC v1.3 Section 4
Depends on: Slices 1-7 closed. Gate 0 satisfied.
Companion to: Part I (connector event order), Part II
  (AI Copilot), Part III (Slice 6 integration tests).
  Part IV does not reopen any earlier Part.

Cloud baseline note: The recorded cloud result (493
passed, 3 ignored, 0 failed) was measured at commit
0b21c09. The commits between 0b21c09 and 7225765 are
docs-only (RESUME-HERE.md, spec file changes). Zero
Rust or TypeScript changed. The cloud result is
therefore valid for the code at the current HEAD.

================================================================
IV.0 - GATE 0 - RECOVERY INTEGRITY - PASSED
================================================================

| Item                          | Evidence                 |
|-------------------------------|--------------------------|
| Appendices F through Q present| O line 5226, P line 5557,|
|                               | Q line 5779              |
| Slice 6 close recorded        | commit 4a92fa0           |
| Slice 7 close recorded        | commit a174bd9           |
| Slice 8 reconnaissance        | commit 7225765           |
| Local HEAD matches origin/main| both at 7225765          |
| No open blocking defects      | none in N.6, O.7, P.4    |
| Cloud green at last known HEAD| 493 / 3 / 0 at 0b21c09   |

Gate 0 is satisfied. Slice 8 may proceed.

================================================================
IV.1 - GOAL
================================================================

Connect registration, authentication, local database
setup, enrollment, and organization management into
one end-to-end flow, without weakening the identity,
auth, or enrollment models already established.

  Website signup -> email verify -> download
    -> install Client Dashboard -> login -> unlock
    -> enable sync -> export enrollment package
    -> admin creates agent user
    -> install Agent Dashboard -> login -> unlock
    -> enroll -> shells work

================================================================
IV.2 - SCOPE
================================================================

IV.2.1 In scope

| Surface          | Items                                        |
|------------------|----------------------------------------------|
| Backend          | 4 edits to auth.ts + new users.ts + new      |
|                  | admin.ts                                     |
| Website          | 5 code changes + 1 new page + i18n strings   |
| Client Dashboard | 1 wizard + 1 page + Settings/Sidebar/App/    |
|                  | service edits                                |
| Agent Dashboard  | verify, wire only if needed                  |
| Owner Dashboard  | 1 page + 1 service + 1 edit                  |
| Deployment       | DNS + TLS + env + icons + app names          |

IV.2.2 Out of scope

  Stripe; phone verification; permissions system;
  sync protocol changes; local schema changes;
  multi-language beyond en/es; removing the dead
  Agent table.

================================================================
IV.3 - DECISIONS - LOCKED WITH EVIDENCE
================================================================

| #    | Decision            | Value                | Evidence                      |
|------|---------------------|----------------------|-------------------------------|
| C1   | Password flow       | Model 2              | Website already built for it  |
| C2   | enable_sync/export  | Wizard + Settings    | Founder                       |
| C3   | Owner Dashboard     | All orgs + counts    | Founder                       |
| C4   | Production API      | api.gorka.click      | Founder                       |
| C5   | Website location    | gorka-website/       | Founder                       |
| C6   | redirectUrl         | Remove entirely      | R1: 3 consumers, all with     |
|      |                     |                      | || '/' fallback; values are   |
|      |                     |                      | dev hostnames                 |
| C8   | Slice order         | C - dependency-      | Reviewer + founder            |
|      |                     | driven               |                               |
| Q.15 | Icon                | Red G, transparent,  | Founder                       |
|      |                     | Inter Bold, #DE1D1E  |                               |
| Q.16 | App names           | GORKA Client / Agent | Founder                       |
| Q.17 | Email filter        | Corporate only       | Founder                       |
| Q.18 | Card filter         | Deferred, note only  | Founder                       |
| Q.20 | User vs Agent       | User row only,       | R3: Agent table zero          |
|      |                     | role='AGENT'         | consumers. R6: DeviceReg FK   |
|      |                     |                      | to User. R5: no AGENT role    |
|      |                     |                      | check exists                  |
| -    | Permissions         | Placeholder          | Founder                       |
| -    | Phone verification  | Fields only          | Founder                       |
| -    | Agent creation      | Client Users page    | Founder                       |

================================================================
IV.4 - C8 - SLICE ORDER (RESOLVED)
================================================================

  8.3 -> 8.2 -> 8.4
  8.3 -> 8.5           (parallel with 8.2/8.4)
  8.1                  (parallel to all above)
  8.6                  (after 8.1)

Sequence:
  1. 8.3  backend endpoint + auth rules
  2. 8.2  Client wizard + Users page against
          defined contract
  3. 8.4  verify Agent enroll
  4. 8.5  Owner Dashboard (eligible after 8.3,
          may run parallel with 8.2/8.4)
  5. 8.1  website (parallel)
  6. 8.6  deploy (after 8.1)

Each slice STOP-gated. No downstream slice begins
before its prerequisites are verified.

================================================================
IV.5 - SLICE DETAIL
================================================================

IV.5.1 Slice 8.1 - Website + backend registration fixes

Backend (src/backend/routes/auth.ts):
  1. registerSchema.password becomes optional.
     Backend generates a random 32-byte placeholder
     hash. /complete-registration overwrites.
  2. Add POST /resend-verification. Body { email }.
     Rate-limited. Regenerates token, resends email.
     Generic 200 regardless of account existence
     (anti-enumeration).
  3. Zod .refine() on registerSchema rejecting the
     free-provider list (IV.9 Q.17). 400 with the
     disclosure message.
  4. C6: delete redirectUrl from /login (line ~481)
     and /complete-registration (line ~369). token
     field stays.

Website (gorka-website/):
  1. Register step 2: fetch target ->
     /api/auth/resend-verification.
  2. Register step 1: inline email-domain validation
     + disclosure message.
  3. Register step 1: card placeholder note.
  4. Register step 3 (page.tsx:145): replace
     router.push(data.data.redirectUrl || '/') ->
     router.push('/download').
  5. Login page (login/page.tsx:39): replace
     router.push(data.data.redirectUrl || '/') ->
     router.push('/download'). Resolution 1. The
     website has no CLIENT dashboard; download is
     the correct destination for a returning
     registrant.
  6. New page: app/[locale]/download/page.tsx per
     Q.19.
  7. i18n strings.

Owner-dashboard edit (part of 8.1 because C6
touches it):
  owner-dashboard/pages/LoginPage.tsx:49: replace
  window.location.href = data.data.redirectUrl ||
  '/' -> window.location.href = '/'.

Files touched:
  src/backend/routes/auth.ts
  gorka-website/app/[locale]/register/page.tsx
  gorka-website/app/[locale]/login/page.tsx
  gorka-website/app/[locale]/verify-email/page.tsx
    (wording fix)
  gorka-website/app/[locale]/download/page.tsx (new)
  gorka-website/messages/en.json
  gorka-website/messages/es.json (if translating)
  owner-dashboard/pages/LoginPage.tsx

IV.5.2 Slice 8.2 - Client Dashboard first-run +
       Settings

First-run wizard (SetupWizard.tsx, new):
  Triggered after first successful unlock when
  setup_completed flag absent from settings.dat.
    Step 1: Enable sync -> invoke('enable_sync').
    Step 2: Export enrollment package -> file save
            dialog + passphrase ->
            invoke('export_enrollment_package', ...).
    Step 3: Done -> write setup_completed: true,
            route to shell.
  Flag written only if all steps succeed. Failure
  leaves no flag; retry available.

Users page (UsersPage.tsx, new):
  Sidebar entry between Communication Tools and
  Settings.
  Lists org users.
  "Create agent" modal: email, name (optional),
  temp password. Calls POST /api/users/invite-agent
  (Slice 8.3).
  "Permissions - Coming soon" section.

Settings page (edit):
  Adds "Sync & Enrollment" card with the two
  buttons. Re-entry point.

Service layer (local.db.ts):
  enableSync(), exportEnrollmentPackage(),
  inviteAgent(), listUsers() wrappers.

Files touched:
  supervisor-dashboard/src/pages/SetupWizard.tsx
    (new)
  supervisor-dashboard/src/pages/SetupWizard.css
    (new)
  supervisor-dashboard/src/pages/UsersPage.tsx (new)
  supervisor-dashboard/src/pages/UsersPage.css (new)
  supervisor-dashboard/src/pages/SettingsPage.tsx
  supervisor-dashboard/src/components/Sidebar.tsx
  supervisor-dashboard/src/App.tsx
  supervisor-dashboard/src/services/local.db.ts

IV.5.3 Slice 8.3 - Backend agent-user endpoints

New file src/backend/routes/users.ts. Mounted at
/api/users.

POST /api/users/invite-agent:
  authenticateToken middleware.
  Inline role check:
    role === 'OWNER' || role === 'CLIENT'.
  Zod body: email, name?, tempPassword.min(8).
  organizationId = req.user.organizationId. Never
  from body.
  Reject if email exists (400).
  Creates User with role='AGENT',
  bcrypt(tempPassword, 12), isActive=true.
  Returns 201 { id, email, name, role }.
  Does not email the temp password. Admin delivers
  out of band. Documented in Users page UI text.
  No forced first-login change in MVP. Recorded as
  funded-phase.

GET /api/users:
  Same middleware, same inline role check.
  Scoped to req.user.organizationId.
  Returns array without passwordHash.

IV.5.4 Slice 8.4 - Agent Dashboard verify

Read-only verification, then wire only if needed:
  1. src-tauri-agent/src/main.rs generate_handler!
     contains import_enrollment_package.
  2. agent-dashboard/src/pages/EnrollPage.tsx calls
     invoke('import_enrollment_package', {
     passphrase, filePath }).
  3. agent-dashboard/src/App.tsx routes EnrollPage
     on first run.

If all three true: zero code changes. Document
verification in the close appendix.
If any false: minimal wire.

IV.5.5 Slice 8.5 - Owner Dashboard

New file src/backend/routes/admin.ts. Mounted at
/api/admin.

GET /api/admin/organizations:
  authenticateToken + inline role check:
    role === 'OWNER' || role === 'PLATFORM_OWNER'.
  Returns all organizations with:
    { id, name, clientType, contactEmail,
      contactPhone, verificationStatus, createdAt,
      lastActivity,
      agentCounts: { registered, online, offline },
      licenseStatus }
  agentCounts.registered:
    COUNT(User WHERE org=org.id AND role='AGENT')
  agentCounts.online:
    COUNT(DeviceRegistration WHERE org=org.id AND
          lastSeenAt > now()-5m AND isAuthorized=true).
    Zero if DeviceRegistration empty.
  agentCounts.offline: registered - online.
  lastActivity: Resolution 2 - MAX(User.lastLogin)
    across the org's users. MVP simplification.
    When DeviceRegistration is populated later,
    becomes MAX(GREATEST(lastLogin, lastSeenAt)).
  licenseStatus: status of most recent License row
    for the org, else "NONE". No invented semantics.
  Never returns debtor data or individual user
  names.

Owner Dashboard page
(owner-dashboard/pages/OrganizationsPage.tsx, new):
  Table: Name, Type, Contact, Created, Agents
  (reg/on/off), License.

IV.5.6 Slice 8.6 - Deployment

  Deploy website to www.gorka.click.
  Deploy backend to api.gorka.click.
  DNS + TLS.
  gorka-website/.env.production:
    API_BASE_URL=https://api.gorka.click
  Both Tauri builds:
    VITE_API_URL=https://api.gorka.click
  Rebuild with Q.15 icons and Q.16 names.
  Verify installed binaries (IV.6 item 8).

================================================================
IV.6 - PRE-FREEZE VERIFICATION ITEMS
================================================================

Each must be satisfied (or explicitly deferred with
reason) at implementation time.

  1. Placeholder password safety. Random placeholder
     discarded immediately. /complete-registration
     requires registration session cookie.

  2. Resend rate limiting + anti-enumeration.
     verifyEmailLimiter reused. Generic 200. No
     response-time disclosure.

  3. Temp-password handling. No email, admin
     delivers out of band. Documented in Users page
     UI.

  4. Organization boundary. Every user-mutation
     scoped to req.user.organizationId. Never from
     body.

  5. Missing role enforcement (new). No AGENT or
     CLIENT check exists today. Endpoints requiring
     admin-only add inline checks. Founder to
     decide if a shared requireOwnerOrClient
     middleware is worth the addition for two
     endpoints.

  6. Wizard failure semantics. setup_completed
     never written on partial success. Export only
     marked successful after invoke returns Ok.

  7. Owner Dashboard field definitions.
     lastActivity and licenseStatus per IV.5.5.

  8. Production config in installed binaries.
     Verify VITE_API_URL baked into both .exe files
     after 8.6.

================================================================
IV.7 - ACCEPTANCE CRITERIA
================================================================

Slice 8 is closed when:

   1. Corporate-email registration completes on
      www.gorka.click without devtools.
   2. Free-provider email rejected with disclosure.
   3. Verification email arrives; link works.
   4. Password set at step 3.
   5. Routed to /download.
   6. Both installers download and install on
      Windows.
   7. Client Dashboard opens; login + unlock work;
      wizard appears.
   8. Enable Sync writes to organization_keys.
   9. Export produces a package file.
  10. Admin creates agent user from Users page.
  11. Agent Dashboard opens; login + unlock work;
      enroll accepts package + passphrase.
  12. Both shells run without errors.
  13. Owner Dashboard lists new org with correct
      counts.
  14. redirectUrl absent from all production
      responses.

================================================================
IV.8 - CLOUD TRIP PLAN
================================================================

  Trip 1: after 8.3 + 8.2
  Trip 2: after 8.4 + 8.5 + 8.1
  Trip 3: deployment (8.6)

================================================================
IV.9 - REFERENCE VALUES
================================================================

Q.17 free-provider list (starter):
  gmail.com, googlemail.com, yahoo.com,
  yahoo.co.uk, ymail.com, outlook.com,
  hotmail.com, live.com, msn.com, aol.com,
  icloud.com, me.com, mac.com, protonmail.com,
  proton.me, mail.com, gmx.com, gmx.net,
  yandex.com, yandex.ru, zoho.com,
  tutanota.com, tuta.io

Q.18 card placeholder note:
  "Credit card details will be required at the
   funded stage. Prepaid and debit cards will not
   be accepted."

Q.19 download page content:
  Header: "Download GORKA"
  Version: v0.1.0
  System: Windows 10 / 11 (64-bit). macOS,
    Linux: coming soon.
  Buttons: Client Dashboard installer, Agent
    Dashboard installer (.exe).
  Install steps:
    1. Run the installer.
    2. Allow SmartScreen (see note).
    3. App opens to the Login screen.
    4. Enter your registered email and password.
    5. Set your local encryption password
       (first run only).
  SmartScreen note:
    "Windows may show 'Windows protected your PC'.
     Click More info -> Run anyway. The MVP binary
     is unsigned; signing comes at production."
  System requirements:
    Windows 10+, 4 GB RAM, 500 MB disk.
  User tip:
    "To enlarge desktop icon labels: Settings ->
     Accessibility -> Text size."

Q.20 - Agent table status:
  Model exists in schema. Zero code consumers.
  Not written by any code path in Slice 8.
  Candidate for removal or repurposing in a
  future slice.

================================================================
IV.10 - REVISION HISTORY
================================================================

  v0.1  2026-10-15  Initial draft. C6, C8, Q.20
                    open.
  v0.2  2026-10-15  C6 resolved (Option A).
                    Q.20 resolved (Option A).
                    New finding: missing role
                    enforcement. IV.6 added.
  v1.0  2026-10-15  C8 = C locked. Login routing
                    resolved. lastActivity =
                    MAX(User.lastLogin) resolved.
                    FROZEN.

================================================================
IV.11 - WHAT THIS PART DOES NOT DO
================================================================

  Does not reopen Part I, II, or III.
  Does not add Stripe.
  Does not add phone verification.
  Does not add a permission system.
  Does not remove the dead Agent table.
  Does not change the sync protocol.
  Does not change the local schema.
  Does not begin Agent App Phase 9.6+ work.

================================================================
END OF PART IV - SLICE 8 MINI SPEC v1.0
================================================================


================================================================
PART V - SLICE 8.7 MINI SPEC v1.0 (FROZEN)
================================================================

Title: Owner Dashboard Authentication
Status: FROZEN 2026-10-16
Authority: Part IV.5.5, corrected. Founder
  direction, 2026-10-16 session.
Depends on: Slices 1-7 closed; 8.2, 8.3, 8.4
  closed; 8.6.5 closed (PLATFORM_OWNER consolidated
  to OWNER).
Does not reopen: Part I, II, III, IV except for the
  corrections in V.4.

================================================================
V.1 - GOAL
================================================================

Only an OWNER can reach OD pages or OD backend
endpoints. Client and Agent tokens cannot be used
against the OD even if a role check is missing on
some endpoint, because OD tokens are signed with a
separate key.

================================================================
V.2 - SCOPE
================================================================

V.2.1 In scope

  - New env var JWT_SECRET_OD.
  - New middleware authenticateTokenOD.
  - New middleware requireRole.
  - Login branch: X-OD: 1 header triggers OD role
    gate and OD-signed token.
  - New endpoint GET /api/auth/me-od.
  - New bootstrap script prisma/seed-owner.ts.
  - Frontend gate in owner-dashboard/index.tsx
    ProtectedRoute.
  - Removal of the public /register route from OD.
  - services/api.ts sends X-OD: 1 on every request.
  - LoginPage.tsx sends X-OD: 1 on login.
  - Corrected role taxonomy (V.4).

V.2.2 Out of scope

  - Any OD data endpoint. The OD Data Bridge spec
    is separate.
  - SUPPORT and SUPPORT_AGENT behavior. Both are
    reserved names from GORKA-SUPPORT-SPEC v1.0.1.
  - Support <-> OD auth reconciliation. Follow-up
    spec.
  - Refresh tokens, revocation, MFA.
  - Password reset.
  - Anything in Client or Agent.

================================================================
V.3 - DECISIONS LOCKED
================================================================

D1. Role taxonomy (consolidated 2026-10-16).
    OWNER          - platform owner. One person.
                     Only role with OD access.
    CLIENT         - client-side org admin.
    AGENT          - client-side debt-collection
                     agent. Never reaches OD.
    SUPPORT        - reserved. Funded phase.
                     GORKA-SUPPORT-SPEC v1.0.1 Shape B.
    SUPPORT_AGENT  - reserved capability.
                     GORKA-SUPPORT-SPEC v1.0.1.
                     Not a role.

    PLATFORM_OWNER is retired. Slice 8.6.5 removed
    its last occurrence.

D2. OD gate is OWNER only.
    Part IV.5.5 wrote "OWNER || PLATFORM_OWNER".
    Both now collapse to OWNER. No client-side role
    reaches the OD.

D3. Separate JWT secret.
    JWT_SECRET signs Client and Agent tokens.
    JWT_SECRET_OD signs OD tokens.
    authenticateToken verifies against JWT_SECRET.
    authenticateTokenOD verifies against
    JWT_SECRET_OD.
    Tokens are cryptographically incompatible.

D4. Login selection by header.
    POST /api/auth/login with X-OD: 1 issues an
    OD-signed token, after confirming role = OWNER.
    Without X-OD, existing behavior is unchanged.

D5. OD auth endpoint.
    GET /api/auth/me-od verifies with JWT_SECRET_OD
    and requires role = OWNER.
    Returns the same shape as /api/auth/me.

D6. No public registration for the OD.
    Remove <Route path="/register" ...> from
    owner-dashboard/index.tsx.

D7. Bootstrap via CLI.
    prisma/seed-owner.ts creates or promotes a user
    to role = OWNER. Run once on cloud, once on
    production.

D8. Frontend gate.
    ProtectedRoute reads role from /api/auth/me-od.
    If role !== 'OWNER', token cleared, redirect
    /login.

================================================================
V.4 - CORRECTIONS TO PART IV
================================================================

Part IV.5.5 reads, as frozen:

  "GET /api/admin/organizations:
     authenticateToken + inline role check:
       role === 'OWNER' || role === 'PLATFORM_OWNER'."

Corrected text:

  "GET /api/admin/organizations:
     authenticateTokenOD + requireRole('OWNER').
     No client-side role reaches the OD."

Part IV stands otherwise. This section is the
authoritative correction.

================================================================
V.5 - FILES
================================================================

New (backend):

  src/backend/middleware/requireRole.ts

New (prisma):

  prisma/seed-owner.ts

Edited (backend):

  src/backend/middleware/auth.ts
    - Add authenticateTokenOD.
    - authenticateToken unchanged.
  src/backend/routes/auth.ts
    - Login handler: X-OD branch.
    - New GET /me-od handler.
  src/backend/index.ts
    - OD routes now require authenticateTokenOD and
      requireRole('OWNER').
    - Today only /api/admin exists. Other OD routes
      are placeholders when their endpoints arrive.
  src/backend/routes/support.routes.ts
    - No change in 8.7. Support uses shared JWT.
    - The support-OD auth reconciliation is a
      follow-up spec.

Edited (Owner Dashboard):

  owner-dashboard/index.tsx
    - ProtectedRoute: role check via /auth/me-od.
    - Remove /register route.
  owner-dashboard/pages/LoginPage.tsx
    - Send X-OD: 1 header on login.
  owner-dashboard/services/api.ts
    - fetchAPI sends X-OD: 1 header.

Docs:

  RECOVERY-RULES.md
    - Bootstrap procedure.
    - JWT_SECRET_OD in the secrets list.

================================================================
V.6 - BEHAVIOR CONTRACT
================================================================

Backend login (POST /api/auth/login):

  X-OD absent:
    Existing behavior. Unchanged.
  X-OD: 1:
    Verify credentials.
    If role !== 'OWNER':
      403 { success: false, error: 'Not authorized
            for Owner Dashboard' }.
    Else:
      Sign token with JWT_SECRET_OD, payload
      includes { userId, email, role, od: true }.
      Return { success: true, data: { user, token } }.

Backend auth middleware:

  authenticateToken:
    Verifies with JWT_SECRET. Sets req.user.
    Unchanged.
  authenticateTokenOD:
    Verifies with JWT_SECRET_OD.
    Requires payload.od === true.
    Sets req.user.
    Rejects otherwise with 401.

Backend /api/auth/me-od:

  authenticateTokenOD + requireRole('OWNER').
  Returns same shape as /api/auth/me.

Frontend ProtectedRoute:

  On mount:
    if no localStorage.gorka_token -> /login.
    else fetch ${API_BASE}/auth/me-od with
      Authorization: Bearer <token>
      X-OD: 1.
    if response not OK or role !== 'OWNER':
      clear localStorage.gorka_token.
      redirect /login.
    else render children.

Frontend fetchAPI (services/api.ts):

  Every request sends X-OD: 1.

Frontend LoginPage:

  POST ${API_BASE}/auth/login with X-OD: 1.

================================================================
V.7 - BOOTSTRAP PROCEDURE
================================================================

Once per environment:

  npx tsx prisma/seed-owner.ts <email> <password>

Effects:
  - If no user with that email: creates one with
    role=OWNER, isActive=true, no organizationId.
  - If a user exists: sets role=OWNER, overwrites
    password, sets isActive=true.
  - Password must be at least 8 characters.

Documented in RECOVERY-RULES.md.

================================================================
V.8 - ACCEPTANCE CRITERIA
================================================================

1. POST /api/auth/login without X-OD: unchanged.
2. POST /api/auth/login with X-OD: 1 and a CLIENT or
   AGENT account: 403, no token.
3. POST /api/auth/login with X-OD: 1 and an OWNER
   account: 200, token present.
4. GET /api/auth/me-od with the OWNER OD token:
   200, role=OWNER.
5. GET /api/auth/me-od with a CLIENT token: 401.
6. GET /api/admin/organizations with the OWNER OD
   token: 200 (endpoint exists after Slice 8.5).
7. GET /api/admin/organizations with a CLIENT
   token: 401.
8. GET /api/auth/me (non-OD) with the OWNER OD
   token: 403 or 401 - OD token is not valid against
   shared-JWT endpoints.
9. Browser: load OD without token -> /login.
10. Browser: load OD with CLIENT token in
    localStorage -> token cleared, /login.
11. Browser: load OD with OWNER OD token -> pages
    render.
12. /register removed from OD. Direct navigation
    redirects to /login.

================================================================
V.9 - IMPLEMENTATION SEQUENCE
================================================================

0. Verify requireRole.ts does not already exist.
   If it does, adapt. Do not overwrite.
1. backend middleware auth.ts: authenticateTokenOD.
2. backend auth.ts: /me-od endpoint.
3. backend auth.ts: /login X-OD branch.
4. backend middleware: requireRole.ts (if absent).
5. backend index.ts: rewire OD routes.
6. prisma/seed-owner.ts.
7. owner-dashboard/index.tsx: gate + remove
   /register.
8. owner-dashboard/pages/LoginPage.tsx: X-OD.
9. owner-dashboard/services/api.ts: X-OD.
10. RECOVERY-RULES.md updates.
11. Cloud trip.
12. Live: bootstrap OWNER on cloud, log in OD,
    verify /auth/me-od returns role=OWNER.

================================================================
V.10 - WHAT THIS PART DOES NOT DO
================================================================

  Does not build OD data endpoints.
  Does not implement SUPPORT or SUPPORT_AGENT.
  Does not reconcile support auth with OD auth.
  Does not add refresh tokens or revocation.
  Does not change Client or Agent behavior.
  Does not reopen Part I, II, III.
  Does not amend Part IV except for the V.4
  correction.

================================================================
END OF PART V - SLICE 8.7 MINI SPEC v1.0
================================================================