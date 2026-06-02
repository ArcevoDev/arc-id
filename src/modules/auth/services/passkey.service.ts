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

  /**
   * Generates secure WebAuthn registration options for a new Passkey key-pair
   */
  async generateRegistrationOptions(identityId: string, email: string) {
    const existing = await this.db.passkey.findMany({ where: { identityId } });

    return generateRegistrationOptions({
      rpID: config.auth.webauthn.rpId,
      rpName: config.auth.webauthn.rpName,
      // Fix: ISO-standard stable byte array encoding for CUID string identification
      userID: new TextEncoder().encode(identityId),
      userName: email,
      userDisplayName: email,
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        // Prisma stores JSON arrays as JsonValue; safely cast to standard WebAuthn transports
        transports: (p.transports as unknown as AuthenticatorTransport[]) ?? [],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
  }

  /**
   * Validates a device's cryptographic attestation payload and records the public key
   */
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
        // Node's Buffer fits perfectly into Prisma's standard Bytes data type field mapping
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: response.response?.transports ?? [],
      },
    });

    return { verified: true };
  }

  /**
   * Generates WebAuthn authentication options (assertions) to challenge a returning client
   */
  async generateAuthenticationOptions(identityId?: string) {
    const allowCredentials = identityId
      ? await this.db.passkey.findMany({ where: { identityId } })
      : [];

    return generateAuthenticationOptions({
      rpID: config.auth.webauthn.rpId,
      userVerification: "preferred",
      allowCredentials: allowCredentials.map((p) => ({
        id: p.credentialId,
        transports: (p.transports as unknown as AuthenticatorTransport[]) ?? [],
      })),
    });
  }

  /**
   * Verifies an authentication assertion signature against the user's registered public key
   */
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
        publicKey: passkey.publicKey, // Prisma Bytes passes back raw Buffer automatically
        counter: passkey.counter,
        transports:
          (passkey.transports as unknown as AuthenticatorTransport[]) ?? [],
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
