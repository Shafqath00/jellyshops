"use client";

import Link from "next/link";
import { AdminPage, Card } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { StorefrontAccessSettings } from "@/features/storefront-access/access-settings";

/** Store-wide choices that are not part of the store design itself. */
export default function PreferencesPage() {
  const { activeStore, session } = useAuth();
  return <AdminPage title="Preferences" width="narrow" description="Who can see your store, and where to change how it looks.">
    <Card title="Password protection" description="While this is on, only people with the password can see your store. Use it while you get ready to open.">
      {activeStore && session ? <StorefrontAccessSettings key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <p className="jk-muted">Select a store first.</p>}
    </Card>
    <Card title="How your store looks" description="Colours, fonts, logo, homepage and every page are set in the store design editor. Changes stay private until you publish.">
      <div className="jk-row"><Link href="/admin/online-store/editor" className="jk-button jk-button-primary">Open the design editor</Link><Link href="/admin/online-store" className="jk-button">Choose a different design</Link></div>
    </Card>
    <Card title="Store name and contact email" description="Shown in your store's header and on order emails.">
      <Link href="/admin/settings/general" className="jk-button">Edit store details</Link>
    </Card>
  </AdminPage>;
}
