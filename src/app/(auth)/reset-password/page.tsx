"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@arcevo/facet-auth";
import { useAuth } from "@/hooks/use-auth";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { resetPassword } = useAuth();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your new password</p>
      </div>
      <ResetPasswordForm
        token={token}
        validate
        onSubmit={async (resetToken, newPassword) => {
          const result = await resetPassword(resetToken, newPassword);
          if (result.error) {
            return result.error.message ?? "Failed to reset password";
          }
          router.push("/login");
          return null;
        }}
      />
    </div>
  );
}
