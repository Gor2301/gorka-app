// shared/src/strategy.rs
//
// Slice 4. Strategy Engine.
// Authority: SLICE 4 — MINI SPEC v1.0 (FROZEN), §6.
//
// Contract:
//   - build_fallback_input is called first, before any AI work.
//     A failure there is a genuine Err(StrategyError::ContextInvalid).
//   - The deterministic fallback recommendation is computed from the
//     fallback input and is always available.
//   - Any failure on the AI path — build_context, boundary block,
//     adapter error, malformed or oversized answer, schema violation —
//     returns Ok(StrategyOutcome { source: Fallback, ... }), never Err.
//
// Implementation note: §6.5 names `RawOutboundAiRequest` as the value
// to serialize. That type derives Deserialize only, and ai_request.rs
// is in the §3 not-touched list. The JSON value built here has exactly
// the shape that type would deserialize to.

use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::connectors::ai_boundary::parse_and_validate;
use crate::connectors::{ConnectorAdapter, SendRequest};
use crate::context;
use crate::prompts;
use crate::recommendation::{self, Channel, Priority, Recommendation, Timing, Tone};

pub const MAX_RESPONSE_BYTES: usize = 65_536;
pub const MAX_SUBJECT_LEN: usize = 200;
pub const MAX_BODY_LEN: usize = 20_000;
pub const MAX_RATIONALE_LEN: usize = 500;
pub const MAX_RISK_FLAGS: usize = 8;
pub const MAX_RISK_FLAG_LEN: usize = 100;

/// Prefix attached to the model's rationale before it leaves analyze.
/// The em-dash is U+2014. Verbatim from §6.5.
const RATIONALE_PREFIX: &str = "AI explanation \u{2014} unverified: ";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StrategySource {
    Ai,
    Fallback,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StrategyOutcome {
    pub source: StrategySource,
    pub recommendation: Recommendation,
    pub draft_subject: Option<String>,
    pub draft_body: String,
    pub rationale: Option<String>,
    pub risk_flags: Vec<String>,
    pub prompt_version: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StrategyError {
    /// The fallback input could not be built. No recommendation is
    /// available at all.
    ContextInvalid(String),
    /// Reserved for a future path that can distinguish a database
    /// read failure from a logical absence. Not produced in Slice 4:
    /// build_fallback_input's Result<_, String> does not carry the
    /// distinction, and §6.4 maps every failure there to ContextInvalid.
    DbError(String),
}

pub fn analyze(
    conn: &rusqlite::Connection,
    org_id: &str,
    debtor_id: &str,
    reference_time: DateTime<Utc>,
    model: &str,
    adapter: &dyn ConnectorAdapter,
) -> Result<StrategyOutcome, StrategyError> {
    // Step 1 — fallback input first. Failure here is fatal.
    let fallback_input = context::build_fallback_input(conn, org_id, debtor_id, reference_time)
        .map_err(StrategyError::ContextInvalid)?;

    let fallback_rec =
        recommendation::fallback(fallback_input.days_overdue, fallback_input.response_rate);

    // Step 2 — AI path. Any failure falls back.
    match try_ai_path(conn, org_id, debtor_id, reference_time, model, adapter) {
        Ok(outcome) => Ok(outcome),
        Err(()) => Ok(fallback_outcome(fallback_rec)),
    }
}

fn fallback_outcome(rec: Recommendation) -> StrategyOutcome {
    StrategyOutcome {
        source: StrategySource::Fallback,
        recommendation: rec,
        draft_subject: None,
        draft_body: String::new(),
        rationale: None,
        risk_flags: Vec::new(),
        prompt_version: prompts::PROMPT_VERSION,
    }
}

/// Every failure on this path is represented by `Err(())`; the caller
/// converts it to the fallback outcome. Nothing here may propagate.
fn try_ai_path(
    conn: &rusqlite::Connection,
    org_id: &str,
    debtor_id: &str,
    reference_time: DateTime<Utc>,
    model: &str,
    adapter: &dyn ConnectorAdapter,
) -> Result<StrategyOutcome, ()> {
    let ctx = context::build_context(conn, org_id, debtor_id, reference_time).map_err(|_| ())?;

    let raw_value = serde_json::json!({
        "system_prompt": prompts::SYSTEM_PROMPT,
        "user_message": prompts::USER_MESSAGE_TEMPLATE,
        "context": ctx,
        "model": model,
        "request_options": {
            "temperature": 0.2,
            "max_output_tokens": 1024,
        },
    });
    let raw_json = serde_json::to_string(&raw_value).map_err(|_| ())?;
    let canonical = parse_and_validate(&raw_json).map_err(|_| ())?;

    let req = SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical.to_json(),
    };
    let send_result = adapter.send(&req).map_err(|_| ())?;

    let answer = send_result
        .provider_response
        .as_ref()
        .and_then(|v| v.get("answer"))
        .and_then(|v| v.as_str())
        .ok_or(())?;
    if answer.is_empty() || answer.trim().is_empty() {
        return Err(());
    }
    if answer.len() > MAX_RESPONSE_BYTES {
        return Err(());
    }

    let parsed: AiResponse = serde_json::from_str(answer).map_err(|_| ())?;

    if parsed.recommendation.channel != "EMAIL" {
        return Err(());
    }
    let priority = match parsed.recommendation.priority.as_str() {
        "LOW" => Priority::Low,
        "NORMAL" => Priority::Normal,
        "HIGH" => Priority::High,
        _ => return Err(()),
    };
    let tone = match parsed.recommendation.tone.as_str() {
        "FRIENDLY" => Tone::Friendly,
        "FIRM" => Tone::Firm,
        "URGENT" => Tone::Urgent,
        "FINAL_NOTICE" => Tone::FinalNotice,
        _ => return Err(()),
    };
    let timing = match parsed.recommendation.timing.as_str() {
        "WITHIN_24_HOURS" => Timing::Within24Hours,
        "WITHIN_3_DAYS" => Timing::Within3Days,
        "WITHIN_7_DAYS" => Timing::Within7Days,
        _ => return Err(()),
    };

    if parsed.draft.subject.chars().count() > MAX_SUBJECT_LEN {
        return Err(());
    }
    let body_chars = parsed.draft.body.chars().count();
    if body_chars == 0 || body_chars > MAX_BODY_LEN {
        return Err(());
    }
    if parsed.draft.body.trim().is_empty() {
        return Err(());
    }
    if parsed.recommendation.rationale.chars().count() > MAX_RATIONALE_LEN {
        return Err(());
    }
    if parsed.risk_flags.len() > MAX_RISK_FLAGS {
        return Err(());
    }
    for flag in &parsed.risk_flags {
        if flag.chars().count() > MAX_RISK_FLAG_LEN {
            return Err(());
        }
    }

    Ok(StrategyOutcome {
        source: StrategySource::Ai,
        recommendation: Recommendation {
            channel: Channel::Email,
            priority,
            tone,
            timing,
        },
        draft_subject: Some(parsed.draft.subject),
        draft_body: parsed.draft.body,
        rationale: Some(format!(
            "{}{}",
            RATIONALE_PREFIX, parsed.recommendation.rationale
        )),
        risk_flags: parsed.risk_flags,
        prompt_version: prompts::PROMPT_VERSION,
    })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AiResponse {
    recommendation: AiRecommendation,
    draft: AiDraft,
    #[serde(rename = "riskFlags")]
    risk_flags: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AiRecommendation {
    channel: String,
    priority: String,
    tone: String,
    timing: String,
    rationale: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AiDraft {
    subject: String,
    body: String,
}