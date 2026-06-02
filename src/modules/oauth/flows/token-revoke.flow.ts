import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { RevokeSchema } from "../validators/oauth.schemas";
import { auditService } from "@/modules/audit/services/audit.service";

export const tokenRevokeFlow: Flow<z.infer<typeof RevokeSchema>> = {
  name: "oauth:token-revoke",
  inputSchema: RevokeSchema,

  async execute(input, ctx: FlowContext) {
    // Try access token first, then refresh token — RFC 7009
    const accessToken = await ctx.db.accessToken.findFirst({
      where: { token: input.token },
    });
    if (accessToken) {
      await ctx.db.accessToken.update({
        where: { id: accessToken.id },
        data: { revoked: true },
      });
      if (accessToken.jti) {
        await ctx.db.revokedJti.create({ data: { jti: accessToken.jti } });
      }
      auditService.log({
        action: "TOKEN_REVOKED",
        identityId: accessToken.identityId,
        ip: ctx.ip,
      });
      return {};
    }

    const refreshToken = await ctx.db.refreshToken.findFirst({
      where: { token: input.token },
    });
    if (refreshToken) {
      await ctx.db.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revoked: true },
      });
      auditService.log({
        action: "TOKEN_REVOKED",
        identityId: refreshToken.identityId,
        ip: ctx.ip,
      });
    }

    return {}; // RFC 7009: always return 200
  },
};
