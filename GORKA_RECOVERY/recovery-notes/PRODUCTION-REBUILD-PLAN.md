# GORKA PRODUCTION REBUILD PLAN

**Version:** 1.0 (draft)
**Date:** September 11, 2026
**Status:** PLANNING ONLY — DO NOT EXECUTE until Phase 17.
**Purpose:** Document the exact cutover plan for rebuilding production Supabase into the 21-table cloud schema.
**Authority:** Executes only after all Phase 7-15 acceptance criteria pass on gorka_test.

---


## Prerequisite Conditions

Before this plan may be executed, ALL of the following must be true:

### Cloud (verified on gorka_test)

- [ ] Clean gorka_test has all 21 cloud tables
- [ ] No debtor tables, no debtor foreign keys, no debtor IDs anywhere
- [ ] Registration creates organization + user correctly
- [ ] Login issues JWT, /api/auth/me works
- [ ] Organization isolation holds (client A cannot read client B)
- [ ] Support ticket create / reply / assign / status works
- [ ] ticket_counter increments atomically (GORKA-000001)
- [ ] Templates CRUD works; non-parameterized content is rejected
- [ ] Aggregate metrics sync endpoint works
- [ ] Client activity metrics sync endpoint works
- [ ] Boundary proof logging works on every sync
- [ ] Connector catalog reads correctly (data seeded)


### Local (verified on Tauri app)

- [ ] SQLCipher encrypts the DB (cannot be opened by plain SQLite)
- [ ] Unlock with correct password succeeds
- [ ] Unlock with wrong password fails immediately
- [ ] Debtor CRUD works
- [ ] Debt CRUD works
- [ ] Document upload works
- [ ] Communication logging works
- [ ] Action CRUD works
- [ ] Local audit log records operations
- [ ] Data persists across app restart

### Boundary

- [ ] Manual boundary test passes (fake debtor, network trace, no leak)
- [ ] Automated boundary test passes in CI

### Process

- [ ] Fresh production backup taken (separate from Sept 10)
- [ ] This document reviewed and approved by the platform owner
- [ ] Explicit go given in writing by the platform owner

**If any box is unchecked, DO NOT EXECUTE.**

---

## Phase A - Fresh Backup

**Purpose:** A second, current backup before any production changes.

### A.1 Capture current production schema

Note: The following commands are informational - they show what WILL be run at Phase 17. Do NOT run them now.


psql (command to save production table list)

### A.2 Capture current production schema in detail

pg_dump --schema-only (command to save production schema)

### A.3 Capture current production data

pg_dump --data-only (command to save production data)

### A.4 Verify backups exist and are non-empty

dir GORKA_RECOVERY\backups\production-*

Expected: 3 files, all non-zero.

**If any file is empty -> STOP. Investigate.**

---

## Phase B - Freeze Production

**Purpose:** Make production read-only temporarily so no client can write during cutover.

**Note:** Production currently has no real users. This phase is expected to be a no-op. Document it anyway for the future.

### B.1 Verify no active connections

Check pg_stat_activity for connections to the postgres database. Expected: 1 (this connection only).

### B.2 (Optional) Restrict access

Skip if no active users. Otherwise, change the DB password temporarily and revert after cutover.

---

## Phase C - Create the New Schema

**Purpose:** Drop the old 18-table schema and create the new 21-table schema.

### C.1 Drop the old schema

**WARNING: Destructive. Point of no return for the old data.**

Drop the public schema and recreate it empty. This removes all 18 existing tables.

### C.2 Apply the cloud schema

Run prisma db push against production using schema.cloud.prisma.

Expected: 21 tables created, no errors.

### C.3 Verify

List all tables. Expected exactly 21 tables: organizations, users, agents, licenses, platform_settings, aggregate_metrics, client_activity_metrics, cloud_audit_logs, boundary_proof_logs, support_tickets, support_ticket_replies, support_ticket_events, organization_audit_events, notifications, ticket_counter, templates, connector_catalog, client_connectors, connector_usage, device_registrations, relay_sessions.

**If any debtor table exists -> STOP. Investigate.**

---

## Phase D - Seed Required Data

**Purpose:** Populate tables that need initial rows.

### D.1 Seed ticket_counter

Insert a single row with id = default and last_number = 0.

### D.2 Seed connector_catalog

Populate with initial connectors (Twilio SMS, Resend Email, Mocean SMS, Gemini AI). Exact SQL to be written when connectors are implemented.

For now: insert a placeholder row to verify the table works.

### D.3 Verify seeds

Query ticket_counter and connector_catalog to confirm rows exist.

### D.4 (Added September 17, 2026) — Multi-user Control Plane tables

The two tables `device_registrations` and `relay_sessions` are
created by the schema push (Phase C) but require no seed data.
They are populated at runtime by the Control Plane services.
No seed step is needed.


---

## Phase E - Create the OWNER Account

**Purpose:** Create the platform owner account so you can log in.

### E.1 Register via backend API

Point backend at production temporarily. Run registration curl. Use your real email and a strong password.

Note: The exact email and password are known only to you. Do not put them in this file.

### E.2 Promote the user to OWNER

After registration, the user has default role AGENT. Run UPDATE users SET role = OWNER WHERE email = your-email.

### E.3 Verify

Query users table. Expected: 1 row with your email and role OWNER.

---

## Phase F - Unfreeze Production

**Purpose:** Restore normal operation.

### F.1 Stop the local backend

Ctrl+C in the backend terminal.

### F.2 Restore backend environment

Set DATABASE_URL back to gorka_test or the default development URL.

---

## Phase G - Verify Production

**Purpose:** Final acceptance.

### G.1 Table count

List all tables. Expected: 21 tables.

### G.2 No debtor data anywhere

Query information_schema.columns for any column with name containing debtor. Expected: empty result, or only debtor_count in aggregate_metrics.

### G.3 Login test

Curl api.gorka.click/api/auth/login with your OWNER email and password. Expected: JWT returned.

### G.4 Owner Dashboard access

Log into platform.gorka.click with the OWNER account. Expected: dashboard loads, empty client list.

---

## Phase H - Post-Cutover Monitoring (24 hours)

**Purpose:** Catch any issue quickly.

### H.1 Watch for errors

Monitor backend logs for: registration errors, login errors, 500 responses, unexpected queries to dropped tables.

### H.2 Verify no drift

List all tables twice, 4 hours apart. Confirm table list is unchanged.

### H.3 If something breaks

See Rollback Plan below.

---

## Rollback Plan

**When to rollback:**

- Registration fails against production
- Login fails
- Any debtor data appears in production
- Support system cannot create tickets
- Any table from the cloud schema is missing or malformed

**Rollback steps:**

1. Drop the new schema (Phase C.1)
2. Restore from the most recent backup (Phase A.3 or Sept 10)
3. Verify the old 18-table schema is back
4. Investigate the failure on gorka_test before retrying

---

## What This Plan Does Not Do

- It does not migrate any data from the old schema to the new one (there is nothing worth migrating - everything is test data)
- It does not run any DDL before Phase C
- It does not touch gorka_test
- It does not modify any spec, law, or rule
- It does not cover the multi-user sync engine. The two new cloud
  tables (device_registrations, relay_sessions) are created by the
  schema push, but the sync engine that uses them is a separate
  workstream (Phases 9.5-9.7). See MULTI-USER-CONCEPT.md.


---

## Estimated Duration

| Phase | Duration |
|-------|----------|
| A - Backup | 2 min |
| B - Freeze | 1 min |
| C - New schema | 5 min |
| D - Seed | 2 min |
| E - OWNER account | 5 min |
| F - Unfreeze | 1 min |
| G - Verify | 5 min |
| H - Monitoring | 24 hours |

**Total active time:** ~20 minutes.

---

## Final Notes

This is a **draft**. It will be updated when:

- Connector implementation defines the initial connector_catalog seed
- The backend fixes in Phase 3.5 reveal any additional production requirements
- Testing on gorka_test reveals issues this plan missed

**Do not execute any part of this plan until Phase 17.**

---

**Status:** Ready for review at Phase 16.

**Execution:** Awaiting explicit go at Phase 17.

