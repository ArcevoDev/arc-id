// src/lib/url-safety.ts
//
// SSRF defence for outbound HTTP calls.
//
// Blocks URLs that point at:
//   - Private IPv4 ranges (RFC 1918 + loopback + link-local + CGNAT)
//   - Private IPv6 ranges (loopback, ULA, link-local)
//   - Cloud metadata endpoints (169.254.169.254, etc.)
//   - Non-HTTP(S) schemes
//   - Hostnames that RESOLVE to any of the above
//
// FIX: the hostname-literal checks alone (matching the string in the URL
// against private-IP regexes) do not stop SSRF — they only stop the naive
// case where the attacker writes a private IP directly in the URL. A
// hostname like "attacker-controlled.example.com" that DNS-resolves to
// 169.254.169.254 or 127.0.0.1 sailed straight through the old checks,
// then fetch() connected to whatever it actually resolved to. This is the
// standard SSRF-via-DNS-rebinding bypass. assertSafeUrl now resolves the
// hostname and checks the resolved IP address(es) too, not just the
// literal string.
//
// Still not a complete defence — DNS can change between this check and
// the actual fetch() (TOCTOU), and an HTTP redirect from a safe host to
// an unsafe one bypasses a check done only at request-creation time. See
// fetchWithSsrfGuard() below, which re-checks before following each
// redirect hop; callers making outbound requests to user-supplied URLs
// should prefer it over calling assertSafeUrl() + fetch() separately.
//
// Usage:
//   await assertSafeUrl(url)            — throws on unsafe URLs
//   await isSafeUrl(url)                — returns boolean (soft check)
//   await fetchWithSsrfGuard(url, init) — re-validates on every redirect

import dns from "node:dns/promises";
import { ApiError } from "@/core/errors";

// Patterns that must never receive outbound requests.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/Azure/GCP IMDS (also matched by IPv4 below)
  "fd00::ec2", // AWS IPv6 IMDS
  "[::1]",
]);

// RFC 1918 + loopback + link-local + CGNAT + broadcast
const PRIVATE_IPV4_PATTERNS = [
  /^127\./, // 127.0.0.0/8  loopback
  /^10\./, // 10.0.0.0/8   RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 RFC 1918
  /^192\.168\./, // 192.168.0.0/16 RFC 1918
  /^169\.254\./, // 169.254.0.0/16 link-local + IMDS
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
  /^0\./, // 0.0.0.0/8 — "this" network
  /^255\./, // broadcast
];

// IPv6 private ranges
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/, // loopback
  /^fc/i, // ULA fc00::/7
  /^fd/i, // ULA fd00::/8
  /^fe80/i, // link-local
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((r) => r.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  // Strip brackets from [::1] style
  const h = ip.replace(/^\[|\]$/g, "");
  return PRIVATE_IPV6_PATTERNS.some((r) => r.test(h));
}

function isPrivateIp(ip: string): boolean {
  return isPrivateIpv4(ip) || isPrivateIpv6(ip);
}

/**
 * Resolve a hostname to its IP addresses (A + AAAA). Returns an empty
 * array (never throws) if resolution fails — callers treat an
 * unresolvable hostname as unsafe, since fetch() would fail on it anyway
 * and we'd rather fail closed than silently skip the resolved-IP check.
 */
async function resolveHostnameIps(hostname: string): Promise<string[]> {
  const results: string[] = [];
  await Promise.all([
    dns
      .resolve4(hostname)
      .then((ips) => results.push(...ips))
      .catch(() => {}),
    dns
      .resolve6(hostname)
      .then((ips) => results.push(...ips))
      .catch(() => {}),
  ]);
  return results;
}

/** True if `hostname` is itself a literal IPv4/IPv6 address (skip DNS). */
function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
}

interface UrlSafetyCheck {
  safe: boolean;
  reason?: string;
}

async function checkUrlSafety(raw: string): Promise<UrlSafetyCheck> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { safe: false, reason: `Invalid URL: ${raw}` };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      safe: false,
      reason: `URL must use http or https — received: ${parsed.protocol}`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `URL points to a blocked host: ${hostname}` };
  }
  if (isPrivateIp(hostname)) {
    return {
      safe: false,
      reason: `URL points to a private IP range: ${hostname}`,
    };
  }

  // Hostname is a plain name, not an IP literal — resolve it and check
  // the resolved IPs too. This is the DNS-rebinding check.
  if (!isIpLiteral(hostname)) {
    const resolved = await resolveHostnameIps(hostname);
    if (resolved.length === 0) {
      return {
        safe: false,
        reason: `URL hostname could not be resolved: ${hostname}`,
      };
    }
    const unsafeIp = resolved.find((ip) => isPrivateIp(ip));
    if (unsafeIp) {
      return {
        safe: false,
        reason: `URL hostname ${hostname} resolves to a private/blocked IP (${unsafeIp})`,
      };
    }
  }

  return { safe: true };
}

export async function isSafeUrl(raw: string): Promise<boolean> {
  const result = await checkUrlSafety(raw);
  return result.safe;
}

export async function assertSafeUrl(raw: string): Promise<void> {
  const result = await checkUrlSafety(raw);
  if (!result.safe) {
    throw ApiError.badRequest(result.reason ?? `Unsafe URL: ${raw}`);
  }
}

/**
 * fetch() wrapper that re-validates the target before following EVERY
 * redirect hop, not just the original URL. A plain assertSafeUrl() +
 * fetch() only checks the first URL — a safe host that 302s to
 * http://169.254.169.254/ would otherwise be followed straight through
 * by fetch()'s default redirect handling. Use this for any outbound
 * request to a user-supplied URL (webhook delivery, OIDC discovery,
 * anything assertSafeUrl currently guards).
 */
export async function fetchWithSsrfGuard(
  url: string,
  init?: RequestInit,
  maxRedirects = 5,
): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(currentUrl);
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    if (!isRedirect || !location) {
      return res;
    }
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw ApiError.badRequest(`Too many redirects fetching URL: ${url}`);
}
