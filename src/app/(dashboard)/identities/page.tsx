"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useIdentities } from "@/hooks/use-identities";
import { Badge, Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { User } from "@arcevo/facet-sdk";

const STATUS_VARIANT: Record<string, "default" | "success" | "destructive" | "warning"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
  BANNED: "destructive",
  PENDING: "warning",
};

export default function IdentitiesPage() {
  const { list } = useIdentities();
  const [users, setUsers] = useState<User[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (term = "") => {
      const result = await list({ search: term || undefined, limit: 50 });
      if (result.data) setUsers(result.data.data);
      else setError(result.error?.message ?? "Failed to load identities");
    },
    [list],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    load(search);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Identities" description="Directory of registered users" />
      <form className="flex gap-2" onSubmit={handleSearch}>
        <Input
          placeholder="Search users…"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                Loading identities…
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No identities found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[u.status ?? "PENDING"] ?? "default"}>
                    {u.status ?? "PENDING"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.plan ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
