"use client";

import { useAuthStore } from "@arcevo/facet-store";
import { NotFound } from "@arcevo/facet-components";
import { PublicNavbar } from "@/components/public-navbar";

export default function GlobalNotFound() {
  const { accessToken } = useAuthStore();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto">
          <PublicNavbar />
        </div>
      </header>
      <main className="flex-1">
        <NotFound
          title="Page not found"
          description="The page you are looking for does not exist or you do not have permission to access it."
          actionLabel="Go home"
          actionHref={accessToken ? "/console" : "/home"}
          animation="gradient"
        />
      </main>
    </div>
  );
}
