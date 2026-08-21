"use client";

import { PageHeader } from "@arcevo/facet-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@arcevo/facet-components";

export default function UserSecurityPage() {
  return (
    <>
      <PageHeader title="Security" description="Account security settings." />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>
              Manage your security preferences and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/console/security/mfa"
              className="block text-sm underline"
            >
              Two-Factor Authentication
            </a>
            <a
              href="/console/security/passkeys"
              className="block text-sm underline"
            >
              Passkeys
            </a>
            <a
              href="/console/security/sessions"
              className="block text-sm underline"
            >
              Active Sessions
            </a>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
