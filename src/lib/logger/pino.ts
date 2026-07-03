// src/lib/logger/pino.ts
import pino from "pino";
import { config } from "@/core/config";
import type { FlowLogger } from "./flow-logger";

const isProduction = config.base.isProduction;

const pinoInstance = pino({
  level: config.base.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});

// ── Argument normalizer ────────────────────────────────────────────────────────
//
// Accepts either calling style and returns a canonical { msg, meta } pair.
//
//   Style A (original):  (msg: string, meta?: Record)
//   Style B (pino-native): (meta: Record, msg: string)
//
// Detection: if the first argument is a string → Style A.
//            if the first argument is an object → Style B.
//
type Meta = Record<string, unknown>;

function normalize(
  first: string | Meta,
  second?: string | Meta,
): { msg: string; meta: Meta | undefined } {
  if (typeof first === "string") {
    // Style A: logger.info("msg", { meta? })
    return {
      msg: first,
      meta: second !== undefined ? (second as Meta) : undefined,
    };
  }
  // Style B: logger.info({ meta }, "msg")
  return {
    msg: typeof second === "string" ? second : "",
    meta: first,
  };
}

// ── Logger implementation ──────────────────────────────────────────────────────

function makeMethod(
  pinoMethod: pino.LogFn,
): (first: string | Meta, second?: string | Meta) => void {
  return (first, second) => {
    const { msg, meta } = normalize(first, second);
    if (meta) {
      pinoMethod.call(pinoInstance, meta, msg);
    } else {
      pinoMethod.call(pinoInstance, msg);
    }
  };
}

export const logger: FlowLogger = {
  debug: makeMethod(pinoInstance.debug),
  info: makeMethod(pinoInstance.info),
  warn: makeMethod(pinoInstance.warn),
  error: makeMethod(pinoInstance.error),

  // Success wraps info with an isSuccess flag and a visual prefix in dev.
  success(first: string | Meta, second?: string | Meta) {
    const { msg, meta } = normalize(first, second);
    const formattedMsg = isProduction ? msg : `✨ ${msg}`;
    pinoInstance.info({ ...meta, isSuccess: true }, formattedMsg);
  },
};
