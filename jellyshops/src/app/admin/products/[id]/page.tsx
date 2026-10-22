"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArrowLeft } from "lucide-react";
import { ProductForm } from "@/features/commerce/components/product-form";
import { DigitalProductSettings } from "@/features/commerce/components/digital-product-settings";
import { useShop } from "@/contexts/shop-context";
import { useEffect, useMemo, useState } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";
import type { Product } from "@/lib/domain";

export function ProductEditView({
  productId,
}: {
  productId: string;
}) {
  const { repository } = useShop();
  const router = useRouter();
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id;
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  const scope = `${storeId}:${productId}`;
  const [loaded, setLoaded] = useState<{ scope: string; product: Product | null; error?: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!api || !storeId) return;
    let active = true;
    void api.getProduct(storeId, productId).then((result) => { if (active) setLoaded({ scope, product: result ? catalogProductToStorefrontProduct(result) : null }); }).catch((error: unknown) => { if (active) setLoaded({ scope, product: null, error: error instanceof Error ? error.message : "Could not load product." }); });
    return () => { active = false; };
  }, [api, storeId, productId, scope, reload]);
  const product = loaded?.scope === scope ? loaded.product : null;
  if (loaded?.scope !== scope) return <p aria-live="polite">Loading product…</p>;
  if (loaded.error) return <div role="alert">{loaded.error}<button type="button" onClick={() => setReload((value) => value + 1)}>Retry</button></div>;

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl rounded-[24px] border border-black/[0.06] bg-card p-8 text-center shadow-[0_14px_44px_rgba(83,61,66,0.05)]">
        <h1 className="text-[20px] font-black tracking-[-0.03em] text-foreground">
          Product not found
        </h1>
        <p className="mt-2 text-[12px] text-muted-foreground">
          This product may have been removed or archived.
        </p>
        <Link
          href="/admin/products"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground"
        >
          Back to products
        </Link>
      </div>
    );
  }

  const productIdForArchive = product.id;
  async function archiveProduct() {
    if (!api || !storeId) return;
    setArchiving(true);
    try {
      await api.updateProduct(storeId, productIdForArchive, { status: "ARCHIVED" });
      repository.archiveProduct(productIdForArchive);
      router.push("/admin/products");
    } catch (error) { setLoaded({ scope, product, error: error instanceof Error ? error.message : "Could not archive product." }); }
    finally { setArchiving(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Products
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-tint-foreground">
            Edit product
          </p>

          <h1 className="mt-2 truncate text-[30px] font-black tracking-[-0.045em] text-foreground sm:text-[34px]">
            {product.name}
          </h1>

          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
            Update product details, inventory, pricing, and storefront
            visibility.
          </p>
        </div>

        <button
          type="button"
          onClick={archiveProduct}
          disabled={archiving}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-tint-border bg-muted/50 px-4 text-[10px] font-black text-tint-foreground transition hover:bg-muted"
        >
          <Archive size={14} />
          Archive
        </button>
      </header>

      <ProductForm key={scope} product={product} />
      <DigitalProductSettings key={`delivery:${scope}`} productId={product.id} />
    </div>
  );
}

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();

  return <ProductEditView productId={params.id} />;
}
