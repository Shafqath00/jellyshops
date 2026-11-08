"use client";
import { AdminPage } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { StorefrontAccessSettings } from "@/features/storefront-access/access-settings";

export default function StoreAccessSettingsPage() {
  const { activeStore, session } = useAuth();
  return <AdminPage title="Password page" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="While the password page is on, only people with the password can see your store.">
    {activeStore && session ? <StorefrontAccessSettings key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <p>Select a store to manage its settings.</p>}
  </AdminPage>;
}
