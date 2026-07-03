import type { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { ApiError } from "./api-error";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Global application exception interceptor.
 * Safely parses semantic validation mismatches without overriding domain status payloads.
 */
export async function errorHandler(
  error: Error | FastifyError | ApiError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // 1. Structural Domain API Failures
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.code,
      message: error.message,
    });
  }

  // 2. Client Side Parsing Schemes (.issues is the correct property for ZodError)
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: "VALIDATION_ERROR",
      message: "Input validation failed",
      details: error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // 3. Fastify Native HTTP Validation Failures
  if (
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    (error as any).validation
  ) {
    return reply.status(400).send({
      success: false,
      error: "BAD_REQUEST",
      message: error.message,
    });
  }

  // 4. Default Crash-safety Boundary
  request.log.error({ err: error }, "[UNHANDLED RUNTIME FAILURE]");
  return reply.status(500).send({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message,
  });
}
