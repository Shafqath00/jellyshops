"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties } from "react";
import { checkoutSettings, readableTextColour } from "@jelly/storefront-themes/runtime";
import { formatMoney } from "@/lib/domain";
import { addressWording } from "../checkout-model";
import { useCheckout, type CheckoutSection } from "../use-checkout";
import { CheckoutLayout } from "./checkout-layout";
import { CheckoutEmpty, CheckoutLoading, CheckoutProblemBanner } from "./checkout-states";
import { ContactForm, DeliveryForm, StepCard, type StepState } from "./contact-delivery-form";
import { OrderSummary } from "./order-summary";
import { PaymentStep } from "./payment-step";
import "../checkout.css";

const ORDER: CheckoutSection[] = ["contact", "delivery", "payment"];

/**
 * The one Jellyshop checkout every store and theme uses: a single column of numbered cards (details, delivery,
 * payment) that open in turn, under a summary bar that keeps the total in view. Looks come from tokens in
 * checkout.css; theme settings > Checkout adds the merchant's accent colour, optional fields and trust lines.
 */
export function CheckoutView({ storeSlug, settings }: { storeSlug: string; settings?: Record<string, unknown> }) {
  const choices = checkoutSettings(settings);
  const checkout = useCheckout(storeSlug, { phone: choices.phone, addressLine2: choices.addressLine2, note: choices.note });
  const router = useRouter();
  const column = useRef<HTMLDivElement>(null);
  const { store, section, prepared, delivery } = checkout;

  // Move focus to the card that just opened, so keyboard and screen-reader users land on it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    column.current?.querySelector<HTMLElement>(`#checkout-${section}-title`)?.focus();
  }, [section]);

  const accent: CSSProperties | undefined = choices.accent
    ? ({ "--checkout-primary": choices.accent, "--checkout-on-primary": readableTextColour("#ffffff", choices.accent) } as CSSProperties)
    : undefined;

  if (!store) return null;
  if (!checkout.ready) return <CheckoutLayout storeSlug={storeSlug} style={accent}><CheckoutLoading /></CheckoutLayout>;
  if (checkout.lines.length === 0) return <CheckoutLayout storeSlug={storeSlug} style={accent}><CheckoutEmpty shopHref={`/${store.slug}/shop`} /></CheckoutLayout>;

  const position = ORDER.indexOf(section);
  const stateOf = (key: CheckoutSection): StepState => (key === section ? "open" : ORDER.indexOf(key) < position ? "done" : "waiting");
  const problem = checkout.problem ? <CheckoutProblemBanner problem={checkout.problem} /> : null;
  const shipping = store.shippingMinor === 0 ? "Free" : formatMoney(store.shippingMinor, store.currency);
  const { details } = checkout;
  const address = [details.line1, details.line2, details.city, details.region, details.postalCode, addressWording(checkout.country).countryName].filter((part) => part.trim()).join(", ");
  const formProps = { details, errors: checkout.fieldErrors, onChange: checkout.setField, onBlur: checkout.checkField, pending: checkout.pending, options: checkout.options };

  const summary = (
    <OrderSummary
      lines={checkout.lines}
      currency={store.currency}
      estimatedSubtotal={checkout.estimatedSubtotal}
      estimatedShipping={store.shippingMinor}
      delivery={delivery}
      totals={prepared?.totals}
      discount={{ applied: checkout.discount, pending: checkout.discountPending, error: checkout.discountError, editable: checkout.step === "details", onApply: checkout.applyDiscount, onRemove: checkout.removeDiscount }}
      trust={{ delivery: choices.deliveryNote || undefined, returns: choices.returnsNote || undefined, returnsHref: `/${store.slug}/pages/returns` }}
    />
  );

  return (
    <CheckoutLayout storeSlug={storeSlug} section={section} delivery={delivery} summary={summary} style={accent}>
      <div ref={column} className="jelly-checkout__steps-list">
        <StepCard
          id="checkout-contact" number={1} title="Your details" state={stateOf("contact")}
          onEdit={() => checkout.editSection("contact")} editLabel="Change your details"
          recap={<p>{details.name} · {details.email}{details.phone ? ` · ${details.phone}` : ""}</p>}
        >
          <ContactForm
            {...formProps}
            delivery={delivery}
            onContinue={checkout.continueFromContact}
            remember={checkout.remember}
            onRemember={checkout.setRemember}
            usingSaved={checkout.usingSaved}
            onForget={checkout.forgetSaved}
            signedIn={checkout.signedIn}
            footer={delivery ? null : problem}
          />
        </StepCard>

        {delivery && (
          <StepCard
            id="checkout-delivery" number={2} title="Delivery" state={stateOf("delivery")}
            onEdit={() => checkout.editSection("delivery")} editLabel="Change the delivery address"
            recap={<p>{address}<br /><span className="jelly-checkout__muted">Standard delivery · {shipping}</span></p>}
          >
            <DeliveryForm {...formProps} country={checkout.country} onContinue={checkout.continueToPayment} shippingMethod={{ name: "Standard delivery", price: shipping }} footer={problem} />
          </StepCard>
        )}
        {!delivery && section !== "payment" && <p className="jelly-checkout__note jelly-checkout__note--panel">Nothing to deliver: your downloads arrive by email once you’ve paid.</p>}

        <StepCard id="checkout-payment" number={delivery ? 3 : 2} title="Payment" state={stateOf("payment")}>
          {prepared ? (
            <PaymentStep
              clientSecret={prepared.clientSecret}
              connectedAccountId={prepared.connectedAccountId}
              amountMinor={prepared.totals?.amountMinor ?? checkout.estimatedSubtotal}
              currency={store.currency}
              returnPath={`/${store.slug}/order/${prepared.publicToken}`}
              billing={{ name: details.name, email: details.email }}
              onPaid={() => { checkout.clearBag(); router.push(`/${store.slug}/order/${prepared.publicToken}?paid=1`); }}
            />
          ) : null}
        </StepCard>
      </div>
    </CheckoutLayout>
  );
}
