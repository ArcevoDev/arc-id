"use client";

import { useEffect, useState } from "react";
import { Badge } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { useTenantStore } from "@arcevo/facet-store";
import { useTenant } from "@/hooks/use-tenant";

interface Member {
  id: string;
  identityId: string;
  tenantId: string;
  role: string;
  status: string;
  createdAt: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export default function OrganizationMembersPage() {
  const [items, setItems] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeTenant } = useTenantStore();
  const { listMembers } = useTenant();

  useEffect(() => {
    if (!activeTenant) return;
    listMembers(activeTenant.id)
      .then((result) => {
        if (result.error) {
          setError(result.error.message);
        } else {
          setItems((result.data ?? []) as unknown as Member[]);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load members");
        setLoading(false);
      });
  }, [activeTenant, listMembers]);

  const columns = [
    { key: "name", header: "Name", cell: (m: Member) => m.name ?? "-" },
    { key: "email", header: "Email", cell: (m: Member) => m.email ?? "-" },
    { key: "role", header: "Role" },
    {
      key: "status",
      header: "Status",
      cell: (m: Member) => <Badge>{m.status}</Badge>,
    },
  ];

  return (
    <PageShell title="Members" description="People with access to this organization.">
      <ConsoleDataTable<Member>
        data={items}
        columns={columns}
        loading={loading}
        error={error}
        emptyTitle="No members"
        emptyDescription="No members have been added to this organization yet."
      />
    </PageShell>
  );
}
