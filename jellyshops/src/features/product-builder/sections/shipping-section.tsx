"use client";

import { useMemo } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import type { DraftErrors, ProductDraft } from "../draft";
import { LENGTH_UNITS, WEIGHT_UNITS, countryOptions, type LengthUnit, type ShippingDraft, type WeightUnit } from "../shipping";
import { Field, Section } from "./section-parts";

type Props = {
  draft: ProductDraft;
  errors: DraftErrors;
  /** Products with combinations get their shipping details per combination. */
  hasCombinations: boolean;
  onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void;
};

const selectClass = `${inputClass} w-24 shrink-0`;

export function ShippingSection({ draft, errors, hasCombinations, onChange }: Props) {
  const countries = useMemo(() => countryOptions(), []);
  const shipping = draft.shipping;
  const set = (patch: Partial<ShippingDraft>) => onChange("shipping", { ...shipping, ...patch });

  return (
    <Section title="Shipping" hint="Saved with every order, for packing and customs forms. Shoppers pay your store's flat shipping rate.">
      <label className="flex items-center gap-2 text-[13px] font-medium">
        <input type="checkbox" checked={draft.physical} onChange={(event) => onChange("physical", event.target.checked)} />
        This is a physical product that needs shipping
      </label>

      {!draft.physical && (
        <p role="note" className="text-[13px] text-muted-foreground">Digital products are delivered as files and are never shipped. After you save, add the file under Product delivery.</p>
      )}

      {draft.physical && hasCombinations && (
        <p role="note" className="text-[13px] text-muted-foreground">This product has combinations, so weight, size, country and HS code are set for each combination.</p>
      )}

      {draft.physical && !hasCombinations && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pb-weight" className="text-[13px] font-semibold text-foreground">Package weight</label>
            <div className="mt-1.5 flex gap-2">
              <input id="pb-weight" inputMode="decimal" className={inputClass} value={shipping.weight} aria-invalid={Boolean(errors.weight)} aria-describedby={errors.weight ? "pb-weight-error" : undefined} placeholder="0.0" onChange={(event) => set({ weight: event.target.value })} />
              <select aria-label="Weight unit" className={selectClass} value={shipping.weightUnit} onChange={(event) => set({ weightUnit: event.target.value as WeightUnit })}>
                {WEIGHT_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {errors.weight && <p id="pb-weight-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-destructive">{errors.weight}</p>}
          </div>

          <fieldset>
            <legend className="text-[13px] font-semibold text-foreground">Package size</legend>
            <div className="mt-1.5 flex gap-2">
              <input id="pb-length" aria-label="Length" inputMode="decimal" className={inputClass} value={shipping.length} aria-invalid={Boolean(errors.dimensions)} aria-describedby={errors.dimensions ? "pb-dimensions-error" : undefined} placeholder="L" onChange={(event) => set({ length: event.target.value })} />
              <input aria-label="Width" inputMode="decimal" className={inputClass} value={shipping.width} aria-invalid={Boolean(errors.dimensions)} placeholder="W" onChange={(event) => set({ width: event.target.value })} />
              <input aria-label="Height" inputMode="decimal" className={inputClass} value={shipping.height} aria-invalid={Boolean(errors.dimensions)} placeholder="H" onChange={(event) => set({ height: event.target.value })} />
              <select aria-label="Size unit" className={selectClass} value={shipping.dimensionUnit} onChange={(event) => set({ dimensionUnit: event.target.value as LengthUnit })}>
                {LENGTH_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {errors.dimensions && <p id="pb-dimensions-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-destructive">{errors.dimensions}</p>}
          </fieldset>

          <Field id="pb-origin" label="Country or region of origin" hint="Where it was made. Needed for customs on international orders.">
            <select id="pb-origin" className={inputClass} value={shipping.countryOfOrigin} onChange={(event) => set({ countryOfOrigin: event.target.value })}>
              <option value="">Not set</option>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </Field>

          <Field id="pb-hs-code" label="HS code" error={errors.hsCode} hint="Harmonized System code, 6 to 10 digits. Optional.">
            <input id="pb-hs-code" inputMode="numeric" className={inputClass} value={shipping.hsCode} aria-invalid={Boolean(errors.hsCode)} aria-describedby={errors.hsCode ? "pb-hs-code-error" : undefined} placeholder="6109.10" onChange={(event) => set({ hsCode: event.target.value })} />
          </Field>
        </div>
      )}
    </Section>
  );
}
