import { DashboardShell } from "@/components/layout/DashboardShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
