// src/app/(auth)/layout.tsx
import { AppLayout } from "@/components/layout/app-layout";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout variant="centered" maxWidth="max-w-md">
      {children}
    </AppLayout>
  );
}
