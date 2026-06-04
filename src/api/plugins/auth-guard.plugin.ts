// src/api/plugins/auth-guard.plugin.ts
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@/core/errors";
import type { SubscriptionPlan } from "@/prisma-client";

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
      requireScope: (scope: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requirePlan: (minPlan: SubscriptionPlan) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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

    const requireUser = async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        const payload = req.user as any;

        // ─────────────────────────────────────────────────────────────────────
        // ROOT CAUSE FIX (was causing 401 on every protected route):
        //
        // The previous code queried: subscription.findFirst({ where: { identityId: payload.sub } })
        // BUT the actual Prisma schema shows Subscription is TENANT-scoped:
        //
        //   model Subscription {
        //     tenantId  String  @unique   ← belongs to Tenant, NOT Identity
        //   }
        //
        // That query threw PrismaClientValidationError: Unknown argument 'identityId'
        // which was caught here and re-thrown as ApiError.unauthorized → all routes 401.
        //
        // Fix: resolve the active tenant from the JWT tid claim (or fall back to SYSTEM),
        // then look up that tenant's subscription.
        // ─────────────────────────────────────────────────────────────────────
        let plan: SubscriptionPlan = "FREE";
        const activeTenantId = (payload.tid as string | undefined) ?? "SYSTEM";

        const sub = await fastify.db.subscription.findUnique({
          where: { tenantId: activeTenantId },
          select: { plan: true, status: true },
        });

        if (sub && sub.status === "ACTIVE") {
          plan = sub.plan as SubscriptionPlan;
        }

        req.identity = {
          id: payload.sub as string,
          tenantId: (payload.tid as string | null) ?? null,
          scope: ((payload.scope as string | undefined) ?? "").split(" ").filter(Boolean),
          plan,
        };
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.unauthorized("Invalid or expired access token");
      }
    };

    const requireScope =
      (requiredScope: string) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        await requireUser(req, reply);
        if (!req.identity.scope.includes(requiredScope)) {
          throw ApiError.forbidden(`Scope '${requiredScope}' is required`);
        }
      };

    const requirePlan =
      (minPlan: SubscriptionPlan) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        await requireUser(req, reply);
        if (PLAN_ORDER[req.identity.plan] < PLAN_ORDER[minPlan]) {
          return reply.status(402).send({
            success: false,
            error: "UPGRADE_REQUIRED",
            message: `This feature requires a ${minPlan} subscription`,
            currentPlan: req.identity.plan,
            requiredPlan: minPlan,
          });
        }
      };

    fastify.decorate("auth", { requireUser, requireScope, requirePlan });
  },
  { name: "arc-id:auth-guard", dependencies: ["arc-id:jwt", "arc-id:db"] },
);