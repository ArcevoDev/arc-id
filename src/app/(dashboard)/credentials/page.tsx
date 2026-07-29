"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function CredentialsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Credentials" description="Verifiable Credentials" />
      <Tabs defaultValue="issued">
        <TabsList>
          <TabsTrigger value="issued">Issued to me</TabsTrigger>
          <TabsTrigger value="verify">Verify a credential</TabsTrigger>
        </TabsList>
        <TabsContent value="issued">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No credentials issued yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="verify">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Paste a credential JWT to verify.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
