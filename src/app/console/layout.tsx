"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConsoleLayout } from "@arcevo/facet-layout";
import { buildLayoutConfig } from "@/config/layout";
import { useAuthStore } from "@arcevo/facet-store";

export default function ConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { accessToken, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.replace("/login");
    }
  }, [accessToken, isLoading, router]);

  if (isLoading || !accessToken) return null;

  return (
    <ConsoleLayout config={buildLayoutConfig()}>{children}</ConsoleLayout>
  );
}
