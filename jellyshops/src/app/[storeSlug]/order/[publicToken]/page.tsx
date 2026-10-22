"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import { createCommerceApi } from "@/features/commerce/api/client";
import { useMemo } from "react";
import { useShop } from "@/contexts/shop-context";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";

function PublicOrderContent() {
  const { storeSlug, publicToken } = useParams<{ storeSlug: string; publicToken: string }>();
  const [result, setResult] = useState<{ order: Record<string, unknown>; items: Record<string, unknown>[]; payment: Record<string, unknown> | null } | null>(null);
  const [missing, setMissing] = useState(false);
  const api = useMemo(() => createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }), []);
  const [refreshError, setRefreshError] = useState(false);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let storeId: string | undefined;
    async function refresh() {
      const request = ++sequence;
      try {
        if (!storeId) storeId = (await api.getPublicStoreBySlug(storeSlug)).store.id;
        const next = await api.getPublicOrder(storeId, publicToken);
        if (!active || request !== sequence) return;
        setResult(next); setMissing(false); setRefreshError(false);
        if (next.order.status === "PENDING_PAYMENT" || next.payment?.status === "PROCESSING" || Number(next.order.balanceDueMinor ?? 0) > 0) timer = setTimeout(refresh, 5000);
      } catch (error) {
        if (!active || request !== sequence) return;
        if (error && typeof error === "object" && "status" in error && error.status === 404) { setMissing(true); return; }
        setRefreshError(true);
        timer = setTimeout(refresh, 5000);
      }
    }
    const focus = () => { if (timer) clearTimeout(timer); void refresh(); };
    void refresh(); window.addEventListener("focus", focus);
    return () => { active = false; if (timer) clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [api, publicToken, storeSlug]);
  if (missing) return <main className="jelly-checkout-empty"><PackageCheck size={32} aria-hidden="true" /><h1>Order not found</h1><p>Check the link in your confirmation email, or contact the shop if you need help.</p><Link className="jelly-button" href={`/${storeSlug}`}>Back to the shop</Link></main>;
  if (!result) return <main className="jelly-checkout-empty" aria-busy={!refreshError}><p role={refreshError ? "alert" : "status"}>{refreshError ? "Unable to load your order. Retrying… Check your order link or contact the shop." : "Loading your order…"}</p></main>;
  const order = result.order;
  const pendingPayment = order.status === "PENDING_PAYMENT";
  const currency = String(order.currency ?? "GBP").toUpperCase();
  const money = (minor: unknown) => new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor ?? 0) / 100);
  const status = String(order.status ?? "").replaceAll("_", " ").toLowerCase();
  const items = result.items.filter((item) => typeof item.titleSnapshot === "string");
  return <main className="jelly-order-confirmation">
    <span className="jelly-order-confirmation-icon" aria-hidden="true">{pendingPayment ? <PackageCheck /> : <Check />}</span>
    <p className="jelly-eyebrow">{String(order.number ?? "Your order")}</p>
    <h1>{pendingPayment ? "Payment pending" : order.status === "CANCELLED" ? "Order cancelled" : order.status === "REFUNDED" ? "Order refunded" : "Thank you for your order"}</h1>
    {refreshError && <p role="alert">Unable to refresh the latest status. Retrying…</p>}
    <p>{pendingPayment ? "We are waiting for your payment to be confirmed. This page updates once it is." : order.status === "CANCELLED" ? "This order has been cancelled. Contact the shop if you need help with its payment status." : order.status === "REFUNDED" ? "Your refund has been confirmed. Contact the shop if you need help." : "Your order has been received and the shop is getting it ready."}</p>
    {items.length > 0 && <ul className="jelly-order-items">{items.map((item, index) => <li key={`${String(item.variantId ?? "item")}-${index}`}><span>{String(item.titleSnapshot)}<small> × {Number(item.quantity ?? 1)}</small></span>{item.unitPriceMinor !== undefined && <b>{money(Number(item.unitPriceMinor) * Number(item.quantity ?? 1))}</b>}</li>)}</ul>}
    <dl className="jelly-order-confirmation-summary"><div><dt>Status</dt><dd>{status.charAt(0).toUpperCase() + status.slice(1)}</dd></div><div><dt>Total</dt><dd>{money(order.totalMinor)}</dd></div></dl>
    {Number(order.balanceDueMinor ?? 0) > 0 && <div className="jelly-section-actions"><Link className="jelly-button" href={`/${storeSlug}/order/${publicToken}/balance`}>Pay balance {money(order.balanceDueMinor)}</Link></div>}
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
