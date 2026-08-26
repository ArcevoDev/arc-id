import { buildMetadata } from "@/components/metadata";
import { HomeContent } from "./_components/home-content";

export const metadata = buildMetadata({
  title: "ArcID - Sovereign identity platform",
  description: "OIDC provider, WebAuthn passkeys, TOTP MFA, SD-JWT verifiable credentials, and did:web for the decentralized web.",
  path: "/home",
});

export default function HomePage() {
  return <HomeContent />;
}
