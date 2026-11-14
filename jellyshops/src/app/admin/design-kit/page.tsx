"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Package, Plus } from "lucide-react";
import {
  AdminPage, Banner, Button, Card, CardSkeleton, Combobox, ConfirmDialog, DetailLayout, EmptyState, Field, HelpTip, IndexTable, Picker, ResourceForm,
  SelectList, SplitLayout, StatusBadge, Tabs, TagInput, buttonClass, useToast, type IndexColumn, type SortDirection, type StatusKind,
} from "@/components/admin";

/**
 * Every admin kit component with sample data, for designers and developers. Not linked from the menu.
 * When you add or change a kit part, show it here. Rules for using the parts: docs/admin-design-guide.md.
 */
type SampleOrder = { id: string; number: string; customer: string; payment: string; fulfilment: string; total: number };
const SAMPLE: SampleOrder[] = [
  { id: "1", number: "JS-1004", customer: "Rahul Kumar", payment: "PAID", fulfilment: "UNFULFILLED", total: 162400 },
  { id: "2", number: "JS-1003", customer: "Asha Rao", payment: "PAID", fulfilment: "DELIVERED", total: 42400 },
  { id: "3", number: "JS-1002", customer: "Sam Lee", payment: "PENDING", fulfilment: "PENDING_PAYMENT", total: 3200 },
];
const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
const COLUMNS: IndexColumn<SampleOrder>[] = [
  { id: "order", header: "Order", mobile: "primary", sortKey: "number", cell: (row) => <Link href="/admin/design-kit" className="jk-cell-strong">{row.number}</Link> },
  { id: "customer", header: "Customer", sortKey: "customer", cell: (row) => row.customer },
  { id: "payment", header: "Payment", cell: (row) => <StatusBadge kind="payment" value={row.payment} /> },
  { id: "fulfilment", header: "Fulfilment", cell: (row) => <StatusBadge kind="fulfilment" value={row.fulfilment} /> },
  { id: "total", header: "Total", align: "end", sortKey: "total", cell: (row) => <strong>{money(row.total)}</strong> },
];
const BADGES: Array<[StatusKind, string]> = [["order", "PENDING_PAYMENT"], ["order", "PAID"], ["order", "PROCESSING"], ["order", "DELIVERED"], ["order", "CANCELLED"], ["payment", "FAILED"], ["product", "DRAFT"], ["stock", "LOW_STOCK"]];
const PRODUCTS = ["Linen Tote Bag", "Everyday Crew Tee", "Hybrid Mattress", "Cambridge Headboard"].map((label, index) => ({ id: `p${index}`, label, detail: `${10 + index * 7} in stock` }));
const COUNTRIES = [["GB", "United Kingdom", "GBP"], ["IN", "India", "INR"], ["IE", "Ireland", "EUR"], ["FR", "France", "EUR"], ["DE", "Germany", "EUR"], ["US", "United States", "USD"], ["AE", "United Arab Emirates", "AED"], ["AU", "Australia", "AUD"]]
  .map(([value, label, detail]) => ({ value, label, detail }));
const BRANDS = ["Harbour", "Linden", "Resthaven", "Northfold"].map((label) => ({ value: label, label }));
const PAGES = [{ id: "about", label: "About us", sub: "/pages/about" }, { id: "delivery", label: "Delivery and returns", sub: "/pages/delivery" }, { id: "contact", label: "Contact", sub: "/pages/contact" }];
const COLOURS = ["surface", "surface-subdued", "surface-hover", "surface-selected", "border", "border-strong", "text", "text-subdued", "accent", "brand", "brand-soft", "focus", "info-bg", "success-bg", "warning-bg", "attention-bg", "critical-bg", "neutral-bg"];

export default function DesignKitPage() {
  const toast = useToast();
  const [tab, setTab] = useState("");
  const [view, setView] = useState("buttons");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: "number", direction: "desc" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("Linen Tote Bag");
  const [savedTitle, setSavedTitle] = useState("Linen Tote Bag");
  const [country, setCountry] = useState("GB");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState(["summer", "cotton"]);
  const [page, setPage] = useState("about");
  const [chip, setChip] = useState("All");
  const loadProducts = useCallback(async (query: string) => PRODUCTS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), []);
  const rows = SAMPLE.filter((row) => row.customer.toLowerCase().includes(search.toLowerCase()) && (!tab || row.fulfilment === tab))
    .sort((a, b) => { const key = sort.key as keyof SampleOrder; const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; return sort.direction === "asc" ? order : -order; });
  const pretendSave = () => { setBusy(true); window.setTimeout(() => { setBusy(false); toast("Product saved"); }, 1200); };
  return <AdminPage title="Design kit" description="The building blocks every admin page uses. Change a component here and every page follows."
    primaryAction={{ label: "Show a toast", onAction: () => toast("Product saved", { action: { label: "Undo", onAction: () => toast("Change undone") } }) }}
    secondaryActions={[{ label: loading ? "Stop loading" : "Show loading", onAction: () => setLoading((value) => !value) }]}
    moreActions={[{ label: "Open picker", onAction: () => setPicker(true) }, { label: "Delete sample", destructive: true, onAction: () => setConfirm(true) }]}
    badges={<StatusBadge tone="info">Internal</StatusBadge>}>

    <Card title="Buttons" description="One primary button per page or dialog. Destructive buttons always open a confirm first.">
      <div className="jk-stack-sm">
        <div className="jk-row">
          <Button variant="primary" loading={busy} loadingLabel="Saving…" onClick={pretendSave}>Save product</Button>
          <Button>Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="destructive-quiet" onClick={() => setConfirm(true)}>Delete…</Button>
          <Button variant="destructive">Delete product</Button>
          <Button disabled>Disabled</Button>
          <Button icon={<Plus size={14} aria-hidden="true" />}>With icon</Button>
          <Link href="/admin/design-kit" className={buttonClass("secondary")}>Link as button</Link>
        </div>
        <div className="jk-row"><Button size="small">Small</Button><Button>Medium</Button><Button size="large">Large</Button><Button size="large" variant="primary" loading>Large</Button></div>
      </div>
    </Card>

    <Card title="Status badges" description="Every API code goes through one label map. Merchants never see the code itself.">
      <div className="jk-row">{BADGES.map(([kind, value]) => <StatusBadge key={kind + value} kind={kind} value={value} />)}</div>
    </Card>

    <IndexTable label="Sample orders" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => `order ${row.number}`} columns={COLUMNS} loading={loading}
      tabs={[{ id: "", label: "All", count: SAMPLE.length }, { id: "UNFULFILLED", label: "Unfulfilled", count: 1 }, { id: "DELIVERED", label: "Delivered", count: 1 }]} activeTab={tab} onTabChange={setTab}
      search={{ value: search, onChange: setSearch, label: "Search sample orders", placeholder: "Search by customer" }}
      sort={{ ...sort, onChange: (key, direction) => setSort({ key, direction }) }}
      bulkActions={[{ label: "Export to CSV", onAction: (ids) => toast(`${ids.length} orders exported`) }, { label: "Archive", onAction: () => Promise.reject(new Error("Archiving is not built yet. This shows how a failed bulk action looks.")) }]}
      emptyState={<EmptyState icon={Package} title="No matching orders" description="Try another search, or choose All." />}
      pagination={{ summary: `${rows.length} orders · Page 1 of 1`, hasPrevious: false, hasNext: false, onPrevious: () => undefined, onNext: () => undefined }} />

    <DetailLayout
      main={<ResourceForm dirty={title !== savedTitle} onDiscard={() => setTitle(savedTitle)} onSubmit={async () => { if (!title.trim()) throw new Error("Add a product name."); await new Promise((resolve) => setTimeout(resolve, 400)); setSavedTitle(title); toast("Product saved"); }}>
        <Card title="Form fields" description="Type in the name to see the save bar. Clear it to see an inline error.">
          <div className="jk-stack-sm">
            <Field id="kit-title" required label={<>Product name <HelpTip>The name shoppers see on your store and in their order email.</HelpTip></>} help="Keep it short; 60 characters or fewer reads best." error={title.trim() ? undefined : "Add a product name."}>
              <input id="kit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <div className="jk-grid-2">
              <Field id="kit-country" label="Country" help="A long list: type to narrow it down.">
                <Combobox id="kit-country" value={country} onChange={setCountry} options={COUNTRIES} placeholder="Search countries" />
              </Field>
              <Field id="kit-brand" label="Brand" help="Pick one or type a new brand.">
                <Combobox id="kit-brand" value={brand} onChange={setBrand} options={BRANDS} allowCustom placeholder="Search or add a brand" />
              </Field>
            </div>
            <TagInput label="Tags" value={tags} onChange={setTags} known={["summer", "cotton", "gift", "new"]} help="Used to group products in searches and filters." />
            <label className="jk-check"><input type="checkbox" defaultChecked /><span>Track stock for this product<span className="jk-cell-sub">Switch off for made-to-order items.</span></span></label>
          </div>
        </Card>
      </ResourceForm>}
      side={<>
        <Banner tone="info" title="Heads up">A neutral message with something worth knowing.</Banner>
        <Banner tone="warning" title="Low stock">2 variants have 3 or fewer left.</Banner>
        <Banner tone="critical" title="Not saved" action={<Button size="small">Try again</Button>}>We could not reach the server.</Banner>
        <Banner tone="success">Payments are switched on.</Banner>
        <Card title="Picked products">{picked.length ? <ul className="jk-muted">{picked.map((name) => <li key={name}>{name}</li>)}</ul> : <p className="jk-muted">Use More actions, then Open picker.</p>}</Card>
        <CardSkeleton label="Loading example" />
      </>} />

    <Card title="Tabs and chips" description="Tabs switch between views of one page. Chips are quick filters. Arrow keys move between tabs.">
      <div className="jk-stack-sm">
        <Tabs label="Kit sections" tabs={[{ id: "buttons", label: "Buttons" }, { id: "forms", label: "Forms", count: 4 }, { id: "tables", label: "Tables" }]} active={view} onChange={setView} />
        <p className="jk-muted">Showing: {view}</p>
        <div className="jk-chips" role="group" aria-label="Filter by shop type">{["All", "Fashion", "Home", "Electronics"].map((name) => <button key={name} type="button" className="jk-chip" aria-pressed={chip === name} onClick={() => setChip(name)}>{name}</button>)}</div>
      </div>
    </Card>

    <SplitLayout list={<SelectList label="Pages" title="Select list" items={PAGES.map((item) => ({ ...item, badge: item.id === "contact" ? <StatusBadge tone="neutral">Draft</StatusBadge> : undefined }))} selectedId={page} onSelect={setPage} footer={<Button size="small">Add page</Button>} />}>
      <Card title="Split layout" description="A list on the left and the chosen item on the right. Used by Pages, Blog posts, Menus and Custom content.">
        <p className="jk-muted">Chosen: {PAGES.find((item) => item.id === page)?.label}</p>
      </Card>
    </SplitLayout>

    <Card title="Empty state"><EmptyState icon={Package} title="Add your first product" description="Give customers something to discover in your store." action={<Button variant="primary">Add product</Button>} learnMore={{ href: "/admin/design-kit", label: "How products work" }} /></Card>

    <Card title="Colours" description="Pages never write a colour. They use these tokens, which change in dark mode.">
      <div className="jk-swatches">{COLOURS.map((name) => <div key={name} className="jk-swatch"><span style={{ background: `var(--jk-${name})` }} />--jk-{name}</div>)}</div>
    </Card>

    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete Linen Tote Bag?" description="The product and its photos are removed from your store. This cannot be undone." confirmLabel="Delete product" destructive onConfirm={() => toast("Sample deleted")} />
    <Picker open={picker} onOpenChange={setPicker} title="Add products" searchLabel="Search products" load={loadProducts} onDone={(items) => setPicked(items.map((item) => item.label))} />
  </AdminPage>;
}
