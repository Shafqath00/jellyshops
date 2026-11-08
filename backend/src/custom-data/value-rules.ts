/**
 * What a custom field accepts. A definition has a type ("integer", "list:url", ...) and optional rules
 * ("min", "maxLength", "choices", ...). Both the editor and the API use these functions, so a value that is
 * saved is always one the storefront can rely on.
 */

type Rules = Record<string, unknown>;

const STRING_LIMITS: Record<string, number> = { string: 255, text: 10_000, rich_text: 100_000 };
const ID_TYPES = new Set(["image", "file", "product_reference", "collection_reference", "page_reference", "metaobject_reference"]);
const MAX_LIST_ITEMS = 100;
const MAX_CHOICES = 100;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWholeNumber = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

export function isRealDate(text: string): boolean {
  const match = DATE.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
// Date.parse rolls impossible days over (Feb 30 becomes Mar 2), so the calendar date is checked on its own.
const isDateTime = (text: string) => DATETIME.test(text) && isRealDate(text.slice(0, 10)) && !Number.isNaN(Date.parse(text));

function isHttpUrl(text: string): boolean {
  if (text.length > 2048 || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The scalar type behind a list type; the type itself otherwise. */
export const baseType = (type: string) => type.startsWith("list:") ? type.slice(5) : type;

function scalarProblem(type: string, value: unknown, rules: Rules): string | null {
  if (type in STRING_LIMITS) {
    if (typeof value !== "string") return "Enter text.";
    if (value.length > STRING_LIMITS[type]) return `Use at most ${STRING_LIMITS[type].toLocaleString("en")} characters.`;
    if (isWholeNumber(rules.minLength) && value.length < rules.minLength) return `Use at least ${rules.minLength} characters.`;
    if (isWholeNumber(rules.maxLength) && value.length > rules.maxLength) return `Use at most ${rules.maxLength} characters.`;
    if (Array.isArray(rules.choices) && type === "string" && !rules.choices.includes(value)) return "Choose one of the allowed values.";
    return null;
  }
  switch (type) {
    case "boolean": return typeof value === "boolean" ? null : "Choose yes or no.";
    case "integer": {
      if (!isWholeNumber(value)) return "Enter a whole number.";
      return numberRuleProblem(value, rules);
    }
    case "decimal": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number.";
      return numberRuleProblem(value, rules);
    }
    case "money": {
      if (!isRecord(value) || !isWholeNumber(value.amountMinor) || value.amountMinor < 0 || typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) return "Enter an amount and a three-letter currency code.";
      return null;
    }
    case "color": return typeof value === "string" && HEX_COLOR.test(value) ? null : "Use a colour like #1a2b3c.";
    case "url": return typeof value === "string" && isHttpUrl(value) ? null : "Enter a web address starting with http:// or https://.";
    case "date": {
      if (typeof value !== "string" || !isRealDate(value)) return "Enter a real date, like 2026-10-28.";
      if (typeof rules.min === "string" && value < rules.min) return `Choose ${rules.min} or later.`;
      if (typeof rules.max === "string" && value > rules.max) return `Choose ${rules.max} or earlier.`;
      return null;
    }
    case "datetime": {
      if (typeof value !== "string" || !isDateTime(value)) return "Enter a date and time with a time zone, like 2026-10-28T09:30:00Z.";
      if (typeof rules.min === "string" && Date.parse(value) < Date.parse(rules.min)) return `Choose ${rules.min} or later.`;
      if (typeof rules.max === "string" && Date.parse(value) > Date.parse(rules.max)) return `Choose ${rules.max} or earlier.`;
      return null;
    }
    default:
      if (ID_TYPES.has(type)) return typeof value === "string" && value.length >= 1 && value.length <= 200 ? null : "Choose an item.";
      return "This type of custom field is not supported.";
  }
}

function numberRuleProblem(value: number, rules: Rules): string | null {
  if (typeof rules.min === "number" && value < rules.min) return `Enter ${rules.min} or more.`;
  if (typeof rules.max === "number" && value > rules.max) return `Enter ${rules.max} or less.`;
  return null;
}

/** A plain-language reason the value is not acceptable for this type and these rules, or null when it is fine. */
export function valueProblem(type: string, value: unknown, rules: Rules | null | undefined): string | null {
  const safeRules = rules ?? {};
  if (type.startsWith("list:")) {
    if (!Array.isArray(value)) return "Enter a list of values.";
    if (value.length > MAX_LIST_ITEMS) return `Use at most ${MAX_LIST_ITEMS} items.`;
    if (isWholeNumber(safeRules.minItems) && value.length < safeRules.minItems) return `Add at least ${safeRules.minItems} ${safeRules.minItems === 1 ? "item" : "items"}.`;
    if (isWholeNumber(safeRules.maxItems) && value.length > safeRules.maxItems) return `Add at most ${safeRules.maxItems} ${safeRules.maxItems === 1 ? "item" : "items"}.`;
    for (const [index, item] of value.entries()) {
      const problem = scalarProblem(type.slice(5), item, safeRules);
      if (problem) return `Item ${index + 1}: ${problem}`;
    }
    return null;
  }
  return scalarProblem(type, value, safeRules);
}

const ALLOWED_RULES: Record<string, readonly string[]> = {
  string: ["minLength", "maxLength", "choices"],
  text: ["minLength", "maxLength"],
  rich_text: ["minLength", "maxLength"],
  integer: ["min", "max"],
  decimal: ["min", "max"],
  date: ["min", "max"],
  datetime: ["min", "max"],
};

/** Checks a definition's rules when it is created or changed: unknown, mistyped or contradictory rules are refused. */
export function definitionRulesProblem(type: string, rules: Rules | null | undefined): string | null {
  if (!rules || Object.keys(rules).length === 0) return null;
  const list = type.startsWith("list:");
  const scalar = baseType(type);
  const allowed = [...(ALLOWED_RULES[scalar] ?? []), ...(list ? ["minItems", "maxItems"] : [])];
  for (const key of Object.keys(rules)) {
    if (!allowed.includes(key)) return `The rule "${key}" does not apply to ${type}.`;
  }
  for (const key of ["minLength", "maxLength", "minItems", "maxItems"]) {
    if (key in rules && !(isWholeNumber(rules[key]) && (rules[key] as number) >= 0)) return `The rule "${key}" must be a whole number, 0 or more.`;
  }
  const pairs: Array<[string, string]> = [["minLength", "maxLength"], ["minItems", "maxItems"]];
  for (const [low, high] of pairs) {
    if (isWholeNumber(rules[low]) && isWholeNumber(rules[high]) && (rules[low] as number) > (rules[high] as number)) return `"${low}" cannot be larger than "${high}".`;
  }
  if (scalar === "integer" || scalar === "decimal") {
    for (const key of ["min", "max"]) {
      if (key in rules && (typeof rules[key] !== "number" || !Number.isFinite(rules[key]))) return `The rule "${key}" must be a number.`;
    }
    if (typeof rules.min === "number" && typeof rules.max === "number" && rules.min > rules.max) return `"min" cannot be larger than "max".`;
  }
  if (scalar === "date" || scalar === "datetime") {
    const valid = (text: unknown) => typeof text === "string" && (scalar === "date" ? isRealDate(text) : isDateTime(text));
    for (const key of ["min", "max"]) {
      if (key in rules && !valid(rules[key])) return `The rule "${key}" must be a valid ${scalar === "date" ? "date (2026-10-28)" : "date and time (2026-10-28T09:30:00Z)"}.`;
    }
    if (typeof rules.min === "string" && typeof rules.max === "string" && Date.parse(rules.min) > Date.parse(rules.max)) return `"min" cannot be later than "max".`;
  }
  if ("choices" in rules) {
    const choices = rules.choices;
    if (!Array.isArray(choices) || choices.length === 0 || choices.length > MAX_CHOICES || choices.some((choice) => typeof choice !== "string" || choice.length === 0 || choice.length > 255) || new Set(choices).size !== choices.length) {
      return `"choices" must be a list of 1 to ${MAX_CHOICES} different, non-empty values.`;
    }
  }
  return null;
}
