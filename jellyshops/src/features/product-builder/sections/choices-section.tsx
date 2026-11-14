"use client";

import { AnimatedDetails } from "../animated-details";
import { Plus, Sparkles } from "lucide-react";
import type { ProductOption } from "@/lib/domain";
import { MAX_VARIANT_AXES, MAX_VARIANTS } from "@/lib/product-builder";
import { choiceFromTemplate, moveChoice, newChoice, unusedTemplates } from "../choices";
import type { TaxonomyTemplate } from "../taxonomy";
import { ChoiceCard } from "./choice-card";
import { Section } from "./section-parts";

type Props = {
  options: ProductOption[];
  /** Suggestions for the chosen category (inherited from its parents). */
  templates: TaxonomyTemplate[];
  categoryName?: string;
  /** Plain-language reason the current choices cannot be turned into combinations. */
  limitError?: string;
  onChange: (options: ProductOption[]) => void;
};

export function ChoicesSection({ options, templates, categoryName, limitError, onChange }: Props) {
  const suggestions = unusedTemplates(templates, options);
  const axes = options.filter((option) => option.type === "variant").length;
  const add = (option: ProductOption) => onChange([...options, option]);
  const update = (next: ProductOption) => onChange(options.map((option) => option.id === next.id ? next : option));

  return (
    <div className="product-options"><Section title="Product options" hint="Add a size or colour when each version needs its own price or stock.">
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-accent/70 bg-accent/15 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground"><Sparkles size={14} />Suggested for {categoryName ?? "this category"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((template) => (
              <button key={template.id} type="button" onClick={() => add(choiceFromTemplate(template, options.length))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Plus size={12} />{template.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Suggestions only. You can change the name and values.</p>
        </div>
      )}

      {options.filter(option => option.type === "variant").map((option) => { const index = options.findIndex(item => item.id === option.id); return (
        <ChoiceCard key={option.id} option={option} index={index} count={options.length} onChange={update}
          onRemove={() => onChange(options.filter((item) => item.id !== option.id).map((item, position) => ({ ...item, position })))}
          onMove={(direction) => onChange(moveChoice(options, option.id, direction))} />
      ); })}

      <AnimatedDetails className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-[13px] font-medium">Customer customizations</summary><p className="my-2 text-xs text-muted-foreground">Offer materials, personalization or optional extras without separate stock.</p>{options.filter(option => option.type !== "variant").map(option => <ChoiceCard key={option.id} option={option} index={options.findIndex(item => item.id === option.id)} count={options.length} onChange={update} onRemove={() => onChange(options.filter(item => item.id !== option.id))} onMove={direction => onChange(moveChoice(options, option.id, direction))} />)}<button type="button" className="jk-button mt-3" onClick={() => add(newChoice(options.length, "configuration"))}>Add customization</button></AnimatedDetails>

      {limitError && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-[12px] leading-5 text-destructive">{limitError} Try “Changes the price only” for choices that don&apos;t need separate stock.</p>}
      {axes > MAX_VARIANT_AXES && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-[12px] leading-5 text-destructive">Stock can be tracked for at most {MAX_VARIANT_AXES} choices. Switch one to “Changes the price only”.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => add(newChoice(options.length))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-border bg-muted/35 px-4 text-[13px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus size={15} />{options.length === 0 ? "Add options like size or colour" : "Add another option"}
        </button>
        {options.length > 0 && <span className="text-[12px] text-muted-foreground">Up to {MAX_VARIANTS} combinations can have their own stock.</span>}
      </div>
    </Section></div>
  );
}
