import { AppShell } from "@/components/layout/app-shell";
import { AdminAuthGate } from "@/features/auth/components/admin-auth-gate";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import "./admin.css";
import "./admin-kit.css";
import "./admin-shell.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminAuthGate>
        <AppShell>{children}</AppShell>
      </AdminAuthGate>
    </AuthProvider>
  );
}
