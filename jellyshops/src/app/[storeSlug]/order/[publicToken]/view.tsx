"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CheckoutConfirmation, OrderConfirmationSkeleton } from "@/features/checkout/components/checkout-confirmation";
import { confirmationState, deliveryExpectation, deliveryLines, paymentStatus } from "@/features/checkout/order-confirmation-model";
import { useClearBagAfterPayment } from "@/features/checkout/use-clear-bag";
import { useOrderStatus } from "@/features/checkout/use-order-status";
import { OrderProgress, OrderTimeline, ShipmentList } from "@/features/commerce/components/order-tracking";
import { useShop } from "@/contexts/shop-context";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";

const noSubscription = () => () => {};

interface PublicOrderViewProps {
  /** Passed by the server page, so the order is asked for straight away. */
  storeId?: string;
}

function PublicOrderContent({ storeId }: PublicOrderViewProps) {
  const { storeSlug, publicToken } = useParams<{ storeSlug: string; publicToken: string }>();
  const { result, missing, refreshError } = useOrderStatus({ storeSlug, publicToken, storeId });
  const search = new URLSearchParams(useSyncExternalStore(noSubscription, () => window.location.search, () => ""));
  // Stripe adds redirect_status after a bank or wallet redirect; ?paid=1 is our own in-page success. Neither proves payment.
  const redirectFailed = search.get("redirect_status") === "failed";
  useClearBagAfterPayment(storeSlug, search.get("paid") === "1" && !redirectFailed && result !== null && result.order.status !== "CANCELLED");

  if (missing) return <main className="jelly-checkout"><div className="jelly-checkout__single"><div className="jelly-checkout__state"><h1 className="jelly-checkout__title">Order not found</h1><p>Check the link in your confirmation email, or contact the shop if you need help.</p><Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}`}>Back to the shop</Link></div></div></main>;
  if (!result) {
    if (refreshError) return <main className="jelly-checkout"><div className="jelly-checkout__single"><div className="jelly-checkout__alert" role="alert"><p>We couldn’t load your order. Retrying… Check your order link or contact the shop.</p></div></div></main>;
    return <OrderConfirmationSkeleton />;
  }

  const order = result.order;
  const currency = String(order.currency ?? "GBP").toUpperCase();
  const money = (minor: unknown) => new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor ?? 0) / 100);
  const items = result.items.filter((item) => typeof item.titleSnapshot === "string");
  const state = confirmationState(result, redirectFailed);
  return <CheckoutConfirmation
    state={state}
    orderNumber={typeof order.number === "string" ? order.number : undefined}
    totalLabel={money(order.totalMinor)}
    storeSlug={storeSlug}
    details={{ payment: paymentStatus(state), address: deliveryLines(result), delivery: deliveryExpectation(result, state) }}
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
    {state === "paid" && <OrderProgress steps={result.progress ?? []} />}
    <ShipmentList shipments={result.shipments ?? []} />
    {state !== "pending" && <OrderTimeline entries={result.timeline ?? []} />}
  </CheckoutConfirmation>;
}

export default function PublicOrderView({ storeId }: PublicOrderViewProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  const Order = shell.OrderPage;
  const content = <PublicOrderContent storeId={storeId ?? store?.id} />;
  // The store frame comes from the server bootstrap; if it is somehow missing, still show the order.
  if (!store) return content;
  return <Order store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings}>{content}</Order>;
}
