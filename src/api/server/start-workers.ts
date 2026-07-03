// src/api/server/start-workers.ts
// Background worker process entrypoint.
// Runs independently from the HTTP server so workers can be scaled separately.
//
// Deploy pattern:
//   HTTP servers  → node dist/api/server/start-server.js   (N replicas)
//   Worker fleet  → node dist/api/server/start-workers.js  (M replicas, can be 1)
import "dotenv/config";
import { randomUUID } from "crypto";
import { startWebhookWorker, stopWebhookWorker } from "@/jobs/webhook-worker";
import { runTokenCleanup } from "@/jobs/token-cleanup.job";
import { logger } from "@/lib/logger";

const PROCESS_ID = randomUUID().slice(0, 8);
const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Token cleanup scheduler (replaces the node-cron TODO comment) ─────────────
// Uses plain setInterval — no extra dependency, perfectly sufficient.
function scheduleTokenCleanup(): NodeJS.Timeout {
  // Run once immediately on boot, then on interval.
  void runTokenCleanup().catch((err) =>
    logger.error({ err }, "[WORKERS] Initial token cleanup failed"),
  );

  return setInterval(() => {
    void runTokenCleanup().catch((err) =>
      logger.error({ err }, "[WORKERS] Scheduled token cleanup failed"),
    );
  }, TOKEN_CLEANUP_INTERVAL_MS);
}

// ── Boot ───────────────────────────────────────────────────────────────────────
async function startWorkers() {
  logger.info({ processId: PROCESS_ID }, "[WORKERS] Worker process starting");

  startWebhookWorker();
  logger.info("[WORKERS] Webhook delivery worker started");

  const cleanupTimer = scheduleTokenCleanup();
  logger.info("[WORKERS] Token cleanup scheduler started (every 6h)");

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(
      { signal, processId: PROCESS_ID },
      "[WORKERS] Shutdown signal — stopping workers",
    );

    stopWebhookWorker();
    clearInterval(cleanupTimer);

    // Brief drain window so in-flight deliveries complete.
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    logger.info("[WORKERS] Workers stopped cleanly");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGQUIT", () => void shutdown("SIGQUIT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "[WORKERS] Unhandled rejection");
  });
}

void startWorkers();
