/**
 * "Remember my details on this device": a returning shopper's contact and delivery details, kept only in their own
 * browser (one entry per store), never sent anywhere else. Saved only when the shopper ticks the box; "Forget" clears
 * it. Every read and write is wrapped, because storage can be blocked or full.
 */
import { EMPTY_DETAILS, type CheckoutDetails } from "./checkout-model";

const key = (storeSlug: string) => `jelly-checkout-details:${storeSlug}`;
const SAVED_FIELDS: Array<keyof CheckoutDetails> = ["email", "name", "phone", "line1", "line2", "city", "region", "postalCode"];

export function readSavedDetails(storeSlug: string): CheckoutDetails | null {
  try {
    const raw = window.localStorage.getItem(key(storeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<keyof CheckoutDetails, unknown>>;
    const details = { ...EMPTY_DETAILS };
    for (const field of SAVED_FIELDS) if (typeof parsed[field] === "string") details[field] = (parsed[field] as string).slice(0, 200);
    return details.email || details.line1 ? details : null;
  } catch {
    return null;
  }
}

export function saveDetails(storeSlug: string, details: CheckoutDetails): void {
  try {
    window.localStorage.setItem(key(storeSlug), JSON.stringify(Object.fromEntries(SAVED_FIELDS.map((field) => [field, details[field].trim()]))));
  } catch { /* storage blocked: nothing is remembered */ }
}

export function forgetDetails(storeSlug: string): void {
  try { window.localStorage.removeItem(key(storeSlug)); } catch { /* nothing to forget */ }
}

/**
 * The order this browser has just paid for, kept for this tab only (sessionStorage). Checkout uses it so a shopper who
 * comes back with Back or a refresh sees their order instead of paying for the same bag twice; the confirmation page
 * uses the email to say where the receipt went (the public order never includes it).
 */
export interface PaidOrderNote { publicToken: string; email: string; bagKey: string; at: number; /** False while the payment is being taken (it may still fail); true once Stripe or our server says paid. */ paid: boolean }
const paidKey = (storeSlug: string) => `jelly-checkout-paid:${storeSlug}`;
const PAID_NOTE_MINUTES = 60;

export function rememberPaidOrder(storeSlug: string, note: Omit<PaidOrderNote, "at">): void {
  try { window.sessionStorage.setItem(paidKey(storeSlug), JSON.stringify({ ...note, at: Date.now() })); } catch { /* storage blocked */ }
}

export function readPaidOrder(storeSlug: string, now = Date.now()): PaidOrderNote | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(paidKey(storeSlug)) ?? "null") as PaidOrderNote | null;
    if (!parsed || typeof parsed.publicToken !== "string" || typeof parsed.at !== "number") return null;
    if (now - parsed.at > PAID_NOTE_MINUTES * 60_000) return null;
    return { publicToken: parsed.publicToken, email: typeof parsed.email === "string" ? parsed.email : "", bagKey: typeof parsed.bagKey === "string" ? parsed.bagKey : "", at: parsed.at, paid: parsed.paid === true };
  } catch {
    return null;
  }
}

/** Marks the remembered order as paid (after Stripe confirmed it, or the order page saw it paid). */
export function markOrderPaid(storeSlug: string, publicToken: string): void {
  const note = readPaidOrder(storeSlug);
  if (note && note.publicToken === publicToken && !note.paid) rememberPaidOrder(storeSlug, { ...note, paid: true });
}

export function forgetPaidOrder(storeSlug: string): void {
  try { window.sessionStorage.removeItem(paidKey(storeSlug)); } catch { /* nothing to forget */ }
}

/** A short fingerprint of a bag's lines (variant, quantity, choices), to recognise the same bag after paying. */
export function bagKey(items: Array<{ variantId: string; quantity: number; configurationSelections?: unknown; personalisation?: unknown }>): string {
  return items.map((item) => `${item.variantId}x${item.quantity}:${JSON.stringify(item.configurationSelections ?? [])}:${JSON.stringify(item.personalisation ?? [])}`).sort().join("|");
}
