"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";
import Link from "next/link";

function PasswordResetForm() {
  const params = useSearchParams();
  const token = params.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.requestPasswordReset(email);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.confirmPasswordReset(token!, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-semibold">{token ? "Password updated!" : "Email sent!"}</h2>
        <p className="text-sm text-zinc-500 mt-2">{token ? "You can now sign in with your new password." : "Check your inbox for the reset link."}</p>
        <div className="mt-4"><Link href="/auth/login" className="text-sm text-zinc-600 hover:underline">Back to login</Link></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold mb-1">{token ? "Set new password" : "Reset password"}</h2>
      {error && <Alert variant="error" className="mt-3 mb-4">{error}</Alert>}
      {token ? (
        <form onSubmit={handleConfirm} className="space-y-4 mt-4">
          <Input label="New password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">Update password</Button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="space-y-4 mt-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
      )}
    </div>
  );
}

export default function PasswordResetPage() {
  return <Suspense><PasswordResetForm /></Suspense>;
}
