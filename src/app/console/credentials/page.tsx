"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useCredentials } from "@/hooks/use-credentials";

interface VC {
  id: string;
  format: string;
  issuerDid: string;
  issuedAt: string;
  expiresAt: string | null;
}

const columns = [
  { key: "format", header: "Format" },
  {
    key: "issuerDid",
    header: "Issuer",
    cell: (vc: VC) => <code className="text-xs">{vc.issuerDid?.slice(-8) ?? "-"}</code>,
  },
  {
    key: "issuedAt",
    header: "Issued",
    cell: (vc: VC) => (vc.issuedAt ? new Date(vc.issuedAt).toLocaleDateString() : "-"),
  },
  {
    key: "expiresAt",
    header: "Expires",
    cell: (vc: VC) => (vc.expiresAt ? new Date(vc.expiresAt).toLocaleDateString() : "Never"),
  },
];

export default function CredentialsPage() {
  const [items, setItems] = useState<VC[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list } = useCredentials();

  useEffect(() => {
    list().then((result) => {
      setItems((result.data as VC[]) ?? []);
      setLoading(false);
    });
  }, [list]);

  return (
    <PageShell
      title="Credentials"
      description="Verifiable credentials issued to your organization."
      actions={
        <Button size="sm" asChild>
          <Link href="/console/credentials/create">Issue</Link>
        </Button>
      }
    >
      <ConsoleDataTable<VC> data={items} columns={columns} loading={loading} />
    </PageShell>
  );
}
