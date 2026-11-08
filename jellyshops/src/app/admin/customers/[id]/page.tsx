"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, DetailLayout, EmptyState, ResourceForm, StatusBadge, useToast } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createAdminApi, type MerchantCustomerDetail } from "@/features/admin/api/admin-api";
import { useAdminQuery } from "@/features/admin/hooks/use-admin-query";
import { CustomerFormFields, customerToDraft, draftToInput, type CustomerDraft } from "@/features/admin/customers/customer-form";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { session, activeStore } = useAuth();
  const toast = useToast();
  const api = useMemo(() => session ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session]);
  const customerId = decodeURIComponent(params.id);
  const load = useCallback(() => api!.getCustomer(activeStore!.id, customerId), [api, activeStore, customerId]);
  const query = useAdminQuery(api && activeStore ? `customer:${activeStore.id}:${customerId}` : null, load);
  const [saved, setSaved] = useState<MerchantCustomerDetail | null>(null);
  const customer = saved?.id === customerId ? saved : query.data?.customer;
  const [draft, setDraft] = useState<{ id: string; value: CustomerDraft } | null>(null);
  const base = customer ? customerToDraft(customer) : null;
  const current = draft?.id === customerId ? draft.value : base;
  const dirty = Boolean(current && base && JSON.stringify(current) !== JSON.stringify(base));
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: activeStore?.currency ?? "GBP" }).format(minor / 100);

  async function save() {
    if (!api || !activeStore || !customer || !current) return;
    const result = await api.updateCustomer(activeStore.id, customer.id, { ...draftToInput(current), revision: customer.revision });
    setSaved(result.customer);
    setDraft(null);
    toast("Customer saved");
  }

  if (query.error) return <AdminPage title="Customer" back={{ href: "/admin/customers", label: "Customers" }}><Banner tone="critical" title="Could not load this customer" action={<button type="button" className="jk-button" onClick={query.retry}>Try again</button>}>{query.error.message}</Banner></AdminPage>;
  if (!customer || !current) return <AdminPage title="Customer" back={{ href: "/admin/customers", label: "Customers" }}><CardSkeleton label="Loading customer" /><CardSkeleton label="Loading orders" /></AdminPage>;
  const since = customer.createdAt ?? customer.orders.at(-1)?.createdAt;
  const paidOrders = customer.orders.filter((order) => order.status !== "CANCELLED");

  return <AdminPage title={customer.name} width="detail" back={{ href: "/admin/customers", label: "Customers" }}
    badges={customer.acceptsEmailMarketing ? <StatusBadge tone="success">Email subscriber</StatusBadge> : undefined}
    description={[customer.email, customer.location].filter(Boolean).join(" · ")}
    secondaryActions={customer.email ? [{ label: "Send email", href: `mailto:${customer.email}` }] : []}>
    <div className="jk-summary">
      <div className="jk-metric"><span className="jk-muted">Amount spent</span><strong>{money(customer.lifetimeSpendMinor)}</strong></div>
      <div className="jk-metric"><span className="jk-muted">Orders</span><strong>{customer.orderCount}</strong><span className="jk-metric-hint">Cancelled orders are not counted</span></div>
      <div className="jk-metric"><span className="jk-muted">Customer since</span><strong>{since ? new Date(since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Today"}</strong></div>
    </div>
    <DetailLayout
      main={<ResourceForm dirty={dirty} onSubmit={save} onDiscard={() => setDraft(null)} saveLabel="Save customer">
        <CustomerFormFields draft={current} onChange={(value) => setDraft({ id: customerId, value })} emailLocked />
      </ResourceForm>}
      side={<Card title="Orders" flush actions={paidOrders.length ? <span className="jk-muted">{customer.orders.length} in total</span> : undefined}>
        {customer.orders.length ? <ul className="jk-list">{customer.orders.map((order) => <li key={order.id}>
          <Link href={`/admin/orders/${order.id}`} className="jk-list-row">
            <span className="min-w-0"><span className="jk-strong">{order.number}</span><span className="jk-cell-sub">{new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></span>
            <StatusBadge kind="order" value={order.status} />
            <strong className="tabular-nums">{money(order.totalMinor)}</strong>
          </Link></li>)}</ul>
          : <EmptyState icon={ShoppingBag} title="No orders yet" description="Their orders will show here." />}
      </Card>} />
  </AdminPage>;
}
