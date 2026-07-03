// src/app/(auth)/register/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { authSdk } from "@/sdk/auth.sdk";
import { useAuth } from "@/hooks/use-auth";
import { Icons } from "@/lib/ui/icon-registry";
import { ArcMetadata } from "@/lib/ui/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>();
  const password = watch("password");

  const onSubmit = async (values: RegisterForm) => {
    setError(null);
    setLoading(true);
    try {
      const data = await authSdk.register(
        values.name,
        values.email,
        values.password,
      );
      setTokens(
        data.accessToken,
        data.refreshToken,
        data.identity,
        data.sessionId,
      );
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create account
        </h1>
        <p className="text-sm text-muted-foreground">{ArcMetadata.tagline}</p>
      </div>

      {error && (
        <Alert variant="destructive" className="text-sm flex items-start gap-2">
          <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            aria-invalid={!!errors.name}
            {...register("name", { required: "Name is required" })}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              aria-invalid={!!errors.password}
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
