"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignUp, enterprisePreset } from "@arcevo/facet-auth";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <SignUp
      config={enterprisePreset}
      onSuccess={() => router.replace("/console")}
      slots={{
        footer: (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Login
            </Link>
          </p>
        ),
      }}
    />
  );
}
