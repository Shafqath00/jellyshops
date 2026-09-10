"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { OrderStatusBadge } from "@/components/order-status";
import { formatMoney } from "@/lib/domain";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { repository } = useShop();
  const customer = repository.listCustomers().find((item) => item.id === params.id);
  if (!customer) return <div className="admin-page"><h1>Customer not found</h1></div>;
  const orders = repository.listOrders(customer.storeId).filter((order) => order.customerId === customer.id);
  return <div className="admin-page narrow-page"><Link href="/admin/customers" className="back-link"><ArrowLeft size={16} /> Customers</Link><header className="page-head"><span className="page-kicker">Customer profile</span><h1>{customer.name}</h1><p>{customer.email} · {customer.phone}</p></header><section className="form-card"><div className="form-card-title"><div><span>Order history</span><h2>{orders.length} order{orders.length === 1 ? "" : "s"}</h2></div></div>{orders.map((order) => <Link className="mini-order" href={`/admin/orders/${order.id}`} key={order.id}><b>{order.number}</b><OrderStatusBadge status={order.status} /><span>{formatMoney(order.totalMinor, order.currency)}</span></Link>)}</section></div>;
}
