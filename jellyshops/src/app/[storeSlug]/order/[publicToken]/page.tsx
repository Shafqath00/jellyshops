"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckoutConfirmation, type ConfirmationState } from "@/features/checkout/components/checkout-confirmation";
import { useClearBagAfterPayment } from "@/features/checkout/use-clear-bag";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { PublicOrderResult } from "@/features/commerce/api/types";
import { OrderProgress, OrderTimeline, ShipmentList } from "@/features/commerce/components/order-tracking";
import { useMemo, useSyncExternalStore } from "react";

const noSubscription = () => () => {};
import { useShop } from "@/contexts/shop-context";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";

function PublicOrderContent() {
  const { storeSlug, publicToken } = useParams<{ storeSlug: string; publicToken: string }>();
  const [result, setResult] = useState<PublicOrderResult | null>(null);
  const [missing, setMissing] = useState(false);
  const api = useMemo(() => createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }), []);
  const [refreshError, setRefreshError] = useState(false);
  const search = new URLSearchParams(useSyncExternalStore(noSubscription, () => window.location.search, () => ""));
  // Stripe adds redirect_status after a bank or wallet redirect; ?paid=1 is our own in-page success.
  const redirectFailed = search.get("redirect_status") === "failed";
  useClearBagAfterPayment(storeSlug, search.get("paid") === "1" && !redirectFailed && result !== null && result.order.status !== "CANCELLED");
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let storeId: string | undefined;
    let inFlight = false;
    let retryNotBefore = 0;
    let failures = 0;
    async function refresh() {
      if (!active || inFlight || Date.now() < retryNotBefore) return;
      inFlight = true;
      const request = ++sequence;
      try {
        if (!storeId) storeId = (await api.getPublicStoreBySlug(storeSlug)).store.id;
        const next = await api.getPublicOrder(storeId, publicToken);
        if (!active || request !== sequence) return;
        setResult(next); setMissing(false); setRefreshError(false);
        failures = 0;
        retryNotBefore = 0;
        // The public endpoint allows five lookups per minute for each store/IP.
        if (next.order.status === "PENDING_PAYMENT" || next.payment?.status === "PROCESSING" || Number(next.order.balanceDueMinor ?? 0) > 0) timer = setTimeout(refresh, 15000);
      } catch (error) {
        if (!active || request !== sequence) return;
        if (error && typeof error === "object" && "status" in error && error.status === 404) { setMissing(true); return; }
        setRefreshError(true);
        failures++;
        const rateLimited = error && typeof error === "object" && "status" in error && error.status === 429;
        const delay = rateLimited ? 60000 : Math.min(15000 * 2 ** (failures - 1), 60000);
        retryNotBefore = Date.now() + delay;
        timer = setTimeout(refresh, delay);
      } finally {
        inFlight = false;
      }
    }
    const focus = () => { if (inFlight || Date.now() < retryNotBefore) return; if (timer) clearTimeout(timer); void refresh(); };
    void refresh(); window.addEventListener("focus", focus);
    return () => { active = false; if (timer) clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [api, publicToken, storeSlug]);
  if (missing) return <main className="jelly-checkout"><div className="jelly-checkout__single"><div className="jelly-checkout__state"><h1 className="jelly-checkout__title">Order not found</h1><p>Check the link in your confirmation email, or contact the shop if you need help.</p><Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}`}>Back to the shop</Link></div></div></main>;
  if (!result) return <main className="jelly-checkout"><div className="jelly-checkout__single"><div className="jelly-checkout__state" aria-busy={!refreshError}><p role={refreshError ? "alert" : "status"}>{refreshError ? "We couldn’t load your order. Retrying… Check your order link or contact the shop." : "Loading your order…"}</p></div></div></main>;
  const order = result.order;
  const currency = String(order.currency ?? "GBP").toUpperCase();
  const money = (minor: unknown) => new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor ?? 0) / 100);
  const items = result.items.filter((item) => typeof item.titleSnapshot === "string");
  const state: ConfirmationState = order.status === "CANCELLED" ? "cancelled" : order.status === "REFUNDED" ? "refunded" : order.status === "PENDING_PAYMENT" ? (redirectFailed ? "failed" : "pending") : "paid";
  return <CheckoutConfirmation
    state={state}
    orderNumber={typeof order.number === "string" ? order.number : undefined}
    totalLabel={money(order.totalMinor)}
    storeSlug={storeSlug}
    summary={{
      currency,
      subtotalLabel: order.subtotalMinor !== undefined ? money(order.subtotalMinor) : undefined,
      discount: Number(order.discountMinor ?? 0) > 0 ? { label: `−${money(order.discountMinor)}`, code: typeof order.discountCode === "string" ? order.discountCode : undefined } : undefined,
      shippingLabel: order.shippingMinor !== undefined ? (Number(order.shippingMinor) === 0 ? "Free" : money(order.shippingMinor)) : undefined,
      lines: items.map((item, index) => ({
        key: `${String(item.variantId ?? "item")}-${index}`,
        title: String(item.titleSnapshot),
        imageUrl: typeof item.imageSnapshot === "string" && item.imageSnapshot ? item.imageSnapshot : undefined,
        quantity: Number(item.quantity ?? 1),
        priceLabel: item.unitPriceMinor !== undefined ? money(Number(item.unitPriceMinor) * Number(item.quantity ?? 1)) : undefined,
      })),
    }}
    actions={Number(order.balanceDueMinor ?? 0) > 0 ? <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}/order/${publicToken}/balance`}>Pay balance {money(order.balanceDueMinor)}</Link> : null}
  >
    {refreshError && <p role="alert" className="jelly-checkout__alert">We couldn’t refresh the latest status. Retrying…</p>}
    <OrderProgress steps={result.progress ?? []} />
    <ShipmentList shipments={result.shipments ?? []} />
    <OrderTimeline entries={result.timeline ?? []} />
  </CheckoutConfirmation>;
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
