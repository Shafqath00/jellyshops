export interface StorefrontProductCardData { name: string; href: string; imageUrl: string; price: string }

export function StorefrontProductCard({ product }: { product: StorefrontProductCardData }) {
  return <article className="jelly-product-card"><a href={product.href}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : null}<h3>{product.name}</h3><p>{product.price}</p></a></article>;
}
