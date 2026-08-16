"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { useTenant } from "@/hooks/use-tenant";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { Membership } from "@arcevo/facet-sdk";

export default function TenantsPage() {
  const { tenants, activeTenant, hydrateTenants, switchTenant, listMembers } = useTenant();
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    hydrateTenants();
  }, [hydrateTenants]);

  const loadMembers = useCallback(
    async (tenantId: string) => {
      const result = await listMembers(tenantId);
      if (result.data) setMembers(result.data);
      else setError(result.error?.message ?? "Failed to load members");
    },
    [listMembers],
  );

  // Load members for the active tenant whenever it changes.
  useEffect(() => {
    if (activeTenant) loadMembers(activeTenant.id);
    else setMembers(null);
  }, [activeTenant, loadMembers]);

  const handleSwitch = async (tenantId: string) => {
    setSwitchingId(tenantId);
    const result = await switchTenant(tenantId);
    setSwitchingId(null);
    if (result.error) setError(result.error?.message ?? "Failed to switch tenant");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Organisations you belong to"
        actions={
          <Button variant="secondary" size="sm" onClick={() => hydrateTenants()}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your organisations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No organisations yet.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.name}
                      {activeTenant?.id === t.id && (
                        <Badge variant="default" className="ml-2">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                    <TableCell className="text-muted-foreground">{t.plan ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.role ?? "-"}</TableCell>
                    <TableCell>
                      {activeTenant?.id !== t.id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={switchingId === t.id}
                          onClick={() => handleSwitch(t.id)}
                        >
                          {switchingId === t.id ? "Switching…" : "Switch"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {activeTenant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Members of {activeTenant.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                      Loading members…
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
