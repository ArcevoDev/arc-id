"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";

export default function HomePage() {
  const { identity, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(identity ? "/dashboard" : "/auth/login");
    }
  }, [identity, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
