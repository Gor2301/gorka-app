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
