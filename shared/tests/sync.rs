// shared/tests/sync.rs
//
// Integration tests for the GORKA sync protocol primitives.
//
// These are the H, M, and V vectors from SYNC-TEST-VECTORS-v1.md.
// They treat gorka_shared as an external crate and exercise only
// its public surface, so they act as the shared crate's
// public-contract tests.
//
// H1  session key derivation (HKDF-SHA256)
// H2  handshake REPLY proof tag (HMAC-SHA256)
// H3  handshake CONFIRM proof tag (HMAC-SHA256)
// M1  SYNC_MESSAGE framing and encryption
// M2  SYNC_MESSAGE decryption
// V1  DEBTOR_CREATED payload
// V4  ENTITY_UPDATED payload
// V6  COMMUNICATION_LOGGED payload

use gorka_shared::sync::{
    derive_session_key,
    compute_handshake_reply_tag,
    compute_handshake_confirm_tag,
    encode_tlv,
    encode_debtor_created_payload,
    encode_entity_updated_payload,
    encode_communication_logged_payload,
    encode_event_record,
    build_sync_message,
    parse_sync_message,
};

#[test]
fn h1_session_key_derivation() {
    let organization_key = [0u8; 32];
    let initiator_nonce: [u8; 24] = [0u8; 24];
    let responder_nonce: [u8; 24] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    ];
    let organization_id = "org-test-A";
    let initiator_device_id: &[u8] = b"device-test-A";
    let responder_device_id: &[u8] = b"device-test-B";

    // Byte-width assertions (spec Section 7).
    assert_eq!(
        (organization_id.len() as u16).to_be_bytes(),
        [0x00, 0x0A],
        "H1: org-test-A length prefix must be 00 0A"
    );

    let session_key = derive_session_key(
        &organization_key,
        &initiator_nonce,
        &responder_nonce,
        organization_id,
        initiator_device_id,
        responder_device_id,
    )
    .expect("H1: session key derivation failed");

    assert_eq!(session_key.len(), 32, "H1: session key length");

    let session_key2 = derive_session_key(
        &organization_key,
        &initiator_nonce,
        &responder_nonce,
        organization_id,
        initiator_device_id,
        responder_device_id,
    )
    .expect("H1: second derivation failed");
    assert_eq!(session_key, session_key2, "H1: not deterministic");

    let hex: String = session_key.iter().map(|b| format!("{:02x}", b)).collect();
    println!("H1 session key (32 bytes): {}", hex);
    let expected = hex::decode("09f86098b9d761d7ce69fba650ff46ec8be6ace240cde3034b4428d0c6d60530").expect("H1: recorded hex is not valid");
    assert_eq!(session_key, expected.as_slice(), "H1: session key differs from recorded vector");
}

#[test]
fn h2_handshake_reply_tag() {
    let handshake_key = [0u8; 32];
    let protocol_version: u16 = 0x0001;
    let initiator_organization_id = "org-test-A";
    let initiator_device_id: &[u8] = b"device-test-A";
    let initiator_nonce: [u8; 24] = [0u8; 24];
    let responder_organization_id = "org-test-B";
    let responder_device_id: &[u8] = b"device-test-B";
    let responder_nonce: [u8; 24] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    ];

    // Byte-width assertion (spec Section 7).
    assert_eq!(
        protocol_version.to_be_bytes(),
        [0x00, 0x01],
        "H2: protocol_version must be 00 01"
    );

    let tag = compute_handshake_reply_tag(
        &handshake_key,
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        &initiator_nonce,
        responder_organization_id,
        responder_device_id,
        &responder_nonce,
    )
    .expect("H2: proof tag failed");

    assert_eq!(tag.len(), 32, "H2: tag length");

    let tag2 = compute_handshake_reply_tag(
        &handshake_key,
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        &initiator_nonce,
        responder_organization_id,
        responder_device_id,
        &responder_nonce,
    )
    .expect("H2: second tag failed");
    assert_eq!(tag, tag2, "H2: not deterministic");

    let hex: String = tag.iter().map(|b| format!("{:02x}", b)).collect();
    println!("H2 REPLY tag (32 bytes): {}", hex);
    let expected = hex::decode("20e675fa720171aa1b49c530ed5e1c5e54cd1e41a89f4ab691a1980e88bbc9eb").expect("H2: recorded hex is not valid");
    assert_eq!(tag, expected.as_slice(), "H2: tag differs from recorded vector");
}

#[test]
fn h3_handshake_confirm_tag() {
    let handshake_key = [0u8; 32];
    let protocol_version: u16 = 0x0001;
    let initiator_organization_id = "org-test-A";
    let initiator_device_id: &[u8] = b"device-test-A";
    let initiator_nonce: [u8; 24] = [0u8; 24];
    let responder_organization_id = "org-test-B";
    let responder_device_id: &[u8] = b"device-test-B";
    let responder_nonce: [u8; 24] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    ];

    let confirm_tag = compute_handshake_confirm_tag(
        &handshake_key,
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        &initiator_nonce,
        responder_organization_id,
        responder_device_id,
        &responder_nonce,
    )
    .expect("H3: proof tag failed");

    // H3 independently constructs the H2 tag and checks they differ.
    let reply_tag = compute_handshake_reply_tag(
        &handshake_key,
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        &initiator_nonce,
        responder_organization_id,
        responder_device_id,
        &responder_nonce,
    )
    .expect("H3: H2 tag for comparison failed");

    assert_eq!(confirm_tag.len(), 32, "H3: tag length");
    assert_ne!(confirm_tag, reply_tag, "H3: tag must differ from H2 tag");

    let confirm_tag2 = compute_handshake_confirm_tag(
        &handshake_key,
        protocol_version,
        initiator_organization_id,
        initiator_device_id,
        &initiator_nonce,
        responder_organization_id,
        responder_device_id,
        &responder_nonce,
    )
    .expect("H3: second tag failed");
    assert_eq!(confirm_tag, confirm_tag2, "H3: not deterministic");

    let hex: String = confirm_tag.iter().map(|b| format!("{:02x}", b)).collect();
    println!("H3 CONFIRM tag (32 bytes): {}", hex);
    let expected = hex::decode("e37ba7454ebf9b85d12c9e0156d5ec7bc9dc3b2d7f2c10ca689b1e6b45891fd5").expect("H3: recorded hex is not valid");
    assert_eq!(confirm_tag, expected.as_slice(), "H3: tag differs from recorded vector");
}

#[test]
fn m1_sync_message_encryption() {
    // Fixtures (spec section 11).
    let session_key = [0u8; 32];
    let nonce = [0u8; 24];
    // message_id = event_id_test_001, 16 bytes.
    let message_id: [u8; 16] = [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ];
    let device_id = "device-test-A";
    let entity_id = "entity-test-001";
    let created_at_ms: u64 = 1_789_891_200_000; // 2026-09-20T00:00:00Z

    // Build the DEBTOR_CREATED payload (V1 fields).
    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);

    // Build the event record.
    let event_id = message_id; // same bytes, per spec section 11
    let record = encode_event_record(
        &event_id,
        device_id.as_bytes(),
        1,
        1,
        0x0001, // DEBTOR_CREATED
        0x01,   // debtor
        entity_id.as_bytes(),
        created_at_ms,
        &payload,
    );

    // Build the framed, encrypted message.
    let framed = build_sync_message(&session_key, &nonce, &message_id, &[record.clone()])
        .expect("M1: build_sync_message failed");

    // Structural checks.
    assert_eq!(&framed[0..2], &[0x00, 0x10], "M1: outer type");
    let outer_length =
        u32::from_be_bytes([framed[2], framed[3], framed[4], framed[5]]) as usize;
    assert_eq!(framed.len(), 6 + outer_length, "M1: outer length");
    assert_eq!(&framed[6..30], &nonce, "M1: nonce");

    // Determinism.
    let framed2 = build_sync_message(&session_key, &nonce, &message_id, &[record])
        .expect("M1: second build failed");
    assert_eq!(framed, framed2, "M1: not deterministic");

    let hex: String = framed.iter().map(|b| format!("{:02x}", b)).collect();
    println!("M1 framed message ({} bytes): {}", framed.len(), hex);
    let expected = hex::decode("0010000000e9000000000000000000000000000000000000000000000000689f9689e5308cf0e7bb8fc5c5349f48ef18a13e418888afdadd97a7693a987e9e81ecd5c1d82affd1af49650d8021a8e04104a0db119aa3a9e8333903e2c0fea4937a85652313ccf9e84193bff5bd2aa17e97c33a2ad487f778f8dc6b032ba59cbe3be778ea2e50bb5908d8921c4fec2d93532e71892d17cba49060dec4d6c84c7a09e634d6362546dff5763d47ba8c8837090f06b4cb8ea0322e6a3965b70fc7b3e5b63f12ffb636ecf14f6947142f3112855b80a303f3cbe443f5fa2b77ebba8e126abff95d1b728e7a830570621147").expect("M1: recorded hex is not valid");
    assert_eq!(framed, expected, "M1: framed message differs from recorded vector");
}

#[test]
fn m2_sync_message_decryption() {
    let session_key = [0u8; 32];
    let nonce = [0u8; 24];
    let message_id: [u8; 16] = [
        0x01, 0x8F, 0x3E, 0x5A, 0x7C, 0x00, 0x70, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ];
    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);
    let record = encode_event_record(
        &message_id,
        "device-test-A".as_bytes(),
        1,
        1,
        0x0001,
        0x01,
        "entity-test-001".as_bytes(),
        1_789_891_200_000,
        &payload,
    );

    let framed = build_sync_message(&session_key, &nonce, &message_id, &[record.clone()])
        .expect("M2: build_sync_message failed");
    let inner = parse_sync_message(&session_key, &framed)
        .expect("M2: parse_sync_message failed");

    // The decrypted inner content must re-serialize to the same bytes
    // that build_sync_message encrypted.
    let mut expected_inner = Vec::new();
    expected_inner.extend_from_slice(&encode_tlv(0x1001, &message_id));
    expected_inner.extend_from_slice(&encode_tlv(0x1002, &1u32.to_be_bytes()));
    expected_inner.extend_from_slice(&encode_tlv(0x1003, &record));

    assert_eq!(inner, expected_inner, "M2: inner content mismatch");

    let hex: String = inner.iter().map(|b| format!("{:02x}", b)).collect();
    println!("M2 inner content ({} bytes): {}", inner.len(), hex);
    let expected = hex::decode("100100000010018f3e5a7c00700080000000000000011002000000040000000110030000009b110100000010018f3e5a7c007000800000000000000111020000000d6465766963652d746573742d411103000000080000000000000001110400000008000000000000000111050000000200011106000000010111070000000f656e746974792d746573742d303031110800000008000001a0bdd4440011090000001e200100000008000000045465737420020000000a00000006446562746f72").expect("M2: recorded hex is not valid");
    assert_eq!(inner, expected, "M2: inner content differs from recorded vector");
}

#[test]
fn v1_debtor_created_payload() {
    let payload = encode_debtor_created_payload("Test", "Debtor", None, None, None);

    // Structural check: two fields, types 0x2001 and 0x2002.
    assert_eq!(&payload[0..2], &[0x20, 0x01], "V1: first field type");
    let len1 = u32::from_be_bytes([payload[2], payload[3], payload[4], payload[5]]) as usize;
    assert_eq!(len1, 4 + 4, "V1: name TLV value length");
    let name_start = 6 + 4;
    assert_eq!(&payload[name_start..name_start + 4], b"Test", "V1: name");

    let second = name_start + 4;
    assert_eq!(&payload[second..second + 2], &[0x20, 0x02], "V1: second field type");

    let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
    println!("V1 payload ({} bytes): {}", payload.len(), hex);
    let expected = hex::decode("200100000008000000045465737420020000000a00000006446562746f72").expect("V1: recorded hex is not valid");
    assert_eq!(payload, expected, "V1: payload differs from recorded vector");
}

#[test]
fn v4_entity_updated_payload() {
    let payload = encode_entity_updated_payload(&[("deleted", Some("false"))]);

    // Structural check: outer 0x3001.
    assert_eq!(&payload[0..2], &[0x30, 0x01], "V4: outer type");
    // Inner: 0x3011 then 0x3012.
    let inner = &payload[6..];
    assert_eq!(&inner[0..2], &[0x30, 0x11], "V4: field_name type");

    let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
    println!("V4 payload ({} bytes): {}", payload.len(), hex);
    let expected = hex::decode("30010000002030110000000b0000000764656c657465643012000000090000000566616c7365").expect("V4: recorded hex is not valid");
    assert_eq!(payload, expected, "V4: payload differs from recorded vector");
}

#[test]
fn v6_communication_logged_payload() {
    let payload = encode_communication_logged_payload(
        "entity-test-001", "CALL", "OUTBOUND", "Test call", Some("01"),
    );

    // Structural check: five fields, types 0x5001 through 0x5005.
    assert_eq!(&payload[0..2], &[0x50, 0x01], "V6: first field type");

    let hex: String = payload.iter().map(|b| format!("{:02x}", b)).collect();
    println!("V6 payload ({} bytes): {}", payload.len(), hex);
    let expected = hex::decode("5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c500500000006000000023031").expect("V6: recorded hex is not valid");
    assert_eq!(payload, expected, "V6: payload differs from recorded vector");
}