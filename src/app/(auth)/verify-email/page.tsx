// src/app/(auth)/verify-email/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authSdk } from "@/sdk/auth.sdk";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";

type State = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("verifying");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMsg("No verification token found. Check your email link.");
      return;
    }
    authSdk
      .verifyEmail(token)
      .then(() => setState("success"))
      .catch((err: any) => {
        setState("error");
        setMsg(
          err.message ?? "Verification failed. The link may have expired.",
        );
      });
  }, [token]);

  if (state === "verifying") {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <Icons.refresh className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Icons.success className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Email verified
          </h1>
          <p className="text-sm text-muted-foreground">
            Your email has been confirmed. You can now sign in.
          </p>
        </div>
        <Button className="w-full" onClick={() => router.replace("/login")}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
        <Icons.error className="w-6 h-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Verification failed
        </h1>
        <p className="text-sm text-muted-foreground">{msg}</p>
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.replace("/login")}
      >
        Back to sign in
      </Button>
    </div>
  );
}
