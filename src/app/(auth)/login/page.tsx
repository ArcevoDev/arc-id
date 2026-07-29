"use client";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back to ArcID</p>
      </div>
      <LoginForm />
      <div className="flex justify-between text-sm">
        <a href="/register" className="text-primary hover:underline">Create account</a>
        <a href="/forgot-password" className="text-muted-foreground hover:underline">Forgot password?</a>
      </div>
    </div>
  );
}
