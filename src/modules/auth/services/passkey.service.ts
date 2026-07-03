// src/modules/auth/services/passkey.service.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { DbClient } from "@/lib/db-client";
import { config } from "@/core/config";

export class PasskeyService {
  constructor(private db: DbClient) {}

  async generateRegistrationOptions(identityId: string, email: string) {
    const existing = await this.db.passkey.findMany({ where: { identityId } });

    return generateRegistrationOptions({
      rpID: config.auth.webauthn.rpId,
      rpName: config.auth.webauthn.rpName,
      userID: new TextEncoder().encode(identityId),
      userName: email,
      userDisplayName: email,
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: p.transports as any, // Cast cleanly to bypass deprecated type package
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
  }

  async verifyRegistration(
    identityId: string,
    response: any,
    challenge: string,
  ) {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.auth.webauthn.origin,
      expectedRPID: config.auth.webauthn.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false };
    }

    const { credential } = verification.registrationInfo;

    await this.db.passkey.create({
      data: {
        identityId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: response.response?.transports ?? [],
      },
    });

    return { verified: true };
  }

  async generateAuthenticationOptions(identityId?: string) {
    const allowCredentials = identityId
      ? await this.db.passkey.findMany({ where: { identityId } })
      : [];

    return generateAuthenticationOptions({
      rpID: config.auth.webauthn.rpId,
      userVerification: "preferred",
      allowCredentials: allowCredentials.map((p) => ({
        id: p.credentialId,
        transports: p.transports as any,
      })),
    });
  }

  async verifyAuthentication(response: any, challenge: string) {
    const passkey = await this.db.passkey.findUnique({
      where: { credentialId: response.id },
    });
    if (!passkey) {
      return { verified: false, passkey: null };
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.auth.webauthn.origin,
      expectedRPID: config.auth.webauthn.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
    });

    if (verification.verified && verification.authenticationInfo) {
      await this.db.passkey.update({
        where: { id: passkey.id },
        data: {
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        },
      });
    }

    return { verified: verification.verified, passkey };
  }
}
