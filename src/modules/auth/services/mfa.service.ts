import { createRequire } from "module";
const require = createRequire(import.meta.url);
// 🏎️ Explicitly pull via standard require to bridge the CJS/ESM compilation gap perfectly
const { authenticator } = require("otplib");

import QRCode from "qrcode";
import type { DbClient } from "@/lib/db-client";
import { sha256, generateToken } from "@/lib/crypto";

/**
 * TOTP operations via otbatim / otplib layer tracking.
 * EMAIL and SMS codes are hashed and stored as EmailToken records.
 */
export class MfaService {
  constructor(private db: DbClient) {}

  // ── TOTP ──────────────────────────────────────────────────────────────────

  generateTotpSecret(): string {
    return authenticator.generateSecret();
  }

  totpUri(secret: string, email: string, issuer = "ArcID"): string {
    return authenticator.keyuri(email, issuer, secret);
  }

  verifyTotp(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  // ── Recovery codes ────────────────────────────────────────────────────────

  async generateRecoveryCodes(
    identityId: string,
    count = 10,
  ): Promise<string[]> {
    // Invalidate any existing unused codes first
    await this.db.mfaRecoveryCode.updateMany({
      where: { identityId, used: false },
      data: { used: true, usedAt: new Date() },
    });

    const codes: string[] = [];
    const records = [];

    for (let i = 0; i < count; i++) {
      const plain = generateToken(16).toUpperCase().slice(0, 32);
      codes.push(plain);
      records.push({ identityId, codeHash: sha256(plain) });
    }

    await this.db.mfaRecoveryCode.createMany({ data: records });
    return codes; // Returned ONCE in plaintext — never stored
  }

  async consumeRecoveryCode(
    identityId: string,
    code: string,
  ): Promise<boolean> {
    const hash = sha256(code.trim().toUpperCase());
    const record = await this.db.mfaRecoveryCode.findFirst({
      where: { identityId, codeHash: hash, used: false },
    });
    if (!record) return false;

    await this.db.mfaRecoveryCode.update({
      where: { id: record.id },
      data: { used: true, usedAt: new Date() },
    });
    return true;
  }

  // ── TOTP setup ────────────────────────────────────────────────────────────

  async setupTotp(identityId: string, email: string) {
    const secret = this.generateTotpSecret();
    const uri = this.totpUri(secret, email);

    // ✨ Added: Generate clean visual QR code vector image payload stream
    const qrCodeDataUrl = await QRCode.toDataURL(uri, {
      margin: 2,
      width: 300,
      color: {
        dark: "#0F172A", // Clean premium dark slate palette matching your ecosystem theme
        light: "#FFFFFF",
      },
    });

    // Store as disabled until user confirms first code
    await this.db.mfa.create({
      data: { identityId, type: "TOTP", secret, enabled: false },
    });

    // Returning both structural parameters alongside the renderable frontend base64 image
    return { secret, uri, qrCode: qrCodeDataUrl };
  }

  async confirmTotp(identityId: string, code: string): Promise<boolean> {
    const mfa = await this.db.mfa.findFirst({
      where: { identityId, type: "TOTP", enabled: false },
    });
    if (!mfa?.secret) return false;

    const valid = this.verifyTotp(mfa.secret, code);
    if (!valid) return false;

    await this.db.mfa.update({
      where: { id: mfa.id },
      data: { enabled: true },
    });
    return true;
  }
}
