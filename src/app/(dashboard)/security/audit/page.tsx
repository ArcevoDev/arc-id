"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useAuditLog } from "@/hooks/use-audit-log";
import { Badge, Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { AuditLogEntry } from "@arcevo/facet-sdk";

export default function AuditPage() {
  const { list } = useAuditLog();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (action = "") => {
      const result = await list({ action: action || undefined, limit: 50 });
      if (result.data) {
        setEntries(result.data.data);
        setTotal(result.data.meta.total);
      } else {
        setError(result.error?.message ?? "Failed to load audit log");
      }
    },
    [list],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    load(filter);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Security-relevant events"
        actions={
          <Button variant="secondary" size="sm" onClick={() => load()}>
            Refresh
          </Button>
        }
      />
      <form className="flex gap-2" onSubmit={handleFilter}>
        <Input
          placeholder="Filter by action…"
          className="max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={3}>
                Loading audit log…
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={3}>
                No audit events found.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Badge variant="outline">{e.action}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.targetType ? `${e.targetType} ${e.targetId ? "· " + e.targetId.slice(0, 8) : ""}` : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {entries && entries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {entries.length} of {total} events.
        </p>
      )}
    </div>
  );
}
