"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, ShoppingBag, Sparkles } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";

export default function ProductPage() {
  const { storeSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  const { repository } = useShop();
  const catalogStatus = useStorefrontCatalogStatus();
  const [added, setAdded] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const product = store ? repository.getProductBySlug(store.id, productSlug) : undefined;
  if (catalogStatus === "loading") return <main className="flex min-h-[75vh] items-center justify-center px-6 text-center text-[var(--store-text)]"><p className="opacity-70">Loading product…</p></main>;
  if (!store || !product || product.archived || !product.published) return <main className="flex min-h-[75vh] flex-col items-center justify-center px-6 text-center text-[var(--store-text)]"><h1 className="font-[var(--store-display,Georgia)] text-[clamp(3.5rem,8vw,7.5rem)] leading-[.86] tracking-[-.07em]">Product not found</h1><Link className="mt-5 border-b text-sm font-bold" href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
  const variant = product.variants[0];
  function addToCart() { const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug); const line = cart.items.find((item) => item.variantId === variant.id); repository.updateCartItem(cart.id, variant.id, Math.min((line?.quantity ?? 0) + 1, variant.stock)); setAdded(true); }
  return <main className="px-[clamp(20px,6vw,90px)] pb-[120px] pt-6 text-[var(--store-text)]"><Link href={`/${store.slug}/shop`} className="mb-7 inline-flex items-center gap-2 text-[11px] font-bold"><ArrowLeft size={16} /> Back to shop</Link><div className="grid items-center gap-[clamp(40px,8vw,120px)] lg:grid-cols-[1.1fr_.9fr]"><div className="relative min-h-[480px] overflow-hidden rounded-[48%_48%_28px_28px] sm:min-h-[620px] lg:min-h-[min(75vh,780px)]"><Image src={product.imageUrl} alt={product.name} fill priority sizes="(max-width: 800px) 100vw, 50vw" /><span className="absolute bottom-[22px] right-[22px] flex size-28 flex-col items-center justify-center gap-1 rounded-full border-[1.5px] border-[var(--store-text)] bg-[var(--store-accent-soft)] text-center text-[10px] font-extrabold uppercase"><Sparkles size={16} /> Hand finished</span></div><div><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--store-accent)]">{product.category}</span><h1 className="mt-2 max-w-[620px] font-[var(--store-display,Georgia)] text-[clamp(3.4rem,6vw,6.5rem)] leading-[.88] tracking-[-.065em]">{product.name}</h1><p className="mt-4 text-lg font-extrabold">{formatMoney(variant.priceMinor, store.currency)}</p><p className="my-[25px] max-w-[530px] text-base leading-relaxed opacity-70">{product.description}</p><div className="my-[26px] grid gap-4 rounded-[17px] border border-[color-mix(in_srgb,var(--store-text)_20%,transparent)] p-[18px] sm:grid-cols-2"><div className="flex flex-col gap-1"><span className="text-[9px] font-extrabold uppercase opacity-55">Size</span><b className="text-xs">{variant.name}</b></div><div className="flex flex-col gap-1"><span className="text-[9px] font-extrabold uppercase opacity-55">Availability</span><b className="text-xs">{variant.stock > 3 ? "Ready to order" : `Only ${variant.stock} left`}</b></div></div><button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[999px_999px_999px_14px] border-[1.5px] border-[var(--store-text)] bg-[var(--store-text)] px-5 font-extrabold text-[var(--store-bg)] disabled:cursor-not-allowed disabled:opacity-45" disabled={variant.stock === 0} onClick={addToCart}>{added ? <><Check size={18} /> Added to bag</> : <><ShoppingBag size={18} /> Add to cart</>}</button><ul className="mt-6 grid gap-2 p-0 text-[11px] opacity-70"><li>✓&nbsp; Prepared fresh for your order</li><li>✓&nbsp; Secure mock checkout</li><li>✓&nbsp; Local delivery available</li></ul></div></div></main>;
}
