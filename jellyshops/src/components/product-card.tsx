import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import { ProductBadge, ProductPrice } from "@/components/jelly/product";

/* ──────────────────────────────────────────────────────────────────────
 * ProductCard — product thumbnail card for grids
 *
 * Hover motion: CSS transform (scale image + reveal arrow icon)
 * Badge: ProductBadge from jelly/product
 * Price: ProductPrice from jelly/product
 * ──────────────────────────────────────────────────────────────────── */

export function ProductCard({
  product,
  storeSlug,
  currency,
}: {
  product: Product;
  storeSlug: string;
  currency: Currency;
}) {
  const variant = product.variants[0];
  const href = `/${storeSlug}/products/${product.slug}`;
  const lowStock = variant.stock > 0 && variant.stock <= 3;
  const soldOut = variant.stock <= 0;

  return (
    <article className="group">
      {/* Image link */}
      <Link
        href={href}
        className="relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-[#f1ece8] shadow-[0_14px_34px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 700px) 88vw, (max-width: 1100px) 45vw, 30vw"
          className="object-cover transition-transform duration-[var(--duration-jelly-slow)] ease-[var(--ease-jelly-standard)] group-hover:scale-[1.035]"
        />

        {/* Gradient overlay on hover */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-[var(--duration-jelly-standard)] group-hover:opacity-100"
        />

        {/* Stock badges */}
        {(lowStock || soldOut) && (
          <span className="absolute left-3.5 top-3.5">
            <ProductBadge variant={soldOut ? "sold-out" : "low-stock"}>
              {soldOut ? "Sold out" : `Only ${variant.stock} left`}
            </ProductBadge>
          </span>
        )}

        {/* Arrow reveal icon */}
        <span
          aria-hidden="true"
          className="absolute bottom-3.5 right-3.5 grid size-9 translate-y-2 place-items-center rounded-full bg-white text-[#2f292b] opacity-0 shadow-lg transition-[opacity,transform] duration-[var(--duration-jelly-standard)] ease-[var(--ease-jelly-decelerate)] group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </Link>

      {/* Copy */}
      <div className="flex items-start justify-between gap-5 px-1 py-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--store-text,var(--foreground))_55%,transparent)]">
            {product.category}
          </p>
          <h3 className="mt-1.5 truncate font-[var(--store-display,Georgia)] text-[19px] leading-[1.08] tracking-[-0.02em] text-[var(--store-text,var(--foreground))]">
            <Link href={href}>{product.name}</Link>
          </h3>
        </div>
        <ProductPrice
          price={formatMoney(variant.priceMinor, currency)}
          className="shrink-0 pt-0.5"
        />
      </div>
    </article>
  );
}
