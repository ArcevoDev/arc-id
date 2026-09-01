"use client";

import { useEffect, useState } from "react";
import { useCredentials } from "@/hooks/use-credentials";
import type { VC } from "./credentials-table";

/**
 * Loads the list of verifiable credentials for the current tenant.
 * Returns the items array + a loading flag — the page only needs the data.
 */
export function useCredentialsList(): { items: VC[] | null; loading: boolean } {
  const { list } = useCredentials();
  const [items, setItems] = useState<VC[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    list().then((result) => {
      setItems((result.data as VC[]) ?? []);
      setLoading(false);
    });
  }, [list]);

  return { items, loading };
}
