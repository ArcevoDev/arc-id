"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { useCredentials } from "@/hooks/use-credentials";

interface VC {
  id: string;
  format: string;
  issuerDid: string;
  subjectDid: string;
  issuedAt: string;
  expiresAt: string | null;
  credentialSubject?: Record<string, unknown>;
}

export default function CredentialsPage() {
  const [items, setItems] = useState<VC[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list } = useCredentials();

  useEffect(() => {
    list().then((result) => {
      const vcs = (result.data as VC[]) ?? [];
      setItems(vcs);
      setLoading(false);
    });
  }, [list]);

  return (
    <>
      <PageHeader
        title="Credentials"
        description="Verifiable credentials issued to your organization."
        actions={<Button size="sm" asChild><Link href="/console/credentials/create">Issue</Link></Button>}
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && (
              <p className="text-muted-foreground">Loading credentials...</p>
            )}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">No credentials found.</p>
            )}
            {!loading && items && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Format</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((vc) => (
                    <TableRow key={vc.id}>
                      <TableCell>{vc.format ?? "-"}</TableCell>
                      <TableCell>
                        <code className="text-xs">{vc.issuerDid?.slice(-8) ?? "-"}</code>
                      </TableCell>
                      <TableCell>
                        {vc.issuedAt
                          ? new Date(vc.issuedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {vc.expiresAt
                          ? new Date(vc.expiresAt).toLocaleDateString()
                          : "Never"}
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
