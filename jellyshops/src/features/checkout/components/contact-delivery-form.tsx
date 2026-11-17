"use client";

import { useRef, type FormEvent } from "react";
import { addressWording, type CheckoutDetails, type CheckoutField } from "../checkout-model";

interface FieldProps {
  id: CheckoutField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "tel" | "text";
  wide?: boolean;
}

function Field({ id, label, value, onChange, error, hint, required = false, type = "text", autoComplete, inputMode, wide }: FieldProps) {
  const inputId = `checkout-${id}`;
  const describedBy = [hint ? `${inputId}-hint` : "", error ? `${inputId}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="jelly-checkout__field" data-wide={wide ? "" : undefined} data-invalid={error ? "" : undefined}>
      <label htmlFor={inputId}>
        {label}
        {!required && <span className="jelly-checkout__optional"> (optional)</span>}
      </label>
      <input
        id={inputId}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        spellCheck={type === "email" ? false : undefined}
      />
      {hint && <p id={`${inputId}-hint`} className="jelly-checkout__hint">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="jelly-checkout__field-error">{error}</p>}
    </div>
  );
}

interface ContactDeliveryFormProps {
  details: CheckoutDetails;
  errors: Partial<Record<CheckoutField, string>>;
  onChange: (field: CheckoutField, value: string) => void;
  delivery: boolean;
  country: string;
  pending: boolean;
  onContinue: () => Promise<CheckoutField | null>;
  footer?: React.ReactNode;
}

/** Step 1 and 2: who is buying and where it goes. */
export function ContactDeliveryForm({ details, errors, onChange, delivery, country, pending, onContinue, footer }: ContactDeliveryFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const wording = addressWording(country);
  const field = (id: CheckoutField) => ({ id, value: details[id], onChange: (value: string) => onChange(id, value), error: errors[id] });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstProblem = await onContinue();
    if (firstProblem) form.current?.querySelector<HTMLInputElement>(`#checkout-${firstProblem}`)?.focus();
  }

  return (
    <form ref={form} className="jelly-checkout__form" onSubmit={submit} noValidate aria-busy={pending}>
      <section className="jelly-checkout__panel" aria-labelledby="checkout-contact-title">
        <h2 id="checkout-contact-title" className="jelly-checkout__panel-title">Contact</h2>
        <div className="jelly-checkout__fields">
          <Field {...field("email")} label="Email" type="email" inputMode="email" autoComplete="email" required wide hint="We'll send your receipt here." />
          <Field {...field("name")} label="Full name" autoComplete="name" required wide />
          {delivery && <Field {...field("phone")} label="Phone" type="tel" inputMode="tel" autoComplete="tel" required wide hint="Only used if the courier needs to reach you." />}
        </div>
      </section>

      {delivery ? (
        <section className="jelly-checkout__panel" aria-labelledby="checkout-delivery-title">
          <h2 id="checkout-delivery-title" className="jelly-checkout__panel-title">Delivery</h2>
          <p className="jelly-checkout__note">Delivering to {wording.countryName}</p>
          <div className="jelly-checkout__fields">
            <Field {...field("line1")} label="Address" autoComplete="address-line1" required wide />
            <Field {...field("line2")} label="Flat, suite or building" autoComplete="address-line2" wide />
            <Field {...field("city")} label="Town or city" autoComplete="address-level2" required />
            <Field {...field("region")} label={wording.region} autoComplete="address-level1" required={wording.regionRequired} />
            <Field {...field("postalCode")} label={wording.postalCode} autoComplete="postal-code" required />
          </div>
        </section>
      ) : (
        <p className="jelly-checkout__note jelly-checkout__note--panel">Nothing to deliver: your downloads arrive by email once you’ve paid.</p>
      )}

      {footer}

      <button type="submit" className="jelly-checkout__primary" disabled={pending}>
        {pending ? <span className="jelly-checkout__spinner" aria-hidden="true" /> : null}
        {pending ? "Getting your payment ready…" : "Continue to payment"}
      </button>
    </form>
  );
}
