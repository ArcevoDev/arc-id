"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { usePasskeys } from "@/hooks/use-passkeys";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { Passkey } from "@arcevo/facet-sdk";

export default function PasskeysPage() {
  const { list, deregister } = usePasskeys();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await list();
    if (result.data) setPasskeys(result.data);
    else setError(result.error?.message ?? "Failed to load passkeys");
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeregister = async (passkeyId: string) => {
    const result = await deregister(passkeyId);
    if (result.data) {
      setPasskeys((prev) => prev?.filter((p) => p.id !== passkeyId) ?? null);
    } else {
      setError(result.error?.message ?? "Failed to deregister passkey");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passkeys"
        description="WebAuthn passkey management"
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
            <TableHead>Device</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {passkeys === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                Loading passkeys…
              </TableCell>
            </TableRow>
          ) : passkeys.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                No passkeys registered.
              </TableCell>
            </TableRow>
          ) : (
            passkeys.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.deviceType ?? "Device"}
                  {p.backedUp ? " · synced" : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDeregister(p.id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
