"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, PackageCheck } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { OrderStatusBadge } from "@/components/order-status";
import { formatMoney } from "@/lib/domain";

export default function PublicOrderPage() {
  const { storeSlug, orderId } = useParams<{ storeSlug: string; orderId: string }>();
  const { repository } = useShop();
  const order = repository.getOrder(orderId);
  if (!order) return <main className="flex min-h-[75vh] flex-col items-center justify-center gap-4 px-6 text-center"><PackageCheck /><h1 className="font-[var(--store-display,Georgia)] text-5xl">Order not found</h1><Link className="border-b text-sm font-bold" href={`/${storeSlug}`}>Back to store</Link></main>;
  return <main className="flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center text-[var(--store-text)]"><span className="mb-6 grid size-[60px] place-items-center rounded-full border-2 border-[var(--store-text)] bg-[var(--store-accent-soft)] shadow-[6px_6px_0_var(--store-text)]"><Check /></span><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--store-accent)]">{order.number}</p><h1 className="my-3 font-[var(--store-display,Georgia)] text-[clamp(3.5rem,8vw,7.5rem)] leading-[.86] tracking-[-.07em]">Thanks, {order.customerSnapshot.name.split(" ")[0]}.</h1><p className="max-w-[530px] leading-relaxed opacity-70">Your payment is complete and the shop has your order.</p><div className="my-[26px] w-full max-w-[550px] rounded-[18px] border border-[color-mix(in_srgb,var(--store-text)_20%,transparent)] bg-[var(--store-surface)] px-[22px] text-left"><div className="flex min-h-[62px] items-center justify-between gap-5 border-b border-[color-mix(in_srgb,var(--store-text)_14%,transparent)] text-xs"><span className="opacity-60">Order status</span><OrderStatusBadge status={order.status} /></div><div className="flex min-h-[62px] items-center justify-between gap-5 border-b border-[color-mix(in_srgb,var(--store-text)_14%,transparent)] text-xs"><span className="opacity-60">Delivering to</span><b>{order.customerSnapshot.address.city}, {order.customerSnapshot.address.postalCode}</b></div><div className="flex min-h-[62px] items-center justify-between gap-5 text-xs"><span className="opacity-60">Total paid</span><b>{formatMoney(order.totalMinor, order.currency)}</b></div></div><Link className="inline-flex min-h-[50px] items-center justify-center rounded-[999px_999px_999px_14px] border-[1.5px] border-[var(--store-text)] bg-[var(--store-text)] px-5 text-[13px] font-extrabold text-[var(--store-bg)]" href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
}
