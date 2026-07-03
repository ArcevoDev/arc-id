// src/modules/auth/flows/register.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { config } from "@/core/config";
import { RegisterSchema, IdentityDtoSchema } from "../validators/auth.schemas";
import { IdentityRepository } from "../repositories/identity.repository";
import { hashPassword } from "../services/password.service";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { presentIdentity } from "../presenters/identity.presenter";
import { dispatchWebhookEvent } from "@/lib/webhooks/webhook-dispatcher";

type Input = z.infer<typeof RegisterSchema>;
type Output = { identity: ReturnType<typeof presentIdentity> };

const SYSTEM_TENANT_ID = "SYSTEM";

export const registerFlow: Flow<Input, Output> = {
  name: "auth:register",
  inputSchema: RegisterSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityRepo = new IdentityRepository(ctx.db);

    if (await identityRepo.existsByEmail(input.email)) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    const { identity, verifyToken } = await ((ctx.db as any).$transaction(
      async (tx: any) => {
        const newIdentity = await tx.identity.create({
          data: {
            primaryEmail: input.email,
            name: input.name,
            status: "PENDING",
            localAccount: {
              create: { email: input.email, passwordHash },
            },
          },
        });

        const memberRole = await tx.role.findFirst({
          where: { tenantId: SYSTEM_TENANT_ID, name: "MEMBER" },
          select: { id: true },
        });

        if (memberRole) {
          await tx.tenantMembership.create({
            data: {
              identityId: newIdentity.id,
              tenantId: SYSTEM_TENANT_ID,
              roleId: memberRole.id,
              status: "ACTIVE",
            },
          });
        } else {
          ctx.logger?.warn(
            "SYSTEM tenant MEMBER role not found — run prisma db seed",
            { identityId: newIdentity.id },
          );
        }

        const emailTokenService = new EmailTokenService(tx);
        const token = await emailTokenService.issue(
          newIdentity.id,
          "VERIFY_EMAIL",
        );

        return { identity: newIdentity, verifyToken: token };
      },
    ) as Promise<{ identity: any; verifyToken: string }>);

    void notificationService.sendEmailVerification(input.email, verifyToken);

    await auditService.log(
      {
        action: "USER_REGISTERED",
        identityId: identity.id,
        ip: ctx.ip,
      },
      ctx.db,
    );

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

    void dispatchWebhookEvent(ctx.db, {
      tenantId: ctx.tenantId ?? SYSTEM_TENANT_ID,
      identityId: identity.id,
      eventType: "USER_REGISTERED",
      payload: { email: input.email, name: input.name ?? null },
    }).catch(() => {});

    return { identity: presentIdentity(identity) };
  },
};
