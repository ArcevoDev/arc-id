"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@arcevo/facet-components";

export default function OAuthTokensPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="OAuth Tokens" description="Active access tokens" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No OAuth tokens yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
