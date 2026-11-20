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
