import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { MembershipService } from "../services/membership.service";
import { ApiError } from "@/core/errors/api-error";
import { hasPermission } from "@/lib/security/rbac";
import { auditService } from "@/modules/audit/services/audit.service";

const Input = z.object({
  tenantId: z.string().cuid(),
  identityId: z.string().cuid(),
});

export const removeMemberFlow: Flow<z.infer<typeof Input>> = {
  name: "tenant:remove-member",
  inputSchema: Input,

  async execute(input, ctx: FlowContext) {
    if (!ctx.identityId) throw ApiError.unauthorized();
    const membershipService = new MembershipService(ctx.db);

    if (
      !(await hasPermission(
        ctx.db,
        ctx.identityId,
        input.tenantId,
        "member:remove",
      ))
    ) {
      throw ApiError.forbidden("Permission required: member:remove");
    }
    await membershipService.remove(input.tenantId, input.identityId);

    void auditService
      .log({
        action: "TENANT_MEMBER_REMOVED",
        identityId: input.identityId,
        tenantId: input.tenantId,
      })
      .catch(() => {});
    return {};
  },
};
