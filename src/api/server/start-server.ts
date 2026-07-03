// src/api/server/start-server.ts
import { buildServer } from "./build-server";
import { config } from "@/core/config";
import type { FastifyInstance } from "fastify";

async function start() {
  let serverInstance: FastifyInstance | null = null;
  let isFullyBooted = false;

  // ── Global Exception Handlers ──────────────────────────────────────────────
  process.on("unhandledRejection", (reason) => {
    if (serverInstance) {
      serverInstance.log.error({ reason }, "Unhandled promise rejection");
    } else {
      console.error("[SERVER] Unhandled rejection during startup:", reason);
    }

    // CRITICAL: Always crash during startup. Only survive post-boot if explicit.
    if (!isFullyBooted) {
      process.exit(1);
    }
  });

  process.on("uncaughtException", (err) => {
    if (serverInstance) {
      serverInstance.log.fatal({ err }, "Uncaught exception error");
    } else {
      console.error("[SERVER] Uncaught exception:", err);
    }
    process.exit(1);
  });

  // ── Build Server Instance ──────────────────────────────────────────────────
  const server = await buildServer();
  serverInstance = server; // Safely expose to global process loggers

  // ── Graceful Shutdown Engine ───────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    server.log.info(
      { signal },
      "Shutdown signal received — draining connections",
    );

    try {
      await server.close();
      server.log.info("Server closed cleanly");
      process.exit(0);
    } catch (err) {
      server.log.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGQUIT", () => void shutdown("SIGQUIT"));

  // ── Network Listen ─────────────────────────────────────────────────────────
  try {
    await server.listen({ host: "0.0.0.0", port: config.base.port });

    // Mark server as successfully live
    isFullyBooted = true;

    server.log.info(`ArcID Engine ready on port ${config.base.port}`);
    server.log.info(`Swagger UI  → http://localhost:${config.base.port}/docs`);

    if (!config.base.isProduction) {
      server.log.info(
        `Mail Preview → http://localhost:${config.base.port}/mail/preview`,
      );
    }
  } catch (err) {
    server.log.error({ err }, "Failed to start server network listener");
    process.exit(1);
  }
}

void start();
