"use client";

import { useEffect, useRef } from "react";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import { resolveProductVariant } from "@/lib/product-configuration";

/**
 * The chosen variant lives in the address as `?variant=<id>` (as on Shopify), so a link from an ad, an email or a
 * friend opens the product with that size or colour already chosen, and a refresh keeps it.
 */

/** The choices that pick out the variant named in `search`, or null when it names none of this product's variants. */
export function selectionsForVariant(product: Pick<Product, "variants" | "inventoryOptionIds">, search: string): ConfiguredOptionSelection[] | null {
  const id = new URLSearchParams(search).get("variant");
  if (!id) return null;
  const variant = product.variants.find((candidate) => candidate.id === id);
  if (!variant) return null;
  const inventory = product.inventoryOptionIds ?? [];
  const selections = inventory.flatMap((optionId) => {
    const valueId = variant.options?.[optionId];
    return typeof valueId === "string" ? [{ optionId, valueId }] : [];
  });
  return selections.length === inventory.length && selections.length > 0 ? selections : null;
}

/** The address with `?variant=` set to `variantId` (or removed), keeping every other part. */
export function addressWithVariant(href: string, variantId: string | undefined): string {
  const url = new URL(href);
  if (variantId) url.searchParams.set("variant", variantId);
  else url.searchParams.delete("variant");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Reads the variant from the address once the product is known, then keeps the address in step with the choices. */
export function useVariantAddress(product: Product | undefined, selections: ConfiguredOptionSelection[], setSelections: (selections: ConfiguredOptionSelection[]) => void): void {
  const readFor = useRef<string | null>(null);
  useEffect(() => {
    if (!product || readFor.current === product.id) return;
    readFor.current = product.id;
    const fromAddress = selectionsForVariant(product, window.location.search);
    if (fromAddress) setSelections(fromAddress);
  }, [product, setSelections]);
  const variantId = product && (product.inventoryOptionIds?.length ?? 0) > 0 ? resolveProductVariant(product, selections)?.id : undefined;
  useEffect(() => {
    // Wait until the address has been read, so the first (empty) choice does not wipe a shared link.
    if (!product || readFor.current !== product.id || (product.inventoryOptionIds?.length ?? 0) === 0) return;
    const next = addressWithVariant(window.location.href, variantId);
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [product, variantId]);
}
