import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@/core/errors";

declare module "fastify" {
  interface FastifyRequest {
    identity: {
      id: string;
      tenantId: string | null;
      scope: string[];
    };
  }
}

/**
 * Provides reusable preHandler hooks for route-level auth enforcement.
 *
 * Usage in routes:
 *   fastify.get("/me", { preHandler: fastify.auth.requireUser }, handler)
 *   fastify.post("/admin", { preHandler: fastify.auth.requireScope("admin:write") }, handler)
 */
// Add to your identity interface in the future:
// roles: string[];
// permissions: string[];

export const authGuardPlugin = fp(
  async (fastify: FastifyInstance) => {
    const requireUser = async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        const payload = req.user as any;

        req.identity = {
          id: payload.sub,
          tenantId: payload.tid ?? null,
          scope: (payload.scope ?? "").split(" ").filter(Boolean),
        };
      } catch {
        throw ApiError.unauthorized("Invalid or expired access token");
      }
    };

    const requireScope =
      (requiredScope: string) => async (req: FastifyRequest) => {
        await requireUser(req, null as any);

        // Check JWT Scope
        if (req.identity.scope.includes(requiredScope)) return;

        // TODO: If you implement DB-backed RBAC, check it here:
        // const hasPermission = await fastify.db.permission.check(req.identity.id, requiredScope);
        // if (!hasPermission) throw ApiError.forbidden(...);

        throw ApiError.forbidden(`Scope '${requiredScope}' is required`);
      };

    fastify.decorate("auth", { requireUser, requireScope });
  },
  { name: "arc-id:auth-guard", dependencies: ["arc-id:jwt", "arc-id:db"] },
);

declare module "fastify" {
  interface FastifyInstance {
    auth: {
      requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requireScope: (
        scope: string,
      ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    };
  }
}
