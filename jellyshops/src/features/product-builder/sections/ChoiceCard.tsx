"use client";

import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { useState } from "react";
import { inputClass, labelClass } from "@/features/commerce/components/product-form-styles";
import { majorToMinor, minorToMajor, type ProductOption, type ProductOptionDisplay } from "@/lib/domain";
import { CHOICE_KINDS, withAddedValues, withKind, withoutValue, withValuePatch } from "../choices";

type Props = {
  option: ProductOption;
  index: number;
  count: number;
  onChange: (option: ProductOption) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
};

const DISPLAYS: Array<{ value: ProductOptionDisplay; label: string }> = [
  { value: "buttons", label: "Buttons" },
  { value: "dropdown", label: "Dropdown" },
  { value: "color", label: "Colour swatches" },
];

/** Price changes are typed as text and committed when valid, so "4." and "" never corrupt the value. */
function SurchargeInput({ id, minor, onCommit }: { id: string; minor: number; onCommit: (minor: number) => void }) {
  const [text, setText] = useState(minor ? minorToMajor(minor) : "");
  const invalid = text.trim() !== "" && !Number.isFinite(majorToMinor(text));
  return (
    <input
      id={id} inputMode="decimal" placeholder="0" aria-invalid={invalid} value={text}
      className={`${inputClass} !mt-0 h-9 w-24 ${invalid ? "border-tint-border" : ""}`}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = event.target.value.trim() === "" ? 0 : majorToMinor(event.target.value);
        if (Number.isFinite(parsed)) onCommit(parsed);
      }}
    />
  );
}

export function ChoiceCard({ option, index, count, onChange, onRemove, onMove }: Props) {
  const [draftValue, setDraftValue] = useState("");
  const id = `choice-${option.id}`;
  const variant = option.type === "variant";
  const label = option.name.trim() || `Choice ${index + 1}`;

  function addValues() {
    if (!draftValue.trim()) return;
    onChange(withAddedValues(option, draftValue));
    setDraftValue("");
  }

  return (
    <fieldset className="rounded-2xl border border-border bg-card p-4" aria-label={label}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className={labelClass}>Choice name</label>
          <input id={`${id}-name`} className={inputClass} value={option.name} placeholder="e.g. Size, Colour, Material" onChange={(event) => onChange({ ...option, name: event.target.value })} />
        </div>
        <div className="mt-6 flex shrink-0 gap-1">
          <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground disabled:opacity-30"><ArrowUp size={13} /></button>
          <button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground disabled:opacity-30"><ArrowDown size={13} /></button>
          <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="mt-4" role="radiogroup" aria-label={`How ${label} works`}>
        <p className={labelClass}>How does it work?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {CHOICE_KINDS.map((kind) => (
            <button key={kind.kind} type="button" role="radio" aria-checked={option.type === kind.kind} onClick={() => onChange(withKind(option, kind.kind))}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${option.type === kind.kind ? "border-tint-border bg-muted" : "border-border hover:bg-muted/50"}`}>
              <span className="block text-[12px] font-black text-foreground">{kind.label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{kind.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Values</p>
        <ul className="mt-2 space-y-2">
          {option.values.map((value, valueIndex) => (
            <li key={value.id} className="flex items-center gap-2">
              <input aria-label={`${label} value ${valueIndex + 1}`} className={`${inputClass} !mt-0 h-9 min-w-0 flex-1`} value={value.label} onChange={(event) => onChange(withValuePatch(option, value.id, { label: event.target.value }))} />
              {option.display === "color" && <input type="color" aria-label={`Swatch for ${value.label || "value"}`} value={value.color ?? "#000000"} onChange={(event) => onChange(withValuePatch(option, value.id, { color: event.target.value }))} className="size-9 shrink-0 rounded-lg border border-border bg-card" />}
              {!variant && (
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                  <label htmlFor={`${id}-${value.id}-price`}>+ price</label>
                  <SurchargeInput id={`${id}-${value.id}-price`} minor={value.priceAdjustmentMinor} onCommit={(priceAdjustmentMinor) => onChange(withValuePatch(option, value.id, { priceAdjustmentMinor }))} />
                </span>
              )}
              <button type="button" aria-label={`Remove ${value.label || "value"}`} onClick={() => onChange(withoutValue(option, value.id))} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><X size={13} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input aria-label={`Add ${label} values`} className={`${inputClass} !mt-0 h-9 flex-1`} placeholder="Type a value and press Enter, or paste S, M, L" value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValues(); } }} />
          <button type="button" onClick={addValues} className="h-9 rounded-full border border-border bg-muted/50 px-4 text-[11px] font-black text-tint-foreground">Add</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-[11px] font-bold text-foreground" htmlFor={`${id}-required`}>
          <input id={`${id}-required`} type="checkbox" checked={option.required} disabled={variant} onChange={(event) => onChange({ ...option, required: event.target.checked })} />
          Shoppers must choose
          {variant && <span className="font-normal text-muted-foreground">(always, so we know which one to ship)</span>}
        </label>
        {!variant && (
          <label className="flex items-center gap-2 text-[11px] font-bold text-foreground" htmlFor={`${id}-multiple`}>
            <input id={`${id}-multiple`} type="checkbox" checked={Boolean(option.multiple)} onChange={(event) => onChange({ ...option, multiple: event.target.checked })} />
            Shoppers can pick several
          </label>
        )}
        <div className="ml-auto flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <label htmlFor={`${id}-display`}>Show as</label>
          <select id={`${id}-display`} className={`${inputClass} !mt-0 h-9 w-auto`} value={option.display === "image" ? "buttons" : option.display} onChange={(event) => onChange({ ...option, display: event.target.value as ProductOptionDisplay })}>
            {DISPLAYS.map((display) => <option key={display.value} value={display.value}>{display.label}</option>)}
          </select>
        </div>
      </div>
    </fieldset>
  );
}
