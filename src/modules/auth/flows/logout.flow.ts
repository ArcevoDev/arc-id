// src/modules/auth/flows/logout.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { auditService } from "@/modules/audit/services/audit.service";
import { ApiError } from "@/core/errors";

const LogoutSchema = z.object({
  sessionId: z.string().min(40).max(128),
});

export const logoutFlow: Flow<
  z.infer<typeof LogoutSchema>,
  Record<string, never>
> = {
  name: "auth:logout",
  inputSchema: LogoutSchema,

  async execute(input, ctx: FlowContext): Promise<Record<string, never>> {
    const session = await ctx.db.session.findFirst({
      where: {
        id: input.sessionId,
        ...(ctx.identityId ? { identityId: ctx.identityId } : {}),
      },
      select: {
        id: true,
        identityId: true,
        refreshTokenId: true,
      },
    });

    if (!session) {
      void auditService
        .log({
          action: "SESSION_REVOKED",
          identityId: ctx.identityId,
          ip: ctx.ip,
          metadata: {
            reason: "session_not_found_on_logout",
            sessionId: input.sessionId,
          },
        })
        .catch(() => {});
      return {};
    }

    const accessJti = (ctx as any).jti as string | undefined;

    await (ctx.db as any).$transaction(async (tx: any) => {
      if (session.refreshTokenId) {
        await tx.refreshToken.updateMany({
          where: {
            id: session.refreshTokenId,
            revoked: false,
          },
          data: {
            revoked: true,
            rotatedAt: new Date(),
          },
        });
      }

      await tx.refreshToken.updateMany({
        where: {
          sessionId: session.id,
          revoked: false,
        },
        data: {
          revoked: true,
          rotatedAt: new Date(),
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { valid: false },
      });

      if (accessJti) {
        await tx.revokedJti.upsert({
          where: { jti: accessJti },
          update: {},
          create: { jti: accessJti },
        });
      }
    });

    void auditService
      .log({
        action: "SESSION_REVOKED",
        identityId: session.identityId,
        ip: ctx.ip,
        metadata: {
          sessionId: session.id,
          accessTokenBlacklisted: Boolean(accessJti),
        },
      })
      .catch(() => {});

    return {};
  },
};
