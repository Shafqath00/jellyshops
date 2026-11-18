"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, X } from "lucide-react";
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

interface CheckoutConfirmationProps {
  state: ConfirmationState;
  orderNumber?: string;
  totalLabel: string;
  storeSlug: string;
  /** The order's items and totals, drawn in the grey column (folded at the top on phones). */
  summary?: ConfirmationSummary;
  /** Payment status, delivery address and what happens next, drawn as one card. */
  details?: ConfirmationDetails;
  /** Order lines, tracking and so on, drawn below the confirmation. */
  children?: ReactNode;
  actions?: ReactNode;
}

const COPY: Record<ConfirmationState, { eyebrow: string; title: string; body: string; card: string }> = {
  paid: { eyebrow: "Payment received", title: "Thank you for your order", body: "A receipt is on its way to your inbox.", card: "Your order is confirmed" },
  pending: { eyebrow: "Almost done", title: "We're confirming your payment", body: "This usually takes a few seconds. This page updates by itself, and your confirmation email is sent as soon as the payment goes through.", card: "Waiting for your bank" },
  failed: { eyebrow: "Payment not taken", title: "Your payment didn't go through", body: "Nothing has been charged. Go back to checkout to try again or use another way to pay.", card: "Payment not taken" },
  cancelled: { eyebrow: "Order cancelled", title: "This order has been cancelled", body: "Contact the shop if you need help with its payment.", card: "Order cancelled" },
  refunded: { eyebrow: "Refunded", title: "Your refund has been confirmed", body: "It can take a few days to appear on your statement.", card: "Refund confirmed" },
};

function ConfirmationOrderSummary({ summary, totalLabel, paid }: { summary: ConfirmationSummary; totalLabel: string; paid: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = summary.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <aside className="jelly-checkout__summary" aria-labelledby={`${panelId}-title`}>
      <button type="button" className="jelly-checkout__summary-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span>{open ? "Hide order summary" : "Show order summary"}<ChevronDown size={16} aria-hidden="true" data-open={open ? "" : undefined} /></span>
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

/** The order confirmation shared by every theme: the same split page as checkout, status on the left, order on the right. */
function DetailsCard({ details, orderNumber, totalLabel, paid }: { details: ConfirmationDetails; orderNumber?: string; totalLabel: string; paid: boolean }) {
  return (
    <section className="jelly-checkout__card jelly-checkout__order-details" aria-labelledby="order-details-title">
      <h2 id="order-details-title" className="jelly-checkout__panel-title">Order details</h2>
      <dl className="jelly-checkout__details-grid">
        {orderNumber && <div><dt>Order number</dt><dd>{orderNumber}</dd></div>}
        <div><dt>{paid ? "Total paid" : "Total"}</dt><dd>{totalLabel}</dd></div>
        <div><dt>Payment</dt><dd><span className="jelly-checkout__badge" data-tone={details.payment.tone}>{details.payment.label}</span></dd></div>
        <div><dt>Delivery</dt><dd>{details.delivery}</dd></div>
        {details.address.length > 0 && <div className="jelly-checkout__details-wide"><dt>Delivery address</dt><dd><address>{details.address.map((line, index) => <span key={index}>{line}</span>)}</address></dd></div>}
      </dl>
    </section>
  );
}

/** Shown while the order loads: the same split page, drawn as grey blocks. */
export function OrderConfirmationSkeleton({ message = "Loading your order…" }: { message?: string }) {
  return (
    <main className="jelly-checkout jelly-checkout--confirmation" aria-busy="true">
      <div className="jelly-checkout__grid">
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

export function CheckoutConfirmation({ state, orderNumber, totalLabel, storeSlug, summary, details, children, actions }: CheckoutConfirmationProps) {
  const copy = COPY[state];
  const Icon = state === "paid" || state === "refunded" ? Check : state === "pending" ? Clock : X;
  const paid = state === "paid";
  return (
    <main className="jelly-checkout jelly-checkout--confirmation" data-state={state}>
      <div className={summary ? "jelly-checkout__grid" : "jelly-checkout__single"}>
        {summary && <ConfirmationOrderSummary summary={summary} totalLabel={totalLabel} paid={paid} />}
        <div className="jelly-checkout__main">
          <section className="jelly-checkout__confirmation" aria-live="polite">
            <div className="jelly-checkout__confirmation-head">
              <span className="jelly-checkout__confirmation-icon" aria-hidden="true"><Icon size={24} /></span>
              <div>
                <p className="jelly-checkout__eyebrow">{orderNumber ? `Order ${orderNumber}` : copy.eyebrow}</p>
                <h1 className="jelly-checkout__title">{copy.title}</h1>
              </div>
            </div>
            <div className="jelly-checkout__card">
              <h2 className="jelly-checkout__panel-title">{copy.card}</h2>
              <p>{copy.body}</p>
              {state === "pending" && <span className="jelly-checkout__progress-bar" aria-hidden="true" />}
              {!summary && !details && (
                <dl className="jelly-checkout__recap-grid">
                  {orderNumber && <div><dt>Order number</dt><dd>{orderNumber}</dd></div>}
                  <div><dt>{paid ? "Total paid" : "Total"}</dt><dd>{totalLabel}</dd></div>
                </dl>
              )}
            </div>
          </section>
          {details && <DetailsCard details={details} orderNumber={orderNumber} totalLabel={totalLabel} paid={paid} />}
          {children && <div className="jelly-checkout__confirmation-details">{children}</div>}
          <div className="jelly-checkout__actions">
            {state === "failed" && <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}/checkout`}>Back to checkout</Link>}
            {actions}
            <Link className={state === "failed" || actions ? "jelly-checkout__secondary" : "jelly-checkout__primary jelly-checkout__primary--inline"} href={`/${storeSlug}/shop`}>Continue shopping</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
