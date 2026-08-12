"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from "@arcevo/facet-components";

export default function PasskeysPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Passkeys"
        description="WebAuthn passkey management"
        actions={<Button>Register passkey</Button>}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No passkeys registered.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
