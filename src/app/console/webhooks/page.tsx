"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@arcevo/facet-components";
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

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Configure webhook delivery endpoints."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">
                No webhook endpoints configured.
              </p>
            )}
            {!loading && items && (
              <div className="space-y-4">
                {items.map((w) => (
                  <div key={w.id} className="border-b py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium break-all">{w.url}</p>
                        <p className="text-sm text-muted-foreground">
                          Events: {w.eventTypes.join(", ") || "all"}
                        </p>
                      </div>
                      <Badge
                        variant={w.enabled ? "default" : "outline"}
                      >
                        {w.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => test(w.id)}
                      >
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await remove(w.id);
                          setItems(items.filter((x) => x.id !== w.id));
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
