// src/modules/auth/flows/register.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { config } from "@/core/config";
import { RegisterSchema } from "../validators/auth.schemas";
import { IdentityRepository } from "../repositories/identity.repository";
import { hashPassword } from "../services/password.service";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { presentIdentity } from "../presenters/identity.presenter";

type Input = z.infer<typeof RegisterSchema>;
type Output = { identity: ReturnType<typeof presentIdentity> };

const SYSTEM_TENANT_ID = "SYSTEM";

export const registerFlow: Flow<Input, Output> = {
  name: "auth:register",
  inputSchema: RegisterSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityRepo = new IdentityRepository(ctx.db);
    const emailTokenService = new EmailTokenService(ctx.db);

    // 1. Guard: email uniqueness
    if (await identityRepo.existsByEmail(input.email)) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    // 2. Create Identity + LocalAccount atomically (Decoupled from legacy inline subscriptions payload)
    const identity = await ctx.db.identity.create({
      data: {
        primaryEmail: input.email,
        name: input.name,
        status: "PENDING",
        localAccount: {
          create: { email: input.email, passwordHash },
        },
      },
    });

    // 3. Auto-join SYSTEM tenant as MEMBER
    try {
      const memberRole = await ctx.db.role.findFirst({
        where: { tenantId: SYSTEM_TENANT_ID, name: "MEMBER" },
        select: { id: true },
      });

      if (memberRole) {
        await ctx.db.tenantMembership.create({
          data: {
            identityId: identity.id,
            tenantId: SYSTEM_TENANT_ID,
            roleId: memberRole.id,
            status: "ACTIVE",
          },
        });
      } else {
        ctx.logger?.warn(
          "SYSTEM tenant MEMBER role not found — run prisma db seed",
          { identityId: identity.id }
        );
      }
    } catch (err) {
      ctx.logger?.error("Failed to add identity to SYSTEM tenant", {
        error: err,
        identityId: identity.id,
      });
    }

    // 4. Issue email verification token and dispatch notification
    const verifyToken = await emailTokenService.issue(
      identity.id,
      "VERIFY_EMAIL",
    );
    void notificationService.sendEmailVerification(input.email, verifyToken);

    // 5. Audit log passed safely via the current active connection context to prevent transactional pool deadlock
    await auditService.log(
      {
        action: "USER_REGISTERED",
        identityId: identity.id,
        ip: ctx.ip,
      },
      ctx.db
    );

    // 6. Outbox webhook for ecosystem provisioning (e.g. arcbase)
    try {
      await ctx.db.webhookEvent.create({
        data: {
          eventType: "IDENTITY_CREATED",
          identityId: identity.id,
          payload: { email: input.email, name: input.name ?? null },
          targetUrl: config.integration.arcbaseWebhookUrl,
        },
      });
    } catch (error) {
      ctx.logger?.error("Failed to write outbox webhookEvent record", {
        error,
        identityId: identity.id,
      });
    }

    return { identity: presentIdentity(identity) };
  },
};