"use client";

import { MAX_QUANTITY_RULE_VALUE, quantityRuleProblems, quantityRuleText, type QuantityRule } from "@jelly/storefront-schema";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { Section } from "./section-parts";

type Props = {
  rule: QuantityRule | null;
  onChange: (rule: QuantityRule | null) => void;
};

const read = (text: string): number | undefined => {
  const value = Math.round(Number(text));
  return text.trim() && Number.isFinite(value) ? value : undefined;
};

/** Quantity rules: a minimum order, steps (sold in sixes) and a most per order, for each size or colour. */
export function QuantityRuleSection({ rule, onChange }: Props) {
  const current = rule ?? { min: 1, step: 1 };
  const problems = rule ? quantityRuleProblems(rule) : [];
  const set = (patch: Partial<QuantityRule>) => {
    const next = { ...current, ...patch };
    if (next.max === undefined) delete next.max;
    onChange(next.min <= 1 && next.step <= 1 && next.max === undefined ? null : next);
  };
  const summary = rule && !problems.length ? quantityRuleText(rule) : "";
  return (
    <Section title="Quantity rules" hint="Set a minimum order, sell in steps (for example packs of 6) or limit how many one shopper can buy. They apply to each size or colour.">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="pb-quantity-min" className="text-[13px] font-semibold text-foreground">Minimum order</label>
          <input id="pb-quantity-min" className={inputClass} type="number" min={1} max={MAX_QUANTITY_RULE_VALUE} step={1} value={current.min} aria-invalid={problems.some((problem) => problem.includes("minimum")) || undefined} aria-describedby="pb-quantity-help" onChange={(event) => set({ min: read(event.target.value) ?? 1 })} />
        </div>
        <div>
          <label htmlFor="pb-quantity-step" className="text-[13px] font-semibold text-foreground">Sold in steps of</label>
          <input id="pb-quantity-step" className={inputClass} type="number" min={1} max={MAX_QUANTITY_RULE_VALUE} step={1} value={current.step} aria-describedby="pb-quantity-help" onChange={(event) => set({ step: read(event.target.value) ?? 1 })} />
        </div>
        <div>
          <label htmlFor="pb-quantity-max" className="text-[13px] font-semibold text-foreground">Most per order (optional)</label>
          <input id="pb-quantity-max" className={inputClass} type="number" min={1} max={MAX_QUANTITY_RULE_VALUE} step={1} value={current.max ?? ""} placeholder="No limit" aria-invalid={problems.some((problem) => problem.includes("most")) || undefined} aria-describedby="pb-quantity-help" onChange={(event) => set({ max: read(event.target.value) })} />
        </div>
      </div>
      <p id="pb-quantity-help" className="text-[12px] text-muted-foreground" aria-live="polite">
        {problems.length ? <span className="font-semibold text-tint-foreground">{problems[0]}</span> : summary ? `Shoppers see: ${summary}.` : "No rules. Shoppers can buy any quantity."}
      </p>
    </Section>
  );
}
