"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { describeDiscountValue, summariseDiscount, type DiscountInput } from "@jelly/storefront-schema";
import { Banner, Button, Card, Field, HelpTip, ResourceForm, TagInput } from "@/components/admin";
import { DiscountRequestError, type MerchantDiscount, useDiscountsApi } from "./api";
import { DISCOUNT_METHOD_INFO, DISCOUNT_TYPE_INFO, moneyFormatter } from "./discount-words";
import {
  draftPreview, draftToInput, draftWarnings, fieldForPath, timeZoneName, zonedToUtc,
  type DiscountDraft, type DraftField, type DraftProblems, type DraftWarning,
} from "./form-state";
import { SampleBag } from "./sample-bag";
import { SelectionField } from "./selection-field";
import type { DiscountFormData } from "./use-form-data";

export interface DiscountFormProps {
  /** The discount being edited; absent when creating. */
  discount?: MerchantDiscount;
  initial: DiscountDraft;
  data: DiscountFormData;
  currency: string;
  /** Extra cards under the summary (status and results, codes). */
  side?: ReactNode;
  /** New discounts only: reopen the type picker. */
  onChangeType?: () => void;
  onSaved: (saved: MerchantDiscount) => void;
  onDiscard: () => void;
}

const fieldId = (field: DraftField) => `discount-${field}`;

/**
 * The one form for every discount type, as a single column of short sections: Code, Value, Applies to, Requirements,
 * Who can use it, Limits and Dates, with rarer settings under "More options". Every field starts from a value that can
 * be saved, so a basic discount is: choose the type, type the value, save. A summary card explains the discount as it
 * is typed. Problems show under a field once the merchant leaves it (all of them on Save).
 */
export function DiscountForm({ discount, initial, data, currency, side, onChangeType, onSaved, onDiscard }: DiscountFormProps) {
  const api = useDiscountsApi();
  const [draft, setDraft] = useState(initial);
  const [problems, setProblems] = useState<DraftProblems>({});
  const [checked, setChecked] = useState(false);
  const [touched, setTouched] = useState<Set<DraftField>>(new Set());
  const [codeState, setCodeState] = useState<{ code: string; taken: boolean } | null>(null);
  const [generating, setGenerating] = useState(false);
  // Dates show as one line ("Starts now · no end date") until the merchant asks to change them.
  const [editDates, setEditDates] = useState(() => initial.hasEnd || (zonedToUtc(initial.startDate, initial.startTime, data.timeZone)?.getTime() ?? 0) > Date.now() + 60_000);
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  // "Now" for wording and warnings, read once when the form opens.
  const [now] = useState(() => Date.now());
  const tz = data.timeZone;
  // A new discount can always be saved (a template may be right as it is); an existing one once something changed.
  const dirty = !discount || JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // The server's answer was about the old values.
    setProblems((current) => (current.form === "server" ? {} : current));
  };
  const touch = (field: DraftField) => setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  const info = DISCOUNT_TYPE_INFO[draft.type];
  const amountType = draft.type === "product_amount" || draft.type === "order_amount";

  // Problems for fields the merchant has left (all of them after a save attempt), plus anything the server said.
  const live = draftToInput(draft, tz).problems;
  const shown: DraftProblems = checked ? { ...live, ...pickServer(problems) }
    : { ...Object.fromEntries(Object.entries(live).filter(([field]) => touched.has(field as DraftField))), ...pickServer(problems) };

  // A new code discount starts with a generated code, so it can be saved straight away.
  const generatedOnce = useRef(false);
  useEffect(() => {
    if (discount || draft.method !== "code" || draft.code || generatedOnce.current) return;
    generatedOnce.current = true;
    api.generateCode().then((code) => setDraft((current) => (current.code ? current : { ...current, code }))).catch(() => undefined);
  }, [discount, draft.method, draft.code, api]);

  // Is the code free? Checked a moment after typing stops (case doesn't matter).
  const code = draft.method === "code" ? draft.code.trim().toUpperCase() : "";
  useEffect(() => {
    if (!code || code === discount?.code || !/^[A-Z0-9_-]{2,40}$/.test(code)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      api.codeCheck(code, discount?.id).then((result) => { if (active) setCodeState({ code, taken: !result.available }); }).catch(() => undefined);
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [code, discount?.code, discount?.id, api]);
  const codeTaken = Boolean(codeState && codeState.code === code && codeState.taken);
  const codeError = shown.code ?? (codeTaken ? "Another discount already uses this code. Choose a different one." : undefined);

  const others = useMemo(() => data.discounts.filter((other) => other.id !== discount?.id), [data.discounts, discount?.id]);
  // Warnings sit next to the section they are about; "code" is shown as the code field's error instead.
  const warnings = useMemo(() => draftWarnings(draft, { timeZone: tz, now: new Date(now), others, products: data.names.products }), [draft, tz, now, others, data.names.products]);
  const warn = (...ids: string[]) => warnings.filter((warning) => ids.includes(warning.id)).map((warning) => <Inline key={warning.id} warning={warning} />);
  const preview = useMemo(() => draftPreview(draft, tz), [draft, tz]);
  const names = useMemo(() => ({
    products: Object.fromEntries(Object.entries(data.names.products).map(([id, item]) => [id, item.title])),
    collections: Object.fromEntries(Object.entries(data.names.collections).map(([id, item]) => [id, item.title])),
  }), [data.names]);
  const summary = useMemo(() => summariseDiscount(preview, { formatMoney: money, timeZone: tz, names }), [preview, tz, money, names]);
  const startText = useMemo(() => {
    const start = preview.startsAt;
    if (!start || start.getTime() <= now + 60_000) return "Starts now";
    return `Starts ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(start)}`;
  }, [preview.startsAt, tz, now]);
  const endText = preview.endsAt ? `ends ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(preview.endsAt)}` : "no end date";

  async function submit() {
    setChecked(true);
    const { input, problems: checkedProblems } = draftToInput(draft, tz);
    // The code comes first on the page, so its problem goes first (focus follows the order).
    const found: DraftProblems = codeTaken ? { code: "Another discount already uses this code. Choose a different one.", ...checkedProblems } : checkedProblems;
    setProblems(found);
    if (found.startsAt || found.endsAt) setEditDates(true);
    if (!input || Object.keys(found).length) {
      focusFirst(found);
      throw new Error("Some details need a look. They're marked below.");
    }
    try {
      const saved = discount ? await api.update(discount.id, input as DiscountInput) : await api.create(input as DiscountInput);
      onSaved(saved);
    } catch (failure) {
      if (failure instanceof DiscountRequestError && failure.issues.length) {
        const server: DraftProblems = {};
        for (const issue of failure.issues) server[fieldForPath(issue.path)] ??= issue.message;
        setProblems({ ...server, form: "server" });
        focusFirst(server);
      }
      throw failure;
    }
  }

  async function generate() {
    setGenerating(true);
    try { set("code", await api.generateCode()); } catch { /* the merchant can still type one */ } finally { setGenerating(false); }
  }

  const TypeIcon = info.icon;
  const usedCode = Boolean(discount && discount.uses > 0);
  // How many "More options" differ from where a new discount starts (shown on the closed section).
  const combineDefault = draft.type === "free_shipping" ? { product: true, order: true, shipping: false } : { product: false, order: false, shipping: true };
  const moreCount = [draft.oncePerCustomer, !draft.active, draft.limitShipping, draft.type === "buy_x_get_y" && !draft.limitUsesPerOrder, Boolean(draft.title && draft.method === "code"),
    JSON.stringify(draft.combinesWith) !== JSON.stringify(combineDefault)].filter(Boolean).length;

  return <ResourceForm dirty={dirty} onSubmit={submit} onDiscard={() => { setDraft(initial); setProblems({}); setChecked(false); setTouched(new Set()); onDiscard(); }} saveLabel={discount ? "Save" : "Save discount"}>
    <div className="jk-discount-layout">
      <div className="jk-discount-main">
        <div className="jk-discount-kind">
          <span className="jk-discount-type-icon" aria-hidden="true"><TypeIcon size={16} /></span>
          <span><strong>{info.label}</strong> <span className="jk-muted">· {DISCOUNT_METHOD_INFO[draft.method].label}</span></span>
          {onChangeType && <Button size="small" variant="quiet" onClick={onChangeType}>Change</Button>}
        </div>

        {draft.method === "code"
          ? <Card title="Code">
            <Field id={fieldId("code")} label="Discount code" required error={codeError} help={usedCode ? "This code has been used, so it can't change." : "Customers type this at checkout. Capitals or small letters both work."}>
              <span className="jk-discount-code-row">
                <input id={fieldId("code")} className="jk-input jk-discount-code" value={draft.code} maxLength={40} autoComplete="off" spellCheck={false} placeholder="SUMMER20"
                  aria-required aria-invalid={codeError ? true : undefined}
                  aria-describedby={`${fieldId("code")}-help${codeError ? ` ${fieldId("code")}-error` : ""}`}
                  disabled={usedCode} onBlur={() => touch("code")} onChange={(event) => set("code", event.target.value.replace(/\s+/g, "").toUpperCase())} />
                {!usedCode && <Button onClick={() => void generate()} loading={generating} loadingLabel="Making a code…"><RefreshCw size={14} aria-hidden="true" /> New code</Button>}
              </span>
            </Field>
          </Card>
          : <Card title="Title">
            <Field id={fieldId("title")} label="Title" required error={shown.title} help="Customers see this in their bag and at checkout, e.g. Summer sale.">
              <input id={fieldId("title")} className="jk-input" value={draft.title} maxLength={120} onBlur={() => touch("title")} onChange={(event) => set("title", event.target.value)} />
            </Field>
          </Card>}

        {amountType && <Card title="Value">
          <div className="jk-discount-value">
            <div className="jk-segmented" role="radiogroup" aria-label="Percentage or fixed amount">
              <label><input type="radio" name="discount-value-type" checked={draft.valueType === "percent"} onChange={() => set("valueType", "percent")} /> Percentage</label>
              <label><input type="radio" name="discount-value-type" checked={draft.valueType === "fixed"} onChange={() => set("valueType", "fixed")} /> Fixed amount</label>
            </div>
            {draft.valueType === "percent"
              ? <span className="jk-prefixed"><input id={fieldId("value")} aria-label="Percentage off" className="jk-input" inputMode="numeric" value={draft.percent} aria-invalid={shown.value ? true : undefined} aria-describedby={shown.value ? `${fieldId("value")}-error` : undefined} onBlur={() => touch("value")} onChange={(event) => set("percent", event.target.value)} /><span className="jk-prefixed-text jk-suffix-text" aria-hidden="true">%</span></span>
              : <span className="jk-prefixed"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input id={fieldId("value")} aria-label={`Amount off (${currency})`} className="jk-input" inputMode="decimal" placeholder="5.00" value={draft.amount} aria-invalid={shown.value ? true : undefined} aria-describedby={shown.value ? `${fieldId("value")}-error` : undefined} onBlur={() => touch("value")} onChange={(event) => set("amount", event.target.value)} /></span>}
          </div>
          {shown.value && <p id={`${fieldId("value")}-error`} className="jk-field-error" role="alert">{shown.value}</p>}
          <p className="jk-muted jk-discount-help">{draft.type === "order_amount" ? "Taken off the products in the order. Delivery isn't reduced." : draft.valueType === "fixed" ? "Taken off each item it applies to, never below free." : "Taken off each item it applies to."}</p>
          {warn("free")}
        </Card>}

        {draft.type === "product_amount" && <Card title="Applies to">
          <SelectionField legend="Applies to" hideLegend value={draft.appliesTo} onChange={(next) => { set("appliesTo", next); touch("appliesTo"); }} names={data.names} allowAll error={shown.appliesTo} />
          {draft.valueType === "fixed" && draft.appliesTo.scope !== "all" && <label className="jk-discount-check"><input type="checkbox" checked={draft.appliesOncePerOrder} onChange={(event) => set("appliesOncePerOrder", event.target.checked)} />
            <span>Take the amount off once per order <span className="jk-muted">instead of off every item</span></span></label>}
          {warn("no-products", "some-products")}
        </Card>}

        {draft.type === "buy_x_get_y" && <>
          <Card title="Customer buys">
            <div className="jk-discount-row">
              <div className="jk-segmented" role="radiogroup" aria-label="What the customer must buy">
                <label><input type="radio" name="discount-buys" checked={draft.buysType === "quantity"} onChange={() => set("buysType", "quantity")} /> Number of items</label>
                <label><input type="radio" name="discount-buys" checked={draft.buysType === "amount"} onChange={() => set("buysType", "amount")} /> Amount spent</label>
              </div>
              {draft.buysType === "quantity"
                ? <input id={fieldId("buysQuantity")} aria-label="How many items they buy" className="jk-input jk-input-short" inputMode="numeric" value={draft.buysQuantity} aria-invalid={shown.buysQuantity ? true : undefined} onBlur={() => touch("buysQuantity")} onChange={(event) => set("buysQuantity", event.target.value)} />
                : <span className="jk-prefixed jk-input-short"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input id={fieldId("buysAmount")} aria-label={`How much they spend (${currency})`} className="jk-input" inputMode="decimal" placeholder="50.00" value={draft.buysAmount} aria-invalid={shown.buysAmount ? true : undefined} onBlur={() => touch("buysAmount")} onChange={(event) => set("buysAmount", event.target.value)} /></span>}
            </div>
            {(shown.buysQuantity || shown.buysAmount) && <p className="jk-field-error" role="alert">{shown.buysQuantity ?? shown.buysAmount}</p>}
            <SelectionField legend="From" value={draft.buysItems} onChange={(next) => { set("buysItems", next); touch("buysItems"); }} names={data.names} allowAll allLabel="Any products" error={shown.buysItems} />
          </Card>
          <Card title="Customer gets">
            <div className="jk-discount-row">
              <label className="jk-discount-inline-field" htmlFor={fieldId("getsQuantity")}>Items</label>
              <input id={fieldId("getsQuantity")} className="jk-input jk-input-short" inputMode="numeric" value={draft.getsQuantity} aria-invalid={shown.getsQuantity ? true : undefined} onBlur={() => touch("getsQuantity")} onChange={(event) => set("getsQuantity", event.target.value)} />
              <div className="jk-segmented" role="radiogroup" aria-label="At what price">
                <label><input type="radio" name="discount-gets" checked={draft.getsValue === "free"} onChange={() => set("getsValue", "free")} /> Free</label>
                <label><input type="radio" name="discount-gets" checked={draft.getsValue === "percent"} onChange={() => set("getsValue", "percent")} /> % off</label>
                <label><input type="radio" name="discount-gets" checked={draft.getsValue === "fixed"} onChange={() => set("getsValue", "fixed")} /> Amount off</label>
              </div>
              {draft.getsValue === "percent" && <span className="jk-prefixed jk-input-short"><input aria-label="Percentage off each item" className="jk-input" inputMode="numeric" value={draft.getsPercent} onBlur={() => touch("getsValue")} onChange={(event) => set("getsPercent", event.target.value)} /><span className="jk-prefixed-text jk-suffix-text" aria-hidden="true">%</span></span>}
              {draft.getsValue === "fixed" && <span className="jk-prefixed jk-input-short"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input aria-label={`Amount off each item (${currency})`} className="jk-input" inputMode="decimal" value={draft.getsAmount} onBlur={() => touch("getsValue")} onChange={(event) => set("getsAmount", event.target.value)} /></span>}
            </div>
            {(shown.getsQuantity || shown.getsValue) && <p className="jk-field-error" role="alert">{shown.getsQuantity ?? shown.getsValue}</p>}
            <SelectionField legend="Which items" value={draft.getsItems} onChange={(next) => { set("getsItems", next); touch("getsItems"); }} names={data.names} allowAll allLabel="Any products" error={shown.getsItems}
              help="Customers add these to their bag. The cheapest ones that qualify are discounted." />
            {warn("no-products", "some-products")}
          </Card>
        </>}

        {draft.type !== "buy_x_get_y" && <Card title="Requirements">
          <fieldset className="jk-discount-fieldset">
            <legend className="sr-only">Minimum purchase</legend>
            <div className="jk-discount-options jk-discount-options-stack" role="radiogroup" aria-label="Minimum purchase">
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "none"} onChange={() => set("minimumType", "none")} /> No minimum</label>
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "amount"} onChange={() => set("minimumType", "amount")} /> Minimum spend
                {draft.minimumType === "amount" && <span className="jk-prefixed jk-input-short"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input id={fieldId("minimum")} aria-label={`Minimum spend (${currency})`} className="jk-input" inputMode="decimal" placeholder="50.00" value={draft.minimumAmount} aria-invalid={shown.minimum ? true : undefined} onBlur={() => touch("minimum")} onChange={(event) => set("minimumAmount", event.target.value)} /></span>}</label>
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "quantity"} onChange={() => set("minimumType", "quantity")} /> Minimum number of items
                {draft.minimumType === "quantity" && <input id={fieldId("minimum")} aria-label="Minimum number of items" className="jk-input jk-input-short" inputMode="numeric" placeholder="2" value={draft.minimumQuantity} aria-invalid={shown.minimum ? true : undefined} onBlur={() => touch("minimum")} onChange={(event) => set("minimumQuantity", event.target.value)} />}</label>
            </div>
            {shown.minimum && <p className="jk-field-error" role="alert">{shown.minimum}</p>}
          </fieldset>
        </Card>}

        <Card title="Who can use it">
          <fieldset className="jk-discount-fieldset">
            <legend className="sr-only">Who can use it</legend>
            <div className="jk-discount-options jk-discount-options-stack" role="radiogroup" aria-label="Who can use it">
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "everyone"} onChange={() => set("eligibility", "everyone")} /> Everyone</label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "first_order"} onChange={() => set("eligibility", "first_order")} /> <span>New customers <span className="jk-muted">(first order)</span></span></label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "tags"} onChange={() => set("eligibility", "tags")} /> <span>Customers with a tag</span></label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "customers"} onChange={() => set("eligibility", "customers")} /> Specific customers</label>
            </div>
            {draft.eligibility === "tags" && <TagInput label="Customer tags" value={draft.tags} onChange={(tags) => { set("tags", tags); touch("eligibility"); }} known={data.customerTags} help="Anyone with one of these tags. Add tags to customers in Customers." />}
            {draft.eligibility === "customers" && <CustomerChooser value={draft.customers} customers={data.customers} onChange={(emails) => { set("customers", emails); touch("eligibility"); }} />}
            {draft.eligibility !== "everyone" && <p className="jk-muted jk-discount-help">Matched by the email address entered at checkout.</p>}
            {shown.eligibility && <p className="jk-field-error" role="alert">{shown.eligibility}</p>}
          </fieldset>
        </Card>

        <Card title="Limits">
          <label className="jk-discount-check"><input type="checkbox" checked={draft.limitTotal} onChange={(event) => set("limitTotal", event.target.checked)} /><span>Limit how many times it can be used</span></label>
          {draft.limitTotal && <Field id={fieldId("usageLimit")} label="Total uses" error={shown.usageLimit} help="Each order counts once. A cancelled order gives its use back.">
            <input id={fieldId("usageLimit")} className="jk-input jk-input-short" inputMode="numeric" placeholder="100" value={draft.usageLimit} onBlur={() => touch("usageLimit")} onChange={(event) => set("usageLimit", event.target.value)} /></Field>}
        </Card>

        <Card title="Dates">
          {!editDates
            ? <div className="jk-discount-dates-line">
              <span>{startText} · {endText}</span>
              <Button size="small" variant="quiet" onClick={() => setEditDates(true)}>Change dates</Button>
            </div>
            : <div className="jk-discount-section">
              <div className="jk-discount-dates">
                <Field id={fieldId("startsAt")} label="Start date" error={shown.startsAt}><input id={fieldId("startsAt")} type="date" className="jk-input" value={draft.startDate} onBlur={() => touch("startsAt")} onChange={(event) => set("startDate", event.target.value)} /></Field>
                <Field id="discount-start-time" label="Start time"><input id="discount-start-time" type="time" className="jk-input" value={draft.startTime} onChange={(event) => set("startTime", event.target.value)} /></Field>
              </div>
              <label className="jk-discount-check"><input type="checkbox" checked={draft.hasEnd} onChange={(event) => set("hasEnd", event.target.checked)} /><span>Set an end date</span></label>
              {draft.hasEnd && <div className="jk-discount-dates">
                <Field id={fieldId("endsAt")} label="End date" error={shown.endsAt}><input id={fieldId("endsAt")} type="date" className="jk-input" value={draft.endDate} onBlur={() => touch("endsAt")} onChange={(event) => set("endDate", event.target.value)} /></Field>
                <Field id="discount-end-time" label="End time"><input id="discount-end-time" type="time" className="jk-input" value={draft.endTime} onChange={(event) => set("endTime", event.target.value)} /></Field>
              </div>}
              <p className="jk-muted jk-discount-help">In {timeZoneName(tz)}. It starts and stops by itself.</p>
            </div>}
          {warn("ended", "scheduled")}
        </Card>

        <details className="jk-discount-more" open={moreCount > 0 && Boolean(discount) ? true : undefined}>
          <summary><span>More options</span>{moreCount > 0 && <span className="jk-discount-more-count">{moreCount} set</span>}<ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="jk-discount-more-body">
            <fieldset className="jk-discount-fieldset">
              <legend>Use with other discounts <HelpTip label="How discounts combine">Both discounts must allow it. When they can&apos;t be combined, the customer automatically gets the one that saves them most.</HelpTip></legend>
              {(["product", "order", "shipping"] as const).filter((kind) => !(kind === "shipping" && draft.type === "free_shipping")).map((kind) => {
                const label = { product: "Product discounts", order: "Order discounts", shipping: "Free shipping" }[kind];
                const same = (kind === "product" && (draft.type === "product_amount" || draft.type === "buy_x_get_y")) || (kind === "order" && draft.type === "order_amount");
                return <label key={kind} className="jk-discount-check"><input type="checkbox" checked={draft.combinesWith[kind]} onChange={(event) => set("combinesWith", { ...draft.combinesWith, [kind]: event.target.checked })} />
                  <span>{same ? `Other ${label.toLowerCase()}` : label}{same && kind === "product" && <span className="jk-muted"> (on different items)</span>}</span></label>;
              })}
            </fieldset>
            <label className="jk-discount-check"><input type="checkbox" checked={draft.oncePerCustomer} onChange={(event) => set("oncePerCustomer", event.target.checked)} /><span>One use per customer <span className="jk-muted">(by email)</span></span></label>
            {draft.type === "free_shipping" && <>
              <label className="jk-discount-check"><input type="checkbox" checked={draft.limitShipping} onChange={(event) => set("limitShipping", event.target.checked)} /><span>Only when delivery costs up to a set amount</span></label>
              {draft.limitShipping && <Field id={fieldId("maxShipping")} label={`Highest delivery charge (${currency})`} error={shown.maxShipping}>
                <input id={fieldId("maxShipping")} className="jk-input jk-input-short" inputMode="decimal" placeholder="10.00" value={draft.maxShipping} onBlur={() => touch("maxShipping")} onChange={(event) => set("maxShipping", event.target.value)} /></Field>}
            </>}
            {draft.type === "buy_x_get_y" && <>
              <label className="jk-discount-check"><input type="checkbox" checked={draft.limitUsesPerOrder} onChange={(event) => set("limitUsesPerOrder", event.target.checked)} /><span>Limit uses per order <span className="jk-muted">(with 1, buying 4 still gives only 1 free)</span></span></label>
              {draft.limitUsesPerOrder && <Field id={fieldId("maxUsesPerOrder")} label="Uses per order" error={shown.maxUsesPerOrder}>
                <input id={fieldId("maxUsesPerOrder")} className="jk-input jk-input-short" inputMode="numeric" value={draft.maxUsesPerOrder} onBlur={() => touch("maxUsesPerOrder")} onChange={(event) => set("maxUsesPerOrder", event.target.value)} /></Field>}
            </>}
            {draft.method === "code" && <Field id={fieldId("title")} label="Name for your records" error={shown.title} help="Leave empty to use the code.">
              <input id={fieldId("title")} className="jk-input" value={draft.title} maxLength={120} onChange={(event) => set("title", event.target.value)} /></Field>}
            <label className="jk-discount-check"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} /><span>Enabled <span className="jk-muted">(untick to save it without anyone using it)</span></span></label>
            {warn("off")}
          </div>
        </details>
      </div>

      <aside className="jk-discount-aside" aria-label="Discount summary">
        <Card title="Summary">
          <div className="jk-discount-summary-card">
            {draft.method === "code" && draft.code && <span className="jk-code jk-discount-summary-code">{draft.code.toUpperCase()}</span>}
            {draft.method === "automatic" && <span className="jk-strong">{draft.title || "Untitled automatic discount"}</span>}
            <p className="jk-discount-sentence" aria-live="polite">{summary}</p>
            <dl className="jk-discount-how">
              <div><dt>Who</dt><dd>{whoText(draft)}</dd></div>
              <div><dt>They get</dt><dd>{describeDiscountValue(preview, { formatMoney: money, names })}</dd></div>
              <div><dt>When</dt><dd>{startText} · {endText}</dd></div>
              <div><dt>Limits</dt><dd>{limitsText(draft)}</dd></div>
            </dl>
            {warn("overlap")}
            {data.catalog.length > 0 && <details className="jk-discount-sample">
              <summary>Test it on a sample bag<ChevronDown size={14} aria-hidden="true" /></summary>
              <SampleBag discount={preview} data={data} formatMoney={money} bare />
            </details>}
          </div>
        </Card>
        {side}
      </aside>
    </div>
  </ResourceForm>;
}

function Inline({ warning }: { warning: DraftWarning }) {
  return <Banner tone={warning.tone}>{warning.message}</Banner>;
}

function whoText(draft: DiscountDraft): string {
  if (draft.eligibility === "first_order") return "New customers, on their first order";
  if (draft.eligibility === "tags") return draft.tags.length ? `Customers tagged ${draft.tags.join(", ")}` : "Customers with a tag (choose one)";
  if (draft.eligibility === "customers") return draft.customers.length ? `${draft.customers.length} chosen ${draft.customers.length === 1 ? "customer" : "customers"}` : "Specific customers (choose some)";
  return draft.method === "automatic" ? "Everyone who qualifies, with no code" : "Anyone with the code";
}

function limitsText(draft: DiscountDraft): string {
  const parts = [draft.limitTotal && draft.usageLimit ? `${draft.usageLimit} uses in total` : "", draft.oncePerCustomer ? "one per customer" : ""].filter(Boolean);
  return parts.length ? parts.join(", ") : "No limit";
}

/** Server problems (from a failed save) win over local checks until the merchant changes something. */
function pickServer(problems: DraftProblems): DraftProblems {
  if (problems.form !== "server") return {};
  const rest = { ...problems };
  delete rest.form;
  return rest;
}

function focusFirst(problems: DraftProblems) {
  const field = (Object.keys(problems) as DraftField[]).find((key) => key !== "form");
  if (!field) return;
  window.setTimeout(() => (document.getElementById(fieldId(field)) as HTMLElement | null)?.focus(), 0);
}

function currencySymbol(currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
}

/** "Specific customers": chips for chosen customers and a type-to-find list of the shop's customers. */
function CustomerChooser({ value, customers, onChange }: { value: string[]; customers: Array<{ email: string; name: string }>; onChange: (emails: string[]) => void }) {
  const [query, setQuery] = useState("");
  const byEmail = new Map(customers.map((customer) => [customer.email, customer.name]));
  const needle = query.trim().toLowerCase();
  const matches = needle ? customers.filter((customer) => !value.includes(customer.email) && (customer.email.includes(needle) || customer.name.toLowerCase().includes(needle))).slice(0, 8) : [];
  const typedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(needle) && !value.includes(needle) && !byEmail.has(needle) ? needle : null;
  return <div className="jk-discount-section">
    {value.length > 0 && <ul className="jk-discount-chosen-list" aria-label="Chosen customers">
      {value.map((email) => <li key={email} className="jk-discount-chip"><span>{byEmail.get(email) ? `${byEmail.get(email)} (${email})` : email}</span>
        <button type="button" onClick={() => onChange(value.filter((other) => other !== email))} aria-label={`Remove ${email}`}>×</button></li>)}
    </ul>}
    <Field id="discount-customer-search" label="Add a customer" help="Search by name or email, or type an email address.">
      <input id="discount-customer-search" className="jk-input" type="search" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const first = matches[0]?.email ?? typedEmail; if (first) { onChange([...value, first]); setQuery(""); } }} />
    </Field>
    {(matches.length > 0 || typedEmail) && <ul className="jk-discount-matches" aria-label="Matching customers">
      {matches.map((customer) => <li key={customer.email}><button type="button" onClick={() => { onChange([...value, customer.email]); setQuery(""); }}>{customer.name} <span className="jk-muted">{customer.email}</span></button></li>)}
      {typedEmail && <li><button type="button" onClick={() => { onChange([...value, typedEmail]); setQuery(""); }}>Add {typedEmail}</button></li>}
    </ul>}
  </div>;
}
