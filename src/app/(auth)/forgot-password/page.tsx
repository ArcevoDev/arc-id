"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ForgotPasswordForm } from "@arcevo/facet-auth";
import { useAuth } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuth();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <ForgotPasswordForm
        validate
        onSubmit={async (email) => {
          const result = await forgotPassword(email);
          if (result.error) {
            return result.error.message ?? "Failed to send reset link";
          }
          router.push("/login");
          return null;
        }}
        onBack={() => router.push("/login")}
      />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
