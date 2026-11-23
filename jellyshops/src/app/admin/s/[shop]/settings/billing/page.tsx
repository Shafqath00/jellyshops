"use client";
import { AdminPage } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { BillingSettings } from "@/features/billing/billing-settings";

export default function BillingSettingsPage() {
  const { activeStore, session } = useAuth();
  return <AdminPage title="Plan and billing" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="Your plan, your free trial and how much of your plan this shop uses.">
    {activeStore && session ? <BillingSettings key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <p>Select a store to see its plan.</p>}
  </AdminPage>;
}
