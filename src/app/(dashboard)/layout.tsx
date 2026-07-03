import { ConsoleLayout } from "@/components/layout/console-layout";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConsoleLayout>{children}</ConsoleLayout>;
}
