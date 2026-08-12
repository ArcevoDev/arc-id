"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button, Separator } from "@arcevo/facet-components";

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Profile" description="Manage your account settings" />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input placeholder="Your name" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input disabled placeholder="you@example.com" />
          </div>
          <Button>Save changes</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete your account and all associated data.
          </p>
          <Button variant="destructive">Delete account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
