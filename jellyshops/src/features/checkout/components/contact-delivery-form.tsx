"use client";

import { useRef, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { addressWording, type CheckoutDetails, type CheckoutField, type CheckoutOptions } from "../checkout-model";

type Errors = Partial<Record<CheckoutField, string>>;

interface FieldProps {
  id: CheckoutField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "tel" | "text";
  autoCapitalize?: string;
  enterKeyHint?: "next" | "done" | "go";
  wide?: boolean;
  multiline?: boolean;
}

function Field({ id, label, value, onChange, onBlur, error, hint, required = false, type = "text", autoComplete, inputMode, autoCapitalize, enterKeyHint, wide, multiline }: FieldProps) {
  const inputId = `checkout-${id}`;
  const describedBy = [hint ? `${inputId}-hint` : "", error ? `${inputId}-error` : ""].filter(Boolean).join(" ") || undefined;
  const shared = {
    id: inputId, name: id, value, onBlur, required, autoComplete,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className="jelly-checkout__field" data-wide={wide ? "" : undefined} data-invalid={error ? "" : undefined}>
      <label htmlFor={inputId}>
        {label}
        {!required && <span className="jelly-checkout__optional"> (optional)</span>}
      </label>
      {multiline
        ? <textarea {...shared} rows={3} maxLength={1000} />
        : <input {...shared} type={type} inputMode={inputMode} autoCapitalize={autoCapitalize} enterKeyHint={enterKeyHint} spellCheck={type === "email" ? false : undefined} />}
      {hint && <p id={`${inputId}-hint`} className="jelly-checkout__hint">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="jelly-checkout__field-error">{error}</p>}
    </div>
  );
}

export type StepState = "open" | "done" | "waiting";

/**
 * One numbered checkout card. Open: its form. Done: a one-line recap with Change. Waiting: just its title, greyed,
 * so shoppers see what comes next.
 */
export function StepCard({ number, title, state, recap, onEdit, editLabel, children, id }: { number: number; title: string; state: StepState; recap?: ReactNode; onEdit?: () => void; editLabel?: string; children?: ReactNode; id: string }) {
  return (
    <section className="jelly-checkout__step" data-state={state} aria-labelledby={`${id}-title`} aria-current={state === "open" ? "step" : undefined}>
      <header className="jelly-checkout__step-head">
        <span className="jelly-checkout__step-number" aria-hidden="true">{state === "done" ? <Check size={16} strokeWidth={2.5} /> : number}</span>
        <h2 id={`${id}-title`} className="jelly-checkout__step-title" tabIndex={-1}>
          <span className="jelly-checkout__sr">Step {number}: </span>{title}{state === "done" && <span className="jelly-checkout__sr"> (done)</span>}
        </h2>
        {state === "done" && onEdit && <button type="button" className="jelly-checkout__link" onClick={onEdit} aria-label={editLabel ?? `Change ${title.toLowerCase()}`}>Change</button>}
      </header>
      {state === "done" && recap ? <div className="jelly-checkout__step-recap">{recap}</div> : null}
      {state === "open" ? <div className="jelly-checkout__step-body">{children}</div> : null}
    </section>
  );
}

interface FormProps {
  details: CheckoutDetails;
  errors: Errors;
  onChange: (field: CheckoutField, value: string) => void;
  onBlur: (field: CheckoutField) => void;
  pending: boolean;
  options: CheckoutOptions;
}

function useFields({ details, errors, onChange, onBlur }: FormProps) {
  return (id: CheckoutField) => ({ id, value: details[id], onChange: (value: string) => onChange(id, value), onBlur: () => onBlur(id), error: errors[id] });
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button type="submit" className="jelly-checkout__primary" disabled={pending}>
      {pending ? <span className="jelly-checkout__spinner" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Card 1: who is buying. */
export function ContactForm(props: FormProps & {
  delivery: boolean;
  onContinue: () => Promise<CheckoutField | null>;
  remember: boolean;
  onRemember: (value: boolean) => void;
  usingSaved: boolean;
  onForget: () => void;
  signedIn?: boolean;
  footer?: ReactNode;
}) {
  const { delivery, onContinue, pending, options, remember, onRemember, usingSaved, onForget, signedIn, footer } = props;
  const form = useRef<HTMLFormElement>(null);
  const field = useFields(props);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstProblem = await onContinue();
    if (firstProblem) form.current?.querySelector<HTMLElement>(`#checkout-${firstProblem}`)?.focus();
  }
  const askPhone = delivery && options.phone !== "hidden";
  return (
    <form ref={form} className="jelly-checkout__form" onSubmit={submit} noValidate aria-busy={pending}>
      {usingSaved
        ? <p className="jelly-checkout__note jelly-checkout__saved">Filled in with details saved on this device. <button type="button" className="jelly-checkout__link" onClick={onForget}>Forget them</button></p>
        : signedIn ? null : <p className="jelly-checkout__note">No account needed: check out as a guest.</p>}
      <div className="jelly-checkout__fields">
        <Field {...field("email")} label="Email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" required wide hint="For your receipt and delivery updates." />
        <Field {...field("name")} label="Full name" autoComplete={delivery ? "shipping name" : "name"} enterKeyHint="next" required wide />
        {askPhone && <Field {...field("phone")} label="Phone" type="tel" inputMode="tel" autoComplete={delivery ? "shipping tel" : "tel"} required={options.phone === "required"} wide hint="Only used if the courier needs to reach you." />}
      </div>
      <label className="jelly-checkout__check">
        <input type="checkbox" checked={remember} onChange={(event) => onRemember(event.target.checked)} />
        <span>Remember my details on this device</span>
      </label>
      {footer}
      <SubmitButton pending={pending} label={delivery ? "Continue to delivery" : "Continue to payment"} pendingLabel="Getting your payment ready…" />
    </form>
  );
}

/** Card 2: where it goes, the delivery method and an optional note. */
export function DeliveryForm(props: FormProps & {
  country: string;
  onContinue: () => Promise<CheckoutField | null>;
  shippingMethod?: { name: string; price: string; detail?: string };
  footer?: ReactNode;
}) {
  const { country, onContinue, pending, options, shippingMethod, footer } = props;
  const form = useRef<HTMLFormElement>(null);
  const field = useFields(props);
  const wording = addressWording(country);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstProblem = await onContinue();
    if (firstProblem) form.current?.querySelector<HTMLElement>(`#checkout-${firstProblem}`)?.focus();
  }
  return (
    <form ref={form} className="jelly-checkout__form" onSubmit={submit} noValidate aria-busy={pending}>
      <p className="jelly-checkout__note">Delivering to {wording.countryName}</p>
      <div className="jelly-checkout__fields">
        <Field {...field("line1")} label="Address" autoComplete="shipping address-line1" enterKeyHint="next" required wide />
        {options.addressLine2 && <Field {...field("line2")} label="Flat, suite or building" autoComplete="shipping address-line2" wide />}
        <Field {...field("city")} label="Town or city" autoComplete="shipping address-level2" required />
        <Field {...field("region")} label={wording.region} autoComplete="shipping address-level1" required={wording.regionRequired} />
        <Field {...field("postalCode")} label={wording.postalCode} autoComplete="shipping postal-code" autoCapitalize="characters" enterKeyHint="done" required />
      </div>
      {shippingMethod && (
        <div className="jelly-checkout__method" role="group" aria-label="Delivery method">
          <span className="jelly-checkout__method-radio" aria-hidden="true" />
          <span>{shippingMethod.name}{shippingMethod.detail ? <small className="jelly-checkout__method-detail">{shippingMethod.detail}</small> : null}</span>
          <strong>{shippingMethod.price}</strong>
        </div>
      )}
      {options.note && <Field {...field("note")} label="Note for the shop" multiline wide hint="For example a safe place to leave the parcel." />}
      {footer}
      <SubmitButton pending={pending} label="Continue to payment" pendingLabel="Getting your payment ready…" />
    </form>
  );
}
