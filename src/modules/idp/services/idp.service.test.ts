// src/modules/idp/services/idp.service.test.ts
//
// Phase 0 regression: federated-login email-verification gap.
// The fix gates auto-link on `existingIdentity.emailVerified === true`.
// This test verifies that federatedLogin throws ApiError.conflict when a
// matching email identity exists but is not yet email-verified.

import { describe, it, expect, beforeEach } from "vitest";
import { ApiError } from "@/core/errors";
import { createMockDb } from "@/test-utils/mock-db";
import { federatedLogin } from "./idp.service";

// Minimal Fastify-like object that exposes only what federatedLogin uses
function mockFastify(db: ReturnType<typeof createMockDb>) {
  return { db } as any;
}

describe("federatedLogin — Phase 0: email-verification gate", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    // $transaction auto-calls fn(mock) so the inner code sees the same mock
    db.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(db));
  });

  it("links to existing verified email identity", async () => {
    // No existing OAuthAccount link
    db.oAuthAccount.findUnique.mockResolvedValue(null);
    // Found identity with same email, VERIFIED
    db.identity.findFirst.mockResolvedValue({
      id: "existing-verified",
      primaryEmail: "alice@example.com",
      emailVerified: true,
      status: "ACTIVE",
    });
    // Will link via oAuthAccount.create
    db.oAuthAccount.create.mockResolvedValue({ id: "oa-1" } as any);
    // Role lookup for tenant membership
    db.role.findFirst.mockResolvedValue({ id: "role-member" });
    // Session creation
    db.session.create.mockResolvedValue({
      id: "session-1",
      identityId: "existing-verified",
    } as any);
    // TokenService.issue() lookups
    db.client.findUnique.mockResolvedValue({
      id: 1,
      clientId: "arcid-direct",
      public: false,
      clientSecret: null,
    });
    db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    db.identity.findUniqueOrThrow.mockResolvedValue({
      id: "existing-verified",
      primaryEmail: "alice@example.com",
      emailVerified: true,
      name: "Alice",
    });
    db.accessToken.create.mockResolvedValue({ id: "at-1" });
    db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    db.session.updateMany.mockResolvedValue({ count: 1 });

    const result = await federatedLogin(
      mockFastify(db),
      {
        nameID: "saml-idp-uid-1",
        email: "alice@example.com",
        name: "Alice",
      },
      "saml-test",
      "tenant-1",
      "10.0.0.1",
      "saml-sp",
    );

    // Should have linked to existing identity (not created a new one)
    expect(result.access_token).toEqual(expect.any(String));
    // oAuthAccount.create should be called for the link
    expect(db.oAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ identityId: "existing-verified" }),
      }),
    );
  });

  it("throws conflict when existing email identity is NOT verified", async () => {
    db.oAuthAccount.findUnique.mockResolvedValue(null);
    db.identity.findFirst.mockResolvedValue({
      id: "existing-unverified",
      primaryEmail: "alice@example.com",
      emailVerified: false,
      status: "ACTIVE",
    });

    await expect(
      federatedLogin(
        mockFastify(db),
        {
          nameID: "saml-idp-uid-2",
          email: "alice@example.com",
          name: "Alice",
        },
        "saml-test",
        "tenant-1",
        "10.0.0.1",
        "saml-sp",
      ),
    ).rejects.toThrow(ApiError);

    // Should NOT have created a new identity or linked the account
    expect(db.identity.create).not.toHaveBeenCalled();
    expect(db.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it("creates a new identity when no email match exists", async () => {
    db.oAuthAccount.findUnique.mockResolvedValue(null);
    db.identity.findFirst.mockResolvedValue(null); // no match by email
    db.role.findFirst.mockResolvedValue({ id: "role-member" });
    db.identity.create.mockResolvedValue({
      id: "brand-new-id",
      primaryEmail: "bob@example.com",
      emailVerified: true,
      status: "ACTIVE",
    } as any);
    db.oAuthAccount.create.mockResolvedValue({ id: "oa-2" } as any);
    db.session.create.mockResolvedValue({
      id: "session-2",
      identityId: "brand-new-id",
    } as any);
    // TokenService.issue() lookups
    db.client.findUnique.mockResolvedValue({
      id: 1,
      clientId: "arcid-direct",
      public: false,
      clientSecret: null,
    });
    db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    db.identity.findUniqueOrThrow.mockResolvedValue({
      id: "brand-new-id",
      primaryEmail: "bob@example.com",
      emailVerified: true,
      name: "Bob",
    });
    db.accessToken.create.mockResolvedValue({ id: "at-1" });
    db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    db.session.updateMany.mockResolvedValue({ count: 1 });

    const result = await federatedLogin(
      mockFastify(db),
      {
        nameID: "saml-idp-uid-3",
        email: "bob@example.com",
        name: "Bob",
      },
      "saml-test",
      "tenant-1",
      "10.0.0.1",
      "saml-sp",
    );

    expect(result.access_token).toEqual(expect.any(String));
    // Should have created NEW identity (no email match)
    expect(db.identity.create).toHaveBeenCalledTimes(1);
    // Should also have auto-joined the tenant
    expect(db.tenantMembership.create).toHaveBeenCalled();
  });
});
