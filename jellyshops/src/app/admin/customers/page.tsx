"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AdminPage, EmptyState, IndexTable, StatusBadge, type IndexColumn, type IndexTab } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createAdminApi, type MerchantCustomer } from "@/features/admin/api/admin-api";
import { useAdminQuery } from "@/features/admin/hooks/use-admin-query";
import { downloadCustomersCsv } from "@/features/admin/customers/customers-csv";

const PAGE_SIZE = 50;
const SORTS = [{ value: "name", label: "Name A–Z" }, { value: "orders", label: "Most orders first" }, { value: "spent", label: "Biggest spenders first" }];
const TABS: IndexTab[] = [{ id: "", label: "All" }, { id: "ordered", label: "Have ordered" }, { id: "never", label: "Never ordered" }, { id: "subscribed", label: "Email subscribers" }];
const VIEW_TEST: Record<string, (customer: MerchantCustomer) => boolean> = {
  ordered: (customer) => customer.orderCount > 0,
  never: (customer) => customer.orderCount === 0,
  subscribed: (customer) => Boolean(customer.acceptsEmailMarketing),
};

export default function CustomersPage() {
  const { session, activeStore } = useAuth();
  const api = useMemo(() => session ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session]);
  const load = useCallback(() => api!.listCustomers(activeStore!.id), [api, activeStore]);
  const query = useAdminQuery(api && activeStore ? `customers:${activeStore.id}` : null, load);
  const [view, setView] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [place, setPlace] = useState("");
  const [sort, setSort] = useState("name");
  const [pageIndex, setPageIndex] = useState(0);
  const all = useMemo(() => query.data?.customers ?? [], [query.data]);
  const needle = search.trim().toLowerCase();
  // What the Tag and Place filters can offer: only values this store's customers actually have.
  const tagChoices = useMemo(() => [...new Set(all.flatMap((customer) => customer.tags ?? []))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })), [all]);
  const placeChoices = useMemo(() => [...new Set(all.map((customer) => customer.location).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })), [all]);
  const matching = useMemo(() => all
    .filter((customer) => (!view || VIEW_TEST[view](customer)) && (!tag || (customer.tags ?? []).includes(tag)) && (!place || customer.location === place)
      && (!needle || [customer.name, customer.email, customer.phone, customer.location, ...(customer.tags ?? [])].some((value) => value?.toLowerCase().includes(needle))))
    .sort((a, b) => sort === "orders" ? b.orderCount - a.orderCount : sort === "spent" ? b.lifetimeSpendMinor - a.lifetimeSpendMinor : a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
  [all, view, tag, place, needle, sort]);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(pageIndex, pages - 1);
  const rows = matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const filtered = Boolean(view || tag || place || needle);
  const first = () => setPageIndex(0);
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: activeStore?.currency ?? "GBP" }).format(minor / 100);
  const tabs = TABS.map((tab) => ({ ...tab, count: query.data ? (tab.id ? all.filter(VIEW_TEST[tab.id]).length : all.length) : undefined }));

  const columns: IndexColumn<MerchantCustomer>[] = [
    { id: "name", header: "Customer", mobile: "primary", cell: (customer) => <div className="min-w-0"><Link href={`/admin/customers/${encodeURIComponent(customer.id)}`} className="jk-cell-strong">{customer.name}</Link>{customer.email && customer.email !== customer.name && <span className="jk-cell-sub truncate">{customer.email}</span>}</div> },
    { id: "subscription", header: "Email marketing", cell: (customer) => customer.acceptsEmailMarketing ? <StatusBadge tone="success">Subscribed</StatusBadge> : <StatusBadge tone="neutral">Not subscribed</StatusBadge> },
    { id: "location", header: "Location", mobile: "hidden", cell: (customer) => customer.location || <span className="jk-muted">None</span> },
    { id: "orders", header: "Orders", align: "end", cell: (customer) => customer.orderCount },
    { id: "spent", header: "Amount spent", align: "end", cell: (customer) => <span className="tabular-nums">{money(customer.lifetimeSpendMinor)}</span> },
    { id: "tags", header: "Tags", mobile: "hidden", cell: (customer) => customer.tags?.length ? customer.tags.slice(0, 3).join(", ") + (customer.tags.length > 3 ? ` +${customer.tags.length - 3}` : "") : <span className="jk-muted">None</span> },
  ];

  return <AdminPage title="Customers" description="Everyone who has ordered from you, and people you add yourself. Open a customer to see their orders, add a note or tag them." primaryAction={{ label: "Add customer", href: "/admin/customers/new" }}>
    <IndexTable label="Customers" rows={rows} rowKey={(customer) => customer.id} rowLabel={(customer) => customer.name} columns={columns}
      loading={query.loading} error={query.error?.message} onRetry={query.retry}
      tabs={tabs} activeTab={view} onTabChange={(id) => { setView(id); first(); }}
      search={{ value: search, onChange: (value) => { setSearch(value); first(); }, label: "Search customers", placeholder: "Search by name, email, phone, place or tag" }}
      filters={<>
        {tagChoices.length > 0 && <label><span className="sr-only">Filter by tag</span><select className="jk-select" value={tag} onChange={(event) => { setTag(event.target.value); first(); }}><option value="">All tags</option>{tagChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
        {placeChoices.length > 1 && <label><span className="sr-only">Filter by place</span><select className="jk-select" value={place} onChange={(event) => { setPlace(event.target.value); first(); }}><option value="">All places</option>{placeChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
        {(tag || place) && <button type="button" className="jk-button jk-button-plain" onClick={() => { setTag(""); setPlace(""); first(); }}>Clear filters</button>}
        <label><span className="sr-only">Sort customers</span><select className="jk-select" value={sort} onChange={(event) => { setSort(event.target.value); first(); }}>{SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </>}
      bulkActions={[{ label: "Export to CSV", onAction: (ids) => downloadCustomersCsv(all.filter((customer) => ids.includes(customer.id))) }]}
      emptyState={all.length || filtered
        ? <EmptyState icon={Users} title="No matching customers" description="Try another search, clear the filters, or choose All." />
        : <EmptyState icon={Users} title="No customers yet" description="Customers appear here after their first order. You can also add someone yourself, for example a customer who orders by phone." action={<Link href="/admin/customers/new" className="jk-button jk-button-primary">Add customer</Link>} />}
      pagination={rows.length ? { summary: `${matching.length} ${matching.length === 1 ? "customer" : "customers"}${pages > 1 ? ` · Page ${page + 1} of ${pages}` : ""}`, hasPrevious: page > 0, hasNext: page < pages - 1, onPrevious: () => setPageIndex(page - 1), onNext: () => setPageIndex(page + 1) } : undefined} />
  </AdminPage>;
}
