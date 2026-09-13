import type { ProductStatus } from "./types.js";

export interface ProviderVariantInput {
  externalId: string;
  title: string;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  options: Record<string, unknown>;
  trackInventory: boolean;
  quantity: number | null;
  reserved: number | null;
}

export interface ProviderProductInput {
  externalId: string;
  handle: string;
  title: string;
  description: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: ProductStatus;
  variants: ProviderVariantInput[];
}

export interface ProviderSyncResult {
  id: string;
  externalId: string;
}

export interface CatalogSyncWriter {
  upsertProviderProduct(storeId: string, input: ProviderProductInput): Promise<ProviderSyncResult>;
}

function requireExternalId(value: string, kind: string): void {
  if (!value.trim()) {
    throw new Error(`${kind} external id is required for provider synchronization`);
  }
}

function normalize(input: ProviderProductInput): ProviderProductInput {
  requireExternalId(input.externalId, "Product");
  for (const variant of input.variants) requireExternalId(variant.externalId, "Variant");
  return {
    ...input,
    externalId: input.externalId.trim(),
    handle: input.handle.trim(),
    title: input.title.trim(),
    tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
    variants: input.variants.map((variant) => ({
      ...variant,
      externalId: variant.externalId.trim(),
      title: variant.title.trim(),
      sku: variant.sku?.trim() || null,
    })),
  };
}

export class CatalogProviderSync {
  constructor(private readonly writer: CatalogSyncWriter) {}

  upsertProduct(storeId: string, input: ProviderProductInput): Promise<ProviderSyncResult> {
    return this.writer.upsertProviderProduct(storeId, normalize(input));
  }
}
