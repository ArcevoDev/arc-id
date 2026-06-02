import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { AddMemberSchema } from "../validators/tenant.schemas";
import { MembershipService } from "../services/membership.service";
import { TenantService } from "../services/tenant.service";
import { presentMembership } from "../presenters/membership.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";

const Input = AddMemberSchema.extend({ tenantId: z.string().cuid() });

export const addMemberFlow: Flow<z.infer<typeof Input>> = {
  name: "tenant:add-member",
  inputSchema: Input,
  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();

    const tenantService = new TenantService(ctx.db);
    const membershipService = new MembershipService(ctx.db);

    // 1. Caller must be an ADMIN of this tenant
    const callerMembership = await tenantService.assertMembership(
      input.tenantId,
      ctx.userId,
      "ADMIN",
    );

    // 2. Resolve the tenant name for the invite email
    const tenant = await ctx.db.tenant.findUniqueOrThrow({
      where: { id: input.tenantId },
      select: { name: true },
    });

    // 3. Resolve the caller's name + the invitee's email
    const [caller, invitee] = await Promise.all([
      ctx.db.identity.findUnique({
        where: { id: ctx.userId },
        select: { name: true },
      }),
      ctx.db.identity.findUnique({
        where: { id: input.identityId },
        select: { name: true, primaryEmail: true },
      }),
    ]);

    if (!invitee?.primaryEmail) {
      throw ApiError.badRequest(
        "Invitee identity does not have a verified primary email",
      );
    }

    // 4. Create the membership record
    const membership = await membershipService.add(
      input.tenantId,
      input.identityId,
      input.role,
    );

    // 5. Write audit entry (fire-and-forget)
    auditService.log({
      action: "TENANT_MEMBER_ADDED",
      identityId: input.identityId,
      tenantId: input.tenantId,
    });

    // 6. Send invite notification (fire-and-forget — mail failure must not abort the flow)
    void notificationService.sendTenantInvite(invitee.primaryEmail, {
      tenantName: tenant.name,
      inviterName: caller?.name ?? "A team admin",
      role: input.role,
      // NOTE: in production, generate a short-lived invite token and pass it here
      // so the recipient can set their own password if they don't have one.
      inviteToken: membership.id, // placeholder — swap for a real EmailToken
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return { membership: presentMembership(membership) };
  },
};
