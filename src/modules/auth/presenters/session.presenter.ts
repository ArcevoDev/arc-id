import type { Session } from "@/prisma-client";

export function presentSession(session: Session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    ip: session.ip,
    userAgent: session.userAgent,
    valid: session.valid,
  };
}
