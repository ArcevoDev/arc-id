"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.register(form);
      router.push("/auth/login?registered=1");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold text-zinc-900 mb-1">Create account</h2>
      <p className="text-sm text-zinc-500 mb-6">Register your sovereign identity</p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required hint="Minimum 8 characters" />
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already registered? <Link href="/auth/login" className="font-medium text-zinc-900 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
