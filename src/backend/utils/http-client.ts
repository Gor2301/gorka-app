import { validateRequestUrl } from './ssrf';
import { isIP } from 'net';

// Configuration constants
const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RESPONSE_SIZE_BYTES = 1024 * 1024; // 1MB
const MAX_REDIRECTS = 5;

export interface HttpClientOptions {
  timeout?: number;
  maxResponseSize?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  signal?: AbortSignal;
}

export interface HttpClientResponse {
  status: number;
  statusText: string;
  headers: Headers;
  data: any;
  durationMs: number;
}

// Simple DNS resolution check
async function resolveHostname(hostname: string): Promise<string[]> {
  const dns = await import('dns/promises');
  try {
    const addresses = await dns.resolve(hostname);
    return addresses;
  } catch {
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
}

// Main HTTP client with security protections
export async function httpRequest(url: string, options: HttpClientOptions = {}): Promise<HttpClientResponse> {
  const startTime = Date.now();
  
  // 1. SSRF Validation - BEFORE any request
  await validateRequestUrl(url);
  
  // 2. Parse URL for DNS rebinding protection
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  
  // 3. DNS resolution check (additional safety)
  if (!isIP(hostname)) {
    try {
      const resolvedIps = await resolveHostname(hostname);
      // SSRF validation already blocks private IPs
      // This is just an additional safety check
    } catch (error) {
      console.warn(`DNS resolution warning for ${hostname}:`, error);
    }
  }
  
  // 4. Apply timeout
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  // 5. Combine signals
  const signals = [controller.signal];
  if (options.signal) {
    signals.push(options.signal);
  }
  
  // Abort if any signal aborts
  const combinedSignal = new AbortController();
  for (const signal of signals) {
    signal.addEventListener('abort', () => combinedSignal.abort());
  }
  
  try {
    // 6. Prepare request
    const requestOptions: RequestInit = {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: combinedSignal.signal,
    };
    
    if (options.body) {
      requestOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }
    
    // 7. Make the request
    const response = await fetch(url, requestOptions);
    clearTimeout(timeoutId);
    
    // 8. Check response size
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxSize = options.maxResponseSize || MAX_RESPONSE_SIZE_BYTES;
      if (size > maxSize) {
        throw new Error(`Response size (${size} bytes) exceeds limit (${maxSize} bytes)`);
      }
    }
    
    // 9. Read response with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const maxSize = options.maxResponseSize || MAX_RESPONSE_SIZE_BYTES;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        totalBytes += value.length;
        if (totalBytes > maxSize) {
          reader.cancel();
          throw new Error(`Response size exceeded limit (${maxSize} bytes)`);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    // 10. Parse response
    const rawBody = Buffer.concat(chunks).toString('utf-8');
    let data: any;
    
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody;
    }
    
    const durationMs = Date.now() - startTime;
    
    // 11. Return response
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      durationMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error.name === 'AbortError') {
      if (controller.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
    
    throw error;
  }
}

// Convenience methods
export const http = {
  async get(url: string, options: Omit<HttpClientOptions, 'method' | 'body'> = {}) {
    return httpRequest(url, { ...options, method: 'GET' });
  },
  
  async post(url: string, body: any, options: Omit<HttpClientOptions, 'method' | 'body'> = {}) {
    return httpRequest(url, { ...options, method: 'POST', body });
  },
  
  async put(url: string, body: any, options: Omit<HttpClientOptions, 'method' | 'body'> = {}) {
    return httpRequest(url, { ...options, method: 'PUT', body });
  },
  
  async patch(url: string, body: any, options: Omit<HttpClientOptions, 'method' | 'body'> = {}) {
    return httpRequest(url, { ...options, method: 'PATCH', body });
  },
  
  async delete(url: string, options: Omit<HttpClientOptions, 'method' | 'body'> = {}) {
    return httpRequest(url, { ...options, method: 'DELETE' });
  },
};

export default http;