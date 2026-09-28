# PHASE 9.5 - EXTRACTION LOG

Version: 1.0
Date: September 28, 2026
Purpose: Auditable record of each Phase 9.5 extraction slice.
Authority: Subordinate to AGENT-APP-SPEC.md v1.2 and
ARCHITECTURAL-LAW.md v1.3.

================================================================
SEQUENCE
================================================================

  3.1 models                    DONE (a2ccd73)
  3.2 enrollment                DONE (8cce268)
  3.3 sync primitives           DONE (7b06034)
      Agent scaffold            DONE (0e73b34, 699b9fe)
  3.4 db                        DONE (a959087)
  3.5 auth                      DEFERRED (no code change)
  Adapter/command cleanup
      Slice 1 debtors           DONE (91b5b7e)
      Slices 2-6                NOT STARTED
  Final Client regression       PENDING
  Agent implementation          PENDING
  Agent authentication          PENDING

Repository layout: Cargo workspace at the repository root.
Members: shared/, src-tauri/, src-tauri-agent/.
Shared Rust core: gorka-shared crate.

================================================================
SLICE 1 - DEBTORS
================================================================

Starting commit:   a959087
Resulting commit:  91b5b7e

Files changed:
  shared/src/debtors.rs     NEW (293 lines)
  shared/src/lib.rs         MODIFIED (added "pub mod debtors;")
  src-tauri/src/main.rs     MODIFIED (8 commands became thin adapters)

Commands moved (Tauri command -> shared function):
  get_debtors            -> gorka_shared::debtors::get_debtors
  get_debtor             -> gorka_shared::debtors::get_debtor
  insert_debtor          -> gorka_shared::debtors::insert_debtor
  bulk_insert_debtors    -> gorka_shared::debtors::bulk_insert_debtors
  update_debtor          -> gorka_shared::debtors::update_debtor
  delete_debtor          -> gorka_shared::debtors::delete_debtor
  search_debtors         -> gorka_shared::debtors::search_debtors
  get_debtor_count       -> gorka_shared::debtors::get_debtor_count

Shared function signatures:
  fn get_debtors(conn: &Connection, organization_id: &str)
  fn get_debtor(conn: &Connection, organization_id: &str, id: &str)
  fn insert_debtor(conn: &Connection, organization_id: &str,
                   input: DebtorInput)
  fn bulk_insert_debtors(conn: &mut Connection, organization_id: &str,
                         inputs: Vec<DebtorInput>)
  fn update_debtor(conn: &Connection, organization_id: &str,
                   id: &str, input: DebtorInput)
  fn delete_debtor(conn: &Connection, storage: &AppStorage,
                   organization_id: &str, id: &str)
  fn search_debtors(conn: &Connection, organization_id: &str,
                    query: &str)
  fn get_debtor_count(conn: &Connection, organization_id: &str)

DATA PRESERVATION
  SQL strings               unchanged
  Parameter order and types unchanged
  Row mappings              unchanged
  Transaction boundaries    unchanged
  Audit-log calls           unchanged

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   unchanged
    (still via get_trusted_organization_id(&app))
  AppState ownership and connection
    locking                             unchanged
    (bulk_insert_debtors still uses
     as_mut() and conn.transaction();
     others use as_ref())
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (same shapes, same field values,
     including update_debtor's created_at
     semantics)

WARNING CLEANUP
  Removed in main.rs:
    unused import: State
    unused variable: app (upload_document parameter)
  gorka-client warnings: 8 before, 6 after
  Remaining: 5 in auth.rs (deferred with auth slice),
             1 in shared/db.rs (tracked separately)

VERIFICATION
  cargo build -p gorka-client    PASS (2m 28s)
  cargo test -p gorka-shared     14/14 PASS
  Client smoke test:
    login, unlock, dashboard numbers match
    Collections count 11
    open debtor detail
    edit debtor surname
    add test debtor
    search for test debtor
    delete test debtor
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No event semantics changed.
  No audit semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.

DEVIATIONS
  None.

================================================================
SLICE 2 - DEBTS (NEXT)
================================================================

Not started. Will follow the same pattern:
shared/src/debts.rs
Commands: get_debts, insert_debt, update_debt, delete_debt.

================================================================
END OF DOCUMENT
================================================================
