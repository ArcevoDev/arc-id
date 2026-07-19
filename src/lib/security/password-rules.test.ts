import { describe, it, expect } from "vitest";
import { validatePassword, enforceSystemPasswordRules } from "./password-rules";
import { createMockDb } from "@/test-utils/mock-db";

describe("validatePassword", () => {
  it("returns no errors when rules are undefined", () => {
    expect(validatePassword("anything", undefined)).toEqual([]);
  });

  it("enforces minLength", () => {
    const errors = validatePassword("short", { minLength: 12 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/at least 12 characters/);
  });

  it("enforces requireUppercase / requireLowercase / requireNumber / requireSymbol independently", () => {
    expect(
      validatePassword("alllowercase1!", { requireUppercase: true }),
    ).toHaveLength(1);
    expect(
      validatePassword("ALLUPPERCASE1!", { requireLowercase: true }),
    ).toHaveLength(1);
    expect(
      validatePassword("NoDigitsHere!", { requireNumber: true }),
    ).toHaveLength(1);
    expect(
      validatePassword("NoSymbolsHere1", { requireSymbol: true }),
    ).toHaveLength(1);
  });

  it("passes a password satisfying all rules", () => {
    const errors = validatePassword("Str0ng!Password", {
      minLength: 10,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: true,
    });
    expect(errors).toEqual([]);
  });

  it("accumulates multiple violations", () => {
    const errors = validatePassword("weak", {
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
    });
    expect(errors).toHaveLength(3);
  });
});

describe("enforceSystemPasswordRules — closes the passwordRules silent no-op", () => {
  it("does nothing when the SYSTEM tenant has no policy row", async () => {
    const db = createMockDb();
    db.tenantPolicy.findUnique.mockResolvedValue(null);
    await expect(
      enforceSystemPasswordRules(db, "anything"),
    ).resolves.toBeUndefined();
  });

  it("does nothing when the policy exists but passwordRules is unset", async () => {
    const db = createMockDb();
    db.tenantPolicy.findUnique.mockResolvedValue({ passwordRules: null });
    await expect(
      enforceSystemPasswordRules(db, "anything"),
    ).resolves.toBeUndefined();
  });

  it("REGRESSION: rejects a password violating the SYSTEM tenant's stored passwordRules", async () => {
    const db = createMockDb();
    db.tenantPolicy.findUnique.mockResolvedValue({
      passwordRules: { minLength: 16, requireSymbol: true },
    });

    await expect(
      enforceSystemPasswordRules(db, "short1"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(db.tenantPolicy.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "SYSTEM" } }),
    );
  });

  it("allows a password satisfying the stored passwordRules", async () => {
    const db = createMockDb();
    db.tenantPolicy.findUnique.mockResolvedValue({
      passwordRules: { minLength: 8 },
    });
    await expect(
      enforceSystemPasswordRules(db, "longenoughpassword"),
    ).resolves.toBeUndefined();
  });

  it("fails safe (no enforcement) if passwordRules JSON is malformed rather than throwing on bad data", async () => {
    const db = createMockDb();
    db.tenantPolicy.findUnique.mockResolvedValue({
      passwordRules: { minLength: "not-a-number" },
    });
    // Malformed stored data shouldn't crash registration/reset — Zod
    // safeParse fails, rules end up undefined, nothing enforced.
    await expect(enforceSystemPasswordRules(db, "x")).resolves.toBeUndefined();
  });
});
