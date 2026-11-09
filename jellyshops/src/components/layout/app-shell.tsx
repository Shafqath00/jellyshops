"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Menu } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AdminNav } from "./admin-nav";
import { AdminSearch } from "./admin-search";
import { AccountMenu, storeInitial } from "./account-menu";
import { AdminThemeToggle } from "./admin-theme-toggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToastProvider } from "@/components/admin/toast";

/**
 * Admin frame: top bar (brand, page search, store actions), sidebar navigation from 1024px,
 * the same navigation in a drawer below that, and the page canvas. Styles: app/admin/admin-shell.css.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeStore: store, stores, setActiveStoreId, session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add("admin-ui");
    return () => document.documentElement.classList.remove("admin-ui");
  }, []);
  if (!store) return null;
  const storeCard = <div className="admin-sidebar-footer"><div className="admin-store-card">
    <span className="admin-avatar" aria-hidden="true">{storeInitial(store.name)}</span>
    {stores.length > 1 ? <label className="min-w-0 flex-1"><span className="admin-store-card-label">Active store</span>
      <select aria-label="Switch store" value={store.id} onChange={(event) => setActiveStoreId(event.target.value)}>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> :
      <div><span className="admin-store-card-label">Active store</span><span className="admin-store-card-name">{store.name}</span></div>}
  </div></div>;
  return <ToastProvider><div className="admin-shell">
    <header className="admin-topbar">
      <div className="admin-topbar-start">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button type="button" aria-label="Open navigation" className="admin-topbar-button admin-menu-button"><Menu size={20} /></button></SheetTrigger>
          <SheetContent side="left" className="admin-drawer">
            <SheetTitle className="admin-drawer-head"><span className="admin-brand-mark" aria-hidden="true">J</span>Jelly Shops</SheetTitle>
            <SheetDescription className="sr-only">Find a page in your store admin.</SheetDescription>
            <AdminNav onNavigate={() => setMenuOpen(false)} />{storeCard}
          </SheetContent>
        </Sheet>
        <Link href="/admin" className="admin-brand" aria-label="Jelly Shops home"><span className="admin-brand-mark" aria-hidden="true">J</span><span className="admin-brand-name">Jelly Shops</span></Link>
      </div>
      <div className="admin-topbar-center"><AdminSearch /></div>
      <div className="admin-topbar-end">
        <AdminThemeToggle className="admin-topbar-button" />
        <Link href={`/${store.slug}`} className="admin-topbar-button" aria-label="View store" title="View store"><ExternalLink size={16} aria-hidden="true" /><span className="admin-topbar-label">View store</span></Link>
        <AccountMenu storeName={store.name} storeSlug={store.slug} email={session?.user.email ?? undefined} onSignOut={() => { void signOut(); }} />
      </div>
    </header>
    <aside className="admin-sidebar" aria-label="Sidebar"><AdminNav />{storeCard}</aside>
    <div className="admin-workspace"><main className="admin-content">{children}</main></div>
  </div></ToastProvider>;
}
