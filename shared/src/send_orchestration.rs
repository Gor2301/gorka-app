// shared/src/send_orchestration.rs
//
// Slice 6 extraction. The send sequence that previously lived in
// src-tauri-agent/src/main.rs::send_recommendation is moved here
// verbatim, with only the crate-boundary substitutions required
// by the move (gorka_shared:: -> crate::). Behavior-preserving
// extraction per Part III Section 3.2 of CONNECTOR-EVENT-ORDER-SPEC.
//
// Trusted identity (org_id, user_id) is passed in by the caller.
// The Tauri wrapper derives both from the trusted source; this
// function never reads identity from the frontend.

use chrono::{DateTime, Utc};
use rusqlite::Connection;

/// Error type for execute_send. Alias for String to preserve the
/// pre-extraction error-message format byte-for-byte.
pub type SendError = String;

#[derive(serde::Deserialize)]
pub struct SendRecommendationInput {
    pub recommendation_id: String,
    pub connector_code: String,
    pub to: String,
    pub subject: Option<String>,
    pub draft_body: String,
}

#[derive(serde::Serialize)]
pub struct SendRecommendationResult {
    pub communication_id: Option<String>,
    pub attempt_id: String,
    pub uncertain: bool,
    pub failure_reason: Option<String>,
}

pub fn execute_send(
    conn: &mut Connection,
    org_id: &str,
    user_id: &str,
    input: SendRecommendationInput,
    now: DateTime<Utc>,
) -> Result<SendRecommendationResult, SendError> {
    let rec = crate::recommendation_store::get(conn, org_id, &input.recommendation_id)
        .map_err(|e| format!("{:?}", e))?;

    let disclosure = crate::compliance::get_disclosure_text(conn)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let final_body =
        crate::compliance::append_disclosure_idempotent(&input.draft_body, &disclosure);

    let subject_str = input.subject.as_deref().unwrap_or("");
    let flags = crate::fact_validation::validate_draft(
        conn,
        org_id,
        &rec.debtor_id,
        subject_str,
        &final_body,
        0,
    )
    .map_err(|e| format!("{:?}", e))?;
    for flag in &flags {
        match &flag.verification {
            crate::fact_validation::Verification::Mismatch { .. } => {
                return Err(format!(
                    "draft has unresolved mismatch: {}",
                    flag.matched_text
                ));
            }
            crate::fact_validation::Verification::Unverifiable => {
                return Err(format!(
                    "draft has unverifiable claim: {}",
                    flag.matched_text
                ));
            }
            crate::fact_validation::Verification::Verified { .. } => {}
        }
    }

    crate::compliance::check_opt_out(conn, org_id, &rec.debtor_id, &input.connector_code)
        .map_err(|block| block.user_message())?;

    let channel = crate::compliance::channel_for_connector_code(&input.connector_code)
        .ok_or_else(|| format!("unknown connector: {}", input.connector_code))?;
    crate::send_safety::check_contact_limit(conn, org_id, &rec.debtor_id, channel, now)
        .map_err(|e| format!("{:?}", e))?;

    let secret = crate::connectors::local_record::read_local_connector_credential(
        conn,
        org_id,
        &input.connector_code,
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("connector {} is not enabled on this device", input.connector_code))?;

    let from = secret
        .configuration
        .get("from")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Connector configuration has no 'from' field".to_string())?
        .to_string();

    let cred = crate::connectors::ConnectorCredential {
        value: secret.credential_value.clone(),
        configuration: secret.configuration.clone(),
    };
    let registry = crate::connectors::build_default_registry();
    let factory = registry
        .factory(&input.connector_code)
        .ok_or_else(|| format!("No adapter registered for {}", input.connector_code))?;
    let adapter = factory(cred).map_err(|e| format!("{:?}", e))?;

    let snapshot = crate::send_safety::SendAttemptSnapshot {
        to: input.to.clone(),
        subject: input.subject.clone(),
        from: from.clone(),
        final_body: final_body.clone(),
        connector_code: input.connector_code.clone(),
        channel: channel.as_str().to_string(),
        recommendation_id: input.recommendation_id.clone(),
        debtor_id: rec.debtor_id.clone(),
        created_at: now.to_rfc3339(),
    };
    let snapshot_bytes = snapshot.to_json().map_err(|e| format!("{:?}", e))?;

    let (attempt, _reservation_id) = crate::send_safety::begin_send(
        conn,
        org_id,
        &rec.debtor_id,
        &input.recommendation_id,
        &input.connector_code,
        &snapshot_bytes,
        now,
    )
    .map_err(|e| format!("{:?}", e))?;

    let send_request = crate::connectors::SendRequest {
        to: input.to.clone(),
        subject: input.subject.clone(),
        from,
        body: final_body.clone(),
    };
    let send_result = adapter.send(&send_request);

    let attempt_id = attempt.id.clone();
    match send_result {
        Ok(result) if result.success => {
            let comm_id =
                crate::send_safety::finalize_success(conn, org_id, &attempt_id, user_id, now)
                    .map_err(|e| format!("{:?}", e))?;
            Ok(SendRecommendationResult {
                communication_id: Some(comm_id),
                attempt_id,
                uncertain: false,
                failure_reason: None,
            })
        }
        Ok(_) => {
            crate::send_safety::finalize_failure(conn, org_id, &attempt_id, now)
                .map_err(|e| format!("{:?}", e))?;
            Ok(SendRecommendationResult {
                communication_id: None,
                attempt_id,
                uncertain: false,
                failure_reason: Some("provider reported failure".to_string()),
            })
        }
        Err(e) => {
            crate::send_safety::finalize_uncertain(conn, org_id, &attempt_id, now)
                .map_err(|e| format!("{:?}", e))?;
            Ok(SendRecommendationResult {
                communication_id: None,
                attempt_id,
                uncertain: true,
                failure_reason: Some(format!("{:?}", e)),
            })
        }
    }
}