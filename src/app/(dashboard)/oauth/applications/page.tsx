"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { useOAuth } from "@/hooks/use-oauth";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { OAuthClient } from "@arcevo/facet-sdk";

export default function OAuthApplicationsPage() {
  const { listClients } = useOAuth();
  const [clients, setClients] = useState<OAuthClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listClients();
    if (result.data) setClients(result.data);
    else setError(result.error?.message ?? "Failed to load OAuth applications");
  }, [listClients]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Applications"
        description="Manage OAuth 2.0 clients"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>PKCE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                Loading applications…
              </TableCell>
            </TableRow>
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                No OAuth applications yet.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {c.clientId ?? c.id.slice(0, 16)}
                </TableCell>
                <TableCell>
                  <Badge variant={c.public ? "outline" : "default"}>
                    {c.public ? "Public" : "Confidential"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={c.requirePkce ? "success" : "secondary"}>
                    {c.requirePkce ? "Required" : "Optional"}
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
