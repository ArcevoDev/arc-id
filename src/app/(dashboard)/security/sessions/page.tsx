"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SessionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sessions" description="Manage your active login sessions" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No sessions loaded yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
