import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@/prisma-client";
import { ApiError } from "./api-error";
import { config } from "@/core/config";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // 1. Known operational errors
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.code, // ← was error.statusCode (a number, wrong)
      message: error.message, // ← was "meessage" (typo)
    });
  }

  // 2. Zod validation failures
  if (error instanceof ZodError) {
    return reply.status(422).send({
      success: false,
      error: "VALIDATION_ERROR",
      issues: error.flatten().fieldErrors,
    });
  }

  // 3. Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({
        success: false,
        error: "CONFLICT",
        message: "A record with this value already exists",
      });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({
        success: false,
        error: "NOT_FOUND",
        message: "Record not found",
      });
    }
    if (error.code === "P2003") {
      return reply.status(400).send({
        success: false,
        error: "FOREIGN_KEY_VIOLATION",
        message: "Referenced record does not exist",
      });
    }
  }

  // 4. jose JWT errors
  const errCode = (error as any)?.code ?? error.name ?? "";
  if (errCode === "JWTExpired") {
    return reply.status(401).send({
      success: false,
      error: "TOKEN_EXPIRED",
      message: "Token has expired",
    });
  }
  if (errCode === "JWSSignatureVerificationFailed") {
    return reply.status(401).send({
      success: false,
      error: "INVALID_TOKEN",
      message: "Token signature is invalid",
    });
  }
  if (errCode === "JWTInvalid" || errCode === "JWSInvalid") {
    return reply.status(401).send({
      success: false,
      error: "INVALID_TOKEN",
      message: "Token is malformed",
    });
  }

  // 5. Fastify native 400 (JSON body parse / schema mismatch)
  if ("statusCode" in error && (error as FastifyError).statusCode === 400) {
    return reply.status(400).send({
      success: false,
      error: "BAD_REQUEST",
      message: error.message,
    });
  }

  // 6. Unhandled — never leak internals in production
  request.log.error({ err: error }, "[UNHANDLED ERROR]");
  return reply.status(500).send({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message:
      config.base.env === "production"
        ? "An unexpected error occurred"
        : error.message,
  });
}
