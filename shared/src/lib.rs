// gorka-shared
//
// Shared Rust library for the GORKA desktop applications.
// Holds the GORKA Rust core: models, db, auth, enrollment,
// sync primitives, and business logic.
//
// Both gorka-client (Client Dashboard) and gorka-agent
// (Agent App) depend on this crate.

pub mod actions;
pub mod communications;
pub mod db;
pub mod debtors;
pub mod debts;
pub mod documents;
pub mod enrollment;
pub mod models;
pub mod storage;
pub mod sync;

pub fn placeholder() -> &'static str {
    "gorka-shared"
}