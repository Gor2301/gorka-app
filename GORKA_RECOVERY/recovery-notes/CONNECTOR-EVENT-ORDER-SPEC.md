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

