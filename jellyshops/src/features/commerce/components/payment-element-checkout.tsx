"use client";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState } from "react";
import type { Stripe } from "@stripe/stripe-js";

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true); setError("");
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (result.error) setError(result.error.message ?? "Payment could not be confirmed.");
    setPending(false);
  }
  return <form onSubmit={submit}><PaymentElement /><button type="submit" disabled={!stripe || !elements || pending}>{pending ? "Processing…" : "Pay securely"}</button>{error ? <p role="alert">{error}</p> : null}</form>;
}

export function PaymentElementCheckout({ clientSecret, connectedAccountId }: { clientSecret: string; connectedAccountId: string }) {
  const [stripePromise] = useState<Promise<Stripe | null>>(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "", { stripeAccount: connectedAccountId }));
  return <Elements stripe={stripePromise} options={{ clientSecret }}><PaymentForm /></Elements>;
}
