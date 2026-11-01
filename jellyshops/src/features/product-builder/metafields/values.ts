import { majorToMinor, minorToMajor } from "@/lib/domain";

/** Plain names for the types a custom field can have, in the order they are offered. */
export const SCALAR_TYPE_LABELS = {
  string: "Single-line text",
  text: "Multi-line text",
  rich_text: "Formatted text",
  integer: "Whole number",
  decimal: "Number with decimals",
  boolean: "Yes or no",
  money: "Money",
  color: "Colour",
  url: "Web link",
  date: "Date",
  datetime: "Date and time",
  image: "Image",
  file: "File",
  product_reference: "Product",
  collection_reference: "Collection",
  page_reference: "Page",
  metaobject_reference: "Custom object",
} as const;
export type ScalarType = keyof typeof SCALAR_TYPE_LABELS;
export const SCALAR_TYPES = Object.keys(SCALAR_TYPE_LABELS) as ScalarType[];

export const isListType = (type: string) => type.startsWith("list:");
export const baseTypeOf = (type: string) => isListType(type) ? type.slice(5) : type;

export function typeLabel(type: string): string {
  const label = SCALAR_TYPE_LABELS[baseTypeOf(type) as ScalarType] ?? type;
  return isListType(type) ? `List of ${label.toLowerCase()}` : label;
}

/** A stable key from a name: "Care guide" becomes "care_guide". */
export function keyFromName(name: string): string {
  const key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64).replace(/_+$/g, "");
  return /^[a-z]/.test(key) ? key : key ? `f_${key}`.slice(0, 64) : "";
}
export const isValidKey = (key: string) => /^[a-z][a-z0-9_]{0,63}$/.test(key);

export const sameValue = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/** Which kinds of rule make sense for a type. */
export function ruleKinds(type: string): Array<"length" | "choices" | "range" | "dates" | "items"> {
  const base = baseTypeOf(type);
  const kinds: Array<"length" | "choices" | "range" | "dates" | "items"> = [];
  if (base === "string") kinds.push("length", "choices");
  if (base === "text" || base === "rich_text") kinds.push("length");
  if (base === "integer" || base === "decimal") kinds.push("range");
  if (base === "date" || base === "datetime") kinds.push("dates");
  if (isListType(type)) kinds.push("items");
  return kinds;
}

export interface RuleForm { minLength: string; maxLength: string; choices: string; min: string; max: string; minItems: string; maxItems: string }
export const emptyRuleForm: RuleForm = { minLength: "", maxLength: "", choices: "", min: "", max: "", minItems: "", maxItems: "" };

/** The rules object the API expects from what was typed, or a message when something typed is not usable. */
export function buildRules(type: string, form: RuleForm): { rules?: Record<string, unknown>; error?: string } {
  const rules: Record<string, unknown> = {};
  const kinds = ruleKinds(type);
  const whole = (text: string, label: string): number | string => {
    if (!/^\d{1,9}$/.test(text.trim())) return `${label} must be a whole number, 0 or more.`;
    return Number(text.trim());
  };
  const put = (key: string, text: string, label: string): string | undefined => {
    if (!text.trim()) return undefined;
    const parsed = whole(text, label);
    if (typeof parsed === "string") return parsed;
    rules[key] = parsed;
    return undefined;
  };
  if (kinds.includes("length")) {
    const problem = put("minLength", form.minLength, "The shortest length") ?? put("maxLength", form.maxLength, "The longest length");
    if (problem) return { error: problem };
  }
  if (kinds.includes("items")) {
    const problem = put("minItems", form.minItems, "The fewest items") ?? put("maxItems", form.maxItems, "The most items");
    if (problem) return { error: problem };
  }
  if (kinds.includes("choices") && form.choices.trim()) {
    const choices = form.choices.split(/\r?\n|,/).map((choice) => choice.trim()).filter(Boolean);
    if (new Set(choices).size !== choices.length) return { error: "Each allowed value can only be listed once." };
    rules.choices = choices;
  }
  if (kinds.includes("range")) {
    for (const [key, label] of [["min", "The lowest number"], ["max", "The highest number"]] as const) {
      const text = form[key].trim();
      if (!text) continue;
      const value = Number(text);
      if (!Number.isFinite(value) || (baseTypeOf(type) === "integer" && !Number.isInteger(value))) return { error: `${label} must be ${baseTypeOf(type) === "integer" ? "a whole number" : "a number"}.` };
      rules[key] = value;
    }
  }
  if (kinds.includes("dates")) {
    for (const [key, label] of [["min", "The earliest date"], ["max", "The latest date"]] as const) {
      const text = form[key].trim();
      if (!text) continue;
      if (baseTypeOf(type) === "date") rules[key] = text;
      else { const iso = localInputToIso(text); if (!iso) return { error: `${label} is not a valid date and time.` }; rules[key] = iso; }
    }
  }
  const low = rules.minLength, high = rules.maxLength;
  if (typeof low === "number" && typeof high === "number" && low > high) return { error: "The shortest length cannot be longer than the longest." };
  if (typeof rules.minItems === "number" && typeof rules.maxItems === "number" && rules.minItems > rules.maxItems) return { error: "The fewest items cannot be more than the most." };
  if (typeof rules.min === "number" && typeof rules.max === "number" && rules.min > rules.max) return { error: "The lowest number cannot be higher than the highest." };
  if (typeof rules.min === "string" && typeof rules.max === "string" && Date.parse(rules.min) > Date.parse(rules.max)) return { error: "The earliest date cannot be after the latest." };
  return Object.keys(rules).length ? { rules } : {};
}

/** "2026-10-28T09:30" (the browser's local date-time input) to an ISO time in UTC, or null when it is not a date. */
export function localInputToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** An ISO time as the value of a browser date-time input, in the viewer's own time zone. */
export function isoToLocalInput(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface MoneyValue { amountMinor: number; currency: string }
export const isMoneyValue = (value: unknown): value is MoneyValue => typeof value === "object" && value !== null && Number.isSafeInteger((value as MoneyValue).amountMinor) && typeof (value as MoneyValue).currency === "string";

export function moneyToText(value: unknown): string { return isMoneyValue(value) ? minorToMajor(value.amountMinor) : ""; }
/** Typed amount to a money value in the given currency; null when blank, undefined when it is not an amount. */
export function textToMoney(text: string, currency: string): MoneyValue | null | undefined {
  const clean = text.trim();
  if (!clean) return null;
  const amountMinor = majorToMinor(clean);
  return Number.isFinite(amountMinor) && amountMinor >= 0 ? { amountMinor, currency } : undefined;
}

/** A typed number for an integer or decimal field; null when blank, undefined when it is not a valid number. */
export function textToNumber(text: string, integer: boolean): number | null | undefined {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  if (integer ? !/^-?\d{1,15}$/.test(clean) : !/^-?\d+(?:\.\d+)?$/.test(clean)) return undefined;
  const value = Number(clean);
  return Number.isFinite(value) && (!integer || Number.isSafeInteger(value)) ? value : undefined;
}
