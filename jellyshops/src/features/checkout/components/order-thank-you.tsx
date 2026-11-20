"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Clock, Mail, MapPin, Package, Truck, X } from "lucide-react";
import { ConfirmationOrderSummary, type ConfirmationDetails, type ConfirmationState, type ConfirmationSummary } from "./checkout-confirmation";
import "../checkout.css";

/** The four delivery steps a shopper sees after paying, worked out from the order's status and shipments. */
export type NextStepState = "done" | "current" | "next";
export function nextSteps(status: string, shipped: boolean, delivered: boolean): Array<{ key: string; label: string; detail: string; state: NextStepState }> {
  const isDelivered = delivered || status === "DELIVERED";
  const isShipped = isDelivered || shipped || status === "SHIPPED";
  const preparing = !isShipped && ["PAID", "CONFIRMED", "PROCESSING"].includes(status);
  return [
    { key: "confirmed", label: "Order confirmed", detail: "We've received your order and payment.", state: "done" },
    { key: "preparing", label: "Being prepared", detail: "The shop is getting your order ready.", state: isShipped ? "done" : preparing ? "current" : "next" },
    { key: "shipped", label: "On its way", detail: "We'll email you tracking details when it's sent.", state: isDelivered ? "done" : isShipped ? "current" : "next" },
    { key: "delivered", label: "Delivered", detail: "Enjoy your order.", state: isDelivered ? "done" : "next" },
  ];
}

/** "r•••@example.com": enough for the shopper to recognise their own address on screen. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  // Always three dots, so the length of the name is not given away either.
  return `${name[0]}•••@${domain}`;
}

const COPY: Record<ConfirmationState, { title: (name?: string) => string; body: string }> = {
  paid: { title: (name) => (name ? `Thank you, ${name}!` : "Thank you for your order!"), body: "Your order is confirmed and the shop has been told." },
  pending: { title: () => "We're confirming your payment", body: "This usually takes a few seconds. This page updates by itself, and your confirmation email is sent as soon as the payment goes through." },
  failed: { title: () => "Your payment didn't go through", body: "Nothing has been charged. Go back to checkout to try again or use another way to pay." },
  cancelled: { title: () => "This order has been cancelled", body: "Contact the shop if you need help with its payment." },
  refunded: { title: () => "Your refund has been confirmed", body: "It can take a few days to appear on your statement." },
};

interface OrderThankYouProps {
  state: ConfirmationState;
  orderNumber?: string;
  totalLabel: string;
  storeSlug: string;
  /** Shopper's first name, from the delivery name. */
  firstName?: string;
  /** Email typed at checkout in this browser tab (the public order never includes it). */
  email?: string;
  summary: ConfirmationSummary;
  details: ConfirmationDetails;
  /** Expected delivery window ("Tue 25 – Thu 27 Nov") from the shop's delivery time; undefined when it has none. */
  arrives?: string;
  steps: ReturnType<typeof nextSteps>;
  /** Shipments and order history, shown under "Track your order". */
  tracking?: ReactNode;
  /** Pay a balance, when the order has one. */
  actions?: ReactNode;
  /** Shown above everything, for example a refresh problem. */
  notice?: ReactNode;
}

/**
 * The Jellyshop order confirmation, its own page after checkout (`/<store>/order/<token>`). Same split as checkout:
 * the thank-you, what happens next, delivery and tracking on the left; the order summary in the narrow sticky column
 * (a folding bar on phones). Every store gets the same structure in its own colours, fonts and logo.
 */
export function OrderThankYou({ state, orderNumber, totalLabel, storeSlug, firstName, email, summary, details, arrives, steps, tracking, actions, notice }: OrderThankYouProps) {
  const copy = COPY[state];
  const paid = state === "paid";
  const Icon = paid || state === "refunded" ? Check : state === "pending" ? Clock : X;
  const physical = details.address.length > 0;
  return (
    <main className="jelly-checkout jelly-order" data-flow="cards" data-page="order" data-state={state}>
      <div className="jelly-checkout__column">
        <ConfirmationOrderSummary summary={summary} totalLabel={totalLabel} paid={paid} />
        <div className="jelly-checkout__main">
          {notice}
          <section className="jelly-order__hero" aria-labelledby="order-title" aria-live="polite">
            <span className="jelly-order__icon" aria-hidden="true"><Icon size={28} strokeWidth={2.5} /></span>
            {orderNumber && <p className="jelly-order__number">Order <b>{orderNumber}</b></p>}
            <h1 id="order-title" className="jelly-checkout__title">{copy.title(firstName)}</h1>
            <p className="jelly-order__lead">{copy.body}</p>
            {paid && (
              <p className="jelly-order__email"><Mail size={16} aria-hidden="true" />
                {email ? <span>We&apos;ve sent a confirmation email to <b>{maskEmail(email)}</b>.</span> : <span>We&apos;ve sent a confirmation email to the address you gave at checkout.</span>}
              </p>
            )}
            {state === "pending" && <span className="jelly-checkout__progress-bar" aria-hidden="true" />}
          </section>

          {paid && physical && (
            <section className="jelly-order__card" aria-labelledby="order-next-title">
              <h2 id="order-next-title" className="jelly-order__card-title">What happens next</h2>
              <ol className="jelly-order__steps">
                {steps.map((step) => (
                  <li key={step.key} data-state={step.state}>
                    <span className="jelly-order__step-dot" aria-hidden="true">{step.state === "done" ? <Check size={14} strokeWidth={3} /> : null}</span>
                    <span><b>{step.label}</b><span className="jelly-checkout__sr"> ({step.state === "done" ? "done" : step.state === "current" ? "in progress" : "to come"})</span>
                      <small>{step.key === "delivered" && arrives && step.state !== "done" ? `Expected ${arrives}` : step.detail}</small></span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="jelly-order__card" aria-labelledby="order-delivery-title">
            <h2 id="order-delivery-title" className="jelly-order__card-title">{physical ? "Delivery" : "Your order"}</h2>
            <dl className="jelly-order__facts">
              {physical && (
                <div><dt><MapPin size={16} aria-hidden="true" /> Delivery address</dt><dd><address>{details.address.map((line, index) => <span key={index}>{line}</span>)}</address></dd></div>
              )}
              {physical && (
                <div><dt><Truck size={16} aria-hidden="true" /> Expected delivery</dt><dd>{arrives && paid ? <><b>{arrives}</b><span>Standard delivery</span></> : details.delivery}</dd></div>
              )}
              {!physical && <div><dt><Package size={16} aria-hidden="true" /> Delivery</dt><dd>{details.delivery}</dd></div>}
              <div><dt>Payment</dt><dd><span className="jelly-checkout__badge" data-tone={details.payment.tone}>{details.payment.label}</span><span>{paid ? `Total paid ${totalLabel}` : `Total ${totalLabel}`}</span></dd></div>
            </dl>
          </section>

          {tracking && (
            <section id="track-order" className="jelly-order__card jelly-order__tracking" aria-labelledby="order-track-title" tabIndex={-1}>
              <h2 id="order-track-title" className="jelly-order__card-title">Track your order</h2>
              {tracking}
            </section>
          )}

          <div className="jelly-order__actions">
            {state === "failed" && <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${storeSlug}/checkout`}>Back to checkout</Link>}
            {actions}
            <Link className={state === "failed" || actions ? "jelly-checkout__secondary" : "jelly-checkout__primary jelly-checkout__primary--inline"} href={`/${storeSlug}/shop`}>Continue shopping</Link>
            {paid && physical && tracking && <a className="jelly-checkout__secondary" href="#track-order">Track order</a>}
          </div>
        </div>
      </div>
    </main>
  );
}
