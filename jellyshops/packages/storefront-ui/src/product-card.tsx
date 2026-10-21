export interface StorefrontProductCardData { name: string; href: string; imageUrl: string; price: string; compareAtPrice?: string; badge?: string }

export function StorefrontProductCard({ product }: { product: StorefrontProductCardData }) {
  return <article className="jelly-product-card">
    <a href={product.href}>
      <div className="jelly-product-card-media">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : <span className="jelly-product-card-placeholder" aria-hidden="true" />}
        {product.badge && <span className="jelly-product-card-badge">{product.badge}</span>}
      </div>
      <div className="jelly-product-card-body">
        <h3>{product.name}</h3>
        <p className="jelly-product-card-price">
          <span>{product.price}</span>
          {product.compareAtPrice && <s aria-label={`Was ${product.compareAtPrice}`}>{product.compareAtPrice}</s>}
        </p>
      </div>
    </a>
  </article>;
}
