// shared/src/connectors/ai_boundary.rs
//
// Slice 3a. The single public entry point for the outbound AI request
// boundary: strict parse, schema validation, identifier scan, JCS
// canonicalization.
//
// Authority: SLICE 3a — SELF-CONTAINED SECTION 4, §4.2.
// Decisions applied: D1(a) manual Value walk; D2 DisallowedOption
// { name: String }; D3 three-case rule for unknown keys.
//
// JCS crate: serde_jcs 0.2.0
// RFC 8785 conformance verified against:
//   - RFC 8785 Appendix A vectors: key sort, float 1.0 -> "1",
//     integer/float distinction, short escapes.
//   - ECMAScript Number-to-String cases: 1.0 -> "1", 0.1 -> "0.1",
//     0.5 -> "0.5".
// Verified on: 2026-10-12 (during slice 3a; test 3a-14 is the gate).

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::connectors::ai_request::RawOutboundAiRequest;

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

/// Every way the boundary can refuse to produce a canonical request.
/// Callers that receive a block must not construct a provider call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BoundaryBlock {
    /// A field the boundary does not recognize at this level.
    /// Path is a dotted JSON path, e.g. "context.debtor.unknown_key".
    UnknownField { path: String },

    /// A value whose type or range violates the schema.
    TypeMismatch { path: String, expected: &'static str },

    /// A pattern matching a known debtor identifier was found in a
    /// free-text field.
    IdentifierDetected {
        category: &'static str,
        field: &'static str,
    },

    /// A request_options key outside the allowlist.
    DisallowedOption { name: String },

    /// JCS canonicalization failed for a reason other than the schema.
    CanonicalizationFailed { detail: String },
}

// ---------------------------------------------------------------------
// Canonical output
// ---------------------------------------------------------------------

/// The validated, canonicalized form. This is what travels in
/// SendRequest.body as JSON.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CanonicalAiRequest {
    pub system_prompt: String,
    pub user_message: String,
    pub context_json: String,
    pub model: String,
    pub options_json: String,
}

impl CanonicalAiRequest {
    /// Canonical JSON for the whole request. Deterministic: byte-equal
    /// for equal inputs. Keys sorted lexicographically at every level.
    pub fn to_json(&self) -> String {
        let v = serde_json::json!({
            "context_json": self.context_json,
            "model": self.model,
            "options_json": self.options_json,
            "system_prompt": self.system_prompt,
            "user_message": self.user_message,
        });
        serde_jcs::to_string(&v).expect("JCS of string-only object cannot fail")
    }

    /// Parse a canonical or non-canonical JSON blob into the struct.
    /// Unknown fields rejected.
    pub fn from_json(body: &str) -> Result<Self, String> {
        serde_json::from_str::<CanonicalAiRequest>(body).map_err(|e| e.to_string())
    }
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------

/// The only public entry point the Copilot caller uses.
///
/// 1. Strict-parse `raw_json` into a Value.
/// 2. Manual schema walk (pass 1) — produces UnknownField,
///    DisallowedOption, TypeMismatch with dotted paths.
/// 3. Typed deserialization (pass 2) — defense in depth via
///    deny_unknown_fields.
/// 4. Identifier scan, range checks, JCS canonicalization.
pub fn parse_and_validate(raw_json: &str) -> Result<CanonicalAiRequest, BoundaryBlock> {
    let v: Value = serde_json::from_str(raw_json).map_err(|_| BoundaryBlock::TypeMismatch {
        path: String::new(),
        expected: "JSON",
    })?;

    walk_raw(&v)?;

    let typed: RawOutboundAiRequest =
        serde_json::from_value(v).map_err(|e| BoundaryBlock::CanonicalizationFailed {
            detail: format!(
                "internal: typed deserialization failed after walker passed: {}",
                e
            ),
        })?;

    validate_typed(&typed)
}

// ---------------------------------------------------------------------
// Internal typed validator
// ---------------------------------------------------------------------

/// Internal. Not part of the public boundary contract. Integration
/// tests exercise the boundary only through parse_and_validate.
/// Slice 4's Copilot command is the intended future caller.
pub(crate) fn validate_typed(
    req: &RawOutboundAiRequest,
) -> Result<CanonicalAiRequest, BoundaryBlock> {
    scan_identifiers(&req.system_prompt, "system_prompt")?;
    scan_identifiers(&req.user_message, "user_message")?;

    if let Some(t) = req.request_options.temperature {
        if !(0.0..=2.0).contains(&t) {
            return Err(BoundaryBlock::TypeMismatch {
                path: "request_options.temperature".into(),
                expected: "temperature in [0.0, 2.0]",
            });
        }
    }
    if let Some(m) = req.request_options.max_output_tokens {
        if !(1..=32768).contains(&m) {
            return Err(BoundaryBlock::TypeMismatch {
                path: "request_options.max_output_tokens".into(),
                expected: "max_output_tokens in [1, 32768]",
            });
        }
    }

    // context_json: JCS of the typed Context.
    let context_value = serde_json::to_value(&req.context).map_err(|e| {
        BoundaryBlock::CanonicalizationFailed {
            detail: format!("context serialization failed: {}", e),
        }
    })?;
    let context_json = serde_jcs::to_string(&context_value).map_err(|e| {
        BoundaryBlock::CanonicalizationFailed {
            detail: format!("context JCS failed: {}", e),
        }
    })?;

    // options_json: hand-built JCS-shaped object.
    // Only present fields appear; keys sorted ("max_output_tokens" <
    // "temperature"). f32 formatting uses Rust Display, which yields
    // the shortest round-tripping decimal and drops ".0" (matching
    // ECMAScript Number-to-String for our range).
    let options_json = build_options_json(
        req.request_options.temperature,
        req.request_options.max_output_tokens,
    );

    Ok(CanonicalAiRequest {
        system_prompt: req.system_prompt.clone(),
        user_message: req.user_message.clone(),
        context_json,
        model: req.model.clone(),
        options_json,
    })
}

fn build_options_json(temp: Option<f32>, max_tokens: Option<u32>) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(m) = max_tokens {
        parts.push(format!("\"max_output_tokens\":{}", m));
    }
    if let Some(t) = temp {
        parts.push(format!("\"temperature\":{}", t));
    }
    format!("{{{}}}", parts.join(","))
}

// ---------------------------------------------------------------------
// Manual schema walker — pass 1
// ---------------------------------------------------------------------

const TOP_LEVEL_KEYS: &[&str] = &[
    "system_prompt",
    "user_message",
    "context",
    "model",
    "request_options",
];

const OPTIONS_KEYS: &[&str] = &["temperature", "max_output_tokens"];

fn walk_raw(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: String::new(),
        expected: "object",
    })?;

    for k in obj.keys() {
        if !TOP_LEVEL_KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField { path: k.clone() });
        }
    }
    for req in TOP_LEVEL_KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: (*req).into(),
                expected: "present",
            });
        }
    }

    walk_string(obj.get("system_prompt").unwrap(), "system_prompt")?;
    walk_string(obj.get("user_message").unwrap(), "user_message")?;
    walk_string(obj.get("model").unwrap(), "model")?;
    walk_context(obj.get("context").unwrap())?;
    walk_request_options(obj.get("request_options").unwrap())?;
    Ok(())
}

fn walk_string(v: &Value, path: &str) -> Result<(), BoundaryBlock> {
    if v.is_string() {
        Ok(())
    } else {
        Err(BoundaryBlock::TypeMismatch {
            path: path.into(),
            expected: "string",
        })
    }
}

fn walk_int(v: &Value, path: &str) -> Result<(), BoundaryBlock> {
    if v.is_i64() || v.is_u64() {
        Ok(())
    } else {
        Err(BoundaryBlock::TypeMismatch {
            path: path.into(),
            expected: "integer",
        })
    }
}

fn walk_context(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "context".into(),
        expected: "object",
    })?;
    const KEYS: &[&str] = &["debtor", "communicationHistory", "debts", "indicators"];
    for k in obj.keys() {
        if !KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField {
                path: format!("context.{}", k),
            });
        }
    }
    for req in KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: format!("context.{}", req),
                expected: "present",
            });
        }
    }
    walk_debtor(obj.get("debtor").unwrap())?;
    walk_comm_history(obj.get("communicationHistory").unwrap())?;
    walk_debts(obj.get("debts").unwrap())?;
    walk_indicators(obj.get("indicators").unwrap())?;
    Ok(())
}

fn walk_debtor(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "context.debtor".into(),
        expected: "object",
    })?;
    const KEYS: &[&str] = &["amountRange", "daysOverdueRange"];
    for k in obj.keys() {
        if !KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField {
                path: format!("context.debtor.{}", k),
            });
        }
    }
    for req in KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: format!("context.debtor.{}", req),
                expected: "present",
            });
        }
    }
    walk_string(obj.get("amountRange").unwrap(), "context.debtor.amountRange")?;
    walk_string(
        obj.get("daysOverdueRange").unwrap(),
        "context.debtor.daysOverdueRange",
    )?;
    Ok(())
}

fn walk_comm_history(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "context.communicationHistory".into(),
        expected: "object",
    })?;
    const KEYS: &[&str] = &[
        "totalCount",
        "emailCount",
        "smsCount",
        "voiceCount",
        "responseRateBand",
    ];
    for k in obj.keys() {
        if !KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField {
                path: format!("context.communicationHistory.{}", k),
            });
        }
    }
    for req in KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: format!("context.communicationHistory.{}", req),
                expected: "present",
            });
        }
    }
    walk_int(
        obj.get("totalCount").unwrap(),
        "context.communicationHistory.totalCount",
    )?;
    walk_int(
        obj.get("emailCount").unwrap(),
        "context.communicationHistory.emailCount",
    )?;
    walk_int(
        obj.get("smsCount").unwrap(),
        "context.communicationHistory.smsCount",
    )?;
    walk_int(
        obj.get("voiceCount").unwrap(),
        "context.communicationHistory.voiceCount",
    )?;
    walk_string(
        obj.get("responseRateBand").unwrap(),
        "context.communicationHistory.responseRateBand",
    )?;
    Ok(())
}

fn walk_debts(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "context.debts".into(),
        expected: "object",
    })?;
    const KEYS: &[&str] = &["totalCount", "paidCount", "overdueCount"];
    for k in obj.keys() {
        if !KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField {
                path: format!("context.debts.{}", k),
            });
        }
    }
    for req in KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: format!("context.debts.{}", req),
                expected: "present",
            });
        }
    }
    walk_int(
        obj.get("totalCount").unwrap(),
        "context.debts.totalCount",
    )?;
    walk_int(obj.get("paidCount").unwrap(), "context.debts.paidCount")?;
    walk_int(
        obj.get("overdueCount").unwrap(),
        "context.debts.overdueCount",
    )?;
    Ok(())
}

fn walk_indicators(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "context.indicators".into(),
        expected: "object",
    })?;
    const KEYS: &[&str] = &[
        "paymentReliability",
        "engagementLevel",
        "communicationPreference",
    ];
    for k in obj.keys() {
        if !KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::UnknownField {
                path: format!("context.indicators.{}", k),
            });
        }
    }
    for req in KEYS {
        if !obj.contains_key(*req) {
            return Err(BoundaryBlock::TypeMismatch {
                path: format!("context.indicators.{}", req),
                expected: "present",
            });
        }
    }
    walk_string(
        obj.get("paymentReliability").unwrap(),
        "context.indicators.paymentReliability",
    )?;
    walk_string(
        obj.get("engagementLevel").unwrap(),
        "context.indicators.engagementLevel",
    )?;
    // communicationPreference: Option<String> — null or string accepted.
    let cp = obj.get("communicationPreference").unwrap();
    if !cp.is_null() && !cp.is_string() {
        return Err(BoundaryBlock::TypeMismatch {
            path: "context.indicators.communicationPreference".into(),
            expected: "string or null",
        });
    }
    Ok(())
}

fn walk_request_options(v: &Value) -> Result<(), BoundaryBlock> {
    let obj = v.as_object().ok_or(BoundaryBlock::TypeMismatch {
        path: "request_options".into(),
        expected: "object",
    })?;
    for k in obj.keys() {
        if !OPTIONS_KEYS.contains(&k.as_str()) {
            return Err(BoundaryBlock::DisallowedOption { name: k.clone() });
        }
    }
    if let Some(t) = obj.get("temperature") {
        if !t.is_number() && !t.is_null() {
            return Err(BoundaryBlock::TypeMismatch {
                path: "request_options.temperature".into(),
                expected: "number",
            });
        }
    }
    if let Some(m) = obj.get("max_output_tokens") {
        if !m.is_number() && !m.is_null() {
            return Err(BoundaryBlock::TypeMismatch {
                path: "request_options.max_output_tokens".into(),
                expected: "number",
            });
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------
// Identifier scans
// ---------------------------------------------------------------------
//
// Applied to system_prompt and user_message only. The type-level
// allowlist is the primary guard; this scan is an additional safeguard.
// Check order is email -> invoice -> currency -> phone so more specific
// patterns win. Without the invoice-before-phone order, "INV-2026-0042"
// would also match the phone class [0-9 ()\-].

fn scan_identifiers(text: &str, field: &'static str) -> Result<(), BoundaryBlock> {
    if looks_like_email(text) {
        return Err(BoundaryBlock::IdentifierDetected {
            category: "email",
            field,
        });
    }
    if looks_like_invoice(text) {
        return Err(BoundaryBlock::IdentifierDetected {
            category: "invoice",
            field,
        });
    }
    if looks_like_currency(text) {
        return Err(BoundaryBlock::IdentifierDetected {
            category: "currency",
            field,
        });
    }
    if looks_like_phone(text) {
        return Err(BoundaryBlock::IdentifierDetected {
            category: "phone",
            field,
        });
    }
    Ok(())
}

fn looks_like_email(s: &str) -> bool {
    for token in s.split_whitespace() {
        if let Some(at) = token.find('@') {
            if at > 0 && at < token.len() - 1 {
                let domain = &token[at + 1..];
                if domain.contains('.')
                    && !domain.starts_with('.')
                    && !domain.ends_with('.')
                {
                    return true;
                }
            }
        }
    }
    false
}

fn looks_like_invoice(s: &str) -> bool {
    // INV- prefix anywhere.
    if s.contains("INV-") {
        return true;
    }
    // '#' followed by an alphanumeric.
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'#' && i + 1 < bytes.len() && bytes[i + 1].is_ascii_alphanumeric() {
            return true;
        }
    }
    // Long alphanumeric token with at least two dashes.
    for token in s.split_whitespace() {
        if token.is_empty() {
            continue;
        }
        let all_ok = token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-');
        if !all_ok {
            continue;
        }
        let dashes = token.chars().filter(|c| *c == '-').count();
        let alnum = token.chars().filter(|c| c.is_ascii_alphanumeric()).count();
        if dashes >= 2 && alnum >= 6 {
            return true;
        }
    }
    false
}

fn looks_like_currency(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    for i in 0..chars.len() {
        let c = chars[i];
        if c == '$' || c == '€' || c == '£' {
            if i + 1 < chars.len() && chars[i + 1].is_ascii_digit() {
                return true;
            }
            if i + 2 < chars.len()
                && chars[i + 1] == ' '
                && chars[i + 2].is_ascii_digit()
            {
                return true;
            }
        }
    }
    // ISO code adjacent to digits (optionally one space).
    for code in ["USD", "PHP", "EUR", "GBP", "JPY"] {
        let mut from = 0;
        while let Some(rel) = s[from..].find(code) {
            let abs = from + rel;
            let after = abs + code.len();
            let bytes = s.as_bytes();
            if after < bytes.len() {
                if bytes[after].is_ascii_digit() {
                    return true;
                }
                if bytes[after] == b' '
                    && after + 1 < bytes.len()
                    && bytes[after + 1].is_ascii_digit()
                {
                    return true;
                }
            }
            from = abs + 1;
        }
    }
    false
}

fn looks_like_phone(s: &str) -> bool {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let mut j = i;
        if j < bytes.len() && bytes[j] == b'+' {
            j += 1;
        }
        let class_start = j;
        let mut digits = 0usize;
        while j < bytes.len() {
            let b = bytes[j];
            if b.is_ascii_digit() {
                digits += 1;
                j += 1;
            } else if b == b' ' || b == b'(' || b == b')' || b == b'-' {
                j += 1;
            } else {
                break;
            }
        }
        if (j - class_start) >= 7 && digits >= 7 {
            return true;
        }
        i += 1;
    }
    false
}