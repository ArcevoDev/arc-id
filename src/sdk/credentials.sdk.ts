// src/sdk/credentials.sdk.ts
import { sdk } from "./client";

export const credentialsSdk = {
  issue: (data: any) => sdk.post<any>("/api/v1/credentials/issue", data),
  verify: (credential: string) =>
    sdk.post<any>("/api/v1/credentials/verify", { credential }),
  revoke: (id: string, reason?: string) =>
    sdk.post<void>(`/api/v1/credentials/${id}/revoke`, { reason }),
};
