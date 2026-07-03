// src/app/(dashboard)/security/passkeys/page.tsx
"use client";
import { useState } from "react";
import { usePasskeys } from "@/hooks/use-passkeys";
import { useStepUp } from "@/hooks/use-step-up";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmActionDialog, StepUpDialog } from "@/components/arc/dialogs";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Passkey } from "@/hooks/use-passkeys";

export default function PasskeysPage() {
  const { passkeys, loading, refresh, remove } = usePasskeys();
  const { isOpen, run, verify, cancel } = useStepUp();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    await run(async () => {
      await remove(deleteId);
      setDeleteId(null);
    });
  };

  const columns: Column<Passkey>[] = [
    {
      key: "name",
      header: "Passkey",
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icons.passkey className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {p.name ?? "Unnamed passkey"}
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {p.deviceType}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "backup",
      header: "Backed up",
      width: "110px",
      render: (p) => (
        <Badge
          variant="outline"
          className={`text-[11px] ${p.backedUp ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground"}`}
        >
          {p.backedUp ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "lastUsed",
      header: "Last used",
      width: "140px",
      render: (p) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(p.lastUsedAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "created",
      header: "Added",
      width: "140px",
      render: (p) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (p) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteId(p.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passkeys"
        description="Hardware-backed authentication keys registered to your account."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <Icons.refresh
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={passkeys}
        isLoading={loading}
        rowKey={(p) => p.id}
        emptyTitle="No passkeys registered"
        emptyDesc="Passkey registration requires a browser with WebAuthn support."
      />

      <ConfirmActionDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Remove passkey?"
        description="This passkey will be permanently removed. You'll need to re-register it to use it again. Step-up authentication required."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />

      <StepUpDialog open={isOpen} onCancel={cancel} onVerify={verify} />
    </div>
  );
}
