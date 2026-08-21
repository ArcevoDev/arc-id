"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Button,
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

  return (
    <>
      <PageHeader
        title="OAuth Tokens"
        description="Active personal access tokens."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">No tokens found.</p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.clientName ?? t.clientId}</TableCell>
                      <TableCell>
                        {new Date(t.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {t.expiresAt
                          ? new Date(t.expiresAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await revokeToken(t.id);
                            setItems(items.filter((x) => x.id !== t.id));
                          }}
                        >
                          Revoke
                        </Button>
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
