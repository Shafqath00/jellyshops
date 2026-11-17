"use client";

import { useCallback, useMemo, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { DiscountPreview, PreparedPayment } from "@/features/commerce/api/types";
import { useCustomer } from "@/features/customers/providers/customer-provider";
import { checkoutProblem, type CheckoutProblem } from "./checkout-errors";
import {
  attemptInput, checkoutLines, EMPTY_DETAILS, needsDelivery, storeCountry, validateDetails,
  type CheckoutDetails, type CheckoutField,
} from "./checkout-model";

export type CheckoutStep = "details" | "payment";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

/**
 * Everything the checkout page needs, kept apart from how it looks:
 * bag lines, the shopper's details, the step, and preparing the payment on the server.
 */
export function useCheckout(storeSlug: string) {
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
  const [step, setStep] = useState<CheckoutStep>("details");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<CheckoutProblem | null>(null);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const [discountPending, setDiscountPending] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const commerceApi = () => createCommerceApi({ token: session?.user.email_confirmed_at ? session.access_token : undefined, baseUrl: API_URL });

  /** Asks the server what a code takes off this bag; the order checks it again. */
  async function applyDiscount(raw: string): Promise<boolean> {
    const code = raw.trim();
    if (!store || !cart || !code || discountPending) return false;
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) { setDiscountError("This code isn't valid."); return false; }
    setDiscountPending(true);
    setDiscountError("");
    try {
      const { items } = attemptInput(cart, lines, details, delivery, store);
      setDiscount(await commerceApi().checkDiscount(store.id, { code, currency: store.currency.toUpperCase(), items, ...(details.email.trim() ? { email: details.email.trim() } : {}) }));
      return true;
    } catch (error) {
      setDiscount(null);
      // An older server has no discount route at all.
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 0;
      setDiscountError(status === 404 ? "Discount codes can't be used in this shop yet." : checkoutProblem(error).message);
      return false;
    } finally {
      setDiscountPending(false);
    }
  }

  function removeDiscount() {
    setDiscount(null);
    setDiscountError("");
  }

  const setField = useCallback((field: CheckoutField, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  /** Checks the details, then asks the server for the price and a PaymentIntent. Returns the first bad field, if any. */
  async function continueToPayment(): Promise<CheckoutField | null> {
    if (!store || !cart || pending) return null;
    const problems = validateDetails(details, delivery, country);
    setFieldErrors(problems);
    const first = (Object.keys(problems) as CheckoutField[])[0];
    if (first) return first;
    setPending(true);
    setProblem(null);
    try {
      const api = commerceApi();
      const attempt = await api.createAttempt(store.id, attemptInput(cart, lines, details, delivery, store, discount?.code));
      const payment = await api.preparePayment(store.id, attempt.attemptId);
      setPrepared(payment);
      setStep("payment");
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code.startsWith("DISCOUNT_")) {
        // The code stopped working since it was applied (used up, expired): drop it and say why next to the field.
        setDiscount(null);
        setDiscountError(checkoutProblem(error).message);
      }
      setProblem(checkoutProblem(error));
    } finally {
      setPending(false);
    }
    return null;
  }

  function editDetails() {
    // The next Continue makes a fresh attempt; the server cancels the old one.
    setPrepared(null);
    setProblem(null);
    setStep("details");
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
    store, cart, lines, delivery, country, estimatedSubtotal,
    details, setField, fieldErrors,
    step, pending, problem, prepared,
    discount, discountPending, discountError, applyDiscount, removeDiscount,
    continueToPayment, editDetails, clearBag,
  };
}

export type CheckoutController = ReturnType<typeof useCheckout>;
