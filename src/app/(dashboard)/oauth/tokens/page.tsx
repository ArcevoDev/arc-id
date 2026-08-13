"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useOAuth } from "@/hooks/use-oauth";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";

interface ActiveToken {
  id: string;
  clientName: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export default function OAuthTokensPage() {
  const { listTokens, revokeToken } = useOAuth();
  const [tokens, setTokens] = useState<ActiveToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listTokens();
    if (result.data) setTokens(result.data as unknown as ActiveToken[]);
    else setError(result.error?.message ?? "Failed to load OAuth tokens");
  }, [listTokens]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (tokenId: string) => {
    const result = await revokeToken(tokenId);
    if (result.data) {
      setTokens((prev) => prev?.filter((t) => t.id !== tokenId) ?? null);
    } else {
      setError(result.error?.message ?? "Failed to revoke token");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Tokens"
        description="Active access tokens"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                Loading tokens…
              </TableCell>
            </TableRow>
          ) : tokens.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                No OAuth tokens yet.
              </TableCell>
            </TableRow>
          ) : (
            tokens.map((t) => {
              const expired = new Date(t.expiresAt) < new Date();
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.clientName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {t.scopes.length ? t.scopes.join(", ") : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expired ? "destructive" : "default"}>
                      {new Date(t.expiresAt).toLocaleDateString()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRevoke(t.id)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
