import { vi } from "vitest";

type DeepMock<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : DeepMock<T[K]>;
};

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

export function createMockDb() {
  const mock = {
    identity: modelProxy("identity"),
    session: modelProxy("session"),
    refreshToken: modelProxy("refreshToken"),
    accessToken: modelProxy("accessToken"),
    idToken: modelProxy("idToken"),
    client: modelProxy("client"),
    subscription: modelProxy("subscription"),
    localAccount: modelProxy("localAccount"),
    oAuthAccount: modelProxy("oAuthAccount"),
    role: modelProxy("role"),
    tenantMembership: modelProxy("tenantMembership"),
    decentralizedIdentifier: modelProxy("decentralizedIdentifier"),
    tenantSigningKey: modelProxy("tenantSigningKey"),
    bitstringStatusList: modelProxy("bitstringStatusList"),
    statusListEntry: modelProxy("statusListEntry"),
    verifiableCredential: modelProxy("verifiableCredential"),
    revokedJti: modelProxy("revokedJti"),
    emailToken: modelProxy("emailToken"),
    passkey: modelProxy("passkey"),
    mfa: modelProxy("mfa"),
    mfaRecoveryCode: modelProxy("mfaRecoveryCode"),
    tenantPolicy: modelProxy("tenantPolicy"),
    webhookEndpoint: modelProxy("webhookEndpoint"),
    webhookEvent: modelProxy("webhookEvent"),
    externalBillingIntegration: modelProxy("externalBillingIntegration"),
    externalIdentifier: modelProxy("externalIdentifier"),
    auditLog: modelProxy("auditLog"),
    $transaction: vi.fn(async (fn: (tx: any) => any) => fn(mock)),
    $disconnect: vi.fn(),
  } as any;

  return mock;
}

export function createMockFlowCtx(overrides: Record<string, any> = {}) {
  return {
    requestId: "test-request-id",
    tenantId: "SYSTEM",
    identityId: undefined,
    sessionId: undefined,
    ip: "127.0.0.1",
    userAgent: "vitest",
    db: createMockDb(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...overrides,
  } as any;
}
