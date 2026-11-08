import { validateProductOptions, validateVariantCombinations, type OptionIssue, type ProductOptionLike } from "@jelly/storefront-schema";
import { z } from "zod";
import { ApiError } from "../http/errors.js";

const valueSchema = z.object({ id: z.string().min(1), label: z.string(), priceAdjustmentMinor: z.number().optional() }).passthrough();
const optionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(["variant", "configuration", "addon"]),
  required: z.boolean().optional().default(false),
  multiple: z.boolean().optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  visibleWhen: z.object({ optionId: z.string().min(1), valueIds: z.array(z.string()) }).optional(),
  values: z.array(valueSchema),
}).passthrough();

export interface ProductConfigurationInput {
  options?: unknown[];
  inventoryOptionIds?: string[];
  variants?: Array<{ id?: string; title: string; options?: Record<string, unknown> }>;
}

function fail(issues: OptionIssue[]): never {
  const errors = issues.filter((issue) => issue.severity === "error");
  throw new ApiError(422, "PRODUCT_CONFIGURATION_INVALID", errors[0].message, errors.map((issue) => ({ path: issue.optionId ?? issue.variantId ?? "options", message: issue.message })));
}

/**
 * Enforces the rules the product builder shows (3 stock-tracked choices, 100 combinations, no duplicate names,
 * valid conditions, variants that match the choices) so no client can bypass them.
 * `current` supplies what an update leaves unchanged.
 */
export function assertValidProductConfiguration(input: ProductConfigurationInput, current?: { options?: unknown[]; inventoryOptionIds?: string[] }): void {
  if (input.options === undefined && input.inventoryOptionIds === undefined && input.variants === undefined) return;
  const rawOptions = input.options ?? current?.options ?? [];
  const parsed = z.array(optionSchema).safeParse(rawOptions);
  if (!parsed.success) throw new ApiError(422, "PRODUCT_CONFIGURATION_INVALID", "The product options are not in a valid format.", parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  const options = parsed.data as ProductOptionLike[];
  const inventoryOptionIds = input.inventoryOptionIds ?? current?.inventoryOptionIds ?? [];
  const issues = [
    ...validateProductOptions(options, inventoryOptionIds),
    ...(input.variants ? validateVariantCombinations(options, inventoryOptionIds, input.variants.map((variant) => ({ id: variant.id, name: variant.title, options: variant.options }))) : []),
  ];
  if (issues.some((issue) => issue.severity === "error")) fail(issues);
}
