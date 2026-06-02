import pino from "pino";
import { config } from "@/core/config";
import { FlowLogger } from "./flow-logger";

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

export const logger: FlowLogger = {
  debug: (msg, meta) =>
    meta ? pinoInstance.debug(meta, msg) : pinoInstance.debug(msg),
  info: (msg, meta) =>
    meta ? pinoInstance.info(meta, msg) : pinoInstance.info(msg),
  warn: (msg, meta) =>
    meta ? pinoInstance.warn(meta, msg) : pinoInstance.warn(msg),
  error: (msg, meta) =>
    meta ? pinoInstance.error(meta, msg) : pinoInstance.error(msg),

  // Success uses info logs under the hood, but wraps the message for visual pop
  success: (msg, meta) => {
    const formattedMsg = isProduction ? msg : `✨ ${msg}`;
    if (meta) {
      pinoInstance.info({ ...meta, isSuccess: true }, formattedMsg);
    } else {
      pinoInstance.info({ isSuccess: true }, formattedMsg);
    }
  },
};
