"use client";

import { Icons } from "@/lib/ui/icon-registry";

export default function VerifyEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <Icons.success className="h-12 w-12 text-primary mx-auto" />
      <h1 className="text-xl font-bold text-foreground">Email verified</h1>
      <p className="text-sm text-muted-foreground">
        Your email has been verified successfully.
      </p>
      <a href="/login" className="text-primary hover:underline text-sm">
        Sign in
      </a>
    </div>
  );
}
