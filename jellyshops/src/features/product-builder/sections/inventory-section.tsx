"use client";

import { AnimatedDetails } from "../animated-details";
import { useState } from "react";
import { StatusBadge } from "@/components/admin";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import type { DraftErrors, ProductDraft } from "../draft";
import { DEFAULT_LOW_STOCK_THRESHOLD, STOCK_STATUS_LABEL, STOCK_STATUS_TONE, stockStatusOf } from "../stock";
import { Field, Section } from "./section-parts";

type Props = {
  draft: ProductDraft;
  errors: DraftErrors;
  hasCombinations: boolean;
  onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void;
};

export function InventorySection({ draft, errors, hasCombinations, onChange }: Props) {
  const [codesOpen, setCodesOpen] = useState(Boolean(draft.sku.trim() || draft.barcode.trim()));
  const stock = /^\d{1,9}$/.test(draft.stock.trim()) ? Number(draft.stock.trim()) : 0;
  const threshold = /^\d{1,7}$/.test(draft.lowStockThreshold.trim()) ? Number(draft.lowStockThreshold.trim()) : null;
  const status = stockStatusOf(true, stock, 0, threshold);
  return (
    <Section title="Inventory" hint={hasCombinations ? "Each variant has its own stock. Manage quantities and stock codes in the variants below." : "Choose whether to count stock and how many items are available to sell."}>
      {hasCombinations ? <a className="jk-link" href="#pb-variant-list">Manage variant inventory</a> : <>
        <label className="jk-inventory-toggle"><input type="checkbox" checked={draft.trackInventory !== false} onChange={event => onChange("trackInventory", event.target.checked)} />Track stock</label>
        {draft.trackInventory !== false ? <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pb-stock" label="Quantity in stock" error={errors.stock} hint="Leave blank for zero. Customers cannot buy when tracked stock runs out.">
              <input id="pb-stock" inputMode="numeric" className={inputClass} value={draft.stock} aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? "pb-stock-error" : undefined} placeholder="0" onChange={event => onChange("stock", event.target.value)} />
            </Field>
            <div><p className="jk-label">Stock status</p><div className="mt-2"><StatusBadge tone={status === "out" ? "critical" : STOCK_STATUS_TONE[status]}>{STOCK_STATUS_LABEL[status]}</StatusBadge></div></div>
          </div>
          <Field id="pb-low-stock" label="Low stock warning at" error={errors.lowStockThreshold} hint={`Warn when this many or fewer are left. Leave blank to use ${DEFAULT_LOW_STOCK_THRESHOLD}.`}>
            <input id="pb-low-stock" inputMode="numeric" className={inputClass} value={draft.lowStockThreshold} aria-invalid={Boolean(errors.lowStockThreshold)} aria-describedby={errors.lowStockThreshold ? "pb-low-stock-error" : undefined} placeholder={String(DEFAULT_LOW_STOCK_THRESHOLD)} onChange={event => onChange("lowStockThreshold", event.target.value)} />
          </Field>
        </> : <p className="jk-section-hint">Stock is not counted. Customers can keep buying this product.</p>}
        <AnimatedDetails className="jk-disclosure jk-inset-disclosure" open={codesOpen} onToggle={event => setCodesOpen(event.currentTarget.open)}>
          <summary>SKU and barcode <span className="jk-field-kind">Optional</span></summary>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pb-sku" label="Stock code (SKU)" hint="Your own code for this item, for example MUG-001. It is also how a spreadsheet import finds the item again." error={errors.sku}>
              <input id="pb-sku" className={inputClass} value={draft.sku} onChange={event => onChange("sku", event.target.value)} />
            </Field>
            <Field id="pb-barcode" label="Barcode" hint="The number under the barcode on the packaging, if it has one." error={errors.barcode}>
              <input id="pb-barcode" className={inputClass} maxLength={80} value={draft.barcode} aria-invalid={Boolean(errors.barcode)} aria-describedby={errors.barcode ? "pb-barcode-error" : undefined} onChange={event => onChange("barcode", event.target.value)} />
            </Field>
          </div>
        </AnimatedDetails>
      </>}
    </Section>
  );
}
