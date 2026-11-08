"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Package } from "lucide-react";
import {
  AdminPage, Banner, Card, CardSkeleton, ConfirmDialog, DetailLayout, EmptyState, Field, HelpTip, IndexTable, Picker, ResourceForm, StatusBadge,
  useToast, type IndexColumn, type StatusKind,
} from "@/components/admin";

/** Every admin kit component with sample data, for designers and developers. Not linked from the menu. */
type SampleOrder = { id: string; number: string; customer: string; payment: string; fulfilment: string; total: string };
const SAMPLE: SampleOrder[] = [
  { id: "1", number: "JS-1004", customer: "Rahul Kumar", payment: "PAID", fulfilment: "UNFULFILLED", total: "£1,624.00" },
  { id: "2", number: "JS-1003", customer: "Asha Rao", payment: "PAID", fulfilment: "DELIVERED", total: "£424.00" },
  { id: "3", number: "JS-1002", customer: "Sam Lee", payment: "PENDING", fulfilment: "PENDING_PAYMENT", total: "£32.00" },
];
const COLUMNS: IndexColumn<SampleOrder>[] = [
  { id: "order", header: "Order", mobile: "primary", cell: (row) => <Link href="/admin/design-kit" className="jk-cell-strong">{row.number}</Link> },
  { id: "customer", header: "Customer", cell: (row) => row.customer },
  { id: "payment", header: "Payment", cell: (row) => <StatusBadge kind="payment" value={row.payment} /> },
  { id: "fulfilment", header: "Fulfilment", cell: (row) => <StatusBadge kind="fulfilment" value={row.fulfilment} /> },
  { id: "total", header: "Total", align: "end", cell: (row) => <strong>{row.total}</strong> },
];
const BADGES: Array<[StatusKind, string]> = [["order", "PENDING_PAYMENT"], ["order", "PAID"], ["order", "PROCESSING"], ["order", "DELIVERED"], ["order", "CANCELLED"], ["payment", "FAILED"], ["product", "DRAFT"], ["stock", "LOW_STOCK"]];
const PRODUCTS = ["Linen Tote Bag", "Everyday Crew Tee", "Hybrid Mattress", "Cambridge Headboard"].map((label, index) => ({ id: `p${index}`, label, detail: `${10 + index * 7} in stock` }));

export default function DesignKitPage() {
  const toast = useToast();
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("Linen Tote Bag");
  const [savedTitle, setSavedTitle] = useState("Linen Tote Bag");
  const loadProducts = useCallback(async (query: string) => PRODUCTS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), []);
  const rows = SAMPLE.filter((row) => row.customer.toLowerCase().includes(search.toLowerCase()) && (!tab || row.fulfilment === tab));
  return <AdminPage title="Design kit" description="The building blocks every admin page uses. Change a component here and every page follows."
    primaryAction={{ label: "Show a toast", onAction: () => toast("Product saved", { action: { label: "Undo", onAction: () => toast("Change undone") } }) }}
    secondaryActions={[{ label: loading ? "Stop loading" : "Show loading", onAction: () => setLoading((value) => !value) }]}
    moreActions={[{ label: "Open picker", onAction: () => setPicker(true) }, { label: "Delete sample", destructive: true, onAction: () => setConfirm(true) }]}
    badges={<StatusBadge tone="info">Internal</StatusBadge>}>
    <Card title="Status badges" description="Every API code goes through one label map. Merchants never see the code itself.">
      <div className="jk-row">{BADGES.map(([kind, value]) => <StatusBadge key={kind + value} kind={kind} value={value} />)}</div>
    </Card>
    <IndexTable label="Sample orders" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => `order ${row.number}`} columns={COLUMNS} loading={loading}
      tabs={[{ id: "", label: "All", count: SAMPLE.length }, { id: "UNFULFILLED", label: "Unfulfilled", count: 1 }, { id: "DELIVERED", label: "Delivered", count: 1 }]} activeTab={tab} onTabChange={setTab}
      search={{ value: search, onChange: setSearch, label: "Search sample orders", placeholder: "Search by customer" }}
      bulkActions={[{ label: "Export to CSV", onAction: (ids) => toast(`${ids.length} orders exported`) }, { label: "Archive", onAction: () => Promise.reject(new Error("Archiving is not built yet. This shows how a failed bulk action looks.")) }]}
      emptyState={<EmptyState icon={Package} title="No matching orders" description="Try another search, or choose All." />}
      pagination={{ summary: `${rows.length} orders · Page 1 of 1`, hasPrevious: false, hasNext: false, onPrevious: () => undefined, onNext: () => undefined }} />
    <DetailLayout
      main={<ResourceForm dirty={title !== savedTitle} onDiscard={() => setTitle(savedTitle)} onSubmit={async () => { if (!title.trim()) throw new Error("Add a product name."); await new Promise((resolve) => setTimeout(resolve, 400)); setSavedTitle(title); toast("Product saved"); }}>
        <Card title="Resource form" description="Type in the field to see the save bar. Clear it and save to see an error.">
          <Field id="kit-title" label={<>Product name <HelpTip>The name shoppers see on your store and in their order email.</HelpTip></>} help="Keep it short; 60 characters or fewer reads best.">
            <input id="kit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        </Card>
      </ResourceForm>}
      side={<>
        <Banner tone="warning" title="Low stock">2 variants have 3 or fewer left.</Banner>
        <Banner tone="success">Payments are switched on.</Banner>
        <Card title="Picked products">{picked.length ? <ul className="jk-muted">{picked.map((name) => <li key={name}>{name}</li>)}</ul> : <p className="jk-muted">Use More actions, then Open picker.</p>}</Card>
        <CardSkeleton label="Loading example" />
      </>} />
    <Card title="Empty state"><EmptyState icon={Package} title="Add your first product" description="Give customers something to discover in your store." action={<button type="button" className="jk-button jk-button-primary">Add product</button>} learnMore={{ href: "/admin/design-kit", label: "How products work" }} /></Card>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete Linen Tote Bag?" description="The product and its photos are removed from your store. This cannot be undone." confirmLabel="Delete product" destructive onConfirm={() => toast("Sample deleted")} />
    <Picker open={picker} onOpenChange={setPicker} title="Add products" searchLabel="Search products" load={loadProducts} onDone={(items) => setPicked(items.map((item) => item.label))} />
  </AdminPage>;
}
