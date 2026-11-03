import type { BlockNode, DynamicBinding, RichTextDocument, SectionNode } from "@jelly/storefront-schema";
import { flattenBlocks, isRichTextDocument } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition } from "@jelly/storefront-registry";

/**
 * Section settings connected to a custom field are saved as
 * `{ kind: "dynamic", binding, fallback? }`, and a few as `{ kind: "static", value }`.
 * Renderers only read plain values, so every layout passes through
 * `applyBindingValues` before it is drawn: static values are unwrapped, dynamic
 * ones become the looked-up value (or the merchant's fallback), and anything
 * left empty is removed so the section's own default shows instead of a blank.
 */

export type BindingValues = ReadonlyMap<string, unknown>;

type Regions<K extends string = string> = Record<K, SectionNode[]>;

type DynamicSetting = { kind: "dynamic"; binding: DynamicBinding; fallback?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDynamic(value: unknown): value is DynamicSetting {
  return isRecord(value) && value.kind === "dynamic" && isRecord(value.binding) && typeof value.binding.kind === "string";
}

function isStatic(value: unknown): value is { kind: "static"; value: unknown } {
  return isRecord(value) && value.kind === "static" && "value" in value;
}

/** Same key for the same binding however its properties were ordered when saved. */
export function bindingKey(binding: DynamicBinding): string {
  const sorted = (value: unknown): unknown => isRecord(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value;
  return JSON.stringify(sorted(binding));
}

function nodes(layout: { [K in string]?: SectionNode[] }): Array<{ settings: Record<string, unknown> }> {
  return Object.values(layout).flatMap((sections) => (sections ?? []).flatMap((section) => [section, ...flattenBlocks(section.blocks)]));
}

/** Every distinct binding the layout's sections and blocks use. */
export function collectLayoutBindings<K extends string>(layout: Regions<K>): DynamicBinding[] {
  const found = new Map<string, DynamicBinding>();
  for (const node of nodes(layout)) {
    for (const value of Object.values(node.settings)) {
      if (isDynamic(value)) found.set(bindingKey(value.binding), value.binding);
    }
  }
  return [...found.values()];
}

function plainTextDocument(text: string): RichTextDocument {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: paragraph.split("\n").flatMap((line, index) => index === 0
        ? [{ type: "text" as const, text: line }]
        : [{ type: "hardBreak" as const }, { type: "text" as const, text: line }]),
    })),
  } as RichTextDocument;
}

function money(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.amountMinor !== "number" || typeof value.currency !== "string") return undefined;
  try { return new Intl.NumberFormat("en", { style: "currency", currency: value.currency }).format(value.amountMinor / 100); }
  catch { return undefined; }
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const parts = value.map(text).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(", ") : undefined;
  }
  return money(value);
}

/** Shapes a looked-up value for the control that shows it; undefined when it cannot be shown. */
export function displayValue(value: unknown, controlType: string | undefined): unknown {
  if (value === null || value === undefined) return undefined;
  switch (controlType) {
    case "image": {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string") return first.trim() ? { url: first } : undefined;
      return isRecord(first) && typeof first.url === "string" ? first : undefined;
    }
    case "link": {
      if (isRecord(value) && typeof value.url === "string") return value.url;
      return typeof value === "string" && value.trim() ? value : undefined;
    }
    case "rich-text": {
      if (isRichTextDocument(value)) return value;
      const plain = text(value);
      return plain ? plainTextDocument(plain) : undefined;
    }
    case "product":
    case "collection":
      return typeof value === "string" && value ? value : undefined;
    default:
      return text(value);
  }
}

function applySettings(settings: Record<string, unknown>, controlTypes: Map<string, string>, values: BindingValues): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (isStatic(value)) {
      next[key] = value.value;
      continue;
    }
    if (!isDynamic(value)) {
      next[key] = value;
      continue;
    }
    const controlType = controlTypes.get(key);
    const resolved = displayValue(values.get(bindingKey(value.binding)), controlType) ?? displayValue(value.fallback, controlType);
    if (resolved !== undefined) next[key] = resolved;
  }
  return next;
}

function controlTypes(controls: Array<{ key: string; type: string }> | undefined): Map<string, string> {
  return new Map((controls ?? []).map((control) => [control.key, control.type]));
}

function applyBlockValues(blocks: BlockNode[], values: BindingValues): BlockNode[] {
  return blocks.map((block) => ({
    ...block,
    settings: applySettings(block.settings, controlTypes(getBlockDefinition(block.type)?.controls), values),
    ...(block.blocks ? { blocks: applyBlockValues(block.blocks, values) } : {}),
  }));
}

/** A copy of the layout with every bound setting replaced by its value (or fallback); the input is not changed. */
export function applyBindingValues<K extends string>(layout: Regions<K>, values: BindingValues, themeVersion?: string): Regions<K> {
  const result = {} as Regions<K>;
  for (const region of Object.keys(layout) as K[]) {
    result[region] = layout[region].map((section) => ({
      ...section,
      settings: applySettings(section.settings, controlTypes(getSectionDefinition(section.type, themeVersion)?.controls), values),
      blocks: applyBlockValues(section.blocks, values),
    }));
  }
  return result;
}
