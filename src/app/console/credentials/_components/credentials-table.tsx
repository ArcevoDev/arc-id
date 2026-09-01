"use client";

import type { DataTableColumn } from "@arcevo/facet-components";

export interface VC {
  id: string;
  format: string;
  issuerDid: string;
  issuedAt: string;
  expiresAt: string | null;
}

export const credentialsColumns: DataTableColumn<VC>[] = [
  { key: "format", header: "Format" },
  {
    key: "issuerDid",
    header: "Issuer",
    cell: (vc) => <code className="text-xs">{vc.issuerDid?.slice(-8) ?? "-"}</code>,
  },
  {
    key: "issuedAt",
    header: "Issued",
    cell: (vc) => (vc.issuedAt ? new Date(vc.issuedAt).toLocaleDateString() : "-"),
  },
  {
    key: "expiresAt",
    header: "Expires",
    cell: (vc) => (vc.expiresAt ? new Date(vc.expiresAt).toLocaleDateString() : "Never"),
  },
];
