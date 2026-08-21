"use client";

import { useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@arcevo/facet-components";
import { MfaSetupForm } from "@arcevo/facet-auth";
import { useMfa } from "@/hooks/use-mfa";

interface MfaSetupResult {
  secret: string;
  qrCode: string;
  uri: string;
}

export default function MfaPage() {
  const { setup, confirm, disable } = useMfa();
  const [status, setStatus] = useState<"checking" | "setup" | "enabled">(
    "checking",
  );
  const [setupData, setSetupData] = useState<MfaSetupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    const result = await setup();
    if (result.data?.secret) {
      setSetupData({ secret: result.data.secret, qrCode: result.data.qrCode, uri: result.data.uri });
    }
    setLoading(false);
  };

  const handleConfirm = async (code: string) => {
    const result = await confirm(code);
    if (!result.error) {
      setStatus("enabled");
      setSetupData(null);
    }
  };

  const handleDisable = async () => {
    await disable();
    setStatus("checking");
    setSetupData(null);
  };

  return (
    <>
      <PageHeader
        title="Two-Factor Authentication"
        description="Secure your account with MFA."
      />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>MFA Protection</CardTitle>
            <CardDescription>
              {status === "enabled"
                ? "MFA is enabled on your account."
                : status === "setup"
                  ? "Complete MFA setup below."
                  : "MFA is not yet configured."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupData ? (
              <MfaSetupForm
                setupData={setupData}
                onConfirm={handleConfirm}
              />
            ) : status === "enabled" ? (
              <Button variant="destructive" size="sm" onClick={handleDisable}>
                Disable MFA
              </Button>
            ) : (
              <Button size="sm" onClick={handleSetup} disabled={loading}>
                {loading ? "Setting up..." : "Set up MFA"}
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
