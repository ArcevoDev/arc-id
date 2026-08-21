"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@arcevo/facet-components";
import { useAuditLog } from "@/hooks/use-audit-log";

interface AuditEvent {
  id: string;
  action: string;
  targetType?: string;
  createdAt: string;
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list } = useAuditLog();

  useEffect(() => {
    list().then((result) => {
      const events =
        (result.data as { data: AuditEvent[] })?.data ?? [];
      setItems(events);
      setLoading(false);
    });
  }, [list]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Audit events for this tenant."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">No audit events found.</p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.action}</TableCell>
                      <TableCell>{e.targetType ?? "-"}</TableCell>
                      <TableCell>
                        {new Date(e.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
