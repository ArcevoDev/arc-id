"use client";

import { useEffect, useState } from "react";
import type { DataTableColumn } from "@arcevo/facet-components";
import { AnimatedButton, Badge, Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useWebhooks } from "@/hooks/use-webhooks";

interface Webhook {
  id: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  createdAt: string;
}

export default function WebhooksPage() {
  const [items, setItems] = useState<Webhook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { list, remove, test } = useWebhooks();

  useEffect(() => {
    list().then((result) => {
      const hooks = (result.data as Webhook[]) ?? [];
      setItems(hooks);
      setLoading(false);
    });
  }, [list]);

  const handleRemove = async (id: string) => {
    await remove(id);
    setItems(items?.filter((w) => w.id !== id) ?? []);
  };

  const columns: DataTableColumn<Webhook>[] = [
    { key: "url", header: "URL" },
    {
      key: "eventTypes",
      header: "Events",
      cell: (w) => w.eventTypes.join(", ") || "all",
    },
    {
      key: "enabled",
      header: "Status",
      cell: (w) => (
        <Badge variant={w.enabled ? "default" : "outline"}>
          {w.enabled ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "Actions",
      sortable: false,
      cell: (w) => (
        <div className="flex gap-2">
          <AnimatedButton
            animation="sparkle"
            renderButton={(props) => (
              <Button {...props} variant="outline" size="sm" onClick={() => test(w.id)}>
                Test
              </Button>
            )}
          />
          <AnimatedButton
            animation="dissolve"
            renderButton={(props) => (
              <Button {...props} variant="outline" size="sm" onClick={() => handleRemove(w.id)}>
                Delete
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Webhooks" description="Configure webhook delivery endpoints.">
      <ConsoleDataTable<Webhook>
        data={items}
        columns={columns}
        loading={loading}
        emptyTitle="No webhook endpoints"
        emptyDescription="No webhook endpoints have been configured for this tenant."
      />
    </PageShell>
  );
}
