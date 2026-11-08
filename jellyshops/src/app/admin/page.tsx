"use client";

import Link from "next/link";
import { Boxes, CheckCircle2, Circle, PackageCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, EmptyState, StatusBadge } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createAdminApi, type SalesFigures, type SalesPeriod } from "@/features/admin/api/admin-api";
import { useAdminQuery } from "@/features/admin/hooks/use-admin-query";
import { SalesChart } from "@/features/admin/home/sales-chart";
import { changeText } from "@/features/admin/home/change-text";

const PERIODS: Array<{ days: SalesPeriod; label: string; previous: string }> = [
  { days: 1, label: "Last 24 hours", previous: "the 24 hours before" },
  { days: 7, label: "Last 7 days", previous: "the 7 days before" },
  { days: 30, label: "Last 30 days", previous: "the 30 days before" },
  { days: 90, label: "Last 90 days", previous: "the 90 days before" },
];

function customerName(snapshot?: Record<string, unknown> | null) {
  const name = snapshot?.name;
  return typeof name === "string" && name.trim() ? name.trim() : "Customer";
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="jk-metric"><span className="jk-muted">{label}</span><strong>{value}</strong><span className="jk-metric-hint">{hint}</span></div>;
}

export default function DashboardPage() {
  const { session, activeStore } = useAuth();
  const [days, setDays] = useState<SalesPeriod>(30);
  const api = useMemo(() => session ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session]);
  const loadSummary = useCallback(() => api!.getSummary(activeStore!.id), [api, activeStore]);
  const loadSales = useCallback(() => api!.getSales(activeStore!.id, days), [api, activeStore, days]);
  const summary = useAdminQuery(api && activeStore ? `summary:${activeStore.id}` : null, loadSummary);
  const sales = useAdminQuery(api && activeStore ? `sales:${activeStore.id}:${days}` : null, loadSales);
  if (!activeStore) return null;
  const store = activeStore;
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: store.currency }).format(minor / 100);
  const period = PERIODS.find((item) => item.days === days) ?? PERIODS[2];
  const data = summary.data;
  const setup = data?.setup;
  const steps = [
    { label: "Add your store details", help: "Your store name and contact email.", href: "/admin/settings/general", done: setup?.details },
    { label: "Add a product", help: "Make at least one product active so shoppers can buy it.", href: "/admin/products/new", done: setup?.products },
    { label: "Publish your store design", help: "Choose a design and publish it.", href: "/admin/online-store", done: setup?.publication },
    { label: "Set your delivery charge", help: "What customers pay for delivery.", href: "/admin/settings/general", done: setup?.shipping },
    { label: "Turn on payments", help: "Connect Stripe so you can take card payments.", href: "/admin/payments", done: setup?.payments },
  ];
  const remaining = steps.filter((step) => !step.done);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: data?.timezone ?? "UTC" }).format(new Date());
  const figures: SalesFigures | undefined = sales.data?.current;
  const before: SalesFigures | undefined = sales.data?.previous;

  return <AdminPage title="Home" description={<>{today}. How {store.name} is doing, and what needs you next.</>}
    primaryAction={{ label: "Add product", href: "/admin/products/new" }} secondaryActions={[{ label: "View store", href: `/${store.slug}` }]}>
    {summary.error && <Banner tone="critical" title="Some of your dashboard did not load" action={<button type="button" className="jk-button" onClick={summary.retry}>Try again</button>}>{summary.error.message}</Banner>}

    {data && (remaining.length ? <Card title={`Finish setting up your store · ${steps.length - remaining.length} of ${steps.length} done`} description="Do these once and your store is ready to take orders.">
      <ol className="jk-steps">{steps.map((step) => <li key={step.label} className={step.done ? "is-done" : ""}>
        {step.done ? <CheckCircle2 size={18} aria-hidden="true" className="jk-step-icon is-done" /> : <Circle size={18} aria-hidden="true" className="jk-step-icon" />}
        <div className="min-w-0"><Link href={step.href} className="jk-strong">{step.label}</Link><span className="jk-cell-sub">{step.done ? "Done" : step.help}</span></div>
      </li>)}</ol>
    </Card> : <Banner tone="success" title="Your store is ready to take orders">Next ideas: <Link href="/admin/products/collections" className="jk-link">group products into collections</Link>, <Link href="/admin/content/blogs" className="jk-link">write a blog post</Link> or <Link href="/admin/settings/notifications" className="jk-link">check your order emails</Link>.</Banner>)}

    <Card title="Sales" description="Paid orders only. Cancelled orders are not counted." actions={<label><span className="sr-only">Sales period</span>
      <select className="jk-select" value={days} onChange={(event) => setDays(Number(event.target.value) as SalesPeriod)}>{PERIODS.map((item) => <option key={item.days} value={item.days}>{item.label}</option>)}</select></label>}>
      {sales.error ? <Banner tone="critical" action={<button type="button" className="jk-button" onClick={sales.retry}>Try again</button>}>{sales.error.message}</Banner> :
        !figures || !before ? <div className="jk-metrics" role="status" aria-label="Loading sales">{[0, 1, 2].map((key) => <div key={key} className="jk-metric"><span className="jk-skeleton" style={{ width: "40%", height: 12 }} /><span className="jk-skeleton" style={{ width: "60%", height: 24 }} /></div>)}</div> : <>
          <div className="jk-metrics">
            <Metric label="Total sales" value={money(figures.revenueMinor)} hint={changeText(figures.revenueMinor, before.revenueMinor, period.previous)} />
            <Metric label="Paid orders" value={String(figures.paidOrders)} hint={changeText(figures.paidOrders, before.paidOrders, period.previous)} />
            <Metric label="Average order" value={figures.paidOrders ? money(figures.averageOrderMinor) : "None yet"} hint={figures.paidOrders ? changeText(figures.averageOrderMinor, before.averageOrderMinor, period.previous) : "Shown after your first paid order"} />
          </div>
          {days > 1 && sales.data && <SalesChart daily={sales.data.daily} money={money} label={`Sales per day, ${period.label.toLowerCase()}`} />}
        </>}
    </Card>

    <div className="jk-home-grid">
      <Card title="Orders that need you" description="Paid or in progress, newest first." actions={<Link href="/admin/orders" className="jk-link">All orders</Link>} flush>
        {!data ? <CardSkeleton label="Loading orders" /> : data.actionableOrders.length ? <ul className="jk-list">{data.actionableOrders.map((order) => <li key={order.id}>
          <Link href={`/admin/orders/${order.id}`} className="jk-list-row">
            <span className="min-w-0"><span className="jk-strong">{order.number}</span><span className="jk-cell-sub truncate">{customerName(order.customerSnapshot)}</span></span>
            <StatusBadge kind="order" value={order.status} />
            <strong className="tabular-nums">{money(order.totalMinor)}</strong>
          </Link>
        </li>)}</ul> : <EmptyState icon={PackageCheck} title="Nothing waiting" description="New paid orders show up here until they are delivered." />}
      </Card>
      <Card title="Running low" description="Active products at or below their low-stock warning." actions={<Link href="/admin/products/inventory" className="jk-link">Inventory</Link>} flush>
        {!data ? <CardSkeleton label="Loading stock" /> : data.lowStock.length ? <ul className="jk-list">{data.lowStock.map((item) => {
          const left = item.available ?? item.quantity;
          return <li key={item.variantId}><Link href={`/admin/products/${item.productId}`} className="jk-list-row">
            <span className="min-w-0"><span className="jk-strong">{item.title}</span>{(item.variantTitle || item.sku) && <span className="jk-cell-sub truncate">{[item.variantTitle, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ")}</span>}</span>
            <StatusBadge tone={left <= 0 ? "critical" : "warning"}>{left <= 0 ? "Out of stock" : `${left} left`}</StatusBadge>
          </Link></li>;
        })}</ul> : <EmptyState icon={Boxes} title="Stock looks healthy" description="Products that are nearly sold out show up here." />}
      </Card>
    </div>
  </AdminPage>;
}
