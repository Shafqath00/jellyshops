"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CircleCheck } from "lucide-react";
import { checkoutSettings, readableTextColour } from "@jelly/storefront-themes/runtime";
import { formatMoney } from "@/lib/domain";
import { addressWording, expectedDelivery } from "../checkout-model";
import { bagKey, forgetPaidOrder, markOrderPaid, readPaidOrder, rememberPaidOrder, type PaidOrderNote } from "../checkout-memory";
import { useCheckout, type CheckoutSection } from "../use-checkout";
import { CheckoutLayout } from "./checkout-layout";
import { CheckoutEmpty, CheckoutLoading, CheckoutProblemBanner } from "./checkout-states";
import { ContactForm, DeliveryForm, StepCard, type StepState } from "./contact-delivery-form";
import { OrderSummary } from "./order-summary";
import { PaymentStep } from "./payment-step";
import "../checkout.css";

const ORDER: CheckoutSection[] = ["contact", "delivery", "payment"];

/**
 * The one Jellyshop checkout every store and theme uses: numbered cards (details, delivery, payment) that open in
 * turn on the left, and the order summary in a narrow sticky column on the right (a folding bar at the top on phones). Looks come from tokens in
 * checkout.css; theme settings > Checkout adds the merchant's accent colour, optional fields and trust lines.
 */
export function CheckoutView({ storeSlug, settings }: { storeSlug: string; settings?: Record<string, unknown> }) {
  const choices = checkoutSettings(settings);
  const checkout = useCheckout(storeSlug, { phone: choices.phone, addressLine2: choices.addressLine2, note: choices.note });
  const router = useRouter();
  const column = useRef<HTMLDivElement>(null);
  const { store, section, prepared, delivery } = checkout;
  // An order this tab has already paid for (Back or a refresh after paying lands here): read once in the browser.
  const [paidNote, setPaidNote] = useState<PaidOrderNote | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tab's own storage after hydration
  useEffect(() => { setPaidNote(readPaidOrder(storeSlug)); }, [storeSlug]);

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
  // Never offer to take a second payment for a bag this tab has just paid for.
  const samePaidBag = paidNote?.paid && (checkout.lines.length === 0 || bagKey(checkout.cart?.items ?? []) === paidNote.bagKey);
  if (paidNote && samePaidBag) {
    return (
      <CheckoutLayout storeSlug={storeSlug} style={accent}>
        <section className="jelly-checkout__state jelly-checkout__already-paid" aria-labelledby="already-paid-title">
          <CircleCheck size={40} aria-hidden="true" />
          <h1 id="already-paid-title" className="jelly-checkout__title">You&apos;ve already paid for this order</h1>
          <p>There&apos;s nothing more to pay. Your order and its delivery details are on your order page.</p>
          <div className="jelly-checkout__actions">
            <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={`/${store.slug}/order/${paidNote.publicToken}`}>View your order</Link>
            {checkout.lines.length > 0
              ? <button type="button" className="jelly-checkout__secondary" onClick={() => { forgetPaidOrder(storeSlug); setPaidNote(null); }}>Buy these items again</button>
              : <Link className="jelly-checkout__secondary" href={`/${store.slug}/shop`}>Continue shopping</Link>}
          </div>
        </section>
      </CheckoutLayout>
    );
  }
  if (checkout.lines.length === 0) return <CheckoutLayout storeSlug={storeSlug} style={accent}><CheckoutEmpty shopHref={`/${store.slug}/shop`} /></CheckoutLayout>;

  const position = ORDER.indexOf(section);
  const stateOf = (key: CheckoutSection): StepState => (key === section ? "open" : ORDER.indexOf(key) < position ? "done" : "waiting");
  const problem = checkout.problem ? <CheckoutProblemBanner problem={checkout.problem} /> : null;
  const shipping = store.shippingMinor === 0 ? "Free" : formatMoney(store.shippingMinor, store.currency);
  const { details } = checkout;
  const arrives = delivery ? expectedDelivery(new Date(), choices.deliveryDays) : undefined;
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
      arrives={arrives}
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
            recap={<p>{address}<br /><span className="jelly-checkout__muted">Standard delivery · {shipping}{arrives ? ` · arrives ${arrives}` : ""}</span></p>}
          >
            <DeliveryForm {...formProps} country={checkout.country} onContinue={checkout.continueToPayment} shippingMethod={{ name: "Standard delivery", price: shipping, detail: arrives ? `Arrives ${arrives}` : undefined }} footer={problem} />
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
              onBeforePay={() => rememberPaidOrder(storeSlug, { publicToken: prepared.publicToken, email: details.email.trim(), bagKey: bagKey(checkout.cart?.items ?? []), paid: false })}
              onPaid={() => {
                markOrderPaid(storeSlug, prepared.publicToken);
                checkout.clearBag();
                // Replace, not push: Back from the confirmation must not land on a payment form for this order.
                router.replace(`/${store.slug}/order/${prepared.publicToken}?paid=1`);
              }}
            />
          ) : null}
        </StepCard>
      </div>
    </CheckoutLayout>
  );
}
