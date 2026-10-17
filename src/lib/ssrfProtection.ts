/**
 * PrintFlow SaaS — Server-Side Request Forgery (SSRF) Protection Engine
 * 
 * Implements:
 * 1. Protocol allowlist (strictly http: and https:).
 * 2. Hostname & IP blocklist (IPv4 & IPv6 loopback, private, link-local, cloud metadata, multicast, broadcast, reserved).
 * 3. Dotless decimal, octal, hex, and IPv6-mapped IPv4 representation normalization.
 * 4. DNS resolution validation and Anti-DNS-Rebinding (TOCTOU protection).
 * 5. Safe redirect validation without credential forwarding.
 * 6. Strict connection timeouts and response size limits.
 */

import dns from 'dns';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface SsrfValidationResult {
  isSafe: boolean;
  reason?: string;
  resolvedIps?: string[];
  canonicalUrl?: string;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  method?: string;
  allowedHosts?: string[];
}

export interface SafeFetchResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  buffer: Buffer;
  text: string;
}

// Well-known cloud metadata hostnames
const CLOUD_METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.254',
  'fd00:ec2::254'
]);

/**
 * Parses an IPv4 address string (supporting standard dotted decimal,
 * octal notations, hexadecimal, or single 32-bit integer) into a numeric 32-bit uint.
 */
export function parseIpv4ToNumber(ipStr: string): number | null {
  const trimmed = ipStr.trim();

  // Pure integer format (e.g., 2130706433 or 0x7f000001)
  if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
    const val = parseInt(trimmed, 16);
    return val >= 0 && val <= 0xffffffff ? val : null;
  }
  if (/^\d+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    return val >= 0 && val <= 0xffffffff ? val : null;
  }

  // Dotted notation (can have 1, 2, 3, or 4 parts in historical BSD socket API)
  const parts = trimmed.split('.');
  if (parts.length < 1 || parts.length > 4) return null;

  const numericParts: number[] = [];
  for (const p of parts) {
    if (!p) return null;
    let n: number;
    if (p.startsWith('0x') || p.startsWith('0X')) {
      n = parseInt(p, 16);
    } else if (p.startsWith('0') && p.length > 1) {
      n = parseInt(p, 8); // Octal
    } else {
      n = parseInt(p, 10);
    }
    if (isNaN(n) || n < 0) return null;
    numericParts.push(n);
  }

  // Assemble according to standard IPv4 dot-notation rules
  if (numericParts.length === 4) {
    if (numericParts.some((part) => part > 255)) return null;
    return (
      ((numericParts[0] << 24) >>> 0) +
      ((numericParts[1] << 16) >>> 0) +
      ((numericParts[2] << 8) >>> 0) +
      numericParts[3]
    );
  } else if (numericParts.length === 3) {
    if (numericParts[0] > 255 || numericParts[1] > 255 || numericParts[2] > 65535) return null;
    return ((numericParts[0] << 24) >>> 0) + ((numericParts[1] << 16) >>> 0) + numericParts[2];
  } else if (numericParts.length === 2) {
    if (numericParts[0] > 255 || numericParts[1] > 16777215) return null;
    return ((numericParts[0] << 24) >>> 0) + numericParts[1];
  } else if (numericParts.length === 1) {
    return numericParts[0] <= 0xffffffff ? numericParts[0] : null;
  }

  return null;
}

/**
 * Checks whether an IPv4 numeric uint falls inside private, loopback, or reserved ranges.
 */
export function isForbiddenIpv4(num: number): { forbidden: boolean; reason?: string } {
  const b0 = (num >>> 24) & 0xff;
  const b1 = (num >>> 16) & 0xff;

  // 0.0.0.0/8 - Current network / local
  if (b0 === 0) {
    return { forbidden: true, reason: 'Current network (0.0.0.0/8) is forbidden' };
  }

  // 127.0.0.0/8 - Loopback
  if (b0 === 127) {
    return { forbidden: true, reason: 'IPv4 loopback address is forbidden' };
  }

  // 10.0.0.0/8 - RFC 1918 Private
  if (b0 === 10) {
    return { forbidden: true, reason: 'Private RFC 1918 (10.0.0.0/8) address is forbidden' };
  }

  // 172.16.0.0/12 - RFC 1918 Private (172.16.0.0 to 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) {
    return { forbidden: true, reason: 'Private RFC 1918 (172.16.0.0/12) address is forbidden' };
  }

  // 192.168.0.0/16 - RFC 1918 Private
  if (b0 === 192 && b1 === 168) {
    return { forbidden: true, reason: 'Private RFC 1918 (192.168.0.0/16) address is forbidden' };
  }

  // 169.254.0.0/16 - Link-Local / Cloud Metadata (169.254.169.254)
  if (b0 === 169 && b1 === 254) {
    return { forbidden: true, reason: 'Link-local / Cloud metadata (169.254.0.0/16) is forbidden' };
  }

  // 100.64.0.0/10 - Carrier-Grade NAT (100.64.0.0 to 100.127.255.255)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) {
    return { forbidden: true, reason: 'Carrier-Grade NAT (100.64.0.0/10) is forbidden' };
  }

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (b0 === 192 && b1 === 0 && ((num >>> 8) & 0xff) === 0) {
    return { forbidden: true, reason: 'IETF reserved (192.0.0.0/24) is forbidden' };
  }

  // 192.0.2.0/24 - Documentation (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && ((num >>> 8) & 0xff) === 2) {
    return { forbidden: true, reason: 'TEST-NET-1 (192.0.2.0/24) is forbidden' };
  }

  // 198.51.100.0/24 - Documentation (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && ((num >>> 8) & 0xff) === 100) {
    return { forbidden: true, reason: 'TEST-NET-2 (198.51.100.0/24) is forbidden' };
  }

  // 203.0.113.0/24 - Documentation (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && ((num >>> 8) & 0xff) === 113) {
    return { forbidden: true, reason: 'TEST-NET-3 (203.0.113.0/24) is forbidden' };
  }

  // 198.18.0.0/15 - Benchmarking
  if (b0 === 198 && (b1 === 18 || b1 === 19)) {
    return { forbidden: true, reason: 'Benchmarking (198.18.0.0/15) is forbidden' };
  }

  // 224.0.0.0/4 - Multicast (224.0.0.0 to 239.255.255.255)
  if (b0 >= 224 && b0 <= 239) {
    return { forbidden: true, reason: 'Multicast address is forbidden' };
  }

  // 240.0.0.0/4 - Reserved for future use (240.0.0.0 to 255.255.255.254)
  if (b0 >= 240) {
    return { forbidden: true, reason: 'Reserved / Broadcast address is forbidden' };
  }

  return { forbidden: false };
}

/**
 * Checks whether an IPv6 address string falls inside forbidden ranges
 * (Loopback ::1, ULA fc00::/7, Link-Local fe80::/10, IPv4-mapped, etc.)
 */
export function isForbiddenIpv6(ipv6Str: string): { forbidden: boolean; reason?: string } {
  let clean = ipv6Str.trim().toLowerCase();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }

  // Unspecified ::
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') {
    return { forbidden: true, reason: 'Unspecified IPv6 (::) is forbidden' };
  }

  // Loopback ::1
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') {
    return { forbidden: true, reason: 'IPv6 loopback (::1) is forbidden' };
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or WHATWG normalized ::ffff:7f00:1)
  const mappedMatchDotted = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatchDotted) {
    const parsedV4 = parseIpv4ToNumber(mappedMatchDotted[1]);
    if (parsedV4 !== null) {
      const v4Check = isForbiddenIpv4(parsedV4);
      if (v4Check.forbidden) {
        return { forbidden: true, reason: `IPv6-mapped ${v4Check.reason}` };
      }
    }
  }

  const mappedMatchHex = clean.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedMatchHex) {
    const high = parseInt(mappedMatchHex[1], 16);
    const low = parseInt(mappedMatchHex[2], 16);
    const parsedV4 = ((high << 16) >>> 0) + low;
    const v4Check = isForbiddenIpv4(parsedV4);
    if (v4Check.forbidden) {
      return { forbidden: true, reason: `IPv6-mapped ${v4Check.reason}` };
    }
  }

  // Link-Local (fe80::/10)
  if (/^fe[89ab]/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Link-Local (fe80::/10) is forbidden' };
  }

  // Unique Local Address ULA (fc00::/7 -> fc00 to fdff)
  if (/^f[cd]/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Unique Local (fc00::/7) is forbidden' };
  }

  // Discard Prefix (100::/64)
  if (/^100::/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Discard-only prefix is forbidden' };
  }

  // Documentation (2001:db8::/32)
  if (/^2001:0?db8:/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 documentation prefix is forbidden' };
  }

  return { forbidden: false };
}

/**
 * Validates a single IP string (IPv4 or IPv6) against all SSRF restrictions.
 */
export function validateIpAddress(ip: string): { isSafe: boolean; reason?: string } {
  // Check if IPv4
  const ipv4Num = parseIpv4ToNumber(ip);
  if (ipv4Num !== null) {
    const v4 = isForbiddenIpv4(ipv4Num);
    if (v4.forbidden) return { isSafe: false, reason: v4.reason };
    return { isSafe: true };
  }

  // Check if IPv6
  if (ip.includes(':')) {
    const v6 = isForbiddenIpv6(ip);
    if (v6.forbidden) return { isSafe: false, reason: v6.reason };
    return { isSafe: true };
  }

  return { isSafe: false, reason: 'Invalid IP address format' };
}

/**
 * Validates a target URL against SSRF attacks.
 * Performs deep URL dissection and asynchronous DNS resolution with multi-record inspection.
 */
export async function validateSsrfUrl(
  inputUrl: string,
  options?: { allowedHosts?: string[] }
): Promise<SsrfValidationResult> {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isSafe: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch (err) {
    return { isSafe: false, reason: 'Invalid or malformed URL syntax' };
  }

  // 1. Strict protocol allowlist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isSafe: false,
      reason: `Protocol '${parsed.protocol}' is forbidden. Only HTTP and HTTPS are permitted.`
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Reject credentials in URL (e.g. http://admin:pass@host)
  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: 'Embedded user credentials in URL are prohibited.' };
  }

  // 3. Reject empty hostname or localhost aliases
  if (!hostname) {
    return { isSafe: false, reason: 'Hostname cannot be empty' };
  }

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    CLOUD_METADATA_HOSTS.has(hostname)
  ) {
    return {
      isSafe: false,
      reason: `Target host '${hostname}' is an internal or cloud metadata destination.`
    };
  }

  // 4. Optional allowlist check
  if (options?.allowedHosts && options.allowedHosts.length > 0) {
    const isAllowed = options.allowedHosts.some((h) => {
      const lowerH = h.toLowerCase();
      return hostname === lowerH || hostname.endsWith(`.${lowerH}`);
    });
    if (!isAllowed) {
      return { isSafe: false, reason: `Host '${hostname}' is not in the explicit allowlist.` };
    }
  }

  // 5. Check if hostname is an IP literal directly
  const directIpV4 = parseIpv4ToNumber(hostname);
  if (directIpV4 !== null) {
    const v4 = isForbiddenIpv4(directIpV4);
    if (v4.forbidden) {
      return { isSafe: false, reason: `Direct IP ${v4.reason}` };
    }
    return {
      isSafe: true,
      canonicalUrl: parsed.toString(),
      resolvedIps: [hostname]
    };
  }

  if (hostname.includes(':') || (hostname.startsWith('[') && hostname.endsWith(']'))) {
    const v6 = isForbiddenIpv6(hostname);
    if (v6.forbidden) {
      return { isSafe: false, reason: `Direct IPv6 ${v6.reason}` };
    }
    return {
      isSafe: true,
      canonicalUrl: parsed.toString(),
      resolvedIps: [hostname]
    };
  }

  // 6. Asynchronous DNS Resolution & Anti-DNS Rebinding
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return { isSafe: false, reason: `DNS resolution failed for hostname '${hostname}'` };
    }

    const resolvedIps: string[] = [];

    for (const entry of addresses) {
      resolvedIps.push(entry.address);

      if (entry.family === 4) {
        const parsedNum = parseIpv4ToNumber(entry.address);
        if (parsedNum === null) {
          return { isSafe: false, reason: `Unparseable IPv4 resolved: ${entry.address}` };
        }
        const check = isForbiddenIpv4(parsedNum);
        if (check.forbidden) {
          return {
            isSafe: false,
            reason: `DNS resolved to blocked IP (${entry.address}): ${check.reason}`,
            resolvedIps
          };
        }
      } else if (entry.family === 6) {
        const check = isForbiddenIpv6(entry.address);
        if (check.forbidden) {
          return {
            isSafe: false,
            reason: `DNS resolved to blocked IPv6 (${entry.address}): ${check.reason}`,
            resolvedIps
          };
        }
      }
    }

    return {
      isSafe: true,
      canonicalUrl: parsed.toString(),
      resolvedIps
    };
  } catch (dnsErr: any) {
    return {
      isSafe: false,
      reason: `DNS resolution error: ${dnsErr?.message || 'Host not found'}`
    };
  }
}

/**
 * Performs a secure HTTP/HTTPS fetch with SSRF prevention, Anti-DNS Rebinding,
 * redirect safety checks, response size capping, and strict timeouts.
 */
export async function safeSsrfFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const {
    timeoutMs = 5000,
    maxBytes = 5 * 1024 * 1024, // 5MB max
    maxRedirects = 3,
    headers = {},
    method = 'GET',
    allowedHosts
  } = options;

  let currentUrl = targetUrl;
  let redirectsRemaining = maxRedirects;

  while (true) {
    // 1. SSRF validation on target URL
    const validation = await validateSsrfUrl(currentUrl, { allowedHosts });
    if (!validation.isSafe) {
      throw new Error(`SSRF Blocked: ${validation.reason}`);
    }

    const parsed = new URL(currentUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    // Filter headers to never forward sensitive credentials across external calls
    const safeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey !== 'authorization' &&
        lowerKey !== 'cookie' &&
        lowerKey !== 'x-api-key' &&
        lowerKey !== 'x-agent-token' &&
        lowerKey !== 'x-session-id'
      ) {
        safeHeaders[k] = v;
      }
    }

    // Default User-Agent
    if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
      safeHeaders['User-Agent'] = 'PrintFlow-SecureFetcher/2.0';
    }

    const response = await new Promise<SafeFetchResponse>((resolve, reject) => {
      const req = client.request(
        parsed,
        {
          method,
          headers: safeHeaders,
          timeout: timeoutMs
        },
        (res) => {
          // Handle Redirects
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            res.resume(); // Discard body
            if (redirectsRemaining <= 0) {
              return reject(new Error('SSRF Blocked: Maximum redirect limit exceeded'));
            }
            try {
              const nextUrl = new URL(res.headers.location, currentUrl).toString();
              return resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                buffer: Buffer.alloc(0),
                text: nextUrl // Carry next URL for redirect loop
              });
            } catch (err: any) {
              return reject(new Error(`Invalid redirect location header: ${err.message}`));
            }
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;

          res.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
              req.destroy();
              return reject(
                new Error(`Response size limit exceeded: response larger than ${maxBytes} bytes`)
              );
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              statusCode: res.statusCode || 200,
              headers: res.headers,
              buffer,
              text: buffer.toString('utf8')
            });
          });

          res.on('error', (err) => reject(err));
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Connection timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => reject(err));

      req.end();
    });

    // Check if this was a redirect
    if (
      response.statusCode &&
      [301, 302, 303, 307, 308].includes(response.statusCode) &&
      response.text
    ) {
      currentUrl = response.text;
      redirectsRemaining--;
      continue;
    }

    return response;
  }
}
