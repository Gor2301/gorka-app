// gorka-shared::connectors::transport
//
// Slice 3b. HTTP-client provider seam for AI adapters.
//
// 3b ships two HttpClientProvider implementations:
//   - RefusingHttpClientProvider: production. Returns TransportError
//     on every build. This is the only production provider available
//     in 3b. No AI socket can be opened by a 3b binary.
//   - MockHttpClientProvider: #[cfg(test)] only. Returns a
//     MockHttpClient. Used by 3b's automated tests.
//
// 3c replaces the production path with PinnedReqwestProvider.
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.1, §5b.6.
//
// Deviation from §5.1: test_support module is gated by `any(test,
// feature = "test-mock-provider")`, not `#[cfg(test)]`. Reason:
// integration test files in shared/tests/ are separate crates and
// do not see #[cfg(test)] items from the library. The feature gate
// is enabled for the test target by declaring dev-dependency on
// self with the feature. Without this, slice3b_gemini.rs and
// slice3b_openai.rs cannot construct a mock provider.

use crate::connectors::http::HttpClient;
use crate::connectors::{ConnectorError, ConnectorErrorKind};

pub trait HttpClientProvider: Send + Sync {
    /// Build a client bound to `host`. In 3b, the only production
    /// implementation returns Err. In 3c, this performs resolution-time
    /// validation and returns a pinned client.
    fn build(&self, host: &str) -> Result<Box<dyn HttpClient>, ConnectorError>;
}

// ---------------------------------------------------------------------
// Production: refuse to open a socket
// ---------------------------------------------------------------------

/// 3b's production provider. Refuses every build request.
///
/// This is not a stub. It is the correct production behavior for a
/// build that has not yet installed the network guard.
pub struct RefusingHttpClientProvider;

impl HttpClientProvider for RefusingHttpClientProvider {
    fn build(&self, _host: &str) -> Result<Box<dyn HttpClient>, ConnectorError> {
        Err(ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: "AI transport is disabled in this build. \
                      Enable Slice 3c to allow outbound AI provider calls."
                .into(),
            provider_response: None,
        })
    }
}

// ---------------------------------------------------------------------
// Test support: mock provider
// ---------------------------------------------------------------------

#[cfg(any(test, feature = "test-mock-provider"))]
pub mod test_support {
    use super::*;
    use crate::connectors::http::testing::MockHttpClient;
    use std::sync::Arc;

    pub struct MockHttpClientProvider {
        pub client: Arc<MockHttpClient>,
    }

    impl MockHttpClientProvider {
        pub fn new(client: Arc<MockHttpClient>) -> Self {
            Self { client }
        }
    }

    impl HttpClientProvider for MockHttpClientProvider {
        fn build(&self, _host: &str) -> Result<Box<dyn HttpClient>, ConnectorError> {
            Ok(Box::new(self.client.clone()))
        }
    }
}