"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, socialAuthUrl } from "@/hooks/use-auth";
import { Button, Icon, Input, Label, Separator } from "@arcevo/facet-components";

export function LoginForm() {
  const router = useRouter();
  const { login, requestMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const data = result.data as any;
    if (data?.mfaRequired || data?.sessionId) {
      router.push(`/mfa?sessionId=${encodeURIComponent(data.sessionId)}`);
      return;
    }

    router.push("/dashboard");
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await requestMagicLink(email);
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Failed to send magic link");
    } else {
      setMagicSent(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" asChild>
          <a href={socialAuthUrl("github")} className="inline-flex items-center justify-center gap-2">
            <Icon name="github" className="h-4 w-4" />
            GitHub
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={socialAuthUrl("google")} className="inline-flex items-center justify-center gap-2">
            <Icon name="globe" className="h-4 w-4" />
            Google
          </a>
        </Button>
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {magicSent && (
          <p className="text-sm text-emerald-600">
            Magic link sent - check your inbox.
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={handleMagicLink} disabled={loading}>
          Send me a magic link
        </Button>
      </form>
    </div>
  );
}
