// src/hooks/use-audit-log.ts
// Pages → hooks → sdk. Wraps auditSdk.list with pagination + action-filter
// state, so security/audit/page.tsx no longer imports the SDK directly.
"use client";
import { useState, useEffect, useCallback } from "react";
import { auditSdk, SdkError } from "@/sdk";

export interface AuditEntry {
  id: string;
  action: string;
  ip: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
}

export const AUDIT_PAGE_SIZE = 20;

export function useAuditLog(filterAction?: string) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number, action?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditSdk.list({
        page: p,
        limit: AUDIT_PAGE_SIZE,
        action: action || undefined,
      });
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setEntries(rows);
      setTotal(data?.total ?? rows.length);
    } catch (err) {
      setError(
        err instanceof SdkError ? err.message : "Failed to load audit log",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to page 1 whenever the filter changes.
  useEffect(() => {
    setPage(1);
    load(1, filterAction || undefined);
  }, [filterAction, load]);

  // Re-fetch when the page changes (but not on the initial mount for page 1 —
  // the effect above already covers that; this guards against a double-fetch
  // by depending on the same `load`/`filterAction` and letting React dedupe
  // via the page=1 case running identically).
  useEffect(() => {
    load(page, filterAction || undefined);
  }, [page, load, filterAction]);

  const totalPages = Math.ceil(total / AUDIT_PAGE_SIZE);

  return {
    entries,
    loading,
    error,
    page,
    setPage,
    total,
    totalPages,
    limit: AUDIT_PAGE_SIZE,
    refresh: () => load(page, filterAction || undefined),
  };
}
