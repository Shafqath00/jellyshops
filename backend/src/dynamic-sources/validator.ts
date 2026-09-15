import type { DynamicBinding, DynamicValueType } from "@jelly/storefront-schema";
import { isDynamicValueTypeCompatible } from "@jelly/storefront-schema";
import type { DynamicSourceDescriptor, DynamicSourceRegistry, TemplateContext } from "./registry.js";

export async function validateDynamicBinding(
  registry: DynamicSourceRegistry,
  storeId: string,
  binding: DynamicBinding,
  expectedType: DynamicValueType,
  context: TemplateContext,
): Promise<DynamicSourceDescriptor> {
  const descriptor = await registry.describeBinding(storeId, binding, context);
  if (!isDynamicValueTypeCompatible(expectedType, descriptor.valueType)) {
    throw new Error(
      `Dynamic source type ${descriptor.valueType} is incompatible with required ${expectedType}`,
    );
  }
  if (descriptor.requiredContext !== "any" && descriptor.requiredContext !== context) {
    throw new Error(
      `Dynamic source requires ${descriptor.requiredContext} context and cannot be used in ${context} context`,
    );
  }
  return descriptor;
}
