"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Percent } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountStatus, type DiscountType } from "@jelly/storefront-schema";
import { AdminPage, Button, ConfirmDialog, EmptyState, IndexTable, StatusBadge, useClientList, useToast, type BulkAction, type IndexColumn } from "@/components/admin";
import Link, { useAdminRouter } from "@/features/admin/admin-routing";
import { useDiscountsApi, type DiscountList, type MerchantDiscount } from "./api";
import { DISCOUNT_METHOD_INFO, DISCOUNT_STATUS_INFO, DISCOUNT_TYPE_INFO, discountDates, moneyFormatter, shortDescription, usesText } from "./discount-words";
import { DiscountTypePicker, newDiscountHref } from "./type-picker";
import { DISCOUNT_TEMPLATES } from "./templates";

type Tab = "all" | "active" | "scheduled" | "expired" | "disabled";
const TABS: Array<{ id: Tab; label: string; matches: (status: DiscountStatus) => boolean }> = [
  { id: "all", label: "All", matches: () => true },
  { id: "active", label: "Active", matches: (status) => status === "active" },
  { id: "scheduled", label: "Scheduled", matches: (status) => status === "scheduled" },
  { id: "expired", label: "Expired", matches: (status) => status === "expired" || status === "used_up" },
  { id: "disabled", label: "Disabled", matches: (status) => status === "disabled" },
];

const SORTS = [
  { value: "created:desc", label: "Newest first" },
  { value: "title:asc", label: "Title A to Z" },
  { value: "uses:desc", label: "Most used" },
  { value: "ends:asc", label: "Ending soonest" },
];

const time = (iso: string | null, empty: number) => (iso ? new Date(iso).getTime() : empty);

/** Discounts: every code and automatic discount at a glance, with quick actions on each row. */
export function DiscountsList() {
  const api = useDiscountsApi();
  const { list, bulk, duplicate, ready, storeId, currency, canManage } = api;
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
    sortBy: { title: (row) => row.title.toLowerCase(), uses: (row) => row.uses, ends: (row) => time(row.endsAt, Number.MAX_SAFE_INTEGER), created: (row) => time(row.createdAt, 0) },
    initialSort: { key: "created", direction: "desc" },
    noun: ["discount", "discounts"],
    searchLabel: "Search by title or code",
  });
  const filtersOn = Boolean(typeFilter || methodFilter);

  const runBulk = useCallback(async (ids: string[], action: "enable" | "disable") => {
    try {
      const changed = await bulk(ids, action);
      toast(`${changed} ${changed === 1 ? "discount" : "discounts"} ${action === "enable" ? "enabled" : "disabled"}`);
      reload();
    } catch (failure) { toast((failure as Error).message); }
  }, [bulk, toast, reload]);

  const copy = useCallback(async (row: MerchantDiscount) => {
    try {
      const made = await duplicate(row.id);
      toast(`Copy made (disabled): ${made.title}`);
      router.push(`/admin/discounts/${encodeURIComponent(made.id)}`);
    } catch (failure) { toast((failure as Error).message); }
  }, [duplicate, toast, router]);

  const columns: IndexColumn<MerchantDiscount>[] = [
    {
      id: "title", header: "Discount", mobile: "primary", sortKey: "title",
      cell: (row) => <div className="jk-discount-cell">
        <span className="jk-discount-cell-title">
          <Link href={`/admin/discounts/${encodeURIComponent(row.id)}`} className="jk-link jk-strong">{row.title}</Link>
          {row.method === "code" && row.code && row.code !== row.title && <span className="jk-code">{row.code}{row.codeCount > 1 ? ` +${row.codeCount - 1}` : ""}</span>}
        </span>
        <span className="jk-discount-summary">{shortDescription(row, { formatMoney: money })}</span>
      </div>,
    },
    { id: "type", header: "Type", mobile: "hidden", cell: (row) => <span className="jk-discount-type-cell">{DISCOUNT_TYPE_INFO[row.type].label}<span className="jk-muted">{row.method === "automatic" ? "Automatic" : "Code"}</span></span> },
    { id: "status", header: "Status", cell: (row) => <span className="jk-discount-status"><StatusBadge tone={DISCOUNT_STATUS_INFO[row.status].tone}>{DISCOUNT_STATUS_INFO[row.status].label}</StatusBadge>{row.status === "used_up" && <span className="jk-muted">Used up</span>}</span> },
    { id: "uses", header: "Used", align: "end", sortKey: "uses", cell: (row) => usesText(row) },
    { id: "dates", header: "Dates", sortKey: "ends", mobile: "hidden", cell: (row) => <span className="jk-muted">{discountDates(row, timeZone)}</span> },
    ...(canManage ? [{
      id: "actions", header: "Actions", hideHeader: true, align: "end" as const,
      cell: (row: MerchantDiscount) => <RowActions row={row} onDuplicate={() => void copy(row)} onToggle={() => void runBulk([row.id], row.active ? "disable" : "enable")} onDelete={() => setDeleting([row.id])} />,
    }] : []),
  ];

  const bulkActions: BulkAction[] = canManage ? [
    { label: "Enable", onAction: (ids) => runBulk(ids, "enable") },
    { label: "Disable", onAction: (ids) => runBulk(ids, "disable") },
    { label: "Delete", destructive: true, onAction: (ids) => setDeleting(ids) },
  ] : [];

  // One "Create discount" at a time: the empty state has its own.
  const create = canManage ? { label: "Create discount", onAction: () => setPicking(true) } : undefined;
  const totals = data?.totals;
  const loading = ready && loadedKey !== requestKey;
  const counts = Object.fromEntries(TABS.map((item) => [item.id, all.filter((row) => item.matches(row.status)).length])) as Record<Tab, number>;

  return <AdminPage title="Discounts" description="Money off and free shipping, by code or automatically." width="full" primaryAction={all.length > 0 || error ? create : undefined}>
    {all.length > 0 && totals && <p className="jk-discount-stats" aria-label="How your discounts are doing">
      <span><strong>{totals.active}</strong> active</span>
      <span><strong>{totals.uses}</strong> {totals.uses === 1 ? "use" : "uses"}</span>
      <span><strong>{money(totals.salesMinor)}</strong> in sales with discounts</span>
      <span><strong>{money(totals.givenMinor)}</strong> given away</span>
    </p>}

    <IndexTable
      label="Discounts"
      rows={shown.rows}
      rowKey={(row) => row.id}
      rowLabel={(row) => row.title}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={reload}
      tabs={all.length > 0 ? TABS.map((item) => ({ id: item.id, label: item.label, count: data ? counts[item.id] : undefined })) : undefined}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      search={all.length > 0 ? shown.search : undefined}
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
      pagination={all.length > 0 ? shown.pagination : undefined}
      emptyState={all.length === 0
        ? <EmptyState icon={Percent} title="No discounts yet" description="Offer money off or free shipping with a code, or automatically to everyone who qualifies."
          action={canManage ? <div className="jk-discount-empty">
            <Button variant="primary" onClick={() => setPicking(true)}>Create discount</Button>
            <p className="jk-muted">Or start from a template:</p>
            <ul className="jk-discount-empty-templates">{DISCOUNT_TEMPLATES.slice(0, 3).map((template) => <li key={template.id}><Link href={newDiscountHref({ template: template.id })} className="jk-discount-template-chip">{template.title}</Link></li>)}</ul>
          </div> : undefined} />
        : <EmptyState icon={Percent} title="No discounts match" description="Try another search, tab or filter." action={filtersOn ? <Button onClick={() => { setTypeFilter(""); setMethodFilter(""); }}>Clear filters</Button> : undefined} />}
    />

    <DiscountTypePicker open={picking} onOpenChange={setPicking} onChoose={(href) => { setPicking(false); router.push(href); }} />

    <ConfirmDialog
      open={deleting !== null}
      onOpenChange={(next) => { if (!next) setDeleting(null); }}
      title={deleting?.length === 1 ? `Delete ${all.find((row) => row.id === deleting[0])?.title ?? "this discount"}?` : `Delete ${deleting?.length ?? 0} discounts?`}
      description="Customers won't be able to use them any more. Orders already placed keep their discount, and the results stay in your reports. This can't be undone; disable a discount instead if you may want it again."
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

/** The ⋯ menu on each row: Edit, Duplicate, Enable or Disable, Delete (which asks first). */
function RowActions({ row, onDuplicate, onToggle, onDelete }: { row: MerchantDiscount; onDuplicate: () => void; onToggle: () => void; onDelete: () => void }) {
  const openingDialog = useRef(false);
  return <Dropdown.Root modal={false} onOpenChange={(open) => { if (open) openingDialog.current = false; }}>
    <Dropdown.Trigger className="jk-button jk-row-menu-trigger" aria-label={`Actions for ${row.title}`}><MoreHorizontal size={18} aria-hidden="true" /></Dropdown.Trigger>
    <Dropdown.Portal>
      <Dropdown.Content className="jk-row-menu" align="end" sideOffset={6} collisionPadding={12} onCloseAutoFocus={(event) => { if (openingDialog.current) event.preventDefault(); }}>
        <Dropdown.Item asChild><Link href={`/admin/discounts/${encodeURIComponent(row.id)}`}>Edit</Link></Dropdown.Item>
        <Dropdown.Item onSelect={onDuplicate}>Duplicate</Dropdown.Item>
        <Dropdown.Item onSelect={onToggle}>{row.active ? "Disable" : "Enable"}</Dropdown.Item>
        <Dropdown.Separator className="jk-row-menu-separator" />
        <Dropdown.Item className="is-critical" onSelect={() => { openingDialog.current = true; onDelete(); }}>Delete</Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Portal>
  </Dropdown.Root>;
}
