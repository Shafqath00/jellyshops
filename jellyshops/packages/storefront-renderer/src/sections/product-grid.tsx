import { useEffect, useState, type CSSProperties } from "react";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct } from "../types";
import { resolveStorefrontHref } from "../runtime-context";
import { sectionData } from "./shared";

export function ProductGridSection({ commerce, section, storeSlug }: { commerce: CommerceDataProvider; section: import("@jelly/storefront-schema").SectionNode; storeSlug?: string }) {
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
  const intro = typeof section.settings.text === "string" ? section.settings.text : "";
  const viewAllLabel = typeof section.settings.viewAllLabel === "string" ? section.settings.viewAllLabel.trim() : "";
  const viewAllHref = viewAllLabel ? resolveStorefrontHref(section.settings.viewAllLink || "/shop", storeSlug) : null;
  const columns = typeof section.settings.columns === "number" && Number.isInteger(section.settings.columns) ? Math.max(2, Math.min(4, section.settings.columns)) : 4;
  return <section className="jelly-section jelly-product-grid" {...sectionData(section)}><StorefrontContainer>
    {(heading || viewAllHref) && <div className="jelly-section-header">
      <div>{heading && <h2>{heading}</h2>}{intro && <p>{intro}</p>}</div>
      {viewAllHref && <a className="jelly-button jelly-button--link" href={viewAllHref}>{viewAllLabel}</a>}
    </div>}
    {current?.error ? <p role="alert">Products are temporarily unavailable. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p> : loaded && products.length === 0 && <p className="jelly-empty-state">{emptyMessage}</p>}
    <div className="jelly-product-grid-items" style={{ "--jelly-columns": columns } as CSSProperties}>{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
  </StorefrontContainer></section>;
}
