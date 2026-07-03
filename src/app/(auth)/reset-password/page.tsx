// src/app/(auth)/reset-password/page.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { authSdk } from "@/sdk/auth.sdk";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

interface ResetForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>();
  const password = watch("password");

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token. Request a new one.");
  }, [token]);

  const onSubmit = async (values: ResetForm) => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await authSdk.resetPassword(token, values.password);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Icons.success className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Password updated
          </h1>
          <p className="text-sm text-muted-foreground">
            Your password has been reset. All previous sessions have been
            revoked.
          </p>
        </div>
        <Button className="w-full" onClick={() => router.replace("/login")}>
          Sign in with new password
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="text-sm flex items-start gap-2">
          <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              aria-invalid={!!errors.password}
              disabled={!token}
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "At least 8 characters required",
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <Icons.hide className="w-4 h-4" />
              ) : (
                <Icons.show className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat password"
            aria-invalid={!!errors.confirmPassword}
            disabled={!token}
            {...register("confirmPassword", {
              required: "Please confirm your password",
              validate: (v) => v === password || "Passwords do not match",
            })}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading || !token}>
          {loading ? (
            <>
              <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icons.arrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </Link>
    </div>
  );
}
