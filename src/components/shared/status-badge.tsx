// src/components/shared/status-badge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-500/10  text-amber-400  border-amber-500/20",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  BANNED: {
    label: "Banned",
    className: "bg-red-500/10    text-red-400    border-red-500/20",
  },
  DELETED: {
    label: "Deleted",
    className: "bg-zinc-500/10   text-zinc-400   border-zinc-500/20",
  },
  VERIFIED: {
    label: "Verified",
    className: "bg-blue-500/10   text-blue-400   border-blue-500/20",
  },
  REVOKED: {
    label: "Revoked",
    className: "bg-red-500/10    text-red-400    border-red-500/20",
  },
  ENTERPRISE: {
    label: "Enterprise",
    className: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  PRO: {
    label: "Pro",
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  FREE: {
    label: "Free",
    className: "bg-zinc-500/10   text-zinc-400   border-zinc-500/20",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}
