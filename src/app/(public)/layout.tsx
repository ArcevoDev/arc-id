"use client";

import Link from "next/link";
import { LandingLayout } from "@arcevo/facet-layout";
import { Badge, Button, Icon } from "@arcevo/facet-components";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Public site shell - shared hero, nav, and footer around LandingLayout.
 * Used by /home (landing), /feedback, and future public pages.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingLayout
      hero={
        <section className="mx-auto max-w-6xl px-6 py-16 text-center space-y-6">
          <Badge variant="secondary" className="mx-auto">
            Sovereign identity for the ArcevoCirqle ecosystem
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            One identity.
            <br />
            <span className="text-primary">Verified once, trusted everywhere.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            ArcID is a sovereign multi-tenant identity and access management engine.
            Issue a verifiable credential once - let the holder present it anywhere
            it is trusted, without re-exposing the underlying documents.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>
      }
      nav={
        <nav className="flex items-center gap-6 px-6 py-4">
          <Link href="/home" className="flex items-center gap-2">
            <Icon name="shield" className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">ArcID</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/home#features" className="hover:text-foreground">Features</Link>
            <Link href="/home#sectors" className="hover:text-foreground">Sectors</Link>
            <Link href="/feedback" className="hover:text-foreground">Feedback</Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </nav>
      }
      footer={
        <footer className="border-t py-8 px-6">
          <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Icon name="shield" className="h-5 w-5" />
              <span>ArcID - Sovereign Identity Engine</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/home#features" className="hover:text-foreground">Features</Link>
              <Link href="/home#sectors" className="hover:text-foreground">Sectors</Link>
              <Link href="/feedback" className="hover:text-foreground">Feedback</Link>
            </div>
          </div>
        </footer>
      }
    >
      {children}
    </LandingLayout>
  );
}
