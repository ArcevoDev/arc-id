import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { SessionRepository } from "../repositories/session.repository";
import { auditService } from "@/modules/audit/services/audit.service";

const LogoutSchema = z.object({ sessionId: z.string().cuid() });

export const logoutFlow: Flow<z.infer<typeof LogoutSchema>> = {
  name: "auth:logout",
  inputSchema: LogoutSchema,

  async execute(input, ctx: FlowContext) {
    const sessionRepo = new SessionRepository(ctx.db);
    await sessionRepo.revokeById(input.sessionId);

    auditService.log({
      action: "SESSION_REVOKED",
      identityId: ctx.userId,
      ip: ctx.ip,
    });

    return {};
  },
};
