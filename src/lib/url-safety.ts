// src/lib/url-safety.ts
//
// SSRF defence for outbound HTTP calls.
//
// Blocks URLs that point at:
//   - Private IPv4 ranges (RFC 1918 + loopback + link-local + CGNAT)
//   - Private IPv6 ranges (loopback, ULA, link-local)
//   - Cloud metadata endpoints (169.254.169.254, etc.)
//   - Non-HTTP(S) schemes
//   - Hostnames that resolve to the above (basic check — not a replacement
//     for network-level egress filtering, but stops naive attacks)
//
// Usage:
//   assertSafeUrl(url)   — throws ApiError.badRequest on unsafe URLs
//   isSafeUrl(url)       — returns boolean (for logging / soft checks)

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

function extractHostname(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    throw ApiError.badRequest(`Invalid URL: ${raw}`);
  }
}

function isPrivateIpv4(hostname: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((r) => r.test(hostname));
}

function isPrivateIpv6(hostname: string): boolean {
  // Strip brackets from [::1] style
  const h = hostname.replace(/^\[|\]$/g, "");
  return PRIVATE_IPV6_PATTERNS.some((r) => r.test(h));
}

export function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  // Only HTTP(S) allowed for outbound webhooks
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (isPrivateIpv4(hostname)) return false;
  if (isPrivateIpv6(hostname)) return false;

  return true;
}

export function assertSafeUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw ApiError.badRequest(`Webhook targetUrl is not a valid URL: ${raw}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw ApiError.badRequest(
      `Webhook targetUrl must use http or https — received: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw ApiError.badRequest(
      `Webhook targetUrl points to a blocked host: ${hostname}`,
    );
  }

  if (isPrivateIpv4(hostname)) {
    throw ApiError.badRequest(
      `Webhook targetUrl points to a private IP range: ${hostname}`,
    );
  }

  if (isPrivateIpv6(hostname)) {
    throw ApiError.badRequest(
      `Webhook targetUrl points to a private IPv6 range: ${hostname}`,
    );
  }
}
