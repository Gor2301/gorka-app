// gorka-shared::sync_transport
//
// Frame reader and writer over a TCP stream.
//
// The wire framing is the outer TLV header from
// SYNC-ARCHITECTURE.md Section 22.6: a 6-byte header
// (u16 type, u32 length, big-endian) followed by length bytes
// of value. One frame is one complete message.
//
// Nothing here is Tauri-specific. The functions take a
// &mut TcpStream.

use std::io::{Read, Write};
use std::net::TcpStream;

/// Maximum size of a single frame value in bytes. Matches
/// SYNC-ARCHITECTURE.md Section 22.6.1 (16 MiB).
pub const MAX_FRAME_VALUE_BYTES: usize = 16 * 1024 * 1024;

/// Read one framed message. Blocks until a complete frame is
/// available, or the stream closes.
///
/// Returns the entire frame bytes: the 6-byte header followed by
/// the value bytes.
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