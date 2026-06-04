"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import { setToken, setRefreshToken } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";

function MfaForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await auth.verifyMfa(code, sessionId);
      const t = res.data?.access_token ?? res.data?.token;
      if (t) {
        setToken(t);
        if (res.data?.refresh_token) setRefreshToken(res.data.refresh_token);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <div className="text-3xl mb-3">🛡️</div>
      <h2 className="text-xl font-semibold mb-1">Two-factor verification</h2>
      <p className="text-sm text-zinc-500 mb-6">Enter the 6-digit code from your authenticator app</p>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Authentication code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} pattern="[0-9]{6}" inputMode="numeric" required autoFocus />
        <Button type="submit" loading={loading} className="w-full">Verify</Button>
      </form>
    </div>
  );
}

export default function MfaPage() {
  return <Suspense><MfaForm /></Suspense>;
}
