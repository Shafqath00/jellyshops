"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/domain";
import { cartProductImage } from "@/lib/product-media";
import type { PreparedPaymentTotals } from "@/features/commerce/api/types";
import type { CheckoutLine } from "../checkout-model";

interface OrderSummaryProps {
  lines: CheckoutLine[];
  currency: Currency;
  estimatedSubtotal: number;
  estimatedShipping: number;
  delivery: boolean;
  /** Set once the server has priced the order; replaces the estimate. */
  totals?: PreparedPaymentTotals;
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

/** The bag on the right on desktop; folds to a "Show order summary" bar at the top on phones. */
export function OrderSummary({ lines, currency, estimatedSubtotal, estimatedShipping, delivery, totals }: OrderSummaryProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const money = (minor: number) => formatMoney(minor, currency);
  const subtotal = totals?.subtotalMinor ?? estimatedSubtotal;
  const shipping = totals?.shippingMinor ?? (delivery ? estimatedShipping : 0);
  const total = totals?.amountMinor ?? subtotal + shipping;
  const count = lines.reduce((sum, line) => sum + line.item.quantity, 0);
  const changed = totals !== undefined && totals.subtotalMinor !== estimatedSubtotal;

  return (
    <aside className="jelly-checkout__summary" aria-labelledby={`${panelId}-title`}>
      <button type="button" className="jelly-checkout__summary-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span>{open ? "Hide order summary" : "Show order summary"}<ChevronDown size={16} aria-hidden="true" data-open={open ? "" : undefined} /></span>
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
                  {image ? <Image src={image} alt="" fill sizes="64px" /> : null}
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
        <dl className="jelly-checkout__totals">
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          {delivery && <div><dt>Delivery</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>}
          <div className="jelly-checkout__total"><dt>Total</dt><dd><span className="jelly-checkout__currency">{currency}</span> {money(total)}</dd></div>
        </dl>
        <p className="jelly-checkout__hint" aria-live="polite">
          {totals ? (changed ? "Prices were updated by the shop. This is the amount you'll pay." : "This is the amount you'll pay.") : "The final total is confirmed before you pay."}
        </p>
      </div>
    </aside>
  );
}
