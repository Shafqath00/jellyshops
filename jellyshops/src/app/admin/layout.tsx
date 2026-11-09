import { AppShell } from "@/components/layout/app-shell";
import { AdminAuthGate } from "@/features/auth/components/admin-auth-gate";
import "./admin.css";
import "./admin-kit.css";
import "./admin-shell.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGate>
      <AppShell>{children}</AppShell>
    </AdminAuthGate>
  );
}
