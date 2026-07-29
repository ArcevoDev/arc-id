"use client";

import { Icons } from "@/lib/ui/icon-registry";

/**
 * Auth shell — split-panel on large screens, centered card on mobile.
 * Used for login, register, forgot-password, reset-password, mfa.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── LEFT PANEL — hidden below lg ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#0A1A2F] p-8">
        <div className="flex flex-col gap-8">
          {/* Logo + Product Name */}
          <div className="flex items-center gap-3">
            <Icons.shield className="h-10 w-10 text-[#4AD3F5]" />
            <span
              className="font-heading text-2xl font-bold text-white"
            >
              ArcID
            </span>
          </div>

          {/* Tagline */}
          <p className="text-lg text-white/80">
            Sovereign Identity Engine
          </p>

          {/* Benefit statements */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Icons.check className="h-4 w-4 text-[#4AD3F5]" />
              <span className="text-sm text-white/70">Passkey-native authentication</span>
            </div>
            <div className="flex items-center gap-3">
              <Icons.check className="h-4 w-4 text-[#4AD3F5]" />
              <span className="text-sm text-white/70">Multi-tenant by design</span>
            </div>
            <div className="flex items-center gap-3">
              <Icons.check className="h-4 w-4 text-[#4AD3F5]" />
              <span className="text-sm text-white/70">Verifiable Credentials built-in</span>
            </div>
            <div className="flex items-center gap-3">
              <Icons.check className="h-4 w-4 text-[#4AD3F5]" />
              <span className="text-sm text-white/70">WebAuthn + TOTP MFA</span>
            </div>
          </div>

          {/* TODO: Replace with Lottie/video animation for production */}
        </div>

        {/* Ecosystem branding */}
        <p className="text-xs text-[#D4AF37]">
          ArcevoCirqle Ecosystem
        </p>
      </div>

      {/* ── RIGHT PANEL — centered card ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-4 lg:p-8">
        {/* Mobile-only logo row (hidden on lg+) */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <Icons.shield className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-foreground">ArcID</h1>
          <p className="text-sm text-muted-foreground">Sovereign Identity Engine</p>
        </div>

        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
