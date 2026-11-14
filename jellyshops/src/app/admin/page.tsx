"use client";

import Link from "next/link";
import { Boxes, Inbox, PackageCheck, Banknote, Receipt, ShoppingBag } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, EmptyState, StatusBadge } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createAdminApi, type SalesFigures, type SalesPeriod } from "@/features/admin/api/admin-api";
import { useAdminQuery } from "@/features/admin/hooks/use-admin-query";
import { SalesChart } from "@/features/admin/home/sales-chart";
import { changeText } from "@/features/admin/home/change-text";
import { KpiCard, SetupGuide, trendOf, type SetupStep } from "@/features/admin/home/dashboard-parts";

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

function greeting(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
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
  const axisMoney = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: store.currency, notation: "compact", maximumFractionDigits: 1 }).format(minor / 100);
  const period = PERIODS.find((item) => item.days === days) ?? PERIODS[2];
  const data = summary.data;
  const setup = data?.setup;
  const timeZone = data?.timezone ?? "UTC";
  const steps: SetupStep[] = [
    { label: "Add your store details", help: "Your store name and contact email, shown to customers on emails and receipts.", href: "/admin/settings/general", action: "Add store details", done: setup?.details },
    { label: "Add a product", help: "Make at least one product active so shoppers can buy it.", href: "/admin/products/new", action: "Add product", done: setup?.products },
    { label: "Publish your store design", help: "Choose a design, make it yours and publish it so shoppers can see your store.", href: "/admin/online-store", action: "Choose a design", done: setup?.publication },
    { label: "Set your delivery charge", help: "What customers pay for delivery.", href: "/admin/settings/shipping", action: "Set delivery", done: setup?.shipping },
    { label: "Turn on payments", help: "Connect Stripe so you can take card payments.", href: "/admin/payments", action: "Set up payments", done: setup?.payments },
  ];
  const remaining = steps.filter((step) => !step.done);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(new Date());
  const figures: SalesFigures | undefined = sales.data?.current;
  const before: SalesFigures | undefined = sales.data?.previous;
  const salesLoading = !figures || !before;
  const retry = (action: () => void) => <button type="button" className="jk-button" onClick={action}>Try again</button>;

  return <AdminPage title={`${greeting(timeZone)}`} description={<>{today}. Here is how {store.name} is doing, and what needs you next.</>}
    primaryAction={{ label: "Add product", href: "/admin/products/new" }} secondaryActions={[{ label: "View store", href: `/${store.slug}` }]}>
    {summary.error && <Banner tone="critical" title="Some of your dashboard did not load" action={retry(summary.retry)}>{summary.error.message}</Banner>}

    {data && (remaining.length ? <SetupGuide steps={steps} /> :
      <Banner tone="success" title="Your store is ready to take orders">Next ideas: <Link href="/admin/products/collections" className="jk-link">group products into collections</Link>, <Link href="/admin/content/blogs" className="jk-link">write a blog post</Link> or <Link href="/admin/settings/notifications" className="jk-link">check your order emails</Link>.</Banner>)}

    <nav className="jk-quick" aria-label="Common tasks">
      <Link href="/admin/products/new" className="jk-chip">Add a product</Link>
      <Link href="/admin/products/import" className="jk-chip">Import products from a spreadsheet</Link>
      <Link href="/admin/orders" className="jk-chip">Send out orders</Link>
      <Link href="/admin/products/inventory?stock=low" className="jk-chip">Update stock that is running low</Link>
      <Link href="/admin/online-store/editor" className="jk-chip">Edit your store design</Link>
    </nav>

    <div className="jk-dash-toolbar">
      <h2 className="jk-section-title">Performance</h2>
      <label className="jk-period"><span className="sr-only">Sales period</span>
        <select className="jk-select" value={days} onChange={(event) => setDays(Number(event.target.value) as SalesPeriod)}>{PERIODS.map((item) => <option key={item.days} value={item.days}>{item.label}</option>)}</select>
      </label>
    </div>

    {sales.error ? <Banner tone="critical" title="Sales figures did not load" action={retry(sales.retry)}>{sales.error.message}</Banner> :
      <div className="jk-kpis" role={salesLoading ? "status" : undefined} aria-label={salesLoading ? "Loading sales" : undefined}>
        <KpiCard icon={Banknote} label="Total sales" loading={salesLoading} value={figures && money(figures.revenueMinor)}
          hint={figures && before && changeText(figures.revenueMinor, before.revenueMinor, period.previous)} trend={figures && before && trendOf(figures.revenueMinor, before.revenueMinor)} />
        <KpiCard icon={ShoppingBag} label="Paid orders" loading={salesLoading} value={figures && String(figures.paidOrders)} href="/admin/orders"
          hint={figures && before && changeText(figures.paidOrders, before.paidOrders, period.previous)} trend={figures && before && trendOf(figures.paidOrders, before.paidOrders)} />
        <KpiCard icon={Receipt} label="Average order" loading={salesLoading} value={figures && (figures.paidOrders ? money(figures.averageOrderMinor) : "None yet")}
          hint={figures && before && (figures.paidOrders ? changeText(figures.averageOrderMinor, before.averageOrderMinor, period.previous) : "Shown after your first paid order")}
          trend={figures && before && figures.paidOrders ? trendOf(figures.averageOrderMinor, before.averageOrderMinor) : undefined} />
        <KpiCard icon={Inbox} label="Orders to send" loading={!data} value={data && String(data.actionableOrders.length)} href="/admin/orders"
          hint={data && (data.actionableOrders.length ? "Paid or in progress, not yet delivered" : "Nothing waiting right now")} />
      </div>}

    {!sales.error && <Card title="Sales over time" description={`Paid orders only, ${period.label.toLowerCase()}. Cancelled orders are not counted.`}
      actions={figures ? <strong className="jk-card-figure">{money(figures.revenueMinor)}</strong> : undefined}>
      {salesLoading ? <span className="jk-skeleton jk-chart-skeleton" role="status" aria-label="Loading chart" /> :
        days === 1 ? <p className="jk-chart-empty">Daily bars show for 7 days or more. Choose a longer period to see sales day by day.</p> :
        sales.data && <SalesChart daily={sales.data.daily} money={money} axisMoney={axisMoney} label={`Sales per day, ${period.label.toLowerCase()}`} />}
    </Card>}

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
      <Card title="Running low" description="Active products at or below their low-stock warning." actions={<Link href="/admin/products/inventory?stock=low" className="jk-link">Update stock</Link>} flush>
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
