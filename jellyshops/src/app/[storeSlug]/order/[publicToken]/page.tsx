"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import { createCommerceApi } from "@/features/commerce/api/client";
import { commerceStoreId } from "@/features/commerce/commerce-store-id";

export default function PublicOrderPage() {
  const { storeSlug, publicToken } = useParams<{ storeSlug: string; publicToken: string }>();
  const [result, setResult] = useState<{ order: Record<string, any>; items: Record<string, any>[]; payment: Record<string, any> | null } | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }).getPublicOrder(commerceStoreId(storeSlug), publicToken).then(setResult).catch(() => setMissing(true)); }, [publicToken, storeSlug]);
  if (missing) return <main className="flex min-h-[75vh] flex-col items-center justify-center gap-4 px-6 text-center"><PackageCheck /><h1 className="font-[var(--store-display,Georgia)] text-5xl">Order not found</h1><Link className="border-b text-sm font-bold" href={`/${storeSlug}`}>Back to store</Link></main>;
  if (!result) return <main className="flex min-h-[75vh] items-center justify-center px-6 text-center">Loading your order…</main>;
  const order = result.order;
  return <main className="flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center text-[var(--store-text)]"><span className="mb-6 grid size-[60px] place-items-center rounded-full border-2 border-[var(--store-text)] bg-[var(--store-accent-soft)] shadow-[6px_6px_0_var(--store-text)]"><Check /></span><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--store-accent)]">{String(order.number ?? "Order")}</p><h1 className="my-3 font-[var(--store-display,Georgia)] text-[clamp(3.5rem,8vw,7.5rem)] leading-[.86] tracking-[-.07em]">Order received.</h1><p className="max-w-[530px] leading-relaxed opacity-70">Your order is being prepared by the shop.</p><div className="my-[26px] w-full max-w-[550px] rounded-[18px] border border-[color-mix(in_srgb,var(--store-text)_20%,transparent)] bg-[var(--store-surface)] px-[22px] text-left"><div className="flex min-h-[62px] items-center justify-between border-b border-[color-mix(in_srgb,var(--store-text)_14%,transparent)] text-xs"><span className="opacity-60">Order status</span><b>{String(order.status)}</b></div><div className="flex min-h-[62px] items-center justify-between text-xs"><span className="opacity-60">Total</span><b>{(Number(order.totalMinor) / 100).toFixed(2)} {String(order.currency)}</b></div></div><Link className="inline-flex min-h-[50px] items-center justify-center rounded-[999px_999px_999px_14px] border-[1.5px] border-[var(--store-text)] bg-[var(--store-text)] px-5 text-[13px] font-extrabold text-[var(--store-bg)]" href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
}
