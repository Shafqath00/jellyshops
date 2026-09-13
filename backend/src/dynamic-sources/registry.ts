import type {
  DynamicBinding,
  DynamicResourceType,
  DynamicValueType,
} from "@jelly/storefront-schema";
import type { CustomDataRepository, MetaobjectRepository } from "../custom-data/repository.js";

export type TemplateContext = "home" | "product" | "collection" | "page" | "blog" | "article" | "search" | "cart";

export interface DynamicSourceDescriptor {
  id: string;
  label: string;
  valueType: DynamicValueType;
  requiredContext: TemplateContext | "any";
  binding: DynamicBinding;
  metaobjectDefinitionId?: string;
}

const fixedSources: DynamicSourceDescriptor[] = [
  { id: "resource:store:name", label: "Store name", valueType: "string", requiredContext: "any", binding: { kind: "resource_field", resource: "store", field: "name" } },
  { id: "resource:product:title", label: "Product title", valueType: "string", requiredContext: "product", binding: { kind: "resource_field", resource: "product", field: "title" } },
  { id: "resource:product:description", label: "Product description", valueType: "rich_text", requiredContext: "product", binding: { kind: "resource_field", resource: "product", field: "description" } },
  { id: "resource:product:vendor", label: "Product vendor", valueType: "string", requiredContext: "product", binding: { kind: "resource_field", resource: "product", field: "vendor" } },
  { id: "resource:product:productType", label: "Product type", valueType: "string", requiredContext: "product", binding: { kind: "resource_field", resource: "product", field: "productType" } },
  { id: "resource:product:featuredImage", label: "Product featured image", valueType: "image", requiredContext: "product", binding: { kind: "resource_field", resource: "product", field: "featuredImage" } },
  { id: "resource:variant:price", label: "Selected variant price", valueType: "money", requiredContext: "product", binding: { kind: "resource_field", resource: "variant", field: "price" } },
  { id: "resource:variant:sku", label: "Selected variant SKU", valueType: "string", requiredContext: "product", binding: { kind: "resource_field", resource: "variant", field: "sku" } },
  { id: "resource:collection:title", label: "Collection title", valueType: "string", requiredContext: "collection", binding: { kind: "resource_field", resource: "collection", field: "title" } },
  { id: "resource:collection:description", label: "Collection description", valueType: "rich_text", requiredContext: "collection", binding: { kind: "resource_field", resource: "collection", field: "description" } },
  { id: "resource:page:title", label: "Page title", valueType: "string", requiredContext: "page", binding: { kind: "resource_field", resource: "page", field: "title" } },
  { id: "resource:blog:title", label: "Blog title", valueType: "string", requiredContext: "blog", binding: { kind: "resource_field", resource: "blog", field: "title" } },
  { id: "resource:article:title", label: "Article title", valueType: "string", requiredContext: "article", binding: { kind: "resource_field", resource: "article", field: "title" } },
  { id: "resource:article:content", label: "Article content", valueType: "rich_text", requiredContext: "article", binding: { kind: "resource_field", resource: "article", field: "content" } },
];

function resourceContext(resource: DynamicResourceType): TemplateContext | "any" {
  if (resource === "store") return "any";
  if (resource === "variant") return "product";
  return resource;
}

function contextResource(context: TemplateContext): DynamicResourceType | null {
  return ["product", "collection", "page", "blog", "article"].includes(context)
    ? context as DynamicResourceType
    : null;
}

function bindingKey(binding: DynamicBinding): string {
  switch (binding.kind) {
    case "resource_field": return `resource:${binding.resource}:${binding.field}`;
    case "metafield": return `metafield:${binding.resource}:${binding.namespace}.${binding.key}`;
    case "metaobject_field": return `${bindingKey(binding.source)}.${binding.field}`;
  }
}

export class DynamicSourceRegistry {
  constructor(
    private readonly customData: Pick<CustomDataRepository, "listMetafieldDefinitions">,
    private readonly metaobjects: Pick<MetaobjectRepository, "getMetaobjectDefinition">,
  ) {}

  async listDynamicSources(
    storeId: string,
    context: TemplateContext,
    acceptedTypes?: DynamicValueType[],
  ): Promise<DynamicSourceDescriptor[]> {
    const sources = fixedSources.filter((source) => source.requiredContext === "any" || source.requiredContext === context);
    const owners: DynamicResourceType[] = ["store"];
    const contextual = contextResource(context);
    if (contextual) owners.push(contextual);
    if (context === "product") owners.push("variant");

    for (const ownerType of owners) {
      const definitions = await this.customData.listMetafieldDefinitions(storeId, ownerType);
      for (const definition of definitions) {
        if (!definition.storefrontVisible || definition.archivedAt) continue;
        const binding: DynamicBinding = {
          kind: "metafield",
          resource: ownerType,
          namespace: definition.namespace,
          key: definition.key,
        };
        const id = bindingKey(binding);
        const requiredContext = resourceContext(ownerType);
        const metaobjectDefinitionId = definition.type === "metaobject_reference"
          && typeof definition.validations?.metaobjectDefinitionId === "string"
          ? definition.validations.metaobjectDefinitionId
          : undefined;

        sources.push({
          id,
          label: definition.name,
          valueType: definition.type,
          requiredContext,
          binding,
          ...(metaobjectDefinitionId ? { metaobjectDefinitionId } : {}),
        });

        if (metaobjectDefinitionId) {
          const metaobject = await this.metaobjects.getMetaobjectDefinition(storeId, metaobjectDefinitionId);
          if (metaobject && !metaobject.archivedAt && metaobject.storefrontVisible) {
            for (const field of metaobject.fields) {
              if (!field.storefrontVisible) continue;
              sources.push({
                id: `${id}.${field.handle}`,
                label: `${definition.name} → ${field.name}`,
                valueType: field.type,
                requiredContext,
                binding: { kind: "metaobject_field", source: binding, field: field.handle },
              });
            }
          }
        }
      }
    }

    return acceptedTypes ? sources.filter(({ valueType }) => acceptedTypes.includes(valueType)) : sources;
  }

  async describeBinding(
    storeId: string,
    binding: DynamicBinding,
    context: TemplateContext,
  ): Promise<DynamicSourceDescriptor> {
    const key = bindingKey(binding);
    const found = (await this.listDynamicSources(storeId, context)).find(({ id }) => id === key);
    if (!found) throw new Error("Dynamic source is unavailable or not storefront visible in this template context");
    return found;
  }
}
