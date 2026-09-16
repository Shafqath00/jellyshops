"use client";

import Link from "next/link";
import { ClipboardList, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type { MerchantOrderListItem } from "@/features/commerce/api/types";
import { getMerchantSession } from "@/features/commerce/merchant-session";

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amountMinor / 100);
}

function customerName(snapshot: Record<string, unknown>) {
  return typeof snapshot.name === "string" && snapshot.name.trim() ? snapshot.name : "Customer details unavailable";
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

export default function OrdersPage() {
  const session = getMerchantSession();
  const storeId = session?.storeId;
  const token = session?.token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const api = useMemo(() => storeId && token ? createMerchantCommerceApi({ baseUrl: origin, token }) : null, [origin, storeId, token]);
  const [orders, setOrders] = useState<MerchantOrderListItem[]>([]);
  const [loading, setLoading] = useState(Boolean(api));
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!api || !storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.listOrders(storeId)
      .then((result) => { if (!cancelled) setOrders(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load orders"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, storeId]);

  return <div className="admin-page"><header className="page-head"><div><span className="page-kicker">Fulfilment</span><h1>Orders</h1><p>Keep every paid order moving from confirmation to delivery.</p></div></header>{loading ? <div className="form-card flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading orders…</div> : !api ? <div className="form-card"><h2>Orders unavailable</h2><p className="detail-copy">Sign in as a merchant to manage orders.</p></div> : error ? <div className="form-card"><p className="text-danger" role="alert">{error}</p></div> : orders.length === 0 ? <EmptyState icon={ClipboardList} title="No orders yet" body="Orders paid through Stripe will appear here." /> : <div className="data-card order-table"><div className="data-head"><span>Order</span><span>Customer</span><span>Status</span><span>Total</span><span>Date</span></div>{orders.map((order) => <Link className="data-row" href={`/admin/orders/${order.id}`} key={order.id}><b>{order.number}</b><span>{customerName(order.customerSnapshot)}<small>Payment: {order.paymentStatus ? readableStatus(order.paymentStatus) : "not started"}</small></span><span className={`status-badge status-${order.status.toLowerCase()}`}>{readableStatus(order.status)}</span><b>{formatMoney(order.totalMinor, order.currency)}</b><span>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></Link>)}</div>}</div>;
}
