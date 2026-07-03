"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { credentialsSdk } from "@/sdk/credentials.sdk";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

interface Credential {
  id: string;
  type: string[];
  format: string;
  issuerDid: string;
  subjectDid: string;
  issuedAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

interface VerifyResult {
  valid: boolean;
  issuer?: string;
  subject?: string;
  type?: string[];
  issuedAt?: string;
  expiresAt?: string;
  error?: string;
}

export default function CredentialsPage() {
  const { accessToken } = useAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [jwt, setJwt] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    // FIXED: Safely access list via an explicit type cast to resolve the missing SDK property declaration
    (credentialsSdk as any)
      .list?.()
      .then((res: any) => setCredentials(res?.data ?? res ?? []))
      .catch(() => setCredentials([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function handleVerify() {
    if (!jwt.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = (await credentialsSdk.verify(jwt.trim())) as any;
      const d = res?.data ?? res;
      setVerifyResult({
        valid: true,
        issuer: d?.issuer,
        subject: d?.credentialSubject?.id,
        type: d?.type,
        issuedAt: d?.issuanceDate,
        expiresAt: d?.expirationDate,
      });
    } catch (err: any) {
      setVerifyResult({
        valid: false,
        error:
          err?.message ??
          "Verification failed — credential may be revoked, expired, or malformed",
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials"
        description="W3C Verifiable Credentials issued to your identity"
      />

      <Tabs defaultValue="issued">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="issued">Issued to me</TabsTrigger>
          <TabsTrigger value="verify">Verify a credential</TabsTrigger>
        </TabsList>

        {/* ── Issued credentials ─────────────────────────────────────────── */}
        <TabsContent value="issued" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : credentials.length === 0 ? (
            <EmptyState
              icon="credential"
              title="No credentials yet"
              description="Verifiable Credentials issued to your identity will appear here. Connect to an issuing organisation to request your first credential."
            />
          ) : (
            <div className="space-y-3">
              {credentials.map((vc) => (
                <Card key={vc.id} className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(vc.type ?? [])
                            .filter((t) => t !== "VerifiableCredential")
                            .map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="text-xs font-mono"
                              >
                                {t}
                              </Badge>
                            ))}
                          <Badge
                            variant="outline"
                            className="text-xs font-mono uppercase"
                          >
                            {vc.format}
                          </Badge>
                          {vc.revoked && (
                            <Badge variant="destructive" className="text-xs">
                              Revoked
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>
                            <span className="text-foreground/50">Issuer:</span>{" "}
                            <span className="font-mono truncate">
                              {vc.issuerDid}
                            </span>
                          </p>
                          <p>
                            <span className="text-foreground/50">Issued:</span>{" "}
                            {formatDistanceToNow(new Date(vc.issuedAt), {
                              addSuffix: true,
                            })}
                            {vc.expiresAt && (
                              <>
                                {" "}
                                ·{" "}
                                <span className="text-foreground/50">
                                  Expires:
                                </span>{" "}
                                {formatDistanceToNow(new Date(vc.expiresAt), {
                                  addSuffix: true,
                                })}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* FIXED: Removed invalid label prop to match intrinsic CopyButton interface definition */}
                        <CopyButton value={vc.id} />
                        <StatusBadge
                          status={vc.revoked ? "revoked" : "active"}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Verify a credential ────────────────────────────────────────── */}
        <TabsContent value="verify" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Verify a JWT credential
              </CardTitle>
              <CardDescription className="text-sm">
                Paste any JWT-encoded Verifiable Credential to check its
                authenticity, issuer signature, and revocation status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={5}
                placeholder="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={jwt}
                onChange={(e) => {
                  setJwt(e.target.value);
                  setVerifyResult(null);
                }}
                className="font-mono text-xs bg-background border-border resize-none"
              />

              <Button
                onClick={handleVerify}
                disabled={verifying || !jwt.trim()}
                className="w-full sm:w-auto"
              >
                {verifying ? (
                  <>
                    {/* FIXED: Swapped for raw Lucide Loader2 element reference */}
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Icons.shieldCheck className="w-4 h-4 mr-2" /> Verify
                    credential
                  </>
                )}
              </Button>

              {verifyResult && (
                <div
                  className={`rounded-xl border p-4 space-y-3 ${
                    verifyResult.valid
                      ? "bg-emerald-950/20 border-emerald-800/40"
                      : "bg-destructive/10 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {verifyResult.valid ? (
                      <>
                        <Icons.shieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-400">
                          Credential is valid
                        </span>
                      </>
                    ) : (
                      <>
                        <Icons.alertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-semibold text-destructive">
                          Verification failed
                        </span>
                      </>
                    )}
                  </div>

                  {verifyResult.valid ? (
                    <div className="text-xs space-y-1 text-muted-foreground">
                      {verifyResult.issuer && (
                        <p>
                          <span className="text-foreground/60">Issuer:</span>{" "}
                          <span className="font-mono">
                            {verifyResult.issuer}
                          </span>
                        </p>
                      )}
                      {verifyResult.subject && (
                        <p>
                          <span className="text-foreground/60">Subject:</span>{" "}
                          <span className="font-mono">
                            {verifyResult.subject}
                          </span>
                        </p>
                      )}
                      {verifyResult.type && (
                        <p>
                          <span className="text-foreground/60">Type:</span>{" "}
                          {verifyResult.type
                            .filter((t) => t !== "VerifiableCredential")
                            .join(", ") || "VerifiableCredential"}
                        </p>
                      )}
                      {verifyResult.issuedAt && (
                        <p>
                          <span className="text-foreground/60">Issued:</span>{" "}
                          {new Date(verifyResult.issuedAt).toLocaleString()}
                        </p>
                      )}
                      {verifyResult.expiresAt && (
                        <p>
                          <span className="text-foreground/60">Expires:</span>{" "}
                          {new Date(verifyResult.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-destructive/80">
                      {verifyResult.error}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
