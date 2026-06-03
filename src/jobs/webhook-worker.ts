import { prisma } from "@/core/db";
import { createHmac } from "crypto";
import { logger } from "@/lib/logger";
import { config } from "@/core/config";

const BASE_POLL_MS = 5_000;
const MAX_IDLE_POLL_MS = 30_000;
const BATCH = 20;

let currentDelay = BASE_POLL_MS;
let isRunning = false;

function sign(body: string): string {
  return (
    "sha256=" +
    createHmac("sha256", config.webhooks.signingSecret)
      .update(body)
      .digest("hex")
  );
}

async function deliverBatch(): Promise<number> {
  const now = new Date();

  // 1. Fetch pending events
  const events = await prisma.webhookEvent.findMany({
    where: {
      deliveredAt: null,
      // Only pick events where retry time has passed OR is null (initial state)
      nextRetryAt: { lte: now },
    },
    take: BATCH,
    orderBy: { createdAt: "asc" },
  });

  // Filter out events that reached max attempts
  const actionableEvents = events.filter((e) => e.attempts < e.maxAttempts);

  if (actionableEvents.length === 0) return 0;

  await Promise.allSettled(
    actionableEvents.map(async (event) => {
      try {
        const body = JSON.stringify({
          eventType: event.eventType,
          identityId: event.identityId,
          payload: event.payload,
          createdAt: event.createdAt,
        });

        const res = await fetch(event.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ArcID-Signature": sign(body),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { deliveredAt: now },
        });
      } catch (err: any) {
        const nextAttempt = event.attempts + 1;
        const isFinal = nextAttempt >= event.maxAttempts;

        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            attempts: nextAttempt,
            lastError: err.message,
            // If final, set nextRetryAt to null to exclude it from future polling
            nextRetryAt: isFinal
              ? null
              : new Date(Date.now() + Math.pow(4, nextAttempt) * 30_000),
          },
        });
      }
    }),
  );

  return actionableEvents.length;
}

async function runWorkerLoop() {
  if (isRunning) return;
  isRunning = true;

  try {
    const processedCount = await deliverBatch();
    // Adaptive polling: if we found work, speed up; otherwise, slow down
    currentDelay =
      processedCount > 0
        ? BASE_POLL_MS
        : Math.min(currentDelay + 5_000, MAX_IDLE_POLL_MS);
  } catch (error: any) {
    logger.error("[WEBHOOK_WORKER] Loop crashed", { error: error.message });
    currentDelay = MAX_IDLE_POLL_MS;
  } finally {
    isRunning = false;
    setTimeout(runWorkerLoop, currentDelay);
  }
}

export function startWebhookWorker() {
  logger.info("[WEBHOOK_WORKER] Initialized dynamic backoff engine");
  // Ensure we don't start multiple loops
  if (!isRunning) runWorkerLoop();
}
