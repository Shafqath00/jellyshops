"use client";

import { useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { LockKeyhole } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/domain";
import { safeReturnUrl } from "../checkout-model";
import { stripeAppearance } from "../checkout-tokens";

/** One Stripe.js instance per connected account; Stripe asks for this to be created once. */
const stripeByAccount = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string, account: string) {
  const key = `${publishableKey}:${account}`;
  if (!stripeByAccount.has(key)) stripeByAccount.set(key, loadStripe(publishableKey, { stripeAccount: account }));
  return stripeByAccount.get(key)!;
}

interface PaymentStepProps {
  clientSecret: string;
  connectedAccountId: string;
  amountMinor: number;
  currency: Currency;
  /** The order page; Stripe sends shoppers here after a bank or wallet redirect. */
  returnPath: string;
  billing: { name: string; email: string };
  onPaid: () => void;
}

function PaymentForm({ clientSecret, amountMinor, currency, returnPath, billing, onPaid }: Omit<PaymentStepProps, "connectedAccountId">) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || pending) return;
    const returnUrl = safeReturnUrl(`${returnPath}?paid=1`, window.location.origin);
    if (!returnUrl) { setError("This page must be opened over a secure (https) connection to pay."); return; }
    setPending(true);
    setError("");
    const checked = await elements.submit();
    if (checked.error) { setError(checked.error.message ?? "Check your payment details and try again."); setPending(false); return; }
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    const status = result.paymentIntent?.status ?? (result.error ? (await stripe.retrievePaymentIntent(clientSecret)).paymentIntent?.status : undefined);
    // "processing" (some bank payments) is final from the shopper's side: the order page waits for the webhook.
    if (status === "succeeded" || status === "processing") { onPaid(); return; }
    setError(result.error?.message ?? "Your payment didn't go through. Nothing has been charged. Try again or use another card.");
    setPending(false);
  }

  return (
    <form className="jelly-checkout__payment-form" onSubmit={submit} aria-busy={pending}>
      {!ready && !error && <p className="jelly-checkout__hint" role="status">Loading the secure payment form…</p>}
      <PaymentElement
        options={{ layout: "tabs", defaultValues: { billingDetails: billing } }}
        onReady={() => setReady(true)}
        onLoadError={(event) => {
          // Stripe's own text here is technical (keys, account ids); keep it for developers only.
          console.error("Stripe Payment Element failed to load", event.error);
          setError("The payment form couldn’t load. Refresh the page to try again, or contact the shop if it keeps happening.");
        }}
      />
      {error && <div className="jelly-checkout__alert" role="alert"><p>{error}</p></div>}
      <button type="submit" className="jelly-checkout__primary" disabled={!stripe || !elements || !ready || pending}>
        {pending ? <span className="jelly-checkout__spinner" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
        {pending ? "Paying…" : `Pay ${formatMoney(amountMinor, currency)}`}
      </button>
    </form>
  );
}

/** Step 3: Stripe's Payment Element. Card details go straight to Stripe and never reach our servers. */
export function PaymentStep(props: PaymentStepProps) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const [appearance] = useState(() => stripeAppearance(typeof document === "undefined" ? null : document.querySelector(".jelly-checkout")));
  return (
    <section className="jelly-checkout__panel" aria-labelledby="checkout-payment-title">
      <h2 id="checkout-payment-title" className="jelly-checkout__panel-title" tabIndex={-1}>Payment</h2>
      <p className="jelly-checkout__note"><LockKeyhole size={14} aria-hidden="true" /> Secure payment by Stripe. Your card details are never stored by this shop.</p>
      {publishableKey ? (
        <Elements stripe={stripeFor(publishableKey, props.connectedAccountId)} options={{ clientSecret: props.clientSecret, appearance }}>
          <PaymentForm {...props} />
        </Elements>
      ) : (
        <div className="jelly-checkout__alert" role="alert"><p>Card payments aren’t set up for this shop yet. Please contact the shop.</p></div>
      )}
    </section>
  );
}
