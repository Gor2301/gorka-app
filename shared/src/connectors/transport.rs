// gorka-shared::connectors::transport
//
// HTTP-client provider seam for AI adapters.
//
// Slice 3b shipped a refusing production provider:
// no AI socket could be opened. Slice 3c replaces it with
// PinnedReqwestProvider, which performs resolution-time validation,
// pins the selected IP, disables redirects, and bypasses proxies.
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §5.1, §5b.6, §6.4;
//            SLICE 3c — MINI SPEC v4.
//
// The trait takes the whole ValidatedBaseUrl, not just a host string.
// Pinning needs both host and port, and validate_resolution needs the
// validated base. One type carries all of it.

use std::net::IpAddr;

use crate::connectors::base_url::{
    validate_resolution, DnsResolver, SystemResolver, ValidatedBaseUrl,
};
use crate::connectors::http::HttpClient;
use crate::connectors::http_reqwest::ReqwestHttpClient;
use crate::connectors::{ConnectorError, ConnectorErrorKind};

pub trait HttpClientProvider: Send + Sync {
    /// Build a client bound to the given validated base URL.
    fn build(&self, base: &ValidatedBaseUrl) -> Result<Box<dyn HttpClient>, ConnectorError>;
}

// ---------------------------------------------------------------------
// Production: pinned reqwest client
// ---------------------------------------------------------------------

/// 3c's production provider. Resolves the destination, rejects if any
/// returned address is prohibited, pins the selected IP, and returns a
/// client that will only connect there.
pub struct PinnedReqwestProvider {
    pub resolver: Box<dyn DnsResolver>,
}

impl PinnedReqwestProvider {
    pub fn system() -> Self {
        Self {
            resolver: Box::new(SystemResolver),
        }
    }
}

impl HttpClientProvider for PinnedReqwestProvider {
    fn build(&self, base: &ValidatedBaseUrl) -> Result<Box<dyn HttpClient>, ConnectorError> {
        let target = validate_resolution(base, self.resolver.as_ref())?;
        let client = ReqwestHttpClient::pinned(&target.host, target.ip, target.port)?;
        Ok(Box::new(client))
    }
}

// Silence an unused-import warning for IpAddr when nothing in this
// module refers to it directly. Kept because future providers may.
#[allow(dead_code)]
fn _ip_addr_type_used(_: IpAddr) {}

#[allow(dead_code)]
fn _connector_error_kind_referenced(_: ConnectorErrorKind) {}

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
        fn build(
            &self,
            _base: &ValidatedBaseUrl,
        ) -> Result<Box<dyn HttpClient>, ConnectorError> {
            Ok(Box::new((*self.client).clone()))
        }
    }
}