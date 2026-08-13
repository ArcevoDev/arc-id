"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/hooks/use-tenant";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { Membership } from "@arcevo/facet-sdk";

export default function OrganizationMembersPage() {
  const { activeTenant, listMembers } = useTenant();
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenant) return;
    const result = await listMembers(activeTenant.id);
    if (result.data) setMembers(result.data);
    else setError(result.error?.message ?? "Failed to load members");
  }, [activeTenant, listMembers]);

  useEffect(() => {
    load();
  }, [load]);

  if (!activeTenant) {
    return <p className="text-sm text-muted-foreground">No active organization.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={3}>
                Loading members...
              </TableCell>
            </TableRow>
          ) : members.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={3}>
                No members found.
              </TableCell>
            </TableRow>
          ) : (
            members.map((m, i) => (
              <TableRow key={m.tenantId + i}>
                <TableCell>{m.name ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{m.role}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "ACTIVE" ? "success" : "default"}>
                    {m.status ?? "-"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
