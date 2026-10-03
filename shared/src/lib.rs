// gorka-shared
//
// Shared Rust library for the GORKA desktop applications.
// Holds the GORKA Rust core: models, db, auth, enrollment,
// sync primitives, and business logic.
//
// Both gorka-client (Client Dashboard) and gorka-agent
// (Agent App) depend on this crate.

pub mod actions;
pub mod auth_http;
pub mod calendar;
pub mod communications;
pub mod dashboard;
pub mod db;
pub mod debtors;
pub mod debts;
pub mod documents;
pub mod enrollment;
pub mod models;
pub mod relations;
pub mod storage;
pub mod sync;
pub mod sync_events;
pub mod sync_engine;
pub mod sync_discovery;
pub mod sync_handshake;
pub mod sync_parse;
pub mod sync_pipeline;
pub mod sync_session;
pub mod sync_transport;

pub fn placeholder() -> &'static str {
    "gorka-shared"
}