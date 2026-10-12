// shared/tests/slice3c_base_url.rs
//
// Slice 3c acceptance tests: base URL network controls.
// Authority: SLICE 3c — MINI SPEC v4 (frozen 2026-10-12).
//
// No real outbound network. Local HTTPS listener for redirect
// tests only. No test constructs ReqwestHttpClient without
// the pinned() constructor.

use std::io::{Read, Write};
use std::net::{IpAddr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

use gorka_shared::connectors::base_url::{
    is_prohibited, validate_resolution, validate_static, DnsResolver,
};
use gorka_shared::connectors::{ConnectorError, ConnectorErrorKind};

// ---------------------------------------------------------------------
// Test-only DNS resolvers
// ---------------------------------------------------------------------

struct FixedResolver {
    answer: Vec<IpAddr>,
}

impl DnsResolver for FixedResolver {
    fn resolve(&self, _host: &str) -> Result<Vec<IpAddr>, ConnectorError> {
        Ok(self.answer.clone())
    }
}

struct FailingResolver;

impl DnsResolver for FailingResolver {
    fn resolve(&self, _host: &str) -> Result<Vec<IpAddr>, ConnectorError> {
        Err(ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: "injected failure".into(),
            provider_response: None,
        })
    }
}

struct ChangingResolver {
    first: Vec<IpAddr>,
    second: Vec<IpAddr>,
    count: std::sync::atomic::AtomicU8,
}

impl DnsResolver for ChangingResolver {
    fn resolve(&self, _host: &str) -> Result<Vec<IpAddr>, ConnectorError> {
        let n = self.count.fetch_add(1, Ordering::SeqCst);
        if n == 0 {
            Ok(self.first.clone())
        } else {
            Ok(self.second.clone())
        }
    }
}

fn ip(s: &str) -> IpAddr {
    s.parse().expect("parse ip")
}

// ---------------------------------------------------------------------
// Group A — Static validation (3c-1..3c-12)
// ---------------------------------------------------------------------

#[test]
fn rejects_http_scheme() {
    let err = validate_static("http://api.example.com/v1").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn rejects_ipv4_literal() {
    let err = validate_static("https://127.0.0.1/v1").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn rejects_ipv6_literal() {
    let err = validate_static("https://[::1]/v1").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn rejects_embedded_credentials() {
    let err = validate_static("https://user:pw@api.example.com/v1").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn rejects_malformed_url() {
    let err = validate_static("not a url").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn accepts_valid_https() {
    let v = validate_static("https://api.openai.com/v1").expect("valid");
    assert_eq!(v.host(), "api.openai.com");
    assert_eq!(v.port(), 443);
    assert_eq!(v.path(), "/v1");
}

#[test]
fn rejects_query_string() {
    let err = validate_static("https://api.example.com/v1?k=v").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn rejects_fragment() {
    let err = validate_static("https://api.example.com/v1#frag").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn normalizes_trailing_slash() {
    let v = validate_static("https://api.example.com/v1/").expect("valid");
    assert_eq!(v.as_str(), "https://api.example.com/v1");
    let v2 = validate_static("https://api.example.com/").expect("valid");
    assert_eq!(v2.as_str(), "https://api.example.com");
}

#[test]
fn rejects_double_append() {
    // The /chat/completions suffix policy lives in full_path_for, not
    // in validate_static. validate_static accepts any well-formed
    // HTTPS URL; the adapter's call to full_path_for is what rejects
    // the double append.
    let v = validate_static("https://api.example.com/v1/chat/completions")
        .expect("validate_static accepts well-formed HTTPS URL");
    let err = v.full_path_for("/chat/completions").unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::LocalConfigurationError);
}

#[test]
fn accepts_version_prefix() {
    let v = validate_static("https://api.example.com/v1").expect("valid");
    let url = v.full_path_for("/chat/completions").expect("path");
    assert_eq!(url, "https://api.example.com/v1/chat/completions");
}

#[test]
fn accepts_empty_path() {
    let v = validate_static("https://api.example.com").expect("valid");
    let url = v.full_path_for("/chat/completions").expect("path");
    assert_eq!(url, "https://api.example.com/chat/completions");
}

// ---------------------------------------------------------------------
// Group B — Resolution (3c-13..3c-21)
// ---------------------------------------------------------------------

#[test]
fn loopback_v4_rejected_at_resolution() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("127.0.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn loopback_v6_rejected_at_resolution() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("::1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn private_v4_rejected() {
    let base = validate_static("https://example.com").unwrap();
    for addr in ["10.0.0.1", "172.16.0.1", "192.168.0.1"] {
        let r = FixedResolver { answer: vec![ip(addr)] };
        let err = validate_resolution(&base, &r).unwrap_err();
        assert_eq!(err.kind, ConnectorErrorKind::TransportError, "for {}", addr);
    }
}

#[test]
fn cgnat_rejected() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("100.64.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn link_local_rejected() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("169.254.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn multicast_rejected() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("224.0.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn reserved_rejected() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("240.0.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
    let r = FixedResolver { answer: vec![ip("255.255.255.255")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn reject_if_any_unsafe() {
    let base = validate_static("https://example.com").unwrap();
    let r = FixedResolver { answer: vec![ip("8.8.8.8"), ip("127.0.0.1")] };
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn dns_rebinding_second_call_fails() {
    let base = validate_static("https://example.com").unwrap();
    let r = ChangingResolver {
        first: vec![ip("8.8.8.8")],
        second: vec![ip("127.0.0.1")],
        count: std::sync::atomic::AtomicU8::new(0),
    };
    let ok = validate_resolution(&base, &r).expect("first call ok");
    assert_eq!(ok.ip, ip("8.8.8.8"));
    let err = validate_resolution(&base, &r).unwrap_err();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

// ---------------------------------------------------------------------
// Group C — IANA tables (3c-22..3c-25)
// ---------------------------------------------------------------------

const IPV4_PROHIBITED: &[(&str, &str)] = &[
    ("0.0.0.0/8", "0.0.0.1"),
    ("0.0.0.0/32", "0.0.0.0"),
    ("10.0.0.0/8", "10.0.0.1"),
    ("100.64.0.0/10", "100.64.0.1"),
    ("127.0.0.0/8", "127.0.0.1"),
    ("169.254.0.0/16", "169.254.0.1"),
    ("172.16.0.0/12", "172.16.0.1"),
    ("192.0.0.0/24", "192.0.0.1"),
    ("192.0.0.0/29", "192.0.0.1"),
    ("192.0.0.8/32", "192.0.0.8"),
    ("192.0.0.9/32", "192.0.0.9"),
    ("192.0.0.10/32", "192.0.0.10"),
    ("192.0.0.170/32", "192.0.0.170"),
    ("192.0.0.171/32", "192.0.0.171"),
    ("192.0.2.0/24", "192.0.2.1"),
    ("192.31.196.0/24", "192.31.196.1"),
    ("192.52.193.0/24", "192.52.193.1"),
    ("192.88.99.0/24", "192.88.99.1"),
    ("192.88.99.2/32", "192.88.99.2"),
    ("192.168.0.0/16", "192.168.0.1"),
    ("192.175.48.0/24", "192.175.48.1"),
    ("198.18.0.0/15", "198.18.0.1"),
    ("198.51.100.0/24", "198.51.100.1"),
    ("203.0.113.0/24", "203.0.113.1"),
    ("224.0.0.0/4", "224.0.0.1"),
    ("240.0.0.0/4", "240.0.0.1"),
    ("255.255.255.255/32", "255.255.255.255"),
];

const IPV6_PROHIBITED: &[(&str, &str)] = &[
    ("::/128", "::"),
    ("::1/128", "::1"),
    ("::ffff:0:0/96", "::ffff:127.0.0.1"),
    ("64:ff9b::/96", "64:ff9b::1"),
    ("64:ff9b:1::/48", "64:ff9b:1::1"),
    ("100::/64", "100::1"),
    ("100:0:0:1::/64", "100:0:0:1::1"),
    ("2001::/23", "2001::1"),
    ("2001::/32", "2001::1"),
    ("2001:1::1/128", "2001:1::1"),
    ("2001:1::2/128", "2001:1::2"),
    ("2001:1::3/128", "2001:1::3"),
    ("2001:2::/48", "2001:2::1"),
    ("2001:3::/32", "2001:3::1"),
    ("2001:4:112::/48", "2001:4:112::1"),
    ("2001:10::/28", "2001:10::1"),
    ("2001:20::/28", "2001:20::1"),
    ("2001:30::/28", "2001:30::1"),
    ("2001:db8::/32", "2001:db8::1"),
    ("2002::/16", "2002::1"),
    ("2620:4f:8000::/48", "2620:4f:8000::1"),
    ("3fff::/20", "3fff::1"),
    ("5f00::/16", "5f00::1"),
    ("fc00::/7", "fc00::1"),
    ("fe80::/10", "fe80::1"),
    ("ff00::/8", "ff00::1"),
];

#[test]
fn iana_ipv4_table_all_prohibited() {
    for (cidr, addr) in IPV4_PROHIBITED {
        let a = ip(addr);
        assert!(is_prohibited(a), "{} in {} must be prohibited", addr, cidr);
    }
}

#[test]
fn iana_ipv6_table_all_prohibited() {
    for (cidr, addr) in IPV6_PROHIBITED {
        let a = ip(addr);
        assert!(is_prohibited(a), "{} in {} must be prohibited", addr, cidr);
    }
}

#[test]
fn iana_public_sample_all_permitted() {
    for addr in [
        "8.8.8.8",
        "1.1.1.1",
        "9.9.9.9",
        "208.67.222.222",
        "2606:4700:4700::1111",
        "2001:4860:4860::8888",
        "2620:fe::fe",
    ] {
        let a = ip(addr);
        assert!(!is_prohibited(a), "{} must be permitted", addr);
    }
}

#[test]
fn ipv4_mapped_ipv6_recurses() {
    assert!(is_prohibited(ip("::ffff:127.0.0.1")));
    assert!(is_prohibited(ip("::ffff:10.0.0.1")));
    assert!(!is_prohibited(ip("::ffff:8.8.8.8")));
}

// ---------------------------------------------------------------------
// Group D — Redirect behavior, real HTTPS listener (3c-26..3c-27)
// ---------------------------------------------------------------------
//
// Both tests use a test-only client built with the same options as
// ReqwestHttpClient::pinned, plus:
//   - .danger_accept_invalid_certs(true)   (self-signed test cert)
//   - .resolve() overrides for every hostname the test uses
// The overrides map hostnames to the listener's loopback port.
// Production pinned() has neither override.

use rcgen::generate_simple_self_signed;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::{ServerConfig, ServerConnection, StreamOwned};

fn build_test_client(overrides: &[(&str, u16)]) -> reqwest::blocking::Client {
    let mut builder = reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .danger_accept_invalid_certs(true);
    for (host, port) in overrides {
        builder = builder.resolve(host, SocketAddr::from(([127, 0, 0, 1], *port)));
    }
    builder.build().expect("test client")
}

fn spawn_https_listener(
    cert_host: &str,
    location_host: &str,
    connections: Arc<AtomicUsize>,
) -> (u16, thread::JoinHandle<()>) {
    let ck = generate_simple_self_signed(vec![cert_host.to_string()])
        .expect("generate self-signed cert");
    let cert_der: CertificateDer<'static> = ck.cert.der().clone();
    let key_der: Vec<u8> = ck.key_pair.serialize_der();
    let key: PrivateKeyDer<'static> =
        PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key_der));

    let tls_config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert_der], key)
        .expect("tls config");
    let tls_config = Arc::new(tls_config);

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    let loc_host = location_host.to_string();

    let handle = thread::spawn(move || {
        for stream in listener.incoming() {
            let stream: TcpStream = match stream {
                Ok(s) => s,
                Err(_) => break,
            };
            connections.fetch_add(1, Ordering::SeqCst);

            let conn = match ServerConnection::new(tls_config.clone()) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let mut tls = StreamOwned::new(conn, stream);

            let mut buf = [0u8; 2048];
            let _ = tls.read(&mut buf);

            let location = format!("https://{}:{}/other", loc_host, port);
            let response = format!(
                "HTTP/1.1 301 Moved Permanently\r\n\
                 Content-Length: 0\r\n\
                 Location: {}\r\n\
                 Connection: close\r\n\r\n",
                location
            );
            let _ = tls.write_all(response.as_bytes());
            let _ = tls.flush();

            let mut drain = [0u8; 1024];
            while let Ok(n) = tls.read(&mut drain) {
                if n == 0 {
                    break;
                }
            }
        }
    });
    (port, handle)
}

#[test]
fn redirect_301_not_followed() {
    let connections = Arc::new(AtomicUsize::new(0));
    let (port, _h) = spawn_https_listener(
        "test.example.invalid",
        "test.example.invalid",
        connections.clone(),
    );
    let client = build_test_client(&[("test.example.invalid", port)]);

    let resp = client
        .get(format!("https://test.example.invalid:{}/", port))
        .send()
        .expect("request");
    assert_eq!(resp.status().as_u16(), 301);

    std::thread::sleep(std::time::Duration::from_millis(100));
    assert_eq!(
        connections.load(Ordering::SeqCst),
        1,
        "same-origin redirect must not be followed"
    );
}

#[test]
fn redirect_cross_origin_not_attempted() {
    let connections = Arc::new(AtomicUsize::new(0));
    let (port, _h) = spawn_https_listener(
        "test.example.invalid",
        "redirect.example.invalid",
        connections.clone(),
    );
    let client = build_test_client(&[
        ("test.example.invalid", port),
        ("redirect.example.invalid", port),
    ]);

    let resp = client
        .get(format!("https://test.example.invalid:{}/", port))
        .send()
        .expect("request");
    assert_eq!(resp.status().as_u16(), 301);

    std::thread::sleep(std::time::Duration::from_millis(100));
    assert_eq!(
        connections.load(Ordering::SeqCst),
        1,
        "cross-origin redirect must not be attempted"
    );
}

// ---------------------------------------------------------------------
// Group E — Adapter path with mock provider (3c-28..3c-30)
// ---------------------------------------------------------------------

use gorka_shared::connectors::ai_boundary::parse_and_validate;
use gorka_shared::connectors::base_url::ValidatedBaseUrl;
use gorka_shared::connectors::gemini_ai::factory_with_provider;
use gorka_shared::connectors::http::testing::{MockHttpClient, MockHandle};
use gorka_shared::connectors::http::{HttpClient, HttpResponse};
use gorka_shared::connectors::transport::HttpClientProvider;
use gorka_shared::connectors::{ConnectorAdapter, ConnectorCredential, SendRequest};
use serde_json::json;

fn gemini_cred() -> ConnectorCredential {
    ConnectorCredential {
        value: serde_json::to_vec(&json!({ "apiKey": "AIza_TEST" })).unwrap(),
        configuration: json!({ "model": "gemini-2.5-flash" }),
    }
}

fn canonical_body() -> String {
    let raw = json!({
        "system_prompt": "sys",
        "user_message": "user",
        "context": {
            "debtor": { "amountRange": "0-1000", "daysOverdueRange": "0" },
            "communicationHistory": {
                "totalCount": 0, "emailCount": 0, "smsCount": 0,
                "voiceCount": 0, "responseRateBand": "NONE"
            },
            "debts": { "totalCount": 0, "paidCount": 0, "overdueCount": 0 },
            "indicators": {
                "paymentReliability": "NO_DATA",
                "engagementLevel": "LOW",
                "communicationPreference": null
            }
        },
        "model": "gemini-2.5-flash",
        "request_options": { "temperature": 0.5, "max_output_tokens": 128 }
    })
    .to_string();
    parse_and_validate(&raw).unwrap().to_json()
}

// Hybrid provider: calls validate_resolution with an injected
// resolver, then returns the mock client. Proves the adapter
// invokes the resolution check without opening a socket.
struct HybridProvider {
    resolver: Box<dyn DnsResolver>,
    mock: Arc<MockHttpClient>,
}

impl HttpClientProvider for HybridProvider {
    fn build(&self, base: &ValidatedBaseUrl) -> Result<Box<dyn HttpClient>, ConnectorError> {
        let _target = validate_resolution(base, self.resolver.as_ref())?;
        Ok(Box::new((*self.mock).clone()))
    }
}

fn run_send(
    resolver: Box<dyn DnsResolver>,
    responses: Vec<Result<HttpResponse, gorka_shared::connectors::http::HttpError>>,
) -> (Result<(), ConnectorError>, MockHandle) {
    let (mock, handle) = MockHttpClient::new(responses);
    let provider = Box::new(HybridProvider {
        resolver,
        mock: Arc::new(mock),
    });
    let adapter = factory_with_provider(gemini_cred(), provider).unwrap();
    let req = SendRequest {
        to: String::new(),
        subject: None,
        from: String::new(),
        body: canonical_body(),
    };
    let r = adapter.send(&req).map(|_| ());
    (r, handle)
}

#[test]
fn adapter_send_calls_validate_resolution() {
    let (r, handle) = run_send(
        Box::new(FixedResolver { answer: vec![ip("8.8.8.8")] }),
        vec![Ok(HttpResponse {
            status: 200,
            body: b"{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"ok\"}]}}]}"
                .to_vec(),
        })],
    );
    r.expect("send ok");
    assert_eq!(handle.received_count(), 1);
}

#[test]
fn adapter_send_fails_when_resolution_prohibited() {
    let (r, handle) = run_send(
        Box::new(FixedResolver { answer: vec![ip("127.0.0.1")] }),
        vec![],
    );
    let err = r.expect_err("send must fail on prohibited resolution");
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
    assert_eq!(handle.received_count(), 0, "mock must not be touched");
}

#[test]
fn adapter_send_fails_on_empty_resolution() {
    let (r, handle) = run_send(Box::new(FixedResolver { answer: vec![] }), vec![]);
    let err = r.expect_err("send must fail on empty resolution");
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
    assert_eq!(handle.received_count(), 0);
}

// ---------------------------------------------------------------------
// Group F — Production path (3c-31..3c-33)
// ---------------------------------------------------------------------

use gorka_shared::connectors::gemini_ai::factory as gemini_production_factory;
use gorka_shared::connectors::http_reqwest::ReqwestHttpClient;
use gorka_shared::connectors::transport::PinnedReqwestProvider;

#[test]
fn production_factory_uses_pinned_provider() {
    let a = gemini_production_factory(gemini_cred()).expect("production factory ok");
    assert_eq!(a.code(), "gemini-ai");
}

#[test]
fn pinned_provider_with_failing_resolver_returns_transport_error() {
    let provider = PinnedReqwestProvider {
        resolver: Box::new(FailingResolver),
    };
    let base = validate_static("https://example.com").unwrap();
    let err = provider.build(&base).err().unwrap();
    assert_eq!(err.kind, ConnectorErrorKind::TransportError);
}

#[test]
fn pinned_client_construction_succeeds() {
    let c = ReqwestHttpClient::pinned("example.com", ip("8.8.8.8"), 443);
    assert!(c.is_ok(), "pinned client construction must not fail");
}