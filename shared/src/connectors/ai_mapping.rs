// shared/src/connectors/ai_mapping.rs
//
// Slice 3a. Test-support framework for 3b's semantic-identity tests.
// No consumers in 3a. Consumed in 3b.
//
// Purpose: given a provider request body constructed by an adapter,
// prove that every canonical field survives translation to its
// designated location, and that no additional field was silently
// added.
//
// Authority: SLICE 3a — SELF-CONTAINED SECTION 4, §4.3.

use serde_json::Value;

/// Where a canonical field appears in the provider's request.
#[derive(Debug, Clone)]
pub enum FieldLocation {
    /// A path within the JSON request body.
    Body(Vec<&'static str>),

    /// A segment in the parsed request URL's path.
    /// `segment_name` is the literal segment before the target.
    /// The target follows it. Used for Gemini's model-in-path shape.
    UrlPathSegment {
        segment_name: &'static str,
        following_segment: bool,
    },
}

#[derive(Debug, Clone)]
pub struct FieldMapping {
    pub canonical_field: &'static str,
    pub location: FieldLocation,
}

#[derive(Debug, Clone)]
pub struct FixedConstant {
    pub location: Vec<&'static str>,
    pub value: Value,
}

/// Implemented by each provider's 3b test module.
pub trait ProviderEnvelopeMapping {
    fn map_fields() -> Vec<FieldMapping>;
    fn fixed_constants() -> Vec<FixedConstant>;

    /// Extract the typed JSON value at a body path. Returns None
    /// if any segment is missing.
    fn extract_value<'a>(body: &'a Value, path: &[&str]) -> Option<&'a Value>;

    /// Every leaf path in the body, as string-segment vectors.
    fn all_leaf_paths(body: &Value) -> Vec<Vec<String>>;
}

// ---------------------------------------------------------------------
// The walker
// ---------------------------------------------------------------------

/// The walker. Test-only usage.
///
/// Given a provider body and parsed URL path segments, verify:
///   1. Every mapped canonical field's value equals the expected
///      value from the CanonicalAiRequest.
///   2. Every fixed constant's value matches at its location.
///   3. No leaf exists outside the union of mapped and fixed
///      locations. Any extra leaf -> Err.
pub fn verify_semantic_identity<M: ProviderEnvelopeMapping>(
    body: &Value,
    url_path_segments: &[&str],
    canonical: &crate::connectors::ai_boundary::CanonicalAiRequest,
) -> Result<(), String> {
    let mappings = M::map_fields();
    let constants = M::fixed_constants();

    // --- 1. Every mapped canonical field equals its expected value.

    for m in &mappings {
        let expected = expected_value_for(canonical, m.canonical_field);
        match &m.location {
            FieldLocation::Body(path) => {
                let got = M::extract_value(body, path).ok_or_else(|| {
                    format!(
                        "mapped field {} not present at body path {}",
                        m.canonical_field,
                        path.join(".")
                    )
                })?;
                if !values_equal(got, &expected) {
                    return Err(format!(
                        "mapped field {} at body path {}: expected {:?}, got {:?}",
                        m.canonical_field,
                        path.join("."),
                        expected,
                        got
                    ));
                }
            }
            FieldLocation::UrlPathSegment {
                segment_name,
                following_segment,
            } => {
                let want_following = *following_segment;
                if !want_following {
                    return Err(format!(
                        "UrlPathSegment mapping for {} with following_segment=false is not supported",
                        m.canonical_field
                    ));
                }
                let model_in_path =
                    extract_following_segment(url_path_segments, segment_name).ok_or_else(|| {
                        format!(
                            "UrlPathSegment mapping for {}: segment '{}' not found or has no follower",
                            m.canonical_field, segment_name
                        )
                    })?;
                let model_before_colon = model_in_path
                    .split(':')
                    .next()
                    .ok_or_else(|| {
                        format!(
                            "UrlPathSegment mapping for {}: segment '{}' has no ':' separator",
                            m.canonical_field, model_in_path
                        )
                    })?;
                let expected_str = expected.as_str().ok_or_else(|| {
                    format!(
                        "expected value for {} is not a string; URL path cannot match",
                        m.canonical_field
                    )
                })?;
                if model_before_colon != expected_str {
                    return Err(format!(
                        "mapped field {} in URL path: expected {:?}, got {:?}",
                        m.canonical_field, expected_str, model_before_colon
                    ));
                }
            }
        }
    }

    // --- 2. Every fixed constant matches at its location.

    for c in &constants {
        let got = M::extract_value(body, &c.location).ok_or_else(|| {
            format!(
                "fixed constant not present at body path {}",
                c.location.join(".")
            )
        })?;
        if !values_equal(got, &c.value) {
            return Err(format!(
                "fixed constant at body path {}: expected {:?}, got {:?}",
                c.location.join("."),
                c.value,
                got
            ));
        }
    }

    // --- 3. No unmapped leaf.

    let mut allowed: Vec<Vec<String>> = Vec::new();
    for m in &mappings {
        if let FieldLocation::Body(path) = &m.location {
            allowed.push(path.iter().map(|s| s.to_string()).collect());
        }
    }
    for c in &constants {
        allowed.push(c.location.iter().map(|s| s.to_string()).collect());
    }

    for leaf in M::all_leaf_paths(body) {
        if !allowed.iter().any(|a| is_prefix_or_equal(a, &leaf)) {
            return Err(format!(
                "unmapped leaf path: {}",
                leaf.join(".")
            ));
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

fn expected_value_for(
    canonical: &crate::connectors::ai_boundary::CanonicalAiRequest,
    field: &str,
) -> Value {
    match field {
        "system_prompt" => Value::String(canonical.system_prompt.clone()),
        "user_message" => Value::String(canonical.user_message.clone()),
        "context_json" => Value::String(canonical.context_json.clone()),
        "model" => Value::String(canonical.model.clone()),
        "options_json.temperature" => {
            let opts: Value =
                serde_json::from_str(&canonical.options_json).unwrap_or(Value::Null);
            opts.get("temperature").cloned().unwrap_or(Value::Null)
        }
        "options_json.max_output_tokens" => {
            let opts: Value =
                serde_json::from_str(&canonical.options_json).unwrap_or(Value::Null);
            opts.get("max_output_tokens").cloned().unwrap_or(Value::Null)
        }
        _ => Value::Null,
    }
}

fn values_equal(a: &Value, b: &Value) -> bool {
    // serde_json::Value PartialEq is strict on number representation
    // (1 vs 1.0 differ). For the walker, compare numerically when
    // both are numbers, structurally otherwise.
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => {
            if let (Some(xi), Some(yi)) = (x.as_i64(), y.as_i64()) {
                xi == yi
            } else if let (Some(xu), Some(yu)) = (x.as_u64(), y.as_u64()) {
                xu == yu
            } else if let (Some(xf), Some(yf)) = (x.as_f64(), y.as_f64()) {
                xf == yf
            } else {
                false
            }
        }
        _ => a == b,
    }
}

fn extract_following_segment<'a>(
    segments: &'a [&'a str],
    name: &str,
) -> Option<&'a str> {
    for (i, s) in segments.iter().enumerate() {
        if *s == name {
            return segments.get(i + 1).copied();
        }
    }
    None
}

fn is_prefix_or_equal(allowed: &[String], leaf: &[String]) -> bool {
    if allowed.len() != leaf.len() {
        return false;
    }
    allowed.iter().zip(leaf.iter()).all(|(a, b)| a == b)
}