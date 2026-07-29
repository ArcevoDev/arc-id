"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Event notifications"
        actions={<Button>Add endpoint</Button>}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No webhook endpoints yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
