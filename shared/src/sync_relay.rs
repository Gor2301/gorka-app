// gorka-shared::sync_relay
//
// WebSocket transport over the GORKA Control Plane relay.
//
// Used by the engine's Connect path when direct TCP fails. The
// transport speaks the same SessionTransport and HandshakeTransport
// interfaces as TcpTransport. The relay itself is a pipe: it
// forwards opaque binary WebSocket messages and cannot decrypt.
//
// Session frames are one binary WebSocket message each. Text
// frames carry relay control messages ("open-ok", "paired",
// "peer-closed") and are not session data.

use std::io::ErrorKind;
use std::net::TcpStream;
use std::time::{Duration, Instant};

use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Message, WebSocket};

use crate::sync_transport::{HandshakeTransport, SessionTransport};

const WS_OPEN_TIMEOUT: Duration = Duration::from_secs(10);

pub struct RelayTransport {
    ws: WebSocket<MaybeTlsStream<TcpStream>>,
}

impl RelayTransport {
    /// Open a WebSocket to the Control Plane relay, authenticate,
    /// pair with the target peer, and return the transport.
    ///
    /// `backend_base_url` is the Control Plane base URL
    /// (e.g. "http://localhost:3000"). The WebSocket URL is derived
    /// from it: ws(s)://<host>/api/sync/relay.
    pub fn connect(
        backend_base_url: &str,
        jwt: &str,
        wire_device_id_hex: &str,
        target_wire_device_id_hex: &str,
    ) -> Result<Self, String> {
        let ws_url = ws_url_from_base(backend_base_url);
        let (mut ws, _response) = connect(&ws_url)
            .map_err(|e| format!("relay connect {}: {}", ws_url, e))?;

        let open = serde_json::json!({
            "type": "open",
            "jwt": jwt,
            "wireDeviceId": wire_device_id_hex,
            "targetWireDeviceId": target_wire_device_id_hex,
        });
        ws.send(Message::Text(open.to_string()))
            .map_err(|e| format!("relay send open: {}", e))?;

        let start = Instant::now();
        loop {
            if start.elapsed() > WS_OPEN_TIMEOUT {
                return Err("relay open timeout".to_string());
            }
            match ws.read() {
                Ok(Message::Text(t)) => {
                    if t.contains("\"paired\"") {
                        return Ok(Self { ws });
                    }
                    if t.contains("\"open-ok\"") {
                        continue;
                    }
                    // Other text is ignored.
                }
                Ok(Message::Binary(_)) => {
                    // Unexpected before pairing. Ignore.
                }
                Ok(Message::Ping(p)) => {
                    let _ = ws.send(Message::Pong(p));
                }
                Ok(Message::Pong(_)) => {}
                Ok(Message::Close(_)) => {
                    return Err("relay closed before pairing".to_string());
                }
                Ok(_) => {}
                Err(e) => {
                    return Err(format!("relay read: {}", e));
                }
            }
        }
    }

    /// Wrap an already-paired WebSocket as a RelayTransport.
    ///
    /// The underlying socket is put back into blocking mode so
    /// the handshake's recv_blocking works. Session::accept then
    /// calls enter_tick_loop, which switches the same socket to
    /// a read timeout for the tick loop.
    pub fn from_paired_websocket(
        mut ws: WebSocket<MaybeTlsStream<TcpStream>>,
    ) -> Result<Self, String> {
        if let MaybeTlsStream::Plain(s) = ws.get_mut() {
            s.set_nonblocking(false)
                .map_err(|e| format!("relay set blocking: {}", e))?;
        }
        Ok(Self { ws })
    }
}

fn ws_url_from_base(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    let ws = if let Some(rest) = trimmed.strip_prefix("http://") {
        format!("ws://{}", rest)
    } else if let Some(rest) = trimmed.strip_prefix("https://") {
        format!("wss://{}", rest)
    } else {
        trimmed.to_string()
    };
    format!("{}/api/sync/relay", ws)
}

// ---------------------------------------------------------------
// Listener-side pairing
// ---------------------------------------------------------------

/// Open a pairing WebSocket to the relay with no target. The
/// underlying socket is set non-blocking on return, so the
/// listener can poll it alongside its TCP listener.
///
/// One attempt. The caller decides when to retry.
fn open_pairing_websocket(
    backend_base_url: &str,
    jwt: &str,
    wire_device_id_hex: &str,
) -> Result<WebSocket<MaybeTlsStream<TcpStream>>, String> {
    let ws_url = ws_url_from_base(backend_base_url);
    let (mut ws, _response) = connect(&ws_url)
        .map_err(|e| format!("relay connect {}: {}", ws_url, e))?;

    let open = serde_json::json!({
        "type": "open",
        "jwt": jwt,
        "wireDeviceId": wire_device_id_hex,
        // No targetWireDeviceId: the listener waits for a
        // connector to name it as its target.
    });
    ws.send(Message::Text(open.to_string()))
        .map_err(|e| format!("relay send open: {}", e))?;

    if let MaybeTlsStream::Plain(s) = ws.get_mut() {
        s.set_nonblocking(true)
            .map_err(|e| format!("relay set nonblocking: {}", e))?;
    }
    Ok(ws)
}

/// Listener-side pairing waiter.
///
/// Owns one pairing WebSocket. Does not reopen itself. When the
/// socket dies, `try_accept_pairing` returns `Err` and the caller
/// is expected to replace the waiter. Retry ownership lives with
/// the caller's loop, not here, so there is exactly one owner of
/// the retry/session lifecycle.
pub struct RelayPairingWaiter {
    // None after pairing has been claimed by try_accept_pairing.
    // Polling a consumed waiter returns Err.
    ws: Option<WebSocket<MaybeTlsStream<TcpStream>>>,
}

impl RelayPairingWaiter {
    /// Open a pairing WebSocket. One attempt. Returns Err if the
    /// relay is unreachable or the open frame cannot be sent.
    pub fn open(
        backend_base_url: &str,
        jwt: &str,
        wire_device_id_hex: &str,
    ) -> Result<Self, String> {
        let ws = open_pairing_websocket(
            backend_base_url,
            jwt,
            wire_device_id_hex,
        )?;
        Ok(Self { ws: Some(ws) })
    }

    /// Non-blocking poll.
    ///
    ///   Ok(Some(t))  paired; waiter is now consumed
    ///   Ok(None)     still waiting
    ///   Err(_)       this waiter is dead; caller must replace it
    pub fn try_accept_pairing(
        &mut self,
    ) -> Result<Option<RelayTransport>, String> {
        // Read one WebSocket message. The borrow of self.ws ends
        // when this match completes, so a later self.ws.take() is
        // legal.
        let paired = match self.ws.as_mut() {
            Some(ws) => match ws.read() {
                Ok(Message::Text(t)) => t.contains("\"paired\""),
                Ok(Message::Ping(p)) => {
                    let _ = ws.send(Message::Pong(p));
                    false
                }
                Ok(Message::Close(_)) => {
                    return Err("relay closed before pairing".to_string());
                }
                Ok(_) => false,
                Err(tungstenite::Error::Io(e))
                    if e.kind() == ErrorKind::WouldBlock
                        || e.kind() == ErrorKind::TimedOut =>
                {
                    false
                }
                Err(e) => return Err(format!("relay read: {}", e)),
            },
            None => {
                return Err("relay pairing waiter already consumed".to_string());
            }
        };

        if !paired {
            return Ok(None);
        }

        let ws = self.ws.take().unwrap();
        let transport = RelayTransport::from_paired_websocket(ws)?;
        Ok(Some(transport))
    }
}

impl HandshakeTransport for RelayTransport {
    fn send_blocking(&mut self, bytes: &[u8]) -> Result<(), String> {
        self.ws
            .send(Message::Binary(bytes.to_vec()))
            .map_err(|e| format!("relay send: {}", e))
    }

    fn recv_blocking(&mut self) -> Result<Vec<u8>, String> {
        loop {
            match self.ws.read() {
                Ok(Message::Binary(b)) => return Ok(b),
                Ok(Message::Text(_)) => continue,
                Ok(Message::Ping(p)) => {
                    let _ = self.ws.send(Message::Pong(p));
                }
                Ok(Message::Pong(_)) => {}
                Ok(Message::Close(_)) => return Err("relay closed".to_string()),
                Ok(_) => {}
                Err(e) => return Err(format!("relay read: {}", e)),
            }
        }
    }

    fn enter_tick_loop(&mut self, tick: Duration) -> Result<(), String> {
        if let MaybeTlsStream::Plain(s) = self.ws.get_mut() {
            s.set_read_timeout(Some(tick))
                .map_err(|e| format!("relay set timeout: {}", e))?;
        }
        Ok(())
    }
}

impl SessionTransport for RelayTransport {
    fn send_frame(&mut self, bytes: &[u8]) -> Result<(), String> {
        self.ws
            .send(Message::Binary(bytes.to_vec()))
            .map_err(|e| format!("relay send: {}", e))
    }

    fn try_recv_frame(&mut self) -> Result<Option<Vec<u8>>, String> {
        match self.ws.read() {
            Ok(Message::Binary(b)) => Ok(Some(b)),
            Ok(Message::Text(_)) => Ok(None),
            Ok(Message::Ping(p)) => {
                let _ = self.ws.send(Message::Pong(p));
                Ok(None)
            }
            Ok(Message::Pong(_)) => Ok(None),
            Ok(Message::Close(_)) => Err("relay closed".to_string()),
            Ok(_) => Ok(None),
            Err(tungstenite::Error::Io(e))
                if e.kind() == ErrorKind::WouldBlock
                    || e.kind() == ErrorKind::TimedOut =>
            {
                Ok(None)
            }
            Err(e) => Err(format!("relay read: {}", e)),
        }
    }
}