"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@arcevo/facet-components";
import { useTenantStore } from "@arcevo/facet-store";
import { useTenant } from "@/hooks/use-tenant";

interface Member {
  id: string;
  identityId: string;
  tenantId: string;
  role: string;
  status: string;
  createdAt: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export default function OrganizationMembersPage() {
  const [items, setItems] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeTenant } = useTenantStore();
  const { listMembers } = useTenant();

  useEffect(() => {
    if (!activeTenant) return;
    listMembers(activeTenant.id)
      .then((result) => {
        if (result.error) {
          setError(result.error.message);
        } else {
          setItems((result.data ?? []) as unknown as Member[]);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load members");
        setLoading(false);
      });
  }, [activeTenant, listMembers]);

  return (
    <>
      <PageHeader
        title="Members"
        description="People with access to this organization."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!loading && !error && items?.length === 0 && (
              <p className="text-muted-foreground">No members found.</p>
            )}
            {!loading && !error && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.name ?? "-"}</TableCell>
                      <TableCell>{m.email ?? "-"}</TableCell>
                      <TableCell>{m.role}</TableCell>
                      <TableCell>
                        <Badge>{m.status}</Badge>
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
