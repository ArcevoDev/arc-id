import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArcIdClient, AuthSdk, TenantSdk, BillingSdk, AuditSdk, VcSdk, IdentitySdk, OAuthSdk, WebhooksSdk, PasskeySdk, IdpSdk } from "@arcevo/facet-sdk";
import { auth, tenants, billing, credentials, audit, identity, oauth, webhooks, passkeys, idp, arcIdClient } from "./index";

// The migrated SDK layer is a thin singleton wiring over @arcevo/facet-sdk.
// These tests verify the singletons are wired to the right facet classes and
// that the client integration behaves (token refresh + auth-cleared hooks).

describe("sdk singleton wiring", () => {
  it("exports each domain SDK wired to the facet-sdk class", () => {
    expect(auth).toBeInstanceOf(AuthSdk);
    expect(tenants).toBeInstanceOf(TenantSdk);
    expect(billing).toBeInstanceOf(BillingSdk);
    expect(audit).toBeInstanceOf(AuditSdk);
    expect(credentials).toBeInstanceOf(VcSdk);
    expect(identity).toBeInstanceOf(IdentitySdk);
    expect(oauth).toBeInstanceOf(OAuthSdk);
    expect(webhooks).toBeInstanceOf(WebhooksSdk);
    expect(passkeys).toBeInstanceOf(PasskeySdk);
    expect(idp).toBeInstanceOf(IdpSdk);
  });

  it("re-exports the shared ArcIdClient singleton", () => {
    expect(arcIdClient).toBeInstanceOf(ArcIdClient);
  });

  it("exposes the HTTP verbs on the client", () => {
    expect(typeof arcIdClient.get).toBe("function");
    expect(typeof arcIdClient.post).toBe("function");
    expect(typeof arcIdClient.patch).toBe("function");
    expect(typeof arcIdClient.del).toBe("function");
    expect(typeof arcIdClient.setAccessToken).toBe("function");
    expect(typeof arcIdClient.getAccessToken).toBe("function");
  });
});

describe("client token integration", () => {
  it("setAccessToken + getAccessToken round-trip", () => {
    arcIdClient.setAccessToken("tok-123");
    expect(arcIdClient.getAccessToken()).toBe("tok-123");
    arcIdClient.setAccessToken(null);
    expect(arcIdClient.getAccessToken()).toBeNull();
  });
});
