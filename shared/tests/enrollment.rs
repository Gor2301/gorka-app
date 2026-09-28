// shared/tests/enrollment.rs
//
// Integration tests for the enrollment package.
//
// These are the E1-E6 vectors from SYNC-TEST-VECTORS-v1.md.
// They treat gorka_shared as an external crate and exercise
// only its public surface, so they act as the shared crate's
// public-contract tests.
//
// E1  enrollment package creation, byte-exact known answer
// E2  import, correct passphrase
// E3  import, wrong passphrase
// E4  import, tampered payload
// E5  import, organization mismatch
// E6  import, wrong magic bytes

use gorka_shared::enrollment::{
    build_enrollment_package, parse_enrollment_package,
};

#[test]
fn e1_enrollment_package_creation() {
    let passphrase = "test-passphrase-001";
    let organization_id = "org-test-A";

    let organization_key = [0u8; 32];

    let salt: [u8; 16] = [0u8; 16];

    let nonce: [u8; 24] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    ];

    let package = build_enrollment_package(
        passphrase,
        organization_id,
        &organization_key,
        &salt,
        &nonce,
    )
    .expect("E1: package construction failed");

    assert_eq!(&package[0..8], b"GORKAEP\0", "E1: magic");
    assert_eq!(
        u16::from_be_bytes([package[8], package[9]]),
        0x0001,
        "E1: format_version"
    );
    assert_eq!(
        u32::from_be_bytes([package[10], package[11], package[12], package[13]]),
        131072,
        "E1: argon2_memory_kib"
    );
    assert_eq!(
        u32::from_be_bytes([package[14], package[15], package[16], package[17]]),
        4,
        "E1: argon2_iterations"
    );
    assert_eq!(package[18], 1, "E1: argon2_parallelism");
    assert_eq!(&package[19..35], &salt, "E1: salt");
    assert_eq!(&package[35..59], &nonce, "E1: nonce");

    let encrypted_payload_len = u32::from_be_bytes([
        package[59], package[60], package[61], package[62],
    ]);
    assert_eq!(encrypted_payload_len, 62, "E1: encrypted_payload_len");
    assert_eq!(package.len(), 125, "E1: package length");

    let package2 = build_enrollment_package(
        passphrase,
        organization_id,
        &organization_key,
        &salt,
        &nonce,
    )
    .expect("E1: second construction failed");
    assert_eq!(package, package2, "E1: not deterministic");

    let hex: String = package.iter().map(|b| format!("{:02x}", b)).collect();
    println!("E1 package ({} bytes): {}", package.len(), hex);
    let expected_hex = "474f524b41455000000100020000000000040100000000000000000000000000000000000102030405060708090a0b0c0d0e0f10111213141516170000003e8b53b5c87375885d9e5f6f95417e98f37c49c7e3d6e3dbb0c22bd4e6290f03599957e698b8971885b9b94d24b35545642cbc7d0e6d0117b8380605945841";
    let expected = hex::decode(expected_hex).expect("E1: recorded hex is not valid");
    assert_eq!(expected.len(), 125, "E1: recorded hex is not 125 bytes");
    assert_eq!(package, expected, "E1: package differs from recorded vector");
}

fn e1_package() -> Vec<u8> {
    let hex = "474f524b41455000000100020000000000040100000000000000000000000000000000000102030405060708090a0b0c0d0e0f10111213141516170000003e8b53b5c87375885d9e5f6f95417e98f37c49c7e3d6e3dbb0c22bd4e6290f03599957e698b8971885b9b94d24b35545642cbc7d0e6d0117b8380605945841";
    hex::decode(hex).expect("E1 hex is not valid")
}

#[test]
fn e2_import_correct_passphrase() {
    let package = e1_package();
    let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
    assert!(result.is_ok(), "E2: expected success, got {:?}", result.err());
    let key = result.unwrap();
    assert_eq!(key.len(), 32, "E2: key length");
    assert_eq!(key, [0u8; 32], "E2: E1 uses organization_key_zero");
}

#[test]
fn e3_import_wrong_passphrase() {
    let package = e1_package();
    let result = parse_enrollment_package(&package, "wrong-passphrase", "org-test-A");
    assert!(result.is_err(), "E3: expected error, got {:?}", result);
    assert_eq!(
        result.unwrap_err(),
        "Wrong passphrase or corrupted package",
        "E3: error message"
    );
}

#[test]
fn e4_import_tampered_payload() {
    let mut package = e1_package();
    // Flip one byte inside the ciphertext region (after the 63-byte header).
    package[70] ^= 0x01;
    let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
    assert!(result.is_err(), "E4: expected error, got {:?}", result);
    assert_eq!(
        result.unwrap_err(),
        "Wrong passphrase or corrupted package",
        "E4: error message"
    );
}

#[test]
fn e5_import_organization_mismatch() {
    let package = e1_package();
    let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-B");
    assert!(result.is_err(), "E5: expected error, got {:?}", result);
    assert_eq!(result.unwrap_err(), "Organization mismatch", "E5: error message");
}

#[test]
fn e6_import_wrong_magic() {
    let mut package = e1_package();
    // Corrupt the magic bytes.
    package[0] = 0x00;
    let result = parse_enrollment_package(&package, "test-passphrase-001", "org-test-A");
    assert!(result.is_err(), "E6: expected error, got {:?}", result);
    assert_eq!(
        result.unwrap_err(),
        "Invalid package: bad magic bytes",
        "E6: error message"
    );
}