import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth.store";

// Regression tests for the auth store's isAuthenticated handling:
// setTokens must mark the user authenticated (token bundles mean a
// successful auth), and clearAuth must reset everything.

const user = { id: "u-1", email: "a@b.c", name: "A", memberships: [] };

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("setAuth marks the session authenticated", () => {
    useAuthStore.getState().setAuth(user, "at-1", "rt-1");
    const s = useAuthStore.getState();
    expect(s.user).toEqual(user);
    expect(s.accessToken).toBe("at-1");
    expect(s.refreshToken).toBe("rt-1");
    expect(s.isAuthenticated).toBe(true);
  });

  it("setTokens marks the session authenticated even without a prior user", () => {
    useAuthStore.getState().setTokens("at-1", "rt-1");
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("at-1");
    expect(s.refreshToken).toBe("rt-1");
    expect(s.isAuthenticated).toBe(true);
  });

  it("setTokens keeps an existing refresh token when none is provided", () => {
    useAuthStore.getState().setTokens("at-1", "rt-1");
    useAuthStore.getState().setTokens("at-2");
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("at-2");
    expect(s.refreshToken).toBe("rt-1");
    expect(s.isAuthenticated).toBe(true);
  });

  it("setUser does not authenticate a user without tokens", () => {
    useAuthStore.getState().setUser(user);
    const s = useAuthStore.getState();
    expect(s.user).toEqual(user);
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
  });

  it("clearAuth resets the full session", () => {
    useAuthStore.getState().setAuth(user, "at-1", "rt-1");
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });
});
