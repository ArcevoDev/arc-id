// src/hooks/use-step-up.ts
"use client";
import { useState, useCallback } from "react";
import { authSdk, SdkError } from "@/sdk";
import { useAuth } from "@/hooks/use-auth";

export function useStepUp() {
  const currentSessionId = useAuth((s) => s.currentSessionId);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  /** Wrap a mutation. On STEP_UP_REQUIRED, prompts re-auth then retries once. */
  const run = useCallback(<T>(action: () => Promise<T>): Promise<T> => {
    return action().catch((err) => {
      if (err instanceof SdkError && err.code === "STEP_UP_REQUIRED") {
        return new Promise<T>((resolve, reject) => {
          setRetry(() => () => action().then(resolve, reject));
          setOpen(true);
        });
      }
      throw err;
    });
  }, []);

  const verify = useCallback(
    async (method: "password" | "totp", credential: string) => {
      if (!currentSessionId) throw new Error("No active session");
      await authSdk.stepUp(currentSessionId, method, credential);
      setOpen(false);
      retry?.();
    },
    [currentSessionId, retry],
  );

  const cancel = useCallback(() => setOpen(false), []);

  return { isOpen: open, run, verify, cancel };
}
