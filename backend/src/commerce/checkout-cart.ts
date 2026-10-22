import { createHash } from "node:crypto";
import { z } from "zod";

import type { CatalogReader } from "../catalog/service.js";
import { ApiError } from "../http/errors.js";

import type { CommerceRepository } from "./repository.js";
import type { BeginCheckoutInput } from "./types.js";

export const checkoutInputSchema = z.object({
  storeId: z.string().min(1),
  cartKey: z.string().min(1),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
        configurationSelections: z.array(z.object({ optionId: z.string().min(1), valueId: z.string().min(1) })).max(20).optional(),
      }),
    )
    .min(1).max(50),
  customerSnapshot: z.record(
    z.string(),
    z.unknown(),
  ),
  deliverySnapshot: z
    .record(z.string(), z.unknown())
    .optional(),
});

export interface ValidatedLine {
  variantId: string;
  quantity: number;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  productTitleSnapshot: string | null;
  variantTitleSnapshot: string;
  fulfillmentType: "PHYSICAL" | "DIGITAL";
  unitPriceMinor: number;
  configurationSnapshot: Array<{ optionId: string; valueId: string; optionName: string; valueLabel: string; priceAdjustmentMinor: number }>;
  configurationKey: string;
}

export interface ValidatedCart {
  lines: ValidatedLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  cartHash: string;
}

export interface CartValidationDeps {
  repository: CommerceRepository;
  catalog: CatalogReader;
  enhancedSnapshots?: boolean;
}

function createCartHash(
  currency: string,
  shippingMinor: number,
  lines: ValidatedLine[],
): string {
  const items = lines
    .map(
      (line) =>
        JSON.stringify([line.variantId, line.quantity, line.unitPriceMinor, line.configurationKey]),
    )
    .sort();

  const value = [
    currency,
    shippingMinor,
    items.join("|"),
  ].join(":");

  return createHash("sha256")
    .update(value)
    .digest("hex");
}

/** Re-prices every line from the catalog and returns the server-authoritative cart. */
export async function validateCart(
  deps: CartValidationDeps,
  storeId: string,
  currency: string,
  items: BeginCheckoutInput["items"],
  shippingMinor: number,
): Promise<ValidatedCart> {
  const lines = await Promise.all(
    items.map(async (item) => {
      const variant =
        await deps.catalog.getVariant(
          storeId,
          item.variantId,
        );

      if (!variant) {
        throw new ApiError(
          422,
          "CHECKOUT_INPUT_INVALID",
          `Variant not found: ${item.variantId}`,
        );
      }

      if (!variant.available) {
        throw new ApiError(
          409,
          "OUT_OF_STOCK",
          `Variant out of stock: ${item.variantId}`,
        );
      }

      const product = await deps.catalog.getProduct(storeId, variant.productId);
      const fulfillmentType = (product as { fulfillmentType?: string } | null)?.fulfillmentType === "DIGITAL" ? "DIGITAL" as const : "PHYSICAL" as const;
      if (fulfillmentType === "DIGITAL" && deps.enhancedSnapshots) {
        const assets = await deps.repository.transaction((tx) => tx.query('SELECT "id" FROM "DigitalAsset" WHERE "storeId"=$1 AND "productId"=$2 AND "archivedAt" IS NULL LIMIT 1', [storeId, variant.productId]));
        if (!assets.rows.length) throw new ApiError(409, "DIGITAL_FILE_UNAVAILABLE", "This digital product is not ready for purchase.");
      }
      const productOptions = (product?.options ?? []) as Array<{ id: string; name: string; type?: string; required?: boolean; values?: Array<{ id: string; label: string; priceAdjustmentMinor?: number; priceAdjustment?: number }> }>;
      const selections = item.configurationSelections ?? [];
      const selectedOptionIds = new Set<string>();
      const snapshot = selections.map((selection) => {
        const option = productOptions.find((candidate) => candidate.id === selection.optionId);
        const value = option?.values?.find((candidate) => candidate.id === selection.valueId);
        if (!option || !value) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Invalid product configuration: ${selection.optionId}`);
        if (selectedOptionIds.has(option.id)) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Duplicate product configuration: ${option.id}`);
        selectedOptionIds.add(option.id);
        if (option.type === "variant" && variant.options[option.id] !== value.id) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "Configuration does not match the selected variant.");
        const priceAdjustmentMinor = Number.isFinite(value.priceAdjustmentMinor) ? Number(value.priceAdjustmentMinor) : Number.isFinite(value.priceAdjustment) ? Math.round(Number(value.priceAdjustment) * 100) : 0;
        return { optionId: option.id, valueId: value.id, optionName: option.name, valueLabel: value.label, priceAdjustmentMinor };
      });
      for (const option of productOptions) {
        if (option.required && !selectedOptionIds.has(option.id)) {
          throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Missing required product configuration: ${option.id}`);
        }
      }
      const unitPriceMinor = variant.priceMinor + snapshot.filter((selection) => productOptions.find((option) => option.id === selection.optionId)?.type !== "variant").reduce((total, selection) => total + selection.priceAdjustmentMinor, 0);
      if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new ApiError(422, "CHECKOUT_PRICE_INVALID", "This product's price requires review.");
      return {
        variantId: variant.id,
        quantity: item.quantity,
        titleSnapshot: product?.title && product.title !== variant.title ? `${product.title} — ${variant.title}` : variant.title,
        skuSnapshot: variant.sku,
        imageSnapshot: product?.media?.[0]?.url ?? null,
        productTitleSnapshot: product?.title ?? null,
        variantTitleSnapshot: variant.title,
        fulfillmentType,
        unitPriceMinor,
        configurationSnapshot: snapshot,
        configurationKey: snapshot.map((selection) => `${selection.optionId}:${selection.valueId}`).sort().join("|"),
      };
    }),
  );

  const subtotalMinor = lines.reduce(
    (total, line) =>
      total +
      line.unitPriceMinor *
        line.quantity,
    0,
  );

  if (lines.every((line) => line.fulfillmentType === "DIGITAL")) shippingMinor = 0;
  const totalMinor = subtotalMinor + shippingMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new ApiError(422, "CHECKOUT_PRICE_INVALID", "The checkout total is invalid.");

  return {
    lines,
    subtotalMinor,
    shippingMinor,
    totalMinor,
    cartHash: createCartHash(
      currency,
      shippingMinor,
      lines,
    ),
  };
}
