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
  3.5 auth                      RESOLVED (Item 2)
  Adapter/command cleanup
      Slice 1 debtors           DONE (91b5b7e)
      Slice 2 debts             DONE (d4ca2dc)
      Slice 3 communications    DONE (ce65543)
      Slice 4 actions           DONE (cef8111)
      Slice 5 documents         DONE (5a0f924)
      Slice 6 dashboard         DONE (1c17ebb)
  Final Client regression       DONE (562e17d, with caveats)
  Item 1 delete_debtor test     DONE (verified 2026-09-29)
  Item 2 auth boundary          DONE (499e7f5, 10df6f5)
  Item 3 Stage A migrations     DONE (6e83a29)
  Stage B shared functions      DONE (2268a30, 292a3a8, 884c637)
  Stage C Agent commands        DONE (C.1 5ab35ae/67b984a/c69d21e; C.2 b4b448f; C.3 b598a97; C.4 6e0c135; C.5 a085b8d; lock f8f3f4d)
  Stage D Agent frontend        IN PROGRESS (D.0 71948ab; D.1 38ae126; D.2 2eb97b9; D.3 efbbc4d)
  Agent end-to-end regression   NOT STARTED

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
SLICE 5 - DOCUMENTS
================================================================

Starting commit:   eadcf56
Resulting commit:  5a0f924
Follow-up commit:  34539ff (dead-import cleanup)

Files changed:
  shared/src/documents.rs    NEW (197 lines)
  shared/src/lib.rs          MODIFIED (added "pub mod documents;")
  src-tauri/src/main.rs      MODIFIED (3 commands became thin adapters)

Commands moved (Tauri command -> shared function):
  upload_document        -> gorka_shared::documents::upload_document
  get_documents          -> gorka_shared::documents::get_documents
  delete_document        -> gorka_shared::documents::delete_document

Shared function signatures:
  fn upload_document(conn: &Connection, storage: &AppStorage,
                     input: DocumentInput)
                     -> Result<Document, String>
  fn get_documents(conn: &Connection, entity_id: &str,
                   entity_type: Option<&str>)
                   -> Result<Vec<Document>, String>
  fn delete_document(conn: &Connection, id: &str)
                     -> Result<bool, String>

DATA PRESERVATION
  SQL strings               unchanged
  Parameter order and types unchanged
  Row mappings              unchanged
  Transaction boundaries    unchanged (none; all three use as_ref)
  Filesystem calls          unchanged
    upload_document: create_dir_all, write, metadata
    delete_document: remove_file (eprintln on failure,
                     DB DELETE continues)
  Audit calls               unchanged
    upload_document -> UPLOAD_DOC, Some(entity_id),
                       "Uploaded document: category=<c>"
    delete_document -> DELETE_DOC, None,
                       "Deleted document: <id>"
    get_documents   -> none (read-only)

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   N/A - none of the
    three commands performs organization
    scoping. Preserved exactly. Not
    added during extraction.
  AppState ownership and connection
    locking                             unchanged
    (all three use as_ref(); no mut borrow)
  AppStorage boundary                   unchanged
    (upload_document takes State<AppStorage>;
     get_documents and delete_document do not)
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (same shapes, same field values;
     upload_document writes the file
     before the DB INSERT; delete_document
     deletes the file before the DB DELETE
     and returns affected > 0; both
     created_at fields computed via two
     separate Utc::now() calls in
     upload_document; all preserved as-is)

WARNING DELTA
  gorka-client (bin) warnings: 6 before,
  7 after the extraction. The new warning
  was: unused import `uuid::Uuid` in
  main.rs. Cause: the three document
  commands were the last users of
  uuid::Uuid in main.rs (Uuid::parse_str
  and Uuid::new_v4 in upload_document);
  once they moved to gorka_shared::documents,
  the import became dead. Mechanical,
  expected consequence of the extraction.

  A separate one-line follow-up commit
  (34539ff) removed this extraction-caused
  dead import from src-tauri/src/main.rs.
  This restored the gorka-client warning
  baseline to 6. No other warning cleanup
  was performed.

VERIFICATION
  cargo build -p gorka-client    PASS (59s after cleanup, 6 warnings)
  cargo test -p gorka-shared     (not re-run this slice; no shared
                                  test files changed)
  Client smoke test (via debtor detail Documents card):
    login, unlock
    dashboard baseline: total_debtors=12,
      total_debt=$2,381,800, total_actions=1
    open debtor detail from Collections
    upload document via Documents card
    verify it renders with correct metadata
    delete document via Documents card
    verify it disappears from the list
    dashboard numbers unchanged (documents
      do not feed dashboard stats)
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No event semantics changed.
  No audit semantics changed.
  No filesystem semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.
  No organization scoping added.
  No new dependency added.
  shared/src/debtors.rs, debts.rs,
    communications.rs, and actions.rs
    untouched.

DEVIATIONS
  One: the initial post-extraction build
  produced 7 gorka-client warnings instead
  of 6, caused by the now-dead Uuid
  import. Reported, authorized as a
  narrowly-scoped extraction-caused
  cleanup, resolved by follow-up commit
  34539ff. No other deviations.

OUT-OF-SCOPE OBSERVATION
  Dashboard "Total Actions" card routes to
  the Audit Logs page, which returns a 404
  from the cloud backend. Pre-existing
  frontend routing issue, unrelated to any
  extraction slice. Not investigated or
  changed here. Logged for awareness.

================================================================
SLICE 6 - DASHBOARD
================================================================

Starting commit:   1060ce2
Resulting commit:  1c17ebb
Follow-up commit:  none (no dead import)

Files changed:
  shared/src/dashboard.rs    NEW (45 lines)
  shared/src/lib.rs          MODIFIED (added "pub mod dashboard;")
  src-tauri/src/main.rs      MODIFIED (1 command became a thin adapter)

Command moved (Tauri command -> shared function):
  get_dashboard_stats    -> gorka_shared::dashboard::get_dashboard_stats

Shared function signature:
  fn get_dashboard_stats(conn: &Connection,
                         organization_id: &str)
                         -> Result<DashboardStats, String>

DATA PRESERVATION
  SQL string                unchanged
  Parameter order and types unchanged (single ?1 used three times)
  Row mapping               unchanged
  Transaction boundaries    unchanged (none)
  Audit calls               none

ADAPTER BEHAVIOR PRESERVATION
  Trusted organization_id acquisition   unchanged
    (still via get_trusted_organization_id(&app))
  AppState ownership and connection
    locking                             unchanged
    (uses as_ref(); no mut borrow)
  Error propagation                     unchanged
    (same Err(String) strings and paths)
  Return-value behavior                 unchanged
    (DashboardStats with the same three
     fields, mapped from the same query
     columns)
  Formatting                            preserved
    (the missing blank line between
     get_debtor_count's closing brace
     and get_dashboard_stats's #[command]
     was preserved, not tidied)

WARNING DELTA
  None. gorka-client (bin) warnings: 6
  before, 6 after. Prediction was 6 -> 6.
  The extraction did not create a new
  unused import because DashboardStats is
  consumed via the glob import
  `use gorka_shared::models::*;`, and glob
  imports do not emit per-item unused
  warnings. No cleanup was needed. No
  other warning was touched.

VERIFICATION
  cargo build -p gorka-client    PASS (2m 08s, 6 warnings)
  cargo test -p gorka-shared     14/14 PASS (6 enrollment + 8 sync)
  Client smoke test:
    login, unlock
    dashboard baseline recorded
    add debt (insert_debt); dashboard
      total_debt increases by exact amount
    edit amount (update_debt); dashboard
      total_debt moves by exact delta
    set status to PAID; dashboard total_debt
      returns to baseline (proves the
      NOT IN ('PAID', 'CANCELLED') filter
      is preserved through the shared module)
    set status back to ACTIVE; dashboard
      total_debt re-includes the debt
    delete debt (delete_debt); dashboard
      total_debt returns to baseline
    add action (insert_action); dashboard
      total_actions +1
    delete action (delete_action); dashboard
      total_actions back to baseline
    total_debtors unchanged (12) throughout
  All passed.

EXPLICIT NON-CHANGES
  No schema changed.
  No SQL semantics changed.
  No audit semantics changed.
  No command names changed.
  No generate_handler! registration changed.
  No authentication behavior changed.
  No new dependency added.
  No formatting cleanup.
  shared/src/debtors.rs, debts.rs,
    communications.rs, actions.rs,
    and documents.rs untouched.

DEVIATIONS
  None.

================================================================
ADAPTER/COMMAND CLEANUP PHASE - COMPLETE
================================================================

All six adapter slices are done and verified:

  Slice 1 debtors          DONE (91b5b7e)
  Slice 2 debts            DONE (d4ca2dc)
  Slice 3 communications   DONE (ce65543)
  Slice 4 actions          DONE (cef8111)
  Slice 5 documents        DONE (5a0f924)
  Slice 6 dashboard        DONE (1c17ebb)

The 23 SQL-bearing commands identified at the start of the
adapter cleanup are now thin #[tauri::command] adapters that
lock AppState, acquire the trusted organization id where
applicable, and call gorka-shared functions. Each shared
function takes an already-open connection and the trusted
organization id; the binary retains the connection lifecycle.

Two extraction-caused dead imports were identified and
removed in separate follow-up commits:

  Slice 4: serde_json::Value as JsonValue  (8491509)
  Slice 5: uuid::Uuid                      (34539ff)
  Slice 6: none

No other warning cleanup was performed. The gorka-client (bin)
warning baseline is 6.

The next Phase 9.5 step is Agent implementation, then
Agent authentication.

================================================================
FINAL CLIENT REGRESSION
================================================================

Date: September 29, 2026.
Starting commit: 562e17d.

SCOPE
  All 23 commands extracted during the six adapter slices,
  plus the 11 untouched Client commands, exercised through
  the running Client Dashboard on the cloud's gorka_test
  database. Production untouched.

WHAT WAS VERIFIED
  Entry flow:
    login, unlock, logout, login, unlock - PASS.
  Debtors (Slice 1):
    get_debtors, get_debtor, insert_debtor, search_debtors,
    update_debtor, get_debtor_count - PASS (each exercised
    through the Client UI on a test debtor).
    bulk_insert_debtors - NOT COVERED (no UI path).
  Debts (Slice 2):
    insert_debt, get_debts, update_debt - PASS.
  Communications (Slice 3):
    insert_communication (CALL/OUTBOUND and NOTE/INBOUND),
    get_communications, delete_communication - PASS.
  Actions (Slice 4):
    insert_action, get_actions, update_action, delete_action,
    dashboard total_actions movement - PASS.
  Documents (Slice 5):
    upload_document, get_documents, delete_document,
    filesystem presence and removal of the uploaded file -
    PASS with dir verification.
  Dashboard (Slice 6):
    get_dashboard_stats reads and renders - PASS.
  Persistence across process restart (Pass H):
    closed the Client, relaunched, logged in, unlocked,
    state read back correctly - PASS. Strong evidence the
    extracted functions write to disk correctly and the
    app reads them back.

WHAT WAS NOT CONCLUSIVELY VERIFIED
  1. The strict arithmetic chain (baseline -> deltas ->
     baseline) across the entire pass. Manual state changes
     were made between passes outside the plan, so the
     dashboard numbers could not be tracked against a frozen
     baseline. The dashboard was observed to reflect the
     current database state correctly, but the chain was
     not clean.

  2. delete_debtor's filesystem cascade. On one delete of
     the Regression TestSlice debtor
     (id cd972140-35ca-4301-bf06-b7ca5b227da8), the database
     row was removed but an empty files folder was still
     present on disk afterward. Cause not determined during
     the pass; the sequence of operations in the UI included
     manual re-create / re-delete cycles that may account
     for the observation. Tagged as an open observation, not
     a defect.

OPEN OBSERVATION (logged, not pursued)
  Delete-debtor filesystem cascade: when a debtor is
  deleted from the Client UI, does the debtor's files
  folder under %APPDATA%\com.gorka.client\data\files\
  debtors\<id>\ get removed? The Slice 1 smoke test did
  not check this. A dedicated isolated test (create test
  debtor, upload one document, delete debtor, check disk)
  is recommended before Agent implementation begins. If
  the folder is left behind, the fix is a separate
  reviewed change, not a modification during regression.

RESULT
  PASSED with two open caveats and one open observation.
  No code changes were made during the regression. No
  code commits resulted from the regression; this log
  update is the only record.

STATE AT END OF REGRESSION
  Main machine:  562e17d, clean.
  Cloud machine: 562e17d, clean except the two known
                 untracked files.
  GitHub:        562e17d.

================================================================
ITEM 1 - DELETE_DEBTOR FILESYSTEM TEST
================================================================

Date: September 29, 2026.

PURPOSE
  Close the open observation from the final Client regression:
  when a debtor is deleted, does the debtor's files folder
  under %APPDATA%\com.gorka.client\data\files\debtors\<id>\
  actually get removed?

ISOLATED TEST
  A fresh test debtor (FolderTest DeleteMe,
  id cc8e4d73-1c47-4093-a4cb-5edf7f224108) was created via
  the Client UI. One document was uploaded to it. The
  filesystem was inspected before and after deleting the
  debtor from Collections.

BEFORE DELETE
  The debtor's folder existed with a documents\ subfolder
  containing the uploaded file (other_1790669668.png).

AFTER DELETE
  The debtor's row was removed from the database.
  The debtor's folder and its documents\ subfolder were
  both gone from disk.

RESULT
  PASS. delete_debtor correctly removes both the database
  row and the filesystem folder in the expected sequence.
  The isolated test is definitive: a fresh create -> upload
  -> delete cycle leaves no folder behind.

OPEN ITEM, NOT A DEFECT
  A pre-existing empty folder for debtor id
  cd972140-35ca-4301-bf06-b7ca5b227da8 remained after its
  own regression-era delete. Its provenance is not
  determined (likely an artifact of repeated create/delete
  cycles during manual testing). It is empty, harmless, and
  not caused by the delete path verified here. Left in
  place, not cleaned up.

DEVIATIONS
  None.

================================================================
ITEM 2 - AUTH BOUNDARY (READING A)
================================================================

Date: September 29, 2026.

COMMITS
  499e7f5  the auth-boundary change
  10df6f5  follow-up: remove dead reqwest from src-tauri

PURPOSE
  Resolve the Slice 3.5 deferral of auth.rs extraction.
  The Agent now needs the same auth commands, so the
  condition the earlier reviewer named ("wait until there
  are two concrete consumers") is met.

DECISION
  Reading A. Move only the HTTP half of login to shared.
  Keep the six store functions per binary. No shared
  Settings trait. No new abstraction. The ~65 lines of
  store boilerplate are duplicated deliberately, matching
  the Slice 3.5 prohibition on a shared settings
  abstraction.

FILES CHANGED
  shared/src/auth_http.rs    NEW (82 lines)
  shared/src/lib.rs          MODIFIED (added "pub mod auth_http;")
  shared/Cargo.toml          MODIFIED (added reqwest)
  src-tauri/src/auth.rs      MODIFIED (header + thin login)
  src-tauri/Cargo.toml       MODIFIED (removed dead reqwest)

WHAT MOVED
  The three response types: LoginResponse, LoginData,
  UserData (now private to shared::auth_http).
  The HTTP POST to http://localhost:3000/api/auth/login
  (now the single place the endpoint is named).
  The response parsing and error strings.

WHAT STAYED IN THE BINARY
  The store half of login (writing auth_token,
  organization_id, salt-if-absent to settings.dat).
  The six store functions: get_token, get_organization_id,
  get_salt, set_unlocked, is_unlocked, logout.
  Debug println!s in get_token. All preserved as-is.

DEAD IMPORT CLEANUP
  Two imports in src-tauri/src/auth.rs became dead because
  of the move: json (used only in the old login body) and
  Deserialize (used only by the moved response types).
  Both removed in the same commit, matching the Slices 4
  and 5 precedent for change-caused dead imports.

FOLLOW-UP COMMIT
  reqwest was no longer used anywhere in src-tauri/src
  after the move. Removed from src-tauri/Cargo.toml in a
  separate follow-up commit (10df6f5). gorka-shared retains
  its own reqwest. Same pattern as the Slice 4/5 dead
  import cleanups.

WARNING DELTA
  gorka-client (bin): 6 -> 3
  gorka-shared (lib): 3 -> 6
  Net across both crates: unchanged (9 -> 9). The three
  response-type warnings moved from bin to lib. No new
  warnings, no lost warnings. No cleanup beyond the two
  change-caused dead imports.

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-client    PASS (2m 31s, 3 warnings)
  cargo test -p gorka-shared     14/14 PASS
  Client login -> unlock -> dashboard: works with the thin
    login. Data intact. No regression.

DEVIATIONS
  None.

================================================================
ITEM 3 - STAGE A: SCHEMA MIGRATIONS
================================================================

Date: September 29, 2026.

COMMIT
  6e83a29

PURPOSE
  Add the four local schema additions required by
  AGENT-APP-SPEC.md v1.2 sections 5.4-5.6 and recorded as
  authoritative in LOCAL-TABLES.md v1.3 Amendment 1.

WHAT WAS ADDED
  v5  debtors.photo_path TEXT
  v6  calendar_events table + 2 indexes
  v7  debtors.role TEXT NOT NULL DEFAULT 'DEBTOR'
      debtor_relations table + 3 indexes (one unique)

SCOPE DISCIPLINE
  Migration-only. No models. No commands. No CRUD. No photo
  logic. No calendar logic. No relation logic. No frontend
  changes. Only shared/src/db.rs was modified.

SHARED SCHEMA
  The schema is shared between the two binaries. The Client
  runs these migrations on its next launch and gains the
  new columns and tables without displaying them. The
  Client's existing commands use explicit column lists, so
  no behavior changes.

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-client    PASS (2m 31s)
  Client login -> unlock -> dashboard: PASS.
  Existing data intact:
    total_debtors = 12
    total_debt    = $2,381,550
    total_actions = 2
  Debtor detail page renders correctly with debts,
    actions, communications, and documents cards.
  Full Client regression (from the previous session)
    remains valid on the migrated schema.

DEVIATIONS
  None.

================================================================
STAGE B SUB-SLICE 1 - PHOTO FUNCTIONS
================================================================

Date: September 29, 2026.

COMMIT
  2268a30

FILES CHANGED
  shared/src/debtors.rs    MODIFIED (two functions appended)

FUNCTIONS ADDED
  set_debtor_photo(conn, storage, debtor_id, source_file_path)
    -> Result<(), String>
  get_debtor_photo(conn, debtor_id) -> Result<Option<String>, String>

DECISIONS
  - No organization scoping. Matches spec section 6.3 and the
    Slice 5 documents precedent.
  - Photo target: fixed name photo.<ext>. Prior photo.* is
    removed before writing the new one. One photo per debtor.
  - Debtor existence is checked before any filesystem mutation.
  - get_debtor_photo returns Ok(None) for both a nonexistent
    debtor and a NULL photo_path.
  - Debtor and DebtorInput models are untouched. Photo read and
    write is column-specific for this sub-slice.

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-client   PASS (1m 29s)
  Warning count unchanged.
  No runtime test; commands not registered until Stage C.

DEVIATIONS
  None.

================================================================
STAGE B SUB-SLICE 2 - CALENDAR
================================================================

Date: September 29, 2026.

COMMIT
  292a3a8

FILES CHANGED
  shared/src/calendar.rs    NEW (279 lines)
  shared/src/models.rs      MODIFIED (+74: four structs)
  shared/src/lib.rs         MODIFIED (added "pub mod calendar;")

FUNCTIONS ADDED
  get_calendar_events(conn, organization_id, start_date, end_date)
  insert_calendar_event(conn, organization_id, input)
  update_calendar_event(conn, organization_id, id, input)
  delete_calendar_event(conn, organization_id, id)
  get_upcoming_payments(conn, organization_id, start_date, end_date)
  get_upcoming_followups(conn, organization_id, start_date, end_date)

MODELS ADDED
  CalendarEvent
  CalendarEventInput
  UpcomingPayment
  UpcomingFollowup

DECISIONS
  - All six functions take a trusted organization_id. The
    spec's section 6.3 example signatures omitted it, but
    LOCAL-TABLES.md v1.3 Amendment 1 requires organization_id
    in calendar_events to be derived from trusted context, not
    from the frontend. The normative rule wins.
  - get_calendar_events uses inclusive overlap semantics:
    start_date <= requested_end AND end_date >= requested_start.
  - event_type is always MANUAL on insert. Not settable by
    callers, not changed by update.
  - Explicit debtor-existence check when debtor_id is supplied
    to insert or update.
  - Dates are stored as sent by the frontend. No normalization.

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-client   PASS (2m 16s)
  Warning count unchanged (3).
  cargo test -p gorka-shared    14/14 PASS.
  No runtime test; commands not registered until Stage C.

DEVIATIONS
  None.

================================================================
STAGE B SUB-SLICE 3 - RELATIONS
================================================================

Date: September 29, 2026.

COMMIT
  884c637

FILES CHANGED
  shared/src/relations.rs    NEW (163 lines)
  shared/src/models.rs       MODIFIED (+22: two structs)
  shared/src/lib.rs          MODIFIED (added "pub mod relations;")

FUNCTIONS ADDED
  get_debtor_relations(conn, organization_id, debtor_id)
  insert_debtor_relation(conn, organization_id, input)
  delete_debtor_relation(conn, organization_id, id)

MODELS ADDED
  DebtorRelation (with joined related-debtor fields)
  DebtorRelationInput

DECISIONS
  - All three functions take a trusted organization_id.
    Same normative override as calendar.
  - get_debtor_relations returns only rows where debtor_id
    matches the requested debtor. Reverse-direction view is
    out of scope for Phase 9.5.
  - Insert validates both debtors exist in the org, rejects
    self-relations, validates relation_type against GUARANTOR
    and PLEDGER, and pre-checks the unique constraint.
  - No audit in Phase 9.5 (consistent with calendar).

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-client   PASS (2m 16s)
  Warning count unchanged (3).
  No runtime test; commands not registered until Stage C.

DEVIATIONS
  None.

================================================================
STAGE C SUB-SLICE 1 - AGENT AUTH FOUNDATION
================================================================

Date: September 29, 2026.

COMMITS
  5ab35ae   Agent auth foundation
  67b984a   Cargo.lock regeneration (from cloud)
  c69d21e   Follow-up: remove unused tauri::Manager import

FILES CHANGED
  src-tauri-agent/src/auth.rs    NEW
  src-tauri-agent/Cargo.toml     MODIFIED (added rusqlite, hex)
  src-tauri-agent/src/main.rs    MODIFIED (rewritten)
  Cargo.lock                     MODIFIED (regenerated on cloud)

WHAT WAS BUILT
  The Agent's own auth.rs, mirroring the Client's post-Item-2
  shape: seven functions (login, get_token,
  get_organization_id, get_salt, set_unlocked, is_unlocked,
  logout). login is thin: it calls gorka_shared::auth_http for
  the HTTP half, then writes auth_token, organization_id, and
  salt to the Agent's own settings.dat.

  Agent's AppState: db field changes from
  Mutex<Option<()>> to Mutex<Option<Connection>>.

  Agent's main.rs: agent_ping removed; eight commands
  registered (login, get_auth_token, get_salt,
  get_organization_id, database_exists, unlock_database,
  is_database_unlocked, logout).

  unlock_database is written clean, without the Client's
  debug println!s, but preserves the "Key derivation failed"
  error wrapper. Q2 decision Clean applied.

DECISIONS
  - open_local_file deferred to Stage D (Q1 decision B).
  - agent_ping removed (Q4 decision).
  - is_unlocked kept in the Agent's auth.rs for symmetry with
    the Client. Same deferral as Slice 3.5.
  - unlock_database written clean; no debug println!s.

CLEANUP
  c69d21e removed the unused tauri::Manager import from
  src-tauri-agent/src/auth.rs. It became dead because
  AppHandle methods resolve inherently, not through the
  Manager trait. Agent bin warning count dropped 3 -> 2.
  A third warning was counted by cargo but suppressed by
  deduplication. The two identified warnings were both in
  auth.rs; the first was removed, the second (is_unlocked)
  is a deferred parity warning.

CARGO.LOCK RECONCILIATION
  67b984a regenerated Cargo.lock on cloud, catching up two
  dependency changes that could not be applied from main:
  Item 2's reqwest move (gorka-client -> gorka-shared) and
  Stage C.1's hex and rusqlite additions to gorka-agent.
  No package additions beyond those, no version bumps.

VERIFICATION (cloud, 2026-09-29)
  cargo build -p gorka-agent    PASS (2m 39s, 3 warnings)
    after c69d21e:              agent bin warnings 3 -> 2
  cargo build -p gorka-client   PASS (2m 16s, 3 warnings)
  cargo test -p gorka-shared    14/14 PASS
  gorka-shared lib warnings     6 (unchanged)
  No runtime test; the Agent UI does not call any of the new
  commands yet. Behavioral verification is Stage D.

DEVIATIONS
  One: the Q1 cleanup edit was made on cloud, not main, because
  the cloud session was already open for verification. The
  change was committed from cloud (c69d21e), then pulled to
  main. Same pattern used for Cargo.lock regeneration. No
  behavior impact.

================================================================
STAGE C.5 - IS_ENROLLED BACKEND COMMAND
================================================================

Date: September 30, 2026.
Commit: a085b8d

Files changed:
  shared/src/db.rs            MODIFIED (added is_enrolled)
  src-tauri-agent/src/main.rs MODIFIED (adapter + registration)

What was added:
  shared::db::is_enrolled(conn) -> Result<bool, String>
  Queries organization_keys. Ok(true) if a row is present,
  Ok(false) if absent, Err if the query fails.

Reason:
  The Agent's entry flow needs to know whether the device is
  already enrolled. Before this commit, the only way to learn
  that was to attempt import_enrollment_package and interpret
  its refusal. That forced the user to select a package file on
  every launch. is_enrolled is a query, not an operation.

Scope discipline:
  Client untouched. Schema untouched. Enrollment package format
  and import behavior unchanged. organization-key semantics
  unchanged. Query only, no side effect.

Verification (cloud, 2026-09-30):
  cargo build -p gorka-agent    PASS (2 warnings)
  cargo build -p gorka-client   PASS (3 warnings)
  cargo test -p gorka-shared    14/14 PASS
  Cargo.lock unchanged.

DEVIATIONS: None.

================================================================
STAGE D - AGENT FRONTEND, SUB-SLICES D.0 THROUGH D.3
================================================================

Date: September 30, 2026.
Status: IN PROGRESS. D.0, D.1, D.2, D.3 complete. D.4-D.6 remain.

D.0 - PREREQUISITES (71948ab)
  Agent dashboard dependencies installed: react-router-dom,
  lucide-react, FullCalendar v6 (react, daygrid, interaction,
  list, timegrid), @tauri-apps/plugin-dialog. Versions match
  the Client.
  tsconfig.json added: strict, @/* path alias, vite/client
  types, no baseUrl (TS 6.0 deprecation).
  Build script: tsc -p tsconfig.json && vite build.

D.1 - DESIGN TOKENS AND PRIMITIVES (38ae126)
  design-tokens.css: values from AGENT-APP-SPEC.md v1.2
  section 11.2, plus entry-flow tokens sourced from the
  Client's pre-Tauri Login page. Single source of truth for
  every visual value.
  index.css: minimal reset, no Tailwind, no Vite template.
  Ten primitives added (Button, Input, Label, ErrorBanner,
  Spinner, EntryCard, GorkaLogo, Card, Avatar, Modal), each
  .tsx + .css. Barrel export in primitives/index.ts.
  postcss.config.js added with empty plugins so the Agent
  does not inherit the repo-root Tailwind pipeline.

D.2 - ENTRY FLOW (2eb97b9)
  App.tsx is a state machine: loading -> login -> unlock ->
  enroll -> shell. Each screen's success handler re-runs the
  bootstrap; the machine self-corrects.
  LoginPage: invoke('login').
  UnlockPage: reads database_exists for set/enter mode;
    invoke('unlock_database').
  EnrollPage: dialog.open() filtered to .gorka;
    invoke('import_enrollment_package').
  AppShell: placeholder for D.3.

D.3 - MAIN SHELL (efbbc4d)
  Replaced AppShell placeholder with the real layout:
  Sidebar + TopHeader + Outlet.
  Sidebar: 240px fixed, GORKA wordmark, seven nav items
  (Today, Debtors, Communication Tools, Actions, Documents,
  Copilot disabled with "Soon" badge, Settings). Active item
  uses accent tint. Icons from lucide-react at 16px.
  TopHeader: page title (route-driven), static "Sync not yet
  enabled" placeholder per spec 7.6, Avatar, logout button.
  StubPage: shared placeholder body.
  App.tsx: the shell step now wraps in HashRouter with seven
  routes. Entry flow remains a state machine.
  All values from design-tokens.css.

VERIFICATION (cloud, 2026-09-30):
  cargo build -p gorka-agent    PASS (2 warnings, unchanged)
  cargo build -p gorka-client   PASS (3 warnings, unchanged)
  cargo test -p gorka-shared    14/14 PASS
  npm install on cloud          OK, 0 vulnerabilities
  npm run build on cloud        PASS (227.44 kB JS, 7.43 kB CSS)
  Visual: agent binary renders Login page correctly
    (red wordmark, purple Sign In button). Confirmed.
  Visual (D.3): agent binary renders the shell correctly.
    Sidebar, header, seven nav items, Today stub verified.

DEVIATIONS: None.

DEVIATIONS: None.

NEXT: D.4 debtor list and profile, D.5 plan view, D.6
remaining screens. Then Agent end-to-end regression.
================================================================
STAGE D.4a-0 - PRIMITIVE GAP-FILL FOR DATA PAGES
================================================================

Date: September 30, 2026.
Commit: 7f122e1

PURPOSE
  Extend the D.1 primitive set so that the upcoming data
  pages (debtors list, debtor profile) can be built without
  hardcoding visual values or duplicating the Client's inline
  styles. Discovered during D.4a reconnaissance: D.1's
  reconnaissance read the Client's shell and entry-flow
  files, not its Collections.tsx or DebtorDetail.tsx. Five
  gaps fell out of that scope boundary. All additive.

  Framing rule: this is extending the design vocabulary
  discovered to be incomplete during the first data-page
  implementation. It is not fixing a bad D.1. D.1 was
  appropriately scoped to what was known at that point.

FILES CHANGED (10)
  agent-dashboard/src/styles/design-tokens.css   MODIFIED
  agent-dashboard/src/components/primitives/Modal.tsx    MODIFIED
  agent-dashboard/src/components/primitives/Button.tsx   MODIFIED
  agent-dashboard/src/components/primitives/Button.css   MODIFIED
  agent-dashboard/src/components/primitives/Select.tsx   NEW
  agent-dashboard/src/components/primitives/Select.css   NEW
  agent-dashboard/src/components/primitives/Textarea.tsx NEW
  agent-dashboard/src/components/primitives/Textarea.css NEW
  agent-dashboard/src/components/primitives/index.ts     MODIFIED
  agent-dashboard/src/components/TopHeader.tsx           MODIFIED

WHAT WAS ADDED

  design-tokens.css: 24 new tokens across four existing
  groups. Values sourced from Collections.tsx and
  DebtorDetail.tsx. No existing token name or value changed.
    - Badge colors (10): success, danger, neutral, info,
      warning tint/text pairs.
    - Data-page font sizes (5): badge 11px, label-sm 12px,
      value 15px, card-heading 16px, profile-title 26px.
    - Data-page spacing (8): hairline, gap-2xs/xs/sm/md,
      value-margin, list-row padding y/x.
    - Pill radius (1): 12px.

  Modal.tsx: closeOnOverlayClick prop, default true. Callers
  can opt out. Form modals use false so an accidental
  overlay click does not discard unsaved input.

  Button.tsx, Button.css: size prop (sm/md, default md) and
  iconOnly prop (default false). Chromeless icon buttons for
  row actions. Color driven by the existing variant axis.
  No new variant value.

  Select.tsx/.css, Textarea.tsx/.css: new primitives, thin
  wrappers modelled on Input.tsx/.css. No placeholder on
  Select. Textarea adds resize:vertical and min-height:90px.

  primitives/index.ts: export Select and Textarea.

  TopHeader.tsx: one prefix rule. /debtors/... now resolves
  to "Debtor Profile" instead of falling through to "GORKA".

CALL-SITE INVENTORY BEFORE EDITS
  Modal:     no external call sites. Confirmed by findstr.
  Button:    five, all in LoginPage.tsx, UnlockPage.tsx,
             EnrollPage.tsx. None use the new props.
  TopHeader: one (AppShell.tsx).

VERIFICATION (main, September 30, 2026)
  npm run build PASS (tsc clean, vite clean)
  JS 272.67 kB, CSS 12.01 kB.

EXPLICIT NON-CHANGES
  No Rust edit.
  No schema change.
  No new npm dependency.
  No change to any existing token value.
  No change to any existing variant behavior.
  No entry-flow change.
  No D.3 file change except TopHeader prefix rule.

DEVIATIONS
  Two deliberate deviations from the pre-D.4a promise that
  D.4a would touch no D.1 or D.3 files:
    - D.4a-0 exists as its own sub-slice, not folded into
      D.4a.
    - TopHeader.tsx is a D.3 file.
  Both were authorised by the founder after D.4a
  reconnaissance surfaced the gaps. Recorded as a
  founder-approved scope extension, not silent drift.

================================================================
STAGE D.4a - DEBTOR LIST AND DEBTOR PROFILE
================================================================

Date: September 30, 2026.
Commit: 32f1475

PURPOSE
  The Agent's first data-page slice. Debtor list with search
  and CRUD, and debtor profile with header card, debt card,
  and actions card. Frontend only.

FILES CHANGED (12)
  agent-dashboard/src/services/local.db.ts        NEW
  agent-dashboard/src/components/DebtorEditModal.tsx + .css  NEW
  agent-dashboard/src/components/DebtEditModal.tsx + .css    NEW
  agent-dashboard/src/components/ActionEditModal.tsx + .css  NEW
  agent-dashboard/src/pages/DebtorsPage.tsx + .css           NEW
  agent-dashboard/src/pages/DebtorProfilePage.tsx + .css     NEW
  agent-dashboard/src/App.tsx                     MODIFIED

WHAT WAS BUILT
  local.db.ts: Agent's own transport adapter. Types and
  methods only for the 15 commands D.4a uses. Thin adapter,
  no validation, no error translation, no logging, no
  organization-id injection.

  DebtorEditModal, DebtEditModal, ActionEditModal: three
  create/edit modals using the primitives. closeOnOverlayClick
  = false on all three (the D.4a-0 M4 decision, in use).

  DebtorsPage: list, search, add, edit, delete, empty state.
  DebtorProfilePage: header card (info grid), Debts card,
  Actions card. Add / edit / delete on both cards.

  App.tsx: two routes. /debtors replaced its StubPage.
  /debtors/:id added.

DESIGN CHOICES
  Shell owns the page title. The list page has no repeated
  h1 (the H1 decision from D.4a planning). The profile page
  has the debtor's own name as an h1, but that is content,
  not a duplicate of the shell title.

  Empty email and phone cells render '-' (hyphen), not an
  em-dash. ASCII-safe.

  Error banner: page-level retry button sits next to the
  ErrorBanner, not inside it.

  Form modals pass closeOnOverlayClick={false}.

  Errors bubble from local.db.ts without translation.

VERIFICATION (cloud, September 30, 2026)
  npm install on cloud OK, 0 vulnerabilities.
  npm run build PASS.
  Agent binary launched. Entry flow completed once
  (Login, Set password, Enroll via test-package.gorka).
  Behavioral tests, all PASS:
    List renders empty, then with a debtor after Add.
    Search by name/surname/email/phone.
    Edit debtor surname.
    Profile route loads, title reads "Debtor Profile".
    Header card shows all six fields.
    created_at unchanged after update.
    Add/edit/delete debt.
    Add/edit/delete action.
    Delete debtor navigates back to list.
    Create debtor B, edit surname.
    Quit, relaunch: Debtor B still present with edited
    surname, Debtor A stayed deleted.
  DB file confirmed on disk (gorka-agent.db + WAL).

EXPLICIT NON-CHANGES
  No Rust change.
  No schema change.
  No new dependency.
  No new command registration.
  No entry-flow change.
  No change to AppShell.tsx, Sidebar.tsx, StubPage.tsx.
  No change to design-tokens.css, primitives, or TopHeader.

DEVIATIONS
  One observation recorded, not fixed: the "+ Add Debtor"
  and debtor Edit/Delete controls are present in Phase 9.5
  because sync does not yet deliver debtors. In the funded
  phase these become redundant. Their continued presence
  is to be revisited at D.6 or before the Agent end-to-end
  regression. Founder accepted (Option A).

================================================================
STAGE D.4b-1 - COMMUNICATIONS AND DOCUMENTS CARDS
================================================================

Date: September 30, 2026.
Commit: c5e2d6e

PURPOSE
  Add the Communications and Documents cards to the debtor
  profile, mirroring the Client's DebtorDetail.tsx.

FILES CHANGED (5)
  agent-dashboard/src/services/local.db.ts              MODIFIED
  agent-dashboard/src/components/CommunicationEditModal.tsx + .css  NEW
  agent-dashboard/src/pages/DebtorProfilePage.tsx       MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.css       MODIFIED

WHAT WAS BUILT
  local.db.ts: Communication and Document types plus six
  methods (getCommunications, insertCommunication,
  deleteCommunication, getDocuments, uploadDocument,
  deleteDocument).

  CommunicationEditModal: create-only. No editingId. No
  update path. Duration field visible only when Type is
  CALL. Empty content sent as null. Duration sent as null
  when Type is not CALL or field is empty. Modal title
  "Log Communication".

  DebtorProfilePage: Communications card inserted between
  Debts and Actions so the card order matches the Client
  (Info, Debts, Communications, Actions, Documents). The
  Actions card moved from position 3 to position 4; same
  JSX, same handlers, position only. Documents card added
  at position 5, with a category dropdown and a
  label-wrapping-hidden-input upload control.

  DebtorProfilePage.css: upload row rules, document row
  rules.

DESIGN CHOICES
  Communications are append-only. No edit path. Corrections
  are delete-and-relog.

  File upload wraps a hidden input inside a styled label,
  mirroring the Client's pattern but using classes instead
  of inline styles. The hidden input is display:none.

  The category select is fixed at 200px via a
  page-scoped selector that wins specificity over the
  Select primitive's width:100%. No primitive change.

  Error banner: retry is not applicable on the profile
  cards; the card's own state is shown inline.

VERIFICATION (cloud, September 30, 2026)
  npm install OK. npm run build PASS.
  Behavioral tests, all PASS:
    Communications card rendered empty with heading and
    "+ Log Communication" button.
    Add CALL/OUTBOUND with duration 120. Row rendered
    with purple CALL badge, amber OUTBOUND badge,
    content, "120s".
    Add NOTE/INBOUND. Duration field hidden. Row rendered
    with purple NOTE badge, blue INBOUND badge.
    Delete one. Row disappeared.
    Documents card rendered empty with category select
    and "Choose file" label.
    Upload file with category "Contract". Row rendered
    with "contract - 205.1 KB".
    Category select correctly bound at upload time.
    Delete document. Row disappeared.
    Quit, relaunch: surviving communication and document
    persisted; deleted ones stayed deleted.

EXPLICIT NON-CHANGES
  No Rust change.
  No schema change.
  No new dependency.
  No new command registration.
  No change to App.tsx, AppShell.tsx, Sidebar.tsx,
    StubPage.tsx, TopHeader.tsx.
  No change to design-tokens.css or any primitive.

DEVIATIONS
  One observation recorded, not fixed: the Client's
  CommunicationEditModal uses a 480px width; the Agent uses
  the Modal primitive's 440px. Deliberate. Consistent with
  using the primitive everywhere rather than carrying the
  Client's per-modal inline width.

================================================================
STAGE D.4b-2a - DEBTOR PROFILE PHOTO
================================================================

Date: September 30, 2026.
Commits: 8ddb6ef (Rust), 3688d9f (frontend)

PURPOSE
  Display the debtor profile photo. The commands
  set_debtor_photo and get_debtor_photo already existed and
  were registered. The missing piece was reading the file
  bytes so the webview could display them.

DESIGN CONSTRAINT DISCOVERED
  The Agent's CSP has img-src: 'self' data: blob:. It does
  not include asset: or file:. Storing a path and pointing
  an <img> at it would be blocked. Three paths considered:
  enable the Tauri asset protocol (widens CSP), return a
  data URI from Rust (adds base64 crate), use the
  @tauri-apps/plugin-fs npm package (new dependency).
  Fourth path chosen: return bytes + MIME from Rust;
  frontend builds a blob: URL. CSP already allows blob:.
  No config change, no new crate, no new npm package.

FILES CHANGED (RUST - 3)
  shared/src/models.rs           MODIFIED (DebtorPhotoData struct)
  shared/src/debtors.rs          MODIFIED (read_debtor_photo,
                                 mime_from_extension)
  src-tauri-agent/src/main.rs    MODIFIED (one command,
                                 one registration line)

FILES CHANGED (FRONTEND - 3)
  agent-dashboard/src/services/local.db.ts              MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.tsx       MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.css       MODIFIED

WHAT WAS BUILT
  Rust: DebtorPhotoData { bytes: Vec<u8>, mime: String }.
  read_debtor_photo(conn, debtor_id) reads photo_path from
  the debtors table. Returns Ok(None) if NULL, empty, or
  file not found. Reads the file, infers MIME from the
  extension. mime_from_extension covers png, jpg/jpeg,
  gif, webp, bmp, else application/octet-stream. No
  organization scoping, matching set_debtor_photo and
  get_debtor_photo.

  Frontend: DebtorPhotoData type and two methods
  (setDebtorPhoto, readDebtorPhoto). DebtorProfilePage
  gains photoUrl state, photoUrlRef for URL revocation,
  loadPhoto (revokes the previous blob URL before
  replacing), handleChangePhoto (dialog plugin filtered
  to images, then setDebtorPhoto, then loadPhoto), and an
  unmount cleanup. Header card becomes two columns: photo
  block left, existing info grid right.

  DebtorProfilePage.css: header wrapper, photo block,
  photo (96x96, pill radius, object-fit cover),
  photo-change link.

DESIGN CHOICES
  Placeholder is the existing Avatar primitive (circular,
  accent background, initials). Photo size 96x96.

  Change-photo uses the dialog plugin, not a hidden
  file input. The dialog returns a path, which is what
  set_debtor_photo needs.

  No delete-photo control. Spec 11.6 mentions only
  "change photo".

  No role badge in the header card. Role display was
  deferred to D.4b-2b at the time this slice was planned.

VERIFICATION (cloud, September 30, 2026)
  Rust compiled on cloud: cargo build -p gorka-agent
  PASS (2 warnings unchanged), gorka-client PASS
  (3 warnings unchanged), shared tests 14/14 PASS.
  npm run build PASS.
  Behavioral tests, all PASS:
    Placeholder Avatar with initials rendered on the
    header card.
    Change photo opened the filtered dialog.
    Selected image rendered as a 96x96 circle.
    Quit, relaunch: photo persisted.

EXPLICIT NON-CHANGES
  No schema change. No new dependency.
  No tauri.conf.json change. No CSP change.
  No Client binary change. Client retains only
  get_debtor_photo; read_debtor_photo is Agent-only.
  No change to App.tsx, primitives, or design-tokens.

DEVIATIONS
  One. The D.4b-2a plan originally intended two cloud
  trips (one for the Rust half, one for the frontend).
  Founder authorised combining into one trip that also
  verified D.4b-2b's Rust. Recorded.

================================================================
STAGE D.4b-2b - RELATIONS CARD
================================================================

Date: September 30, 2026.
Commit: 68440de

PURPOSE
  The Relations card on the debtor profile. Add guarantors
  and pledgers, with collateral for pledgers. No Client
  reference existed: the Client Dashboard does not render
  relations. Designed from spec 11.6.

ZERO RUST, ZERO SCHEMA
  Reconnaissance discovered the role badge can read from
  debtor_relations.relation_type, which the Stage B.3
  functions already populate. The debtors.role column is
  not needed. All needed commands were already registered.
  No Rust change in this slice.

FILES CHANGED (5)
  agent-dashboard/src/services/local.db.ts              MODIFIED
  agent-dashboard/src/components/RelationEditModal.tsx + .css  NEW
  agent-dashboard/src/pages/DebtorProfilePage.tsx       MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.css       MODIFIED

WHAT WAS BUILT
  local.db.ts: DebtorRelation and DebtorRelationInput
  types plus three methods (getDebtorRelations,
  insertDebtorRelation, deleteDebtorRelation).

  RelationEditModal: two-mode modal.
    - Create new: name, surname, email, phone. If role is
      PLEDGER, two extra fields (collateral type,
      collateral description).
    - Link existing: search_debtors, pick a person. If
      PLEDGER, collateral fields pre-filled from the picked
      person's data.collateral.
  Modal title is role-specific: "Add Guarantor" or
  "Add Pledger". Modal opened by one of two header buttons.
  closeOnOverlayClick = false.

  DebtorProfilePage: Relations card positioned between
  Debts and Communications. Heading reads "Relations (N)"
  when N > 0, "Relations" when zero. Two header buttons.
  Row shows relation_type badge (GUARANTOR purple, PLEDGER
  info blue), related person's name as a navigation link,
  collateral line for PLEDGER rows, and a delete icon.
  loadRelations also fetches get_debtor per PLEDGER row to
  read data.collateral (N+1 accepted for MVP).

  DebtorProfilePage.css: card-header-actions (two buttons
  side by side), relation-link (underlined navigation).

DESIGN CHOICES
  Collateral stored at related_person.data.collateral =
  { type, description }. Per person, not per relation. The
  same pledger pledging different collateral for two
  different debtors cannot be expressed. Accepted MVP
  limitation.

  Link-existing does not change the picked person's role.
  A plain debtor linked as a guarantor stays DEBTOR.

  No edit-existing-relation. Delete and recreate.

  No reverse-direction view. A guarantor's own profile
  does not show "guarantor for X". This is the Stage B.3
  deferral, unchanged.

VERIFICATION (cloud, September 30, 2026)
  npm run build PASS.
  Behavioral tests, all PASS:
    Relations card rendered empty with heading
    "Relations".
    Add Guarantor (create new). Row rendered with purple
    GUARANTOR badge. Heading became "Relations (1)".
    Add Pledger with collateral type "House" and
    description "Two-story Manila". Row rendered with
    blue PLEDGER badge and collateral line. Heading
    "Relations (2)".
    Click relation row navigated to that person's own
    profile.
    Delete one relation. Row disappeared. Heading count
    updated.
    Quit, relaunch: surviving relation and collateral
    persisted.

EXPLICIT NON-CHANGES
  No Rust change in this slice.
  No schema change.
  No dependency.
  No change to App.tsx, AppShell.tsx, Sidebar.tsx,
    StubPage.tsx, TopHeader.tsx.
  No change to design-tokens or primitives.
  No change to how a guarantor or pledger is created at
    the data layer (that is D.4b-2c).

DEVIATIONS
  None recorded. One observation logged as a known UX
  gap: related persons appear in the debtors list without
  a role badge. Spec 11.6 asks for the badge. Deferred to
  D.4b-2c.

================================================================
STAGE D.4b-2c - ROLE COLUMN AND ORPHAN CLEANUP (RUST HALF)
================================================================

Date: October 1, 2026 (session continued from September 30).
Commit: c73373d

STATUS
  Rust half only. Frontend half is not started. This slice
  is not verified on cloud yet. Recorded here so that if
  the session ends mid-slice, the extraction log matches
  the repository state.

PURPOSE
  Prepare the Rust primitives the frontend needs to:
    - Show a Role column and a Debt/Currency column in
      the debtors list.
    - Hide + Add Guarantor, + Add Pledger, and the Debts
      card on a related person's profile.
    - Delete the person row when a relation is deleted
      and the person has no other relations, no debts, no
      communications, no actions, no documents.
    - Run a once-per-mount cleanup of orphaned related
      debtors.

  Also introduces the role write so future orphans are
  distinguishable from plain debtors.

FILES CHANGED (4)
  shared/src/models.rs            MODIFIED
  shared/src/debtors.rs           MODIFIED
  shared/src/relations.rs         MODIFIED
  src-tauri-agent/src/main.rs     MODIFIED

WHAT WAS ADDED

  shared/src/models.rs:
    RelatedDebtorRole { debtor_id, relation_type }
    DebtorDebtTotal { debtor_id, currency, total_amount }
    Both Serialize only.

  shared/src/debtors.rs:
    get_related_debtor_roles(conn, org_id)
      Single query: all rows in debtor_relations for the
      org. No dedup. A person can appear twice if
      guarantor for one debtor and pledger for another.

    get_debtor_debt_totals(conn, org_id)
      GROUP BY (debtor_id, currency). Excludes PAID and
      CANCELLED. One row per (debtor, currency).

    insert_related_debtor(conn, org_id, input, role)
      Atomic INSERT with the role column. Validates role
      in {GUARANTOR, PLEDGER}. This is the function the
      relation modal's create-new path uses so that a
      related person can be distinguished from a plain
      debtor.

    cleanup_orphaned_related_debtors(conn, storage, org_id)
      Selects debtors WHERE role != 'DEBTOR'. For each,
      runs the orphan check. Deletes qualifying rows and
      their files folders. Returns the count.

    is_orphaned_related_debtor (private helper)
      Five-table check: relations (as debtor_id OR as
      related_debtor_id), debts, communications, actions,
      documents. Any non-zero count means not orphaned.

  shared/src/relations.rs:
    db import added.
    delete_debtor_relation now takes storage. Flow:
      read related_debtor_id,
      delete the relation row,
      if the related person's role != DEBTOR and the
      five-table check confirms orphan status, delete
      the person row and their files folder.
      A plain debtor (role DEBTOR) is never touched.
    is_orphaned_related_debtor (private helper copy)
      Identical to the debtors.rs copy. Duplicated by
      design: it is private, and a public shared helper
      would expand the surface of debtors.rs.

  src-tauri-agent/src/main.rs:
    Four new commands registered:
      get_related_debtor_roles
      get_debtor_debt_totals
      insert_related_debtor
      cleanup_orphaned_related_debtors
    delete_debtor_relation now takes storage and passes
    it through.

DESIGN CHOICES
  Cleanup only targets rows with role != DEBTOR. Plain
  debtors are never deleted. This is why insert_related_debtor
  writes the role: without it, cleanup cannot tell
  "former related person now orphaned" from "plain debtor
  created and not yet used".

  The five-table check prevents the schema's ON DELETE
  CASCADE from silently deleting real debts,
  communications, actions, or documents when a related
  person is removed.

  cleanup_orphaned_related_debtors runs once per Debtors
  page mount, not as a background job. If the user is on
  another page, cleanup waits.

  Mixed currencies: get_debtor_debt_totals groups by
  (debtor_id, currency). The frontend will show one line
  per currency in the row and in the header total, not a
  summed number.

  Orphan cleanup is a destructive operation on page
  mount. Named plainly: opening the Debtors page may
  remove rows. The check is safe, but the behavior
  changed.

VERIFICATION
  NOT YET DONE. Cloud was on when this slice was
  committed. Founder paused to write this documentation
  before compiling the Rust on cloud. The next cloud
  action is:
    cd /d C:\gorka-app && git pull
    cargo build -p gorka-agent
    cargo build -p gorka-client
    cargo test -p gorka-shared
  Expected: gorka-agent 2 warnings, gorka-client 3
  warnings, shared 14/14.

FRONTEND HALF - NOT STARTED
  Planned but not written:
    local.db.ts: RelatedDebtorRole and DebtorDebtTotal
      types, getRelatedDebtorRoles and getDebtorDebtTotals
      methods, insertRelatedDebtor and
      cleanupOrphanedRelatedDebtors methods.
    RelationEditModal.tsx: create-new path switches from
      insertDebtor to insertRelatedDebtor.
    DebtorsPage.tsx: Role column between Phone and
      Actions, Debt and Currency columns, two-row sticky
      header (header row + TOTAL row), cleanup on mount,
      total reflects whole org (Option Y).
    DebtorsPage.css: sticky thead, scrollable container,
      role badge styling, right-aligned Debt/Currency
      cells.
    DebtorProfilePage.tsx: read get_related_debtor_roles,
      compute isRelated, hide + Add Guarantor and
      + Add Pledger, hide the Debts card on related
      persons.

EXPLICIT NON-CHANGES
  No schema change.
  No migration.
  No dependency.
  No Client binary change.
  No change to debtors.role default. Plain debtors are
    still inserted with role DEBTOR (the default).
  No change to get_debtors, search_debtors,
    get_debtor_count, or any existing command's behavior.
  No change to the Debt / Communication / Action /
    Document cards on a primary debtor's profile.

DEVIATIONS
  Two:
    - Documentation was deferred to end-of-session for
      D.4a, D.4b-1, D.4b-2a, D.4b-2b, and this slice.
      Founder authorised.
    - D.4b-2a and D.4b-2b were verified in one combined
      cloud trip instead of two. Founder authorised.

================================================================
END OF D.4b-2c (RUST HALF) RECORD
================================================================

================================================================
STAGE D.4b-2c - FRONTEND HALF
================================================================

Date: October 1, 2026.
Commit: 8689289

PURPOSE
  The frontend half of D.4b-2c. Consume the four commands
  the Rust half registered, and produce the list view the
  Rust half was designed for: Role column, Debt and
  Currency columns, sticky two-row header, cleanup on
  mount.

FILES CHANGED (5)
  agent-dashboard/src/services/local.db.ts              MODIFIED
  agent-dashboard/src/components/RelationEditModal.tsx  MODIFIED
  agent-dashboard/src/pages/DebtorsPage.tsx             MODIFIED
  agent-dashboard/src/pages/DebtorsPage.css             MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.tsx       MODIFIED

WHAT WAS BUILT

  local.db.ts:
    RelatedDebtorRole and DebtorDebtTotal types.
    getRelatedDebtorRoles, getDebtorDebtTotals,
    insertRelatedDebtor, cleanupOrphanedRelatedDebtors
    methods.

  RelationEditModal.tsx:
    Create-new path now calls insertRelatedDebtor
    instead of insertDebtor. This is where debtors.role
    gets written going forward (role = GUARANTOR or
    PLEDGER, depending on the modal's mode).

  DebtorsPage.tsx:
    Role column between Phone and Actions. Debt and
    Currency columns between Phone and Role. Two-row
    sticky header: header row + TOTAL row. TOTAL reflects
    the whole organization, not the search filter.
    Cleanup runs on mount, before loading debtors. Role
    badges per relation, mapped from
    getRelatedDebtorRoles. Debt and Currency cells render
    one line per currency, aligned.

  DebtorsPage.css:
    Scrollable container, sticky thead rows, role badge
    styles, right-aligned Debt and Currency cells.

  DebtorProfilePage.tsx:
    Reads get_related_debtor_roles. Computes isRelated.
    Hides + Add Guarantor, + Add Pledger, and the Debts
    card when isRelated is true.

VERIFICATION (main, October 1, 2026)
  npm run build PASS.
  One tsc iteration: RelatedDebtorRole imported but
  unused. Removed from the import list. Second build
  PASS.

VERIFICATION (cloud, October 1, 2026)
  git pull fast-forward 8f3f350..8689289, 5 files.
  npm run build PASS.
  Bundle hashes matched main exactly
  (index-CzxQDPYS.css, index-BOHRWtoc.js).
  Behavioral tests:
    Role column rendered. Peter PLEDGER, others empty.
    TOTAL row rendered below the header row.
    Peter's profile: no Debts card, no relation
    add-buttons.
    Bob's profile: both relation add-buttons present.
    Added a new guarantor. Appeared in the list with
    GUARANTOR badge.
    Deleted the new relation. Row removed. Heading count
    updated.
    Created a plain debtor. Stayed in the list after
    reload. Cleanup did not touch it.
    Persistence: quit and relaunch. State intact.
    Debt/Currency cells and TOTAL row with two
    currencies: correct.

EXPLICIT NON-CHANGES
  No Rust change in this half.
  No schema change.
  No dependency.
  No Client binary change.
  No CSS change to DebtorProfilePage.css.

DEVIATIONS
  None new for this half. The D.4b-2c Rust half's
  deviations (Dev-1, Dev-2, Dev-3) already recorded.

================================================================
STAGE D.4b-2c-FIX
================================================================

Date: October 1, 2026 (same session).
Commits: f0552aa (Rust), 060987c (frontend),
         7a5c01f (back button)

PURPOSE
  Correct D.4b-2c. Verification on cloud showed that
  D.4b-2c's filter (hide only "targets of an active
  relation") did not match the founder's rule. The
  founder's rule: the debtor list shows only primary
  debtors. Related persons never appear as rows,
  regardless of whether their relations are currently
  active.

  Also correct the back button on a related person's
  profile so it returns to the primary debtor it was
  reached from.

FILES CHANGED (6)
  shared/src/models.rs                     MODIFIED
  shared/src/debtors.rs                    MODIFIED
  src-tauri-agent/src/main.rs              MODIFIED
  agent-dashboard/src/services/local.db.ts MODIFIED
  agent-dashboard/src/pages/DebtorsPage.tsx MODIFIED
  agent-dashboard/src/pages/DebtorProfilePage.tsx MODIFIED

WHAT WAS BUILT

  Rust:
    shared/src/models.rs:
      PrimaryDebtorRelation { debtor_id, relation_type }.

    shared/src/debtors.rs:
      get_primary_debtors(conn, org_id)
        get_debtors plus "AND role = 'DEBTOR'".

      search_primary_debtors(conn, org_id, query)
        search_debtors plus "AND role = 'DEBTOR'".

      get_primary_debtor_relations(conn, org_id)
        SELECT debtor_id, relation_type FROM
        debtor_relations WHERE organization_id = ?1.
        debtor_id here is the primary debtor, not the
        related person. That is why a separate model
        struct is used.

    src-tauri-agent/src/main.rs:
      Three new commands registered:
        get_primary_debtors
        search_primary_debtors
        get_primary_debtor_relations

  Frontend:
    local.db.ts:
      PrimaryDebtorRelation type.
      getPrimaryDebtors, searchPrimaryDebtors,
      getPrimaryDebtorRelations methods.

    DebtorsPage.tsx:
      loadDebtors calls getPrimaryDebtors.
      handleSearch calls searchPrimaryDebtors.
      loadRolesAndTotals calls
      getPrimaryDebtorRelations.

    DebtorProfilePage.tsx:
      useLocation added.
      backState, backLabel, backTarget derived from
      location.state. Fallback to /debtors.
      openRelationProfile passes
      { fromDebtorId, fromDebtorLabel }.
      Both back buttons (error state and main) use
      backTarget and backLabel.

VERIFICATION (main, October 1, 2026)
  Rust half: no build attempted on main (cargo is
  blocked, per environment).
  Frontend half: npm run build PASS.
  One tsc iteration: PrimaryDebtorRelation imported
  but unused. Removed from the import list. Second
  build PASS.
  Back button: npm run build PASS.

VERIFICATION (cloud, October 1, 2026)
  git pull fast-forward. f0552aa and 060987c applied.
  cargo build -p gorka-agent PASS, 2 warnings.
  cargo build -p gorka-client PASS, 3 warnings.
  cargo test -p gorka-shared PASS, 14/14.
  npm run build PASS, hash index-DD3ivasN.js.
  Behavioral tests:
    Debtors list showed only Bob Bauman.
    Bob's Role cell showed [PLEDGER] and [GUARANTOR].
    Peter and Putin hidden from the list.
    Bob's Relations card listed both with clickable
    names.
    Peter's profile had no Debts card, no relation
    add-buttons.
    Putin's profile same.
    Created a plain debtor. Appeared in the list.
    Search "parker": zero rows. Search "bauman":
    Bob only.
    Deleted the plain debtor. Reload. Gone.
    Multi-currency stacking confirmed.
    Persistence across quit-relaunch confirmed.
  Back button fix:
    git pull fast-forward 060987c..7a5c01f.
    npm run build PASS, hash index-skXRVsZs.js.
    From Bob's profile, click Peter: back button reads
    "Back to Bauman, Bob", returns to Bob.
    From Bob's profile, click back: reads
    "Back to Debtors", returns to the list.
    All confirmed.

RESIDUE CLEANUP
  Two pre-fix residues removed manually on the cloud
  test instance. No code change.
    Trump Donald - deleted via the UI.
    Peter Parker - relation deleted, row deleted,
    re-created via + Add Pledger on Bob's profile so
    the new role write fires.

EXPLICIT NON-CHANGES
  No schema change.
  No migration.
  No dependency.
  No Client binary change.
  No change to get_debtors, search_debtors, or any
    existing command's behavior. The Client binary
    continues to use them.
  No change to the profile's Communications, Actions,
    or Documents cards. Related persons keep all
    case-file tools.
  No CSS change in the back-button fix.

DEVIATIONS
  Two, both founder-authorised:
    - Code first, documentation second (Dev-4 in
      DECISIONS.md).
    - Spec amended after cloud verification, not
      before (Dev-5 in DECISIONS.md).

================================================================
END OF D.4b-2c-FIX RECORD
================================================================
END OF DOCUMENT
================================================================