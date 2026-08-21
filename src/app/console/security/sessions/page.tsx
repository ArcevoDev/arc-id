"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@arcevo/facet-components";
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
      const sessions = (result.data as Session[]) ?? [];
      setItems(sessions);
      setLoading(false);
    });
  }, [list]);

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Active sessions and devices."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && (
              <p className="text-muted-foreground">Loading sessions...</p>
            )}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">No active sessions.</p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.userAgent}</TableCell>
                      <TableCell>{s.ip}</TableCell>
                      <TableCell>
                        {new Date(s.lastUsedAt ?? s.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await revoke(s.id);
                            setItems(items.filter((x) => x.id !== s.id));
                          }}
                        >
                          Revoke
                        </Button>
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
