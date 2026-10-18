// src-tauri/src/bin/argon2bench.rs
//
// GORKA Argon2id benchmark for the MVP enrollment-package parameters.
//
// Measures Argon2id key derivation time for a fixed grid of
// (m_cost, t_cost, p_cost) triples on the machine it runs on.
//
// This harness is a measurement tool, not shipping code. It does not
// implement the enrollment package. It does not touch db.rs. It uses
// the same argon2 crate version (0.5.3) and the same call shape that
// the enrollment package will use, so the measurement is against the
// call the package will actually make.
//
// See ARGON2ID-BENCHMARK-SPEC.md (v1.2) for the full task spec.
//
// Run on the cloud machine:
//     cd C:\gorka-app\src-tauri
//     cargo run --release --bin argon2bench

use argon2::{Algorithm, Argon2, Params, Version};
use std::time::Instant;

// Fixed benchmark inputs. These are constants, not credentials.
// They have no security role. They exist so runs are comparable.
const PASSPHRASE: &str = "gorka-argon2-benchmark-passphrase-001";
const SALT: [u8; 16] = [0u8; 16];
const OUTPUT_LEN: usize = 32;

// Repetitions per triple. The first run is discarded as warm-up.
const RUNS_PER_TRIPLE: usize = 10;

// The grid. Nine triples: memory 32/64/128/256 MiB, t_cost 2-4,
// p_cost = 1. p_cost = 2 is deliberately not tested; see spec §6 O6.
const GRID: &[(u32, u32, u32)] = &[
    (32768, 2, 1),
    (32768, 3, 1),
    (65536, 2, 1),
    (65536, 3, 1),
    (65536, 4, 1),
    (131072, 3, 1),
    (131072, 4, 1),
    (262144, 3, 1),
    (262144, 4, 1),
];

struct Sample {
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
    min_ms: f64,
    median_ms: f64,
    max_ms: f64,
    checksum: u8,
}

fn run_triple(m_cost: u32, t_cost: u32, p_cost: u32) -> Result<Sample, String> {
    let params = Params::new(m_cost, t_cost, p_cost, Some(OUTPUT_LEN))
        .map_err(|e| format!("Params::new failed for ({}, {}, {}): {}", m_cost, t_cost, p_cost, e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = [0u8; OUTPUT_LEN];

    // Warm-up run. Not timed, not recorded.
    argon2
        .hash_password_into(PASSPHRASE.as_bytes(), &SALT, &mut output)
        .map_err(|e| format!("warm-up hash_password_into failed: {}", e))?;

    // Timed runs.
    let mut samples_ms: Vec<f64> = Vec::with_capacity(RUNS_PER_TRIPLE);
    for _ in 0..RUNS_PER_TRIPLE {
        let start = Instant::now();
        argon2
            .hash_password_into(PASSPHRASE.as_bytes(), &SALT, &mut output)
            .map_err(|e| format!("hash_password_into failed: {}", e))?;
        let elapsed = start.elapsed();
        samples_ms.push(elapsed.as_secs_f64() * 1000.0);
    }

    // Consume the output so the derivation result remains observable
    // to the program. This runs outside the timed section.
    // The checksum is diagnostic only.
    let checksum: u8 = output.iter().fold(0u8, |acc, &b| acc ^ b);

    samples_ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let min_ms = samples_ms[0];
    let max_ms = samples_ms[samples_ms.len() - 1];
    let median_ms = if samples_ms.len() % 2 == 0 {
        let mid = samples_ms.len() / 2;
        (samples_ms[mid - 1] + samples_ms[mid]) / 2.0
    } else {
        samples_ms[samples_ms.len() / 2]
    };

    Ok(Sample {
        m_cost,
        t_cost,
        p_cost,
        min_ms,
        median_ms,
        max_ms,
        checksum,
    })
}

fn main() -> Result<(), String> {
    println!("GORKA Argon2id benchmark");
    println!("Crate: argon2 0.5.3");
    println!("Algorithm: Argon2id");
    println!("Version: V0x13");
    println!("Output length: {} bytes", OUTPUT_LEN);
    println!("Passphrase: fixed constant (see source)");
    println!("Salt: fixed 16-byte constant (see source)");
    println!("Runs per triple: {} (first discarded)", RUNS_PER_TRIPLE);
    println!();
    println!(
        "{:<10}  {:<9}  {:<6}  {:<6}  {:<9}  {:<9}  {:<9}  {:<15}",
        "m_cost", "m_cost_mib", "t_cost", "p_cost", "min_ms", "median_ms", "max_ms", "output_checksum"
    );

    for &(m_cost, t_cost, p_cost) in GRID {
        let sample = run_triple(m_cost, t_cost, p_cost)?;
        let m_cost_mib = sample.m_cost / 1024;
        println!(
            "{:<10}  {:<9}  {:<6}  {:<6}  {:<9.2}  {:<9.2}  {:<9.2}  0x{:02X}",
            sample.m_cost,
            m_cost_mib,
            sample.t_cost,
            sample.p_cost,
            sample.min_ms,
            sample.median_ms,
            sample.max_ms,
            sample.checksum
        );
    }

    Ok(())
}