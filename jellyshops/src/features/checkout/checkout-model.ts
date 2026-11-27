/**
 * Pure checkout rules: bag lines, address wording per country, field checks.
 * No React here so it is easy to test.
 */
import type { Cart, CartItem, Product, ProductVariant, Store } from "@/lib/domain";
import type { CommerceAttemptInput } from "@/features/commerce/api/types";

export interface CheckoutLine {
  item: CartItem;
  product: Product;
  variant: ProductVariant;
  /** Estimate from the catalogue in the browser. The server sets the real price. */
  lineMinor: number;
}

export interface CheckoutDetails {
  email: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  /** Optional note for the shop (only when the merchant asks for one). */
  note: string;
}

export type CheckoutField = keyof CheckoutDetails;

export const EMPTY_DETAILS: CheckoutDetails = { email: "", name: "", phone: "", line1: "", line2: "", city: "", region: "", postalCode: "", note: "" };

/** What the merchant chose in theme settings > Checkout (see checkoutSettings in storefront-themes). */
export interface CheckoutOptions { phone: "required" | "optional" | "hidden"; addressLine2: boolean; note: boolean }
export const DEFAULT_CHECKOUT_OPTIONS: CheckoutOptions = { phone: "required", addressLine2: true, note: false };

/** The fields each checkout card owns, in the order they appear. */
export const CONTACT_FIELDS: CheckoutField[] = ["email", "name", "phone"];
export const DELIVERY_FIELDS: CheckoutField[] = ["line1", "line2", "city", "region", "postalCode", "note"];

/** Only the problems for the given fields, keeping their order. */
export function problemsFor(problems: Partial<Record<CheckoutField, string>>, fields: CheckoutField[]): Partial<Record<CheckoutField, string>> {
  return Object.fromEntries(fields.filter((field) => problems[field]).map((field) => [field, problems[field]])) as Partial<Record<CheckoutField, string>>;
}

export function checkoutLines(cart: Cart | undefined, products: Product[]): CheckoutLine[] {
  if (!cart) return [];
  return cart.items.flatMap((item) => {
    const product = products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (!product || !variant) return [];
    return [{ item, product, variant, lineMinor: (item.unitPriceMinor ?? variant.priceMinor) * item.quantity }];
  });
}

export function needsDelivery(lines: CheckoutLine[]): boolean {
  return lines.some((line) => line.product.fulfillmentType !== "DIGITAL");
}

export function storeCountry(store: Pick<Store, "country" | "currency">): string {
  return (store.country ?? (store.currency === "GBP" ? "GB" : store.currency === "USD" ? "US" : "IN")).toUpperCase();
}

export interface AddressWording { region: string; regionRequired: boolean; postalCode: string; countryName: string }

export function addressWording(country: string): AddressWording {
  let countryName = country;
  try { countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country; } catch { /* old browsers keep the code */ }
  if (country === "GB") return { region: "County", regionRequired: false, postalCode: "Postcode", countryName };
  if (country === "US") return { region: "State", regionRequired: true, postalCode: "ZIP code", countryName };
  if (country === "IN") return { region: "State", regionRequired: true, postalCode: "PIN code", countryName };
  return { region: "Region", regionRequired: false, postalCode: "Postcode", countryName };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Field problems in the order the fields appear, so the first can take focus. */
export function validateDetails(details: CheckoutDetails, delivery: boolean, country: string, options: CheckoutOptions = DEFAULT_CHECKOUT_OPTIONS): Partial<Record<CheckoutField, string>> {
  const wording = addressWording(country);
  const problems: Partial<Record<CheckoutField, string>> = {};
  if (!details.email.trim()) problems.email = "Enter your email address.";
  else if (!EMAIL.test(details.email.trim())) problems.email = "Enter an email address like name@example.com.";
  if (!details.name.trim()) problems.name = "Enter your full name.";
  if (delivery) {
    if (options.phone !== "hidden") {
      if (!details.phone.trim()) { if (options.phone === "required") problems.phone = "Enter a phone number for the courier."; }
      else if (!/^[+\d][\d\s()-]{5,}$/.test(details.phone.trim())) problems.phone = "Enter a phone number using digits only.";
    }
    if (!details.line1.trim()) problems.line1 = "Enter the first line of your address.";
    if (!details.city.trim()) problems.city = "Enter a town or city.";
    if (wording.regionRequired && !details.region.trim()) problems.region = `Enter a ${wording.region.toLowerCase()}.`;
    if (!details.postalCode.trim()) problems.postalCode = `Enter a ${wording.postalCode.toLowerCase()}.`;
  }
  return problems;
}

/** The request body for a checkout attempt. Prices are left out: the server sets them. */
export function attemptInput(cart: Cart, lines: CheckoutLine[], details: CheckoutDetails, delivery: boolean, store: Store, discountCode?: string): CommerceAttemptInput {
  const trimmed = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.trim()])) as unknown as CheckoutDetails;
  const address = delivery ? { line1: trimmed.line1, ...(trimmed.line2 ? { line2: trimmed.line2 } : {}), city: trimmed.city, region: trimmed.region, postalCode: trimmed.postalCode, country: storeCountry(store) } : undefined;
  const customer = { name: trimmed.name, email: trimmed.email, ...(trimmed.phone ? { phone: trimmed.phone } : {}), ...(address ? { address } : {}), ...(trimmed.note ? { note: trimmed.note.slice(0, 1000) } : {}) };
  return { cartKey: cart.id, currency: store.currency.toUpperCase(), items: bagItems(lines), customerSnapshot: customer, ...(address ? { deliverySnapshot: address } : {}), ...(discountCode ? { discountCode } : {}) };
}

/** The bag's lines as the server reads them (no prices: the server sets them). */
export function bagItems(lines: CheckoutLine[]): CommerceAttemptInput["items"] {
  return lines.map(({ item, product }) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    ...(item.personalisation?.length ? { personalisation: item.personalisation } : {}),
    ...(item.configurationSelections?.length ? {
      configurationSelections: item.configurationSelections.map((selection) => {
        const option = product.options?.find((candidate) => candidate.id === selection.optionId);
        const value = option?.values.find((candidate) => candidate.id === selection.valueId);
        return { ...selection, optionName: option?.name ?? selection.optionId, valueLabel: value?.label ?? selection.valueId };
      }),
    } : {}),
  }));
}

/** Only send shoppers back to this site, and only over https (http is allowed on localhost for testing). */
export function safeReturnUrl(path: string, origin: string): string | null {
  try {
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin) return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname.endsWith(".localhost");
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Adds working days (Monday to Friday) to a date. */
function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return date;
}

/**
 * The expected delivery window for an order placed on `from`, from the merchant's delivery time
 * (theme settings > Checkout), as "Tue 25 Nov" or "Tue 25 – Thu 27 Nov". Undefined without a delivery time.
 */
export function expectedDelivery(from: Date | string | undefined, days: [number, number] | null): string | undefined {
  if (!days || !from) return undefined;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return undefined;
  const earliest = addWorkingDays(start, days[0]);
  const latest = addWorkingDays(start, days[1]);
  const full = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (earliest.toDateString() === latest.toDateString()) return full.format(earliest);
  const sameMonth = earliest.getMonth() === latest.getMonth();
  const first = sameMonth ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" }).format(earliest) : full.format(earliest);
  return `${first} – ${full.format(latest)}`;
}
