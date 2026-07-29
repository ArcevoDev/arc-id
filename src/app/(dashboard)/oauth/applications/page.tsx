"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OAuthApplicationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Applications"
        description="Manage OAuth 2.0 clients"
        actions={<Button>Create application</Button>}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No OAuth applications yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
