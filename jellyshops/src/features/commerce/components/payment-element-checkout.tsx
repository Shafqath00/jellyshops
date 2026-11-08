"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Stripe,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import { Loader2, LockKeyhole } from "lucide-react";

interface PaymentFormProps {
  clientSecret: string;
  onPaid: () => void;
}

function PaymentForm({ clientSecret, onPaid }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements || pending) return;

    setPending(true);
    setError("");

    const validation = await elements.submit();

    if (validation.error) {
      setError(
        validation.error.message ??
          "Please check your payment details and try again."
      );
      setPending(false);
      return;
    }

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (!result.error && result.paymentIntent?.status === "succeeded") {
      onPaid();
      return;
    }

    if (result.error) {
      const recovered = await stripe.retrievePaymentIntent(clientSecret);

      if (recovered.paymentIntent?.status === "succeeded") {
        onPaid();
        return;
      }

      setError(
        result.error.message ?? "Payment could not be confirmed."
      );
    }

    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement
        options={{ layout: "tabs" }}
        onLoadError={(event) =>
          setError(
            event.error.message ??
              "The payment form could not be loaded."
          )
        }
      />

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#edcbd2] bg-[#fff5f7] px-3.5 py-3 text-[11px] font-semibold leading-5 text-[#914f60]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#241f20] px-5 text-[12px] font-black text-white shadow-[0_10px_26px_rgba(36,31,32,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3a3234] disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <LockKeyhole size={14} />
        )}
        {pending ? "Processing…" : "Pay securely"}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[9px] font-semibold text-[#9a8e90]">
        <LockKeyhole size={10} />
        Secure payment powered by Stripe
      </p>
    </form>
  );
}

interface PaymentElementCheckoutProps {
  clientSecret: string;
  connectedAccountId: string;
  onPaid: () => void;
}

export function PaymentElementCheckout({
  clientSecret,
  connectedAccountId,
  onPaid,
}: PaymentElementCheckoutProps) {
  const publishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  const [stripePromise] = useState<Promise<Stripe | null> | null>(() =>
    publishableKey
      ? loadStripe(publishableKey, {
          stripeAccount: connectedAccountId,
        })
      : null
  );

  if (!publishableKey) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-[#edcbd2] bg-[#fff5f7] p-4 text-[11px] font-semibold leading-5 text-[#914f60]"
      >
        Stripe checkout is not configured. Add
        {" "}
        <code className="rounded bg-white px-1 py-0.5 text-[10px]">
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        </code>
        {" "}
        to the frontend environment.
      </p>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#241f20",
        colorBackground: "#fffdf9",
        colorText: "#332b2d",
        colorDanger: "#914f60",
        borderRadius: "14px",
        fontFamily: "inherit",
        spacingUnit: "4px",
      },
      rules: {
        ".Input": {
          border: "1px solid rgba(36,31,32,0.10)",
          boxShadow: "none",
        },
        ".Input:focus": {
          border: "1px solid rgba(163,92,109,0.55)",
          boxShadow: "0 0 0 3px rgba(255,141,164,0.12)",
        },
        ".Tab": {
          border: "1px solid rgba(36,31,32,0.08)",
          boxShadow: "none",
        },
        ".Tab--selected": {
          border: "1px solid rgba(163,92,109,0.4)",
          boxShadow: "none",
        },
      },
    },
  };

  return (
    <div className="rounded-[22px] border border-black/[0.06] bg-white p-4 shadow-[0_16px_44px_rgba(83,61,66,0.06)] sm:p-5">
      <Elements stripe={stripePromise} options={options}>
        <PaymentForm clientSecret={clientSecret} onPaid={onPaid} />
      </Elements>
    </div>
  );
}
