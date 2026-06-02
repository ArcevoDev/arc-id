#!/usr/bin/env node
/**
 * arc-id/fix-core.js
 * Fixes all "Property 'db' does not exist on FlowContext" errors
 * and related issues in arc-id core files.
 *
 * Run from inside the arc-id directory:
 *   node fix-core.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content.trimStart(), "utf8");
  console.log(`  FIX  ${rel}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. FlowContext — tx → db (this is the root cause of every error)
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/flows/flow-context.ts",
  `
import type { DbClient } from "@/lib/db-client";

/**
 * Injected into every flow by FlowExecutor.
 * db is always the Prisma transaction client inside a run() call.
 * Never use the global prisma singleton inside a flow — always use ctx.db.
 */
export interface FlowContext {
  requestId: string;
  userId?:   string;
  tenantId:  string | null; // null = global scope — never undefined
  ip?:       string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  db:        DbClient;      // ← was "tx" — this is the fix
}
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. FlowExecutor — injects db (not tx), wraps in $transaction correctly
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/flows/flow-executor.ts",
  `
import { randomUUID }   from "crypto";
import { prisma }       from "@/core/db/prisma";
import type { Flow }        from "./flow";
import type { FlowContext } from "./flow-context";
import { FlowError }    from "./flow-error";
import { ApiError }     from "@/core/errors/api-error";
import { logger }       from "@/lib/logger";
import { Prisma }       from "@/prisma-client";

type InboundCtx = Omit<FlowContext, "requestId" | "db" | "tenantId"> & {
  tenantId?: string | null;
};

async function withTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number }
): Promise<T> {
  return prisma.$transaction(fn, {
    timeout: options?.timeout ?? 10_000,
    maxWait: options?.maxWait ?? 5_000,
  });
}

export class FlowExecutor {
  async run<I, O>(
    flow:  Flow<I, O>,
    input: unknown,
    ctx:   InboundCtx,
    opts?: { transaction?: boolean }
  ): Promise<O> {
    const traceId        = randomUUID();
    const start          = Date.now();
    const useTransaction = opts?.transaction ?? true;

    try {
      logger.debug(\`[FLOW INIT] \${flow.name}\`, { traceId });

      if (useTransaction) {
        return await withTx(async (tx) => {
          const parsedInput = flow.inputSchema.parse(input);
          const enrichedCtx: FlowContext = {
            ...ctx,
            tenantId:  ctx.tenantId ?? null,
            requestId: traceId,
            db:        tx,           // ← transaction client injected as ctx.db
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
        tenantId:  ctx.tenantId ?? null,
        requestId: traceId,
        db:        prisma,
      };
      const result = await flow.execute(parsedInput, enrichedCtx);
      if (flow.outputSchema) flow.outputSchema.parse(result);

      logger.info(\`[FLOW OK] \${flow.name}\`, { traceId, ms: Date.now() - start });
      return result;

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(\`[FLOW FAIL] \${flow.name}\`, { traceId, message });

      // Already a typed error — re-throw as-is
      if (err instanceof ApiError)  throw err;

      // Domain error → map to HTTP error
      if (err instanceof FlowError) {
        throw new ApiError(err.message, err.statusCode ?? 400, err.code);
      }

      // Unexpected — wrap generically
      throw new ApiError(
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : message,
        500,
        "FLOW_RUNTIME_ERROR"
      );
    }
  }
}

export const flowExecutor = new FlowExecutor();
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. Flow interface — consistent with FlowContext.db
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/flows/flow.ts",
  `
import { z } from "zod";
import type { FlowContext } from "./flow-context";

export interface Flow<I = unknown, O = unknown> {
  name:          string;
  inputSchema:   z.ZodType<I>;
  outputSchema?: z.ZodType<O>;
  execute(input: I, ctx: FlowContext): Promise<O>;
}
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. FlowError — consistent statusCode field
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/flows/flow-error.ts",
  `
/**
 * Domain-layer error thrown inside flows.
 * Mapped to ApiError at the FlowExecutor boundary.
 */
export class FlowError extends Error {
  constructor(
    public code:       string,
    message:           string,
    public statusCode: number = 400,
    public meta?:      Record<string, unknown>
  ) {
    super(message);
    this.name = "FlowError";
    Object.setPrototypeOf(this, FlowError.prototype);
  }
}
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. ApiError — add code field + OAuth2 statics + missing statics
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/errors/api-error.ts",
  `
/**
 * Operational HTTP error.
 * code  → machine-readable string (used by OAuth2 RFC 6749 responses)
 * statusCode → HTTP status
 */
export class ApiError extends Error {
  public statusCode: number;
  public code:       string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code       = code ?? \`HTTP_\${statusCode}\`;
    this.name       = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────
  static badRequest(msg: string) {
    return new ApiError(msg, 400, "BAD_REQUEST");
  }
  static unauthorized(msg = "Invalid credentials") {
    return new ApiError(msg, 401, "UNAUTHORIZED");
  }
  static forbidden(msg = "Access denied") {
    return new ApiError(msg, 403, "FORBIDDEN");
  }
  static notFound(msg: string) {
    return new ApiError(msg, 404, "NOT_FOUND");
  }
  static conflict(msg: string) {
    return new ApiError(msg, 409, "CONFLICT");
  }
  static unprocessable(msg: string) {
    return new ApiError(msg, 422, "UNPROCESSABLE");
  }
  static tooManyRequests(msg = "Too many requests") {
    return new ApiError(msg, 429, "TOO_MANY_REQUESTS");
  }
  static internal(msg = "Internal server error") {
    return new ApiError(msg, 500, "INTERNAL_SERVER_ERROR");
  }

  // ── OAuth2 / RFC 6749 ──────────────────────────────────────────────────────
  static invalidGrant(msg = "Invalid or expired grant") {
    return new ApiError(msg, 400, "invalid_grant");
  }
  static invalidClient(msg = "Client authentication failed") {
    return new ApiError(msg, 401, "invalid_client");
  }
  static invalidRequest(msg = "Missing or malformed request parameter") {
    return new ApiError(msg, 400, "invalid_request");
  }
  static invalidScope(msg = "Requested scope is invalid or unknown") {
    return new ApiError(msg, 400, "invalid_scope");
  }
  static accessDenied(msg = "The resource owner denied the request") {
    return new ApiError(msg, 403, "access_denied");
  }
  static unsupportedGrantType(msg = "Unsupported grant type") {
    return new ApiError(msg, 400, "unsupported_grant_type");
  }
}
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. Error handler — fix typo "meessage", fix error.code, add jose errors
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/errors/error-handler.ts",
  `
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError }  from "zod";
import { Prisma }    from "@/prisma-client";
import { ApiError }  from "./api-error";

export function errorHandler(
  error:   FastifyError | Error,
  request: FastifyRequest,
  reply:   FastifyReply
) {
  // 1. Known operational errors
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      success: false,
      error:   error.code,      // ← was error.statusCode (a number, wrong)
      message: error.message,   // ← was "meessage" (typo)
    });
  }

  // 2. Zod validation failures
  if (error instanceof ZodError) {
    return reply.status(422).send({
      success: false,
      error:   "VALIDATION_ERROR",
      issues:  error.flatten().fieldErrors,
    });
  }

  // 3. Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({
        success: false,
        error:   "CONFLICT",
        message: "A record with this value already exists",
      });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({
        success: false,
        error:   "NOT_FOUND",
        message: "Record not found",
      });
    }
    if (error.code === "P2003") {
      return reply.status(400).send({
        success: false,
        error:   "FOREIGN_KEY_VIOLATION",
        message: "Referenced record does not exist",
      });
    }
  }

  // 4. jose JWT errors
  const errCode = (error as any)?.code ?? error.name ?? "";
  if (errCode === "JWTExpired") {
    return reply.status(401).send({
      success: false, error: "TOKEN_EXPIRED", message: "Token has expired",
    });
  }
  if (errCode === "JWSSignatureVerificationFailed") {
    return reply.status(401).send({
      success: false, error: "INVALID_TOKEN", message: "Token signature is invalid",
    });
  }
  if (errCode === "JWTInvalid" || errCode === "JWSInvalid") {
    return reply.status(401).send({
      success: false, error: "INVALID_TOKEN", message: "Token is malformed",
    });
  }

  // 5. Fastify native 400 (JSON body parse / schema mismatch)
  if ("statusCode" in error && (error as FastifyError).statusCode === 400) {
    return reply.status(400).send({
      success: false, error: "BAD_REQUEST", message: error.message,
    });
  }

  // 6. Unhandled — never leak internals in production
  request.log.error({ err: error }, "[UNHANDLED ERROR]");
  return reply.status(500).send({
    success: false,
    error:   "INTERNAL_SERVER_ERROR",
    message: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : error.message,
  });
}
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. FlowError barrel (there are two copies in the repo — remove ambiguity)
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/errors/flow-error.ts",
  `
// Re-export from canonical location — do NOT define FlowError twice
export { FlowError } from "@/core/flows/flow-error";
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 8. Barrel exports — core/flows and core/errors
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/flows/index.ts",
  `
export type { Flow }        from "./flow";
export type { FlowContext } from "./flow-context";
export { FlowError }        from "./flow-error";
export { FlowExecutor, flowExecutor } from "./flow-executor";
`,
);

write(
  "src/core/errors/index.ts",
  `
export { ApiError }      from "./api-error";
export { FlowError }     from "./flow-error";
export { errorHandler }  from "./error-handler";
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 9. db-client — single source of truth
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/lib/db-client.ts",
  `
import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/prisma-client";

/**
 * Union of the global Prisma client and the interactive transaction client.
 * Use this type everywhere: FlowContext.db, services, repositories.
 * Never import PrismaClient directly in business logic.
 */
export type DbClient = Prisma.TransactionClient | typeof prisma;
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// 10. core/db/db-client — re-export only (no duplicate definition)
// ══════════════════════════════════════════════════════════════════════════════
write(
  "src/core/db/db-client.ts",
  `
// Canonical type lives in src/lib/db-client.ts — do not redefine here.
export type { DbClient } from "@/lib/db-client";
`,
);

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  arc-id core fixes applied                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ROOT CAUSE:                                                 ║
║  FlowContext declared  tx: DbClient                          ║
║  All flows expected    ctx.db                                ║
║  Fix: renamed tx → db in FlowContext + FlowExecutor          ║
║                                                              ║
║  OTHER FIXES:                                                ║
║  • ApiError.code field added (was missing)                   ║
║  • error-handler typo fixed (meessage → message)             ║
║  • error-handler error field fixed (code, not statusCode)    ║
║  • FlowError duplicate definition removed                    ║
║  • FlowExecutor now injects tx client as ctx.db correctly    ║
║  • Barrel exports cleaned up (no circular re-exports)        ║
║                                                              ║
║  AFTER RUNNING:                                              ║
║  pnpm tsc --noEmit --project tsconfig.api.json               ║
║                                                              ║
║  If you see remaining errors they will be one of:            ║
║  • ctx.tx used somewhere → replace with ctx.db               ║
║  • import from wrong barrel → use @/core/flows or            ║
║    @/core/errors directly                                     ║
╚══════════════════════════════════════════════════════════════╝
`);
