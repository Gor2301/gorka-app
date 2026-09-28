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
      Slice 2 debts             DONE (d4ca2dc)
      Slice 3 communications   DONE (ce65543)
      Slice 4 actions            DONE (cef8111)
      Slices 5-6                NOT STARTED
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
SLICE 2 - DEBTS
================================================================

Starting commit:   415e191
Resulting commit:  d4ca2dc

Files changed:
  shared/src/debts.rs       NEW (189 lines)
  shared/src/lib.rs         MODIFIED (added "pub mod debts;")
  src-tauri/src/main.rs     MODIFIED (4 commands became thin adapters)

Commands moved (Tauri command -> shared function):
  get_debts              -> gorka_shared::debts::get_debts
  insert_debt            -> gorka_shared::debts::insert_debt
  update_debt            -> gorka_shared::debts::update_debt
  delete_debt            -> gorka_shared::debts::delete_debt

Shared function signatures:
  fn get_debts(conn: &Connection, organization_id: &str,
               debtor_id: &str) -> Result<Vec<Debt>, String>
  fn insert_debt(conn: &Connection, organization_id: &str,
                 input: DebtInput) -> Result<Debt, String>
  fn update_debt(conn: &Connection, organization_id: &str,
                 id: &str, input: DebtInput) -> Result<Debt, String>
  fn delete_debt(conn: &Connection, organization_id: &str,
                 id: &str) -> Result<bool, String>

DATA PRESERVATION
  SQL strings               unchanged
  Parameter order and types unchanged
  Row mappings              unchanged
  Transaction boundaries    unchanged (none; all four use as_ref)
  Audit calls               unchanged
    insert_debt -> INSERT_DEBT, Some(debtor_id)
    update_debt -> UPDATE_DEBT, Some(debtor_id)
    delete_debt -> DELETE_DEBT, None

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   unchanged
    (still via get_trusted_organization_id(&app))
  AppState ownership and connection
    locking                             unchanged
    (all four use as_ref(); no mut borrow)
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (same shapes, same field values;
     update_debt still returns now as
     created_at; update_debt still omits
     debtor_id from the UPDATE column
     list; both preserved as-is)

WARNING CLEANUP
  None. gorka-client warnings: 6 before,
  6 after. No new warnings introduced
  by Slice 2. No cleanup authorized for
  this slice.

VERIFICATION
  cargo build -p gorka-client    PASS (2m 26s, 6 warnings)
  cargo test -p gorka-shared     14/14 PASS (6 enrollment + 8 sync)
  Client smoke test:
    login, unlock, dashboard numbers
    open debtor detail (get_debts)
    add debt 999.99 (insert_debt)
    dashboard total_debt increases by 999.99
    edit debt to 888.88 (update_debt)
    dashboard total_debt moves by -111.11
    delete debt (delete_debt)
    dashboard total_debt returns to baseline
    open a second debtor (scoping isolation)
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No event semantics changed.
  No audit semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.
  No new dependency added.
  shared/src/debtors.rs untouched.

DEVIATIONS
  None.

================================================================
SLICE 3 - COMMUNICATIONS
================================================================

Starting commit:   21e350c
Resulting commit:  ce65543

Files changed:
  shared/src/communications.rs   NEW (143 lines)
  shared/src/lib.rs              MODIFIED (added "pub mod communications;")
  src-tauri/src/main.rs          MODIFIED (3 commands became thin adapters)

Commands moved (Tauri command -> shared function):
  get_communications         -> gorka_shared::communications::get_communications
  insert_communication       -> gorka_shared::communications::insert_communication
  delete_communication       -> gorka_shared::communications::delete_communication

Shared function signatures:
  fn get_communications(conn: &Connection, organization_id: &str,
                        debtor_id: &str)
                        -> Result<Vec<Communication>, String>
  fn insert_communication(conn: &Connection, organization_id: &str,
                          input: CommunicationInput)
                          -> Result<Communication, String>
  fn delete_communication(conn: &Connection, organization_id: &str,
                          id: &str) -> Result<bool, String>

DATA PRESERVATION
  SQL strings               unchanged
  Parameter order and types unchanged
  Row mappings              unchanged
  Transaction boundaries    unchanged (none; all three use as_ref)
  Audit calls               unchanged
    insert_communication -> INSERT_COMM, Some(debtor_id)
    delete_communication -> DELETE_COMM, None
    get_communications   -> none (read-only)

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   unchanged
    (still via get_trusted_organization_id(&app))
  AppState ownership and connection
    locking                             unchanged
    (all three use as_ref(); no mut borrow)
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (same shapes, same field values;
     insert_communication still binds
     Option::<String>::None for created_by
     in the INSERT and returns
     created_by: None; type/direction
     return the enum-derived canonical
     uppercase strings; all preserved
     as-is)

WARNING CLEANUP
  None. gorka-client warnings: 6 before,
  6 after. No new warnings introduced
  by Slice 3. No cleanup authorized for
  this slice.

VERIFICATION
  cargo build -p gorka-client    PASS (2m 03s, 6 warnings)
  cargo test -p gorka-shared     14/14 PASS (6 enrollment + 8 sync)
  Client smoke test:
    login, unlock, dashboard numbers
    open debtor detail (get_communications)
    add one communication of each type
      CALL / OUTBOUND
      EMAIL / OUTBOUND
      SMS / INBOUND
      NOTE / INBOUND
    verify all four render with correct
      type and direction labels
    delete one (NOTE); other three remain
    open second debtor; add communication;
      verify it does not appear under
      the first debtor (JOIN scoping)
    dashboard invariants: total_debtors,
      total_debt, total_actions unchanged
      from baseline (communications do not
      affect these three)
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No event semantics changed.
  No audit semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.
  No new dependency added.
  shared/src/debtors.rs and shared/src/debts.rs
    untouched.

DEVIATIONS
  None.

================================================================
SLICE 4 - ACTIONS
================================================================

Starting commit:   a6d2a6b
Resulting commit:  cef8111
Follow-up commit:  8491509 (dead-import cleanup)

Files changed:
  shared/src/actions.rs    NEW (187 lines)
  shared/src/lib.rs        MODIFIED (added "pub mod actions;")
  src-tauri/src/main.rs    MODIFIED (4 commands became thin adapters)

Commands moved (Tauri command -> shared function):
  get_actions            -> gorka_shared::actions::get_actions
  insert_action          -> gorka_shared::actions::insert_action
  update_action          -> gorka_shared::actions::update_action
  delete_action          -> gorka_shared::actions::delete_action

Shared function signatures:
  fn get_actions(conn: &Connection, organization_id: &str,
                 debtor_id: &str) -> Result<Vec<Action>, String>
  fn insert_action(conn: &Connection, organization_id: &str,
                   input: ActionInput) -> Result<Action, String>
  fn update_action(conn: &Connection, organization_id: &str,
                   id: &str, input: ActionInput)
                   -> Result<Action, String>
  fn delete_action(conn: &Connection, organization_id: &str,
                   id: &str) -> Result<bool, String>

DATA PRESERVATION
  SQL strings               unchanged
  Parameter order and types unchanged
  Row mappings              unchanged
  Transaction boundaries    unchanged (none; all four use as_ref)
  Audit calls               unchanged
    insert_action -> INSERT_ACTION, Some(debtor_id)
    update_action -> UPDATE_ACTION, Some(debtor_id)
    delete_action -> DELETE_ACTION, None
    get_actions   -> none (read-only)

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   unchanged
    (still via get_trusted_organization_id(&app))
  AppState ownership and connection
    locking                             unchanged
    (all four use as_ref(); no mut borrow)
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (same shapes, same field values;
     update_action still omits debtor_id
     from the UPDATE column list;
     update_action still returns now as
     created_at; insert_action still
     defaults status to PENDING;
     insert_action returns input.r#type
     directly; all preserved as-is)

WARNING DELTA
  gorka-client (bin) warnings: 6 before,
  7 after the extraction. The new warning
  was: unused import `serde_json::Value as
  JsonValue` in main.rs. Cause: the four
  action commands were the last users of
  JsonValue in main.rs; once they moved to
  gorka_shared::actions, the import became
  dead. This is a mechanical, expected
  consequence of the extraction, not a
  behavior change or a defect.

  A separate one-line follow-up commit
  (8491509) removed this extraction-caused
  dead import from src-tauri/src/main.rs.
  This restored the gorka-client warning
  baseline to 6. No other warning cleanup
  was performed.

  Note: a `cargo clean -p gorka-client`
  was performed to obtain the full warning
  list. It revealed 3 pre-existing
  warnings in gorka-shared (lib):
    unused import serde_json::Value
    unused import PasswordHasher
    unused import rand_core::OsRng
  These were hidden in incremental builds.
  They are pre-existing and were left
  untouched. They are not caused by this
  slice and are not a reason to expand
  cleanup.

VERIFICATION
  cargo build -p gorka-client    PASS (1m 07s after cleanup, 6 warnings)
  cargo test -p gorka-shared     (not re-run this slice; no shared
                                  test files changed)
  Client smoke test (via debtor detail page, Actions card):
    login, unlock
    dashboard baseline: total_debtors=12,
      total_debt=$2,381,800, total_actions=1
    open debtor detail from Collections
    add action CALL/PENDING (insert_action)
    verify it renders in the Actions card
    dashboard total_actions = 2
    edit action status to COMPLETED
      (update_action)
    verify change renders
    dashboard total_actions = 2 (unchanged)
    delete action (delete_action)
    dashboard total_actions = 1 (back to baseline)
    second-debtor scoping check: add action
      to a different debtor; verify it does
      not appear under the first
    delete it; total_actions = 1
    total_debtors and total_debt unchanged
      throughout
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No event semantics changed.
  No audit semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.
  No new dependency added.
  shared/src/debtors.rs, shared/src/debts.rs,
    and shared/src/communications.rs untouched.

DEVIATIONS
  One: the initial post-extraction build
  produced 7 gorka-client warnings instead
  of 6, caused by the now-dead JsonValue
  import. Reported, authorized as a
  narrowly-scoped extraction-caused
  cleanup, resolved by follow-up commit
  8491509. No other deviations.

================================================================
SLICE 5 - DOCUMENTS (NEXT)
================================================================

Not started. Will follow the same pattern:
shared/src/documents.rs
Commands: upload_document, get_documents, delete_document.
Note: upload_document uses AppStorage and
std::fs; delete_document uses std::fs and
reads file_path from the row. These may
require passing &AppStorage into shared,
matching delete_debtor's pattern in Slice 1.

================================================================
END OF DOCUMENT
================================================================
