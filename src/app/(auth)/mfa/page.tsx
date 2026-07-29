"use client";

import { Suspense } from "react";
import { MfaForm } from "@/components/auth/mfa-form";
import { Icons } from "@/lib/ui/icon-registry";

export default function MfaPage() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Icons.lock className="h-10 w-10 text-primary mx-auto mb-2" />
        <h1 className="text-xl font-bold text-foreground">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the code from your authenticator app
        </p>
      </div>
      <Suspense fallback={null}>
        <MfaForm />
      </Suspense>
    </div>
  );
}
