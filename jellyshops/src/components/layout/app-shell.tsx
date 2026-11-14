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
 * Admin frame (Jelly look): sidebar with the brand on the stone page from 1024px, and a rounded canvas
 * whose header row holds page search and store actions. Below 1024px the sidebar moves into a drawer. Styles: app/admin/admin-shell.css.
 */
/** Lime Jelly mark used in the sidebar, the phone header and the drawer. */
function BrandMark() {
  return <span className="admin-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 9.5a7 7 0 0 1 14 0v4.2c0 .9-.7 1.6-1.6 1.6-.6 0-1.1-.3-1.4-.8a1.8 1.8 0 0 0-3.2 0 1.8 1.8 0 0 1-3.2 0 1.8 1.8 0 0 0-3.2 0c-.3.5-.8.8-1.4.8-.9 0-1.6-.7-1.6-1.6V9.5Z" fill="currentColor"/><circle cx="9.5" cy="10" r="1.3" fill="var(--jk-lime)"/><circle cx="14.5" cy="10" r="1.3" fill="var(--jk-lime)"/></svg></span>;
}

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
    <aside className="admin-sidebar" aria-label="Sidebar">
      <Link href="/admin" className="admin-brand admin-sidebar-brand" aria-label="Jelly Shop home"><BrandMark /><span className="admin-brand-name">jelly shop</span></Link>
      <AdminNav />{storeCard}
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div className="admin-topbar-start">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><button type="button" aria-label="Open navigation" className="admin-topbar-button admin-menu-button"><Menu size={20} /></button></SheetTrigger>
            <SheetContent side="left" className="admin-drawer">
              <SheetTitle className="admin-drawer-head"><BrandMark />jelly shop</SheetTitle>
              <SheetDescription className="sr-only">Find a page in your store admin.</SheetDescription>
              <AdminNav onNavigate={() => setMenuOpen(false)} />{storeCard}
            </SheetContent>
          </Sheet>
          <Link href="/admin" className="admin-brand admin-brand-compact" aria-label="Jelly Shop home"><BrandMark /><span className="admin-brand-name">jelly shop</span></Link>
        </div>
        <div className="admin-topbar-center"><AdminSearch /></div>
        <div className="admin-topbar-end">
          <AdminThemeToggle className="admin-topbar-button" />
          <Link href={`/${store.slug}`} className="admin-topbar-button" aria-label="View store" title="View store"><ExternalLink size={16} aria-hidden="true" /><span className="admin-topbar-label">View store</span></Link>
          <AccountMenu storeName={store.name} storeSlug={store.slug} email={session?.user.email ?? undefined} onSignOut={() => { void signOut(); }} />
        </div>
      </header>
      <main className="admin-content">{children}</main>
    </div>
  </div></ToastProvider>;
}
