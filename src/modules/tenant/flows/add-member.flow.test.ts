// src/modules/tenant/flows/add-member.flow.test.ts
//
// Proves the flow-level hasPermission check works:
//   - A caller without "member:add" gets 403 (ApiError.forbidden)
//   - A caller with "member:add" proceeds through the flow
//
// DB is mocked via createMockFlowCtx. External services (MembershipService,
// EmailTokenService, audit, notification, webhook dispatch) are mocked to
// allow the happy path to complete without side effects.

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock @prisma-client before any imports — validators import it ────────────

vi.mock("@prisma-client", () => ({
  UserStatus: { ACTIVE: "ACTIVE", INVITED: "INVITED", SUSPENDED: "SUSPENDED" },
}));

// ── Mock external services the flow calls after the permission check ─────────

vi.mock("../services/membership.service", () => ({
  MembershipService: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn().mockResolvedValue({
        id: "membership-1",
        role: "MEMBER",
        status: "PENDING",
        identityId: "invitee-id",
        tenantId: "tenant-1",
      }),
    };
  }),
}));

vi.mock("@/modules/auth/services/email-token.service", () => ({
  EmailTokenService: vi.fn().mockImplementation(function () {
    return {
      issue: vi.fn().mockResolvedValue("invite-token-xyz"),
    };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendTenantInvite: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/webhooks/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

import { addMemberFlow } from "./add-member.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("addMemberFlow — hasPermission('member:add') guard", () => {
  const tenantId = "cltenant000001testtenant1";
  const identityId = "caller-id";
  const inviteeId = "invitee-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without 'member:add' permission", () => {
    it("throws 403 when hasPermission returns false (no matching membership)", async () => {
      const ctx = createMockFlowCtx({ identityId, tenantId });

      // hasPermission(ctx.db, ...) calls tenantMembership.findFirst.
      // Return null → no membership → no permission → 403.
      ctx.db.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(
        addMemberFlow.execute(
          { identityId: inviteeId, role: "MEMBER", tenantId },
          ctx,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: /member:add/i,
      });

      expect(ctx.db.tenantMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            identityId,
            tenantId,
            status: "ACTIVE",
          }),
        }),
      );
    });
  });

  describe("with 'member:add' permission", () => {
    it("proceeds past the permission check to completion", async () => {
      const ctx = createMockFlowCtx({ identityId, tenantId });

      // hasPermission returns true: membership exists with matching permission
      ctx.db.tenantMembership.findFirst.mockResolvedValue({
        role: { permissions: [{ permissionId: "perm-member-add" }] },
      });

      // createMockFlowCtx doesn't include `tenant` — add it manually
      ctx.db.tenant = {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          name: "Test Tenant",
          slug: "test-tenant",
        }),
      };

      // Stub identity lookups
      ctx.db.identity.findUnique.mockImplementation(
        async ({ where: { id } }: any) => {
          if (id === identityId) return { name: "Caller User" };
          if (id === inviteeId)
            return {
              id: inviteeId,
              name: "Invitee User",
              primaryEmail: "invitee@example.com",
            };
          return null;
        },
      );

      const result = (await addMemberFlow.execute(
        { identityId: inviteeId, role: "MEMBER", tenantId },
        ctx,
      )) as { membership: Record<string, unknown> };

      expect(result.membership).toBeDefined();
      // The flow should not have thrown, proving the permission check passed
      expect(ctx.db.tenantMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ identityId, tenantId }),
        }),
      );
    });
  });
});
