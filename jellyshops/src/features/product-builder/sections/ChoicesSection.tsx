"use client";

import { Plus, Sparkles } from "lucide-react";
import type { ProductOption } from "@/lib/domain";
import { MAX_VARIANT_AXES, MAX_VARIANTS } from "@/lib/product-builder";
import { choiceFromTemplate, moveChoice, newChoice, unusedTemplates } from "../choices";
import type { TaxonomyTemplate } from "../taxonomy";
import { ChoiceCard } from "./ChoiceCard";
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
    <Section title="Choices" hint="Does it come in different sizes, colours or materials? Add what shoppers can pick. Skip this for a simple product.">
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-foreground"><Sparkles size={13} />Suggested for {categoryName ?? "this category"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((template) => (
              <button key={template.id} type="button" onClick={() => add(choiceFromTemplate(template, options.length))} className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-[11px] font-black text-tint-foreground hover:bg-muted">
                <Plus size={12} />{template.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Suggestions only. Change the name and values however you like.</p>
        </div>
      )}

      {options.map((option, index) => (
        <ChoiceCard key={option.id} option={option} index={index} count={options.length} onChange={update}
          onRemove={() => onChange(options.filter((item) => item.id !== option.id).map((item, position) => ({ ...item, position })))}
          onMove={(direction) => onChange(moveChoice(options, option.id, direction))} />
      ))}

      {limitError && <p role="alert" className="rounded-xl border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">{limitError} Try “Changes the price only” for choices that don&apos;t need separate stock.</p>}
      {axes > MAX_VARIANT_AXES && <p role="alert" className="text-[11px] font-bold text-tint-foreground">Stock can be tracked for at most {MAX_VARIANT_AXES} choices. Switch one to “Changes the price only”.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => add(newChoice(options.length))} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-4 text-[11px] font-black text-tint-foreground hover:bg-muted">
          <Plus size={13} />{options.length === 0 ? "This product comes in different options" : "Add another choice"}
        </button>
        {options.length > 0 && <span className="text-[10px] text-muted-foreground">Up to {MAX_VARIANTS} combinations can be sold with their own stock.</span>}
      </div>
    </Section>
  );
}
