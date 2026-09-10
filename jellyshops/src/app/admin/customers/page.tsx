"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";

export default function CustomersPage() {
  const { state, repository } = useShop();
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const customers = repository.listCustomers(store.id);
  return <div className="admin-page"><header className="page-head"><div><span className="page-kicker">People</span><h1>Customers</h1><p>The people who have chosen to shop with you.</p></div></header>{customers.length === 0 ? <EmptyState icon={UserRound} title="No customers yet" body="Customers are created automatically when they place an order." /> : <div className="customer-grid">{customers.map((customer) => { const orders = repository.listOrders(store.id).filter((order) => order.customerId === customer.id); const spent = orders.reduce((sum, order) => sum + order.totalMinor, 0); return <Link href={`/admin/customers/${customer.id}`} className="customer-card" key={customer.id}><span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><h2>{customer.name}</h2><p>{customer.email}</p><span>{orders.length} orders · {formatMoney(spent, store.currency)}</span></div></Link>; })}</div>}</div>;
}
