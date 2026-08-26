"use client";

import { useEffect, useState } from "react";
import { AnimatedButton, Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useSessions } from "@/hooks/use-sessions";

interface Session {
  id: string;
  createdAt: string;
  lastUsedAt?: string;
  userAgent?: string;
  ip?: string;
}

export default function SessionsPage() {
  const [items, setItems] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list, revoke } = useSessions();

  useEffect(() => {
    list().then((result) => {
      setItems((result.data as Session[]) ?? []);
      setLoading(false);
    });
  }, [list]);

  const columns = [
    { key: "userAgent", header: "Device", cell: (s: Session) => s.userAgent ?? "Unknown" },
    { key: "ip", header: "IP", cell: (s: Session) => s.ip ?? "-" },
    {
      key: "lastUsedAt",
      header: "Last active",
      cell: (s: Session) => new Date(s.lastUsedAt ?? s.createdAt).toLocaleString(),
    },
    {
      key: "id",
      header: "Actions",
      cell: (s: Session) => (
        <AnimatedButton
          animation="dissolve"
          renderButton={(props) => (
            <Button
              {...props}
              variant="outline"
              size="sm"
              onClick={async () => {
                await revoke(s.id);
                setItems((prev) => (prev ? prev.filter((x) => x.id !== s.id) : prev));
              }}
            >
              Revoke
            </Button>
          )}
        />
      ),
    },
  ];

  return (
    <PageShell title="Sessions" description="Active sessions and devices.">
      <ConsoleDataTable<Session> data={items} columns={columns} loading={loading} />
    </PageShell>
  );
}
