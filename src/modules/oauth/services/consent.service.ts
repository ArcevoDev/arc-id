import type { DbClient } from "@/lib/db-client";

export class ConsentService {
  constructor(private db: DbClient) {}

  async hasConsent(
    identityId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    const consent = await this.db.oAuthConsent.findFirst({
      where: { identityId, clientId, revokedAt: null },
    });
    if (!consent) return false;
    const granted = consent.scopes as string[];
    return requestedScopes.every((s) => granted.includes(s));
  }

  async grant(identityId: string, clientId: string, scopes: string[]) {
    // Check if consent already exists
    const existing = await this.db.oAuthConsent.findFirst({
      where: { identityId, clientId },
    });

    if (existing) {
      return this.db.oAuthConsent.update({
        where: { id: existing.id },
        data: { scopes, revokedAt: null, grantedAt: new Date() },
      });
    }

    return this.db.oAuthConsent.create({
      data: { identityId, clientId, scopes },
    });
  }

  async revoke(identityId: string, clientId: string) {
    return this.db.oAuthConsent.updateMany({
      where: { identityId, clientId },
      data: { revokedAt: new Date() },
    });
  }
}
