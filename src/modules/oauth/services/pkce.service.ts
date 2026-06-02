import { createHash } from "crypto";

export function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): boolean {
  if (method === "S256") {
    const computed = createHash("sha256").update(verifier).digest("base64url");
    return computed === challenge;
  }
  // plain — strongly discouraged but spec-compliant
  return verifier === challenge;
}
