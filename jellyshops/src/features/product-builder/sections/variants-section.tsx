"use client";

import { resolveProductGallery, type ProductMediaLike } from "@jelly/storefront-schema";
import { Fragment, useState } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor, minorToMajor, type ProductOption, type ProductVariant } from "@/lib/domain";
import { applyBulk, describeScope, type BulkField, type BulkScope } from "../bulk";
import { isUnlimitedStock } from "../draft";
import { Section } from "./section-parts";
import { VariantDetails } from "./variant-details";
import type { InputContext } from "../metafields/metafield-input";
import type { ProductMetafields } from "../metafields/use-product-metafields";
import { WEIGHT_UNITS, type WeightUnit } from "../shipping";

type Props = {
  media?: ProductMediaLike[];
  options: ProductOption[];
  variants: ProductVariant[];
  currency: string;
  /** The product's photos, offered for each combination. */
  photos?: ProductMediaLike[];
  /** False for downloadable products, whose combinations are never shipped. */
  physical?: boolean;
  /** Custom fields set per combination, when the store has any. */
  custom?: ProductMetafields;
  customContext?: InputContext;
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

function CompareAtPriceCell({ id, label, minor, priceMinor, onCommit }: { id: string; label: string; minor: number | undefined; priceMinor: number; onCommit: (minor: number | undefined) => void }) {
  const [text, setText] = useState(minor ? minorToMajor(minor) : "");
  const [seen, setSeen] = useState(minor);
  const [editMessage, setEditMessage] = useState("");
  if (seen !== minor) { setSeen(minor); setText(minor ? minorToMajor(minor) : ""); }
  const parsed = majorToMinor(text);
  const invalid = text.trim() !== "" && (!Number.isFinite(parsed) || parsed <= priceMinor);
  return (
    <>
      <input id={id} aria-label={label} aria-describedby={editMessage ? `${id}-feedback` : undefined} inputMode="decimal" aria-invalid={invalid} placeholder="Optional" value={text} className={`${inputClass} !mt-0 h-9 w-28 ${invalid ? "border-tint-border" : ""}`}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        setEditMessage("");
        if (nextText.trim() === "") return;
        const next = majorToMinor(nextText);
        if (Number.isFinite(next) && next > priceMinor) { setSeen(next); onCommit(next); }
      }}
      onBlur={() => {
        if (!text.trim()) {
          if (minor !== undefined) { setSeen(undefined); onCommit(undefined); }
        } else if (invalid) {
          setText(minor ? minorToMajor(minor) : "");
          setSeen(minor);
          setEditMessage("Original price must be higher than this price. The previous value was kept.");
        }
      }} />
      {editMessage && <p id={`${id}-feedback`} role="status" className="mt-1 max-w-32 text-[12px] leading-4 text-destructive">{editMessage}</p>}
    </>
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

export function VariantsSection({ options, variants, currency, onChange, media, photos = [], physical = true, custom, customContext }: Props) {
  const axes = options.filter((option) => option.type === "variant" && option.values.length > 0);
  const [scopeKey, setScopeKey] = useState("");
  const [field, setField] = useState<BulkField>("price");
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [scopeOption, scopeValue] = scopeKey.split("|");
  const scope: BulkScope = scopeOption && scopeValue ? { optionId: scopeOption, valueId: scopeValue } : null;

  function apply() {
    runBulk(field, bulkText);
  }
  function runBulk(bulkField: BulkField, value: string) {
    const result = applyBulk(variants, scope, bulkField, value, weightUnit);
    if ("error" in result) return setBulkError(result.error);
    setBulkError("");
    onChange(result.variants);
    setBulkText("");
    // Open details show what was typed before the bulk change; close them so they reopen with the new values.
    setOpenId(null);
  }
  const patch = (id: string, change: Partial<ProductVariant>) => onChange(variants.map((variant) => variant.id === id ? { ...variant, ...change } : variant));

  if (axes.length === 0) return null;
  return (
    <Section title="Variants" hint={`${variants.length} ${variants.length === 1 ? "combination" : "combinations"}, made from your choices. Set each price, stock and SKU, with an optional original price. Open Details for photo, barcode, cost, weight and more, or stop selling a combination.`}>
      <div className="product-variants relative overflow-x-auto rounded-xl border border-border/80 bg-card">
        <table className="w-full min-w-[680px] text-left text-[12px]">
          <thead className="bg-muted/65 text-[13px] font-semibold text-muted-foreground">
            <tr>{media && <th className="px-2 py-2.5">Photo</th>}<th className="px-4 py-2.5">Combination</th><th className="px-2 py-2.5">Price ({currency})</th><th className="px-2 py-2.5">Original price</th><th className="px-2 py-2.5">Stock</th><th className="px-2 py-2.5">SKU</th><th className="px-2 py-2.5">Sold</th><th className="px-2 py-2.5"><span className="sr-only">Details</span></th></tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <Fragment key={variant.id}>
              <tr className={`border-t border-border/80 transition-colors hover:bg-muted/25 ${variant.sellable === false ? "opacity-70" : ""}`}>
                {media && <td className="px-2 py-2">{ (() => { const photo = resolveProductGallery(media, options, Object.entries(variant.options ?? {}).map(([optionId, valueId]) => ({ optionId, valueId })))[0]; return photo ? <img src={photo.url} alt={photo.altText ?? ""} className="size-10 rounded object-cover" /> : null; })()}</td>}
                <th scope="row" className="px-4 py-2 font-semibold text-foreground">{variant.name}{variant.sellable === false && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Not sold</span>}</th>
                <td className="px-2 py-2"><PriceCell id={`price-${variant.id}`} label={`Price for ${variant.name}`} minor={variant.priceMinor} onCommit={(priceMinor) => patch(variant.id, { priceMinor })} /></td>
                <td className="px-2 py-2"><CompareAtPriceCell id={`compare-${variant.id}`} label={`Original price for ${variant.name}`} minor={variant.compareAtPriceMinor} priceMinor={variant.priceMinor} onCommit={(compareAtPriceMinor) => patch(variant.id, { compareAtPriceMinor })} /></td>
                <td className="px-2 py-2"><label className="mb-2 flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`Track stock for ${variant.name}`} checked={variant.trackInventory !== false} onChange={event => patch(variant.id, { trackInventory: event.target.checked, ...(event.target.checked && variant.stock >= Number.MAX_SAFE_INTEGER ? { stock: 0 } : {}) })} />Track stock</label>{variant.trackInventory !== false ? <StockCell label={`Stock for ${variant.name}`} stock={variant.stock} onCommit={(stock) => patch(variant.id, { stock })} /> : <span className="text-muted-foreground">Not tracked</span>}</td>
                <td className="px-2 py-2"><input aria-label={`SKU for ${variant.name}`} className={`${inputClass} !mt-0 h-9 w-36`} value={variant.sku} onChange={(event) => patch(variant.id, { sku: event.target.value })} /></td>
                <td className="px-2 py-2"><input type="checkbox" aria-label={`Sell ${variant.name}`} checked={variant.sellable !== false} onChange={(event) => patch(variant.id, { sellable: event.target.checked })} /></td>
                <td className="px-2 py-2"><button type="button" aria-expanded={openId === variant.id} aria-controls={`details-${variant.id}`} aria-label={`${openId === variant.id ? "Hide" : "Show"} details for ${variant.name}`} className="whitespace-nowrap text-[12px] font-semibold underline" onClick={() => setOpenId(openId === variant.id ? null : variant.id)}>{openId === variant.id ? "Hide details" : "Details"}</button></td>
              </tr>
              {openId === variant.id && (
                <tr id={`details-${variant.id}`} className="bg-muted/20"><td colSpan={9 + (media ? 1 : 0)}><VariantDetails variant={variant} photos={photos} physical={physical} currency={currency} custom={custom} customContext={customContext} onPatch={(change) => patch(variant.id, change)} /></td></tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
        <p className="text-[13px] font-semibold text-foreground">Set the same value for many combinations</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Handy when you have lots of combinations. Pick what to change, which combinations, then the new value.</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[13px] font-medium text-muted-foreground">Set
            <select aria-label="Bulk field" className={`${inputClass} !mt-1 h-9`} value={field} onChange={(event) => { setField(event.target.value as BulkField); setBulkError(""); }}>
              <option value="price">price</option>
              <option value="stock">stock</option>
              <option value="cost">cost per item</option>
              <option value="weight">weight</option>
              <option value="lowStock">low stock warning</option>
            </select>
          </label>
          <label className="text-[13px] font-medium text-muted-foreground">for
            <select aria-label="Bulk scope" className={`${inputClass} !mt-1 h-9`} value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>
              <option value="">all combinations</option>
              {axes.map((axis) => (
                <optgroup key={axis.id} label={axis.name || "Choice"}>
                  {axis.values.map((value) => <option key={value.id} value={`${axis.id}|${value.id}`}>all {value.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium text-muted-foreground">to
            <input aria-label="Bulk value" inputMode="decimal" className={`${inputClass} !mt-1 h-9 w-28`} value={bulkText} placeholder={field === "price" ? currency : "0"} onChange={(event) => setBulkText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(); } }} />
          </label>
          {field === "weight" && (
            <label className="text-[13px] font-medium text-muted-foreground">in
              <select aria-label="Bulk weight unit" className={`${inputClass} !mt-1 h-9`} value={weightUnit} onChange={(event) => setWeightUnit(event.target.value as WeightUnit)}>
                {WEIGHT_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={apply} className="min-h-10 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Apply to {describeScope(scope, options)}</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <span className="text-[13px] font-medium text-muted-foreground">Availability for {describeScope(scope, options)}:</span>
          <button type="button" onClick={() => runBulk("availability", "stop")} className="min-h-9 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold hover:bg-muted">Stop selling</button>
          <button type="button" onClick={() => runBulk("availability", "sell")} className="min-h-9 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold hover:bg-muted">Sell</button>
        </div>
        {bulkError && <p role="alert" className="mt-2 text-[13px] font-bold text-tint-foreground">{bulkError}</p>}
      </div>
    </Section>
  );
}
