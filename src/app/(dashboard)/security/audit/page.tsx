"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Security-relevant events" />
      <div className="flex gap-2">
        <Input placeholder="Filter by action..." className="max-w-xs" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={3}>
              No audit events loaded yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
