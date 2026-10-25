import { cardClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor } from "@/lib/domain";
import type { ProductDraft } from "./draft";

function money(text: string, currency: string) {
  const minor = majorToMinor(text);
  if (!Number.isFinite(minor)) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}

/** Simple-product preview. The interactive buyer preview arrives with the choices section. */
export function BuyerPreview({ draft, currency, categoryLabel }: { draft: ProductDraft; currency: string; categoryLabel?: string }) {
  const price = money(draft.price, currency);
  const original = draft.compareAtPrice.trim() ? money(draft.compareAtPrice, currency) : "";
  const soldOut = draft.stock.trim() !== "" && Number(draft.stock) === 0;
  return (
    <aside className={`${cardClass} lg:sticky lg:top-6`} aria-label="Preview of what shoppers will see">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">What shoppers see</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <div className="grid aspect-square place-items-center bg-muted/50 text-[11px] font-bold text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="size-full object-cover" /> : "Your photo"}
        </div>
        <div className="space-y-1.5 p-4">
          {categoryLabel && <p className="text-[10px] font-bold text-muted-foreground">{categoryLabel}</p>}
          <h3 className="text-[15px] font-black text-foreground">{draft.title.trim() || "Product name"}</h3>
          <p className="flex items-baseline gap-2 text-[14px] font-black text-foreground">
            {price || "Price"}
            {original && price && <s className="text-[12px] font-semibold text-muted-foreground">{original}</s>}
          </p>
          <button type="button" disabled className="mt-2 h-10 w-full rounded-full bg-primary text-[12px] font-black text-primary-foreground opacity-80">{soldOut ? "Sold out" : "Add to cart"}</button>
          {!draft.published && <p className="text-[10px] font-bold text-muted-foreground">Saved as a draft: hidden from your store.</p>}
        </div>
      </div>
    </aside>
  );
}
