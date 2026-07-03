// src/api/routes/health.route.ts
//
// Two distinct probes — required for correct k8s / Railway / Fly.io behaviour:
//
//   GET /health/live  — liveness: is the process alive and responding?
//                       k8s restarts the pod if this fails.
//                       Never touches the DB — a slow DB must not kill the process.
//
//   GET /health/ready — readiness: is the process ready to receive traffic?
//                       k8s stops sending traffic (but does not restart) if this fails.
//                       Performs a fast DB ping — if the DB is down, traffic stops
//                       routing here until connectivity is restored.
//
// The legacy GET /health is kept as an alias for /health/live so existing
// monitoring setups don't break.
import type { FastifyInstance } from "fastify";

export async function healthRoute(fastify: FastifyInstance) {
  // ── Liveness — process is up ───────────────────────────────────────────────
  fastify.get("/health/live", async () => ({
    status: "ok",
    probe: "liveness",
    system: "ArcID Core Engine",
    ts: new Date().toISOString(),
  }));

  // ── Legacy alias ───────────────────────────────────────────────────────────
  fastify.get("/health", async () => ({
    status: "healthy",
    system: "ArcID Core Engine",
    ts: new Date().toISOString(),
  }));

  // ── Readiness — DB is reachable ────────────────────────────────────────────
  fastify.get("/health/ready", async (_req, reply) => {
    try {
      // Cheapest possible query — just checks the DB connection is alive.
      await fastify.db.$queryRaw`SELECT 1`;

      return reply.send({
        status: "ok",
        probe: "readiness",
        db: "reachable",
        ts: new Date().toISOString(),
      });
    } catch (err: any) {
      fastify.log.error(
        { err },
        "[HEALTH] Readiness check failed — DB unreachable",
      );

      return reply.status(503).send({
        status: "unavailable",
        probe: "readiness",
        db: "unreachable",
        ts: new Date().toISOString(),
      });
    }
  });
}
