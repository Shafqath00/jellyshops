"use client";

import { Fragment, useEffect, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { toShopAdmin, useShopSlug } from "./admin-routing";

/**
 * Admin pages for one shop (`/admin/s/<shop>/...`). The shop comes from the address: the merchant must be a member,
 * and the active store follows the address. A shop the merchant can't open looks the same whether it exists or not.
 * The backend still checks access on every request; this only decides what to draw.
 */
export function ShopAdminGate({ children }: { children: ReactNode }) {
  const shop = useShopSlug();
  const { stores, activeStore, setActiveStoreId, merchantStatus } = useAuth();
  const match = stores.find((store) => store.slug === shop);

  useEffect(() => {
    if (match && activeStore?.id !== match.id) setActiveStoreId(match.id);
  }, [activeStore?.id, match, setActiveStoreId]);

  if (merchantStatus !== "ready") return <AdminLoading />;
  if (!match) return <NoShopAccess />;
  if (activeStore?.id !== match.id) return <AdminLoading />;
  // A fresh tree per shop, so nothing from the last shop's pages carries over.
  return <Fragment key={match.id}>{children}</Fragment>;
}

function AdminLoading() {
  return <div className="jk-page" role="status" aria-live="polite"><LoaderCircle className="animate-spin" size={20} aria-hidden="true" /><span className="sr-only">Loading</span></div>;
}

/** "You don't have access to this shop": never says whether the shop exists. */
export function NoShopAccess() {
  const { session, stores, signOut } = useAuth();
  const email = session?.user.email;
  const switchAccount = async () => {
    const next = typeof window === "undefined" ? "/admin" : window.location.pathname + window.location.search;
    await signOut();
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  };
  return (
    <main className="jk-page">
      <section className="jk-card jk-stack" aria-labelledby="no-access-title">
        <h1 id="no-access-title" className="jk-title">You don&apos;t have access to this shop</h1>
        <p>{email ? <>You&apos;re signed in as <strong>{email}</strong>. </> : null}Ask the shop owner to invite you, or sign in with another account.</p>
        <div className="jk-row">
          <button type="button" className="jk-button" onClick={switchAccount}>Switch account</button>
        </div>
        {stores.length > 0 && <div className="jk-stack-sm">
          <h2 className="jk-subtitle">Your shops</h2>
          <ul className="jk-rows">{stores.map((store) => <li key={store.id} className="jk-rows-item"><a href={toShopAdmin(store.slug, "/admin")}>{store.name}</a></li>)}</ul>
        </div>}
      </section>
    </main>
  );
}

/**
 * `/admin` with no shop, and old addresses like `/admin/orders`: open the shop the merchant last used (the first one
 * otherwise), keeping the rest of the address.
 */
export function OpenLastShop({ path }: { path: string }) {
  const { activeStore, merchantStatus } = useAuth();
  useEffect(() => {
    if (merchantStatus !== "ready" || !activeStore) return;
    const search = typeof window === "undefined" ? "" : window.location.search + window.location.hash;
    window.location.replace(toShopAdmin(activeStore.slug, `${path}${search}`));
  }, [activeStore, merchantStatus, path]);
  return <AdminLoading />;
}
