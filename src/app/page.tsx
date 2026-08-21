"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@arcevo/facet-store";

export default function HomePage() {
  const router = useRouter();
  const { accessToken, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    router.replace(accessToken ? "/console" : "/home");
  }, [accessToken, isLoading, router]);

  return null;
}
