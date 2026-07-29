"use client";

/**
 * API keys hook.
 *
 * No backend API key routes exist yet — the device.route.ts covers hardware
 * device authorization status, not API keys. This hook is a stub that returns
 * empty-state responses. Wire to a real SDK once the backend implements
 * api-key CRUD routes.
 */

export function useApiKeys() {
  const list = async () => ({
    data: [],
    error: null,
  } as const);

  const create = async (_data: { name: string }) =>
    ({
      data: null,
      error: { statusCode: 501, error: "Not Implemented", message: "API key management is not implemented yet" },
    } as const);

  const revoke = async (_id: string) =>
    ({
      data: null,
      error: { statusCode: 501, error: "Not Implemented", message: "API key management is not implemented yet" },
    } as const);

  return { list, create, revoke };
}
