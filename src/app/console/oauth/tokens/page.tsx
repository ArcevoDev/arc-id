"use client";

import { useEffect, useState } from "react";
import type { DataTableColumn } from "@arcevo/facet-components";
import { Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useOAuth } from "@/hooks/use-oauth";

interface Token {
  id: string;
  clientId: string;
  clientName?: string;
  scopes: string[];
  expiresAt?: string;
  revoked?: boolean;
  createdAt: string;
}

export default function OAuthTokensPage() {
  const [items, setItems] = useState<Token[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { listTokens, revokeToken } = useOAuth();

  useEffect(() => {
    listTokens().then((result) => {
      const tokens = (result.data as Token[]) ?? [];
      setItems(tokens);
      setLoading(false);
    });
  }, [listTokens]);

  const handleRevoke = async (tokenId: string) => {
    await revokeToken(tokenId);
    setItems(items?.filter((t) => t.id !== tokenId) ?? []);
  };

  const columns: DataTableColumn<Token>[] = [
    {
      key: "clientId",
      header: "Client",
      cell: (t) => t.clientName ?? t.clientId,
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (t) => new Date(t.createdAt).toLocaleString(),
    },
    {
      key: "expiresAt",
      header: "Expires",
      cell: (t) =>
        t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "Never",
    },
    {
      key: "id",
      header: "Actions",
      sortable: false,
      cell: (t) => (
        <Button variant="outline" size="sm" onClick={() => handleRevoke(t.id)}>
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="OAuth Tokens"
      description="Active personal access tokens."
    >
      <ConsoleDataTable<Token>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No tokens found"
        emptyDescription="No personal access tokens have been issued."
      />
    </PageShell>
  );
}
