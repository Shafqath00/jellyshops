"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import { createCommerceApi } from "@/features/commerce/api/client";
import { useMemo } from "react";
import { useShop } from "@/contexts/shop-context";
import { useThemePresentation } from "@/components/storefront-shell";

function PublicOrderContent() {
  const { storeSlug, publicToken } = useParams<{ storeSlug: string; publicToken: string }>();
  const [result, setResult] = useState<{ order: Record<string, unknown>; items: Record<string, unknown>[]; payment: Record<string, unknown> | null } | null>(null);
  const [missing, setMissing] = useState(false);
  const api = useMemo(() => createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }), []);
  useEffect(() => { api.getPublicStoreBySlug(storeSlug).then(({ store }) => api.getPublicOrder(store.id, publicToken)).then(setResult).catch(() => setMissing(true)); }, [api, publicToken, storeSlug]);
  if (missing) return <main className="jelly-checkout-empty"><PackageCheck size={32} aria-hidden="true" /><h1>Order not found</h1><p>Check the link in your confirmation email, or contact the shop if you need help.</p><Link className="jelly-button" href={`/${storeSlug}`}>Back to the shop</Link></main>;
  if (!result) return <main className="jelly-checkout-empty" aria-busy="true"><p role="status">Loading your order…</p></main>;
  const order = result.order;
  const pendingPayment = order.status === "PENDING_PAYMENT";
  const currency = String(order.currency ?? "GBP").toUpperCase();
  const money = (minor: unknown) => new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor ?? 0) / 100);
  const status = String(order.status ?? "").replaceAll("_", " ").toLowerCase();
  const items = result.items.filter((item) => typeof item.titleSnapshot === "string");
  return <main className="jelly-order-confirmation">
    <span className="jelly-order-confirmation-icon" aria-hidden="true">{pendingPayment ? <PackageCheck /> : <Check />}</span>
    <p className="jelly-eyebrow">{String(order.number ?? "Your order")}</p>
    <h1>{pendingPayment ? "Payment pending" : "Thank you for your order"}</h1>
    <p>{pendingPayment ? "We are waiting for your payment to be confirmed. This page updates once it is." : "Your order has been received and the shop is getting it ready."}</p>
    {items.length > 0 && <ul className="jelly-order-items">{items.map((item, index) => <li key={`${String(item.variantId ?? "item")}-${index}`}><span>{String(item.titleSnapshot)}<small> × {Number(item.quantity ?? 1)}</small></span>{item.unitPriceMinor !== undefined && <b>{money(Number(item.unitPriceMinor) * Number(item.quantity ?? 1))}</b>}</li>)}</ul>}
    <dl className="jelly-order-confirmation-summary"><div><dt>Status</dt><dd>{status.charAt(0).toUpperCase() + status.slice(1)}</dd></div><div><dt>Total</dt><dd>{money(order.totalMinor)}</dd></div></dl>
    <div className="jelly-section-actions"><Link className="jelly-button" href={`/${storeSlug}/shop`}>Continue shopping</Link></div>
  </main>;
}

export default function PublicOrderPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  const Order = shell.OrderPage;
  return <Order store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings}><PublicOrderContent /></Order>;
}
