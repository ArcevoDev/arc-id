"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@arcevo/facet-auth";
import { useAuth } from "@/hooks/use-auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { resetPassword } = useAuth();

  return (
    <ResetPasswordForm
      token={token}
      onSubmit={async (token, newPassword) => {
        const result = await resetPassword(token, newPassword);
        if (result.error) {
          return result.error.message;
        }
        router.replace("/login");
        return null;
      }}
      onBack={() => router.replace("/login")}
    />
  );
}
