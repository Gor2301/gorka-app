// shared/src/connectors/ai_request.rs
//
// Slice 3a. Typed shape of a parsed outbound AI request.
//
// Deserialization enforces structure. Unknown fields are rejected
// at parse time by `deny_unknown_fields`. The boundary validator
// receives an already-typed value; it cannot be fooled by a field
// that was silently dropped.
//
// Authority: SLICE 3a — SELF-CONTAINED SECTION 4, §4.1.

use serde::Deserialize;

/// The typed shape of an outbound AI request.
///
/// Unknown fields are rejected at deserialization by
/// `deny_unknown_fields`. Wrong types fail deserialization.
/// The validator (ai_boundary) receives an already-typed value;
/// it cannot be fooled by a field that was silently dropped.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawOutboundAiRequest {
    pub system_prompt: String,
    pub user_message: String,
    pub context: crate::context::Context,
    pub model: String,
    pub request_options: RawRequestOptions,
}

/// The request-options object. Only two keys are recognized.
/// Any other key is rejected at deserialization; the boundary's
/// manual walker produces `DisallowedOption` for the same input
/// before this type is reached.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawRequestOptions {
    pub temperature: Option<f32>,
    pub max_output_tokens: Option<u32>,
}