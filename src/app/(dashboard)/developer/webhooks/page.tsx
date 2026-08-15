"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { useWebhooks } from "@/hooks/use-webhooks";
import { Badge, Button, Card, CardContent, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { WebhookEndpoint } from "@arcevo/facet-sdk";

export default function WebhooksPage() {
  const { list, create, remove } = useWebhooks();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState("");

  const load = useCallback(async () => {
    const result = await list();
    if (result.data) setEndpoints(result.data);
    else setError(result.error?.message ?? "Failed to load webhooks");
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const types = eventTypes.split(",").map((t) => t.trim()).filter(Boolean);
    const result = await create({ url, eventTypes: types });
    if (result.data) {
      setShowForm(false);
      setUrl("");
      setEventTypes("");
      load();
    } else {
      setError(result.error?.message ?? "Failed to create webhook");
    }
  };

  const handleRemove = async (id: string) => {
    const result = await remove(id);
    if (!result.error) {
      setEndpoints((prev) => prev?.filter((w) => w.id !== id) ?? null);
      setError(null);
    } else {
      setError(result.error?.message ?? "Failed to delete webhook");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Event notifications"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
            Add endpoint
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/hooks/arcid"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="events">Event types (comma-separated)</Label>
                <Input
                  id="events"
                  placeholder="user.login, credential.issued"
                  value={eventTypes}
                  onChange={(e) => setEventTypes(e.target.value)}
                />
              </div>
              <Button type="submit">Create endpoint</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {endpoints === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                Loading webhooks…
              </TableCell>
            </TableRow>
          ) : endpoints.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                No webhook endpoints yet.
              </TableCell>
            </TableRow>
          ) : (
            endpoints.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.url}</TableCell>
                <TableCell className="text-muted-foreground">
                  {w.eventTypes.length ? w.eventTypes.join(", ") : "all"}
                </TableCell>
                <TableCell>
                  <Badge variant={w.enabled ? "success" : "outline"}>
                    {w.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleRemove(w.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
