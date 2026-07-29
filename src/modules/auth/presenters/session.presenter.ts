// src/modules/auth/presenters/session.presenter.ts
import type { Session } from "@prisma-client";

export function presentSession(session: Session) {
  return {
    id: session.id,
    identityId: session.identityId,
    deviceId: session.deviceId,
    ip: session.ip,
    userAgent: session.userAgent,
    authLevel: session.authLevel,
    elevatedAt: session.elevatedAt,
    valid: session.valid,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}
