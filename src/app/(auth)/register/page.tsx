"use client";

import { SignUp } from "@arcevo/facet-auth";

export default function RegisterPage() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">Join ArcID</p>
      </div>

      <SignUp />
    </div>
  );
}
