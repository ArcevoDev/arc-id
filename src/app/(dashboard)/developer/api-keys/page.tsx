"use client";

import { useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { useApiKeys } from "@/hooks/use-api-keys";
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";

export default function ApiKeysPage() {
  const { create } = useApiKeys();
  const [error, setError] = useState<string | null>(null);

  // The backend does not expose API-key CRUD routes yet (see useApiKeys
  // stub). Keep the page honest: an empty state + explicit message.
  const handleCreate = async () => {
    const result = await create({ name: "new-key" });
    if (result.error) setError(result.error.message ?? "Failed to create API key");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Programmatic access keys"
        actions={<Button onClick={handleCreate}>Create API key</Button>}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No API keys yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            API key management is not implemented on the backend yet - this page
            will activate once the <code className="font-mono">/api-keys</code> routes ship.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
