import type {
  DynamicBinding,
  DynamicResourceType,
  SettingValue,
} from "@jelly/storefront-schema";
import type { CatalogCollection, CatalogProduct, CatalogVariant } from "../catalog/types.js";
import type { ArticleRecord, BlogRecord, PageRecord } from "../content/repository.js";
import type {
  CustomDataRepository,
  MetaobjectRepository,
  MetafieldDefinitionRecord,
} from "../custom-data/repository.js";

export interface RuntimeValueContext {
  store?: { id: string; name: string };
  product?: CatalogProduct;
  variant?: CatalogVariant;
  collection?: CatalogCollection;
  page?: PageRecord;
  blog?: BlogRecord;
  article?: ArticleRecord;
  currency?: string;
}

interface ResolvedValue {
  value: unknown;
  metaobjectDefinitionId?: string;
}

function ownerId(storeId: string, resource: DynamicResourceType, context: RuntimeValueContext): string | null {
  switch (resource) {
    case "store": return storeId;
    case "product": return context.product?.id ?? null;
    case "variant": return context.variant?.id ?? null;
    case "collection": return context.collection?.id ?? null;
    case "page": return context.page?.id ?? null;
    case "blog": return context.blog?.id ?? null;
    case "article": return context.article?.id ?? null;
  }
}

function resourceField(
  resource: DynamicResourceType,
  field: string,
  context: RuntimeValueContext,
): unknown {
  switch (resource) {
    case "store":
      return field === "name" ? context.store?.name ?? null : null;
    case "product":
      switch (field) {
        case "title": return context.product?.title ?? null;
        case "description": return context.product?.description ?? null;
        case "vendor": return context.product?.vendor ?? null;
        case "productType": return context.product?.productType ?? null;
        case "featuredImage": return context.product?.media[0]?.id ?? null;
        default: return null;
      }
    case "variant":
      switch (field) {
        case "sku": return context.variant?.sku ?? null;
        case "price": {
          if (!context.variant) return null;
          const currency = context.currency ?? context.product?.priceRange?.currency;
          return currency ? { amountMinor: context.variant.priceMinor, currency } : null;
        }
        default: return null;
      }
    case "collection":
      if (field === "title") return context.collection?.title ?? null;
      if (field === "description") return context.collection?.description ?? null;
      return null;
    case "page":
      return field === "title" ? context.page?.title ?? null : null;
    case "blog":
      return field === "title" ? context.blog?.title ?? null : null;
    case "article":
      if (field === "title") return context.article?.title ?? null;
      if (field === "content") return context.article?.content ?? null;
      return null;
  }
}

function metaobjectDefinitionId(definition: { validations?: Record<string, unknown> }): string | undefined {
  const value = definition.validations?.metaobjectDefinitionId;
  return typeof value === "string" && value ? value : undefined;
}

export class DynamicValueResolver {
  constructor(
    private readonly customData: Pick<
      CustomDataRepository,
      "listMetafieldDefinitions" | "getMetafieldValue"
    >,
    private readonly metaobjects: Pick<
      MetaobjectRepository,
      "getMetaobjectDefinition" | "getMetaobjectEntry"
    >,
  ) {}

  async resolve(
    storeId: string,
    binding: DynamicBinding,
    context: RuntimeValueContext,
  ): Promise<unknown> {
    return (await this.resolveDetailed(storeId, binding, context)).value;
  }

  private async resolveDetailed(
    storeId: string,
    binding: DynamicBinding,
    context: RuntimeValueContext,
  ): Promise<ResolvedValue> {
    if (binding.kind === "resource_field") {
      return { value: resourceField(binding.resource, binding.field, context) };
    }

    if (binding.kind === "metafield") {
      const id = ownerId(storeId, binding.resource, context);
      if (!id) return { value: null };
      const definitions = await this.customData.listMetafieldDefinitions(storeId, binding.resource);
      const definition = definitions.find((candidate) =>
        candidate.namespace === binding.namespace && candidate.key === binding.key,
      );
      if (!definition || !definition.storefrontVisible || definition.archivedAt) return { value: null };
      const record = await this.customData.getMetafieldValue(storeId, definition.id, id);
      if (!record) return { value: null };
      return {
        value: record.value,
        ...(definition.type === "metaobject_reference" && metaobjectDefinitionId(definition)
          ? { metaobjectDefinitionId: metaobjectDefinitionId(definition) }
          : {}),
      };
    }

    const source = await this.resolveDetailed(storeId, binding.source, context);
    if (typeof source.value !== "string" || !source.metaobjectDefinitionId) return { value: null };
    const definition = await this.metaobjects.getMetaobjectDefinition(storeId, source.metaobjectDefinitionId);
    if (!definition || definition.archivedAt || !definition.storefrontVisible) return { value: null };
    const entry = await this.metaobjects.getMetaobjectEntry(storeId, source.value);
    if (!entry || entry.archivedAt || entry.definitionId !== definition.id) return { value: null };
    const field = definition.fields.find(({ handle }) => handle === binding.field);
    if (!field || !field.storefrontVisible) return { value: null };
    const value = entry.values[binding.field] ?? null;
    const nextDefinitionId = field.type === "metaobject_reference"
      ? metaobjectDefinitionId(field)
      : undefined;
    return {
      value,
      ...(nextDefinitionId ? { metaobjectDefinitionId: nextDefinitionId } : {}),
    };
  }
}

export async function resolveSettingValue<T>(
  resolver: DynamicValueResolver,
  storeId: string,
  setting: SettingValue<T>,
  context: RuntimeValueContext,
  defaultValue?: T,
): Promise<T | null> {
  if (setting.kind === "static") return setting.value;
  const value = await resolver.resolve(storeId, setting.binding, context);
  if (value !== null && value !== undefined) return value as T;
  if (setting.fallback !== undefined) return setting.fallback;
  if (defaultValue !== undefined) return defaultValue;
  return null;
}
