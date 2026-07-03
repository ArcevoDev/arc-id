// src/api/plugins/rate-limit.plugin.ts
//
// CHANGE: keyGenerator now keys by tenantId+identityId when present,
// falling back to IP. This gives us three tiers:
//
//   1. Authenticated requests → keyed by identityId (+ tenantId if present)
//      Prevents a single user from exhausting the IP-level quota for
//      everyone behind a NAT or shared corporate egress IP.
//      Also prevents one noisy tenant from degrading another tenant's quota.
//
//   2. Unauthenticated requests → keyed by IP (original behaviour)
//      Login, register, magic-link, password-reset all fall here.
//      Per-route tighter limits (e.g. login: 10/min) are still configured
//      directly on those routes via { config: { rateLimit: { max, timeWindow } } }.
//
// TENANT ISOLATION NOTE:
//   Global limit is 200/min per key.
//   Per-tenant quota enforcement (Phase F noisy-neighbour protection) should
//   be layered on top of this in a dedicated tenant-rate-limit middleware
//   once tenant plan tiers are finalised. This plugin handles the mechanism;
//   plan-based limits are a policy concern.

import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

export const rateLimitPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 200,
      timeWindow: "1 minute",

      keyGenerator: (req) => {
        // Try to extract identity claims from the JWT payload if already decoded.
        // auth-guard.plugin.ts sets req.identity after verifying the JWT, but
        // rate limiting runs BEFORE preHandlers — so we read from req.user
        // (set by jwtVerify) if available, not req.identity.
        //
        // We do a best-effort decode here WITHOUT verification — we're just
        // generating a bucket key, not making a security decision. The actual
        // signature verification happens in requireUser.
        try {
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            // Decode payload (middle segment) without verifying signature.
            // Used purely for rate-limit bucketing.
            const payloadB64 = token.split(".")[1];
            if (payloadB64) {
              const payload = JSON.parse(
                Buffer.from(payloadB64, "base64url").toString("utf8"),
              );
              const sub = payload.sub as string | undefined;
              const tid = payload.tid as string | undefined;
              if (sub) {
                // Authenticated key: identity[:tenant]
                return tid ? `${sub}:${tid}` : sub;
              }
            }
          }
        } catch {
          // Malformed JWT or not a JWT — fall through to IP keying.
        }
        return req.ip;
      },

      errorResponseBuilder: (_req, context) => ({
        success: false,
        error: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        retryAfter: Math.ceil(context.ttl / 1000),
      }),
    });
  },
  { name: "arc-id:rate-limit" },
);
