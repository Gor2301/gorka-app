// gorka-shared::connectors::base_url
//
// Base URL validation and network destination policy for AI adapters.
//
// Slice 3b provided validate_static (HTTPS, hostname-only, no userinfo,
// port range, no query, no fragment). Slice 3c adds resolution-time
// validation and the IANA-sourced deny-list.
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §6.1, §6.2, §6.5;
//            SLICE 3c — MINI SPEC v4.
//
// IANA source registries (recorded at time of writing):
//
//   IANA IPv4 Special-Purpose Address Registry
//     https://www.iana.org/assignments/iana-ipv4-special-registry/
//     Last updated 2025-10-09. Consulted 2026-10-12.
//   IANA IPv6 Special-Purpose Address Registry
//     https://www.iana.org/assignments/iana-ipv6-special-registry/
//     Last updated 2025-10-09. Consulted 2026-10-12.
//   IANA IPv4 Multicast Address Space Registry
//     https://www.iana.org/assignments/multicast-addresses/
//     Consulted 2026-10-12. (224.0.0.0/4 only.)
//   IANA IPv6 Multicast Address Space Registry
//     https://www.iana.org/assignments/ipv6-multicast-addresses/
//     Consulted 2026-10-12. (ff00::/8 only.)
//
// Policy: prohibit every range listed below, regardless of IANA's
// "Globally Reachable" column. IANA's column answers a routing
// question ("may a router forward this outside a domain?"); the AI
// adapter's question is different ("should this adapter connect
// here?"). No legitimate AI provider endpoint lives in any of these
// ranges. If a DNS answer lands in one, that is either a misconfigured
// base URL, a hijacked answer, or a probe. Fail closed.
//
// Multicast is included as an additional policy choice. The adapter
// makes unicast HTTPS connections only.
//
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is unwrapped and classified
// against the IPv4 table.
//
// Addresses not listed here are permitted. The IANA registries
// enumerate *special-purpose* ranges — set aside for uses other than
// ordinary public unicast. They do not enumerate the ordinary public
// unicast space, which is where every legitimate AI provider endpoint
// lives. The deny-list is a subtraction from the normal case, not the
// definition of the normal case.
//
// The tables are reviewed at each slice that touches this module.
// A future session that updates them updates this header.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};

use crate::connectors::{ConnectorError, ConnectorErrorKind};

// ---------------------------------------------------------------------
// ValidatedBaseUrl
// ---------------------------------------------------------------------

/// Opaque. Constructible only via validate_static. Adapters store this,
/// not a raw string, so a URL that has not passed static validation
/// cannot be used by an adapter.
#[derive(Debug, Clone)]
pub struct ValidatedBaseUrl {
    full: String,
    host: String,
    path: String,
    port: u16,
}

impl ValidatedBaseUrl {
    pub fn as_str(&self) -> &str {
        &self.full
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    /// The validated port. 443 when the URL did not specify one.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Construct the full URL for a suffix path. Suffix may include or
    /// omit a leading slash; both are normalized. Rejects if the base
    /// path already ends with the suffix.
    pub fn full_path_for(&self, suffix: &str) -> Result<String, ConnectorError> {
        let suffix_trimmed = suffix.trim_matches('/');
        let path_trimmed = self.path.trim_end_matches('/');

        if !suffix_trimmed.is_empty()
            && path_trimmed.ends_with(&format!("/{}", suffix_trimmed))
        {
            return Err(config_err(format!(
                "base_url already ends with /{}",
                suffix_trimmed
            )));
        }

        Ok(format!("{}/{}", self.full, suffix_trimmed))
    }
}

// ---------------------------------------------------------------------
// Static validation (from 3b; unchanged except port is now stored)
// ---------------------------------------------------------------------

pub fn validate_static(url: &str) -> Result<ValidatedBaseUrl, ConnectorError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| config_err("malformed URL"))?;

    if parsed.scheme() != "https" {
        return Err(config_err("base URL must use the https scheme"));
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| config_err("base URL host is missing"))?;
    if host.is_empty() {
        return Err(config_err("base URL host is empty"));
    }
    if host.parse::<IpAddr>().is_ok() {
        return Err(config_err(
            "base URL host must be a hostname, not an IP literal",
        ));
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(config_err("base URL must not contain userinfo"));
    }

    if let Some(p) = parsed.port() {
        if p == 0 {
            return Err(config_err("base URL port must be in 1..=65535"));
        }
    }
    let port = parsed.port().unwrap_or(443);

    if parsed.query().is_some() {
        return Err(config_err("base URL must not contain a query string"));
    }
    if parsed.fragment().is_some() {
        return Err(config_err("base URL must not contain a fragment"));
    }

    let path_raw = parsed.path();
    let path_normalized = if path_raw.is_empty() || path_raw == "/" {
        String::new()
    } else {
        path_raw.trim_end_matches('/').to_string()
    };

    let port_part = if port == 443 {
        String::new()
    } else {
        format!(":{}", port)
    };

    let full = format!("{}://{}{}{}", parsed.scheme(), host, port_part, path_normalized);

    Ok(ValidatedBaseUrl {
        full,
        host: host.to_string(),
        path: path_normalized,
        port,
    })
}

// ---------------------------------------------------------------------
// Resolution-time validation
// ---------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ResolvedTarget {
    pub host: String,
    pub ip: IpAddr,
    pub port: u16,
}

pub trait DnsResolver: Send + Sync {
    fn resolve(&self, host: &str) -> Result<Vec<IpAddr>, ConnectorError>;
}

/// Production resolver. Uses std::net::ToSocketAddrs.
pub struct SystemResolver;

impl DnsResolver for SystemResolver {
    fn resolve(&self, host: &str) -> Result<Vec<IpAddr>, ConnectorError> {
        let addrs = (host, 0).to_socket_addrs().map_err(|e| ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("DNS resolution failed for {}: {}", host, e),
            provider_response: None,
        })?;
        let ips: Vec<IpAddr> = addrs.map(|sa| sa.ip()).collect();
        if ips.is_empty() {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::TransportError,
                message: format!("DNS returned no addresses for {}", host),
                provider_response: None,
            });
        }
        Ok(ips)
    }
}

/// Resolution-time check. Reject-if-any: if any returned address is
/// prohibited, the whole resolution is rejected. No address is selected.
pub fn validate_resolution(
    base: &ValidatedBaseUrl,
    resolver: &dyn DnsResolver,
) -> Result<ResolvedTarget, ConnectorError> {
    let ips = resolver.resolve(&base.host)?;
    if ips.is_empty() {
        return Err(ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: format!("no addresses resolved for {}", base.host),
            provider_response: None,
        });
    }
    for ip in &ips {
        if is_prohibited(*ip) {
            return Err(ConnectorError {
                kind: ConnectorErrorKind::TransportError,
                message: format!(
                    "prohibited destination address {} for host {}",
                    ip, base.host
                ),
                provider_response: None,
            });
        }
    }
    let chosen = ips[0];
    Ok(ResolvedTarget {
        host: base.host.clone(),
        ip: chosen,
        port: base.port,
    })
}

// ---------------------------------------------------------------------
// Address policy
// ---------------------------------------------------------------------

/// True if the address falls in any range of the deny-list.
pub fn is_prohibited(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => ipv4_prohibited(v4),
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return ipv4_prohibited(v4);
            }
            ipv6_prohibited(v6)
        }
    }
}

fn ipv4_prohibited(ip: Ipv4Addr) -> bool {
    const TABLE: &[(Ipv4Addr, u8)] = &[
        (Ipv4Addr::new(0, 0, 0, 0), 8),
        (Ipv4Addr::new(0, 0, 0, 0), 32),
        (Ipv4Addr::new(10, 0, 0, 0), 8),
        (Ipv4Addr::new(100, 64, 0, 0), 10),
        (Ipv4Addr::new(127, 0, 0, 0), 8),
        (Ipv4Addr::new(169, 254, 0, 0), 16),
        (Ipv4Addr::new(172, 16, 0, 0), 12),
        (Ipv4Addr::new(192, 0, 0, 0), 24),
        (Ipv4Addr::new(192, 0, 0, 0), 29),
        (Ipv4Addr::new(192, 0, 0, 8), 32),
        (Ipv4Addr::new(192, 0, 0, 9), 32),
        (Ipv4Addr::new(192, 0, 0, 10), 32),
        (Ipv4Addr::new(192, 0, 0, 170), 32),
        (Ipv4Addr::new(192, 0, 0, 171), 32),
        (Ipv4Addr::new(192, 0, 2, 0), 24),
        (Ipv4Addr::new(192, 31, 196, 0), 24),
        (Ipv4Addr::new(192, 52, 193, 0), 24),
        (Ipv4Addr::new(192, 88, 99, 0), 24),
        (Ipv4Addr::new(192, 88, 99, 2), 32),
        (Ipv4Addr::new(192, 168, 0, 0), 16),
        (Ipv4Addr::new(192, 175, 48, 0), 24),
        (Ipv4Addr::new(198, 18, 0, 0), 15),
        (Ipv4Addr::new(198, 51, 100, 0), 24),
        (Ipv4Addr::new(203, 0, 113, 0), 24),
        (Ipv4Addr::new(224, 0, 0, 0), 4),
        (Ipv4Addr::new(240, 0, 0, 0), 4),
        (Ipv4Addr::new(255, 255, 255, 255), 32),
    ];
    let u = u32::from(ip);
    for (net, prefix) in TABLE {
        let mask = if *prefix == 0 {
            0u32
        } else {
            u32::MAX << (32 - *prefix as u32)
        };
        if (u & mask) == (u32::from(*net) & mask) {
            return true;
        }
    }
    false
}

fn ipv6_prohibited(ip: Ipv6Addr) -> bool {
    const TABLE: &[(Ipv6Addr, u8)] = &[
        (Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0), 128),
        (Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 128),
        // ::ffff:0:0/96 is handled by unwrap before this function.
        (Ipv6Addr::new(0x64, 0xff9b, 0, 0, 0, 0, 0, 0), 96),
        (Ipv6Addr::new(0x64, 0xff9b, 1, 0, 0, 0, 0, 0), 48),
        (Ipv6Addr::new(0x100, 0, 0, 0, 0, 0, 0, 0), 64),
        (Ipv6Addr::new(0x100, 0, 0, 1, 0, 0, 0, 0), 64),
        (Ipv6Addr::new(0x2001, 0, 0, 0, 0, 0, 0, 0), 23),
        (Ipv6Addr::new(0x2001, 0, 0, 0, 0, 0, 0, 0), 32),
        (Ipv6Addr::new(0x2001, 1, 0, 0, 0, 0, 0, 1), 128),
        (Ipv6Addr::new(0x2001, 1, 0, 0, 0, 0, 0, 2), 128),
        (Ipv6Addr::new(0x2001, 1, 0, 0, 0, 0, 0, 3), 128),
        (Ipv6Addr::new(0x2001, 2, 0, 0, 0, 0, 0, 0), 48),
        (Ipv6Addr::new(0x2001, 3, 0, 0, 0, 0, 0, 0), 32),
        (Ipv6Addr::new(0x2001, 4, 0x112, 0, 0, 0, 0, 0), 48),
        (Ipv6Addr::new(0x2001, 0x10, 0, 0, 0, 0, 0, 0), 28),
        (Ipv6Addr::new(0x2001, 0x20, 0, 0, 0, 0, 0, 0), 28),
        (Ipv6Addr::new(0x2001, 0x30, 0, 0, 0, 0, 0, 0), 28),
        (Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 0), 32),
        (Ipv6Addr::new(0x2002, 0, 0, 0, 0, 0, 0, 0), 16),
        (Ipv6Addr::new(0x2620, 0x4f, 0x8000, 0, 0, 0, 0, 0), 48),
        (Ipv6Addr::new(0x3fff, 0, 0, 0, 0, 0, 0, 0), 20),
        (Ipv6Addr::new(0x5f00, 0, 0, 0, 0, 0, 0, 0), 16),
        (Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 0), 7),
        (Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 0), 10),
        (Ipv6Addr::new(0xff00, 0, 0, 0, 0, 0, 0, 0), 8),
    ];
    let u = u128::from(ip);
    for (net, prefix) in TABLE {
        let mask = if *prefix == 0 {
            0u128
        } else {
            u128::MAX << (128 - *prefix as u32)
        };
        if (u & mask) == (u128::from(*net) & mask) {
            return true;
        }
    }
    false
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

fn config_err<S: Into<String>>(msg: S) -> ConnectorError {
    ConnectorError {
        kind: ConnectorErrorKind::LocalConfigurationError,
        message: msg.into(),
        provider_response: None,
    }
}