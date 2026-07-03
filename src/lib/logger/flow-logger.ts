// src/lib/logger/flow-logger.ts
//
// Two calling styles are accepted on every method:
//
//   Style A — original (msg-first):
//     logger.info("Something happened", { key: "value" })
//
//   Style B — pino-native (meta-first):
//     logger.info({ key: "value" }, "Something happened")
//
// Both styles produce identical structured log output.
// Style B support was added so worker files (webhook-worker, start-workers,
// challenge-store) can use the pino-native style they were written with,
// without requiring a rewrite of every call site.

type Meta = Record<string, unknown>;

export interface FlowLogger {
  // Style A: logger.debug("msg", { meta })
  debug(message: string, meta?: Meta): void;
  // Style B: logger.debug({ meta }, "msg")
  debug(meta: Meta, message: string): void;

  info(message: string, meta?: Meta): void;
  info(meta: Meta, message: string): void;

  warn(message: string, meta?: Meta): void;
  warn(meta: Meta, message: string): void;

  error(message: string, meta?: Meta): void;
  error(meta: Meta, message: string): void;

  success(message: string, meta?: Meta): void;
  success(meta: Meta, message: string): void;
}
