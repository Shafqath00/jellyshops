"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { Product } from "@/lib/domain";
import { ProductBuilder } from "./product-builder";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

/** Loads a saved product and opens it in the builder. Digital products stay in the classic editor. */
export function ProductBuilderEdit({ productId }: { productId: string }) {
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id;
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: API_URL, token }) : null, [token]);
  const scope = `${storeId}:${productId}`;
  const [loaded, setLoaded] = useState<{ scope: string; product: Product | null; error?: string } | null>(null);

  useEffect(() => {
    if (!api || !storeId) return;
    let active = true;
    api.getProduct(storeId, productId)
      .then((result) => { if (active) setLoaded({ scope, product: result ? catalogProductToStorefrontProduct(result) : null }); })
      .catch((error: unknown) => { if (active) setLoaded({ scope, product: null, error: error instanceof Error ? error.message : "Could not load this product." }); });
    return () => { active = false; };
  }, [api, storeId, productId, scope]);

  if (loaded?.scope !== scope) return <p aria-live="polite">Loading product…</p>;
  if (loaded.error) return <p role="alert">{loaded.error}</p>;
  if (!loaded.product) return <p>Product not found. <Link href="/admin/products" className="underline">Back to products</Link></p>;
  return <ProductBuilder key={scope} initial={loaded.product} />;
}
