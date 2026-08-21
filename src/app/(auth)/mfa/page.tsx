"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MfaDialog } from "@arcevo/facet-auth";
import { useAuth } from "@/hooks/use-auth";

export default function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? undefined;

  return (
    <MfaDialog
      open={true}
      client={useAuth().client}
      sessionId={sessionId ?? ""}
      onComplete={() => router.replace("/console")}
      onCancel={() => router.replace("/console")}
    />
  );
}
