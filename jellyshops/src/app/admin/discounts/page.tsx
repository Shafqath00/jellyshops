"use client";
import { Percent } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminPage, Banner, Button, ConfirmDialog, EmptyState, Field, IndexTable, StatusBadge, useClientList, useToast, type IndexColumn } from "@/components/admin";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { discountState, useAdminDiscounts, type DiscountInput, type DiscountKind, type DiscountState, type MerchantDiscount } from "@/features/admin/api/discounts-api";

const STATE: Record<DiscountState, { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  "used-up": { label: "Used up", tone: "warning" },
  off: { label: "Switched off", tone: "neutral" },
};

const KIND_LABEL: Record<DiscountKind, string> = { percent: "Percentage off", fixed: "Amount off", free_shipping: "Free delivery" };

/** The form keeps money as typed text ("5.00"); the API takes minor units. */
interface Draft { id?: string; code: string; kind: DiscountKind; percent: string; amount: string; minimum: string; limit: string; oncePerCustomer: boolean; startsAt: string; endsAt: string; active: boolean; used: boolean }

const EMPTY: Draft = { code: "", kind: "percent", percent: "10", amount: "", minimum: "", limit: "", oncePerCustomer: false, startsAt: "", endsAt: "", active: true, used: false };

const toMinor = (text: string) => { const value = Number(text.replace(/[^0-9.]/g, "")); return text.trim() && Number.isFinite(value) ? Math.round(value * 100) : null; };
const fromMinor = (minor: number | null) => (minor === null ? "" : (minor / 100).toFixed(2));
/** Dates are chosen as whole days in the merchant's own time; a code ends at the end of its last day. */
const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00`).toISOString() : null);
const dayAfter = (day: string) => { if (!day) return null; const date = new Date(`${day}T00:00:00`); date.setDate(date.getDate() + 1); return date.toISOString(); };
const isoDay = (iso: string | null, endOfRange = false) => { if (!iso) return ""; const date = new Date(iso); if (endOfRange) date.setDate(date.getDate() - 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

function draftOf(discount: MerchantDiscount): Draft {
  return {
    id: discount.id, code: discount.code, kind: discount.kind,
    percent: discount.kind === "percent" ? String(discount.value) : "10", amount: discount.kind === "fixed" ? fromMinor(discount.value) : "",
    minimum: fromMinor(discount.minimumSubtotalMinor), limit: discount.usageLimit ? String(discount.usageLimit) : "",
    oncePerCustomer: discount.oncePerCustomer, startsAt: isoDay(discount.startsAt), endsAt: isoDay(discount.endsAt, true), active: discount.active, used: discount.uses > 0,
  };
}

function check(draft: Draft): { input?: DiscountInput; errors: Partial<Record<"code" | "value" | "minimum" | "limit" | "dates", string>> } {
  const errors: ReturnType<typeof check>["errors"] = {};
  const code = draft.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) errors.code = "Use 2 to 40 letters, numbers, dashes or underscores, with no spaces.";
  const percent = Number(draft.percent);
  const amount = toMinor(draft.amount);
  if (draft.kind === "percent" && !(Number.isInteger(percent) && percent >= 1 && percent <= 100)) errors.value = "Enter a whole number from 1 to 100.";
  if (draft.kind === "fixed" && !(amount && amount > 0)) errors.value = "Enter the amount to take off, for example 5.00.";
  const minimum = toMinor(draft.minimum);
  if (draft.minimum.trim() && !(minimum && minimum > 0)) errors.minimum = "Enter an amount, or leave it empty.";
  const limit = Number(draft.limit);
  if (draft.limit.trim() && !(Number.isInteger(limit) && limit >= 1)) errors.limit = "Enter a whole number, or leave it empty.";
  if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) errors.dates = "The last day must be on or after the first day.";
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      code, kind: draft.kind, value: draft.kind === "percent" ? percent : draft.kind === "fixed" ? amount! : 0,
      minimumSubtotalMinor: minimum, usageLimit: draft.limit.trim() ? limit : null, oncePerCustomer: draft.oncePerCustomer,
      startsAt: dayStart(draft.startsAt), endsAt: dayAfter(draft.endsAt), active: draft.active,
    },
  };
}

/** Discounts: codes shoppers type at checkout. */
export default function DiscountsPage() {
  const { list, create, update, remove, ready, storeId, currency } = useAdminDiscounts();
  const toast = useToast();
  const money = useCallback((minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100), [currency]);
  const [rows, setRows] = useState<MerchantDiscount[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([storeId, revision]);
  const [loadedKey, setLoadedKey] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof check>["errors"]>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<MerchantDiscount | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    list().then((result) => { if (active) { setRows(result); setError(""); } })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [list, ready, requestKey]);

  const open = (next: Draft) => { trigger.current = document.activeElement as HTMLElement | null; setErrors({}); setFormError(""); setDraft(next); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const result = check(draft);
    setErrors(result.errors);
    if (!result.input) return;
    setBusy(true);
    setFormError("");
    try {
      if (draft.id) await update(draft.id, result.input); else await create(result.input);
      toast(draft.id ? "Discount saved" : `Code ${result.input.code} created`);
      setDraft(null);
      setRevision((value) => value + 1);
    } catch (failure) {
      setFormError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const describe = (row: MerchantDiscount) => {
    const what = row.kind === "percent" ? `${row.value}% off` : row.kind === "fixed" ? `${money(row.value)} off` : "Free delivery";
    const rules = [row.minimumSubtotalMinor ? `orders over ${money(row.minimumSubtotalMinor)}` : "", row.oncePerCustomer ? "once per customer" : ""].filter(Boolean).join(", ");
    return rules ? `${what} · ${rules}` : what;
  };
  const shown = useClientList(rows, { text: (row) => row.code, noun: ["code", "codes"], searchLabel: "Search codes" });
  const columns: IndexColumn<MerchantDiscount>[] = [
    { id: "code", header: "Code", mobile: "primary", cell: (row) => <button type="button" className="jk-link jk-strong" onClick={() => open(draftOf(row))}>{row.code}</button> },
    { id: "what", header: "Gives", cell: describe },
    { id: "status", header: "Status", cell: (row) => { const state = STATE[discountState(row)]; return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>; } },
    { id: "uses", header: "Used", align: "end", cell: (row) => (row.usageLimit ? `${row.uses} of ${row.usageLimit}` : String(row.uses)) },
    { id: "ends", header: "Ends", cell: (row) => (row.endsAt ? new Date(new Date(row.endsAt).getTime() - 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No end date") },
    { id: "actions", header: "Actions", hideHeader: true, align: "end", cell: (row) => <div className="flex flex-wrap justify-end gap-2">
      <Button size="small" onClick={() => open(draftOf(row))}>Edit</Button>
      <Button size="small" variant="destructive-quiet" onClick={() => setDeleting(row)} aria-label={`Delete code ${row.code}`}>Delete</Button>
    </div> },
  ];

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  return <AdminPage title="Discounts" description="Codes shoppers type at checkout for money off or free delivery." primaryAction={{ label: "Create discount", onAction: () => open({ ...EMPTY }) }}>
    <IndexTable
      label="Discount codes"
      rows={shown.rows}
      rowKey={(row) => row.id}
      rowLabel={(row) => `Code ${row.code}`}
      columns={columns}
      loading={ready && loadedKey !== requestKey}
      error={error}
      onRetry={() => setRevision((value) => value + 1)}
      search={shown.search}
      pagination={shown.pagination}
      emptyState={<EmptyState icon={Percent} title={shown.filtered ? "No matching codes" : "Create your first discount code"} description={shown.filtered ? "Try another search." : "Give shoppers money off or free delivery with a code they type at checkout."} action={shown.filtered ? undefined : <Button variant="primary" onClick={() => open({ ...EMPTY })}>Create discount</Button>} />}
    />

    <Sheet open={draft !== null} onOpenChange={(next) => { if (!next && !busy) setDraft(null); }}>
      <SheetContent onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} className="jk-sheet overflow-y-auto">
        <SheetTitle>{draft?.id ? `Edit ${draft.code}` : "Create discount"}</SheetTitle>
        <SheetDescription className="jk-muted">Shoppers type the code in the order summary at checkout. The shop checks it again when the order is placed.</SheetDescription>
        {draft && <form className="jk-form" onSubmit={save} noValidate>
          {formError && <Banner tone="critical">{formError}</Banner>}
          <Field id="discount-code" label="Code" required error={errors.code} help={draft.used ? "This code has been used, so its name stays the same." : "Shoppers can type it in capitals or small letters."}>
            <input id="discount-code" className="jk-input uppercase" value={draft.code} disabled={draft.used} maxLength={40} autoComplete="off" spellCheck={false} placeholder="SUMMER10" onChange={(event) => set("code", event.target.value.replace(/\s+/g, "").toUpperCase())} />
          </Field>
          <fieldset className="jk-field">
            <legend className="jk-strong">What it gives</legend>
            <div className="jk-chips" role="radiogroup" aria-label="What it gives">
              {(Object.keys(KIND_LABEL) as DiscountKind[]).map((kind) => <label key={kind} className="jk-chip"><input type="radio" name="discount-kind" checked={draft.kind === kind} onChange={() => set("kind", kind)} /> {KIND_LABEL[kind]}</label>)}
            </div>
          </fieldset>
          {draft.kind === "percent" && <Field id="discount-percent" label="Percentage off the products" required error={errors.value}>
            <span className="jk-prefixed"><input id="discount-percent" className="jk-input" inputMode="numeric" value={draft.percent} onChange={(event) => set("percent", event.target.value)} /><span aria-hidden="true">%</span></span>
          </Field>}
          {draft.kind === "fixed" && <Field id="discount-amount" label={`Amount off the products (${currency})`} required error={errors.value} help="Never more than the products cost. Delivery is not reduced.">
            <input id="discount-amount" className="jk-input" inputMode="decimal" placeholder="5.00" value={draft.amount} onChange={(event) => set("amount", event.target.value)} />
          </Field>}
          {draft.kind === "free_shipping" && <p className="jk-muted">Delivery becomes free for the order. Orders with nothing to deliver can&apos;t use it.</p>}
          <Field id="discount-minimum" label={`Minimum order (${currency})`} error={errors.minimum} help="Leave empty for any order. Counts the products before the discount.">
            <input id="discount-minimum" className="jk-input" inputMode="decimal" placeholder="No minimum" value={draft.minimum} onChange={(event) => set("minimum", event.target.value)} />
          </Field>
          <Field id="discount-limit" label="How many times it can be used in total" error={errors.limit} help="Leave empty for no limit. Cancelled orders give their use back.">
            <input id="discount-limit" className="jk-input" inputMode="numeric" placeholder="No limit" value={draft.limit} onChange={(event) => set("limit", event.target.value)} />
          </Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.oncePerCustomer} onChange={(event) => set("oncePerCustomer", event.target.checked)} /> Once per customer (by email address)</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="discount-starts" label="First day" help="Leave empty to start now."><input id="discount-starts" type="date" className="jk-input" value={draft.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></Field>
            <Field id="discount-ends" label="Last day" error={errors.dates} help="Leave empty to keep it going."><input id="discount-ends" type="date" className="jk-input" value={draft.endsAt} onChange={(event) => set("endsAt", event.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} /> Code is switched on</label>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…">{draft.id ? "Save" : "Create discount"}</Button>
          </div>
        </form>}
      </SheetContent>
    </Sheet>

    <ConfirmDialog
      open={deleting !== null}
      onOpenChange={(next) => { if (!next) setDeleting(null); }}
      title={`Delete ${deleting?.code ?? "code"}?`}
      description="Shoppers won't be able to use it any more. Orders already placed with it keep their discount."
      confirmLabel="Delete code"
      destructive
      onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id); toast(`Code ${deleting.code} deleted`); setRevision((value) => value + 1); } catch (failure) { toast((failure as Error).message); } finally { setDeleting(null); } }}
    />
  </AdminPage>;
}
