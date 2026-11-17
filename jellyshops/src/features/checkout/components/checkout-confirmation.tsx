import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Clock, X } from "lucide-react";
import "../checkout.css";

export type ConfirmationState = "paid" | "pending" | "failed" | "cancelled" | "refunded";

interface CheckoutConfirmationProps {
  state: ConfirmationState;
  orderNumber?: string;
  totalLabel: string;
  storeSlug: string;
  /** Order lines, tracking and so on, drawn below the confirmation. */
  children?: ReactNode;
  actions?: ReactNode;
}

const COPY: Record<ConfirmationState, { eyebrow: string; title: string; body: string }> = {
  paid: { eyebrow: "Payment received", title: "Thank you for your order", body: "Your order is confirmed and a receipt is on its way to your inbox." },
  pending: { eyebrow: "Almost done", title: "We're confirming your payment", body: "This usually takes a few seconds. This page updates by itself, and you'll get an email once it's confirmed." },
  failed: { eyebrow: "Payment not taken", title: "Your payment didn't go through", body: "Nothing has been charged. Go back to checkout to try again or use another way to pay." },
  cancelled: { eyebrow: "Order cancelled", title: "This order has been cancelled", body: "Contact the shop if you need help with its payment." },
  refunded: { eyebrow: "Refunded", title: "Your refund has been confirmed", body: "It can take a few days to appear on your statement." },
};

/** The order confirmation shared by every theme (the success step of checkout). */
export function CheckoutConfirmation({ state, orderNumber, totalLabel, storeSlug, children, actions }: CheckoutConfirmationProps) {
  const copy = COPY[state];
  const Icon = state === "paid" || state === "refunded" ? Check : state === "pending" ? Clock : X;
  return (
    <main className="jelly-checkout jelly-checkout--confirmation" data-state={state}>
      <div className="jelly-checkout__single">
        <section className="jelly-checkout__confirmation" aria-live="polite">
          <span className="jelly-checkout__confirmation-icon" aria-hidden="true"><Icon size={24} /></span>
          <p className="jelly-checkout__eyebrow">{copy.eyebrow}</p>
          <h1 className="jelly-checkout__title">{copy.title}</h1>
          <p>{copy.body}</p>
          <dl className="jelly-checkout__recap-grid">
            {orderNumber && <div><dt>Order number</dt><dd>{orderNumber}</dd></div>}
            <div><dt>{state === "paid" ? "Total paid" : "Total"}</dt><dd>{totalLabel}</dd></div>
          </dl>
          <div className="jelly-checkout__actions">
            {state === "failed" && <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}/checkout`}>Back to checkout</Link>}
            {actions}
            <Link className="jelly-checkout__secondary" href={`/${storeSlug}/shop`}>Keep shopping</Link>
          </div>
        </section>
        {children && <div className="jelly-checkout__confirmation-details">{children}</div>}
      </div>
    </main>
  );
}
