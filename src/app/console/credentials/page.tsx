"use client";

import Link from "next/link";
import { AnimatedButton, Button } from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { ConsoleDataTable } from "@/components/console-data-table";
import { credentialsColumns } from "./_components/credentials-table";
import { useCredentialsList } from "./_components/use-credentials-list";

export default function CredentialsPage() {
  const { items, loading } = useCredentialsList();

  return (
    <PageShell
      title="Credentials"
      description="Verifiable credentials issued to your organization."
      actions={
        <AnimatedButton
          animation="sparkle"
          renderButton={(props) => (
            <Button {...props} size="sm" asChild>
              <Link href="/console/credentials/create">Issue</Link>
            </Button>
          )}
        />
      }
    >
      <ConsoleDataTable
        data={items}
        columns={credentialsColumns}
        loading={loading}
      />
    </PageShell>
  );
}
