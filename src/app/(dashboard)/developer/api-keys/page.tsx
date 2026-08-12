"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Programmatic access keys"
        actions={<Button>Create API key</Button>}
      />
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
    </div>
  );
}
