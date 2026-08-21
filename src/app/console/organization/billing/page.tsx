"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OrganizationBillingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/console/billing");
  }, [router]);

  return null;
}
