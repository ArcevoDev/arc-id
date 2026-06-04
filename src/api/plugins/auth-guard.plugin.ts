// src/api/plugins/auth-guard.plugin.ts
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@/core/errors";
import type { SubscriptionPlan } from "@/prisma-client";

// ─── Augment Fastify Request ─────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    identity: {
      id: string;
      tenantId: string | null;
      scope: string[];
      /** Current subscription plan — resolved from DB on each protected request */
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
    };
  }
}

// ─── Plan Hierarchy ──────────────────────────────────────────────────────────

const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const authGuardPlugin = fp(
  async (fastify: FastifyInstance) => {
    /**
     * Verifies the Bearer JWT and resolves identity + active subscription plan.
     * Must be the base of every other guard — requireScope and requirePlan both
     * call this first.
     */
    const requireUser = async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        const payload = req.user as any;

        // Resolve active tenant context (use tid from token if present, else SYSTEM)
        const activeTenantId = payload.tid ?? "SYSTEM"

        // Look up subscription by tenant
        let plan: SubscriptionPlan = "FREE";
        const sub = await fastify.db.subscription.findUnique ({
          where: { tenantId: activeTenantId },
          select: { plan: true, status: true },
        });

        if (sub?.status === "ACTIVE" && sub.plan) {
          plan = sub.plan
        }

        req.identity = {
          id: payload.sub,
          tenantId: activeTenantId,
          scope: (payload.scope ?? "").split(" ").filter(Boolean),
          plan,
        };
      } catch (err) {
        // Re-throw ApiError instances (e.g. from nested guards) as-is
        if (err instanceof ApiError) throw err;
        throw ApiError.unauthorized("Invalid or expired access token");
      }
    };

    /**
     * Extends requireUser with a scope check against the JWT `scope` claim.
     * To grant admin:write, issue a token with that scope explicitly.
     */
    const requireScope =
      (requiredScope: string) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        await requireUser(req, reply);
        if (!req.identity.scope.includes(requiredScope)) {
          throw ApiError.forbidden(`Scope '${requiredScope}' is required`);
        }
      };

    /**
     * Extends requireUser with a minimum subscription plan check.
     *
     * Usage: preHandler: fastify.auth.requirePlan("PRO")
     *
     * Returns 403 with a clear upgrade message when the plan is insufficient.
     * Returns 402 (Payment Required) so the frontend can redirect to upgrade.
     */
    const requirePlan =
      (minPlan: SubscriptionPlan) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        await requireUser(req, reply);

        if (PLAN_ORDER[req.identity.plan] < PLAN_ORDER[minPlan]) {
          reply.status(402).send({
            success: false,
            error: "UPGRADE_REQUIRED",
            message: `This feature requires a ${minPlan} subscription`,
            currentPlan: req.identity.plan,
            requiredPlan: minPlan,
          });
          // Halt the request lifecycle
          return reply;
        }
      };

    fastify.decorate("auth", { requireUser, requireScope, requirePlan });
  },
  { name: "arc-id:auth-guard", dependencies: ["arc-id:jwt", "arc-id:db"] },
);
