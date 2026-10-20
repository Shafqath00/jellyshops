import { templateTypes, type TemplateType } from "./repositories/template-repository.js";

/** Converts public V4 page-type handles into the stable PostgreSQL enum spelling. */
export function toStorefrontTemplateEnumValue(type: TemplateType): string {
  return type.replaceAll("-", "_").toUpperCase();
}

export function fromStorefrontTemplateEnumValue(value: string): TemplateType {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  if ((templateTypes as readonly string[]).includes(normalized)) return normalized as TemplateType;
  throw new Error(`Unsupported StorefrontTemplateType enum value: ${value}`);
}
