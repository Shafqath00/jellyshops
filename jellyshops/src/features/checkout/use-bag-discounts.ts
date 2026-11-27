"use client";

import { useEffect, useMemo, useState } from "react";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { CommerceAttemptInput, DiscountPreview } from "@/features/commerce/api/types";
import { checkoutProblem } from "./checkout-errors";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export interface BagDiscountsInput {
  storeId: string | undefined;
  currency: string | undefined;
  items: CommerceAttemptInput["items"];
  /** The code the shopper applied, if any. */
  code: string | null;
  email?: string;
  /** Off while the payment is being taken (the order's discounts are fixed then). */
  enabled?: boolean;
  token?: string;
}

export interface BagDiscountsState {
  preview: DiscountPreview | null;
  /** Set when the applied code stopped working for this bag (the caller drops it). */
  codeProblem: string | null;
  pending: boolean;
}

/**
 * Asks the server which discounts this bag gets: the shop's automatic discounts plus the applied code. Runs again
 * (after a short pause) whenever the bag, the email or the code changes. A shop whose server has no discount check
 * yet simply shows no discounts.
 */
export function useBagDiscounts({ storeId, currency, items, code, email, enabled = true, token }: BagDiscountsInput): BagDiscountsState {
  const key = useMemo(() => JSON.stringify([storeId, currency, items, code, email?.trim().toLowerCase() ?? "", enabled]), [storeId, currency, items, code, email, enabled]);
  const [state, setState] = useState<BagDiscountsState & { key: string }>({ key: "", preview: null, codeProblem: null, pending: false });

  useEffect(() => {
    // Everything the request needs is in the key, so a new array with the same bag doesn't start a new request.
    const [storeId, currency, items, code, email, enabled] = JSON.parse(key) as [string | undefined, string | undefined, CommerceAttemptInput["items"], string | null, string, boolean];
    if (!storeId || !currency || !items.length || !enabled) return;
    let current = true;
    const timer = setTimeout(async () => {
      setState((previous) => ({ ...previous, pending: true }));
      try {
        const api = createCommerceApi({ token, baseUrl: API_URL });
        const preview = await api.checkDiscount(storeId, { currency: currency.toUpperCase(), items, ...(code ? { code } : {}), ...(email ? { email } : {}) });
        if (current) setState({ key, preview, codeProblem: null, pending: false });
      } catch (error) {
        if (!current) return;
        const codeError = Boolean(code) && typeof error === "object" && error !== null && String((error as { code?: unknown }).code ?? "").startsWith("DISCOUNT_");
        setState({ key, preview: null, codeProblem: codeError ? checkoutProblem(error).message : null, pending: false });
      }
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [key, token]);

  if (!storeId || !items.length || !enabled) return { preview: null, codeProblem: null, pending: false };
  // While the bag is being checked again the last answer stays on screen (marked pending), so totals don't flicker.
  if (state.key !== key) return { preview: state.preview, codeProblem: null, pending: true };
  return state;
}
