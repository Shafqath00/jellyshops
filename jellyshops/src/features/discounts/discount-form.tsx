"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { summariseDiscount, type DiscountInput } from "@jelly/storefront-schema";
import { Banner, Button, Card, DetailLayout, Field, HelpTip, ResourceForm, TagInput } from "@/components/admin";
import { DiscountRequestError, type MerchantDiscount, useDiscountsApi } from "./api";
import { DISCOUNT_METHOD_INFO, DISCOUNT_TYPE_INFO, moneyFormatter } from "./discount-words";
import { draftPreview, draftToInput, draftWarnings, fieldForPath, timeZoneName, type DiscountDraft, type DraftField, type DraftProblems } from "./form-state";
import { SampleBag } from "./sample-bag";
import { SelectionField } from "./selection-field";
import type { DiscountFormData } from "./use-form-data";

export interface DiscountFormProps {
  /** The discount being edited; absent when creating. */
  discount?: MerchantDiscount;
  initial: DiscountDraft;
  data: DiscountFormData;
  currency: string;
  /** Extra cards under the summary in the side column (status, results). */
  side?: ReactNode;
  onSaved: (saved: MerchantDiscount) => void;
  onDiscard: () => void;
}

const fieldId = (field: DraftField) => `discount-${field}`;

/**
 * The one form for every discount type. Sections follow the merchant's questions: what is it, what does the customer
 * get, is there a minimum, who can use it, how often, with what, and when. A plain-English summary and warnings
 * update as they type; problems show under each field and in one banner on save.
 */
export function DiscountForm({ discount, initial, data, currency, side, onSaved, onDiscard }: DiscountFormProps) {
  const api = useDiscountsApi();
  const [draft, setDraft] = useState(initial);
  const [problems, setProblems] = useState<DraftProblems>({});
  const [checked, setChecked] = useState(false);
  const [codeState, setCodeState] = useState<{ code: string; taken: boolean } | null>(null);
  const [generating, setGenerating] = useState(false);
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const tz = data.timeZone;
  // A new discount can always be saved (a template may be right as it is); an existing one once something changed.
  const dirty = !discount || JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // The server's answer was about the old values.
    setProblems((current) => (current.form === "server" ? {} : current));
  };
  const info = DISCOUNT_TYPE_INFO[draft.type];
  const amountType = draft.type === "product_amount" || draft.type === "order_amount";

  // After the first save attempt, problems follow what the merchant types.
  const shown: DraftProblems = checked ? { ...draftToInput(draft, tz).problems, ...pickServer(problems) } : problems;

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

  const others = useMemo(() => data.discounts.filter((other) => other.id !== discount?.id), [data.discounts, discount?.id]);
  const warnings = useMemo(() => draftWarnings(draft, { timeZone: tz, now: new Date(), others, products: data.names.products, codeTaken }), [draft, tz, others, data.names.products, codeTaken]);
  const preview = useMemo(() => draftPreview(draft, tz), [draft, tz]);
  const summary = useMemo(() => summariseDiscount(preview, {
    formatMoney: money, timeZone: tz,
    names: { products: Object.fromEntries(Object.entries(data.names.products).map(([id, item]) => [id, item.title])), collections: Object.fromEntries(Object.entries(data.names.collections).map(([id, item]) => [id, item.title])) },
  }), [preview, tz, money, data.names]);

  async function submit() {
    setChecked(true);
    const { input, problems: checkedProblems } = draftToInput(draft, tz);
    // The code comes first on the page, so its problem goes first (focus follows the order).
    const found: DraftProblems = codeTaken ? { code: "Another discount already uses this code. Choose a different one.", ...checkedProblems } : checkedProblems;
    setProblems(found);
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
  const sideColumn = <>
    <Card title="Summary">
      <p className="jk-discount-sentence" aria-live="polite"><TypeIcon size={18} aria-hidden="true" /> <span>{summary}</span></p>
    </Card>
    {data.catalog.length > 0 && <SampleBag discount={preview} data={data} formatMoney={money} />}
    {side}
  </>;

  return <ResourceForm dirty={dirty} onSubmit={submit} onDiscard={() => { setDraft(initial); setProblems({}); setChecked(false); onDiscard(); }} saveLabel={discount ? "Save" : "Save discount"}>
    {warnings.map((warning) => <Banner key={warning.id} tone={warning.tone}>{warning.message}</Banner>)}
    <DetailLayout
      main={<>
        <Card title={info.label} description={info.explain}>
          <div className="jk-discount-section">
            {discount
              ? <p className="jk-muted">{DISCOUNT_METHOD_INFO[draft.method].label}. The type and method stay as they are; duplicate the discount to change them.</p>
              : <fieldset className="jk-discount-fieldset"><legend>How do customers get it?</legend>
                <div className="jk-discount-options jk-discount-options-stack" role="radiogroup" aria-label="How do customers get it?">
                  {(["code", "automatic"] as const).map((method) => <label key={method} className="jk-discount-option jk-discount-option-rich">
                    <input type="radio" name="discount-method" checked={draft.method === method} onChange={() => set("method", method)} />
                    <span><strong>{DISCOUNT_METHOD_INFO[method].label}</strong> <span className="jk-muted">{DISCOUNT_METHOD_INFO[method].explain}</span></span>
                  </label>)}
                </div></fieldset>}
            {draft.method === "code" && <Field id={fieldId("code")} label="Discount code" required error={shown.code ?? (codeTaken ? "Another discount already uses this code. Choose a different one." : undefined)}
              help={discount && discount.uses > 0 ? "This code has been used, so it can't change." : "Customers type it at checkout. Capitals or small letters both work."}>
              <span className="jk-discount-code-row">
                <input id={fieldId("code")} className="jk-input jk-discount-code" value={draft.code} aria-required
                  aria-invalid={shown.code || codeTaken ? true : undefined}
                  aria-describedby={`${fieldId("code")}-help${shown.code || codeTaken ? ` ${fieldId("code")}-error` : ""}`} maxLength={40} autoComplete="off" spellCheck={false} placeholder="SUMMER20"
                  disabled={Boolean(discount && discount.uses > 0)} onChange={(event) => set("code", event.target.value.replace(/\s+/g, "").toUpperCase())} />
                {!(discount && discount.uses > 0) && <Button onClick={() => void generate()} loading={generating} loadingLabel="Making a code…"><Sparkles size={14} aria-hidden="true" /> Generate code</Button>}
              </span>
            </Field>}
            <Field id={fieldId("title")} label={draft.method === "automatic" ? "Title" : "Title (optional)"} required={draft.method === "automatic"} error={shown.title}
              help={draft.method === "automatic" ? "Customers see it in their bag and at checkout, for example \"Summer sale\"." : "For you and your reports. Leave empty to use the code."}>
              <input id={fieldId("title")} className="jk-input" value={draft.title} maxLength={120} onChange={(event) => set("title", event.target.value)} />
            </Field>
          </div>
        </Card>

        {amountType && <Card title="What the customer gets">
          <div className="jk-discount-section">
            <fieldset className="jk-discount-fieldset" aria-describedby={shown.value ? `${fieldId("value")}-error` : undefined}>
              <legend>Discount value</legend>
              <div className="jk-discount-value">
                <div className="jk-segmented" role="radiogroup" aria-label="Percentage or fixed amount">
                  <label><input type="radio" name="discount-value-type" checked={draft.valueType === "percent"} onChange={() => set("valueType", "percent")} /> Percentage</label>
                  <label><input type="radio" name="discount-value-type" checked={draft.valueType === "fixed"} onChange={() => set("valueType", "fixed")} /> Fixed amount</label>
                </div>
                {draft.valueType === "percent"
                  ? <span className="jk-prefixed"><input id={fieldId("value")} aria-label="Percentage off" className="jk-input" inputMode="numeric" value={draft.percent} aria-invalid={shown.value ? true : undefined} onChange={(event) => set("percent", event.target.value)} /><span className="jk-prefixed-text jk-suffix-text" aria-hidden="true">%</span></span>
                  : <span className="jk-prefixed"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input id={fieldId("value")} aria-label={`Amount off (${currency})`} className="jk-input" inputMode="decimal" placeholder="5.00" value={draft.amount} aria-invalid={shown.value ? true : undefined} onChange={(event) => set("amount", event.target.value)} /></span>}
              </div>
              <p className="jk-muted jk-discount-help">{draft.valueType === "fixed"
                ? draft.type === "order_amount" ? "Taken off the order's products. Never more than they cost; delivery isn't reduced." : "Taken off each item it covers, never below free."
                : draft.type === "order_amount" ? "Taken off the order's products. Delivery isn't reduced." : "Taken off each item it covers."}</p>
              {shown.value && <p id={`${fieldId("value")}-error`} className="jk-field-error" role="alert">{shown.value}</p>}
            </fieldset>
            {draft.type === "product_amount" && <>
              <SelectionField legend="Applies to" value={draft.appliesTo} onChange={(next) => set("appliesTo", next)} names={data.names} allowAll error={shown.appliesTo}
                help="Only these items are cheaper. Everything else in the bag stays full price." />
              {draft.valueType === "fixed" && <label className="jk-discount-check"><input type="checkbox" checked={draft.appliesOncePerOrder} onChange={(event) => set("appliesOncePerOrder", event.target.checked)} />
                <span>Take the amount off once per order <span className="jk-muted">instead of off every item. It&apos;s shared across the items it covers.</span></span></label>}
            </>}
          </div>
        </Card>}

        {draft.type === "buy_x_get_y" && <>
          <Card title="Customer buys" description="What must be in the bag before the offer applies.">
            <div className="jk-discount-section">
              <div className="jk-discount-options" role="radiogroup" aria-label="What the customer must buy">
                <label className="jk-discount-option"><input type="radio" name="discount-buys" checked={draft.buysType === "quantity"} onChange={() => set("buysType", "quantity")} /> A number of items</label>
                <label className="jk-discount-option"><input type="radio" name="discount-buys" checked={draft.buysType === "amount"} onChange={() => set("buysType", "amount")} /> A spend of at least</label>
              </div>
              {draft.buysType === "quantity"
                ? <Field id={fieldId("buysQuantity")} label="How many items" error={shown.buysQuantity}><input id={fieldId("buysQuantity")} className="jk-input jk-input-short" inputMode="numeric" value={draft.buysQuantity} onChange={(event) => set("buysQuantity", event.target.value)} /></Field>
                : <Field id={fieldId("buysAmount")} label={`How much (${currency})`} error={shown.buysAmount} help="The items they get don't count towards this spend."><input id={fieldId("buysAmount")} className="jk-input jk-input-short" inputMode="decimal" placeholder="50.00" value={draft.buysAmount} onChange={(event) => set("buysAmount", event.target.value)} /></Field>}
              <SelectionField legend="From" value={draft.buysItems} onChange={(next) => set("buysItems", next)} names={data.names} allowAll allLabel="Any products" error={shown.buysItems} />
            </div>
          </Card>
          <Card title="Customer gets" description="Customers add these items to their bag; the discount applies to the cheapest ones that qualify.">
            <div className="jk-discount-section">
              <Field id={fieldId("getsQuantity")} label="How many items" error={shown.getsQuantity}><input id={fieldId("getsQuantity")} className="jk-input jk-input-short" inputMode="numeric" value={draft.getsQuantity} onChange={(event) => set("getsQuantity", event.target.value)} /></Field>
              <SelectionField legend="Which items" value={draft.getsItems} onChange={(next) => set("getsItems", next)} names={data.names} allowAll allLabel="Any products" error={shown.getsItems} />
              <fieldset className="jk-discount-fieldset"><legend>At what price</legend>
                <div className="jk-discount-options" role="radiogroup" aria-label="At what price">
                  <label className="jk-discount-option"><input type="radio" name="discount-gets" checked={draft.getsValue === "free"} onChange={() => set("getsValue", "free")} /> Free</label>
                  <label className="jk-discount-option"><input type="radio" name="discount-gets" checked={draft.getsValue === "percent"} onChange={() => set("getsValue", "percent")} /> A percentage off
                    {draft.getsValue === "percent" && <span className="jk-prefixed"><input aria-label="Percentage off each item" className="jk-input jk-input-short" inputMode="numeric" value={draft.getsPercent} onChange={(event) => set("getsPercent", event.target.value)} /><span className="jk-prefixed-text jk-suffix-text" aria-hidden="true">%</span></span>}</label>
                  <label className="jk-discount-option"><input type="radio" name="discount-gets" checked={draft.getsValue === "fixed"} onChange={() => set("getsValue", "fixed")} /> An amount off each
                    {draft.getsValue === "fixed" && <span className="jk-prefixed"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input aria-label={`Amount off each item (${currency})`} className="jk-input jk-input-short" inputMode="decimal" value={draft.getsAmount} onChange={(event) => set("getsAmount", event.target.value)} /></span>}</label>
                </div>
                {shown.getsValue && <p className="jk-field-error" role="alert">{shown.getsValue}</p>}
              </fieldset>
              <label className="jk-discount-check"><input type="checkbox" checked={draft.limitUsesPerOrder} onChange={(event) => set("limitUsesPerOrder", event.target.checked)} /><span>Limit how many times one order can use it</span></label>
              {draft.limitUsesPerOrder && <Field id={fieldId("maxUsesPerOrder")} label="Times per order" error={shown.maxUsesPerOrder} help="With 1, buying 4 items still gives only 1 free.">
                <input id={fieldId("maxUsesPerOrder")} className="jk-input jk-input-short" inputMode="numeric" value={draft.maxUsesPerOrder} onChange={(event) => set("maxUsesPerOrder", event.target.value)} /></Field>}
            </div>
          </Card>
        </>}

        {draft.type === "free_shipping" && <Card title="Delivery" description="Delivery becomes free for orders that qualify. This shop has one delivery charge for everywhere it sends to, so there are no countries to choose.">
          <div className="jk-discount-section">
            <label className="jk-discount-check"><input type="checkbox" checked={draft.limitShipping} onChange={(event) => set("limitShipping", event.target.checked)} /><span>Only when delivery costs no more than a set amount</span></label>
            {draft.limitShipping && <Field id={fieldId("maxShipping")} label={`Highest delivery charge to cover (${currency})`} error={shown.maxShipping}>
              <input id={fieldId("maxShipping")} className="jk-input jk-input-short" inputMode="decimal" placeholder="10.00" value={draft.maxShipping} onChange={(event) => set("maxShipping", event.target.value)} /></Field>}
          </div>
        </Card>}

        {draft.type !== "buy_x_get_y" && <Card title="Minimum purchase">
          <fieldset className="jk-discount-fieldset">
            <legend className="sr-only">Minimum purchase</legend>
            <div className="jk-discount-options jk-discount-options-stack" role="radiogroup" aria-label="Minimum purchase">
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "none"} onChange={() => set("minimumType", "none")} /> No minimum</label>
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "amount"} onChange={() => set("minimumType", "amount")} /> Minimum spend
                {draft.minimumType === "amount" && <span className="jk-prefixed"><span className="jk-prefixed-text" aria-hidden="true">{currencySymbol(currency)}</span><input id={fieldId("minimum")} aria-label={`Minimum spend (${currency})`} className="jk-input jk-input-short" inputMode="decimal" placeholder="50.00" value={draft.minimumAmount} onChange={(event) => set("minimumAmount", event.target.value)} /></span>}</label>
              <label className="jk-discount-option"><input type="radio" name="discount-minimum" checked={draft.minimumType === "quantity"} onChange={() => set("minimumType", "quantity")} /> Minimum number of items
                {draft.minimumType === "quantity" && <input id={fieldId("minimum")} aria-label="Minimum number of items" className="jk-input jk-input-short" inputMode="numeric" placeholder="2" value={draft.minimumQuantity} onChange={(event) => set("minimumQuantity", event.target.value)} />}</label>
            </div>
            <p className="jk-muted jk-discount-help">{draft.type === "product_amount" ? "Counts only the items this discount covers." : draft.type === "free_shipping" ? "Counts the products after any other discounts." : "Counts the products after product discounts."}</p>
            {shown.minimum && <p className="jk-field-error" role="alert">{shown.minimum}</p>}
          </fieldset>
        </Card>}

        <Card title="Who can use it">
          <fieldset className="jk-discount-fieldset">
            <legend className="sr-only">Who can use it</legend>
            <div className="jk-discount-options jk-discount-options-stack" role="radiogroup" aria-label="Who can use it">
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "everyone"} onChange={() => set("eligibility", "everyone")} /> Everyone</label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "first_order"} onChange={() => set("eligibility", "first_order")} /> <span>New customers only <span className="jk-muted">(their first order with you)</span></span></label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "tags"} onChange={() => set("eligibility", "tags")} /> <span>Customer groups <span className="jk-muted">(by customer tag)</span></span></label>
              <label className="jk-discount-option"><input type="radio" name="discount-who" checked={draft.eligibility === "customers"} onChange={() => set("eligibility", "customers")} /> Specific customers</label>
            </div>
            {draft.eligibility === "tags" && <TagInput label="Customer tags" value={draft.tags} onChange={(tags) => set("tags", tags)} known={data.customerTags} help="Customers with any of these tags can use it. Tag customers on their page in Customers." />}
            {draft.eligibility === "customers" && <CustomerChooser value={draft.customers} customers={data.customers} onChange={(emails) => set("customers", emails)} />}
            {draft.eligibility !== "everyone" && <p className="jk-muted jk-discount-help">Checked against the email address entered at checkout.</p>}
            {shown.eligibility && <p className="jk-field-error" role="alert">{shown.eligibility}</p>}
          </fieldset>
        </Card>

        <Card title="Usage limits">
          <div className="jk-discount-section">
            <label className="jk-discount-check"><input type="checkbox" checked={draft.limitTotal} onChange={(event) => set("limitTotal", event.target.checked)} /><span>Limit the total number of uses</span></label>
            {draft.limitTotal && <Field id={fieldId("usageLimit")} label="Total uses" error={shown.usageLimit} help="Each order counts once. Cancelled orders give their use back.">
              <input id={fieldId("usageLimit")} className="jk-input jk-input-short" inputMode="numeric" placeholder="100" value={draft.usageLimit} onChange={(event) => set("usageLimit", event.target.value)} /></Field>}
            <label className="jk-discount-check"><input type="checkbox" checked={draft.oncePerCustomer} onChange={(event) => set("oncePerCustomer", event.target.checked)} /><span>One use per customer <span className="jk-muted">(by email address)</span></span></label>
          </div>
        </Card>

        <Card title="Combinations" description="Can this discount be used together with others? Both discounts must allow it.">
          <fieldset className="jk-discount-fieldset">
            <legend className="sr-only">Combines with</legend>
            {(["product", "order", "shipping"] as const).map((kind) => {
              const same = (kind === "product" && (draft.type === "product_amount" || draft.type === "buy_x_get_y")) || (kind === "order" && draft.type === "order_amount") || (kind === "shipping" && draft.type === "free_shipping");
              const label = { product: "Product discounts", order: "Order discounts", shipping: "Shipping discounts" }[kind];
              const note = same
                ? kind === "product" ? "Other product discounts, on different items: an item never gets two product discounts." : kind === "order" ? "Other order discounts: each is taken off what is left after the one before." : "Only one shipping discount can apply."
                : { product: "Money off chosen products, including Buy X get Y.", order: "Money off the whole order.", shipping: "Free delivery." }[kind];
              return <label key={kind} className="jk-discount-check">
                <input type="checkbox" checked={draft.combinesWith[kind]} disabled={same && kind === "shipping"} onChange={(event) => set("combinesWith", { ...draft.combinesWith, [kind]: event.target.checked })} />
                <span>{same ? `Other ${label.toLowerCase()}` : label} <span className="jk-muted">{note}</span></span>
              </label>;
            })}
            <p className="jk-muted jk-discount-help">When discounts can&apos;t be combined, the customer automatically gets the one that saves them most. Product discounts apply first, then order discounts, then shipping. <HelpTip label="How combining works">Example: 20% off a collection and £10 off the order, both allowing each other: a £100 bag with £40 from the collection becomes £100 − £8 − £10 = £82.</HelpTip></p>
          </fieldset>
        </Card>

        <Card title="Active dates" description={`Times are in your shop's time zone: ${timeZoneName(tz)}.`}>
          <div className="jk-discount-section">
            <div className="jk-discount-dates">
              <Field id={fieldId("startsAt")} label="Start date" error={shown.startsAt}><input id={fieldId("startsAt")} type="date" className="jk-input" value={draft.startDate} onChange={(event) => set("startDate", event.target.value)} /></Field>
              <Field id="discount-start-time" label="Start time"><input id="discount-start-time" type="time" className="jk-input" value={draft.startTime} onChange={(event) => set("startTime", event.target.value)} /></Field>
            </div>
            <label className="jk-discount-check"><input type="checkbox" checked={draft.hasEnd} onChange={(event) => set("hasEnd", event.target.checked)} /><span>Set an end date <span className="jk-muted">It stops by itself at that moment.</span></span></label>
            {draft.hasEnd && <div className="jk-discount-dates">
              <Field id={fieldId("endsAt")} label="End date" error={shown.endsAt}><input id={fieldId("endsAt")} type="date" className="jk-input" value={draft.endDate} onChange={(event) => set("endDate", event.target.value)} /></Field>
              <Field id="discount-end-time" label="End time"><input id="discount-end-time" type="time" className="jk-input" value={draft.endTime} onChange={(event) => set("endTime", event.target.value)} /></Field>
            </div>}
            <label className="jk-discount-check"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} /><span>Switched on <span className="jk-muted">Untick to keep it ready without anyone using it.</span></span></label>
          </div>
        </Card>
      </>}
      side={<div className="jk-discount-side">{sideColumn}</div>}
    />
  </ResourceForm>;
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
    <Field id="discount-customer-search" label="Add a customer" help="Search your customers by name or email, or type an email address.">
      <input id="discount-customer-search" className="jk-input" type="search" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const first = matches[0]?.email ?? typedEmail; if (first) { onChange([...value, first]); setQuery(""); } }} />
    </Field>
    {(matches.length > 0 || typedEmail) && <ul className="jk-discount-matches" aria-label="Matching customers">
      {matches.map((customer) => <li key={customer.email}><button type="button" onClick={() => { onChange([...value, customer.email]); setQuery(""); }}>{customer.name} <span className="jk-muted">{customer.email}</span></button></li>)}
      {typedEmail && <li><button type="button" onClick={() => { onChange([...value, typedEmail]); setQuery(""); }}>Add {typedEmail}</button></li>}
    </ul>}
  </div>;
}
