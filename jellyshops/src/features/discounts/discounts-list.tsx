"use client";

import { Percent, Receipt, ShoppingBag, Tag, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountStatus, type DiscountType } from "@jelly/storefront-schema";
import { AdminPage, Button, ConfirmDialog, EmptyState, IndexTable, StatusBadge, useClientList, useToast, type BulkAction, type IndexColumn } from "@/components/admin";
import Link, { useAdminRouter } from "@/features/admin/admin-routing";
import { KpiCard } from "@/features/admin/home/dashboard-parts";
import { useDiscountsApi, type DiscountList, type MerchantDiscount } from "./api";
import { DISCOUNT_METHOD_INFO, DISCOUNT_STATUS_INFO, DISCOUNT_TYPE_INFO, discountDates, discountSentence, moneyFormatter, usesText } from "./discount-words";
import { DiscountTypePicker, newDiscountHref } from "./type-picker";
import { DISCOUNT_TEMPLATES } from "./templates";

type Tab = "all" | "active" | "scheduled" | "expired" | "disabled";
const TABS: Array<{ id: Tab; label: string; matches: (status: DiscountStatus) => boolean }> = [
  { id: "all", label: "All", matches: () => true },
  { id: "active", label: "Active", matches: (status) => status === "active" },
  { id: "scheduled", label: "Scheduled", matches: (status) => status === "scheduled" },
  { id: "expired", label: "Expired", matches: (status) => status === "expired" || status === "used_up" },
  { id: "disabled", label: "Switched off", matches: (status) => status === "disabled" },
];

const SORTS = [
  { value: "created:desc", label: "Newest first" },
  { value: "title:asc", label: "Title A to Z" },
  { value: "uses:desc", label: "Most used" },
  { value: "sales:desc", label: "Highest sales" },
  { value: "ends:asc", label: "Ending soonest" },
  { value: "starts:desc", label: "Starting latest" },
];

const time = (iso: string | null, empty: number) => (iso ? new Date(iso).getTime() : empty);

/** Discounts: every code and automatic discount, how each is doing, and the way into creating one. */
export function DiscountsList() {
  const api = useDiscountsApi();
  const { list, bulk, ready, storeId, currency, canManage } = api;
  const router = useAdminRouter();
  const toast = useToast();
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const [data, setData] = useState<DiscountList | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([storeId, revision]);
  const [loadedKey, setLoadedKey] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState<DiscountType | "">("");
  const [methodFilter, setMethodFilter] = useState<DiscountMethod | "">("");
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState<string[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    list().then((result) => { if (active) { setData(result); setError(""); } })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [list, ready, requestKey]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const all = useMemo(() => data?.discounts ?? [], [data]);
  const timeZone = data?.timeZone ?? "Europe/London";
  const inTab = TABS.find((item) => item.id === tab)!;
  const filtered = useMemo(() => all.filter((row) => inTab.matches(row.status) && (!typeFilter || row.type === typeFilter) && (!methodFilter || row.method === methodFilter)), [all, inTab, typeFilter, methodFilter]);
  const shown = useClientList(filtered, {
    text: (row) => `${row.title} ${row.code ?? ""}`,
    sortBy: { title: (row) => row.title.toLowerCase(), uses: (row) => row.uses, starts: (row) => time(row.startsAt, 0), ends: (row) => time(row.endsAt, Number.MAX_SAFE_INTEGER), sales: (row) => row.salesMinor, created: (row) => time(row.createdAt, 0) },
    initialSort: { key: "created", direction: "desc" },
    noun: ["discount", "discounts"],
    searchLabel: "Search by title or code",
  });
  const filtersOn = Boolean(typeFilter || methodFilter);

  const columns: IndexColumn<MerchantDiscount>[] = [
    {
      id: "title", header: "Discount", mobile: "primary", sortKey: "title",
      cell: (row) => <div className="jk-discount-cell">
        <Link href={`/admin/discounts/${encodeURIComponent(row.id)}`} className="jk-link jk-strong">{row.title}</Link>
        {row.method === "code" && row.code && row.code !== row.title && <span className="jk-code">{row.code}{row.codeCount > 1 ? ` +${row.codeCount - 1}` : ""}</span>}
        <span className="jk-discount-summary">{discountSentence(row, { timeZone, formatMoney: money })}</span>
      </div>,
    },
    { id: "type", header: "Type", cell: (row) => DISCOUNT_TYPE_INFO[row.type].label },
    { id: "method", header: "Method", cell: (row) => <span className="jk-discount-method">{row.method === "automatic" ? <Zap size={14} aria-hidden="true" /> : <Tag size={14} aria-hidden="true" />}{DISCOUNT_METHOD_INFO[row.method].label}</span> },
    { id: "status", header: "Status", cell: (row) => <StatusBadge tone={DISCOUNT_STATUS_INFO[row.status].tone}>{DISCOUNT_STATUS_INFO[row.status].label}</StatusBadge> },
    { id: "uses", header: "Used", align: "end", sortKey: "uses", cell: (row) => usesText(row) },
    { id: "sales", header: "Sales", align: "end", sortKey: "sales", mobile: "hidden", cell: (row) => (row.paidOrders ? money(row.salesMinor) : "None yet") },
    { id: "dates", header: "Dates", sortKey: "ends", mobile: "hidden", cell: (row) => discountDates(row, timeZone) },
  ];

  const bulkActions: BulkAction[] = canManage ? [
    { label: "Switch on", onAction: (ids) => runBulk(ids, "enable") },
    { label: "Switch off", onAction: (ids) => runBulk(ids, "disable") },
    { label: "Delete", destructive: true, onAction: (ids) => setDeleting(ids) },
  ] : [];

  async function runBulk(ids: string[], action: "enable" | "disable") {
    try {
      const changed = await bulk(ids, action);
      toast(`${changed} ${changed === 1 ? "discount" : "discounts"} switched ${action === "enable" ? "on" : "off"}`);
      reload();
    } catch (failure) { toast((failure as Error).message); }
  }

  const create = canManage ? { label: "Create discount", onAction: () => setPicking(true) } : undefined;
  const totals = data?.totals;
  const loading = ready && loadedKey !== requestKey;
  const counts = Object.fromEntries(TABS.map((item) => [item.id, all.filter((row) => item.matches(row.status)).length])) as Record<Tab, number>;

  return <AdminPage title="Discounts" description="Money off, free shipping and offers, given by a code or automatically to everyone who qualifies." width="full" primaryAction={create}>
    {(all.length > 0 || loading) && <div className="jk-kpis jk-discount-kpis" aria-label="How your discounts are doing">
      <KpiCard label="Active discounts" value={String(totals?.active ?? 0)} icon={Percent} loading={loading && !data} hint={`${all.length} in total`} />
      <KpiCard label="Times used" value={String(totals?.uses ?? 0)} icon={Receipt} loading={loading && !data} hint="Orders not cancelled, including those waiting for payment" />
      <KpiCard label="Sales with discounts" value={money(totals?.salesMinor ?? 0)} icon={ShoppingBag} loading={loading && !data} hint={`${totals?.paidOrders ?? 0} paid ${totals?.paidOrders === 1 ? "order" : "orders"}`} />
      <KpiCard label="Given away" value={money(totals?.givenMinor ?? 0)} icon={Tag} loading={loading && !data} hint="Taken off paid orders, delivery included" />
    </div>}

    <IndexTable
      label="Discounts"
      rows={shown.rows}
      rowKey={(row) => row.id}
      rowLabel={(row) => row.title}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={reload}
      tabs={TABS.map((item) => ({ id: item.id, label: item.label, count: data ? counts[item.id] : undefined }))}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      search={shown.search}
      sort={shown.sort}
      filters={all.length > 0 ? <>
        <label><span className="sr-only">Type</span><select className="jk-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as DiscountType | "")}>
          <option value="">All types</option>
          {DISCOUNT_TYPES.map((value) => <option key={value} value={value}>{DISCOUNT_TYPE_INFO[value].label}</option>)}
        </select></label>
        <label><span className="sr-only">Method</span><select className="jk-select" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as DiscountMethod | "")}>
          <option value="">All methods</option>
          {DISCOUNT_METHODS.map((value) => <option key={value} value={value}>{DISCOUNT_METHOD_INFO[value].label}</option>)}
        </select></label>
        {/* Column headings are hidden on phones, so sorting has its own choice too. */}
        <label><span className="sr-only">Sort discounts</span><select className="jk-select" value={shown.sort ? `${shown.sort.key}:${shown.sort.direction}` : ""} onChange={(event) => { const [key, direction] = event.target.value.split(":"); shown.sort?.onChange(key!, direction as "asc" | "desc"); }}>
          {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        {filtersOn && <Button size="small" variant="quiet" onClick={() => { setTypeFilter(""); setMethodFilter(""); }}>Clear filters</Button>}
      </> : undefined}
      bulkActions={bulkActions}
      pagination={shown.pagination}
      emptyState={all.length === 0
        ? <EmptyState icon={Percent} title="Create your first discount" description="Win new customers and reward loyal ones with money off, free shipping or a free gift. Start from scratch or from one of these:"
          action={canManage ? <div className="jk-discount-empty">
            <Button variant="primary" size="large" onClick={() => setPicking(true)}>Create discount</Button>
            <ul className="jk-discount-empty-templates">{DISCOUNT_TEMPLATES.slice(0, 3).map((template) => <li key={template.id}><Link href={newDiscountHref({ template: template.id })} className="jk-link">{template.title}</Link></li>)}</ul>
          </div> : undefined} />
        : <EmptyState icon={Percent} title="No discounts match" description="Try another search, tab or filter." action={filtersOn ? <Button onClick={() => { setTypeFilter(""); setMethodFilter(""); }}>Clear filters</Button> : undefined} />}
    />

    <DiscountTypePicker open={picking} onOpenChange={setPicking} onChoose={(href) => { setPicking(false); router.push(href); }} />

    <ConfirmDialog
      open={deleting !== null}
      onOpenChange={(next) => { if (!next) setDeleting(null); }}
      title={deleting?.length === 1 ? `Delete ${all.find((row) => row.id === deleting[0])?.title ?? "this discount"}?` : `Delete ${deleting?.length ?? 0} discounts?`}
      description="Customers won't be able to use them any more. Orders already placed keep their discount, and the results stay in your reports. This can't be undone; switch a discount off instead if you may want it again."
      confirmLabel={deleting?.length === 1 ? "Delete discount" : "Delete discounts"}
      destructive
      onConfirm={async () => {
        if (!deleting) return;
        const changed = await bulk(deleting, "delete");
        toast(`${changed} ${changed === 1 ? "discount" : "discounts"} deleted`);
        setDeleting(null);
        reload();
      }}
    />
  </AdminPage>;
}
