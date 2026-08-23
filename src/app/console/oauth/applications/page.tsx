"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useOAuth } from "@/hooks/use-oauth";

interface OAuthClient {
  id: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  createdAt: string;
}

const columns = [
  { key: "name", header: "Name" },
  {
    key: "clientId",
    header: "Client ID",
    cell: (c: OAuthClient) => (
      <code className="text-xs">{c.clientId}</code>
    ),
  },
  {
    key: "redirectUris",
    header: "Redirect URIs",
    cell: (c: OAuthClient) => c.redirectUris.length,
  },
  {
    key: "createdAt",
    header: "Created",
    cell: (c: OAuthClient) => new Date(c.createdAt).toLocaleDateString(),
  },
  {
    key: "id",
    header: "Actions",
    sortable: false,
    cell: (c: OAuthClient) => (
      <Button size="sm" variant="outline" asChild>
        <Link href={`/console/oauth/applications/${c.id}`}>Edit</Link>
      </Button>
    ),
  },
];

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
    <PageShell
      title="OAuth Applications"
      description="Registered OAuth/OIDC clients."
    >
      <ConsoleDataTable<OAuthClient>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No OAuth clients"
        emptyDescription="No OAuth clients have been registered for this tenant."
      />
    </PageShell>
  );
}
