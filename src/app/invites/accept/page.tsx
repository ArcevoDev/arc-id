"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@arcevo/facet-store";
import { useTenant } from "@/hooks/use-tenant";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@arcevo/facet-components";
import { PageHeader } from "@arcevo/facet-layout";

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { accessToken } = useAuthStore();
  const { hydrateTenants, acceptInvite } = useTenant();
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (token && status === "idle") {
      setStatus("processing");
      acceptInvite(token)
        .then((result) => {
          if (result.error) {
            setStatus("error");
            setErrorMsg(result.error.message);
          } else {
            setStatus("success");
            hydrateTenants().then(() => {
              router.replace("/console");
            });
          }
        })
        .catch(() => {
          setStatus("error");
          setErrorMsg("Failed to accept invitation.");
        });
    }
  }, [token, accessToken, status, router, hydrateTenants]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            {status === "processing" && "Processing your invitation..."}
            {status === "error" && errorMsg}
            {status === "success" && "Redirecting to your console..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "error" && (
            <Button onClick={() => router.replace("/home")}>
              Go Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
