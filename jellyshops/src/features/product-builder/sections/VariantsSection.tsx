"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor, minorToMajor, type ProductOption, type ProductVariant } from "@/lib/domain";
import { applyBulk, describeScope, type BulkField, type BulkScope } from "../bulk";
import { isUnlimitedStock } from "../draft";
import { Section } from "./section-parts";

type Props = {
  options: ProductOption[];
  variants: ProductVariant[];
  currency: string;
  onChange: (variants: ProductVariant[]) => void;
};

function PriceCell({ id, label, minor, onCommit }: { id: string; label: string; minor: number; onCommit: (minor: number) => void }) {
  const [text, setText] = useState(minorToMajor(minor));
  const [seen, setSeen] = useState(minor);
  // A bulk edit changes the value from outside; adopt it instead of showing stale text.
  if (seen !== minor && majorToMinor(text) !== minor) { setSeen(minor); setText(minorToMajor(minor)); }
  const invalid = !Number.isFinite(majorToMinor(text));
  return (
    <input id={id} aria-label={label} inputMode="decimal" aria-invalid={invalid} value={text} className={`${inputClass} !mt-0 h-9 w-28 ${invalid ? "border-tint-border" : ""}`}
      onChange={(event) => { setText(event.target.value); const parsed = majorToMinor(event.target.value); if (Number.isFinite(parsed) && parsed >= 0) { setSeen(parsed); onCommit(parsed); } }} />
  );
}

function StockCell({ label, stock, onCommit }: { label: string; stock: number; onCommit: (stock: number) => void }) {
  const unlimited = isUnlimitedStock(stock);
  const [text, setText] = useState(unlimited ? "" : String(stock));
  const [seen, setSeen] = useState(stock);
  if (seen !== stock && !unlimited && Number(text) !== stock) { setSeen(stock); setText(String(stock)); }
  const invalid = text.trim() !== "" && !/^\d{1,9}$/.test(text.trim());
  return (
    <input aria-label={label} inputMode="numeric" aria-invalid={invalid} value={text} placeholder={unlimited ? "Unlimited" : "0"} className={`${inputClass} !mt-0 h-9 w-24 ${invalid ? "border-tint-border" : ""}`}
      onChange={(event) => { setText(event.target.value); if (/^\d{1,9}$/.test(event.target.value.trim())) { const next = Number(event.target.value); setSeen(next); onCommit(next); } }} />
  );
}

export function VariantsSection({ options, variants, currency, onChange }: Props) {
  const axes = options.filter((option) => option.type === "variant" && option.values.length > 0);
  const [scopeKey, setScopeKey] = useState("");
  const [field, setField] = useState<BulkField>("price");
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [scopeOption, scopeValue] = scopeKey.split("|");
  const scope: BulkScope = scopeOption && scopeValue ? { optionId: scopeOption, valueId: scopeValue } : null;

  function apply() {
    const result = applyBulk(variants, scope, field, bulkText);
    if ("error" in result) return setBulkError(result.error);
    setBulkError("");
    onChange(result.variants);
    setBulkText("");
  }
  const patch = (id: string, change: Partial<ProductVariant>) => onChange(variants.map((variant) => variant.id === id ? { ...variant, ...change } : variant));

  if (axes.length === 0) return null;
  return (
    <Section title="Combinations" hint={`${variants.length} ${variants.length === 1 ? "combination" : "combinations"}, made from your choices. Give each its own price, stock and SKU.`}>
      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <p className={labelClass}>Set many at once</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-bold text-muted-foreground">Set
            <select aria-label="Bulk field" className={`${inputClass} !mt-1 h-9`} value={field} onChange={(event) => { setField(event.target.value as BulkField); setBulkError(""); }}>
              <option value="price">price</option>
              <option value="stock">stock</option>
            </select>
          </label>
          <label className="text-[10px] font-bold text-muted-foreground">for
            <select aria-label="Bulk scope" className={`${inputClass} !mt-1 h-9`} value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>
              <option value="">all combinations</option>
              {axes.map((axis) => (
                <optgroup key={axis.id} label={axis.name || "Choice"}>
                  {axis.values.map((value) => <option key={value.id} value={`${axis.id}|${value.id}`}>all {value.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-muted-foreground">to
            <input aria-label="Bulk value" inputMode="decimal" className={`${inputClass} !mt-1 h-9 w-28`} value={bulkText} placeholder={field === "price" ? currency : "0"} onChange={(event) => setBulkText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(); } }} />
          </label>
          <button type="button" onClick={apply} className="h-9 rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground">Apply to {describeScope(scope, options)}</button>
        </div>
        {bulkError && <p role="alert" className="mt-2 text-[11px] font-bold text-tint-foreground">{bulkError}</p>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">
            <tr><th className="px-4 py-2.5">Combination</th><th className="px-2 py-2.5">Price ({currency})</th><th className="px-2 py-2.5">Stock</th><th className="px-2 py-2.5">SKU</th></tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id} className="border-t border-border">
                <th scope="row" className="px-4 py-2 font-black text-foreground">{variant.name}</th>
                <td className="px-2 py-2"><PriceCell id={`price-${variant.id}`} label={`Price for ${variant.name}`} minor={variant.priceMinor} onCommit={(priceMinor) => patch(variant.id, { priceMinor })} /></td>
                <td className="px-2 py-2"><StockCell label={`Stock for ${variant.name}`} stock={variant.stock} onCommit={(stock) => patch(variant.id, { stock })} /></td>
                <td className="px-2 py-2"><input aria-label={`SKU for ${variant.name}`} className={`${inputClass} !mt-0 h-9 w-36`} value={variant.sku} onChange={(event) => patch(variant.id, { sku: event.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
