"use client";
import { useState } from "react";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";
import Link from "next/link";

export default function MagicLinkPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.requestMagicLink(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Check your email</h2>
        <p className="text-sm text-zinc-500 mb-4">We sent a magic link to <strong>{email}</strong>. It expires in 15 minutes.</p>
        <Link href="/auth/login" className="text-sm text-zinc-600 hover:underline">Back to login</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold mb-1">Magic link</h2>
      <p className="text-sm text-zinc-500 mb-6">Get a passwordless sign-in link via email</p>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <Button type="submit" loading={loading} className="w-full">Send magic link</Button>
      </form>
      <div className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="text-zinc-500 hover:underline">Back to login</Link>
      </div>
    </div>
  );
}
