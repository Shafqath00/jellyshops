/**
 * Personalisation: text a shopper types for one cart line (engraving, a name to print, a gift message, measurements).
 * The merchant lists the fields on the product; the storefront, the cart and the API share these rules so they agree
 * on what a valid entry is. Entries travel with the cart line and become part of the order line's choices.
 */

export const MAX_PERSONALISATION_FIELDS = 5;
export const MAX_PERSONALISATION_LENGTH = 500;

export interface PersonalisationField {
  id: string;
  /** What the shopper is asked for: "Engraving", "Name on the card". */
  label: string;
  required: boolean;
  /** 1-500 characters. */
  maxLength: number;
  /** A larger box for longer text (a message, measurements). */
  multiline?: boolean;
  /** Short help shown under the box, for example "Up to 12 letters". */
  helpText?: string;
  /** Added to the price of the line when the field is filled in, in minor units. */
  priceAdjustmentMinor?: number;
}

export interface PersonalisationEntry { fieldId: string; value: string }
export interface PersonalisationProblem { fieldId: string; code: "unknown_field" | "duplicate" | "required" | "too_long" | "invalid"; message: string }

/** Line breaks are kept for multi-line fields; other control characters and surrounding space are removed. */
export function cleanPersonalisationValue(value: string, multiline = false): string {
  const cleaned = value.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, multiline ? "" : " ");
  return (multiline ? cleaned.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : cleaned.replace(/\s+/g, " ")).trim();
}

/** The merchant's field list as stored on the product, with anything malformed left out. */
export function readPersonalisationFields(value: unknown): PersonalisationField[] {
  if (!Array.isArray(value)) return [];
  const fields: PersonalisationField[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const field = item as Record<string, unknown>;
    const id = typeof field.id === "string" ? field.id.trim() : "";
    const label = typeof field.label === "string" ? field.label.trim() : "";
    if (!id || !label || fields.some((existing) => existing.id === id)) continue;
    const maxLength = typeof field.maxLength === "number" && Number.isInteger(field.maxLength) ? Math.max(1, Math.min(MAX_PERSONALISATION_LENGTH, field.maxLength)) : 100;
    const price = typeof field.priceAdjustmentMinor === "number" && Number.isSafeInteger(field.priceAdjustmentMinor) && field.priceAdjustmentMinor > 0 ? field.priceAdjustmentMinor : undefined;
    fields.push({
      id, label: label.slice(0, 80), required: field.required === true, maxLength,
      ...(field.multiline === true ? { multiline: true } : {}),
      ...(typeof field.helpText === "string" && field.helpText.trim() ? { helpText: field.helpText.trim().slice(0, 160) } : {}),
      ...(price ? { priceAdjustmentMinor: price } : {}),
    });
    if (fields.length >= MAX_PERSONALISATION_FIELDS) break;
  }
  return fields;
}

/** Problems with a shopper's entries; empty when they can go into the cart. Empty optional fields are fine. */
export function validatePersonalisation(fields: PersonalisationField[], entries: PersonalisationEntry[]): PersonalisationProblem[] {
  const problems: PersonalisationProblem[] = [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const seen = new Set<string>();
  for (const entry of entries) {
    const field = byId.get(entry.fieldId);
    if (!field) { problems.push({ fieldId: entry.fieldId, code: "unknown_field", message: "That personalisation field does not exist." }); continue; }
    if (seen.has(field.id)) { problems.push({ fieldId: field.id, code: "duplicate", message: `${field.label} was given twice.` }); continue; }
    seen.add(field.id);
    if (typeof entry.value !== "string") { problems.push({ fieldId: field.id, code: "invalid", message: `Check ${field.label}.` }); continue; }
    const value = cleanPersonalisationValue(entry.value, field.multiline);
    if (value.length > field.maxLength) problems.push({ fieldId: field.id, code: "too_long", message: `${field.label} can be at most ${field.maxLength} characters.` });
  }
  for (const field of fields) {
    const entry = entries.find((item) => item.fieldId === field.id);
    if (field.required && (!entry || typeof entry.value !== "string" || !cleanPersonalisationValue(entry.value, field.multiline))) problems.push({ fieldId: field.id, code: "required", message: `Please fill in ${field.label}.` });
  }
  return problems;
}

/** Cleaned, non-empty entries in the order of the fields. */
export function normalisePersonalisation(fields: PersonalisationField[], entries: PersonalisationEntry[]): PersonalisationEntry[] {
  return fields.flatMap((field) => {
    const entry = entries.find((item) => item.fieldId === field.id);
    const value = entry && typeof entry.value === "string" ? cleanPersonalisationValue(entry.value, field.multiline).slice(0, field.maxLength) : "";
    return value ? [{ fieldId: field.id, value }] : [];
  });
}

/** Extra price for the filled-in fields, in minor units. */
export function personalisationPriceMinor(fields: PersonalisationField[], entries: PersonalisationEntry[]): number {
  return normalisePersonalisation(fields, entries).reduce((total, entry) => total + (fields.find((field) => field.id === entry.fieldId)?.priceAdjustmentMinor ?? 0), 0);
}

/**
 * A stable identity for the entries, so two lines of the same product with different engraving stay separate.
 * FNV-1a over the cleaned text: short, and the text itself never appears in keys.
 */
export function personalisationKey(entries: PersonalisationEntry[]): string {
  if (!entries.length) return "";
  const text = [...entries].sort((a, b) => a.fieldId.localeCompare(b.fieldId)).map((entry) => `${entry.fieldId}=${entry.value}`).join("\u0001");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p:${hash.toString(16).padStart(8, "0")}`;
}
