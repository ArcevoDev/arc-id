"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    setStatus("verifying");
    verifyEmail(token).then((result) => {
      if (result.error) {
        setStatus("error");
      } else {
        setStatus("success");
        setTimeout(() => router.replace("/login"), 3000);
      }
    });
  }, [token, verifyEmail, router]);

  return (
    <div className="text-center">
      {status === "verifying" && (
        <>
          <h2 className="text-lg font-semibold">Verifying your email...</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your email address.
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <h2 className="text-lg font-semibold">Email verified!</h2>
          <p className="text-sm text-muted-foreground">
            Redirecting you to login...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <h2 className="text-lg font-semibold">Verification failed</h2>
          <p className="text-sm text-muted-foreground">
            The verification link is invalid or has expired.
          </p>
          <Link
            href="/login"
            className="text-primary underline text-sm mt-4 block"
          >
            Back to login
          </Link>
        </>
      )}
    </div>
  );
}
