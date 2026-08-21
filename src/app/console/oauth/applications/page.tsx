"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@arcevo/facet-components";
import { useOAuth } from "@/hooks/use-oauth";

interface OAuthClient {
  id: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  createdAt: string;
}

export default function OAuthApplicationsPage() {
  const [items, setItems] = useState<OAuthClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { listClients } = useOAuth();

  useEffect(() => {
    listClients().then((result) => {
      const clients = (result.data as OAuthClient[]) ?? [];
      setItems(clients);
      setLoading(false);
    });
  }, [listClients]);

  return (
    <>
      <PageHeader
        title="OAuth Applications"
        description="Registered OAuth/OIDC clients."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">
                No OAuth clients registered.
              </p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Redirect URIs</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>
                        <code className="text-xs">{c.clientId}</code>
                      </TableCell>
                      <TableCell>{c.redirectUris.length}</TableCell>
                      <TableCell>
                        {new Date(c.createdAt).toLocaleDateString()}
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
