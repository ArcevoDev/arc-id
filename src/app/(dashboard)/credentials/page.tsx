"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useCredentials } from "@/hooks/use-credentials";
import { Badge, Button, Card, CardContent, Input, Tabs, TabsContent, TabsList, TabsTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { Credential } from "@arcevo/facet-sdk";

export default function CredentialsPage() {
  const { list, verify, revoke, acceptOffer } = useCredentials();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [offerToken, setOfferToken] = useState("");
  const [offerResult, setOfferResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await list();
    if (result.data) setCredentials(result.data);
    else setError(result.error?.message ?? "Failed to load credentials");
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (credentialId: string) => {
    const result = await revoke(credentialId);
    if (result.data) {
      setCredentials((prev) => prev?.filter((c) => c.id !== credentialId) ?? null);
    } else {
      setError(result.error?.message ?? "Failed to revoke credential");
    }
  };

  const handleVerify = async () => {
    setError(null);
    setVerifyResult(null);
    const result = await verify(verifyInput);
    if (result.data) {
      setVerifyResult(
        result.data.valid ? "✓ Credential is valid" : `✗ Invalid: ${result.data.reason ?? "unknown reason"}`,
      );
    } else {
      setError(result.error?.message ?? "Verification failed");
    }
  };

  const handleAcceptOffer = async () => {
    setError(null);
    setOfferResult(null);
    if (!offerToken) return;
    const result = await acceptOffer(offerToken);
    if (result.data) {
      setOfferResult("✓ Offer accepted - credential is now in your wallet.");
      setOfferToken("");
      load();
    } else {
      setError(result.error?.message ?? "Failed to accept offer");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials"
        description="Verifiable Credentials"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Tabs defaultValue="issued">
        <TabsList>
          <TabsTrigger value="issued">Issued to me</TabsTrigger>
          <TabsTrigger value="offers">Accept an offer</TabsTrigger>
          <TabsTrigger value="verify">Verify a credential</TabsTrigger>
        </TabsList>

        <TabsContent value="issued">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials === null ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    Loading credentials…
                  </TableCell>
                </TableRow>
              ) : credentials.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No credentials issued yet.
                  </TableCell>
                </TableRow>
              ) : (
                credentials.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.subjectDid ? c.subjectDid.slice(0, 24) + "…" : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.expiresAt && new Date(c.expiresAt) < new Date() ? "destructive" : "default"}>
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRevoke(c.id)}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="offers">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Paste an offer token from an issuer to accept it and add the credential to your wallet.
              </p>
              <Input
                placeholder="Offer token"
                value={offerToken}
                onChange={(e) => setOfferToken(e.target.value)}
              />
              <Button onClick={handleAcceptOffer} disabled={!offerToken}>
                Accept offer
              </Button>
              {offerResult && (
                <p className={`text-sm ${offerResult.startsWith("✓") ? "text-emerald-600" : "text-destructive"}`}>
                  {offerResult}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground">Paste a credential JWT to verify it against ArcID.</p>
              <textarea
                className="w-full min-h-28 rounded-md border bg-background p-3 text-sm font-mono"
                placeholder="eyJhbGciOiJFUzI1NiIs..."
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
              />
              <Button onClick={handleVerify} disabled={!verifyInput}>
                Verify
              </Button>
              {verifyResult && (
                <p className={`text-sm ${verifyResult.startsWith("✓") ? "text-emerald-600" : "text-destructive"}`}>
                  {verifyResult}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
