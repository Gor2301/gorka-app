// gorka-shared::models
//
// Data types shared by both GORKA desktop applications.
//
// These are the structs and enums that cross the boundary between
// the Rust command layer and the Tauri frontend. Both gorka-client
// and gorka-agent depend on them, so they live in the shared crate.
//
// Nothing here is Tauri-specific. Nothing here is Client-specific
// or Agent-specific. Pure data shapes.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Debtor {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub surname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DebtorInput {
    pub name: String,
    pub surname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub data: JsonValue,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i64,
    pub category: String,
    pub description: Option<String>,
    pub uploaded_by: Option<String>,
    pub is_primary: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DocumentInput {
    pub entity_id: String,
    pub entity_type: String,
    pub file_name: String,
    pub file_content: Vec<u8>,
    pub file_type: String,
    pub category: String,
    pub description: Option<String>,
    pub uploaded_by: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Debt {
    pub id: String,
    pub debtor_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DebtInput {
    pub debtor_id: String,
    pub amount: f64,
    pub currency: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: Option<JsonValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Communication {
    pub id: String,
    pub debtor_id: String,
    pub r#type: String,
    pub direction: String,
    pub content: Option<String>,
    pub duration: Option<i64>,
    pub created_by: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CommunicationInput {
    pub debtor_id: String,
    pub r#type: String,
    pub direction: String,
    pub content: Option<String>,
    pub duration: Option<i64>,
    pub data: Option<JsonValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    pub id: String,
    pub debtor_id: String,
    pub r#type: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ActionInput {
    pub debtor_id: String,
    pub r#type: String,
    pub status: Option<String>,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
    pub data: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_debtors: i64,
    pub total_debt: f64,
    pub total_actions: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DocumentCategory {
    ProfilePhoto,
    IdCard,
    Passport,
    DriverLicense,
    Contract,
    ProofOfAddress,
    IncomeProof,
    CollateralPhoto,
    Other,
}

impl DocumentCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            DocumentCategory::ProfilePhoto => "profile_photo",
            DocumentCategory::IdCard => "id_card",
            DocumentCategory::Passport => "passport",
            DocumentCategory::DriverLicense => "driver_license",
            DocumentCategory::Contract => "contract",
            DocumentCategory::ProofOfAddress => "proof_of_address",
            DocumentCategory::IncomeProof => "income_proof",
            DocumentCategory::CollateralPhoto => "collateral_photo",
            DocumentCategory::Other => "other",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum CommunicationType {
    Call,
    Email,
    Sms,
    Note,
}

impl CommunicationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CommunicationType::Call => "CALL",
            CommunicationType::Email => "EMAIL",
            CommunicationType::Sms => "SMS",
            CommunicationType::Note => "NOTE",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum CommunicationDirection {
    Inbound,
    Outbound,
}

impl CommunicationDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            CommunicationDirection::Inbound => "INBOUND",
            CommunicationDirection::Outbound => "OUTBOUND",
        }
    }
}