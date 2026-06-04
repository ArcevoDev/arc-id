"use client";
import { useState } from "react";
import { credentials as credApi } from "@/lib/api";
import { Button, Input, Alert, Card, CardBody, CardHeader, CardFooter, Badge } from "@/components/ui";

export default function CredentialsPage() {
  const [tab, setTab] = useState<"issue" | "verify" | "revoke">("issue");

  // Issue form
  const [issueForm, setIssueForm] = useState({ subjectDid: "", subject: "{}", credType: "VerifiableCredential" });
  const [issueResult, setIssueResult] = useState<any>(null);
  const [issueError, setIssueError] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);

  // Verify form
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState("");

  // Revoke form
  const [revokeId, setRevokeId] = useState("");
  const [revokeSuccess, setRevokeSuccess] = useState("");
  const [revokeError, setRevokeError] = useState("");

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueError(""); setIssueResult(null);
    setIssueLoading(true);
    try {
      let subject: any = {};
      try { subject = JSON.parse(issueForm.subject); } catch { setIssueError("Invalid JSON in credential subject"); setIssueLoading(false); return; }
      const res = await credApi.issue({ subjectDid: issueForm.subjectDid, credentialSubject: subject, type: ["VerifiableCredential", issueForm.credType].filter(Boolean) });
      setIssueResult(res.data);
    } catch (err: any) { setIssueError(err.message); }
    finally { setIssueLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(""); setVerifyResult(null);
    try {
      const res = await credApi.verify({ credential: verifyToken });
      setVerifyResult(res.data);
    } catch (err: any) { setVerifyError(err.message); }
  }

  async function handleRevoke(e: React.FormEvent) {
    e.preventDefault();
    setRevokeError(""); setRevokeSuccess("");
    try {
      await credApi.revoke(revokeId);
      setRevokeSuccess("Credential revoked successfully.");
    } catch (err: any) { setRevokeError(err.message); }
  }

  const tabs = [
    { id: "issue", label: "Issue" },
    { id: "verify", label: "Verify" },
    { id: "revoke", label: "Revoke" },
  ] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Verifiable Credentials</h1>
        <p className="text-sm text-zinc-500 mt-1">Issue, verify, and revoke W3C Verifiable Credentials</p>
      </div>

      <div className="flex gap-1 border border-zinc-200 rounded-lg p-1 bg-zinc-50 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${tab === t.id ? "bg-white shadow text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "issue" && (
        <Card>
          <form onSubmit={handleIssue}>
            <CardHeader><h2 className="text-sm font-semibold">Issue Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {issueError && <Alert variant="error">{issueError}</Alert>}
              {issueResult && <Alert variant="success" title="Credential issued">ID: <code className="font-mono text-xs">{issueResult.credentialId}</code></Alert>}
              <Input label="Subject DID" value={issueForm.subjectDid} onChange={e => setIssueForm(p => ({ ...p, subjectDid: e.target.value }))} placeholder="did:web:..." required />
              <Input label="Credential type" value={issueForm.credType} onChange={e => setIssueForm(p => ({ ...p, credType: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1">Credential subject (JSON)</label>
                <textarea value={issueForm.subject} onChange={e => setIssueForm(p => ({ ...p, subject: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono min-h-[120px]" />
              </div>
            </CardBody>
            <CardFooter>
              <Button type="submit" loading={issueLoading}>Issue credential</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === "verify" && (
        <Card>
          <form onSubmit={handleVerify}>
            <CardHeader><h2 className="text-sm font-semibold">Verify Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {verifyError && <Alert variant="error">{verifyError}</Alert>}
              {verifyResult && (
                <Alert variant={verifyResult.valid ? "success" : "error"} title={verifyResult.valid ? "Valid ✅" : "Invalid ❌"}>
                  {JSON.stringify(verifyResult, null, 2)}
                </Alert>
              )}
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1">JWT / credential token</label>
                <textarea value={verifyToken} onChange={e => setVerifyToken(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono min-h-[100px]" placeholder="eyJ..." required />
              </div>
            </CardBody>
            <CardFooter>
              <Button type="submit">Verify</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === "revoke" && (
        <Card>
          <form onSubmit={handleRevoke}>
            <CardHeader><h2 className="text-sm font-semibold">Revoke Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {revokeError && <Alert variant="error">{revokeError}</Alert>}
              {revokeSuccess && <Alert variant="success">{revokeSuccess}</Alert>}
              <Input label="Credential ID (urn:uuid:...)" value={revokeId} onChange={e => setRevokeId(e.target.value)} required />
            </CardBody>
            <CardFooter>
              <Button type="submit" variant="danger">Revoke credential</Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
