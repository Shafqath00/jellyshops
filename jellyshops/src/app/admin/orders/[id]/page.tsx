"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, MapPin, PackageCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type { MerchantOrderDetail, MerchantOrderStatus } from "@/features/commerce/api/types";
import { OrderPaymentPanel } from "@/features/commerce/components/order-payment-panel";
import { getMerchantSession } from "@/features/commerce/merchant-session";

const nextStatus: Partial<Record<MerchantOrderStatus, MerchantOrderStatus>> = {
  PAID: "CONFIRMED", CONFIRMED: "PROCESSING", PROCESSING: "SHIPPED", SHIPPED: "DELIVERED",
};
const actionLabels: Partial<Record<MerchantOrderStatus, string>> = { CONFIRMED: "Confirm order", PROCESSING: "Start processing", SHIPPED: "Mark shipped", DELIVERED: "Mark delivered" };
const actionIcons: Partial<Record<MerchantOrderStatus, typeof Check>> = { CONFIRMED: Check, PROCESSING: PackageCheck, SHIPPED: Truck, DELIVERED: Check };

function readableStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amountMinor / 100);
}

function customerValue(snapshot: Record<string, unknown>, key: string) {
  return typeof snapshot[key] === "string" ? snapshot[key] : "Not provided";
}

function addressValue(snapshot: Record<string, unknown>) {
  const address = snapshot.address;
  return address && typeof address === "object" && !Array.isArray(address) ? address as Record<string, unknown> : null;
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const session = getMerchantSession();
  const storeId = session?.storeId;
  const token = session?.token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const api = useMemo(() => storeId && token ? createMerchantCommerceApi({ baseUrl: origin, token }) : null, [origin, storeId, token]);
  const [detail, setDetail] = useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(api));
  const [error, setError] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!api || !storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getOrder(storeId, orderId)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load order"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, orderId, storeId]);

  async function transition() {
    if (!api || !storeId || !detail) return;
    const next = nextStatus[detail.order.status];
    if (!next) return;
    setTransitioning(true);
    setError("");
    try {
      const order = await api.transitionFulfilment(storeId, detail.order.id, next);
      setDetail((current) => current ? { ...current, order } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update fulfilment");
    } finally {
      setTransitioning(false);
    }
  }

  async function requestFullRefund() {
    if (!api || !storeId || !detail) throw new Error("Merchant order access is unavailable.");
    const refund = await api.requestFullRefund(storeId, detail.order.id);
    setDetail((current) => current ? { ...current, refunds: current.refunds.some((item) => item.id === refund.id) ? current.refunds : [...current.refunds, refund] } : current);
    return refund;
  }

  if (loading) return <div className="admin-page"><div className="form-card flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading order…</div></div>;
  if (!api) return <div className="admin-page"><h1>Order access unavailable</h1><p className="detail-copy">Sign in as a merchant to manage orders.</p></div>;
  if (error && !detail) return <div className="admin-page"><h1>Order unavailable</h1><p className="text-danger" role="alert">{error}</p></div>;
  if (!detail) return <div className="admin-page"><h1>Order not found</h1></div>;

  const { order, items, payment, refunds, disputes } = detail;
  const next = nextStatus[order.status];
  const Icon = next ? actionIcons[next] ?? Check : Check;
  const address = addressValue(order.customerSnapshot);
  return <div className="admin-page narrow-page"><Link href="/admin/orders" className="back-link"><ArrowLeft size={16} /> Orders</Link><header className="page-head split-head"><div><span className="page-kicker">{order.number}</span><h1>Order details</h1><p>Placed {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="head-actions"><span className={`status-badge status-${order.status.toLowerCase()}`}>{readableStatus(order.status)}</span>{next ? <button type="button" className="button button-primary" onClick={transition} disabled={transitioning}><Icon size={17} /> {transitioning ? "Updating…" : actionLabels[next]}</button> : null}</div></header>{error ? <p className="text-danger mb-4" role="alert">{error}</p> : null}<div className="detail-grid"><section className="form-card"><div className="form-card-title"><div><span>Items</span><h2>What they ordered</h2></div></div><div className="order-items">{items.map((item) => <div className="order-item" key={item.variantId}><span className="order-thumb" aria-hidden="true" /> <div><b>{item.titleSnapshot}</b><span>{item.skuSnapshot ?? "No SKU"}</span><small>Qty {item.quantity}</small></div><strong>{formatMoney(item.unitPriceMinor * item.quantity, order.currency)}</strong></div>)}</div><div className="totals"><div><span>Subtotal</span><b>{formatMoney(order.subtotalMinor, order.currency)}</b></div><div><span>Shipping</span><b>{formatMoney(order.shippingMinor, order.currency)}</b></div><div className="total-line"><span>Total</span><b>{formatMoney(order.totalMinor, order.currency)}</b></div></div></section><aside className="detail-side"><section className="form-card"><div className="form-card-title"><div><span>Customer</span><h2>{customerValue(order.customerSnapshot, "name")}</h2></div></div><p className="detail-copy">{customerValue(order.customerSnapshot, "email")}<br />{customerValue(order.customerSnapshot, "phone")}</p></section><section className="form-card"><div className="form-card-title"><div><span>Delivery</span><h2><MapPin size={18} /> Shipping address</h2></div></div>{address ? <p className="detail-copy">{customerValue(address, "line1")}<br />{typeof address.line2 === "string" ? <>{address.line2}<br /></> : null}{customerValue(address, "city")}, {customerValue(address, "region")} {customerValue(address, "postalCode")}<br />{customerValue(address, "country")}</p> : <p className="detail-copy">No shipping address was supplied.</p>}</section><OrderPaymentPanel payment={payment} refunds={refunds} disputes={disputes} fulfilmentStatus={order.status} requestFullRefund={requestFullRefund} /></aside></div></div>;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <OrderDetailView orderId={params.id} />;
}
