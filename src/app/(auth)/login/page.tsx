"use client";

import Link from "next/link";
import { SignIn } from "@arcevo/facet-auth";
import { usePostAuthRedirect } from "@/hooks/use-post-auth-redirect";
import { socialAuthUrl } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/auth.store";

export default function LoginPage() {
  const redirect = usePostAuthRedirect();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to ArcID</p>
      </div>

      <SignIn
        validate
        onOAuth={(provider) => {
          // provider is "google" | "github" etc. - redirect to the backend
          // OAuth URL. The callback returns to this page on error.
          if (provider === "google" || provider === "github") {
            window.location.href = socialAuthUrl(provider);
          }
        }}
        onSuccess={() => {
          // ArcProvider onAuthChange already synced the store - route by
          // the resolved user's memberships.
          redirect(useAuthStore.getState().user);
        }}
      />

      <p className="text-center text-sm">
        <Link href="/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
