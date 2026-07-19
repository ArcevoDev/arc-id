// src/jobs/webhook-worker.ts
// Production-grade webhook delivery worker.
//
// Safety model:
//   - Each worker instance has a UUID. Rows are claimed atomically using
//     PostgreSQL's FOR UPDATE SKIP LOCKED — no two workers pick the same row.
//   - A lease TTL means rows abandoned by a crashed worker are automatically
//     reclaimed after LEASE_TTL_MS (default 90s).
//   - Retry backoff is exponential with ±20% jitter to prevent thundering herds.
//   - Signature includes a timestamp so receivers can reject replayed requests.
//   - stopWebhookWorker() sets a flag; the current batch finishes, then polling stops.
import { prisma } from "@/core/db";
import { Prisma } from "@prisma-client";
import { createHmac, randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { config } from "@/core/config";
import { fetchWithSsrfGuard } from "@/lib/url-safety";

// ── Config ─────────────────────────────────────────────────────────────────────
const BATCH = 20;
const LEASE_TTL_MS = 90_000; // 90s — claim expires if worker crashes
const BASE_POLL_MS = 5_000;
const MAX_IDLE_POLL_MS = 30_000;

// ── Worker identity ────────────────────────────────────────────────────────────
// Unique per process. Included in delivery headers so receivers can correlate
// deliveries and detect worker turnover.
const WORKER_ID = `wkr_${randomUUID()}`;

// ── State ──────────────────────────────────────────────────────────────────────
let stopped = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let currentDelay = BASE_POLL_MS;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Jitter ±pct% around a base delay to avoid thundering herds across workers. */
function withJitter(base: number, pct = 0.2): number {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

/** HMAC-SHA256 over `${timestamp}.${body}` — mirrors Stripe's signature scheme.
 *  Receivers MUST verify both the signature AND the timestamp to block replays.
 *
 *  CHANGE: now signs with the per-endpoint secret stored on the event row
 *  (copied from WebhookEndpoint.secret at dispatch time), matching the secret
 *  returned to the tenant at endpoint creation and used by /endpoints/:id/test.
 *
 *  Fallback to config.webhooks.signingSecret only applies to events queued
 *  before this field existed — remove the fallback once that backlog drains. */
function sign(body: string, timestamp: number, secret: string): string {
  const payload = `${timestamp}.${body}`;
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Atomically claim up to BATCH rows using FOR UPDATE SKIP LOCKED.
 *
 * This is the correct pattern for multi-process job queues on PostgreSQL.
 * Two concurrent workers will never claim the same row because:
 *   1. The inner SELECT locks candidate rows.
 *   2. SKIP LOCKED means any row already locked by another worker is ignored.
 *   3. The outer UPDATE commits the claim in the same transaction.
 *
 * Requires: processingBy (String?) and processingAt (DateTime?) columns on WebhookEvent.
 */
async function claimBatch(): Promise<string[]> {
  const now = new Date();
  const leaseExpiry = new Date(Date.now() - LEASE_TTL_MS);

  const claimed = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      UPDATE "WebhookEvent"
      SET    "processingBy" = ${WORKER_ID},
             "processingAt" = ${now},
             "updatedAt"    = ${now}
      WHERE  id IN (
        SELECT id
        FROM   "WebhookEvent"
        WHERE  "deliveredAt"  IS NULL
          AND  "attempts"     <  "maxAttempts"
          AND  "nextRetryAt"  <= ${now}
          AND  (
                "processingBy" IS NULL
             OR "processingAt"  < ${leaseExpiry}
          )
        ORDER BY "createdAt" ASC
        LIMIT    ${BATCH}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `,
  );

  return claimed.map((r) => r.id);
}

/** Release a lease after success or final failure. */
async function releaseLease(
  id: string,
  extra?: Prisma.WebhookEventUpdateInput,
) {
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      processingBy: null,
      processingAt: null,
      ...extra,
    },
  });
}

// ── Delivery ───────────────────────────────────────────────────────────────────

async function deliver(
  event: Awaited<ReturnType<typeof prisma.webhookEvent.findMany>>[number],
) {
  const timestamp = Date.now();

  const body = JSON.stringify({
    eventType: event.eventType,
    identityId: event.identityId,
    tenantId: event.tenantId,
    payload: event.payload,
    createdAt: event.createdAt,
  });

  // Legacy rows queued before the `secret` column existed won't have one —
  // fall back to the old global secret for those only.
  const secret = event.secret ?? config.webhooks.signingSecret;

  // fetchWithSsrfGuard re-validates the target on every redirect hop, not
  // just the original targetUrl — a safe host that later redirects to a
  // private IP would otherwise be followed straight through by fetch()'s
  // default redirect behaviour.
  const res = await fetchWithSsrfGuard(event.targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ArcID-Signature": sign(body, timestamp, secret),
      "X-ArcID-Timestamp": String(timestamp),
      "X-ArcID-Worker": WORKER_ID,
      "X-ArcID-Event-Type": event.eventType,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${event.targetUrl}`);
}

async function deliverBatch(): Promise<number> {
  const ids = await claimBatch();
  if (ids.length === 0) return 0;

  // Fetch the full rows WE claimed (other workers cannot have these rows).
  const events = await prisma.webhookEvent.findMany({
    where: { id: { in: ids }, processingBy: WORKER_ID },
  });

  await Promise.allSettled(
    events.map(async (event) => {
      try {
        await deliver(event);

        await releaseLease(event.id, {
          deliveredAt: new Date(),
          lastError: null,
        });

        logger.info(
          { eventId: event.id, eventType: event.eventType, worker: WORKER_ID },
          "[WEBHOOK_WORKER] Delivered",
        );
      } catch (err: any) {
        const nextAttempt = event.attempts + 1;
        const isFinal = nextAttempt >= event.maxAttempts;
        // Exponential backoff: attempt 1 → 30s, 2 → 2min, 3 → 8min, 4 → 32min
        const backoff = Math.pow(4, nextAttempt) * 30_000;

        await releaseLease(event.id, {
          attempts: nextAttempt,
          lastError: err.message,
          nextRetryAt: isFinal
            ? null
            : new Date(Date.now() + withJitter(backoff)),
        });

        logger.warn(
          {
            eventId: event.id,
            attempt: nextAttempt,
            isFinal,
            error: err.message,
            worker: WORKER_ID,
          },
          "[WEBHOOK_WORKER] Delivery failed",
        );
      }
    }),
  );

  return events.length;
}

// ── Poll loop ──────────────────────────────────────────────────────────────────

async function runWorkerLoop() {
  if (stopped) return;

  try {
    const processed = await deliverBatch();

    currentDelay =
      processed > 0
        ? BASE_POLL_MS
        : Math.min(currentDelay + 5_000, MAX_IDLE_POLL_MS);
  } catch (err: any) {
    logger.error(
      { err: err.message, worker: WORKER_ID },
      "[WEBHOOK_WORKER] Loop error",
    );
    currentDelay = MAX_IDLE_POLL_MS;
  }

  if (!stopped) {
    pollTimer = setTimeout(
      () => void runWorkerLoop(),
      withJitter(currentDelay),
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function startWebhookWorker() {
  if (stopped) stopped = false; // allow restart after stop
  logger.info({ worker: WORKER_ID }, "[WEBHOOK_WORKER] Starting");
  void runWorkerLoop();
}

export function stopWebhookWorker() {
  stopped = true;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  logger.info(
    { worker: WORKER_ID },
    "[WEBHOOK_WORKER] Stop requested — draining current batch",
  );
}
