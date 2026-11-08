import type { DynamicBinding } from "@jelly/storefront-schema";
import type { CatalogCollection, CatalogProduct } from "../catalog/types.js";
import type { ArticleRecord, BlogRecord, PageRecord } from "../content/repository.js";
import type { DynamicValueResolver, RuntimeValueContext } from "./resolver.js";

export const bindingResourceTypes = ["product", "collection", "page", "blog", "article"] as const;
export type BindingResourceType = typeof bindingResourceTypes[number];

/** Most bindings one page may ask for; a template with more is cut short rather than slowing every page view. */
export const MAX_BINDINGS_PER_REQUEST = 60;

export interface BindingValuesRequest {
  /** The product, collection, page, blog or blog post the page shows, if any. */
  resource?: { type: BindingResourceType; id: string };
  bindings: DynamicBinding[];
}

export interface ResolvedBindingValue {
  binding: DynamicBinding;
  /** Display-ready value: text, a number, `{ amountMinor, currency }`, `{ url, alt }` for an image, or a list of those. Null when there is nothing to show. */
  value: unknown;
}

/** Where the values come from. Every lookup is scoped to the store. */
export interface BindingValueSources {
  product(storeId: string, id: string): Promise<CatalogProduct | null>;
  collection(storeId: string, id: string): Promise<CatalogCollection | null>;
  page(storeId: string, id: string): Promise<PageRecord | null>;
  blog(storeId: string, id: string): Promise<BlogRecord | null>;
  article(storeId: string, id: string): Promise<ArticleRecord | null>;
  storeName(storeId: string): Promise<string | null>;
  media(storeId: string, id: string): Promise<{ url: string; alt?: string } | null>;
}

const mediaTypes = new Set(["image", "file"]);

/**
 * Resolves the custom-field and resource-field bindings a page's sections use,
 * for shoppers (published resources only) and for the editor preview (drafts
 * allowed). Only custom fields marked "visible on storefront" are ever returned;
 * the resolver enforces that.
 */
export class StorefrontBindingValueService {
  constructor(
    private readonly resolver: Pick<DynamicValueResolver, "resolveWithType">,
    private readonly sources: BindingValueSources,
  ) {}

  async resolve(storeId: string, request: BindingValuesRequest, options: { includeDrafts: boolean }): Promise<ResolvedBindingValue[]> {
    const bindings = uniqueBindings(request.bindings).slice(0, MAX_BINDINGS_PER_REQUEST);
    if (!bindings.length) return [];
    const context = await this.context(storeId, request.resource, options.includeDrafts);
    return Promise.all(bindings.map(async (binding) => {
      const { value, valueType } = await this.resolver.resolveWithType(storeId, binding, context);
      return { binding, value: await this.display(storeId, value, valueType) };
    }));
  }

  private async context(storeId: string, resource: BindingValuesRequest["resource"], includeDrafts: boolean): Promise<RuntimeValueContext> {
    const name = await this.sources.storeName(storeId);
    const context: RuntimeValueContext = name ? { store: { id: storeId, name } } : {};
    if (!resource) return context;
    switch (resource.type) {
      case "product": {
        const product = await this.sources.product(storeId, resource.id);
        if (!product || (!includeDrafts && product.status !== "ACTIVE")) return context;
        const variant = product.variants[0];
        return { ...context, product, ...(variant ? { variant } : {}), ...(product.priceRange?.currency ? { currency: product.priceRange.currency } : {}) };
      }
      case "collection": {
        const collection = await this.sources.collection(storeId, resource.id);
        return collection ? { ...context, collection } : context;
      }
      case "page": {
        const page = await this.sources.page(storeId, resource.id);
        return page && (includeDrafts || page.status === "PUBLISHED") ? { ...context, page } : context;
      }
      case "blog": {
        const blog = await this.sources.blog(storeId, resource.id);
        return blog ? { ...context, blog } : context;
      }
      case "article": {
        const article = await this.sources.article(storeId, resource.id);
        if (!article || (!includeDrafts && article.status !== "PUBLISHED")) return context;
        const blog = await this.sources.blog(storeId, article.blogId);
        return { ...context, article, ...(blog ? { blog } : {}) };
      }
    }
  }

  /** Media ids become `{ url, alt }`; everything else is returned as stored. */
  private async display(storeId: string, value: unknown, valueType: string | undefined): Promise<unknown> {
    if (value === undefined || value === null) return null;
    const scalarType = valueType?.startsWith("list:") ? valueType.slice(5) : valueType;
    if (!scalarType || !mediaTypes.has(scalarType)) return value;
    const one = async (id: unknown) => typeof id === "string" ? await this.sources.media(storeId, id) : null;
    if (Array.isArray(value)) return (await Promise.all(value.map(one))).filter((item) => item !== null);
    return one(value);
  }
}

function uniqueBindings(bindings: DynamicBinding[]): DynamicBinding[] {
  const seen = new Set<string>();
  return bindings.filter((binding) => {
    const key = JSON.stringify(binding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
