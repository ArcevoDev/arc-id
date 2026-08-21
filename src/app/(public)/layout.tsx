"use client";

import Link from "next/link";
import { LandingLayout } from "@arcevo/facet-layout";
import { Navbar, Footer, Button } from "@arcevo/facet-components";
import { HomeHero } from "./home/_components/home-hero";

const navLinks = [
  { label: "Features", href: "#features" },
  {
    label: "Documentation",
    href: "https://docs.arcevo.id",
    external: true,
  },
];

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Console", href: "/console" },
      { label: "WebAuthn", href: "#features" },
      { label: "Credentials", href: "#features" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "https://docs.arcevo.id" },
      { label: "GitHub", href: "https://github.com/arcevo", external: true },
      { label: "API Reference", href: "https://docs.arcevo.id/api" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "https://blog.arcevo.id" },
      { label: "Contact", href: "/feedback" },
      { label: "Status", href: "https://status.arcevo.id" },
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
      nav={
        <Navbar
          variant="pill"
          brand="ArcID"
          showThemeToggle
          links={navLinks}
          actions={
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
          }
        />
      }
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
