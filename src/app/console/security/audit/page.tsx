"use client";

import { useEffect, useState } from "react";
import { Badge } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useAuditLog } from "@/hooks/use-audit-log";

interface AuditEvent {
  id: string;
  action: string;
  targetType?: string;
  createdAt: string;
}

const columns = [
  { key: "action", header: "Action" },
  {
    key: "targetType",
    header: "Target",
    cell: (e: AuditEvent) => (
      <Badge variant="outline" className="text-xs">
        {e.targetType ?? "-"}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Time",
    cell: (e: AuditEvent) => new Date(e.createdAt).toLocaleString(),
  },
];

export default function AuditPage() {
  const [items, setItems] = useState<AuditEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list } = useAuditLog();

  useEffect(() => {
    list().then((result) => {
      const events = (result.data as { data: AuditEvent[] })?.data ?? [];
      setItems(events);
      setLoading(false);
    });
  }, [list]);

  return (
    <PageShell
      title="Audit Log"
      description="Audit events for this tenant."
    >
      <ConsoleDataTable<AuditEvent>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No audit events"
        emptyDescription="No audit events have been recorded for this tenant."
        exportable
      />
    </PageShell>
  );
}
