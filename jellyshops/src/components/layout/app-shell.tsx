"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AdminNav } from "./admin-nav";
import { AdminThemeToggle } from "./admin-theme-toggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { activeStore: store, stores, setActiveStoreId } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add("admin-ui");
    return () => document.documentElement.classList.remove("admin-ui");
  }, []);
  if (!store) return null;
  const brand = <Link href="/admin" className="admin-brand"><span className="admin-brand-mark">J</span>Jelly Shops</Link>;
  const storePicker = <div className="admin-store-switch">{stores.length > 1 ?
    <label>Store<select aria-label="Switch store" value={store.id} onChange={event => setActiveStoreId(event.target.value)}>{stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> :
    <p className="truncate font-medium">{store.name}</p>}</div>;
  const settings = [
    { href: "/admin/settings", label: "General" }, { href: "/admin/payments", label: "Payments" },
    { href: "/admin/settings/notifications", label: "Notifications" }, { href: "/admin/settings/custom-data", label: "Extra fields" },
  ];
  return <div className="admin-shell">
    <aside className="admin-sidebar">{brand}<div className="min-h-0 flex-1 overflow-y-auto"><AdminNav /></div>{storePicker}</aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><button type="button" aria-label="Open navigation" className="admin-mobile-menu admin-button"><Menu size={18} /></button></SheetTrigger>
            <SheetContent side="left" className="admin-shell admin-panel admin-menu-panel">
              <SheetTitle className="sr-only">Navigation</SheetTitle><SheetDescription className="sr-only">Find a page in your store admin.</SheetDescription>
              {brand}<div className="min-h-0 flex-1 overflow-y-auto"><AdminNav onNavigate={() => setMenuOpen(false)} /></div>{storePicker}
            </SheetContent>
          </Sheet>
          <span className="truncate text-[13px] font-medium">{store.name}</span>
        </div>
        <div className="flex items-center gap-2"><AdminThemeToggle /><Link href={`/${store.slug}`} className="admin-button">View store<ExternalLink size={14} /></Link></div>
      </header>
      <main className="admin-content">
        {pathname.startsWith("/admin/settings") && <nav className="admin-settings-nav" aria-label="Settings">{settings.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}</nav>}
        {children}
      </main>
    </div>
  </div>;
}
