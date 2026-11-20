"use client";

import { cardPhotoSrcSet } from "@jelly/storefront-ui";
import { useId, useState, type FormEvent } from "react";
import { ChevronDown, LockKeyhole, RotateCcw, Tag, Truck, X } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/domain";
import { cartProductImage } from "@/lib/product-media";
import type { DiscountPreview, PreparedPaymentTotals } from "@/features/commerce/api/types";
import type { CheckoutLine } from "../checkout-model";

interface OrderSummaryProps {
  lines: CheckoutLine[];
  currency: Currency;
  estimatedSubtotal: number;
  estimatedShipping: number;
  delivery: boolean;
  /** Set once the server has priced the order; replaces the estimate. */
  totals?: PreparedPaymentTotals;
  discount?: DiscountControls;
  /** Short merchant lines (theme settings > Checkout) shown with the secure-payment line. */
  trust?: { delivery?: string; returns?: string; returnsHref?: string };
}

export interface DiscountControls {
  applied: DiscountPreview | null;
  pending: boolean;
  error: string;
  /** False once the payment is being taken: the code is fixed in the order then. */
  editable: boolean;
  onApply: (code: string) => Promise<boolean>;
  onRemove: () => void;
}

/** "Discount code" box with Apply, or the applied code as a tag with a remove button. */
function DiscountField({ applied, pending, error, editable, onApply, onRemove }: DiscountControls) {
  const [value, setValue] = useState("");
  const id = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onApply(value)) setValue("");
  }
  return (
    <div className="jelly-checkout__discount">
      {editable && (
        <form className="jelly-checkout__discount-form" onSubmit={submit} noValidate>
          <div className="jelly-checkout__field" data-invalid={error ? "" : undefined}>
            <label htmlFor={`${id}-code`} className="jelly-checkout__sr">Discount code</label>
            <input
              id={`${id}-code`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Discount code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          <button type="submit" className="jelly-checkout__secondary jelly-checkout__discount-apply" disabled={pending || !value.trim()}>
            {pending ? <span className="jelly-checkout__spinner" aria-hidden="true" /> : null}
            {pending ? "Checking…" : "Apply"}
          </button>
        </form>
      )}
      <p className="jelly-checkout__field-error" id={`${id}-error`} role="alert" hidden={!error}>{error}</p>
      {applied && (
        <p className="jelly-checkout__discount-tag">
          <Tag size={14} aria-hidden="true" />
          <span><b>{applied.code}</b> · {applied.label}</span>
          {editable && (
            <button type="button" onClick={onRemove} aria-label={`Remove discount code ${applied.code}`}><X size={14} aria-hidden="true" /></button>
          )}
        </p>
      )}
    </div>
  );
}

function lineDetail(line: CheckoutLine): string {
  const parts: string[] = [];
  if (line.variant.name && line.variant.name !== "Default") parts.push(line.variant.name);
  for (const selection of line.item.configurationSelections ?? []) {
    const option = line.product.options?.find((candidate) => candidate.id === selection.optionId);
    const value = option?.values.find((candidate) => candidate.id === selection.valueId);
    if (option?.type !== "variant" && value) parts.push(`${option?.name ?? "Option"}: ${value.label}`);
  }
  for (const entry of line.item.personalisation ?? []) if (entry.value) parts.push(`“${entry.value}”`);
  return parts.join(" · ");
}

/** The bag as a bar at the top of the checkout column on every screen: item count and total, opening in place. */
export function OrderSummary({ lines, currency, estimatedSubtotal, estimatedShipping, delivery, totals, discount, trust }: OrderSummaryProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const money = (minor: number) => formatMoney(minor, currency);
  const subtotal = totals?.subtotalMinor ?? estimatedSubtotal;
  const applied = discount?.applied ?? null;
  const shipping = totals?.shippingMinor ?? (applied ? applied.shippingMinor : delivery ? estimatedShipping : 0);
  const discountMinor = totals ? totals.discountMinor ?? 0 : applied?.discountMinor ?? 0;
  const discountCode = totals ? totals.discountCode ?? null : applied?.code ?? null;
  const total = totals?.amountMinor ?? subtotal - discountMinor + shipping;
  const count = lines.reduce((sum, line) => sum + line.item.quantity, 0);
  const changed = totals !== undefined && totals.subtotalMinor !== estimatedSubtotal;

  return (
    <aside className="jelly-checkout__summary" aria-labelledby={`${panelId}-title`}>
      <button type="button" className="jelly-checkout__summary-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="jelly-checkout__summary-thumbs" aria-hidden="true">
          {lines.slice(0, 3).map((line) => {
            const image = cartProductImage(line.product, line.variant, line.item.configurationSelections);
            // eslint-disable-next-line @next/next/no-img-element -- tiny copies from the media API
            return image ? <img key={line.variant.id + JSON.stringify(line.item.configurationSelections ?? [])} src={image} srcSet={cardPhotoSrcSet(image)} sizes="32px" width={32} height={32} alt="" decoding="async" /> : null;
          })}
        </span>
        <span className="jelly-checkout__summary-label">{open ? "Hide order" : "Your order"} <small>{count} {count === 1 ? "item" : "items"}</small><ChevronDown size={16} aria-hidden="true" data-open={open ? "" : undefined} /></span>
        <b>{money(total)}</b>
      </button>
      <div id={panelId} className="jelly-checkout__summary-panel" data-open={open ? "" : undefined}>
        <h2 id={`${panelId}-title`} className="jelly-checkout__panel-title">Order summary <span className="jelly-checkout__count">({count} {count === 1 ? "item" : "items"})</span></h2>
        <ul className="jelly-checkout__lines">
          {lines.map((line) => {
            const image = cartProductImage(line.product, line.variant, line.item.configurationSelections);
            const detail = lineDetail(line);
            return (
              <li key={`${line.variant.id}-${JSON.stringify(line.item.configurationSelections ?? [])}-${JSON.stringify(line.item.personalisation ?? [])}`} className="jelly-checkout__line">
                <span className="jelly-checkout__thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small copies come from the media API (srcSet), not next/image */}
                  {image ? <img src={image} srcSet={cardPhotoSrcSet(image)} sizes="64px" width={64} height={64} alt="" decoding="async" /> : null}
                  <span className="jelly-checkout__qty" aria-hidden="true">{line.item.quantity}</span>
                </span>
                <span className="jelly-checkout__line-text">
                  <strong>{line.product.name}</strong>
                  {detail && <span>{detail}</span>}
                  <span className="jelly-checkout__sr">Quantity {line.item.quantity}</span>
                </span>
                <span className="jelly-checkout__line-price">{money(line.lineMinor)}</span>
              </li>
            );
          })}
        </ul>
        {discount && <DiscountField {...discount} />}
        <dl className="jelly-checkout__totals">
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          {discountMinor > 0 && <div className="jelly-checkout__discount-line"><dt>Discount{discountCode ? <span> · {discountCode}</span> : null}</dt><dd>−{money(discountMinor)}</dd></div>}
          {delivery && <div><dt>Delivery</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>}
          <div className="jelly-checkout__total"><dt>Total</dt><dd><span className="jelly-checkout__currency">{currency}</span> {money(total)}</dd></div>
        </dl>
        <p className="jelly-checkout__hint" aria-live="polite">
          {totals ? (changed ? "Prices were updated by the shop. This is the amount you'll pay." : "This is the amount you'll pay.") : "The final total is confirmed before you pay."}
        </p>
      </div>
      <ul className="jelly-checkout__trust jelly-checkout__summary-trust" aria-label="About this order">
        <li><LockKeyhole size={14} aria-hidden="true" /> Secure payment</li>
        {trust?.delivery && <li><Truck size={14} aria-hidden="true" /> {trust.delivery}</li>}
        {trust?.returns && <li><RotateCcw size={14} aria-hidden="true" /> {trust.returnsHref ? <a href={trust.returnsHref}>{trust.returns}</a> : trust.returns}</li>}
      </ul>
    </aside>
  );
}
