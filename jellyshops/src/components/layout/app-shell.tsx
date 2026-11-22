"use client";
import Link, { toShopAdmin, useAdminRouter } from "@/features/admin/admin-routing";
import { useEffect, useState } from "react";
import { ExternalLink, Menu, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AdminNav } from "./admin-nav";
import { AdminSearch } from "./admin-search";
import { AccountMenu, storeInitial } from "./account-menu";
import { AdminThemeToggle } from "./admin-theme-toggle";
import { BrandLogo } from "./brand-logo";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToastProvider } from "@/components/admin/toast";
import { storeUrl } from "@jelly/storefront-schema";

/**
 * Admin frame (Jelly look): sidebar with the brand on the stone page from 1024px, and a rounded canvas
 * whose header row holds page search and store actions. Below 1024px the sidebar moves into a drawer. Styles: app/admin/admin-shell.css.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeStore: store, stores, setActiveStoreId, session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useAdminRouter();
  useEffect(() => {
    document.documentElement.classList.add("admin-ui");
    return () => document.documentElement.classList.remove("admin-ui");
  }, []);
  if (!store) return null;
  // Each shop has its own admin address: switching opens that shop's admin home.
  const switchStore = (storeId: string) => {
    const target = stores.find((item) => item.id === storeId);
    if (target) setActiveStoreId(storeId, () => router.push(toShopAdmin(target.slug, "/admin")));
  };
  const storeCard = <div className="admin-sidebar-footer"><div className="admin-store-card">
    <span className="admin-avatar" aria-hidden="true">{storeInitial(store.name)}</span>
    {stores.length > 1 ? <label className="min-w-0 flex-1"><span className="admin-store-card-label">Active store</span>
      <select aria-label="Switch store" value={store.id} onChange={(event) => switchStore(event.target.value)}>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> :
      <div><span className="admin-store-card-label">Active store</span><span className="admin-store-card-name">{store.name}</span></div>}
  </div><Link href="/admin/stores/new" className="admin-add-store" onClick={() => setMenuOpen(false)}><Plus size={14} aria-hidden="true" />Add another store</Link></div>;
  return <ToastProvider><div className="admin-shell">
    <aside className="admin-sidebar" aria-label="Sidebar">
      <Link href="/admin" className="admin-brand admin-sidebar-brand" aria-label="Jellyshop home">
        <BrandLogo height={36} variant="adaptive" />
      </Link>
      <AdminNav />{storeCard}
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div className="admin-topbar-start">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><button type="button" aria-label="Open navigation" className="admin-topbar-button admin-menu-button"><Menu size={20} /></button></SheetTrigger>
            <SheetContent side="left" className="admin-drawer">
              <SheetTitle className="admin-drawer-head">
                <BrandLogo height={36} variant="adaptive" />
                <span className="sr-only">Jellyshop</span>
              </SheetTitle>
              <SheetDescription className="sr-only">Find a page in your store admin.</SheetDescription>
              <AdminNav onNavigate={() => setMenuOpen(false)} />{storeCard}
            </SheetContent>
          </Sheet>
          <Link href="/admin" className="admin-brand admin-brand-compact" aria-label="Jellyshop home">
            <BrandLogo className="admin-brand-name" height={32} variant="adaptive" />
            <BrandLogo className="admin-brand-icon" height={32} variant="icon" />
          </Link>
        </div>
        <div className="admin-topbar-center"><AdminSearch /></div>
        <div className="admin-topbar-end">
          <AdminThemeToggle className="admin-topbar-button" />
          <Link href={storeUrl(store.slug)} className="admin-topbar-button" aria-label="View store" title="View store"><ExternalLink size={16} aria-hidden="true" /><span className="admin-topbar-label">View store</span></Link>
          <AccountMenu storeName={store.name} storeSlug={store.slug} email={session?.user.email ?? undefined} onSignOut={() => { void signOut(); }} />
        </div>
      </header>
      <main className="admin-content">{children}</main>
    </div>
  </div></ToastProvider>;
}
