"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { PreparedPayment } from "@/features/commerce/api/types";
import { useCustomer } from "@/features/customers/providers/customer-provider";
import { checkoutProblem, type CheckoutProblem } from "./checkout-errors";
import { forgetDetails, readSavedDetails, saveDetails } from "./checkout-memory";
import { useBagDiscounts } from "./use-bag-discounts";
import {
  attemptInput, bagItems, checkoutLines, CONTACT_FIELDS, DEFAULT_CHECKOUT_OPTIONS, EMPTY_DETAILS, needsDelivery, problemsFor, storeCountry, validateDetails,
  type CheckoutDetails, type CheckoutField, type CheckoutOptions,
} from "./checkout-model";

export type CheckoutStep = "details" | "payment";
/** The three checkout cards; one is open at a time. */
export type CheckoutSection = "contact" | "delivery" | "payment";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

/**
 * Everything the checkout page needs, kept apart from how it looks:
 * bag lines, the shopper's details, which card is open, and preparing the payment on the server.
 */
export function useCheckout(storeSlug: string, options: CheckoutOptions = DEFAULT_CHECKOUT_OPTIONS) {
  const { session } = useCustomer();
  const { repository, state, hydrated } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const lines = useMemo(() => checkoutLines(cart, state.products), [cart, state.products]);
  const delivery = needsDelivery(lines);
  const country = store ? storeCountry(store) : "GB";
  const estimatedSubtotal = lines.reduce((sum, line) => sum + line.lineMinor, 0);

  const [details, setDetails] = useState<CheckoutDetails>(() => ({ ...EMPTY_DETAILS, email: session?.user.email ?? "" }));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [section, setSection] = useState<CheckoutSection>("contact");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<CheckoutProblem | null>(null);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  /** The code the shopper applied; the server works out every discount (this code plus automatic ones). */
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountPending, setDiscountPending] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [remember, setRemember] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);
  const step: CheckoutStep = section === "payment" && prepared ? "payment" : "details";
  const token = session?.user.email_confirmed_at ? session.access_token : undefined;
  const commerceApi = () => createCommerceApi({ token, baseUrl: API_URL });
  const items = useMemo(() => bagItems(lines), [lines]);
  // Email only counts once it looks complete (discounts for chosen customers), so typing it doesn't send a request per key.
  const discountEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email.trim()) ? details.email.trim() : undefined;
  const bag = useBagDiscounts({ storeId: store?.id, currency: store?.currency, items, code: appliedCode, email: discountEmail, enabled: step === "details", token });
  const discount = bag.preview;

  // The applied code stopped working for this bag (items changed, used up): drop it and say why next to the field.
  useEffect(() => {
    if (!bag.codeProblem) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's answer about the bag
    setAppliedCode(null);
    setDiscountError(bag.codeProblem);
  }, [bag.codeProblem]);

  // A returning shopper's saved details fill the form once, after the page has loaded in the browser.
  useEffect(() => {
    const saved = readSavedDetails(storeSlug);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser's own storage after hydration
    setDetails((current) => ({ ...saved, email: current.email || saved.email, note: current.note }));
    setRemember(true);
    setUsingSaved(true);
  }, [storeSlug]);

  /** Asks the server what a code takes off this bag; the order checks it again. */
  async function applyDiscount(raw: string): Promise<boolean> {
    const code = raw.trim();
    if (!store || !cart || !code || discountPending) return false;
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) { setDiscountError("This code isn't valid."); return false; }
    setDiscountPending(true);
    setDiscountError("");
    try {
      const result = await commerceApi().checkDiscount(store.id, { code, currency: store.currency.toUpperCase(), items, ...(details.email.trim() ? { email: details.email.trim() } : {}) });
      setAppliedCode(result.code ?? code.toUpperCase());
      return true;
    } catch (error) {
      // An older server has no discount route at all.
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 0;
      setDiscountError(status === 404 ? "Discount codes can't be used in this shop yet." : checkoutProblem(error).message);
      return false;
    } finally {
      setDiscountPending(false);
    }
  }

  function removeDiscount() {
    setAppliedCode(null);
    setDiscountError("");
  }

  const setField = useCallback((field: CheckoutField, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  /** Checks one field when the shopper leaves it, once they have typed something (empty fields wait for Continue). */
  function checkField(field: CheckoutField) {
    if (!details[field].trim()) return;
    const message = validateDetails(details, delivery, country, options)[field];
    setFieldErrors((current) => (current[field] === message ? current : { ...current, [field]: message }));
  }

  /** "Continue" on the contact card: checks its fields, then opens delivery (or prices the order when nothing ships). */
  async function continueFromContact(): Promise<CheckoutField | null> {
    const problems = problemsFor(validateDetails(details, delivery, country, options), CONTACT_FIELDS);
    setFieldErrors(problems);
    const first = (Object.keys(problems) as CheckoutField[])[0];
    if (first) return first;
    if (delivery) { setSection("delivery"); return null; }
    return continueToPayment();
  }

  /** Checks every detail, then asks the server for the price and a PaymentIntent. Returns the first bad field, if any. */
  async function continueToPayment(): Promise<CheckoutField | null> {
    if (!store || !cart || pending) return null;
    const problems = validateDetails(details, delivery, country, options);
    setFieldErrors(problems);
    const first = (Object.keys(problems) as CheckoutField[])[0];
    if (first) {
      if (CONTACT_FIELDS.includes(first)) setSection("contact");
      return first;
    }
    setPending(true);
    setProblem(null);
    try {
      const api = commerceApi();
      const attempt = await api.createAttempt(store.id, attemptInput(cart, lines, details, delivery, store, appliedCode ?? undefined));
      const payment = await api.preparePayment(store.id, attempt.attemptId);
      if (remember) saveDetails(storeSlug, details); else forgetDetails(storeSlug);
      setPrepared(payment);
      setSection("payment");
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code.startsWith("DISCOUNT_")) {
        // The code stopped working since it was applied (used up, expired): drop it and say why next to the field.
        setAppliedCode(null);
        setDiscountError(checkoutProblem(error).message);
      }
      setProblem(checkoutProblem(error));
    } finally {
      setPending(false);
    }
    return null;
  }

  /** Reopens a finished card. The next Continue makes a fresh attempt; the server cancels the old one. */
  function editSection(target: Exclude<CheckoutSection, "payment">) {
    setPrepared(null);
    setProblem(null);
    setSection(target);
  }

  function forgetSaved() {
    forgetDetails(storeSlug);
    setRemember(false);
    setUsingSaved(false);
    setDetails((current) => ({ ...EMPTY_DETAILS, email: session?.user.email ?? "", note: current.note }));
  }

  /** Empties the bag once Stripe says the payment went through. */
  function clearBag() {
    if (!cart) return;
    for (const item of cart.items) {
      try { repository.updateCartItem(cart.id, item.variantId, 0, item.configurationSelections, undefined, item.personalisation); } catch { /* line already gone */ }
    }
  }

  return {
    ready: hydrated,
    store, cart, lines, delivery, country, estimatedSubtotal, options,
    details, setField, checkField, fieldErrors,
    section, step, pending, problem, prepared,
    discount, appliedCode, discountPending, discountUpdating: bag.pending, discountError, applyDiscount, removeDiscount,
    remember, setRemember, usingSaved, forgetSaved, signedIn: Boolean(session),
    continueFromContact, continueToPayment, editSection, editDetails: () => editSection("contact"), clearBag,
  };
}

export type CheckoutController = ReturnType<typeof useCheckout>;
