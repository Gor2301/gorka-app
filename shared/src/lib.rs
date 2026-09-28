// gorka-shared
//
// Shared Rust library for the GORKA desktop applications.
// Holds the GORKA Rust core: models, db, auth, enrollment,
// sync primitives, and business logic.
//
// Both gorka-client (Client Dashboard) and gorka-agent
// (Agent App) depend on this crate.

pub mod enrollment;
pub mod models;
pub mod storage;

pub fn placeholder() -> &'static str {
    "gorka-shared"
}