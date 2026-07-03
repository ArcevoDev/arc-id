// src/modules/tenant/flows/add-member.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { AddMemberSchema } from "../validators/tenant.schemas";
import { MembershipService } from "../services/membership.service";
import { TenantService } from "../services/tenant.service";
import { EmailTokenService } from "@/modules/auth/services/email-token.service";
import { presentMembership } from "../presenters/membership.presenter";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { dispatchWebhookEvent } from "@/lib/webhooks/webhook-dispatcher";

const Input = AddMemberSchema.extend({ tenantId: z.string().cuid() });

export const addMemberFlow: Flow<z.infer<typeof Input>> = {
  name: "tenant:add-member",
  inputSchema: Input,

  async execute(input, ctx: FlowContext) {
    if (!ctx.identityId) throw ApiError.unauthorized();

    const tenantService = new TenantService(ctx.db);
    const membershipService = new MembershipService(ctx.db);
    const emailTokenService = new EmailTokenService(ctx.db);

    // 1. Caller must be an ADMIN of this tenant
    await tenantService.assertMembership(
      input.tenantId,
      ctx.identityId,
      "ADMIN",
    );

    // 2. Resolve tenant name + caller name + invitee details
    const [tenant, caller, invitee] = await Promise.all([
      ctx.db.tenant.findUniqueOrThrow({
        where: { id: input.tenantId },
        select: { name: true, slug: true },
      }),
      ctx.db.identity.findUnique({
        where: { id: ctx.identityId },
        select: { name: true },
      }),
      ctx.db.identity.findUnique({
        where: { id: input.identityId },
        select: { id: true, name: true, primaryEmail: true },
      }),
    ]);

    if (!invitee?.primaryEmail) {
      throw ApiError.badRequest(
        "Invitee identity does not have a verified primary email",
      );
    }

    // 3. Create PENDING membership
    const callerPlan = ctx.plan ?? "FREE";
    const membership = await membershipService.add(
      input.tenantId,
      input.identityId,
      input.role,
      callerPlan,
    );

    // 4. Issue TENANT_INVITE EmailToken with tenantId stored on the token.
    //    FIX: passing tenantId here so invite.route.ts can activate exactly
    //    THIS tenant's membership even if the invitee has other pending invites.
    const inviteToken = await emailTokenService.issue(
      invitee.id,
      "TENANT_INVITE",
      7 * 24, // 7 day TTL
      input.tenantId, // ← FIX: tenantId stored on the token
    );

    // 5. Audit (fire-and-forget)
    void auditService
      .log({
        action: "TENANT_MEMBER_ADDED",
        identityId: input.identityId,
        tenantId: input.tenantId,
      })
      .catch(() => {});

    // 6. Send invite email (fire-and-forget)
    void notificationService
      .sendTenantInvite(invitee.primaryEmail, {
        tenantName: tenant.name,
        inviterName: caller?.name ?? "A team admin",
        role: input.role,
        inviteToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .catch(() => {});

    // 7. Dispatch to tenant webhooks
    void dispatchWebhookEvent(ctx.db, {
      tenantId: input.tenantId,
      identityId: ctx.identityId,
      eventType: "TENANT_MEMBER_ADDED",
      payload: {
        inviteeId: input.identityId,
        inviteeEmail: invitee.primaryEmail,
        role: input.role,
      },
    }).catch(() => {});

    return { membership: presentMembership(membership) };
  },
};
