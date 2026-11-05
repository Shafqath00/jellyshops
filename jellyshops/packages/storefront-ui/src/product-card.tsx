export interface StorefrontProductCardData { name: string; href: string; imageUrl: string; price: string; compareAtPrice?: string; badge?: string; saving?: string; discountPercent?: number; chip?: string }

export function StorefrontProductCard({ product }: { product: StorefrontProductCardData }) {
  return <article className="jelly-product-card">
    <a href={product.href}>
      <div className="jelly-product-card-media">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : <span className="jelly-product-card-placeholder" aria-hidden="true" />}
        {product.badge && <span className="jelly-product-card-badge">{product.badge}</span>}
        {/* Hidden unless the theme's "Sale badge" setting is on. */}
        {!product.badge && product.compareAtPrice && <span className="jelly-product-card-badge" data-badge="sale">Sale</span>}
      </div>
      <div className="jelly-product-card-body">
        <h3>{product.name}</h3>
        <p className="jelly-product-card-price">
          <span>{product.price}</span>
          {product.compareAtPrice && <s aria-label={`Was ${product.compareAtPrice}`}>{product.compareAtPrice}</s>}
        </p>
        {/* Hidden unless the theme's card "Savings" setting is on. */}
        {(product.saving || product.discountPercent) && <p className="jelly-product-card-saving">
          {product.saving && <span data-saving="amount">Save {product.saving}</span>}
          {product.discountPercent ? <span data-saving="percent">{product.discountPercent}% off</span> : null}
        </p>}
        {product.chip && <span className="jelly-product-card-chip">{product.chip}</span>}
        {/* Hidden unless the theme's card "Button" setting is on; the label comes from the theme (the link already names the product). */}
        <span className="jelly-product-card-button" aria-hidden="true" />
      </div>
    </a>
  </article>;
}
