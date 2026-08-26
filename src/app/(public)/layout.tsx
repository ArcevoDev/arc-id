"use client";

import { LandingLayout } from "@arcevo/facet-layout";
import { Footer } from "@arcevo/facet-components";
import { PublicNavbar } from "@/components/public-navbar";
import { HomeHero } from "./home/_components/home-hero";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Console", href: "/console" },
      { label: "WebAuthn", href: "/home" },
      { label: "Credentials", href: "/home" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "GitHub", href: "https://github.com/arcevo", external: true },
      { label: "API Reference", href: "/docs/api" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/feedback" },
      { label: "Status", href: "/feedback" },
    ],
  },
];

export default function PublicRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LandingLayout
      nav={<PublicNavbar />}
      hero={<HomeHero />}
      footer={
        <Footer
          brand={{ name: "ArcID", tagline: "Sovereign identity infrastructure" }}
          columns={footerColumns}
          socials={[
            {
              label: "GitHub",
              href: "https://github.com/arcevo",
              icon: "github",
            },
            {
              label: "Twitter",
              href: "https://twitter.com/arcevoid",
              icon: "twitter",
            },
          ]}
          legal="© 2025 Arcevo. All rights reserved."
        />
      }
    >
      {children}
    </LandingLayout>
  );
}
