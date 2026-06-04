"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Alert } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        router.push(`/auth/mfa?sessionId=${result.sessionId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold text-zinc-900 mb-1">Sign in</h2>
      <p className="text-sm text-zinc-500 mb-6">Enter your credentials to access ArcID</p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm text-zinc-500">
        <div><Link href="/auth/magic-link" className="text-zinc-700 hover:underline">Sign in with magic link</Link></div>
        <div><Link href="/auth/password-reset" className="text-zinc-700 hover:underline">Forgot password?</Link></div>
        <div>No account? <Link href="/auth/register" className="font-medium text-zinc-900 hover:underline">Register</Link></div>
      </div>
    </div>
  );
}
