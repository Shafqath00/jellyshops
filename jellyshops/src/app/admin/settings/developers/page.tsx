"use client";
import { AdminPage } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { DeveloperTokensSettings } from "@/features/developer-tokens/developer-tokens-settings";

export default function DeveloperSettingsPage() {
  const { activeStore, session } = useAuth();
  return <AdminPage title="Developer access" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="Give a developer a token so they can upload and install themes for this store. You can turn a token off at any time.">
    {activeStore && session ? <DeveloperTokensSettings key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <p>Select a store to manage its settings.</p>}
  </AdminPage>;
}
