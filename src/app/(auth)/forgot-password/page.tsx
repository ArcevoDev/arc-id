"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ForgotPasswordForm } from "@arcevo/facet-auth";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [sent, setSent] = useState(false);

  return (
    <>
      {sent ? (
        <div className="text-center">
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to your inbox.
          </p>
          <Link
            href="/login"
            className="text-primary underline text-sm mt-4 block"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <ForgotPasswordForm
          onSubmit={async (email) => {
            const result = await forgotPassword(email);
            if (result.error) {
              return result.error.message;
            }
            setSent(true);
            return null;
          }}
          onBack={() => router.replace("/login")}
        />
      )}
    </>
  );
}
