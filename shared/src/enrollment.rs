// gorka-shared::enrollment
//
// The enrollment package: the one place the organization key leaves
// a device. Created by the admin's Client Dashboard, imported by an
// agent's device.
//
// Specified in SYNC-ARCHITECTURE.md Section 7.3 and Section 22.7.
// The frozen Argon2id parameters are 131072 / 4 / 1 (Section 22.7.1,
// Section 22.19.2, frozen September 24, 2026).
//
// Nothing here is Tauri-specific. Nothing here performs I/O or
// generates randomness. Callers supply the salt and nonce.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{aead::{Aead, KeyInit, Payload}, XChaCha20Poly1305, XNonce};

/// Build an enrollment package.
///
/// This is the shared package-construction operation. It is the
/// single implementation used by both the production export command
/// and the E1 known-answer test. It performs no I/O and generates no
/// randomness: the salt and nonce are supplied by the caller.
///
/// Inputs:
///   passphrase        UTF-8 passphrase for the package
///   organization_id   the organization id, as a string
///   organization_key  the 32-byte organization key
///   salt              16-byte Argon2id salt
///   nonce             24-byte XChaCha20-Poly1305 nonce
///
/// Output: the complete package bytes: 63-byte header, then the
/// AEAD ciphertext and 16-byte tag.
pub fn build_enrollment_package(
    passphrase: &str,
    organization_id: &str,
    organization_key: &[u8],
    salt: &[u8; 16],
    nonce: &[u8; 24],
) -> Result<Vec<u8>, String> {
    if organization_key.len() != 32 {
        return Err("Invalid organization key length".to_string());
    }

    // Derive the package encryption key with Argon2id at the frozen parameters.
    let params = Params::new(131072, 4, 1, Some(32))
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut package_key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut package_key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    // Build the inner content: org_id_len (u32 BE) || org_id || org_key.
    let org_id_bytes = organization_id.as_bytes();
    let mut inner = Vec::with_capacity(4 + org_id_bytes.len() + 32);
    inner.extend_from_slice(&(org_id_bytes.len() as u32).to_be_bytes());
    inner.extend_from_slice(org_id_bytes);
    inner.extend_from_slice(organization_key);

    // Ciphertext length = plaintext length + 16-byte Poly1305 tag.
    let encrypted_payload_len = (inner.len() + 16) as u32;

    // Build the 63-byte header exactly as it will be transmitted.
    let mut header = Vec::with_capacity(63);
    header.extend_from_slice(b"GORKAEP\0");
    header.extend_from_slice(&1u16.to_be_bytes());
    header.extend_from_slice(&131072u32.to_be_bytes());
    header.extend_from_slice(&4u32.to_be_bytes());
    header.push(1u8);
    header.extend_from_slice(salt);
    header.extend_from_slice(nonce);
    header.extend_from_slice(&encrypted_payload_len.to_be_bytes());

    if header.len() != 63 {
        return Err("Internal error: header length is not 63 bytes".to_string());
    }

    // Encrypt with XChaCha20-Poly1305, using the full header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(&package_key)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(nonce);
    let ciphertext = cipher
        .encrypt(
            xnonce,
            Payload {
                msg: &inner,
                aad: &header,
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Assemble the full package: header || ciphertext (which includes the tag).
    let mut package = Vec::with_capacity(header.len() + ciphertext.len());
    package.extend_from_slice(&header);
    package.extend_from_slice(&ciphertext);

    Ok(package)
}

/// Parse and decrypt an enrollment package.
///
/// This is the shared package-parsing operation. It is the single
/// implementation used by both the production import command and
/// the E2-E6 behavioral tests. It performs no I/O and touches no
/// database: the file bytes and the trusted organization id are
/// supplied by the caller.
///
/// Inputs:
///   file            the complete package bytes
///   passphrase      the passphrase entered by the agent
///   trusted_org_id  the organization id from the local session
///
/// Output: the 32-byte organization key on success, or an error
/// string identifying the failure.
pub fn parse_enrollment_package(
    file: &[u8],
    passphrase: &str,
    trusted_org_id: &str,
) -> Result<[u8; 32], String> {
    // Verify minimum length: 63-byte header.
    if file.len() < 63 {
        return Err("Invalid package: file too short".to_string());
    }

    // Verify magic bytes.
    if &file[0..8] != b"GORKAEP\0" {
        return Err("Invalid package: bad magic bytes".to_string());
    }

    // Read format_version (u16 BE, bytes 8..10).
    let format_version = u16::from_be_bytes([file[8], file[9]]);
    if format_version != 0x0001 {
        return Err("Unsupported package version".to_string());
    }

    // Read the header fields.
    let argon2_memory_kib = u32::from_be_bytes([file[10], file[11], file[12], file[13]]);
    let argon2_iterations = u32::from_be_bytes([file[14], file[15], file[16], file[17]]);
    let argon2_parallelism = file[18];
    let argon2_salt = &file[19..35];
    let aead_nonce = &file[35..59];
    let encrypted_payload_len =
        u32::from_be_bytes([file[59], file[60], file[61], file[62]]) as usize;

    // Verify total length.
    if file.len() != 63 + encrypted_payload_len {
        return Err("Invalid package: length mismatch".to_string());
    }

    // Derive the package key with the header's parameters.
    let params = Params::new(
        argon2_memory_kib,
        argon2_iterations,
        argon2_parallelism as u32,
        Some(32),
    )
    .map_err(|e| format!("Key derivation failed: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut package_key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), argon2_salt, &mut package_key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    // Decrypt with the full header as AAD.
    let cipher = XChaCha20Poly1305::new_from_slice(&package_key)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let xnonce = XNonce::from_slice(aead_nonce);
    let plaintext = cipher
        .decrypt(
            xnonce,
            Payload {
                msg: &file[63..],
                aad: &file[0..63],
            },
        )
        .map_err(|_| "Wrong passphrase or corrupted package".to_string())?;

    // Parse the inner content: org_id_len (u32 BE) || org_id || org_key (32).
    if plaintext.len() < 4 {
        return Err("Invalid package: malformed inner content".to_string());
    }
    let org_id_len =
        u32::from_be_bytes([plaintext[0], plaintext[1], plaintext[2], plaintext[3]]) as usize;
    let expected_len = 4 + org_id_len + 32;
    if plaintext.len() != expected_len {
        return Err("Invalid package: malformed inner content".to_string());
    }
    let package_org_id = std::str::from_utf8(&plaintext[4..4 + org_id_len])
        .map_err(|_| "Invalid package: malformed inner content".to_string())?;
    let organization_key = &plaintext[4 + org_id_len..4 + org_id_len + 32];

    // Compare the package's organization id to the trusted id.
    if package_org_id != trusted_org_id {
        return Err("Organization mismatch".to_string());
    }

    let mut key_out = [0u8; 32];
    key_out.copy_from_slice(organization_key);
    Ok(key_out)
}