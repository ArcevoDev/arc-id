"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LandingLayout } from "@arcevo/facet-layout";
import { Badge, Button, Footer, Icon, Navbar } from "@arcevo/facet-components";
import { TypewriterText } from "@/components/ui/typewriter-text";

const LINKS = [
  { href: "/home#features", label: "Features" },
  { href: "/home#sectors", label: "Sectors" },
  { href: "/home#audience", label: "Who it's for" },
  { href: "/feedback", label: "Feedback" },
];

/**
 * Public site shell - facet Navbar (pill) + Footer around LandingLayout,
 * with the glassmorphism hero.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <LandingLayout
      hero={
        <div className="relative flex flex-col items-center text-center px-6 py-20">
          {/* Tech grid background (fades toward the edges) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
            }}
          />
          {/* Soft glow behind the headline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at center, oklch(0.58 0.23 273 / 25%), transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary text-xs tracking-wider uppercase px-4 py-1">
            Sovereign identity for the ArcevoCirqle ecosystem
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl">
            <span className="text-foreground">One identity.</span>
            <br />
            <TypewriterText
              className="text-gradient"
              phrases={[
                "Verified once, trusted everywhere.",
                "A key that opens every door.",
                "Your story, told in credentials.",
                "Sovereign across every sector.",
              ]}
            />
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            ArcID is a sovereign multi-tenant identity and access management engine.
            Issue a verifiable credential once - let the holder carry it anywhere
            it is trusted, without re-exposing the underlying documents.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 whitespace-nowrap"
              >
                Begin your journey
                <Icon name="arrow-right" size={16} className="shrink-0" />
              </Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link href="/login">Welcome back</Link>
            </Button>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "OAuth2 + OIDC", label: "Provider" },
              { value: "SD-JWT", label: "Credentials" },
              { value: "Multi-tenant", label: "By design" },
              { value: "Passkey", label: "Native auth" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl px-4 py-6 text-center">
                <div className="text-lg font-bold text-foreground">{stat.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
      nav={
        <Navbar
          variant="pill"
          brand={
            <Link href="/home" className="flex items-center gap-2">
              <Icon name="shield" className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">ArcID</span>
            </Link>
          }
          links={LINKS.map((l) => ({
            href: l.href,
            label: l.label,
            active: pathname === l.href.split("#")[0],
          }))}
          router={{
            Link: (props: React.ComponentProps<typeof Link>) => <Link {...props} />,
            isActive: (href: string) => pathname === href.split("#")[0],
          }}
          actions={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          }
        />
      }
      footer={
        <Footer
          brand={{
            name: "ArcID",
            logo: <Icon name="shield" className="h-5 w-5" />,
            tagline: "Sovereign Identity Engine",
          }}
          columns={[
            {
              title: "Product",
              links: [
                { label: "Features", href: "/home#features" },
                { label: "Sectors", href: "/home#sectors" },
                { label: "Who it's for", href: "/home#audience" },
              ],
            },
            {
              title: "Company",
              links: [{ label: "Feedback", href: "/feedback" }],
            },
          ]}
          bottomLinks={[
            { label: "Features", href: "/home#features" },
            { label: "Sectors", href: "/home#sectors" },
            { label: "Feedback", href: "/feedback" },
          ]}
        />
      }
    >
      {children}
    </LandingLayout>
  );
}
