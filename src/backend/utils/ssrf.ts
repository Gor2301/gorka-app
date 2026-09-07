import { isIP } from 'net';
import dns from 'dns/promises';

// These are ALWAYS blocked - SSRF protection
// Any domain that resolves to these IPs is blocked
function isIPInBlockedRange(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length === 4) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    // 127.x.x.x - loopback
    if (first === 127) return true;
    // 10.x.x.x - private
    if (first === 10) return true;
    // 172.16-31.x.x - private
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.x.x - private
    if (first === 192 && second === 168) return true;
    // 169.254.x.x - link-local / metadata
    if (first === 169 && second === 254) return true;
    // 0.0.0.0
    if (first === 0) return true;
  }
  // IPv6 loopback
  if (ip === '::1') return true;
  // IPv6 unique local (fc00::/7)
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  // IPv6 link-local (fe80::/10)
  if (ip.startsWith('fe80:')) return true;
  return false;
}

async function resolveHostname(hostname: string): Promise<string[]> {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses;
  } catch {
    try {
      const addresses = await dns.resolve6(hostname);
      return addresses;
    } catch {
      return [];
    }
  }
}

export async function validateOutboundRequest(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // 1. Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    // 2. Must not be localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return { valid: false, error: 'Localhost connections are not allowed' };
    }
    
    // 3. Must not be an IP address (user must use domain)
    if (isIP(hostname) !== 0) {
      return { valid: false, error: 'IP addresses are not allowed, use domain names only' };
    }
    
    // 4. DNS resolution check - block if resolves to private/internal IP
    const resolvedIps = await resolveHostname(hostname);
    for (const ip of resolvedIps) {
      if (isIPInBlockedRange(ip)) {
        return { 
          valid: false, 
          error: `Domain resolves to blocked IP: ${ip}` 
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Synchronous version for backward compatibility (without DNS resolution)
export function validateOutboundUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return { valid: false, error: 'Localhost connections are not allowed' };
    }
    
    if (isIP(hostname) !== 0) {
      return { valid: false, error: 'IP addresses are not allowed, use domain names only' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export async function validateRequestUrl(url: string): Promise<void> {
  const result = await validateOutboundRequest(url);
  if (!result.valid) {
    throw new Error(`SSRF validation failed: ${result.error}`);
  }
}

// Get blocked IP ranges (for admin reference)
export function getBlockedIPRanges(): string[] {
  return [
    '127.0.0.0/8 (loopback)',
    '10.0.0.0/8 (private)',
    '172.16.0.0/12 (private)',
    '192.168.0.0/16 (private)',
    '169.254.0.0/16 (link-local)',
    '::1 (IPv6 loopback)',
    'fc00::/7 (IPv6 unique local)',
    'fe80::/10 (IPv6 link-local)'
  ];
}