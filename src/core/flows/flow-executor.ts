import { randomUUID } from "crypto";
import { prisma } from "@/core/db/prisma";
import type { Flow } from "./flow";
import type { FlowContext } from "./flow-context";
import { FlowError } from "./flow-error";
import { ApiError } from "@/core/errors/api-error";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma-client";
import { config } from "@/core/config";

type InboundCtx = Omit<FlowContext, "requestId" | "db" | "tenantId"> & {
  tenantId?: string | null;
};

async function withTx<T>(
  fn: (tx: any) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  // Default 60s for long-lived orchestration steps on loaded/dev machines;
  // allow env override (FLOW_TX_TIMEOUT_MS) for fine control.
  const timeout = options?.timeout ?? Number(process.env.FLOW_TX_TIMEOUT_MS ?? 60_000);
  const maxWait = options?.maxWait ?? 10_000;
  return (prisma as any).$transaction(fn, {
    timeout,
    maxWait,
  }) as Promise<T>;
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
            db: tx,
          };
          const result = await flow.execute(parsedInput, enrichedCtx);
          if (flow.outputSchema) flow.outputSchema.parse(result);

          logger.info(`[FLOW OK] ${flow.name}`, {
            traceId,
            ms: Date.now() - start,
          });
          return result;
        });
      }

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

      if (err instanceof ApiError) throw err;

      if (err instanceof FlowError) {
        throw new ApiError(err.message, err.statusCode ?? 400, err.code);
      }

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
