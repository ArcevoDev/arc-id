import { randomUUID } from "crypto";
import { prisma } from "@/core/db/prisma";
import type { Flow } from "./flow";
import type { FlowContext } from "./flow-context";
import { FlowError } from "./flow-error";
import { ApiError } from "@/core/errors/api-error";
import { logger } from "@/lib/logger";
import { Prisma } from "@/prisma-client";
import { config } from "@/core/config";

type InboundCtx = Omit<FlowContext, "requestId" | "db" | "tenantId"> & {
  tenantId?: string | null;
};

async function withTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  return prisma.$transaction(fn, {
    timeout: options?.timeout ?? 10_000,
    maxWait: options?.maxWait ?? 5_000,
  });
}

export class FlowExecutor {
  private readonly SYSTEM_TENANT_ID = "SYSTEM";

  async run<I, O>(
    flow: Flow<I, O>,
    input: unknown,
    ctx: InboundCtx,
    opts?: { transaction?: boolean },
  ): Promise<O> {
    const traceId = randomUUID();
    const start = Date.now();
    const useTransaction = opts?.transaction ?? true;

    // Centralized resolution: Default to SYSTEM if tenantId is missing
    const resolvedTenantId = ctx.tenantId ?? this.SYSTEM_TENANT_ID;

    try {
      logger.debug(`[FLOW INIT] ${flow.name}`, { traceId });

      if (useTransaction) {
        return await withTx(async (tx) => {
          const parsedInput = flow.inputSchema.parse(input);
          const enrichedCtx: FlowContext = {
            ...ctx,
            tenantId: resolvedTenantId,
            requestId: traceId,
            db: tx, // Transaction client injected
          };
          const result = await flow.execute(parsedInput, enrichedCtx);
          if (flow.outputSchema) flow.outputSchema.parse(result);
          return result;
        });
      }

      // No transaction — use global client directly
      const parsedInput = flow.inputSchema.parse(input);
      const enrichedCtx: FlowContext = {
        ...ctx,
        tenantId: resolvedTenantId,
        requestId: traceId,
        db: prisma,
      };
      const result = await flow.execute(parsedInput, enrichedCtx);
      if (flow.outputSchema) flow.outputSchema.parse(result);

      logger.info(`[FLOW OK] ${flow.name}`, {
        traceId,
        ms: Date.now() - start,
      });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`[FLOW FAIL] ${flow.name}`, { traceId, message });

      // Already a typed error — re-throw as-is
      if (err instanceof ApiError) throw err;

      // Domain error → map to HTTP error
      if (err instanceof FlowError) {
        throw new ApiError(err.message, err.statusCode ?? 400, err.code);
      }

      // Unexpected — wrap generically
      throw new ApiError(
        config.base.env === "production"
          ? "An unexpected error occurred"
          : message,
        500,
        "FLOW_RUNTIME_ERROR",
      );
    }
  }
}

export const flowExecutor = new FlowExecutor();
