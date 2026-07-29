"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionId) {
      setError("No session ID found. Please sign in again.");
      return;
    }

    setLoading(true);
    const result = await verifyMfa(code, sessionId);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="code">Authentication code</Label>
        <Input
          id="code"
          placeholder="000000"
          className="text-center text-lg tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={loading}>
        {loading ? "Verifying..." : "Verify"}
      </Button>
    </form>
  );
}
