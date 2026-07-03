// src/api/plugins/auth-guard.plugin.ts
//
// CHANGE: jti revocation check now uses a two-tier lookup:
//   1. Redis blocklist (O(1), sub-millisecond) via isJtiBlocked()
//   2. DB RevokedJti table (indexed point-lookup) — only if Redis miss
//
// If Redis is not configured or unavailable, the check falls through to
// the DB exactly as before. No behaviour change when Redis is absent.
//
// All other logic (requireAal2, requireElevated, requireScope, requirePlan,
// single-session-fetch optimization) is unchanged from the previous version.

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@/core/errors";
import type { SubscriptionPlan } from "@/prisma-client";
import { isJtiBlocked } from "@/lib/security/jti-blocklist";

const STEP_UP_WINDOW_MS = 15 * 60 * 1000;

declare module "fastify" {
  interface FastifyRequest {
    identity: {
      id: string;
      tenantId: string | null;
      scope: string[];
      plan: SubscriptionPlan;
    };
  }
  interface FastifyInstance {
    auth: {
      requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requireScope: (
        scope: string,
      ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requirePlan: (
        minPlan: SubscriptionPlan,
      ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requireAal2: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requireElevated: (
        req: FastifyRequest,
        reply: FastifyReply,
      ) => Promise<void>;
    };
  }
}

const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

export const authGuardPlugin = fp(
  async (fastify: FastifyInstance) => {
    const requireUser = async (
      req: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      try {
        await req.jwtVerify();
        const payload = req.user as any;

        if (!payload?.sub) {
          throw ApiError.unauthorized("Malformed token payload signature");
        }

        // ── JTI revocation check — two-tier ──────────────────────────────────
        // Tier 1: Redis blocklist — O(1), no DB hit when Redis is available.
        // Tier 2: DB RevokedJti — authoritative fallback.
        // A miss on both means the token is not revoked.
        if (payload.jti) {
          const blockedInRedis = await isJtiBlocked(payload.jti);

          if (blockedInRedis) {
            throw ApiError.unauthorized("Token has been revoked");
          }

          // Redis miss (or Redis unavailable) — check DB
          const revokedInDb = await fastify.db.revokedJti.findUnique({
            where: { jti: payload.jti },
            select: { jti: true },
          });
          if (revokedInDb) {
            throw ApiError.unauthorized("Token has been revoked");
          }
        }

        // ── Plan resolution ───────────────────────────────────────────────────
        let plan: SubscriptionPlan =
          (payload.plan as SubscriptionPlan | undefined) ?? "FREE";
        const activeTenantId = (payload.tid as string | undefined) ?? "SYSTEM";

        if (!payload.plan && activeTenantId !== "SYSTEM") {
          const sub = await fastify.db.subscription.findUnique({
            where: { tenantId: activeTenantId },
            select: { plan: true, status: true },
          });
          if (sub?.status === "ACTIVE") {
            plan = sub.plan as SubscriptionPlan;
          }
        }

        req.identity = {
          id: payload.sub as string,
          tenantId: (payload.tid as string | null) ?? null,
          scope: ((payload.scope as string | undefined) ?? "")
            .split(" ")
            .filter(Boolean),
          plan,
        };
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.unauthorized("Invalid or expired access token");
      }
    };

    const requireScope =
      (requiredScope: string) =>
      async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await requireUser(req, reply);
        if (!req.identity.scope.includes(requiredScope)) {
          throw ApiError.forbidden(`Scope '${requiredScope}' is required`);
        }
      };

    const requirePlan =
      (minPlan: SubscriptionPlan) =>
      async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await requireUser(req, reply);
        if (PLAN_ORDER[req.identity.plan] < PLAN_ORDER[minPlan]) {
          reply.status(402).send({
            success: false,
            error: "UPGRADE_REQUIRED",
            message: `This feature requires a ${minPlan} subscription`,
            currentPlan: req.identity.plan,
            requiredPlan: minPlan,
          });
        }
      };

    const requireAal2 = async (
      req: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      await requireUser(req, reply);

      const payload = req.user as any;
      const sessionId = payload.sid as string | undefined;

      if (!sessionId) {
        throw ApiError.forbidden("No session bound to this token");
      }

      const session = await fastify.db.session.findUnique({
        where: { id: sessionId },
        select: { authLevel: true, valid: true, expiresAt: true },
      });

      if (!session || !session.valid || session.expiresAt < new Date()) {
        throw ApiError.unauthorized("Session is invalid or expired");
      }

      const level = session.authLevel ?? "aal1";
      if (level !== "aal2") {
        throw new ApiError(
          "This action requires a stronger authentication level. Please complete MFA or use a passkey.",
          403,
          "AAL2_REQUIRED",
        );
      }
    };

    const requireElevated = async (
      req: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      await requireUser(req, reply);

      const payload = req.user as any;
      const sessionId = payload.sid as string | undefined;

      if (!sessionId) {
        throw ApiError.forbidden("No session bound to this token");
      }

      const session = await fastify.db.session.findUnique({
        where: { id: sessionId },
        select: {
          authLevel: true,
          valid: true,
          expiresAt: true,
          elevatedAt: true,
        },
      });

      if (!session || !session.valid || session.expiresAt < new Date()) {
        throw ApiError.unauthorized("Session is invalid or expired");
      }

      const level = session.authLevel ?? "aal1";
      if (level !== "aal2") {
        throw new ApiError(
          "This action requires a stronger authentication level. Please complete MFA or use a passkey.",
          403,
          "AAL2_REQUIRED",
        );
      }

      const elevatedAt = session.elevatedAt;
      const isRecentlyElevated =
        elevatedAt !== null &&
        elevatedAt !== undefined &&
        Date.now() - elevatedAt.getTime() < STEP_UP_WINDOW_MS;

      if (!isRecentlyElevated) {
        throw new ApiError(
          "This action requires recent re-authentication. Please complete step-up verification.",
          403,
          "STEP_UP_REQUIRED",
        );
      }
    };

    fastify.decorate("auth", {
      requireUser,
      requireScope,
      requirePlan,
      requireAal2,
      requireElevated,
    });
  },
  { name: "arc-id:auth-guard", dependencies: ["arc-id:jwt", "arc-id:db"] },
);
