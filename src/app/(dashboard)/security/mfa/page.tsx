"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MfaPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Two-Factor Authentication" description="Manage MFA settings" />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Authenticator app</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Scan the QR code with your authenticator app and enter the code to enable MFA.
          </p>
          <Button>Set up</Button>
        </CardContent>
      </Card>
    </div>
  );
}
