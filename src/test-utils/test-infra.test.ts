import { describe, it, expect } from "vitest";
import { config } from "@/core/config";
import { createMockDb, createMockFlowCtx } from "./mock-db";

describe("test infrastructure", () => {
  it("config loads in test env", () => {
    expect(config.base.env).toBe("test");
    expect(config.base.isTest).toBe(true);
    expect(config.security.jwt.secret).toBeTruthy();
  });

  it("createMockDb returns a mock with vi.fn() methods", () => {
    const db = createMockDb();
    expect(db.identity.findUnique).toBeDefined();
    expect(db.identity.findUnique).toBeInstanceOf(Function);
    expect(db.identity.count).toBeDefined();
    expect(db.session.create).toBeDefined();
    expect(db.refreshToken.updateMany).toBeDefined();
    expect(db.$transaction).toBeDefined();
    db.identity.findUnique.mockResolvedValue({ id: "test-id" });
    expect(db.identity.findUnique).toHaveBeenCalledTimes(0); // lazy proxy
  });

  it("createMockFlowCtx includes defaults", () => {
    const ctx = createMockFlowCtx();
    expect(ctx.requestId).toBe("test-request-id");
    expect(ctx.tenantId).toBe("SYSTEM");
    expect(ctx.ip).toBe("127.0.0.1");
    expect(ctx.db).toBeDefined();
    expect(ctx.db.identity.findUnique).toBeDefined();
  });

  it("createMockFlowCtx merges overrides", () => {
    const ctx = createMockFlowCtx({
      identityId: "override-id",
      tenantId: "TENANT_X",
    });
    expect(ctx.identityId).toBe("override-id");
    expect(ctx.tenantId).toBe("TENANT_X");
    expect(ctx.ip).toBe("127.0.0.1"); // default preserved
  });
});
