import { AppShell } from "@/components/app-shell";
import { AdminAuthGate } from "@/features/auth/components/admin-auth-gate";

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
