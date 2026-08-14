"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MfaDialog } from "@arcevo/facet-auth";
import { Icon } from "@arcevo/facet-components";
import { arcIdClient } from "@/sdk";

export default function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";
  const [open, setOpen] = useState(Boolean(sessionId));

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Icon name="lock" className="h-10 w-10 text-primary mx-auto mb-2" />
        <h1 className="text-xl font-bold text-foreground">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the code from your authenticator app
        </p>
      </div>
      <Suspense fallback={null}>
        <MfaDialog
          open={open}
          onOpenChange={setOpen}
          client={arcIdClient}
          sessionId={sessionId}
          onComplete={() => router.push("/dashboard")}
          onCancel={() => router.push("/login")}
        />
      </Suspense>
    </div>
  );
}
