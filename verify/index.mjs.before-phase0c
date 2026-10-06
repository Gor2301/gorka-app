// verify/index.mjs
//
// Second, independent implementation of the nine deterministic test
// vectors recorded in SYNC-TEST-VECTORS-v1.md.
//
// Written from SYNC-ARCHITECTURE.md v1.3 and SYNC-TEST-VECTORS-v1.md
// only. The Rust implementation (src-tauri/src/main.rs) was not
// read, consulted, or used as a reference.
//
// Run: node index.mjs

import { createHmac, hkdfSync } from 'node:crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { argon2id } from 'hash-wasm';

// ---------------------------------------------------------------
// Byte-level primitives (SYNC-ARCHITECTURE.md 22.2, 22.3, 22.4, 22.5)
// ---------------------------------------------------------------

const u8 = (n) => new Uint8Array([n & 0xff]);
const u16be = (n) => new Uint8Array([(n >>> 8) & 0xff, n & 0xff]);
const u32be = (n) => new Uint8Array([
  (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff,
]);
const u64be = (n) => {
  const hi = Math.floor(n / 0x100000000);
  const lo = n - hi * 0x100000000;
  return new Uint8Array([
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
  ]);
};
const concat = (...parts) => {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
};
const utf8 = (s) => new TextEncoder().encode(s);
const hexToBytes = (hex) => {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('odd hex length: ' + clean.length);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
};
const bytesToHex = (bytes) => {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
};

// String value (22.3): u32 byte-length || UTF-8 bytes.
const encodeString = (s) => {
  const b = utf8(s);
  return concat(u32be(b.length), b);
};

// TLV record (22.5): u16 type || u32 length || value bytes.
const tlv = (type, value) => concat(u16be(type), u32be(value.length), value);

const tlvString = (type, s) => tlv(type, encodeString(s));
const tlvRaw    = (type, b) => tlv(type, b);
const tlvU8     = (type, n) => tlv(type, u8(n));
const tlvU16    = (type, n) => tlv(type, u16be(n));
const tlvU32    = (type, n) => tlv(type, u32be(n));
const tlvU64    = (type, n) => tlv(type, u64be(n));

// ---------------------------------------------------------------
// Cryptographic primitives (22.6.7, 22.19)
// ---------------------------------------------------------------

const hmacSha256 = (key, msg) =>
  new Uint8Array(createHmac('sha256', key).update(msg).digest());

const hkdfSha256 = ({ ikm, salt, info, length }) =>
  new Uint8Array(hkdfSync('sha256', ikm, salt, info, length));

const xchachaEncrypt = ({ key, nonce, aad, plaintext }) =>
  xchacha20poly1305(key, nonce, aad).encrypt(plaintext);

const xchachaDecrypt = ({ key, nonce, aad, ciphertext }) =>
  xchacha20poly1305(key, nonce, aad).decrypt(ciphertext);

const argon2idDerive = (opts) => argon2id({
  password: opts.password,
  salt: opts.salt,
  memorySize: opts.memoryKib,
  iterations: opts.iterations,
  parallelism: opts.parallelism,
  hashLength: opts.hashLength,
  outputType: 'binary',
});

// ---------------------------------------------------------------
// Fixtures (SYNC-TEST-VECTORS-v1.md section 2)
// ---------------------------------------------------------------

const F = {
  org_key_zero: hexToBytes('00'.repeat(32)),
  session_key_zero: hexToBytes('00'.repeat(32)),
  handshake_auth_key_zero: hexToBytes('00'.repeat(32)),
  nonce_zero: hexToBytes('00'.repeat(24)),
  nonce_structured: hexToBytes(
    '000102030405060708090a0b0c0d0e0f1011121314151617',
  ),
  argon2id_salt_zero: hexToBytes('00'.repeat(16)),
  passphrase: 'test-passphrase-001',
  org_id_A: 'org-test-A',
  org_id_B: 'org-test-B',
  dev_id_A: 'device-test-A',
  dev_id_B: 'device-test-B',
  event_id_001: hexToBytes('018f3e5a7c0070008000000000000001'),
  entity_id_001: 'entity-test-001',
  created_at: 1789891200000,
};

// ---------------------------------------------------------------
// Expected values (SYNC-TEST-VECTORS-v1.md section 3)
// ---------------------------------------------------------------

const EXPECTED = {
  E1: '474f524b41455000000100020000000000040100000000000000000000000000000000000102030405060708090a0b0c0d0e0f10111213141516170000003e8b53b5c87375885d9e5f6f95417e98f37c49c7e3d6e3dbb0c22bd4e6290f03599957e698b8971885b9b94d24b35545642cbc7d0e6d0117b8380605945841',
  H1: '09f86098b9d761d7ce69fba650ff46ec8be6ace240cde3034b4428d0c6d60530',
  H2: '20e675fa720171aa1b49c530ed5e1c5e54cd1e41a89f4ab691a1980e88bbc9eb',
  H3: 'e37ba7454ebf9b85d12c9e0156d5ec7bc9dc3b2d7f2c10ca689b1e6b45891fd5',
  M1: '0010000000e9000000000000000000000000000000000000000000000000689f9689e5308cf0e7bb8fc5c5349f48ef18a13e418888afdadd97a7693a987e9e81ecd5c1d82affd1af49650d8021a8e04104a0db119aa3a9e8333903e2c0fea4937a85652313ccf9e84193bff5bd2aa17e97c33a2ad487f778f8dc6b032ba59cbe3be778ea2e50bb5908d8921c4fec2d93532e71892d17cba49060dec4d6c84c7a09e634d6362546dff5763d47ba8c8837090f06b4cb8ea0322e6a3965b70fc7b3e5b63f12ffb636ecf14f6947142f3112855b80a303f3cbe443f5fa2b77ebba8e126abff95d1b728e7a830570621147',
  M2: '100100000010018f3e5a7c00700080000000000000011002000000040000000110030000009b110100000010018f3e5a7c007000800000000000000111020000000d6465766963652d746573742d411103000000080000000000000001110400000008000000000000000111050000000200011106000000010111070000000f656e746974792d746573742d303031110800000008000001a0bdd4440011090000001e200100000008000000045465737420020000000a00000006446562746f72',
  V1: '200100000008000000045465737420020000000a00000006446562746f72',
  V4: '30010000002030110000000b0000000764656c657465643012000000090000000566616c7365',
  V6: '5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c500500000006000000023031',
};

// ---------------------------------------------------------------
// Vector implementations
// ---------------------------------------------------------------

// V1 (25.8.3): DEBTOR_CREATED payload.
const buildV1 = () => concat(
  tlvString(0x2001, 'Test'),
  tlvString(0x2002, 'Debtor'),
);

// V4 (25.9.3): ENTITY_UPDATED payload.
const buildV4 = () => {
  const change = concat(
    tlvString(0x3011, 'deleted'),
    tlvString(0x3012, 'false'),
  );
  return tlv(0x3001, change);
};

// V6 (25.11.3): COMMUNICATION_LOGGED payload.
const buildV6 = () => concat(
  tlvString(0x5001, F.entity_id_001),
  tlvString(0x5002, 'CALL'),
  tlvString(0x5003, 'OUTBOUND'),
  tlvString(0x5004, 'Test call'),
  tlvString(0x5005, '01'),
);

// Event record (22.13.2).
const buildEventRecord = () => concat(
  tlvRaw (0x1101, F.event_id_001),
  tlvRaw (0x1102, utf8(F.dev_id_A)),
  tlvU64 (0x1103, 1),
  tlvU64 (0x1104, 1),
  tlvU16 (0x1105, 0x0001),
  tlvU8  (0x1106, 0x01),
  tlvRaw (0x1107, utf8(F.entity_id_001)),
  tlvU64 (0x1108, F.created_at),
  tlvRaw (0x1109, buildV1()),
);

// SYNC_MESSAGE inner content (22.13.1).
const buildSyncInner = () => concat(
  tlvRaw(0x1001, F.event_id_001),
  tlvU32(0x1002, 1),
  tlvRaw(0x1003, buildEventRecord()),
);

// E1 (22.7): enrollment package.
const buildE1 = async () => {
  const inner = concat(
    u32be(utf8(F.org_id_A).length),
    utf8(F.org_id_A),
    F.org_key_zero,
  );

  const packageKey = await argon2idDerive({
    password: F.passphrase,
    salt: F.argon2id_salt_zero,
    memoryKib: 131072,
    iterations: 4,
    parallelism: 1,
    hashLength: 32,
  });

  const header = concat(
    utf8('GORKAEP\0'),
    u16be(0x0001),
    u32be(131072),
    u32be(4),
    u8(1),
    F.argon2id_salt_zero,
    F.nonce_structured,
    u32be(inner.length + 16),
  );

  const encrypted = xchachaEncrypt({
    key: packageKey,
    nonce: F.nonce_structured,
    aad: header,
    plaintext: inner,
  });

  return concat(header, encrypted);
};

// H1 (22.11.1, 22.19.1): session key derivation.
const buildH1 = () => {
  const salt = concat(F.nonce_zero, F.nonce_structured);
  const info = concat(
    utf8('GORKA-MVP-SESSION-v1'),
    u16be(utf8(F.org_id_A).length),
    utf8(F.org_id_A),
    u16be(utf8(F.dev_id_A).length),
    utf8(F.dev_id_A),
    u16be(utf8(F.dev_id_B).length),
    utf8(F.dev_id_B),
  );
  return hkdfSha256({ ikm: F.org_key_zero, salt, info, length: 32 });
};

// H2, H3 (22.9.3, 22.10.2, 22.19.1): handshake proof tags.
const buildProofInput = (domain) => concat(
  utf8(domain),
  u16be(0x0001),
  u16be(utf8(F.org_id_A).length),
  utf8(F.org_id_A),
  u16be(utf8(F.dev_id_A).length),
  utf8(F.dev_id_A),
  F.nonce_zero,
  u16be(utf8(F.org_id_B).length),
  utf8(F.org_id_B),
  u16be(utf8(F.dev_id_B).length),
  utf8(F.dev_id_B),
  F.nonce_structured,
);
const buildH2 = () => hmacSha256(
  F.handshake_auth_key_zero,
  buildProofInput('GORKA-MVP-HANDSHAKE-REPLY-v1'),
);
const buildH3 = () => hmacSha256(
  F.handshake_auth_key_zero,
  buildProofInput('GORKA-MVP-HANDSHAKE-CONFIRM-v1'),
);

// M1 (22.13.1, 22.6.3): SYNC_MESSAGE encryption.
const buildM1 = () => {
  const inner = buildSyncInner();
  const outerLength = 24 + inner.length + 16;
  const outerHeader = concat(u16be(0x0010), u32be(outerLength));
  const encrypted = xchachaEncrypt({
    key: F.session_key_zero,
    nonce: F.nonce_zero,
    aad: outerHeader,
    plaintext: inner,
  });
  return concat(outerHeader, F.nonce_zero, encrypted);
};

// M2 (22.13.1, 22.6.3): SYNC_MESSAGE decryption.
const buildM2 = (framed) => {
  if (framed.length < 6 + 24 + 16) throw new Error('M2: message too short');
  const header = framed.slice(0, 6);
  const nonce = framed.slice(6, 30);
  const ciphertext = framed.slice(30);
  return xchachaDecrypt({
    key: F.session_key_zero, nonce, aad: header, ciphertext,
  });
};

// ---------------------------------------------------------------
// Runner
// ---------------------------------------------------------------

const ORDER = ['E1', 'H1', 'H2', 'H3', 'M1', 'M2', 'V1', 'V4', 'V6'];

const runAll = async () => {
  const results = {};

  const record = async (id, fn) => {
    try {
      const bytes = await fn();
      const actualHex = bytesToHex(bytes);
      const expectedHex = EXPECTED[id];
      results[id] = { pass: actualHex === expectedHex, actualHex, expectedHex };
    } catch (e) {
      results[id] = { pass: false, error: String((e && e.message) || e) };
    }
  };

  await record('E1', buildE1);
  await record('H1', buildH1);
  await record('H2', buildH2);
  await record('H3', buildH3);

  // M1 must run before M2: M2 consumes M1's exact bytes.
  let m1Bytes = null;
  try {
    m1Bytes = buildM1();
    const m1Hex = bytesToHex(m1Bytes);
    results['M1'] = { pass: m1Hex === EXPECTED.M1, actualHex: m1Hex, expectedHex: EXPECTED.M1 };
  } catch (e) {
    results['M1'] = { pass: false, error: String((e && e.message) || e) };
  }
  if (m1Bytes) {
    await record('M2', () => buildM2(m1Bytes));
  } else {
    results['M2'] = { pass: false, error: 'M1 failed; M2 skipped' };
  }

  await record('V1', buildV1);
  await record('V4', buildV4);
  await record('V6', buildV6);

  let pass = 0;
  for (const id of ORDER) {
    const r = results[id];
    if (!r) { console.log(`${id}  MISSING`); continue; }
    if (r.pass) {
      pass++;
      console.log(`${id}  PASS`);
    } else {
      console.log(`${id}  FAIL`);
      if (r.error) {
        console.log(`      error: ${r.error}`);
      } else {
        console.log(`      expected: ${r.expectedHex}`);
        console.log(`      actual:   ${r.actualHex}`);
        console.log(`      lengths:  expected=${r.expectedHex.length / 2} actual=${r.actualHex.length / 2}`);
      }
    }
  }
  console.log(`\n${pass}/9 PASS`);
  process.exit(pass === 9 ? 0 : 1);
};

runAll().catch((e) => {
  console.error('Runner crashed:', e);
  process.exit(2);
});