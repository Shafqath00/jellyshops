"use client";
import { useEffect, useState } from "react";
import { createResourceLinks, type NavigationResource } from "./resource-links";
import { useInitialNavigationResources } from "@/features/storefront/storefront-bootstrap";

/**
 * Only public content handles are loaded; failure hides unresolved destinations. Store pages get them from the server
 * with the page; only pages without them ask the backend from the browser.
 */
export function useResourceLinks(storeId: string, slug: string, products: Array<{ id: string; storeId: string; slug: string; published: boolean; archived: boolean }>) {
  const initial = useInitialNavigationResources();
  const fromServer = initial?.storeId === storeId ? initial : null;
  const [content, setContent] = useState<{ storeId: string; resources: NavigationResource[] } | null>(null);
  useEffect(() => {
    if (fromServer || !storeId) return;
    const controller = new AbortController();
    const origin = (process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
    void fetch(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/storefront/context/navigation`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return await response.json() as { resources: NavigationResource[] }; })
      .then(body => { if (!controller.signal.aborted) setContent({ storeId, resources: body.resources }); }).catch(() => undefined);
    return () => controller.abort();
  }, [storeId, fromServer]);
  return createResourceLinks(slug, [...products.filter(item => item.storeId === storeId && item.published && !item.archived).map(item => ({ kind: "product" as const, id: item.id, handle: item.slug })), ...(fromServer?.resources ?? (content?.storeId === storeId ? content.resources : []))]);
}
