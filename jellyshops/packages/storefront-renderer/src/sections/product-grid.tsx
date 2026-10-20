import { useEffect, useState } from "react";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct } from "../types";

export function ProductGridSection({ commerce, section }: { commerce: CommerceDataProvider; section: import("@jelly/storefront-schema").SectionNode }) {
  const [result, setResult] = useState<{ source: CommerceDataProvider; limit: number; scope: string; products: PublicProduct[]; error?: boolean }>();
  const [retry, setRetry] = useState(0);
  const sort = typeof section.settings.sort === "string" ? section.settings.sort : undefined;
  const collectionId = typeof section.settings.collectionId === "string" ? section.settings.collectionId : undefined;
  const scope = JSON.stringify([sort, collectionId, retry]);
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit)
    ? Math.max(1, Math.min(24, section.settings.limit))
    : 6;
  const heading = typeof section.settings.heading === "string" ? section.settings.heading : "";
  const emptyMessage = typeof section.settings.emptyMessage === "string"
    ? section.settings.emptyMessage
    : "Products will appear here once you add them to your store.";
  const current = result?.source === commerce && result.limit === limit && result.scope === scope ? result : undefined;
  const initial = sort || collectionId ? undefined : commerce.initialProducts;
  const products = current?.products ?? initial?.slice(0, limit) ?? [];
  const loaded = Boolean(current || initial);
  useEffect(() => {
    let active = true;
    void commerce.getProducts({ featured: true, limit, ...(sort ? { sort } : {}), ...(collectionId ? { collectionId } : {}) }).then((result) => {
      if (active) {
        setResult({ source: commerce, limit, scope, products: result.slice(0, limit) });
      }
    }).catch(() => {
      if (active) {
        setResult({ source: commerce, limit, scope, products: [], error: true });
      }
    });
    return () => { active = false; };
  }, [commerce, limit, scope, sort, collectionId]);
  if (loaded && !products.length && !current?.error && section.settings.hideWhenEmpty === true) return null;
  return <section className="jelly-section jelly-product-grid"><StorefrontContainer>
    {heading && <h2>{heading}</h2>}
    {current?.error ? <p role="alert">Products are temporarily unavailable. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p> : loaded && products.length === 0 && <p>{emptyMessage}</p>}
    <div className="jelly-product-grid-items">{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
  </StorefrontContainer></section>;
}
