import { config } from "@/core/config";
import type { FastifyReply } from "fastify";

export const REFRESH_COOKIE_NAME = "arcid_refresh_token";

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.base.isProduction,
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
