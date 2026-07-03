// src/lib/ui/metadata.ts
//
// Single source of truth for ArcID's identity strings — name, tagline,
// description, OG/Twitter defaults, brand URLs. `src/app/layout.tsx` derives
// its root `Metadata` export from this. Per-page `generateMetadata()` should
// use `buildMetadata({ title, description, path })` rather than redefining
// these strings, so a brand-copy change is a one-file edit.

export const ArcMetadata = {
  name: "ArcID",
  shortName: "ArcID",
  tagline: "Sovereign Identity Engine",

  description:
    "Enterprise identity, credentials, and access management for Web2 and Web3.",

  // Longer-form description used for SEO/OG — keep description short
  // (used in <head> meta + UI copy), this is for social previews.
  longDescription:
    "ArcID is a sovereign identity infrastructure platform. Multi-tenant " +
    "OAuth2/OIDC, W3C Verifiable Credentials, DID:web, passkeys, and " +
    "enterprise SSO — built for African and global deployments.",

  keywords: [
    "identity platform",
    "OAuth2",
    "OIDC",
    "verifiable credentials",
    "decentralized identity",
    "DID",
    "passkeys",
    "WebAuthn",
    "multi-tenant IAM",
    "enterprise SSO",
    "Africa identity",
    "ArcID",
    "ArcevoCirqle",
  ],

  version: "1.0.0-alpha",

  org: {
    name: "ArcevoCirqle",
    url: "https://arcevocirqle.com.ng",
  },

  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://arcid.arcevocirqle.com.ng",
  ogImage: "/og-image.png",
  twitterHandle: "@arcevocirqle",
  locale: "en_NG",

  themeColor: "#0f1117",
} as const;

// ── Per-page metadata helper ────────────────────────────────────────────────
// Use in a page's `generateMetadata()`:
//
//   export function generateMetadata() {
//     return buildMetadata({ title: "Sessions", description: "Manage your active sessions." });
//   }
//
// `title` is run through the root `template: "%s · ArcID"` automatically —
// don't append "· ArcID" yourself.
interface BuildMetadataOptions {
  title?: string;
  description?: string;
  path?: string; // e.g. "/security/sessions" — used for canonical/OG url
}

export function buildMetadata({
  title,
  description,
  path,
}: BuildMetadataOptions = {}) {
  const resolvedTitle = title ?? ArcMetadata.tagline;
  const resolvedDescription = description ?? ArcMetadata.description;
  const url = path ? `${ArcMetadata.url}${path}` : ArcMetadata.url;

  return {
    title,
    description: resolvedDescription,
    openGraph: {
      title: title ? `${title} · ${ArcMetadata.name}` : ArcMetadata.name,
      description: resolvedDescription,
      url,
    },
    twitter: {
      title: title ? `${title} · ${ArcMetadata.name}` : ArcMetadata.name,
      description: resolvedDescription,
    },
    alternates: { canonical: url },
  };
}
