import { describe, it, expect, vi } from "vitest";
import { createTenantFlow } from "./create-tenant.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

/**
 * ModelProxy helper — mirrors the private function in mock-db.ts.
 * The mock db's $transaction passes the SAME object as tx, so `tenant`
 * (which is not in createMockDb's predefined model list) is initialised
 * once as a proxy that lazy-creates vitest fns on property access.
 */
function modelProxy(name: string): Record<string, any> {
  return new Proxy<Record<string, any>>(
    {},
    {
      get(target, key: string) {
        if (!target[key]) target[key] = vi.fn().mockName(`${name}.${key}`);
        return target[key];
      },
    },
  );
}

function makeCtx(overrides: Record<string, any> = {}) {
  const ctx = createMockFlowCtx({
    identityId: "id-creator-1",
    plan: "FREE",
    ...overrides,
  });
  // Tenant model is not in createMockDb's preset list — add it as a dynamic proxy
  // so the slug check (ctx.db.tenant.findFirst) and inner transaction
  // (tx.tenant.create / tx.tenantMembership.count) both work.
  ctx.db.tenant = modelProxy("tenant");
  return ctx;
}

const ALWAYS_GOOD_INPUT = {
  name: "Test Org",
  slug: "test-org",
  sector: "technology",
};

describe("createTenantFlow — tenant caps", () => {
  it("allows creation when under the FREE cap (current 0 < cap 1)", async () => {
    const ctx = makeCtx({ plan: "FREE" });
    ctx.db.tenantMembership.count.mockResolvedValue(0);
    ctx.db.tenant.findFirst.mockResolvedValue(null);
    ctx.db.tenant.create.mockResolvedValue({
      id: "t_1",
      name: "Test Org",
      slug: "test-org",
      sector: "technology",
      createdAt: new Date(),
    });
    ctx.db.role.findMany = vi.fn().mockResolvedValue([
      { id: "role_admin", name: "ADMIN", description: "Tenant administrator" },
      {
        id: "role_member",
        name: "MEMBER",
        description: "Standard tenant member",
      },
    ]);
    ctx.db.tenantMembership.create.mockResolvedValue({});

    // Added 'as any' to bypass the TS18046 unknown type error
    const result = (await createTenantFlow.execute(
      ALWAYS_GOOD_INPUT,
      ctx,
    )) as any;
    expect(result).toBeDefined();
    expect(result.tenant).toBeDefined();
    expect(result.tenant.name).toBe("Test Org");
  });

  it("blocks creation when at the FREE cap (current 1 >= cap 1)", async () => {
    const ctx = makeCtx({ plan: "FREE" });
    ctx.db.tenantMembership.count.mockResolvedValue(1);
    ctx.db.tenant.findFirst.mockResolvedValue(null);

    await expect(
      createTenantFlow.execute(ALWAYS_GOOD_INPUT, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TENANT_CAP_REACHED",
      message:
        "Your FREE plan allows up to 1 tenant. Upgrade your plan to create more.",
    });
  });

  it("blocks PRO creation when at the PRO cap (current 5 >= cap 5)", async () => {
    const ctx = makeCtx({ plan: "PRO" });
    ctx.db.tenantMembership.count.mockResolvedValue(5);
    ctx.db.tenant.findFirst.mockResolvedValue(null);

    await expect(
      createTenantFlow.execute(ALWAYS_GOOD_INPUT, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TENANT_CAP_REACHED",
      message:
        "Your PRO plan allows up to 5 tenants. Upgrade your plan to create more.",
    });
  });

  it("allows PRO creation when under the PRO cap (current 4 < cap 5)", async () => {
    const ctx = makeCtx({ plan: "PRO" });
    ctx.db.tenantMembership.count.mockResolvedValue(4);
    ctx.db.tenant.findFirst.mockResolvedValue(null);
    ctx.db.tenant.create.mockResolvedValue({
      id: "t_1",
      name: "Test Org",
      slug: "test-org",
      sector: "technology",
      createdAt: new Date(),
    });
    ctx.db.role.findMany = vi.fn().mockResolvedValue([
      { id: "role_admin", name: "ADMIN", description: "Tenant administrator" },
      {
        id: "role_member",
        name: "MEMBER",
        description: "Standard tenant member",
      },
    ]);
    ctx.db.tenantMembership.create.mockResolvedValue({});

    // Added 'as any' to bypass the TS18046 unknown type error
    const result = (await createTenantFlow.execute(
      ALWAYS_GOOD_INPUT,
      ctx,
    )) as any;
    expect(result).toBeDefined();
    expect(result.tenant.name).toBe("Test Org");
  });

  it("allows unlimited creation on ENTERPRISE plan", async () => {
    const ctx = makeCtx({ plan: "ENTERPRISE" });
    ctx.db.tenantMembership.count.mockResolvedValue(99);
    ctx.db.tenant.findFirst.mockResolvedValue(null);
    ctx.db.tenant.create.mockResolvedValue({
      id: "t_99",
      name: "Unlimited Org",
      slug: "unlimited-org",
      sector: "technology",
      createdAt: new Date(),
    });
    ctx.db.role.findMany = vi.fn().mockResolvedValue([
      { id: "role_admin", name: "ADMIN", description: "Tenant administrator" },
      {
        id: "role_member",
        name: "MEMBER",
        description: "Standard tenant member",
      },
    ]);
    ctx.db.tenantMembership.create.mockResolvedValue({});

    // Added 'as any' to bypass the TS18046 unknown type error
    const result = (await createTenantFlow.execute(
      ALWAYS_GOOD_INPUT,
      ctx,
    )) as any;
    expect(result).toBeDefined();
    expect(result.tenant.name).toBe("Unlimited Org");
  });

  it("defaults to FREE cap when no plan is provided", async () => {
    const ctx = makeCtx({ plan: undefined });
    ctx.db.tenantMembership.count.mockResolvedValue(1);
    ctx.db.tenant.findFirst.mockResolvedValue(null);

    await expect(
      createTenantFlow.execute(ALWAYS_GOOD_INPUT, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TENANT_CAP_REACHED",
      message: expect.stringContaining("FREE"),
    });
  });

  it("requires an authenticated identity", async () => {
    const ctx = makeCtx({ identityId: undefined });

    await expect(
      createTenantFlow.execute(ALWAYS_GOOD_INPUT, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
