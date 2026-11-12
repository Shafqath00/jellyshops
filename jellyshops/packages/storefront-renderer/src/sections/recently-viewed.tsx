import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { SectionNode } from "@jelly/storefront-schema";
import { ProductCard } from "../product-card";
import { elementProps } from "../element-style";
import type { CommerceDataProvider, PublicProduct } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { sectionData } from "./shared";
import { balancedColumns } from "../row-columns";

const EMPTY: readonly string[] = [];
const NO_SUBSCRIPTION = () => () => undefined;

/** Picks the products the shopper looked at, newest first, leaving out the product on screen. */
export function recentlyViewedProducts(ids: readonly string[], products: readonly PublicProduct[], currentId: string | undefined, limit: number): PublicProduct[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.flatMap((id) => {
    if (id === currentId) return [];
    const product = byId.get(id);
    return product ? [product] : [];
  }).slice(0, limit);
}

/**
 * "Recently viewed": the products this shopper opened before, from a list kept in their own browser
 * (`commerce.recentlyViewed`). Hidden on the live store until there is something to show. In the editor it shows
 * the store's first products, so the merchant can see and style the row.
 */
export function RecentlyViewedSection({ context, section, commerce }: { context: StorefrontRuntimeContext; section: SectionNode; commerce: CommerceDataProvider }) {
  const editor = context.mode === "editor";
  const access = commerce.recentlyViewed;
  const ids = useSyncExternalStore(access?.subscribe ?? NO_SUBSCRIPTION, access?.ids ?? (() => EMPTY), () => EMPTY);
  const [loaded, setLoaded] = useState<{ source: CommerceDataProvider; products: PublicProduct[] }>();
  const wanted = editor || ids.length > 0;
  useEffect(() => {
    if (!wanted) return;
    let active = true;
    void commerce.getProducts({ limit: 200 }).then((products) => { if (active) setLoaded({ source: commerce, products }); }).catch(() => { if (active) setLoaded({ source: commerce, products: [] }); });
    return () => { active = false; };
  }, [commerce, wanted]);
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit) ? Math.max(1, Math.min(12, section.settings.limit)) : 4;
  const columns = typeof section.settings.columns === "number" && Number.isInteger(section.settings.columns) ? Math.max(2, Math.min(4, section.settings.columns)) : 4;
  const currentId = context.page?.pageType === "product" ? context.page.resource.id : undefined;
  const all = loaded?.source === commerce ? loaded.products : commerce.initialProducts ?? [];
  const products = editor ? all.slice(0, limit) : recentlyViewedProducts(ids, all, currentId, limit);
  if (products.length === 0 && !editor) return null;
  const heading = typeof section.settings.heading === "string" && section.settings.heading.trim() ? section.settings.heading : "Recently viewed";
  const cardEditorProps = editor ? elementProps(section, "productCard", true) as Record<string, string> : undefined;
  return <section className="jelly-section jelly-product-grid jelly-recently-viewed" {...sectionData(section)}><StorefrontContainer>
    <div className="jelly-section-header"><h2 {...elementProps(section, "heading", editor)}>{heading}</h2></div>
    {editor && <p className="jelly-recently-viewed-note">Shoppers see the products they opened most recently. The row stays hidden until they have opened one.</p>}
    {editor && products.length === 0 && <p className="jelly-empty-state">Products will appear here once you add them to your store.</p>}
    <div className="jelly-product-grid-items" data-count={products.length} style={{ "--jelly-columns": balancedColumns(products.length, columns) } as CSSProperties}>{products.map((product) => <ProductCard key={product.id} product={product} editorProps={cardEditorProps} />)}</div>
  </StorefrontContainer></section>;
}
