// shared/src/prompts.rs
//
// Slice 4. Fixed prompt templates for the AI Strategy Engine.
// Authority: SLICE 4 — MINI SPEC v1.0 (FROZEN), §5.
//
// Templates contain no placeholders that receive debtor data.
// The Context travels in the structured `context` field of the
// outbound request, never concatenated into message text. Any
// change to the literal text below changes PROMPT_VERSION.

pub const PROMPT_VERSION: &str = "slice4-v1";

pub const SYSTEM_PROMPT: &str = "\
You are a collections-communication assistant. You will receive a \
single outbound request whose `context` field is a structured JSON \
object describing a debtor account at a banded level of detail. \
Using only that context, produce a recommended communication \
strategy and a draft outbound email. Respond with exactly one JSON \
object and nothing else. The object must contain keys \
`recommendation`, `draft`, and `riskFlags`. `recommendation` must \
contain string fields `channel`, `priority`, `tone`, `timing`, and \
`rationale`. `draft` must contain string fields `subject` and \
`body`. `riskFlags` must be an array of strings. Do not include any \
other keys anywhere in the object.";

pub const USER_MESSAGE_TEMPLATE: &str = "\
Analyze the provided structured context and produce the JSON \
response described in the system prompt. Emit only the JSON object, \
with no leading or trailing text.";