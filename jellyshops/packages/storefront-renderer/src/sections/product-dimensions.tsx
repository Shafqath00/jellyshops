import { useState } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import { elementProps } from "../element-style";
import type { ProductPresentationContext } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { sectionData } from "./shared";

export type LengthUnit = "cm" | "in";

/** A measurement read from a specification value: "150 cm", "1500mm", "59 in", 59". Anything else is not a length. */
export function parseLength(value: string): number | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch|inches|")\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const cm = unit === "mm" ? amount / 10 : unit === "m" ? amount * 100 : unit === "cm" ? amount : amount * 2.54;
  return Number.isFinite(cm) && cm > 0 ? cm : null;
}

export function formatLength(cm: number, unit: LengthUnit): string {
  const value = unit === "cm" ? cm : cm / 2.54;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unit}`;
}

/** "Width (King)" → { name: "Width", size: "King" }; "Width" → { name: "Width" }. */
function splitKey(key: string): { name: string; size?: string } {
  const match = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(key.trim());
  return match ? { name: match[1], size: match[2].trim() } : { name: key.trim() };
}

const LETTER_NAMES: Record<string, string> = { w: "Width", l: "Length", h: "Height", d: "Depth" };
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const TRIPLE = new RegExp(String.raw`^\s*${NUMBER}\s*[x×]\s*${NUMBER}(?:\s*[x×]\s*${NUMBER})?\s*(cm|mm|m|in|inch|inches|")\s*$`, "i");

/**
 * "Double (W x L x H)" = "146 x 205 x 120 cm" → Width/Length/Height rows for the size Double. The letters say which
 * number is which; without a size in the name ("Dimensions (W x L x H)") the rows apply to every size.
 */
function splitCombined(key: string, value: string): Array<{ name: string; size?: string; cm: number }> | null {
  const letters = /\(\s*([wlhd](?:\s*[x×]\s*[wlhd]){1,2})\s*\)/i.exec(key);
  const numbers = TRIPLE.exec(value);
  if (!letters || !numbers) return null;
  const names = letters[1].split(/\s*[x×]\s*/).map((letter) => LETTER_NAMES[letter.toLowerCase()]);
  const amounts = [numbers[1], numbers[2], numbers[3]].filter((amount): amount is string => amount !== undefined);
  if (names.length !== amounts.length) return null;
  const rest = key.replace(letters[0], "").trim();
  const size = rest && !/^(dimensions?|sizes?|measurements?)$/i.test(rest) ? rest : undefined;
  return amounts.flatMap((amount, index) => {
    const cm = parseLength(`${amount} ${numbers[4]}`);
    return cm === null ? [] : [{ name: names[index], ...(size ? { size } : {}), cm }];
  });
}

/** True for a specification that is a measurement (the Specifications section can leave these out). */
export function isMeasurement(value: string): boolean {
  return parseLength(value) !== null || TRIPLE.test(value);
}

export interface DimensionRows { rows: Array<{ letter: string; name: string; cm: number }>; size?: string }

/**
 * The measurements to show: rows whose name carries a size ("Width (King)") follow the shopper's choice (any chosen
 * option value with that name); with no matching choice the first size in the product's own option order (`optionOrder`,
 * else as listed) is shown and named. Rows without a size always show. Width, Length, Depth and Height come first, then
 * the other measurements (the database does not keep the order specifications were typed in). Values that are not
 * lengths are left to the Specifications section.
 */
export function dimensionRows(specifications: Record<string, string>, chosenValues: readonly string[], optionOrder: readonly string[] = []): DimensionRows {
  const entries = Object.entries(specifications).flatMap(([key, value]) => {
    const combined = splitCombined(key, value);
    if (combined) return combined;
    const cm = parseLength(value);
    return cm === null ? [] : [{ ...splitKey(key), cm }];
  });
  const rank = (size: string) => { const at = optionOrder.findIndex((label) => label.trim().toLowerCase() === size.toLowerCase()); return at < 0 ? Number.MAX_SAFE_INTEGER : at; };
  const sizes = [...new Set(entries.flatMap((entry) => entry.size ? [entry.size] : []))].map((size, index) => ({ size, index })).sort((a, b) => rank(a.size) - rank(b.size) || a.index - b.index).map((entry) => entry.size);
  const chosen = new Set(chosenValues.map((value) => value.trim().toLowerCase()));
  const size = sizes.find((entry) => chosen.has(entry.toLowerCase())) ?? sizes[0];
  const kept = entries.filter((entry) => !entry.size || entry.size === size);
  // A row named for the size wins over a plain row of the same name.
  const byName = new Map<string, { name: string; cm: number; sized: boolean }>();
  for (const entry of kept) {
    const key = entry.name.toLowerCase();
    const current = byName.get(key);
    if (!current || (!current.sized && entry.size)) byName.set(key, { name: entry.name, cm: entry.cm, sized: Boolean(entry.size) });
  }
  const main = ["width", "length", "depth", "height"];
  const order = (name: string) => { const at = main.indexOf(name.toLowerCase()); return at < 0 ? main.length : at; };
  const rows = [...byName.values()].map((row, index) => ({ row, index })).sort((a, b) => order(a.row.name) - order(b.row.name) || a.index - b.index).map(({ row }) => row).map((row, index) => ({ letter: String.fromCharCode(65 + (index % 26)), name: row.name, cm: row.cm }));
  return { rows, ...(size && kept.some((entry) => entry.size) ? { size } : {}) };
}

function chosenOptionValues(product: ProductPresentationContext): string[] {
  return product.product.options.flatMap((option) => option.values.filter((value) => value.selected).map((value) => value.label));
}

function optionOrder(product: ProductPresentationContext): string[] {
  return product.product.options.flatMap((option) => option.values.map((value) => value.label));
}

/**
 * "Dimensions": the product's measurements as a lettered list (matching an optional diagram), following the chosen
 * size, with a cm/inches switch. Hidden on the live store when the product has no measurements.
 */
export function ProductDimensionsSection({ section, context, product }: { section: SectionNode; context: StorefrontRuntimeContext; product: ProductPresentationContext | null }) {
  const startUnit: LengthUnit = section.settings.unit === "in" ? "in" : "cm";
  const [unit, setUnit] = useState<LengthUnit>(startUnit);
  const editor = context.mode === "editor";
  if (!product && !editor) return null;
  const { rows, size } = product ? dimensionRows(product.product.specifications ?? {}, chosenOptionValues(product), optionOrder(product)) : { rows: [], size: undefined };
  if (!rows.length && !editor) return null;
  const heading = typeof section.settings.heading === "string" && section.settings.heading.trim() ? section.settings.heading : "Dimensions";
  const note = typeof section.settings.note === "string" ? section.settings.note.trim() : "";
  const diagram = section.settings.diagram && typeof section.settings.diagram === "object" ? section.settings.diagram as { url?: unknown; alt?: unknown } : undefined;
  const diagramUrl = typeof diagram?.url === "string" ? safeRichTextHref(diagram.url) : null;
  const showSwitch = section.settings.showUnitSwitch !== false;
  return <section className="jelly-section jelly-product-dimensions" {...sectionData(section)}><StorefrontContainer>
    <div className="jelly-dimensions-header">
      <h2 {...elementProps(section, "heading", editor)}>{heading}</h2>
      {showSwitch && <div className="jelly-dimensions-units" role="group" aria-label="Units">
        {(["cm", "in"] as const).map((value) => <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>{value === "cm" ? "cm" : "inches"}</button>)}
      </div>}
    </div>
    {size && <p className="jelly-dimensions-size">Measurements for: <strong>{size}</strong></p>}
    <div className="jelly-dimensions-body" data-diagram={diagramUrl && !diagramUrl.startsWith("#") ? "true" : undefined}>
      {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {diagramUrl && !diagramUrl.startsWith("#") && <img className="jelly-dimensions-diagram" src={diagramUrl} alt={typeof diagram?.alt === "string" && diagram.alt ? diagram.alt : `${product?.product.title ?? "Product"} measurement diagram`} loading="lazy" decoding="async" />}
      {rows.length
        ? <dl className="jelly-dimensions-list">{rows.map((row) => <div key={row.name}>
          <dt><span className="jelly-dimensions-letter" aria-hidden="true">{row.letter}</span>{row.name}</dt>
          <dd>{formatLength(row.cm, unit)}</dd>
        </div>)}</dl>
        : <p className="jelly-editor-hint">Add measurements to the product&apos;s specifications, for example Width = 150 cm, Width (King) = 150 cm for one size, or King (W x L x H) = 161 x 215 x 120 cm.</p>}
    </div>
    {note && <p className="jelly-dimensions-note">{note}</p>}
  </StorefrontContainer></section>;
}
