"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { Button, Card, CardContent } from "@arcevo/facet-components";
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

  return (
    <>
      <PageHeader
        title="Passkeys"
        description="Manage your WebAuthn passkeys."
      />
      <main className="p-6">
        <Card>
          <CardContent>
            {loading && (
              <p className="text-muted-foreground">Loading passkeys...</p>
            )}
            {!loading && items?.length === 0 && (
              <p className="text-muted-foreground">
                No passkeys registered.
              </p>
            )}
            {!loading && items && (
              <div className="space-y-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center border-b py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {p.name || "Unnamed passkey"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Added {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await deregister(p.id);
                        setItems(items.filter((x) => x.id !== p.id));
                      }}
                    >
                      Remove
                    </Button>
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
