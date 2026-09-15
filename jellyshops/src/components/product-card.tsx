import Image from "next/image";
import Link from "next/link";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";

export function ProductCard({ product, storeSlug, currency }: { product: Product; storeSlug: string; currency: Currency }) {
  const variant = product.variants[0];
  return (
    <article className="group">
      <Link href={`/${storeSlug}/products/${product.slug}`} className="relative block aspect-[.83] overflow-hidden rounded-[48%_48%_18px_18px] bg-neutral-200">
        <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 700px) 85vw, 30vw" />
        {variant.stock <= 3 ? <span className="absolute left-3.5 top-3.5 rounded-full bg-[var(--store-bg,white)] px-2.5 py-[7px] text-[10px] font-extrabold">Only {variant.stock} left</span> : null}
      </Link>
      <div className="flex items-start justify-between gap-4 px-0.5 py-[15px]"><div><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[color-mix(in_srgb,var(--store-text,#222)_64%,transparent)]">{product.category}</span><h3 className="mt-1 font-[var(--store-display,Georgia)] text-lg leading-[1.08]"><Link href={`/${storeSlug}/products/${product.slug}`}>{product.name}</Link></h3></div><b className="whitespace-nowrap text-[13px]">{formatMoney(variant.priceMinor, currency)}</b></div>
    </article>
  );
}
