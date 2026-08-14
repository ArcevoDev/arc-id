"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCredentials } from "@/hooks/use-credentials";
import { useAuthStore } from "@/store/auth.store";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Icon } from "@arcevo/facet-components";
import type { Credential } from "@arcevo/facet-sdk";

/**
 * Web wallet - the general-user dashboard. A light version of ArcWallet:
 * shows the holder's credentials and a path to their profile/security.
 */
export default function WalletPage() {
  const user = useAuthStore((s) => s.user);
  const { list } = useCredentials();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await list();
    if (result.data) setCredentials(result.data);
    else setError(result.error?.message ?? "Failed to load credentials");
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Your wallet"}
          </h1>
          <p className="text-sm text-muted-foreground">Credentials you hold, in one place.</p>
        </div>
        <Link href="/user" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          Account settings
          <Icon name="arrow-right" size={14} />
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {credentials === null ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Loading credentials...</p>
            </CardContent>
          </Card>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Icon name="wallet" className="h-8 w-8 text-primary" />
              <CardDescription>
                No credentials yet. When an issuer sends you an offer, accept it and it will appear here.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          credentials.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon name="file-check" className="h-4 w-4 text-primary" />
                  {c.type}
                </CardTitle>
                <CardDescription>
                  Issued {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "-"}
                  {c.expiresAt ? ` - expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm mb-1">Own your identity everywhere</CardTitle>
            <CardDescription>
              Present your credentials to any verifier that trusts ArcID.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/user/security">Secure your account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
