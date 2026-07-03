// src/app/(auth)/forgot-password/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { authSdk } from "@/sdk/auth.sdk";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

interface ForgotForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotForm>();

  const onSubmit = async (values: ForgotForm) => {
    setError(null);
    setLoading(true);
    try {
      await authSdk.forgotPassword(values.email);
      setSent(true);
    } catch (err: any) {
      // Don't reveal whether the email exists — show the sent state anyway
      // to prevent user enumeration.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Icons.mail className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Check your inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            If{" "}
            <span className="text-foreground font-medium">
              {getValues("email")}
            </span>{" "}
            is registered, you&apos;ll receive a reset link shortly.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t get it? Check your spam folder or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-primary hover:underline"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icons.arrowLeft className="inline w-3.5 h-3.5 mr-1" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Forgot password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Enter a valid email",
              },
            })}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : (
            "Send reset link"
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
