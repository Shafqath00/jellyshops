"use client";

import { MAX_PERSONALISATION_FIELDS, MAX_PERSONALISATION_LENGTH, type PersonalisationField } from "@jelly/storefront-schema";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { Section } from "./section-parts";

type Props = {
  collapsible?: boolean;
  fields: PersonalisationField[];
  onChange: (fields: PersonalisationField[]) => void;
};

const newId = () => `field-${Math.random().toString(36).slice(2, 10)}`;
const toMajor = (minor?: number) => minor ? (minor / 100).toFixed(2) : "";
const toMinor = (text: string) => {
  const value = Math.round(Number(text) * 100);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/** Text the shopper types for each item: engraving, a name to print, a gift message or measurements. */
export function PersonalisationSection({ fields, onChange, collapsible }: Props) {
  const update = (index: number, patch: Partial<PersonalisationField>) => onChange(fields.map((field, position) => position === index ? { ...field, ...patch } : field));
  const remove = (index: number) => onChange(fields.filter((_, position) => position !== index));
  const add = () => onChange([...fields, { id: newId(), label: "", required: false, maxLength: 30 }]);
  // The builder moves focus here when a field still has no name.
  const firstMissing = fields.findIndex((field) => !field.label.trim());
  return (
    <Section collapsible={collapsible} defaultOpen={fields.length > 0} summary={fields.length ? `${fields.length} personalisation field${fields.length === 1 ? "" : "s"} configured` : "Ask customers for an engraving, gift message or other text."} title="Personalisation" hint="Ask shoppers for text with each item, such as an engraving, a name to print or a gift message. It appears on the order.">
      {fields.length === 0 && <p className="text-[13px] text-muted-foreground">No personalisation. Shoppers buy this product as it is.</p>}
      <ol className="space-y-3">
        {fields.map((field, index) => {
          const id = `pb-personalisation-${field.id}`;
          const labelId = index === firstMissing ? "pb-personalisation-missing" : `${id}-label`;
          return <li key={field.id} className="space-y-3 rounded-xl border border-border/80 bg-muted/25 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <label htmlFor={labelId} className="text-[13px] font-semibold text-foreground">What to ask for</label>
                <input id={labelId} className={inputClass} value={field.label} maxLength={80} placeholder="Engraving" aria-invalid={!field.label.trim() || undefined} onChange={(event) => update(index, { label: event.target.value })} />
                {!field.label.trim() && <p className="mt-1 text-[12px] font-semibold text-tint-foreground">Give this field a name.</p>}
              </div>
              <div>
                <label htmlFor={`${id}-length`} className="text-[13px] font-semibold text-foreground">Most characters</label>
                <input id={`${id}-length`} className={inputClass} type="number" min={1} max={MAX_PERSONALISATION_LENGTH} defaultValue={field.maxLength} onBlur={(event) => { const next = Math.max(1, Math.min(MAX_PERSONALISATION_LENGTH, Math.round(Number(event.target.value) || field.maxLength))); event.target.value = String(next); update(index, { maxLength: next }); }} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div>
                <label htmlFor={`${id}-help`} className="text-[13px] font-semibold text-foreground">Help text (optional)</label>
                <input id={`${id}-help`} className={inputClass} value={field.helpText ?? ""} maxLength={160} placeholder="Up to 12 letters, no symbols" onChange={(event) => update(index, { helpText: event.target.value || undefined })} />
              </div>
              <div>
                <label htmlFor={`${id}-price`} className="text-[13px] font-semibold text-foreground">Extra price (optional)</label>
                <input id={`${id}-price`} className={inputClass} inputMode="decimal" defaultValue={toMajor(field.priceAdjustmentMinor)} placeholder="0.00" onBlur={(event) => update(index, { priceAdjustmentMinor: toMinor(event.target.value) })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={(event) => update(index, { required: event.target.checked })} />Shoppers must fill this in</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={field.multiline === true} onChange={(event) => update(index, { multiline: event.target.checked || undefined })} />Larger box for longer text</label>
              <button type="button" className="ml-auto text-[13px] font-semibold text-tint-foreground underline" onClick={() => remove(index)} aria-label={`Remove ${field.label.trim() || "this field"}`}>Remove</button>
            </div>
          </li>;
        })}
      </ol>
      {fields.length < MAX_PERSONALISATION_FIELDS
        ? <button type="button" className="rounded-lg border border-border px-3 py-2 text-[13px] font-semibold" onClick={add}>Add a personalisation field</button>
        : <p className="text-[12px] text-muted-foreground">Up to {MAX_PERSONALISATION_FIELDS} fields per product.</p>}
    </Section>
  );
}
