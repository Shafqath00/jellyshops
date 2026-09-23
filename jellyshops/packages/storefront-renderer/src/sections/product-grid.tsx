import { useEffect, useState } from "react";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct } from "../types";

export function ProductGridSection({ commerce, section }: { commerce: CommerceDataProvider; section: import("@jelly/storefront-schema").SectionNode }) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit)
    ? Math.max(1, Math.min(24, section.settings.limit))
    : 6;
  const heading = typeof section.settings.heading === "string" ? section.settings.heading : "";
  const emptyMessage = typeof section.settings.emptyMessage === "string"
    ? section.settings.emptyMessage
    : "Products will appear here once you add them to your store.";
  useEffect(() => {
    let active = true;
    setLoaded(false);
    void commerce.getProducts({ featured: true, limit }).then((result) => {
      if (active) {
        setProducts(result.slice(0, limit));
        setLoaded(true);
      }
    }).catch(() => {
      if (active) {
        setProducts([]);
        setLoaded(true);
      }
    });
    return () => { active = false; };
  }, [commerce, limit]);
  return <section className="jelly-section jelly-product-grid"><StorefrontContainer>
    {heading && <h2>{heading}</h2>}
    {loaded && products.length === 0 && <p>{emptyMessage}</p>}
    <div className="jelly-product-grid-items">{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
  </StorefrontContainer></section>;
}
