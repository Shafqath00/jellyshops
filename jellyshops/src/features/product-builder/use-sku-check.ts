"use client";
import { useEffect, useState } from "react";

/** The products that hold a stock code, as far as the check needs them. */
export interface SkuOwner { id: string; title: string; variants: Array<{ sku: string | null }> }
export type FindBySku = (sku: string) => Promise<SkuOwner[]>;

/** The message when another product already uses this stock code, else an empty string. */
export function skuTakenMessage(sku: string, products: SkuOwner[], currentProductId: string | null): string {
  const wanted = sku.trim().toLowerCase();
  if (!wanted) return "";
  const other = products.find((product) => product.id !== currentProductId && product.variants.some((variant) => (variant.sku ?? "").trim().toLowerCase() === wanted));
  return other ? `“${other.title}” already uses this stock code. Each item needs its own.` : "";
}

/**
 * Warns while the merchant types a stock code another product already has, instead of at save.
 * Waits until typing pauses; a failed lookup says nothing (saving still checks).
 */
export function useSkuCheck(sku: string, currentProductId: string | null, find: FindBySku | null, delayMs = 500): string {
  const [result, setResult] = useState<{ sku: string; message: string }>({ sku: "", message: "" });
  const wanted = sku.trim();
  useEffect(() => {
    if (!find || wanted.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      find(wanted).then((products) => { if (active) setResult({ sku: wanted, message: skuTakenMessage(wanted, products, currentProductId) }); })
        .catch(() => { if (active) setResult({ sku: wanted, message: "" }); });
    }, delayMs);
    return () => { active = false; window.clearTimeout(timer); };
  }, [wanted, currentProductId, find, delayMs]);
  // An answer for an earlier spelling is never shown against the current one.
  return result.sku === wanted ? result.message : "";
}
