// gorka-shared::connectors::http
//
// Minimal HTTP abstraction for provider adapters. The real network
// client lands in a later phase. For now, adapters are constructed
// with any HttpClient; tests use MockHttpClient, which never opens
// a socket.
//
// See CONNECTOR-MODEL.md Section 7.

use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpMethod {
    Get,
    Post,
}

/// A single HTTP request. No Debug derive on purpose: headers may
/// carry provider credentials, and an accidental `{:?}` on a request
/// would be a leak path. Use `redacted_debug()` if a debug string is
/// needed.
#[derive(Clone)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl HttpRequest {
    /// Method, URL, and header NAMES only. Header values are not
    /// included.
    pub fn redacted_debug(&self) -> String {
        let names: Vec<&str> = self.headers.iter().map(|(k, _)| k.as_str()).collect();
        format!(
            "{:?} {} headers=[{}] body_len={}",
            self.method,
            self.url,
            names.join(","),
            self.body.len()
        )
    }
}

#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpErrorKind {
    Transport,
    Timeout,
}

#[derive(Debug, Clone)]
pub struct HttpError {
    pub kind: HttpErrorKind,
    pub message: String,
}

/// Anything that can execute one HTTP request. Implementations must
/// be safe to send across threads and to share by reference.
pub trait HttpClient: Send + Sync {
    fn execute(&self, request: &HttpRequest) -> Result<HttpResponse, HttpError>;
}

#[cfg(test)]
pub mod testing {
    use super::*;

    /// Test-only HttpClient. Pops canned responses in order and
    /// records every request it receives. State is shared with a
    /// MockHandle so tests can inspect what the adapter sent after
    /// the client has been moved into the adapter.
    pub struct MockHttpClient {
        responses: Arc<Mutex<Vec<Result<HttpResponse, HttpError>>>>,
        received: Arc<Mutex<Vec<HttpRequest>>>,
    }

    #[derive(Clone)]
    pub struct MockHandle {
        received: Arc<Mutex<Vec<HttpRequest>>>,
    }

    impl MockHttpClient {
        pub fn new(
            responses: Vec<Result<HttpResponse, HttpError>>,
        ) -> (Self, MockHandle) {
            let responses = Arc::new(Mutex::new(responses));
            let received = Arc::new(Mutex::new(Vec::new()));
            (
                Self {
                    responses,
                    received: received.clone(),
                },
                MockHandle { received },
            )
        }
    }

    impl HttpClient for MockHttpClient {
        fn execute(&self, request: &HttpRequest) -> Result<HttpResponse, HttpError> {
            self.received.lock().unwrap().push(request.clone());
            let mut responses = self.responses.lock().unwrap();
            if responses.is_empty() {
                return Err(HttpError {
                    kind: HttpErrorKind::Transport,
                    message: "MockHttpClient: no more responses queued".into(),
                });
            }
            responses.remove(0)
        }
    }

    impl MockHandle {
        /// Every request the client received, in order.
        pub fn received(&self) -> Vec<HttpRequest> {
            self.received.lock().unwrap().clone()
        }

        pub fn received_count(&self) -> usize {
            self.received.lock().unwrap().len()
        }
    }
}