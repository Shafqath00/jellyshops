"use client";

import { inputClass } from "@/features/commerce/components/product-form-styles";
import { AnimatedDetails } from "../animated-details";
import { useState } from "react";
import { formatMoney, majorToMinor, type Currency } from "@/lib/domain";
import { UNIT_GROUPS, parseUnitPricing, profitSummary, unitPriceLabel, unitPriceMinor, unitGroupOf } from "../pricing";
import type { DraftErrors, ProductDraft } from "../draft";
import { Field, Section } from "./section-parts";

type Props = {
  draft: ProductDraft;
  errors: DraftErrors;
  currency: string;
  /** True once the product has choices that need their own stock; price and stock then live per combination. */
  hasCombinations: boolean;
  onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void;
};

export function PricingSection({ draft, errors, currency, hasCombinations, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(draft.compareAtPrice.trim()));
  const [costOpen, setCostOpen] = useState(Boolean(draft.cost.trim() || draft.unitPricing.totalAmount.trim()));
  const profit = profitSummary(draft.price, draft.cost);
  const unit = parseUnitPricing(draft.unitPricing).value;
  const priceMinor = majorToMinor(draft.price);
  const money = (minor: number) => formatMoney(minor, currency as Currency);
  const setUnit = (patch: Partial<typeof draft.unitPricing>) => onChange("unitPricing", { ...draft.unitPricing, ...patch });
  const unitOptions = () => Object.entries(UNIT_GROUPS).map(([key, group]) => <optgroup key={key} label={group.label}>{group.units.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</optgroup>);
  if (hasCombinations) {
    return (
      <Section title="Pricing" hint="Prices are managed per variant. Changing the default below only affects variants you add later."><a className="jk-link" href="#pb-variant-list">Manage variant prices</a><AnimatedDetails open={errors.price ? true : undefined} className="jk-disclosure jk-inset-disclosure"><summary>Default price for new variants</summary><div className="mt-4 max-w-xs">
          <Field id="pb-price" label={`Price (${currency})`} error={errors.price}>
            <input id="pb-price" inputMode="decimal" className={inputClass} value={draft.price} aria-invalid={Boolean(errors.price)} onChange={(event) => onChange("price", event.target.value)} />
          </Field>
        </div></AnimatedDetails></Section>
    );
  }
  return (
    <Section title="Pricing" hint="Set the price customers pay. If you add variants, each version can have its own price.">
      <Field id="pb-price" label={`Price (${currency})`} required error={errors.price}>
        <input id="pb-price" aria-required="true" inputMode="decimal" className={inputClass} value={draft.price} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "pb-price-error" : undefined} placeholder="0.00" onChange={(event) => onChange("price", event.target.value)} />
      </Field>
      <AnimatedDetails open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className="rounded-xl border border-border/80 bg-muted/25 px-4 py-3.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Original price (optional)
        </summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-2">
          <Field id="pb-compare" label="Original price" error={errors.compareAtPrice} hint="Shown crossed out beside your price.">
            <input id="pb-compare" inputMode="decimal" className={inputClass} value={draft.compareAtPrice} aria-invalid={Boolean(errors.compareAtPrice)} aria-describedby={errors.compareAtPrice ? "pb-compare-error" : undefined} onChange={(event) => onChange("compareAtPrice", event.target.value)} />
          </Field>
        </div>
      </AnimatedDetails>
      <AnimatedDetails open={costOpen} onToggle={(event) => setCostOpen(event.currentTarget.open)} className="rounded-xl border border-border/80 bg-muted/25 px-4 py-3.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Cost, profit and unit pricing (optional)
        </summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-3">
          <Field id="pb-cost" label={`Cost per item (${currency})`} error={errors.cost} hint="What you pay for it. Only you can see this.">
            <input id="pb-cost" inputMode="decimal" className={inputClass} value={draft.cost} aria-invalid={Boolean(errors.cost)} aria-describedby={errors.cost ? "pb-cost-error" : undefined} placeholder="0.00" onChange={(event) => onChange("cost", event.target.value)} />
          </Field>
          <div><p className="text-[13px] font-semibold text-foreground">Profit</p><output aria-label="Profit" className={"mt-2 block text-[15px] " + (profit && profit.profitMinor < 0 ? "text-destructive" : "text-foreground")}>{profit ? money(profit.profitMinor) : "—"}</output></div>
          <div><p className="text-[13px] font-semibold text-foreground">Margin</p><output aria-label="Margin" className={"mt-2 block text-[15px] " + (profit && profit.profitMinor < 0 ? "text-destructive" : "text-foreground")}>{profit && profit.marginPercent !== null ? `${profit.marginPercent}%` : "—"}</output></div>
        </div>
        <fieldset className="mt-4 border-t border-border/70 pt-4">
          <legend className="text-[13px] font-semibold text-foreground">Unit pricing</legend>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">For products sold by weight, volume or length. Example: 500 g, priced per 100 g.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="pb-unit-total" className="text-[13px] font-semibold text-foreground">Total amount in the product</label><div className="mt-1.5 flex gap-2"><input id="pb-unit-total" inputMode="decimal" className={inputClass} value={draft.unitPricing.totalAmount} aria-invalid={Boolean(errors.unitPricing)} onChange={(event) => setUnit({ totalAmount: event.target.value })} placeholder="500" /><select aria-label="Total amount unit" className={inputClass + " w-24"} value={draft.unitPricing.totalUnit} onChange={(event) => setUnit({ totalUnit: event.target.value, ...(unitGroupOf(event.target.value) !== unitGroupOf(draft.unitPricing.baseUnit) ? { baseUnit: event.target.value } : {}) })}>{unitOptions()}</select></div></div>
            <div><label htmlFor="pb-unit-base" className="text-[13px] font-semibold text-foreground">Show price per</label><div className="mt-1.5 flex gap-2"><input id="pb-unit-base" inputMode="decimal" className={inputClass} value={draft.unitPricing.baseAmount} aria-invalid={Boolean(errors.unitPricing)} onChange={(event) => setUnit({ baseAmount: event.target.value })} /><select aria-label="Unit to show the price per" className={inputClass + " w-24"} value={draft.unitPricing.baseUnit} onChange={(event) => setUnit({ baseUnit: event.target.value })}>{unitOptions()}</select></div></div>
          </div>
          {errors.unitPricing && <p id="pb-unit-total-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-destructive">{errors.unitPricing}</p>}
          {unit && Number.isFinite(priceMinor) && priceMinor > 0 && !errors.unitPricing && <p role="status" className="mt-2 text-[12px] text-muted-foreground">Shoppers will see {unitPriceLabel(money(unitPriceMinor(priceMinor, unit)), unit)}.</p>}
        </fieldset>
      </AnimatedDetails>
    </Section>
  );
}
