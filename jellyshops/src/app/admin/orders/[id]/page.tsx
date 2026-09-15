"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, MapPin, PackageCheck, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status";
import { useShop } from "@/contexts/shop-context";
import { formatMoney, nextOrderStatus, type OrderStatus } from "@/lib/domain";

const actionLabels: Partial<Record<OrderStatus, string>> = { CONFIRMED: "Confirm order", PROCESSING: "Start processing", SHIPPED: "Mark shipped", DELIVERED: "Mark delivered" };
const actionIcons: Partial<Record<OrderStatus, typeof Check>> = { CONFIRMED: Check, PROCESSING: PackageCheck, SHIPPED: Truck, DELIVERED: Check };

export function OrderDetailView({ orderId }: { orderId: string }) {
  const { repository } = useShop();
  const order = repository.getOrder(orderId);
  if (!order) return <div className="admin-page"><h1>Order not found</h1></div>;
  const next = nextOrderStatus(order.status);
  const Icon = next ? actionIcons[next] ?? Check : Check;
  const address = order.customerSnapshot.address;
  return <div className="admin-page narrow-page"><Link href="/admin/orders" className="back-link"><ArrowLeft size={16} /> Orders</Link><header className="page-head split-head"><div><span className="page-kicker">{order.number}</span><h1>Order details</h1><p>Placed {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="head-actions"><OrderStatusBadge status={order.status} />{next ? <button type="button" className="button button-primary" onClick={() => repository.transitionOrder(order.id, next)}><Icon size={17} /> {actionLabels[next]}</button> : null}</div></header><div className="detail-grid"><section className="form-card"><div className="form-card-title"><div><span>Items</span><h2>What they ordered</h2></div></div><div className="order-items">{order.items.map((item) => <div className="order-item" key={item.variantId}><span className="order-thumb"><Image src={item.imageUrl} alt="" fill sizes="64px" /></span><div><b>{item.productName}</b><span>{item.variantName} · {item.sku}</span><small>Qty {item.quantity}</small></div><strong>{formatMoney(item.unitPriceMinor * item.quantity, order.currency)}</strong></div>)}</div><div className="totals"><div><span>Subtotal</span><b>{formatMoney(order.subtotalMinor, order.currency)}</b></div><div><span>Shipping</span><b>{formatMoney(order.shippingMinor, order.currency)}</b></div><div className="total-line"><span>Total paid</span><b>{formatMoney(order.totalMinor, order.currency)}</b></div></div></section><aside className="detail-side"><section className="form-card"><div className="form-card-title"><div><span>Customer</span><h2>{order.customerSnapshot.name}</h2></div></div><p className="detail-copy">{order.customerSnapshot.email}<br />{order.customerSnapshot.phone}</p></section><section className="form-card"><div className="form-card-title"><div><span>Delivery</span><h2><MapPin size={18} /> Shipping address</h2></div></div><p className="detail-copy">{address.line1}<br />{address.line2 ? <>{address.line2}<br /></> : null}{address.city}, {address.region} {address.postalCode}<br />{address.country}</p></section>{["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status) ? <button type="button" className="text-danger" onClick={() => repository.transitionOrder(order.id, "CANCELLED")}>Cancel this order</button> : null}</aside></div></div>;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <OrderDetailView orderId={params.id} />;
}
