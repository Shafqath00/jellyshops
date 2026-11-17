"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useCheckout } from "../use-checkout";
import { CheckoutLayout } from "./checkout-layout";
import { CheckoutEmpty, CheckoutLoading, CheckoutProblemBanner } from "./checkout-states";
import { ContactDeliveryForm } from "./contact-delivery-form";
import { DetailsRecap } from "./details-recap";
import { OrderSummary } from "./order-summary";
import { PaymentStep } from "./payment-step";
import "../checkout.css";

/** The one checkout every store and theme uses. Looks come from tokens in checkout.css. */
export function CheckoutView({ storeSlug }: { storeSlug: string }) {
  const checkout = useCheckout(storeSlug);
  const router = useRouter();
  const paymentHeading = useRef<HTMLDivElement>(null);
  const { store, step, prepared } = checkout;

  // Move focus to the payment step when it appears, so keyboard and screen-reader users land there.
  useEffect(() => { if (step === "payment") paymentHeading.current?.querySelector<HTMLElement>("h2")?.focus(); }, [step]);

  if (!store) return null;
  if (!checkout.ready) return <CheckoutLayout storeSlug={storeSlug}><CheckoutLoading /></CheckoutLayout>;
  if (checkout.lines.length === 0) return <CheckoutLayout storeSlug={storeSlug}><CheckoutEmpty shopHref={`/${store.slug}/shop`} /></CheckoutLayout>;

  const summary = (
    <OrderSummary
      lines={checkout.lines}
      currency={store.currency}
      estimatedSubtotal={checkout.estimatedSubtotal}
      estimatedShipping={store.shippingMinor}
      delivery={checkout.delivery}
      totals={prepared?.totals}
    />
  );

  return (
    <CheckoutLayout storeSlug={storeSlug} step={step} summary={summary}>
      {step === "details" ? (
        <ContactDeliveryForm
          details={checkout.details}
          errors={checkout.fieldErrors}
          onChange={checkout.setField}
          delivery={checkout.delivery}
          country={checkout.country}
          pending={checkout.pending}
          onContinue={checkout.continueToPayment}
          footer={checkout.problem ? <CheckoutProblemBanner problem={checkout.problem} /> : null}
        />
      ) : prepared ? (
        <>
          <DetailsRecap details={checkout.details} delivery={checkout.delivery} country={checkout.country} onEdit={checkout.editDetails} />
          <div ref={paymentHeading} className="jelly-checkout__focus-target">
            <PaymentStep
              clientSecret={prepared.clientSecret}
              connectedAccountId={prepared.connectedAccountId}
              amountMinor={prepared.totals?.amountMinor ?? checkout.estimatedSubtotal}
              currency={store.currency}
              returnPath={`/${store.slug}/order/${prepared.publicToken}`}
              billing={{ name: checkout.details.name, email: checkout.details.email }}
              onPaid={() => { checkout.clearBag(); router.push(`/${store.slug}/order/${prepared.publicToken}?paid=1`); }}
            />
          </div>
        </>
      ) : null}
      <Link className="jelly-checkout__back" href={`/${store.slug}/cart`}><ArrowLeft size={16} aria-hidden="true" /> Back to bag</Link>
    </CheckoutLayout>
  );
}
