"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@arcevo/facet-components";
import { useIdentities } from "@/hooks/use-identities";

interface Identity {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
}

export default function IdentitiesPage() {
  const [items, setItems] = useState<Identity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list } = useIdentities();

  useEffect(() => {
    list().then((result) => {
      const ids = (result.data as { data: Identity[] })?.data ?? [];
      setItems(ids);
      setLoading(false);
    });
  }, [list]);

  return (
    <>
      <PageHeader
        title="Identities"
        description="Manage user identities in this tenant."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && (
              <p className="text-muted-foreground">Loading identities...</p>
            )}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">No identities found.</p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((id) => (
                    <TableRow key={id.id}>
                      <TableCell>{id.name ?? "-"}</TableCell>
                      <TableCell>{id.email}</TableCell>
                      <TableCell>
                        <Badge>{id.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(id.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
