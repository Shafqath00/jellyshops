"use client";

import { useMemo, useState } from "react";
import { cardClass } from "@/features/commerce/components/product-form-styles";
import { formatMoney, type ConfiguredOptionSelection, type Currency, type ProductOption } from "@/lib/domain";
import type { ProductDraft } from "./draft";
import { computePreview, draftToProduct, pruneSelections, toggleSelection } from "./preview";

/**
 * Try-it-yourself preview of the product page. It runs the storefront's own variant and price helpers on the
 * unsaved draft, so required choices, price changes and sold-out combinations behave as they will for shoppers.
 */
export function BuyerPreview({ draft, currency, categoryLabel }: { draft: ProductDraft; currency: string; categoryLabel?: string }) {
  const product = useMemo(() => draftToProduct(draft), [draft]);
  const [rawSelections, setSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [added, setAdded] = useState("");
  const selections = pruneSelections(product.options ?? [], rawSelections);
  const state = computePreview(product, selections);
  const money = (minor: number) => { try { return formatMoney(minor, currency as Currency); } catch { return `${currency} ${(minor / 100).toFixed(2)}`; } };
  const picked = (option: ProductOption) => selections.filter((selection) => selection.optionId === option.id).map((selection) => selection.valueId);
  const shownProblems = attempted ? state.problems : [];
  const problemFor = (optionId: string) => shownProblems.find((problem) => problem.optionId === optionId);
  const hasMultiple = state.options.some((option) => option.type !== "variant" && option.multiple);

  function choose(option: ProductOption, valueId: string) {
    setSelections(toggleSelection(option, selections, valueId));
    setAdded("");
  }
  function addToCart() {
    setAttempted(true);
    if (state.problems.length > 0 || !state.variant || state.soldOut) return;
    setAdded(`Added to cart. Total ${money(state.priceMinor ?? 0)}`);
  }
  const buttonLabel = state.soldOut ? "Sold out" : "Add to cart";

  return (
    <aside className={`${cardClass} lg:sticky lg:top-6`} aria-label="Preview of what shoppers will see">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">What shoppers see</p>
      <p className="mt-1 text-[10px] text-muted-foreground">Try it: pick options and press Add to cart. Nothing is saved or ordered.</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <div className="grid aspect-square place-items-center bg-muted/50 text-[11px] font-bold text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="size-full object-cover" /> : "Your photo"}
        </div>
        <div className="space-y-3 p-4">
          {categoryLabel && <p className="text-[10px] font-bold text-muted-foreground">{categoryLabel}</p>}
          <h3 className="text-[15px] font-black text-foreground">{product.name}</h3>
          <p className="flex items-baseline gap-2 text-[14px] font-black text-foreground" aria-live="polite">
            {state.priceMinor !== undefined && Number.isFinite(state.priceMinor) ? `${state.fromPrice ? "From " : ""}${money(state.priceMinor)}` : "Price"}
            {state.compareAtMinor !== undefined && <s className="text-[12px] font-semibold text-muted-foreground">{money(state.compareAtMinor)}</s>}
          </p>

          {state.options.filter((option) => state.visible.has(option.id)).map((option) => {
            const problem = problemFor(option.id);
            const chosen = picked(option);
            return (
              <div key={option.id} data-testid="preview-choice">
                <p id={`pv-${option.id}`} className="text-[11px] font-black text-foreground">{option.name}{option.required && <span aria-label="required" className="text-tint-foreground"> *</span>}{!option.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</p>
                {option.display === "dropdown" ? (
                  <select aria-labelledby={`pv-${option.id}`} aria-invalid={Boolean(problem)} value={chosen[0] ?? ""} multiple={Boolean(option.multiple && option.type !== "variant")}
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-[11px] font-semibold"
                    onChange={(event) => { const value = event.target.value; if (value) choose(option, value); else setSelections(selections.filter((selection) => selection.optionId !== option.id)); }}>
                    {!option.required && <option value="">None</option>}
                    {option.required && !chosen[0] && <option value="">Choose…</option>}
                    {option.values.map((value) => <option key={value.id} value={value.id}>{value.label}{value.priceAdjustmentMinor > 0 ? ` (+${money(value.priceAdjustmentMinor)})` : ""}</option>)}
                  </select>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5" role={option.multiple && option.type !== "variant" ? "group" : "radiogroup"} aria-labelledby={`pv-${option.id}`}>
                    {option.values.map((value) => {
                      const status = state.valueStatus(option.id, value.id);
                      const on = chosen.includes(value.id);
                      return (
                        <button key={value.id} type="button" role={option.multiple && option.type !== "variant" ? "checkbox" : "radio"} aria-checked={on}
                          title={status === "sold-out" ? "Sold out" : status === "unavailable" ? "Unavailable" : undefined}
                          onClick={() => choose(option, value.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted"} ${status !== "available" ? "line-through opacity-50" : ""}`}>
                          {option.display === "color" && value.color && <span aria-hidden className="size-2.5 rounded-full border border-border" style={{ background: value.color }} />}
                          {value.label}
                          {value.priceAdjustmentMinor > 0 && <span className={on ? "opacity-80" : "text-muted-foreground"}>+{money(value.priceAdjustmentMinor)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {problem && <p role="alert" className="mt-1 text-[10px] font-bold text-tint-foreground">{problem.message}</p>}
              </div>
            );
          })}

          <div>
            <button type="button" onClick={addToCart} disabled={state.soldOut} className="h-10 w-full rounded-full bg-primary text-[12px] font-black text-primary-foreground disabled:opacity-50">{buttonLabel}</button>
            {state.options.some((option) => state.visible.has(option.id)) && <p data-testid="preview-availability" className="mt-1.5 text-[10px] text-muted-foreground">{state.availability}</p>}
            {added && <p role="status" className="mt-1.5 text-[11px] font-bold text-success">{added}</p>}
          </div>

          {hasMultiple && <p className="rounded-lg bg-muted/60 px-3 py-2 text-[10px] text-muted-foreground">Letting shoppers pick several isn&apos;t live in your store yet. It&apos;s coming, so this is how it will work.</p>}
          {!draft.published && <p className="text-[10px] font-bold text-muted-foreground">Saved as a draft: hidden from your store.</p>}
        </div>
      </div>
    </aside>
  );
}
