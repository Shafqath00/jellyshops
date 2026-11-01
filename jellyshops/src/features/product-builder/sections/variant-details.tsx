"use client";

import { useMemo, useState } from "react";
import type { ProductMediaLike } from "@jelly/storefront-schema";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor, minorToMajor, type ProductVariant } from "@/lib/domain";
import { MetafieldFields } from "../metafields/metafield-fields";
import type { InputContext } from "../metafields/metafield-input";
import type { ProductMetafields } from "../metafields/use-product-metafields";
import { LENGTH_UNITS, WEIGHT_UNITS, countryOptions, dimensionsToDraft, parseDimensions, parseHsCode, parseWeight, weightToDraft, type LengthUnit, type WeightUnit } from "../shipping";

type Props = {
  variant: ProductVariant;
  /** The product's photos; the seller picks which one shows for this combination. */
  photos: ProductMediaLike[];
  /** Digital combinations are never shipped, so their shipping details are hidden. */
  physical: boolean;
  currency: string;
  /** The store's custom fields for combinations; shown when there are any. */
  custom?: ProductMetafields;
  customContext?: InputContext;
  onPatch: (change: Partial<ProductVariant>) => void;
};

type Problems = { cost?: string; threshold?: string; weight?: string; size?: string; hs?: string };

const field = `${inputClass} !mt-1 h-9`;
const label = "block text-[12px] font-semibold text-foreground";
const problem = "mt-1 text-[12px] font-semibold text-destructive";

/**
 * Everything about one combination that does not fit in the table row. Each field saves as soon as what is typed
 * is valid; an invalid entry shows its message and leaves the last good value in place.
 */
export function VariantDetails({ variant, photos, physical, currency, custom, customContext, onPatch }: Props) {
  const name = variant.name;
  const countries = useMemo(() => countryOptions(), []);
  const [cost, setCost] = useState(variant.costMinor != null ? minorToMajor(variant.costMinor) : "");
  const [threshold, setThreshold] = useState(variant.lowStockThreshold != null ? String(variant.lowStockThreshold) : "");
  const [weight, setWeight] = useState(weightToDraft(variant.weightGrams));
  const [size, setSize] = useState(dimensionsToDraft(variant.lengthMm, variant.widthMm, variant.heightMm));
  const [hsCode, setHsCode] = useState(variant.hsCode ?? "");
  const [problems, setProblems] = useState<Problems>({});
  const flag = (key: keyof Problems, message?: string) => setProblems((current) => ({ ...current, [key]: message }));

  function changeCost(text: string) {
    setCost(text);
    if (!text.trim()) { flag("cost"); onPatch({ costMinor: undefined }); return; }
    const minor = majorToMinor(text.trim());
    if (Number.isFinite(minor) && minor >= 0) { flag("cost"); onPatch({ costMinor: minor }); } else flag("cost", "Enter a valid cost, like 250 or 250.50.");
  }
  function changeThreshold(text: string) {
    setThreshold(text);
    if (!text.trim()) { flag("threshold"); onPatch({ lowStockThreshold: undefined }); return; }
    if (/^\d{1,7}$/.test(text.trim())) { flag("threshold"); onPatch({ lowStockThreshold: Number(text.trim()) }); } else flag("threshold", "Use a whole number, 0 or more.");
  }
  function changeWeight(next: typeof weight) {
    setWeight(next);
    const parsed = parseWeight(next);
    if (parsed.error) { flag("weight", parsed.error); return; }
    flag("weight");
    onPatch({ weightGrams: parsed.value ?? undefined });
  }
  function changeSize(next: typeof size) {
    setSize(next);
    const parsed = parseDimensions(next);
    if (parsed.error) { flag("size", parsed.error); return; }
    flag("size");
    onPatch({ lengthMm: parsed.lengthMm ?? undefined, widthMm: parsed.widthMm ?? undefined, heightMm: parsed.heightMm ?? undefined });
  }
  function changeHsCode(text: string) {
    setHsCode(text);
    const parsed = parseHsCode(text);
    if (parsed.error) { flag("hs", parsed.error); return; }
    flag("hs");
    onPatch({ hsCode: parsed.value ?? undefined });
  }

  return (
    <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={label} htmlFor={`photo-${variant.id}`}>Photo for {name}</label>
        <select id={`photo-${variant.id}`} className={field} value={variant.mediaId ?? ""} disabled={photos.length === 0} onChange={(event) => onPatch({ mediaId: event.target.value || undefined })}>
          <option value="">{photos.length === 0 ? "Add photos to the product first" : "Chosen from the choices"}</option>
          {photos.map((photo, index) => <option key={photo.id} value={photo.id}>{photo.altText || `Photo ${index + 1}`}</option>)}
        </select>
      </div>

      <div>
        <label className={label} htmlFor={`barcode-${variant.id}`}>Barcode for {name}</label>
        <input id={`barcode-${variant.id}`} className={field} maxLength={64} defaultValue={variant.barcode ?? ""} onChange={(event) => onPatch({ barcode: event.target.value.trim() || undefined })} />
      </div>

      <div>
        <label className={label} htmlFor={`cost-${variant.id}`}>Cost per item for {name} ({currency})</label>
        <input id={`cost-${variant.id}`} inputMode="decimal" className={field} value={cost} aria-invalid={Boolean(problems.cost)} placeholder="0.00" onChange={(event) => changeCost(event.target.value)} />
        {problems.cost && <p role="alert" className={problem}>{problems.cost}</p>}
      </div>

      <div>
        <label className={label} htmlFor={`threshold-${variant.id}`}>Low stock warning for {name}</label>
        <input id={`threshold-${variant.id}`} inputMode="numeric" className={field} value={threshold} aria-invalid={Boolean(problems.threshold)} placeholder="3" onChange={(event) => changeThreshold(event.target.value)} />
        {problems.threshold && <p role="alert" className={problem}>{problems.threshold}</p>}
      </div>

      {physical && (
        <>
          <div>
            <label className={label} htmlFor={`weight-${variant.id}`}>Weight of {name}</label>
            <div className="flex gap-2">
              <input id={`weight-${variant.id}`} inputMode="decimal" className={field} value={weight.weight} aria-invalid={Boolean(problems.weight)} placeholder="0.0" onChange={(event) => changeWeight({ ...weight, weight: event.target.value })} />
              <select aria-label={`Weight unit for ${name}`} className={`${field} w-20 shrink-0`} value={weight.weightUnit} onChange={(event) => changeWeight({ ...weight, weightUnit: event.target.value as WeightUnit })}>
                {WEIGHT_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {problems.weight && <p role="alert" className={problem}>{problems.weight}</p>}
          </div>

          <fieldset>
            <legend className={label}>Package size of {name}</legend>
            <div className="flex gap-2">
              <input aria-label={`Length of ${name}`} inputMode="decimal" className={field} placeholder="L" value={size.length} aria-invalid={Boolean(problems.size)} onChange={(event) => changeSize({ ...size, length: event.target.value })} />
              <input aria-label={`Width of ${name}`} inputMode="decimal" className={field} placeholder="W" value={size.width} aria-invalid={Boolean(problems.size)} onChange={(event) => changeSize({ ...size, width: event.target.value })} />
              <input aria-label={`Height of ${name}`} inputMode="decimal" className={field} placeholder="H" value={size.height} aria-invalid={Boolean(problems.size)} onChange={(event) => changeSize({ ...size, height: event.target.value })} />
              <select aria-label={`Size unit for ${name}`} className={`${field} w-20 shrink-0`} value={size.dimensionUnit} onChange={(event) => changeSize({ ...size, dimensionUnit: event.target.value as LengthUnit })}>
                {LENGTH_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {problems.size && <p role="alert" className={problem}>{problems.size}</p>}
          </fieldset>

          <div>
            <label className={label} htmlFor={`origin-${variant.id}`}>Country or region of origin for {name}</label>
            <select id={`origin-${variant.id}`} className={field} value={variant.countryOfOrigin ?? ""} onChange={(event) => onPatch({ countryOfOrigin: event.target.value || undefined })}>
              <option value="">Not set</option>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </div>

          <div>
            <label className={label} htmlFor={`hs-${variant.id}`}>HS code for {name}</label>
            <input id={`hs-${variant.id}`} inputMode="numeric" className={field} value={hsCode} aria-invalid={Boolean(problems.hs)} placeholder="6109.10" onChange={(event) => changeHsCode(event.target.value)} />
            {problems.hs && <p role="alert" className={problem}>{problems.hs}</p>}
          </div>
        </>
      )}

      {custom && customContext && custom.variantDefinitions.length > 0 && (
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="mb-3 border-t border-border/70 pt-3 text-[13px] font-semibold text-foreground">Custom data for {name}</p>
          <MetafieldFields owner={`variant:${variant.id}`} definitions={custom.variantDefinitions} state={custom} context={customContext} idPrefix={`mf-${variant.id}`} />
        </div>
      )}
    </div>
  );
}
