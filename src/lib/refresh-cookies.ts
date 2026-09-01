import type { FastifyReply } from "fastify";

export const REFRESH_COOKIE_NAME = "arcid_refresh_token";

// Keep this module free of any `@/core/config` import so it can be bundled
// into the client (it's re-exported via the SDK). `@/core/config` eagerly
// validates the full server env (DATABASE_URL, JWT_SECRET, etc.) at module
// load, which throws in the browser where only NEXT_PUBLIC_* vars exist.
// `process.env.NODE_ENV` is statically replaced by Next.js on the client and
// reads the real env on the server — equivalent to `config.base.isProduction`
// (rawEnv.NODE_ENV defaults to "development", so unset === not production).
const isProduction = process.env.NODE_ENV === "production";

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  maxAge: 30 * 24 * 60 * 60,
  path: "/",
} as const;

export function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}
