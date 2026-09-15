"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ProductCard } from "@/components/product-card";
import { useShop } from "@/contexts/shop-context";

export default function ShopPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const search = useSearchParams();
  const { repository } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  const products = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived);
  const categories = [...new Set(products.map((product) => product.category))];
  const selected = search.get("category");
  const visible = selected ? products.filter((product) => product.category === selected) : products;
  const tabClass = (active: boolean) => clsx("rounded-full border border-[color-mix(in_srgb,var(--store-text)_25%,transparent)] px-3.5 py-2 text-[11px] font-bold", active && "bg-[var(--store-text)] text-[var(--store-bg)]");
  return <main className="px-[clamp(20px,6vw,90px)] pb-[130px] pt-[55px] text-[var(--store-text)] sm:pt-20"><header className="max-w-[700px]"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--store-accent)]">Made for good days</span><h1 className="my-2 font-[var(--store-display,Georgia)] text-[clamp(4rem,8vw,8rem)] leading-[.88] tracking-[-.07em]">Shop everything</h1><p className="opacity-65">{products.length} small-batch treats, ready when you are.</p></header><nav className="my-[35px] mt-[50px] flex flex-wrap gap-2" aria-label="Product categories"><Link className={tabClass(!selected)} href={`/${store.slug}/shop`}>All</Link>{categories.map((category) => <Link className={tabClass(selected === category)} key={category} href={`/${store.slug}/shop?category=${encodeURIComponent(category)}`}>{category}</Link>)}</nav><div className="grid grid-cols-2 gap-[clamp(15px,2.5vw,34px)] md:grid-cols-3 lg:grid-cols-4">{visible.map((product) => <ProductCard key={product.id} product={product} storeSlug={store.slug} currency={store.currency} />)}</div></main>;
}
