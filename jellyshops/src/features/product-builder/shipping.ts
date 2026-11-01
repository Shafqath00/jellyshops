export type WeightUnit = "g" | "kg" | "lb" | "oz";
export type LengthUnit = "mm" | "cm" | "in";

export const WEIGHT_UNITS: Array<{ id: WeightUnit; label: string }> = [{ id: "kg", label: "kg" }, { id: "g", label: "g" }, { id: "lb", label: "lb" }, { id: "oz", label: "oz" }];
export const LENGTH_UNITS: Array<{ id: LengthUnit; label: string }> = [{ id: "cm", label: "cm" }, { id: "mm", label: "mm" }, { id: "in", label: "in" }];

const GRAMS_PER_UNIT: Record<WeightUnit, number> = { g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125 };
const MM_PER_UNIT: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 };
/** Same limits as the database. */
export const MAX_WEIGHT_GRAMS = 100_000_000;
export const MAX_LENGTH_MM = 10_000_000;

export interface ShippingDraft {
  weight: string;
  weightUnit: WeightUnit;
  length: string;
  width: string;
  height: string;
  dimensionUnit: LengthUnit;
  /** ISO 3166-1 alpha-2 code, or blank. */
  countryOfOrigin: string;
  /** What the seller typed; separators are allowed and removed when it is saved. */
  hsCode: string;
}
export const emptyShipping: ShippingDraft = { weight: "", weightUnit: "kg", length: "", width: "", height: "", dimensionUnit: "cm", countryOfOrigin: "", hsCode: "" };

/** The fields the server stores for one variant. */
export interface ShippingValues {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  countryOfOrigin: string | null;
  hsCode: string | null;
}

const DECIMAL = /^\d+(?:\.\d{1,3})?$/;
const trimmed = (text: string) => text.trim().replace(",", ".");

function parseAmount(text: string, perUnit: number, max: number, tooLarge: string): { value: number | null; error?: string } {
  const clean = trimmed(text);
  if (!clean) return { value: null };
  if (!DECIMAL.test(clean)) return { value: null, error: "Enter a number, like 0.5 or 12." };
  const value = Math.round(Number(clean) * perUnit);
  return value > max ? { value: null, error: tooLarge } : { value };
}

export const parseWeight = (draft: Pick<ShippingDraft, "weight" | "weightUnit">) =>
  parseAmount(draft.weight, GRAMS_PER_UNIT[draft.weightUnit], MAX_WEIGHT_GRAMS, "That weight is too large.");

/** Length, width and height only make sense together. */
export function parseDimensions(draft: Pick<ShippingDraft, "length" | "width" | "height" | "dimensionUnit">): { lengthMm: number | null; widthMm: number | null; heightMm: number | null; error?: string } {
  const parts = [draft.length, draft.width, draft.height].map((text) => parseAmount(text, MM_PER_UNIT[draft.dimensionUnit], MAX_LENGTH_MM, "That size is too large."));
  const failed = parts.find((part) => part.error);
  const filled = parts.filter((part) => part.value !== null).length;
  const blank = [draft.length, draft.width, draft.height].filter((text) => !trimmed(text)).length;
  if (failed) return { lengthMm: null, widthMm: null, heightMm: null, error: failed.error };
  if (blank !== 0 && blank !== 3) return { lengthMm: null, widthMm: null, heightMm: null, error: "Enter length, width and height together." };
  return filled === 0 ? { lengthMm: null, widthMm: null, heightMm: null } : { lengthMm: parts[0].value, widthMm: parts[1].value, heightMm: parts[2].value };
}

/** Digits only, 6 to 10 of them. Dots, dashes and spaces typed between them are ignored. */
export function parseHsCode(text: string): { value: string | null; error?: string } {
  const typed = text.trim();
  if (!typed) return { value: null };
  if (!/^[\d .\-]+$/.test(typed)) return { value: null, error: "An HS code is made of digits, like 6109.10." };
  const digits = typed.replace(/\D/g, "");
  return /^\d{6,10}$/.test(digits) ? { value: digits } : { value: null, error: "An HS code has 6 to 10 digits, like 6109.10." };
}

export interface ShippingErrors { weight?: string; dimensions?: string; hsCode?: string }
export function validateShipping(draft: ShippingDraft): ShippingErrors {
  const errors: ShippingErrors = {};
  const weight = parseWeight(draft).error; if (weight) errors.weight = weight;
  const dimensions = parseDimensions(draft).error; if (dimensions) errors.dimensions = dimensions;
  const hsCode = parseHsCode(draft.hsCode).error; if (hsCode) errors.hsCode = hsCode;
  return errors;
}

/** Everything the server stores, from what the seller typed. Blank fields clear the stored value. */
export function shippingToValues(draft: ShippingDraft): ShippingValues {
  const dimensions = parseDimensions(draft);
  return {
    weightGrams: parseWeight(draft).value,
    lengthMm: dimensions.lengthMm, widthMm: dimensions.widthMm, heightMm: dimensions.heightMm,
    countryOfOrigin: draft.countryOfOrigin || null,
    hsCode: parseHsCode(draft.hsCode).value,
  };
}

const plain = (value: number, maxDecimals: number) => String(Number(value.toFixed(maxDecimals)));

/** Shows a stored weight the way people write it: grams below a kilo, kilos above. */
export function weightToDraft(grams: number | null | undefined): Pick<ShippingDraft, "weight" | "weightUnit"> {
  if (grams == null) return { weight: "", weightUnit: "kg" };
  return grams < 1000 ? { weight: String(grams), weightUnit: "g" } : { weight: plain(grams / 1000, 3), weightUnit: "kg" };
}

export function dimensionsToDraft(lengthMm: number | null | undefined, widthMm: number | null | undefined, heightMm: number | null | undefined): Pick<ShippingDraft, "length" | "width" | "height" | "dimensionUnit"> {
  if (lengthMm == null || widthMm == null || heightMm == null) return { length: "", width: "", height: "", dimensionUnit: "cm" };
  return { length: plain(lengthMm / 10, 1), width: plain(widthMm / 10, 1), height: plain(heightMm / 10, 1), dimensionUnit: "cm" };
}

export interface ShippingSnapshot { weightGrams?: number; lengthMm?: number; widthMm?: number; heightMm?: number; countryOfOrigin?: string; hsCode?: string }

const regionName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; } };
export const countryName = regionName;

export function formatWeight(grams: number): string {
  return grams < 1000 ? `${grams} g` : `${plain(grams / 1000, 3)} kg`;
}
export function formatHsCode(code: string): string {
  return code.length > 6 ? `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}` : code.length === 6 ? `${code.slice(0, 4)}.${code.slice(4)}` : code;
}

/** One line for a packing slip or order page: "250 g · 30 × 20 × 5 cm · Made in India · HS 6109.10". */
export function describeShipping(snapshot: ShippingSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const parts: string[] = [];
  if (snapshot.weightGrams != null) parts.push(formatWeight(snapshot.weightGrams));
  if (snapshot.lengthMm != null && snapshot.widthMm != null && snapshot.heightMm != null) parts.push(`${plain(snapshot.lengthMm / 10, 1)} × ${plain(snapshot.widthMm / 10, 1)} × ${plain(snapshot.heightMm / 10, 1)} cm`);
  if (snapshot.countryOfOrigin) parts.push(`Made in ${countryName(snapshot.countryOfOrigin)}`);
  if (snapshot.hsCode) parts.push(`HS ${formatHsCode(snapshot.hsCode)}`);
  return parts.join(" · ");
}

/** Total weight of the physical lines. `missing` counts physical lines with no recorded weight. */
export function parcelWeight(items: Array<{ quantity: number; fulfillmentType?: string; fulfilmentType?: string; shippingSnapshot?: ShippingSnapshot | null }>): { grams: number; missing: number; physical: number } {
  let grams = 0, missing = 0, physical = 0;
  for (const item of items) {
    if ((item.fulfillmentType ?? item.fulfilmentType) === "DIGITAL") continue;
    physical += 1;
    const weight = item.shippingSnapshot?.weightGrams;
    if (weight == null) missing += 1; else grams += weight * item.quantity;
  }
  return { grams, missing, physical };
}

/** ISO 3166-1 alpha-2 codes offered for the country of origin. */
export const COUNTRY_CODES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

export function countryOptions(): Array<{ code: string; name: string }> {
  return COUNTRY_CODES.map((code) => ({ code, name: regionName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}
