// gorka-shared::connectors::base_url
//
// Slice 3b partial. Base URL validation for AI provider adapters.
//
// 3b provides:
//   - ValidatedBaseUrl (opaque; constructible only via validate_static)
//   - validate_static: HTTPS only, hostname only (no IP literals),
//     no userinfo, port in 1..=65535, path allowed, no query, no
//     fragment, no double-append of /chat/completions
//   - validate_resolution: declared; returns Err(TransportError)
//     in 3b. Implemented in 3c.
//   - DnsResolver trait, SystemResolver (stub in 3b), ResolvedTarget
//
// Authority: SLICE 3 — SECTIONS 5 AND 6, §6.1, §6.5 (3b subset).
//
// Deviation from §6.1.1: ValidatedBaseUrl stores its components as
// private named fields rather than a single String, so host() and
// path() can return &str without re-parsing. External constructability
// is still impossible — there is no public constructor. The
// type-level guard is preserved.

use std::net::IpAddr;

use crate::connectors::{ConnectorError, ConnectorErrorKind};

// ---------------------------------------------------------------------
// ValidatedBaseUrl
// ---------------------------------------------------------------------

/// Opaque. Constructible only via validate_static. Adapters store this,
/// not a raw string, so a URL that has not passed static validation
/// cannot be used by an adapter.
#[derive(Debug, Clone)]
pub struct ValidatedBaseUrl {
    // Normalized full URL, no trailing slash.
    full: String,
    // Host as a hostname (never an IP literal).
    host: String,
    // Path component. Starts with '/' when non-empty; empty string
    // when the URL has no path.
    path: String,
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

    /// Construct the full URL for a suffix path. Suffix may include
    /// or omit a leading slash; both are normalized. Rejects if the
    /// base path already ends with the suffix's final segment in a
    /// way that would double-append.
    pub fn full_path_for(&self, suffix: &str) -> Result<String, ConnectorError> {
        let suffix_trimmed = suffix.trim_matches('/');
        let path_trimmed = self.path.trim_end_matches('/');

        // Double-append check: base path already ends with the suffix.
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
// Static validation
// ---------------------------------------------------------------------

/// Construction-time check. Per §6.5.
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

    let port_part = match parsed.port() {
        Some(p) if p != 443 => format!(":{}", p),
        _ => String::new(),
    };

    let full = format!("{}://{}{}{}", parsed.scheme(), host, port_part, path_normalized);

    Ok(ValidatedBaseUrl {
        full,
        host: host.to_string(),
        path: path_normalized,
    })
}

// ---------------------------------------------------------------------
// Resolution-time validation — 3b stub
// ---------------------------------------------------------------------

/// Resolution-time check. Requires a resolver. In 3b, resolution is
/// not enabled; this returns TransportError unconditionally. 3c
/// implements the real check.
pub fn validate_resolution(
    _base: &ValidatedBaseUrl,
    _resolver: &dyn DnsResolver,
) -> Result<ResolvedTarget, ConnectorError> {
    Err(ConnectorError {
        kind: ConnectorErrorKind::TransportError,
        message: "resolution not enabled in 3b".into(),
        provider_response: None,
    })
}

#[derive(Debug, Clone)]
pub struct ResolvedTarget {
    pub host: String,
    pub ip: IpAddr,
    pub port: u16,
}

pub trait DnsResolver: Send + Sync {
    fn resolve(&self, host: &str) -> Result<Vec<IpAddr>, ConnectorError>;
}

/// Production resolver. In 3b it is declared but refuses; 3c replaces
/// it with a real system resolver.
pub struct SystemResolver;

impl DnsResolver for SystemResolver {
    fn resolve(&self, _host: &str) -> Result<Vec<IpAddr>, ConnectorError> {
        Err(ConnectorError {
            kind: ConnectorErrorKind::TransportError,
            message: "DNS resolution not enabled in 3b".into(),
            provider_response: None,
        })
    }
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