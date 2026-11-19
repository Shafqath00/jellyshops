"use client";

import { useEffect, useRef } from "react";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import { resolveProductVariant } from "@/lib/product-configuration";
import { isVariantBuyable } from "@/lib/variant-stock";

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

/**
 * The choices the merchant marked "Selected when the page opens" (option value `isDefault`), one per single-choice
 * option. Paid extras (several allowed) never start ticked. When the default stock choices point to a size that
 * cannot be bought, they are left out, so the page shows "From £X" and the shopper chooses.
 */
export function defaultSelections(product: Pick<Product, "options" | "variants" | "inventoryOptionIds">): ConfiguredOptionSelection[] {
  const picks = (product.options ?? []).flatMap((option) => {
    if (option.multiple) return [];
    const value = option.values.find((candidate) => candidate.isDefault);
    return value ? [{ optionId: option.id, valueId: value.id }] : [];
  });
  const inventory = product.inventoryOptionIds ?? [];
  const stockPicks = picks.filter((pick) => inventory.includes(pick.optionId));
  if (inventory.length > 0 && stockPicks.length === inventory.length) {
    const variant = resolveProductVariant(product as Product, picks);
    if (!variant || variant.sellable === false || !isVariantBuyable(variant)) return picks.filter((pick) => !inventory.includes(pick.optionId));
  }
  return picks;
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
    // A shared link wins; otherwise the merchant's "Selected when the page opens" choices.
    const fromAddress = selectionsForVariant(product, window.location.search);
    const start = fromAddress ?? defaultSelections(product);
    if (start.length) setSelections(start);
  }, [product, setSelections]);
  const variantId = product && (product.inventoryOptionIds?.length ?? 0) > 0 ? resolveProductVariant(product, selections)?.id : undefined;
  useEffect(() => {
    // Wait until the address has been read, so the first (empty) choice does not wipe a shared link.
    if (!product || readFor.current !== product.id || (product.inventoryOptionIds?.length ?? 0) === 0) return;
    const next = addressWithVariant(window.location.href, variantId);
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [product, variantId]);
}
