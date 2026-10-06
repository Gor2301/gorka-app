// gorka-shared::connectors
//
// Provider-adapter trait, shared types, and registry. Skeleton only.
// No network, no Tauri, no DB, no async runtime.
// See CONNECTOR-MODEL.md Section 7.

use std::collections::HashMap;
use std::fmt;

pub mod http;
pub mod resend_email;

/// The credential and configuration a factory passes to an adapter.
///
/// `value` is opaque credential material. The generic connector layer
/// does not interpret it. Each adapter interprets it as its provider
/// requires. No `Debug` derive on purpose: accidental `{:?}` printing
/// is harder by construction.
pub struct ConnectorCredential {
    pub value: Vec<u8>,
    pub configuration: serde_json::Value,
}

/// One provider adapter. Section 7.2.
pub trait ConnectorAdapter: Send {
    fn send(&self, request: &SendRequest) -> Result<SendResult, ConnectorError>;
    fn test_connection(&self) -> Result<(), ConnectorError>;
    fn code(&self) -> &'static str;
}

/// Section 7.3.
#[derive(Debug)]
pub struct SendRequest {
    pub to: String,
    pub body: String,
    pub subject: Option<String>,
    pub from: String,
}

/// Section 7.3.
#[derive(Debug)]
pub struct SendResult {
    pub success: bool,
    pub provider_message_id: Option<String>,
    pub provider_status: Option<String>,
    pub provider_response: Option<serde_json::Value>,
}

/// Section 7.3.
#[derive(Debug)]
pub enum ConnectorErrorKind {
    AuthenticationFailed,
    InvalidRecipient,
    RateLimited,
    ProviderTransientError,
    ProviderPermanentError,
    TransportError,
    LocalConfigurationError,
    ResponseParseError,
}

/// Section 7.3.
#[derive(Debug)]
pub struct ConnectorError {
    pub kind: ConnectorErrorKind,
    pub message: String,
    pub provider_response: Option<serde_json::Value>,
}

impl fmt::Display for ConnectorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for ConnectorError {}

/// Section 7.4. Factory is a pure function from credential to adapter.
pub type AdapterFactory = fn(ConnectorCredential) -> Box<dyn ConnectorAdapter>;

/// Section 7.4. Holds factories, never constructed adapters.
pub struct ConnectorRegistry {
    factories: HashMap<&'static str, AdapterFactory>,
}

impl ConnectorRegistry {
    pub fn new() -> Self {
        Self { factories: HashMap::new() }
    }

    pub fn register(&mut self, code: &'static str, factory: AdapterFactory) {
        self.factories.insert(code, factory);
    }

    pub fn factory(&self, code: &str) -> Option<&AdapterFactory> {
        self.factories.get(code)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct TestAdapter;

    impl ConnectorAdapter for TestAdapter {
        fn send(&self, _request: &SendRequest) -> Result<SendResult, ConnectorError> {
            Ok(SendResult {
                success: true,
                provider_message_id: None,
                provider_status: None,
                provider_response: None,
            })
        }

        fn test_connection(&self) -> Result<(), ConnectorError> {
            Ok(())
        }

        fn code(&self) -> &'static str {
            "test"
        }
    }

    fn test_factory(_cred: ConnectorCredential) -> Box<dyn ConnectorAdapter> {
        Box::new(TestAdapter)
    }

    fn sample_credential() -> ConnectorCredential {
        ConnectorCredential {
            value: b"opaque-credential-bytes".to_vec(),
            configuration: json!({"from": "test@example.com"}),
        }
    }

    #[test]
    fn registry_new_is_empty() {
        let reg = ConnectorRegistry::new();
        assert!(reg.factory("test").is_none());
    }

    #[test]
    fn registry_register_then_lookup() {
        let mut reg = ConnectorRegistry::new();
        reg.register("test", test_factory);
        assert!(reg.factory("test").is_some());
    }

    #[test]
    fn registry_lookup_unknown_code_returns_none() {
        let mut reg = ConnectorRegistry::new();
        reg.register("test", test_factory);
        assert!(reg.factory("not-registered").is_none());
    }

    #[test]
    fn factory_persists_after_constructed_adapter_is_dropped() {
        let mut reg = ConnectorRegistry::new();
        reg.register("test", test_factory);

        {
            let factory = reg.factory("test").expect("registered");
            let adapter = factory(sample_credential());
            assert_eq!(adapter.code(), "test");
        }

        // Registry still holds the same factory after the adapter is gone.
        let factory = reg.factory("test").expect("still registered");
        let adapter = factory(sample_credential());
        assert_eq!(adapter.code(), "test");
    }

    #[test]
    fn adapter_is_object_safe() {
        let adapter: Box<dyn ConnectorAdapter> = Box::new(TestAdapter);
        assert_eq!(adapter.code(), "test");
        assert!(adapter.test_connection().is_ok());
    }

    #[test]
    fn connector_error_debug_and_display_are_stable() {
        let err = ConnectorError {
            kind: ConnectorErrorKind::AuthenticationFailed,
            message: "credential rejected by provider".to_string(),
            provider_response: Some(json!({"code": 401})),
        };

        let debug = format!("{:?}", err);
        let display = format!("{}", err);

        assert!(debug.contains("AuthenticationFailed"));
        assert!(debug.contains("credential rejected by provider"));
        assert!(display.contains("AuthenticationFailed"));
        assert!(display.contains("credential rejected by provider"));
    }
}