import { useEffect, useState } from "react";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct } from "../types";

export function ProductGridSection({ commerce }: { commerce: CommerceDataProvider }) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  useEffect(() => { void commerce.getProducts({ featured: true, limit: 6 }).then(setProducts); }, [commerce]);
  return <section className="jelly-section jelly-product-grid"><StorefrontContainer><div className="jelly-product-grid-items">{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div></StorefrontContainer></section>;
}
