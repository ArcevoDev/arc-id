"use client";

import { ReactNode } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { Card, CardContent } from "@arcevo/facet-components";

export interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  card?: boolean;
  maxWidth?: string;
}

export function PageShell({
  title,
  description,
  actions,
  children,
  card = true,
  maxWidth,
}: PageShellProps) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <main className="p-6">
        {card ? (
          <Card className={maxWidth ?? "default"}>
            <CardContent className="pt-6">{children}</CardContent>
          </Card>
        ) : (
          children
        )}
      </main>
    </>
  );
}
