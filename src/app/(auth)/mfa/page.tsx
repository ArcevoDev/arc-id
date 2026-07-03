// src/app/(auth)/mfa/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authSdk } from "@/sdk/auth.sdk";
import { useAuth } from "@/hooks/use-auth";
import { Icons } from "@/lib/ui/icon-registry";
import { TOKEN_KEYS } from "@/sdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export default function MfaPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [useRecovery]);

  const sessionId =
    typeof window !== "undefined"
      ? sessionStorage.getItem(TOKEN_KEYS.mfaState)
      : null;

  // Guard: if no sessionId, redirect to login
  useEffect(() => {
    if (!sessionId) router.replace("/login");
  }, [sessionId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setError(null);
    setLoading(true);
    try {
      const data = useRecovery
        ? await authSdk.verifyMfaRecovery(code.trim().toUpperCase(), sessionId)
        : await authSdk.verifyMfa(code.trim(), sessionId);

      sessionStorage.removeItem(TOKEN_KEYS.mfaState);
      setTokens(
        data.accessToken,
        data.refreshToken,
        data.identity,
        data.sessionId,
      );
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Verification failed. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
          <Icons.lock className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Two-factor verification
        </h1>
        <p className="text-sm text-muted-foreground">
          {useRecovery
            ? "Enter one of your backup recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="text-sm flex items-start gap-2">
          <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">
            {useRecovery ? "Recovery code" : "Authenticator code"}
          </Label>
          <Input
            ref={inputRef}
            id="code"
            type="text"
            inputMode={useRecovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
            maxLength={useRecovery ? 16 : 6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="tracking-[0.3em] text-center text-lg font-mono"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || code.length < 6}
        >
          {loading ? (
            <>
              <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify"
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseRecovery((v) => !v);
          setCode("");
          setError(null);
        }}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {useRecovery
          ? "Use authenticator app instead"
          : "Use a recovery code instead"}
      </button>

      <button
        type="button"
        onClick={() => router.replace("/login")}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
      >
        <Icons.arrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </button>
    </div>
  );
}
