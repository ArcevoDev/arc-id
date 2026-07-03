// src/components/arc/dialog/step-up-dialog.tsx
"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Icons } from "@/lib/ui/icon-registry";
import { SdkError } from "@/sdk/client";

interface StepUpDialogProps {
  open: boolean;
  onCancel: () => void;
  onVerify: (method: "password" | "totp", credential: string) => Promise<void>;
}

export function StepUpDialog({ open, onCancel, onVerify }: StepUpDialogProps) {
  const [method, setMethod] = useState<"password" | "totp">("password");
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onVerify(method, credential);
      setCredential("");
    } catch (err) {
      setError(err instanceof SdkError ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.shieldAlert className="w-4 h-4" />
            Confirm it&apos;s you
          </DialogTitle>
          <DialogDescription>
            This action requires recent re-authentication. Verify your identity
            to continue.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert
            variant="destructive"
            className="text-sm flex items-start gap-2"
          >
            <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </Alert>
        )}

        <Tabs
          value={method}
          onValueChange={(v) => {
            setMethod(v as "password" | "totp");
            setCredential("");
            setError(null);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="password" className="flex-1">
              Password
            </TabsTrigger>
            <TabsTrigger value="totp" className="flex-1">
              Authenticator code
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <TabsContent value="password" className="space-y-1.5 mt-0">
              <Label htmlFor="step-up-password">Password</Label>
              <Input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                required
              />
            </TabsContent>

            <TabsContent value="totp" className="space-y-1.5 mt-0">
              <Label htmlFor="step-up-totp">6-digit code</Label>
              <Input
                id="step-up-totp"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={credential}
                onChange={(e) =>
                  setCredential(e.target.value.replace(/\D/g, ""))
                }
                required
              />
            </TabsContent>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !credential}>
                {loading ? (
                  <>
                    <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
