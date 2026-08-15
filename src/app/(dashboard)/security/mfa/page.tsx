"use client";

import { useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { useMfa } from "@/hooks/use-mfa";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@arcevo/facet-components";

export default function MfaPage() {
  const { setup, confirm, disable } = useMfa();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    const result = await setup();
    setLoading(false);
    if (result.data) {
      setQrCode(result.data.qrCode);
      setSecret(result.data.secret);
    } else {
      setError(result.error?.message ?? "Failed to start MFA setup");
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    const result = await confirm(code);
    setLoading(false);
    if (result.data) {
      setRecoveryCodes(result.data.recoveryCodes);
    } else {
      setError(result.error?.message ?? "Invalid code - please try again");
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setError(null);
    const result = await disable();
    setLoading(false);
    if (!result.error) {
      setQrCode(null);
      setSecret(null);
      setRecoveryCodes(null);
    } else {
      setError(result.error?.message ?? "Failed to disable MFA");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Two-Factor Authentication" description="Manage MFA settings" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {recoveryCodes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recovery codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Store these somewhere safe - they&apos;re shown only once and can
              recover your account if you lose your authenticator.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((rc, i) => (
                <code key={i} className="rounded bg-muted px-2 py-1 text-sm font-mono">
                  {rc}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : qrCode ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scan with your authenticator app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR code" className="mx-auto h-48 w-48 rounded" />
            {secret && (
              <p className="text-center text-sm text-muted-foreground">
                Manual entry key: <code className="font-mono">{secret}</code>
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <Button onClick={handleConfirm} disabled={loading || code.length !== 6}>
                Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Authenticator app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Protect your account with time-based one-time passcodes from an
              authenticator app.
            </p>
            <Button onClick={handleSetup} disabled={loading}>
              Set up MFA
            </Button>
          </CardContent>
        </Card>
      )}

      {!qrCode && !recoveryCodes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disable MFA</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDisable} disabled={loading}>
              Disable
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
