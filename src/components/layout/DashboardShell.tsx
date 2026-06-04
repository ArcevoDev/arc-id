"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Spinner } from "@/components/ui";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { identity, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !identity) router.replace("/auth/login");
  }, [identity, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!identity) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
