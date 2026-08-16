"use client";

import { AuthLayout } from "@arcevo/facet-layout";
import { buildLayoutConfig } from "@/config/layout";

export default function AuthLayoutGroup({ children }: { children: React.ReactNode }) {
  return <AuthLayout config={buildLayoutConfig()}>{children}</AuthLayout>;
}
