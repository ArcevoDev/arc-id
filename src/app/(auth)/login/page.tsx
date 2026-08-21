"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignIn } from "@arcevo/facet-auth";

export default function LoginPage() {
  const router = useRouter();

  return (
    <>
      <SignIn
        onSuccess={() => router.replace("/console")}
        slots={{
          footer: (
            <p className="text-center text-sm text-muted-foreground">
              No account yet?{" "}
              <Link href="/register" className="text-primary underline">
                Register
              </Link>
            </p>
          ),
        }}
      />
    </>
  );
}
