import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { auditService } from "./services/audit.service";
import { auditRoute } from "./routes/audit.route";

declare module "fastify" {
  interface FastifyInstance {
    audit: typeof auditService;
  }
}

export const auditPlugin = fp(
  async (fastify: FastifyInstance) => {
    fastify.decorate("audit", auditService);
    await fastify.register(auditRoute);
  },
  { name: "arc-id:audit", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
