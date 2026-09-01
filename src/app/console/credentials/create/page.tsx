"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@arcevo/facet-layout";
import {
  AnimatedButton,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@arcevo/facet-components";
import type { JsonObject } from "@arcevo/facet-sdk";
import { useCredentials } from "@/hooks/use-credentials";

const VC_FORMATS = ["JWT", "LDP", "SD_JWT"] as const;

export default function CreateCredentialPage() {
  const router = useRouter();
  const { issue } = useCredentials();
  const [subjectDid, setSubjectDid] = useState("");
  const [credentialSubject, setCredentialSubject] = useState(
    '{\n  "givenName": "Jane",\n  "familyName": "Doe"\n}',
  );
  const [format, setFormat] = useState<(typeof VC_FORMATS)[number]>("JWT");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let parsedClaims: JsonObject;
    try {
      parsedClaims = JSON.parse(credentialSubject) as unknown as JsonObject;
    } catch {
      setError("Credential subject must be valid JSON.");
      setIsSubmitting(false);
      return;
    }

    const result = await issue({
      subjectDid,
      credentialSubject: parsedClaims,
      format,
      ...(expiresAt ? { expiresAt } : {}),
    });
    if (result.error) {
      setError(result.error.message ?? "Failed to issue credential.");
    } else {
      router.replace("/console/credentials");
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <PageHeader
        title="Issue Credential"
        description="Create a new Verifiable Credential for a subject DID."
      />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Credential Details</CardTitle>
            <CardDescription>
              Enter the subject DID, credential claims, and issuance options.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subjectDid">Subject DID</Label>
                <Input
                  id="subjectDid"
                  value={subjectDid}
                  onChange={(e) => setSubjectDid(e.target.value)}
                  placeholder="did:key:z6Mk..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentialSubject">Credential Subject (JSON)</Label>
                <Textarea
                  id="credentialSubject"
                  value={credentialSubject}
                  onChange={(e) => setCredentialSubject(e.target.value)}
                  placeholder='{"givenName": "Jane"}'
                  rows={8}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as (typeof VC_FORMATS)[number])}>
                    <SelectTrigger id="format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VC_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3">
                <AnimatedButton
                  animation="sparkle"
                  renderButton={(props) => (
                    <Button {...props} type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Issuing…" : "Issue Credential"}
                    </Button>
                  )}
                />
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
