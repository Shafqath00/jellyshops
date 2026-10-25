import { cardClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor } from "@/lib/domain";
import { effectiveVariants, hasVariantAxes, isUnlimitedStock, type ProductDraft } from "./draft";

function format(minor: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}

/** Static preview of the product card and its choices. The interactive buyer preview comes next. */
export function BuyerPreview({ draft, currency, categoryLabel }: { draft: ProductDraft; currency: string; categoryLabel?: string }) {
  const axes = hasVariantAxes(draft);
  const prices = effectiveVariants(draft).map((variant) => variant.priceMinor).filter((minor) => Number.isFinite(minor));
  const low = prices.length ? Math.min(...prices) : NaN;
  const high = prices.length ? Math.max(...prices) : NaN;
  const priceText = Number.isFinite(low) ? `${axes && low !== high ? "From " : ""}${format(low, currency)}` : "Price";
  const originalMinor = !axes && draft.compareAtPrice.trim() ? majorToMinor(draft.compareAtPrice) : NaN;
  const variants = effectiveVariants(draft);
  const soldOut = !axes ? draft.stock.trim() !== "" && Number(draft.stock) === 0 : variants.length > 0 && variants.every((variant) => !isUnlimitedStock(variant.stock) && variant.stock === 0);
  const choices = draft.options.filter((option) => option.name.trim() && option.values.length > 0);
  return (
    <aside className={`${cardClass} lg:sticky lg:top-6`} aria-label="Preview of what shoppers will see">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">What shoppers see</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <div className="grid aspect-square place-items-center bg-muted/50 text-[11px] font-bold text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="size-full object-cover" /> : "Your photo"}
        </div>
        <div className="space-y-2 p-4">
          {categoryLabel && <p className="text-[10px] font-bold text-muted-foreground">{categoryLabel}</p>}
          <h3 className="text-[15px] font-black text-foreground">{draft.title.trim() || "Product name"}</h3>
          <p className="flex items-baseline gap-2 text-[14px] font-black text-foreground">
            {priceText}
            {Number.isFinite(originalMinor) && Number.isFinite(low) && <s className="text-[12px] font-semibold text-muted-foreground">{format(originalMinor, currency)}</s>}
          </p>
          {choices.map((option) => (
            <div key={option.id} data-testid="preview-choice">
              <p className="text-[11px] font-black text-foreground">{option.name.trim()}{option.required && <span aria-label="required" className="text-tint-foreground"> *</span>}{!option.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {option.values.filter((value) => value.label.trim()).map((value) => (
                  <span key={value.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-foreground">
                    {option.display === "color" && value.color && <span aria-hidden className="size-2.5 rounded-full border border-border" style={{ background: value.color }} />}
                    {value.label.trim()}
                    {value.priceAdjustmentMinor > 0 && <span className="text-muted-foreground">+{format(value.priceAdjustmentMinor, currency)}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button type="button" disabled className="mt-2 h-10 w-full rounded-full bg-primary text-[12px] font-black text-primary-foreground opacity-80">{soldOut ? "Sold out" : "Add to cart"}</button>
          {!draft.published && <p className="text-[10px] font-bold text-muted-foreground">Saved as a draft: hidden from your store.</p>}
        </div>
      </div>
    </aside>
  );
}
