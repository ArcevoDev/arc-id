import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { TenantService } from "../services/tenant.service";
import { MembershipService } from "../services/membership.service";
import { ApiError } from "@/core/errors/api-error";
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
    const tenantService = new TenantService(ctx.db);
    const membershipService = new MembershipService(ctx.db);

    await tenantService.assertMembership(
      input.tenantId,
      ctx.identityId,
      "ADMIN",
    );
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
