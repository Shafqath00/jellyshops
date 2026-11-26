"use client";

import { useMemo } from "react";
import { useAuth, authApiOrigin } from "@/features/auth/providers/auth-provider";
import { createNavigationApi } from "@/features/navigation/api/client";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { createContentApi } from "@/features/content/api/client";
import { NavigationWorkspace } from "@/features/navigation/components/navigation-workspace";
import { AdminPage, Banner } from "@/components/admin";

export default function NavigationPage() {
  const { session, activeStore } = useAuth();
  const token = session?.access_token, storeId = activeStore?.id ?? "";
  const clients = useMemo(() => token ? {
    api: createNavigationApi({ baseUrl: authApiOrigin(), token }),
    editor: createStoreEditorApi({ baseUrl: authApiOrigin(), token }),
    content: createContentApi({ baseUrl: authApiOrigin(), token }),
  } : null, [token]);
  if (!clients || !storeId) return <AdminPage title="Navigation"><Banner tone="warning">Select a store and sign in to manage navigation.</Banner></AdminPage>;
  return <NavigationWorkspace key={storeId} storeId={storeId} storeSlug={activeStore?.slug ?? ""} {...clients} />;
}
