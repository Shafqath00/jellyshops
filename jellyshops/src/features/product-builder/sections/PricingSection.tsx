"use client";

import { inputClass } from "@/features/commerce/components/product-form-styles";
import type { DraftErrors, ProductDraft } from "../draft";
import { Field, Section } from "./section-parts";

type Props = { draft: ProductDraft; errors: DraftErrors; currency: string; onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void };

export function PricingSection({ draft, errors, currency, onChange }: Props) {
  return (
    <Section title="Price & stock" hint="Selling in different sizes or colours? You'll be able to add those next.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pb-price" label={`Price (${currency})`} error={errors.price}>
          <input id="pb-price" inputMode="decimal" className={inputClass} value={draft.price} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "pb-price-error" : undefined} placeholder="0.00" onChange={(event) => onChange("price", event.target.value)} />
        </Field>
        <Field id="pb-compare" label="Original price" error={errors.compareAtPrice} hint="Optional. Shown crossed out to highlight a sale.">
          <input id="pb-compare" inputMode="decimal" className={inputClass} value={draft.compareAtPrice} aria-invalid={Boolean(errors.compareAtPrice)} aria-describedby={errors.compareAtPrice ? "pb-compare-error" : undefined} onChange={(event) => onChange("compareAtPrice", event.target.value)} />
        </Field>
        <Field id="pb-stock" label="Quantity in stock" error={errors.stock}>
          <input id="pb-stock" inputMode="numeric" className={inputClass} value={draft.stock} aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? "pb-stock-error" : undefined} placeholder="0" onChange={(event) => onChange("stock", event.target.value)} />
        </Field>
        <Field id="pb-sku" label="SKU" hint="Optional. Your own reference code.">
          <input id="pb-sku" className={inputClass} value={draft.sku} onChange={(event) => onChange("sku", event.target.value)} />
        </Field>
      </div>
    </Section>
  );
}
