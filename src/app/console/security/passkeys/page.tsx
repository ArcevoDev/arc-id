"use client";

import { useEffect, useState } from "react";
import type { DataTableColumn } from "@arcevo/facet-components";
import { Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { usePasskeys } from "@/hooks/use-passkeys";

interface Passkey {
  id: string;
  name?: string;
  createdAt: string;
}

export default function PasskeysPage() {
  const [items, setItems] = useState<Passkey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list, deregister } = usePasskeys();

  useEffect(() => {
    list().then((result) => {
      const passkeys = (result.data as Passkey[]) ?? [];
      setItems(passkeys);
      setLoading(false);
    });
  }, [list]);

  const handleRemove = async (id: string) => {
    await deregister(id);
    setItems(items?.filter((p) => p.id !== id) ?? []);
  };

  const columns: DataTableColumn<Passkey>[] = [
    {
      key: "name",
      header: "Name",
      cell: (p) => p.name || "Unnamed passkey",
    },
    {
      key: "createdAt",
      header: "Added",
      cell: (p) => new Date(p.createdAt).toLocaleDateString(),
    },
    {
      key: "id",
      header: "Actions",
      sortable: false,
      cell: (p) => (
        <Button variant="outline" size="sm" onClick={() => handleRemove(p.id)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="Passkeys" description="Manage your WebAuthn passkeys.">
      <ConsoleDataTable<Passkey>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No passkeys registered"
        emptyDescription="Register a passkey from your device's security settings."
      />
    </PageShell>
  );
}
