import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";

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
      <Link
        href={href}
        className="relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-[#f1ece8] shadow-[0_14px_34px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05]"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 700px) 88vw, (max-width: 1100px) 45vw, 30vw"
          className="object-cover transition duration-500 ease-out group-hover:scale-[1.035]"
        />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

        {(lowStock || soldOut) && (
          <span className="absolute left-3.5 top-3.5 rounded-full bg-white/92 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.07em] text-[#3e3638] shadow-sm backdrop-blur-md">
            {soldOut ? "Sold out" : `Only ${variant.stock} left`}
          </span>
        )}

        <span className="absolute bottom-3.5 right-3.5 grid size-9 translate-y-2 place-items-center rounded-full bg-white text-[#2f292b] opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </Link>

      <div className="flex items-start justify-between gap-5 px-1 py-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--store-text,#222)_55%,transparent)]">
            {product.category}
          </p>

          <h3 className="mt-1.5 truncate font-[var(--store-display,Georgia)] text-[19px] leading-[1.08] tracking-[-0.02em] text-[var(--store-text,#222)]">
            <Link href={href}>{product.name}</Link>
          </h3>
        </div>

        <p className="shrink-0 pt-0.5 text-[12px] font-black text-[var(--store-text,#222)]">
          {formatMoney(variant.priceMinor, currency)}
        </p>
      </div>
    </article>
  );
}
