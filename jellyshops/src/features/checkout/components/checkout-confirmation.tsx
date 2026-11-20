"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cardPhotoSrcSet } from "@jelly/storefront-ui";
import "../checkout.css";

export type ConfirmationState = "paid" | "pending" | "failed" | "cancelled" | "refunded";

export interface ConfirmationLine {
  key: string;
  title: string;
  detail?: string;
  imageUrl?: string;
  quantity: number;
  priceLabel?: string;
}

export interface ConfirmationSummary {
  lines: ConfirmationLine[];
  subtotalLabel?: string;
  shippingLabel?: string;
  /** "−£5.00" and the code, when the order used one. */
  discount?: { label: string; code?: string };
  currency: string;
}

export interface ConfirmationDetails {
  payment: { label: string; tone: "success" | "pending" | "danger" | "neutral" };
  /** Address lines; empty for digital-only orders. */
  address: string[];
  delivery: string;
}

/** The order summary on the confirmation page: a folding bar on phones and tablets, the sticky right column on desktop. */
export function ConfirmationOrderSummary({ summary, totalLabel, paid }: { summary: ConfirmationSummary; totalLabel: string; paid: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = summary.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <aside className="jelly-checkout__summary" aria-labelledby={`${panelId}-title`}>
      <button type="button" className="jelly-checkout__summary-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="jelly-checkout__summary-thumbs" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- order snapshots may point at any media host */}
          {summary.lines.slice(0, 3).map((line) => (line.imageUrl ? <img key={line.key} src={line.imageUrl} srcSet={cardPhotoSrcSet(line.imageUrl)} sizes="36px" width={36} height={36} alt="" decoding="async" /> : null))}
        </span>
        <span className="jelly-checkout__summary-label">{open ? "Hide order" : "Your order"} <small>{count} {count === 1 ? "item" : "items"}</small><ChevronDown size={16} aria-hidden="true" data-open={open ? "" : undefined} /></span>
        <b>{totalLabel}</b>
      </button>
      <div id={panelId} className="jelly-checkout__summary-panel" data-open={open ? "" : undefined}>
        <h2 id={`${panelId}-title`} className="jelly-checkout__panel-title">Order summary <span className="jelly-checkout__count">({count} {count === 1 ? "item" : "items"})</span></h2>
        <ul className="jelly-checkout__lines">
          {summary.lines.map((line) => (
            <li key={line.key} className="jelly-checkout__line">
              <span className="jelly-checkout__thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- order snapshots may point at any media host */}
                {line.imageUrl ? <img src={line.imageUrl} srcSet={cardPhotoSrcSet(line.imageUrl)} sizes="64px" width={64} height={64} alt="" decoding="async" /> : null}
                <span className="jelly-checkout__qty" aria-hidden="true">{line.quantity}</span>
              </span>
              <span className="jelly-checkout__line-text">
                <strong>{line.title}</strong>
                {line.detail && <span>{line.detail}</span>}
                <span className="jelly-checkout__sr">Quantity {line.quantity}</span>
              </span>
              <span className="jelly-checkout__line-price">{line.priceLabel}</span>
            </li>
          ))}
        </ul>
        <dl className="jelly-checkout__totals">
          {summary.subtotalLabel && <div><dt>Subtotal</dt><dd>{summary.subtotalLabel}</dd></div>}
          {summary.discount && <div className="jelly-checkout__discount-line"><dt>Discount{summary.discount.code ? <span> · {summary.discount.code}</span> : null}</dt><dd>{summary.discount.label}</dd></div>}
          {summary.shippingLabel && <div><dt>Delivery</dt><dd>{summary.shippingLabel}</dd></div>}
          <div className="jelly-checkout__total"><dt>{paid ? "Total paid" : "Total"}</dt><dd><span className="jelly-checkout__currency">{summary.currency}</span> {totalLabel}</dd></div>
        </dl>
      </div>
    </aside>
  );
}

/** Shown while the order loads: the same split page, drawn as grey blocks. */
export function OrderConfirmationSkeleton({ message = "Loading your order…" }: { message?: string }) {
  return (
    <main className="jelly-checkout jelly-order" data-flow="cards" data-page="order" aria-busy="true">
      <div className="jelly-checkout__column">
        <aside className="jelly-checkout__summary" aria-hidden="true">
          <div className="jelly-checkout__summary-panel" data-open="">
            <div className="jelly-checkout__skeleton jelly-checkout__skeleton--summary"><span /><span /><span /><span /></div>
          </div>
        </aside>
        <div className="jelly-checkout__main">
          <p className="jelly-checkout__sr" role="status">{message}</p>
          <div className="jelly-checkout__skeleton jelly-checkout__skeleton--head" aria-hidden="true"><span /><span /></div>
          <div className="jelly-checkout__skeleton jelly-checkout__skeleton--card" aria-hidden="true"><span /><span /><span /></div>
          <div className="jelly-checkout__skeleton jelly-checkout__skeleton--card" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>
      </div>
    </main>
  );
}
