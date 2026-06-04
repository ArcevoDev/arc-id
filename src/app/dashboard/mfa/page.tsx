"use client";
import { useState } from "react";
import { auth } from "@/lib/api";
import { Button, Input, Alert, Card, CardBody, CardHeader, CardFooter } from "@/components/ui";

export default function MfaPage() {
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "done">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startSetup() {
    setLoading(true); setError("");
    try {
      const res = await auth.setupMfa();
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setStep("setup");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await auth.confirmMfa(code);
      setRecoveryCodes(res.data.recoveryCodes);
      setStep("done");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Multi-Factor Authentication</h1>
        <p className="text-sm text-zinc-500 mt-1">Secure your account with TOTP two-factor authentication</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {step === "idle" && (
        <Card>
          <CardBody className="text-center py-8">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="font-semibold text-zinc-800 mb-2">Enable TOTP MFA</h3>
            <p className="text-sm text-zinc-500 mb-6">Add an extra layer of security using an authenticator app like Google Authenticator or Authy.</p>
            <Button onClick={startSetup} loading={loading}>Set up authenticator</Button>
          </CardBody>
        </Card>
      )}

      {step === "setup" && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Scan QR code</h2></CardHeader>
          <CardBody className="space-y-4">
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrCode }} />
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Manual entry key</p>
              <p className="text-sm font-mono text-zinc-800 break-all">{secret}</p>
            </div>
            <Button className="w-full" onClick={() => setStep("confirm")}>I've scanned it →</Button>
          </CardBody>
        </Card>
      )}

      {step === "confirm" && (
        <Card>
          <form onSubmit={confirmSetup}>
            <CardHeader><h2 className="text-sm font-semibold">Confirm setup</h2></CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-zinc-500">Enter the 6-digit code from your authenticator app to complete setup.</p>
              <Input label="Verification code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
            </CardBody>
            <CardFooter>
              <Button type="submit" loading={loading}>Confirm</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardBody className="space-y-4">
            <Alert variant="success" title="MFA enabled!">Save these recovery codes in a secure place. They can only be shown once.</Alert>
            <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-4 rounded-lg">
              {recoveryCodes.map((c, i) => (
                <span key={i} className="font-mono text-sm bg-white border border-zinc-200 rounded px-2 py-1">{c}</span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
