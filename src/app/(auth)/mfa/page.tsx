"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MfaDialog } from "@arcevo/facet-auth";
import { Icon } from "@/components/ui/icon";
import { useArcIdClient } from "@/hooks/use-arc-id-client";
import { resolvePostAuthRoute } from "@/hooks/use-post-auth-redirect";
import { useAuthStore } from "@/store/auth.store";

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaContent />
    </Suspense>
  );
}

function MfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";
  const [open, setOpen] = useState(Boolean(sessionId));
  const client = useArcIdClient();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Icon name="lock" className="h-10 w-10 text-primary mx-auto mb-2" />
        <h1 className="text-xl font-bold text-foreground">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the code from your authenticator app
        </p>
      </div>
      <MfaDialog
        open={open}
        onOpenChange={setOpen}
        client={client}
        sessionId={sessionId}
        onComplete={() => router.push(resolvePostAuthRoute(useAuthStore.getState().user))}
        onCancel={() => router.push("/login")}
      />
    </div>
  );
}
