// shared/tests/slice3c_manual.rs
//
// Slice 3c manual acceptance tests, marked #[ignore].
//
// Run with:
//   cargo test -p gorka-shared --test slice3c_manual -- --ignored --nocapture
//
// 3c-M1 — TLS chain rejection on pinned address.
// 3c-M2 — Proxy env vars bypassed by pinned client.
//
// These are not run in the default suite. They are recorded once,
// with their observed output, before the Slice 3c commit is final.
//
// Neither test asserts anything about the production adapter path;
// both call ReqwestHttpClient::pinned directly to exercise the
// transport layer under test, deliberately bypassing the adapter's
// resolution policy.

use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use rcgen::generate_simple_self_signed;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::{ServerConfig, ServerConnection, StreamOwned};

use gorka_shared::connectors::http::{HttpClient, HttpMethod, HttpRequest};
use gorka_shared::connectors::http_reqwest::ReqwestHttpClient;

fn ip(s: &str) -> IpAddr {
    s.parse().unwrap()
}

#[test]
#[ignore]
fn manual_3c_m1_tls_chain_rejection_on_pinned_address() {
    // Self-signed cert for test.example.invalid, signed by a CA
    // not in the system trust store.
    let ck = generate_simple_self_signed(vec!["test.example.invalid".to_string()])
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

    let _handle = thread::spawn(move || {
        for stream in listener.incoming() {
            let stream: TcpStream = match stream {
                Ok(s) => s,
                Err(_) => break,
            };
            let conn = match ServerConnection::new(tls_config.clone()) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let mut tls = StreamOwned::new(conn, stream);
            let mut buf = [0u8; 4096];
            // We expect the client to abort the handshake after
            // rejecting the cert. Ignore the error either way.
            let _ = tls.read(&mut buf);
        }
    });

    // The production pinned client. No danger_accept_invalid_certs.
    let client = ReqwestHttpClient::pinned("test.example.invalid", ip("127.0.0.1"), port)
        .expect("pinned construction");

    let req = HttpRequest {
        method: HttpMethod::Get,
        url: format!("https://test.example.invalid:{}/", port),
        headers: vec![],
        body: vec![],
    };

    let result = client.execute(&req);

    println!();
    println!("=== 3c-M1 observed result ===");
    match result {
        Err(e) => {
            println!("error kind:    {:?}", e.kind);
            println!("error message: {}", e.message);
            let m = e.message.to_lowercase();
            let looks_like_chain = m.contains("certificate")
                || m.contains("cert")
                || m.contains("unknownissuer")
                || m.contains("invalid peer")
                || m.contains("tls")
                || m.contains("ssl")
                || m.contains("handshake");
            assert!(
                looks_like_chain,
                "3c-M1: expected TLS certificate failure, got: {}",
                e.message
            );
            assert!(
                !m.contains("hostname"),
                "3c-M1: failure was hostname mismatch, not chain rejection: {}",
                e.message
            );
            println!("=== 3c-M1 PASS ===\n");
        }
        Ok(resp) => {
            panic!(
                "3c-M1: expected TLS rejection, got HTTP {} — \
                 pinning did not preserve chain validation",
                resp.status
            );
        }
    }
}

#[test]
#[ignore]
fn manual_3c_m2_proxy_env_bypassed_by_pinned_client() {
    // Local TCP listener acting as a proxy. Log every connection it
    // receives and reply with a generic gateway error.
    let connections = Arc::new(AtomicUsize::new(0));
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind proxy");
    let proxy_port = listener.local_addr().unwrap().port();
    let connections_clone = connections.clone();
    let _proxy_handle = thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(mut s) => {
                    connections_clone.fetch_add(1, Ordering::SeqCst);
                    let mut buf = [0u8; 1024];
                    let _ = s.read(&mut buf);
                    let _ = s.write_all(
                        b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n",
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Set proxy env vars. reqwest would read these at client build
    // time unless .no_proxy() is set.
    std::env::set_var(
        "HTTPS_PROXY",
        format!("http://127.0.0.1:{}", proxy_port),
    );
    std::env::set_var(
        "https_proxy",
        format!("http://127.0.0.1:{}", proxy_port),
    );

    // Pinned client, unroutable destination (TEST-NET-1). The
    // destination IP does not matter for this test. If .no_proxy()
    // works, TCP connect goes to 192.0.2.1:443 and never reaches
    // the proxy. If it fails, reqwest sends CONNECT to our proxy.
    let client = ReqwestHttpClient::pinned("test.example.invalid", ip("192.0.2.1"), 443)
        .expect("pinned construction");

    let req = HttpRequest {
        method: HttpMethod::Get,
        url: "https://test.example.invalid/".to_string(),
        headers: vec![],
        body: vec![],
    };

    // Send on a detached thread. We only need a short window to
    // observe whether the proxy was contacted. The thread's own
    // connect timeout runs 30s in the background; the test does not
    // wait for it. Process exit cleans up.
    let _request_handle = thread::spawn(move || {
        let _ = client.execute(&req);
    });

    thread::sleep(Duration::from_secs(2));

    let observed = connections.load(Ordering::SeqCst);

    println!();
    println!("=== 3c-M2 observed result ===");
    println!("HTTPS_PROXY        = http://127.0.0.1:{}", proxy_port);
    println!("proxy listener got = {} connection(s)", observed);

    // Restore env.
    std::env::remove_var("HTTPS_PROXY");
    std::env::remove_var("https_proxy");

    assert_eq!(
        observed, 0,
        "3c-M2: proxy was contacted {} time(s); .no_proxy() did not bypass env vars",
        observed
    );

    println!("=== 3c-M2 PASS ===\n");
}