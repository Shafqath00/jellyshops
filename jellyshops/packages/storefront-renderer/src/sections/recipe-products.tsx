import { useEffect, useState, type CSSProperties } from "react";
import { ProductCard } from "../product-card";
import type { BlockNode } from "@jelly/storefront-schema";

import type { StorefrontRuntimeContext } from "../runtime-context";
import type { CommerceDataProvider, PublicProduct } from "../types";

/**
 * The "products" element of a section recipe: a grid of the store's products (the featured list,
 * or one collection the merchant picked). Generated from the recipe, never stored, so it has no
 * editor controls of its own; the merchant sets the collection and count on the section.
 */
export function RecipeProducts({ block, context }: { block: BlockNode; context: StorefrontRuntimeContext }) {
  const limit = typeof block.settings.limit === "number" ? Math.max(1, Math.min(12, block.settings.limit)) : 4;
  const columns = typeof block.settings.columns === "number" ? Math.max(2, Math.min(4, block.settings.columns)) : 4;
  const collectionId = typeof block.settings.collectionId === "string" && block.settings.collectionId ? block.settings.collectionId : undefined;
  const scope = `${limit}|${collectionId ?? ""}`;
  const [result, setResult] = useState<{ source: CommerceDataProvider; scope: string; products: PublicProduct[] }>();
  useEffect(() => {
    let active = true;
    void context.commerce.getProducts({ featured: !collectionId, limit, ...(collectionId ? { collectionId } : {}) })
      .then((products) => { if (active) setResult({ source: context.commerce, scope, products: products.slice(0, limit) }); })
      .catch(() => { if (active) setResult({ source: context.commerce, scope, products: [] }); });
    return () => { active = false; };
  }, [context.commerce, scope, limit, collectionId]);
  const current = result?.source === context.commerce && result.scope === scope ? result.products : undefined;
  const products = current ?? (collectionId ? [] : context.commerce.initialProducts?.slice(0, limit) ?? []);
  if (!products.length) return null;
  return <div className="jelly-product-grid-items jelly-recipe-products" style={{ "--jelly-columns": columns } as CSSProperties}>
    {products.map((product) => <ProductCard key={product.id} product={product} />)}
  </div>;
}
