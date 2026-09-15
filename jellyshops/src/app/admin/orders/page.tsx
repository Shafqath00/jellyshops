"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";

export default function OrdersPage() {
  const { state, repository } = useShop();
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const orders = repository.listOrders(store.id);
  return <div className="admin-page"><header className="page-head"><div><span className="page-kicker">Fulfilment</span><h1>Orders</h1><p>Keep every order moving from paid to delivered.</p></div></header>{orders.length === 0 ? <EmptyState icon={ClipboardList} title="No orders yet" body="When a customer checks out, their order will appear here." /> : <div className="data-card order-table"><div className="data-head"><span>Order</span><span>Customer</span><span>Status</span><span>Total</span><span>Date</span></div>{orders.map((order) => <Link className="data-row" href={`/admin/orders/${order.id}`} key={order.id}><b>{order.number}</b><span>{order.customerSnapshot.name}<small>{order.items.length} item{order.items.length === 1 ? "" : "s"}</small></span><OrderStatusBadge status={order.status} /><b>{formatMoney(order.totalMinor, order.currency)}</b><span>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></Link>)}</div>}</div>;
}
