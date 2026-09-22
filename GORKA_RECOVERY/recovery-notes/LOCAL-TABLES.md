# GORKA LOCAL TABLES

**Version:** 1.2
**Date:** September 20, 2026 (v1.2 amendment applied)
**Purpose:** Freeze the list of local tables that belong in the Tauri
client's SQLite database.
**Authority:** Tauri Spec v3.2 is the authoritative source for the
non-sync local schema. SYNC-ARCHITECTURE.md v1.0 (frozen) is the
authoritative source for the sync tables (Category D) and for the
protocol invariants those tables represent. Where the two conflict
for a Category D table, SYNC-ARCHITECTURE.md wins.
**Companion:** This document mirrors CLOUD-TABLES.md for the local
data plane.

---

## The Permanent Rule

> The local SQLite database (Tauri app) contains ALL debtor-level
> data. It also caches customer/account data needed for offline
> operation, but the cloud is the source of truth for customer data.

---

## The Two Data Planes

| Plane | Runs on | Contains | Schema source |
|-------|---------|----------|---------------|
| Cloud | Supabase (PostgreSQL) | Customer data, aggregate metrics, connectors, support | `schema.cloud.prisma` |
| Local | Tauri (SQLite + SQLCipher) | All debtor data, operational caches | Rust (`src-tauri/src/db.rs`) |

**Important:** The local schema is implemented in Rust, not Prisma.
There is no `schema.local.prisma` that is executed. The Tauri spec
v3.2 code in `db.rs` is the real schema.

---

## Categories of Local Tables

### A. Debtor Operational Tables (Regulated — Core)

These are the tables that hold the actual debtor data.

### B. Connector Operational Tables

Local state for the connector subsystem.

### C. Cache / Mirror Tables

Local copies of cloud data for offline operation.

### D. Sync Operational Tables

State for the multi-user sync engine. Added in v1.2, September 17,
2026. See Category D below.

---

## Category A — Debtor Operational Tables

### A.1 debtors

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| organization_id | TEXT NOT NULL | From JWT / app state — never from client |
| name | TEXT NOT NULL | Debtor first name |
| surname | TEXT NOT NULL | Debtor last name |
| email | TEXT | Debtor email |
| phone | TEXT | Debtor phone |
| data | JSON NOT NULL | Extensible: address, contacts, occupation, collateral, guarantor, etc. |
| created_at | DATETIME | Default CURRENT_TIMESTAMP |
| updated_at | DATETIME | |
| deleted | TEXT | 'true' or 'false'. Monotonic. Added by v1.2 sync amendment. |

**Purpose:** Store individual debtor records.
**Cloud equivalent:** None. Forbidden in cloud.
**Indexes:** idx on `organization_id`, `name`, `surname`.

Source: Tauri spec v3.2 §5.

---

### A.2 debts

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| debtor_id | TEXT NOT NULL | FK → debtors(id) ON DELETE CASCADE |
| amount | REAL NOT NULL | Debt amount |
| currency | TEXT | Default 'USD' |
| status | TEXT | Default 'ACTIVE' |
| due_date | DATETIME | |
| description | TEXT | |
| data | JSON | Extensible |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Purpose:** Store individual debts per debtor.
**Cloud equivalent:** None. Forbidden in cloud.

Source: Tauri spec v3.2 §5.

---

### A.3 documents

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| entity_id | TEXT NOT NULL | FK → debtors(id) ON DELETE CASCADE |
| entity_type | TEXT NOT NULL | 'debtor' \| 'contact' \| 'guarantor' \| ... |
| file_name | TEXT NOT NULL | |
| file_path | TEXT NOT NULL | Local filesystem path |
| file_type | TEXT NOT NULL | MIME type |
| file_size | INTEGER | Bytes |
| category | TEXT NOT NULL | Enum: profile_photo, id_card, passport, etc. |
| description | TEXT | |
| uploaded_by | TEXT | User id |
| is_primary | BOOLEAN | Default 0 |
| data | JSON | Extensible |
| created_at | DATETIME | |

**Purpose:** Metadata for uploaded debtor-related files. File content
lives on the local filesystem (encrypted via SQLCipher? No — files
are separate, but access is gated by database unlock).
**Cloud equivalent:** None. Forbidden in cloud.

Source: Tauri spec v3.2 §5.

---

### A.4 communications

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| debtor_id | TEXT NOT NULL | FK → debtors(id) ON DELETE CASCADE |
| type | TEXT NOT NULL | 'CALL' \| 'EMAIL' \| 'SMS' \| 'NOTE' |
| direction | TEXT NOT NULL | 'INBOUND' \| 'OUTBOUND' |
| content | TEXT | Message body / call notes |
| duration | INTEGER | Call duration in seconds (nullable) |
| created_by | TEXT | User id |
| created_at | DATETIME | |
| deleted | TEXT | 'true' or 'false'. Monotonic. Added by v1.2 sync amendment. |

**Purpose:** Record every communication with a debtor.
**Cloud equivalent:** None. Forbidden in cloud.

Source: Tauri spec v3.2 §5.

---

### A.5 actions

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| debtor_id | TEXT NOT NULL | FK → debtors(id) ON DELETE CASCADE |
| type | TEXT NOT NULL | 'CALL' \| 'EMAIL' \| 'SMS' \| 'TASK' \| ... |
| status | TEXT | Default 'PENDING' |
| assigned_to | TEXT | Agent user id |
| due_date | DATETIME | |
| description | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| data | JSON | Extensible. Canonical JSON per SYNC-ARCHITECTURE.md §25.13.4. |
| deleted | TEXT | 'true' or 'false'. Monotonic. Added by v1.2 sync amendment. |


**Purpose:** Collection actions assigned to debtors.
**Cloud equivalent:** None. Forbidden in cloud.

Source: Tauri spec v3.2 §5.

---

### A.6 audit_log

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| action | TEXT NOT NULL | INSERT, UPDATE, DELETE, UPLOAD_DOC, etc. |
| details | TEXT | Human-readable, no PII |
| debtor_id | TEXT | Reference only — but the reference itself is local |
| record_count | INTEGER | |
| created_at | DATETIME | |

**Purpose:** Local audit trail for operational actions.
**Cloud equivalent:** None for debtor-related entries. Cloud has its
own separate `cloud_audit_logs` for customer-level actions.

Source: Tauri spec v3.2 §5.

---

## Category B — Connector Operational Tables

### B.1 local_connectors

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| connector_code | TEXT NOT NULL | Matches cloud `connector_catalog.code` |
| status | TEXT | 'CONNECTED' \| 'DISCONNECTED' |
| credentials_encrypted | TEXT | Local-only; BYO API keys |
| settings | JSON | User preferences |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Purpose:** Local connector configuration and BYO credentials.
**Cloud equivalent:** `client_connectors` (metadata only; no
credentials).

Source: Connector addendum.

---

### B.2 local_connector_usage

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| connector_code | TEXT NOT NULL | |
| operation_type | TEXT NOT NULL | 'SEND_SMS' \| 'SEND_EMAIL' \| 'AI_COMPLETION' \| ... |
| debtor_id | TEXT | FK → debtors(id) — null if not debtor-related |
| message_log_id | TEXT | FK → communications(id) if applicable |
| units_used | INTEGER | 1 for SMS; tokens for AI |
| unit_type | TEXT | |
| cost_estimate | REAL | |
| created_at | DATETIME | |

**Purpose:** Raw usage log per operation. Source of truth for
aggregation before sync.
**Cloud equivalent:** `connector_usage` (aggregate only — this table's
per-debtor detail never leaves local).

Source: Connector addendum.

---

### B.3 connector_sync_state

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4 |
| connector_code | TEXT NOT NULL UNIQUE | |
| last_synced_at | DATETIME | |
| last_synced_usage_id | TEXT | Last `local_connector_usage.id` flushed |
| pending_count | INTEGER | Number of unsynced records |

**Purpose:** Bookkeeping for incremental sync. Prevents data loss on
partial sync.

Source: Connector addendum.

---

## Category C — Cache / Mirror Tables

These tables are optional but recommended for offline-first operation.

### C.1 local_organization

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | Matches cloud organizations.id |
| name | TEXT | |
| client_type | TEXT | |
| website | TEXT | |
| registration_number | TEXT | |
| tax_id | TEXT | |
| address | TEXT | |
| contact_email | TEXT | |
| contact_phone | TEXT | |
| primary_contact | TEXT | |
| verification_status | TEXT | |
| synced_at | DATETIME | Last sync from cloud |

**Purpose:** Local mirror of the client's own organization record.
Enables offline display of business profile.
**Cloud source:** `organizations` table.
**Boundary:** Contains only the client's own data, not debtor data.

---

### C.2 local_user

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | Matches cloud users.id |
| email | TEXT | |
| name | TEXT | |
| role | TEXT | 'OWNER' \| 'CLIENT' \| 'AGENT' |
| organization_id | TEXT | |
| is_active | BOOLEAN | |
| last_login | DATETIME | |
| synced_at | DATETIME | |

**Purpose:** Local mirror of users in this organization. Enables
offline user display.
**Cloud source:** `users` table.
**Boundary:** No debtor data.

---

### C.3 local_templates

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | Matches cloud templates.id |
| name | TEXT | |
| subject | TEXT | |
| content | TEXT | Parameterized |
| channel | TEXT | |
| type | TEXT | |
| description | TEXT | |
| variables | TEXT | JSON array |
| status | TEXT | |
| organization_id | TEXT | Null for GORKA defaults |
| synced_at | DATETIME | |

**Purpose:** Local cache of templates for offline use.
**Cloud source:** `templates` table.
**Boundary:** Parameterized only. Rendered messages are stored
separately in `communications`.

---

## Category D — Sync Operational Tables

These tables support the multi-user sync engine defined in
SYNC-ARCHITECTURE.md v1.0 (frozen) and ARCHITECTURAL-LAW.md v1.3 §20.

They hold the device's own synchronization state. They never leave
the device in readable form. They synchronize with peer devices only
in encrypted form.

The distinction between the application audit_log (Category A.6) and
the sync engine's own tables is deliberate. The audit log is for
compliance and human review. The sync tables are the sync protocol's
working memory. They serve different purposes and must not be merged.

This document represents protocol state; it does not define protocol
semantics. Where a question arises about the meaning of a field
(for example, what a watermark means, or how the gap set is
interpreted), the answer is in SYNC-ARCHITECTURE.md, not here.

---

### D.1 sync_events

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v7 (binary form stored as TEXT). The event_id. |
| organization_id | TEXT NOT NULL | From JWT / app state — never from client |
| device_id | TEXT NOT NULL | The origin device instance that produced this event |
| event_type | TEXT NOT NULL | See event types below |
| entity_type | TEXT NOT NULL | 'debtor' \| 'action' \| 'communication' |
| entity_id | TEXT | Reference to the affected record |
| payload | BLOB NOT NULL | The canonical wire serialization of the event payload (see SYNC-ARCHITECTURE.md §22) |
| sequence | INTEGER NOT NULL | Monotonic per origin device (SYNC-ARCHITECTURE.md §11) |
| logical_clock | INTEGER NOT NULL | Lamport logical clock value (SYNC-ARCHITECTURE.md §12) |
| created_at | DATETIME NOT NULL | Origin device's wall-clock timestamp. Informational. |
| local_received_at | DATETIME NOT NULL | Local wall clock at the time this device accepted the event. Informational. |

**Purpose:** The append-only record of every valid event this device
has **originated or accepted**. Events are never modified and never
deleted. This table is the sync protocol's source of truth.

**MVP event types:**

- `DEBTOR_CREATED`
- `ENTITY_UPDATED`
- `ACTION_CREATED`
- `COMMUNICATION_LOGGED`

**Later event types (funded phase):**

- `PAYMENT_RECORDED`
- `PROMISE_CREATED`
- `PROMISE_BROKEN`
- `CALL_LOGGED`
- `SMS_SENT`
- `EMAIL_SENT`
- `NOTE_ADDED`
- `STATUS_CHANGED`
- `CONTACT_ATTEMPTED`

**Invariants (SYNC-ARCHITECTURE.md §25.5.3):**

- Append-only. Rows are never updated or deleted.
- `id` is unique across all rows.
- `(device_id, sequence)` is unique across all rows.
- Locally-originated events form a strictly monotonic sequence per
  origin device.
- Received events retain their origin `device_id` and `sequence`,
  not the receiving device's.
- The canonical wire serialization of the event can be reproduced
  exactly from the stored row.

**Cloud equivalent:** None. Never leaves the device in readable form.

**Indexes:** `organization_id`, `device_id`, `sequence`,
`(device_id, sequence)` unique, `created_at`.

**Source:** SYNC-ARCHITECTURE.md §9, §11, §12, §25.5.

---

### D.2 sync_state — Local Device Protocol State

One row per device. Holds the device's own protocol counters.

| Field | Type | Notes |
|-------|------|-------|
| device_id | TEXT PRIMARY KEY | The local device instance identifier. |
| organization_id | TEXT NOT NULL | From JWT / app state — never from client. |
| sequence_counter | INTEGER NOT NULL DEFAULT 0 | Highest sequence number committed by this device (SYNC-ARCHITECTURE.md §11.4). |
| logical_clock | INTEGER NOT NULL DEFAULT 0 | This device's Lamport logical clock counter (SYNC-ARCHITECTURE.md §12.3). |
| updated_at | DATETIME | Local wall clock. Informational. |

**Purpose:** Holds the local device's sequence counter and logical
clock, plus its own identity. These are the two durable protocol
counters defined in SYNC-ARCHITECTURE.md.

**One row per device.** Not per peer, not per origin.

**Invariants (SYNC-ARCHITECTURE.md §25.6.3):**

- `sequence_counter` is monotonic. It never decreases.
- `logical_clock` is monotonic. It never decreases.
- Both values survive process restarts.

**Cloud equivalent:** None.

**Source:** SYNC-ARCHITECTURE.md §11.4, §12.3, §25.6.1.

---

### D.3 sync_delivery — Per-Peer, Per-Origin Delivery Bookkeeping

One row per `(local_device, peer, origin)` triple. Tracks how much
of each origin's event stream has been acknowledged by each peer.

| Field | Type | Notes |
|-------|------|-------|
| local_device_id | TEXT NOT NULL | This device. Composite key part. |
| peer_device_id | TEXT NOT NULL | The peer. Composite key part. |
| origin_device_id | TEXT NOT NULL | The origin of the sequence stream. Composite key part. |
| organization_id | TEXT NOT NULL | From JWT / app state. |
| watermark | INTEGER NOT NULL DEFAULT 0 | Highest sequence number N such that every event from `origin_device_id` with sequence ≤ N has been acknowledged by `peer_device_id`. |
| gap_set | TEXT NOT NULL DEFAULT '' | Sparse acknowledged-sequence set above the watermark. Serialization defined below. |
| updated_at | DATETIME | Local wall clock. Informational. |

**Primary key:** `(local_device_id, peer_device_id, origin_device_id)`.
No UUID surrogate. The natural identity of the row is the triple.

**Purpose:** The protocol's delivery bookkeeping. For a device with N
peers and M origins (including the local device's own origin), this
table holds up to N × M rows. This is what allows the hub to forward
one spoke's events to another spoke: the hub tracks
`(peer = spoke2, origin = spoke1)` as a distinct row.

**`gap_set` serialization:**

- Empty string `""` means the empty set.
- Otherwise: ascending, unsigned decimal integers, comma-separated.
- No whitespace. No leading zeros. No signs.
- Example: `"3,4,7,9"`.
- Canonical form is required. `"03,4"` and `"3, 4"` are invalid.

**Semantic meaning of `gap_set`:** As defined in
SYNC-ARCHITECTURE.md §18.2. This schema stores the values; it does
not interpret them.

**Invariants:**

- `watermark` is monotonic per row. Never decreases.
- If a sequence number S is below the watermark for a row, S is not
  in that row's `gap_set`.
- Rows are created lazily. A row exists when there is state to
  record for that triple.

**Indexes:** primary key on the composite triple; secondary index on
`(local_device_id, peer_device_id)` for per-peer queries.

**Cloud equivalent:** None.

**Source:** SYNC-ARCHITECTURE.md §17.5, §18.2, §25.6.1.

---

### D.4 sync_peers — Peer Relationship and Cache

Local cache of the peer devices this device knows about, for the
sync indicator UI, reconnection, and per-peer relationship state.

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT PRIMARY KEY | UUID v4. Same value as the peer's device_id. |
| organization_id | TEXT NOT NULL | |
| peer_name | TEXT | Human-readable label, e.g. "Admin's laptop". |
| peer_type | TEXT | 'HUB' \| 'SPOKE'. **Current topology metadata only.** See note below. |
| role | TEXT | 'CLIENT' \| 'AGENT'. Cache of the peer's role. |
| status | TEXT | Current relationship state. See vocabulary below. |
| last_seen_at | DATETIME | Last observation or contact of the peer. |
| last_successful_sync | DATETIME | Last successfully completed synchronization with this peer. |
| last_endpoint | TEXT | Most recent announced network address, for reconnection. |
| is_trusted | BOOLEAN DEFAULT 1 | Local cache of the last Control Plane device_registrations check. Not authoritative. |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Purpose:** Local view of each known peer. Holds the current
relationship state, the last successful sync timestamp, and cached
metadata for reconnection and display.

**`status` vocabulary** (SYNC-ARCHITECTURE.md §26.2):

- `UNKNOWN`
- `CONNECTING`
- `IN_SYNC`
- `PENDING`
- `OFFLINE`
- `ERROR`

**Note on `peer_type`:** The hub/spoke distinction is **current
topology configuration**, not a data-model identity. Per
SYNC-ARCHITECTURE.md §2 and §3, the protocol must not treat the hub
as permanently special, and no protocol logic may branch on this
column. It exists for the UI and for configuration display only.

**Note on `role`:** A cached value from Control Plane metadata. It
is not a cryptographic authorization. Cryptographic authorization in
the MVP is possession of the organization key.

**Note on `is_trusted`:** A local cache of the last check against
the Control Plane's `device_registrations`. The authoritative check
happens at session establishment (SYNC-ARCHITECTURE.md §8.6). This
column is a convenience for the UI; the protocol does not rely on it.

**Distinction between `last_seen_at` and `last_successful_sync`:**
`last_seen_at` records the last observation or contact of the peer.
`last_successful_sync` records the last successfully completed
synchronization. A peer can be seen without a successful sync having
occurred, and vice versa if contact has gone stale.

**Cloud equivalent:** Control Plane `device_registrations`. This is
a cache, not the source of truth.

**Indexes:** `organization_id`, `status`.

**Source:** SYNC-ARCHITECTURE.md §3, §4, §26.2; MULTI-USER-CONCEPT.md §4, §5.

---

### D.5 organization_keys — Organization Key Storage

Holds the organization key on this device.

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PRIMARY KEY CHECK (id = 1) | Single-row table. |
| organization_id | TEXT NOT NULL | The organization this key belongs to. |
| key_material | BLOB NOT NULL | The 256-bit organization key. |
| created_at | DATETIME NOT NULL | When the key was installed on this device. |
| updated_at | DATETIME | |

**Purpose:** Storage for the organization key. One row per device.
The key lives inside the SQLCipher database, so it is protected at
rest by the same encryption that protects the debtor data.

**Single-row constraint:** The `CHECK (id = 1)` on the primary key
enforces the one-row invariant. There is exactly one organization key
per device in the MVP, because there is exactly one organization per
device (SYNC-ARCHITECTURE.md §3).

**Invariants:**

- The key is never written outside the SQLCipher database.
- The key is never transmitted to the Control Plane.
- The key is readable only after the database is unlocked
  (SYNC-ARCHITECTURE.md §7.1).

**Cloud equivalent:** None. The Control Plane never holds the key
(SYNC-ARCHITECTURE.md §28.1.1).

**Source:** SYNC-ARCHITECTURE.md §6, §7.1, §25.3.

---

### D.6 history_records — Deterministic Reconciliation Outcomes

Records the losing value in each state reconciliation conflict,
computed according to the protocol order.

| Field | Type | Notes |
|-------|------|-------|
| entity_type | TEXT NOT NULL | 'debtor' \| 'action' \| 'communication' |
| entity_id | TEXT NOT NULL | |
| field_name | TEXT NOT NULL | The field whose value was contested. |
| losing_value | TEXT | The losing value. Same representation as in the state table. |
| losing_event_id | TEXT NOT NULL | The event_id of the state change that lost. |
| winning_event_id | TEXT NOT NULL | The event_id of the state change that won. |
| reconciled_at | DATETIME NOT NULL | Local wall clock at which this reconciliation was computed. Informational. Excluded from deterministic equivalence. |

**Primary key:** `(entity_type, entity_id, field_name)`. One row per
contested field.

**Purpose:** Records the losing value for every field that has been
the subject of a reconciliation conflict. Provides an explanation of
why a field has its current value, and preserves the losing value for
review.

**Invariants (SYNC-ARCHITECTURE.md §25.7.3):**

- Derived state. Can be reconstructed from `sync_events` and the
  deterministic reconciliation rules.
- Deterministic content is: `entity_type`, `entity_id`, `field_name`,
  `losing_value`, `losing_event_id`, `winning_event_id`.
  `reconciled_at` is local diagnostic metadata and is excluded from
  deterministic equivalence.
- Not synchronized in the MVP. It is not sent to peers and is not
  sent to the Control Plane.

**Not append-only.** Updates when a later reconciliation changes the
outcome for a field.

**Cloud equivalent:** None.

**Source:** SYNC-ARCHITECTURE.md §13.3, §25.7.1.

---

### D.7 pending_events — Work Queue for Deferred Application

Events that have been accepted but cannot yet be applied because
their referenced entity does not exist locally.

| Field | Type | Notes |
|-------|------|-------|
| event_id | TEXT PRIMARY KEY | The event_id. References `sync_events.id`. |
| reason | TEXT NOT NULL | Why the event is pending. MVP: 'ENTITY_NOT_YET_PRESENT'. |
| depends_on_entity_type | TEXT NOT NULL | The type of the entity that must exist. |
| depends_on_entity_id | TEXT NOT NULL | The identifier of the entity that must exist. |
| added_at | DATETIME NOT NULL | Local wall clock when the event was first marked pending. Informational. |

**Purpose:** A work queue. Rows are removed when the pending event
is applied. An event in this table is already in `sync_events` and
has already been acknowledged to its peer as ACCEPTED.

**Invariants (SYNC-ARCHITECTURE.md §25.7.7):**

- Every row references an event that is already in `sync_events`.
- When the pending event is applied, its row is removed in the same
  transaction that applies the event.
- When multiple pending events become applicable at the same time,
  they are applied in canonical protocol order: `(logical_clock,
  device_id, sequence)`.
- A pending event does not block other events from being accepted
  and applied.

**Indexes:** `(depends_on_entity_type, depends_on_entity_id)` for
efficient lookup when a prerequisite entity arrives.

**Cloud equivalent:** None.

**Source:** SYNC-ARCHITECTURE.md §14.5, §25.7.5.

---

### D.8 entity_field_state — Current Field Winner Metadata

Records which event currently wins for each mutable field of each
synchronized entity. Used by the deterministic reconciliation
algorithm (SYNC-ARCHITECTURE.md §25.9.9).

| Field | Type | Notes |
|-------|------|-------|
| entity_type | TEXT NOT NULL | 'debtor' \| 'action' \| 'communication' |
| entity_id | TEXT NOT NULL | |
| field_name | TEXT NOT NULL | The field. |
| winning_event_id | TEXT NOT NULL | The event_id of the event that currently sets this field's winning value. |
| winning_logical_clock | INTEGER NOT NULL | The winning event's logical clock. |
| winning_device_id | TEXT NOT NULL | The winning event's origin device_id. |
| winning_sequence | INTEGER NOT NULL | The winning event's sequence number. |
| updated_at | DATETIME | Local wall clock. Informational. |

**Primary key:** `(entity_type, entity_id, field_name)`.

**Purpose:** The reconciliation algorithm compares each newly-arrived
state change against the current winner for the same field. The
current winner's protocol-order key is `(logical_clock, device_id,
sequence)`. This table stores that key directly, so the algorithm
does not need to look up the winning event in `sync_events` on every
comparison.

**Why this table exists:** The protocol's deterministic reconciliation
needs to know, for every mutable field of every entity, which event is
the current winner in protocol order. Deriving this from the state
table's `updated_at` column would be incorrect — `updated_at` is
informational only and must not participate in reconciliation.

**Invariants:**

- Derived from `sync_events`. Can be reconstructed if necessary.
- One row per field that has been set by at least one accepted event.
- When a new event becomes the winner for a field, this row is
  updated in the same transaction that updates the state table.

**Cloud equivalent:** None.

**Source:** SYNC-ARCHITECTURE.md §13, §25.9.9.

---

## Summary of Category D tables

| Table | Purpose | Cloud equivalent |
|-------|---------|------------------|
| D.1 sync_events | The event log | None |
| D.2 sync_state | Local device protocol state | None |
| D.3 sync_delivery | Per-peer, per-origin delivery bookkeeping | None |
| D.4 sync_peers | Peer relationship and cache | Control Plane device_registrations (cache only) |
| D.5 organization_keys | Organization key storage | None |
| D.6 history_records | Reconciliation losing-value records | None |
| D.7 pending_events | Work queue for deferred application | None |
| D.8 entity_field_state | Current field winner metadata | None |

---

## What Is NOT in the Local Database

- Customer billing / subscription data (cloud only)
- Cloud audit logs (cloud only)
- Support tickets (cloud only — client accesses via cloud API)
- Cloud-only platform settings (cloud only)
- **Not debtor data (obviously)** — but it's important to state that
  local does NOT duplicate what the cloud already owns exclusively.

Local caches only what the app needs to operate offline.

---

## Summary Table

| # | Table | Category | Cloud equivalent |
|---|-------|----------|------------------|
| 1 | debtors | Debtor | None (forbidden in cloud) |
| 2 | debts | Debtor | None |
| 3 | documents | Debtor | None |
| 4 | communications | Debtor | None |
| 5 | actions | Debtor | None |
| 6 | audit_log | Debtor | cloud_audit_logs (separate concept) |
| 7 | local_connectors | Connector | client_connectors |
| 8 | local_connector_usage | Connector | connector_usage (aggregate only) |
| 9 | connector_sync_state | Connector | None (sync bookkeeping) |
| 10 | local_organization | Cache | organizations |
| 11 | local_user | Cache | users |
| 12 | local_templates | Cache | templates |
| 13 | sync_events | Sync | None |
| 14 | sync_state | Sync | None |
| 15 | sync_delivery | Sync | None |
| 16 | sync_peers | Sync | Control Plane (cache only) |
| 17 | organization_keys | Sync | None |
| 18 | history_records | Sync | None |
| 19 | pending_events | Sync | None |
| 20 | entity_field_state | Sync | None |

**Total: 20 local tables (6 operational + 3 connector + 3 cache + 8 sync).**

---

## Implementation Notes

**Language:** Rust (`src-tauri/src/db.rs`).

**Encryption:** SQLCipher. Key derived via Argon2id from user's local
password. Password verified by reading `sqlite_master` after unlock.

**Migration system:** `PRAGMA user_version` tracks schema version.
Migrations run in transactions. Idempotent (`CREATE TABLE IF NOT
EXISTS`).

**Foreign keys:** Enabled via `PRAGMA foreign_keys = ON`.

**WAL mode:** Enabled for performance.

**Path for files:** Debtor files live under the OS app data directory
(`{app_data}/files/debtors/{debtor_id}/`).

---

## What This Document Does Not Do

- It does not define the exact Rust migration code. That lives in
  `src-tauri/src/db.rs`.
- It does not cover the current state of the Tauri schema. A separate
  audit compares this reference to what's actually implemented.
- It does not include future tables for the Agent App (separate
  spec).

---

## Relationship to Cloud Tables

Cloud Local

───── ─────

organizations ──────► local_organization (cache)

users ──────► local_user (cache)

agents

licenses

platform_settings

aggregate_metrics (generated from local, sent to cloud)

client_activity_metrics (generated from local, sent to cloud)

cloud_audit_logs

boundary_proof_logs (local proof generated, sent to cloud)

support_tickets

support_ticket_replies

support_ticket_events

organization_audit_events

notifications

ticket_counter

templates ──────► local_templates (cache)

connector_catalog (fetched from cloud, not cached as table)

client_connectors ──────► local_connectors (with creds local)

connector_usage (aggregate sent from local)

debtor data (local only)

───────────────────────

debtors

debts

documents

communications

actions

audit_log

local_connector_usage (per-debtor detail)

**The arrow only goes cloud → local for cache tables.**

**For debtor tables, there is no arrow. Data stays local.**