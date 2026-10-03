// gorka-shared::sync_transport
//
// Frame reader and writer. Two layers:
//
//   1. The SessionTransport trait. Two methods: send one complete
//      frame, try to receive one complete frame without blocking
//      indefinitely. Implemented by TcpTransport here and by
//      RelayTransport in sync_relay.rs.
//
//   2. Free functions read_frame and write_frame, kept for the
//      blocking handshake path in sync_session.rs.
//
// Wire framing: outer TLV header (u16 type, u32 length, big-endian)
// followed by the length bytes. One frame is one complete message.
//
// Nothing here is Tauri-specific.

use std::io::{ErrorKind, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// Maximum size of a single frame value in bytes. Matches
/// SYNC-ARCHITECTURE.md Section 22.6.1 (16 MiB).
pub const MAX_FRAME_VALUE_BYTES: usize = 16 * 1024 * 1024;

// ---------------------------------------------------------------
// SessionTransport trait
// ---------------------------------------------------------------

/// The transport interface the Session needs.
///
/// Frame semantics, not byte-stream semantics. `send_frame` sends
/// one complete frame. `try_recv_frame` returns one complete frame
/// if available, `Ok(None)` if not yet, or `Err` on failure.
pub trait SessionTransport: Send {
    /// Send one complete frame. Blocks until all bytes are out.
    fn send_frame(&mut self, bytes: &[u8]) -> Result<(), String>;

    /// Try to receive one complete frame without blocking
    /// indefinitely.
    ///
    /// Returns:
    ///   Ok(Some(frame))  a complete frame is available
    ///   Ok(None)         no complete frame yet; caller may retry
    ///   Err(...)         connection closed or a real I/O error
    fn try_recv_frame(&mut self) -> Result<Option<Vec<u8>>, String>;
}

// ---------------------------------------------------------------
// HandshakeTransport trait
// ---------------------------------------------------------------

/// The transport interface used during the handshake.
///
/// The handshake is blocking: each side sends a message and
/// waits for the reply. After the handshake, the session switches
/// the transport into tick-loop mode via `enter_tick_loop`, at
/// which point `SessionTransport`'s non-blocking methods take
/// over.
pub trait HandshakeTransport {
    /// Blocking send. Waits until the frame is out.
    fn send_blocking(&mut self, bytes: &[u8]) -> Result<(), String>;

    /// Blocking receive. Waits until a complete frame arrives or
    /// the transport closes.
    fn recv_blocking(&mut self) -> Result<Vec<u8>, String>;

    /// Switch to tick-loop mode. For TCP, this sets a socket read
    /// timeout. For a WebSocket, this switches the socket to
    /// non-blocking.
    fn enter_tick_loop(&mut self, tick: Duration) -> Result<(), String>;
}

// ---------------------------------------------------------------
// TcpTransport
// ---------------------------------------------------------------

/// A SessionTransport over a TCP stream.
///
/// Preserves the existing wire framing: outer TLV header plus
/// length bytes. Keeps a small read buffer so a partial frame that
/// arrives across a tick boundary is preserved.
pub struct TcpTransport {
    stream: TcpStream,
    read_buffer: Vec<u8>,
}

impl TcpTransport {
    pub fn new(stream: TcpStream) -> Self {
        Self {
            stream,
            read_buffer: Vec::new(),
        }
    }

    /// Set the socket read timeout. Idempotent. Call once after
    /// the handshake, before entering the tick loop.
    pub fn set_read_timeout(&self, timeout: Option<Duration>) -> Result<(), String> {
        self.stream
            .set_read_timeout(timeout)
            .map_err(|e| format!("set read timeout: {}", e))
    }

    /// Access to the inner stream if needed.
    pub fn stream(&self) -> &TcpStream {
        &self.stream
    }
}

impl HandshakeTransport for TcpTransport {
    fn send_blocking(&mut self, bytes: &[u8]) -> Result<(), String> {
        write_frame(&mut self.stream, bytes)
    }

    fn recv_blocking(&mut self) -> Result<Vec<u8>, String> {
        read_frame(&mut self.stream)
    }

    fn enter_tick_loop(&mut self, tick: Duration) -> Result<(), String> {
        self.set_read_timeout(Some(tick))
    }
}

impl SessionTransport for TcpTransport {
    fn send_frame(&mut self, bytes: &[u8]) -> Result<(), String> {
        write_frame(&mut self.stream, bytes)
    }

    fn try_recv_frame(&mut self) -> Result<Option<Vec<u8>>, String> {
        loop {
            // Try to parse a complete frame from the buffer.
            if self.read_buffer.len() >= 6 {
                let value_len = u32::from_be_bytes([
                    self.read_buffer[2],
                    self.read_buffer[3],
                    self.read_buffer[4],
                    self.read_buffer[5],
                ]) as usize;
                if value_len > MAX_FRAME_VALUE_BYTES {
                    return Err(format!(
                        "frame value too large: {} bytes (max {})",
                        value_len, MAX_FRAME_VALUE_BYTES
                    ));
                }
                let total = 6 + value_len;
                if self.read_buffer.len() >= total {
                    let frame = self.read_buffer[..total].to_vec();
                    self.read_buffer.drain(..total);
                    return Ok(Some(frame));
                }
            }

            // Need more bytes.
            let mut chunk = [0u8; 8192];
            match self.stream.read(&mut chunk) {
                Ok(0) => return Err("peer closed the connection".to_string()),
                Ok(n) => {
                    self.read_buffer.extend_from_slice(&chunk[..n]);
                }
                Err(e)
                    if e.kind() == ErrorKind::WouldBlock
                        || e.kind() == ErrorKind::TimedOut =>
                {
                    return Ok(None);
                }
                Err(e) => return Err(format!("read: {}", e)),
            }
        }
    }
}

// ---------------------------------------------------------------
// Free functions (blocking, handshake only)
// ---------------------------------------------------------------

/// Read one framed message. Blocks until a complete frame is
/// available, or the stream closes.
///
/// Used during the handshake. The engine's tick loop uses
/// TcpTransport::try_recv_frame instead.
pub fn read_frame(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut header = [0u8; 6];
    stream
        .read_exact(&mut header)
        .map_err(|e| format!("read frame header: {}", e))?;
    let value_len =
        u32::from_be_bytes([header[2], header[3], header[4], header[5]]) as usize;
    if value_len > MAX_FRAME_VALUE_BYTES {
        return Err(format!(
            "frame value too large: {} bytes (max {})",
            value_len, MAX_FRAME_VALUE_BYTES
        ));
    }
    let mut value = vec![0u8; value_len];
    stream
        .read_exact(&mut value)
        .map_err(|e| format!("read frame value: {}", e))?;
    let mut out = Vec::with_capacity(6 + value_len);
    out.extend_from_slice(&header);
    out.extend_from_slice(&value);
    Ok(out)
}

/// Write one framed message. Blocks until all bytes are sent and
/// the stream is flushed.
pub fn write_frame(stream: &mut TcpStream, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 6 {
        return Err("frame too short for header".to_string());
    }
    stream
        .write_all(bytes)
        .map_err(|e| format!("write frame: {}", e))?;
    stream
        .flush()
        .map_err(|e| format!("flush frame: {}", e))?;
    Ok(())
}