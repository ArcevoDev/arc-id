"use client";

import { useEffect, useState } from "react";
import { Badge } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
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

  const columns = [
    { key: "name", header: "Name", cell: (row: Identity) => row.name ?? "-" },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      cell: (row: Identity) => <Badge>{row.status}</Badge>,
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (row: Identity) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <PageShell title="Identities" description="Manage user identities in this tenant.">
      <ConsoleDataTable<Identity>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No identities"
        emptyDescription="No user identities have been created for this tenant."
        exportable
      />
    </PageShell>
  );
}
