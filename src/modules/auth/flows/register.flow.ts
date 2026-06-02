import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { config } from "@/core/config"; // Centralized config
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

export const registerFlow: Flow<Input, Output> = {
  name: "auth:register",
  inputSchema: RegisterSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityRepo = new IdentityRepository(ctx.db);
    const emailTokenService = new EmailTokenService(ctx.db);

    // 1. Guard: email uniqueness verification
    if (await identityRepo.existsByEmail(input.email)) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    // 2. Create Identity + LocalAccount atomically (Inside the executor's transaction)
    const identity = await ctx.db.identity.create({
      data: {
        primaryEmail: input.email,
        name: input.name,
        status: "PENDING",
        localAccount: {
          create: {
            email: input.email,
            passwordHash,
          },
        },
      },
    });

    // 3. Issue email verification token and dispatch notification (Non-blocking worker loop)
    const verifyToken = await emailTokenService.issue(
      identity.id,
      "VERIFY_EMAIL",
    );

    void notificationService.sendEmailVerification(input.email, verifyToken);

    // Call audit log using the root `db`
    void auditService.log({
      action: "USER_REGISTERED",
      identityId: identity.id,
      ip: ctx.ip,
    });

    // 4. Record webhook event to the outbox table for ecosystem provisioning (e.g., arcbase)
    try {
      await ctx.db.webhookEvent.create({
        data: {
          eventType: "IDENTITY_CREATED",
          identityId: identity.id,
          payload: { email: input.email, name: input.name ?? null },
          targetUrl: config.integration.arcbaseWebhookUrl, // Clean injection
        },
      });
    } catch (error) {
      // ✨ Fixed: Order adjusted to comply with (message, meta) signature mapping rules
      ctx.logger?.error("Failed to write outbox webhookEvent record", {
        error,
        identityId: identity.id,
      });
    }

    return { identity: presentIdentity(identity) };
  },
};
