// src/app/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, LoginForm } from "@/components/arc";
import { ArcMetadata } from "@/lib/ui/metadata";
import type { LoginResult } from "@/store/auth.store";
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleResult = (result: LoginResult) => {
    if (!result.success) {
      setError(result.error ?? "Invalid email or password.");
      return;
    }
    setError(null);
    if (result.requiresMfa) {
      router.push("/mfa");
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <AuthCard
      title="Sign in"
      description={ArcMetadata.tagline}
      error={error}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
          >
            Create one
          </Link>
        </>
      }
    >
      <LoginForm onResult={handleResult} />
    </AuthCard>
  );
}
