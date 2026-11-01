"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import type { MetafieldDefinition } from "./api";
import type { LookupOption, Lookups } from "./lookups";
import { baseTypeOf, isListType, isoToLocalInput, localInputToIso, moneyToText, sameValue, textToMoney, textToNumber } from "./values";

export interface InputContext {
  storeId: string;
  currency: string;
  lookups: Lookups | null;
}

type ScalarProps = {
  id: string;
  /** What the input is called for assistive technology. */
  label: string;
  type: string;
  rules?: Record<string, unknown> | null;
  value: unknown;
  /** `null` means the field has no value. */
  onChange: (value: unknown) => void;
  invalid?: boolean;
  describedBy?: string;
  context: InputContext;
};

const field = `${inputClass} !mt-0`;

/** Text that follows the stored value, but keeps what is being typed while it is not yet a valid value. */
function useTypedText(value: unknown, toText: (value: unknown) => string): [string, (text: string) => void, (value: unknown) => void] {
  const [text, setText] = useState(() => toText(value));
  const [seen, setSeen] = useState(value);
  if (!sameValue(seen, value)) { setSeen(value); setText(toText(value)); }
  return [text, setText, setSeen];
}

function useOptions(load: (() => Promise<LookupOption[]>) | null) {
  const [state, setState] = useState<{ options: LookupOption[]; error: string; ready: boolean }>({ options: [], error: "", ready: !load });
  useEffect(() => {
    if (!load) return;
    let active = true;
    load().then((options) => { if (active) setState({ options, error: "", ready: true }); })
      .catch((error: unknown) => { if (active) setState({ options: [], error: error instanceof Error ? error.message : "Could not load the choices.", ready: true }); });
    return () => { active = false; };
    // The loader is created per kind and store by the caller; load once when the field appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

function NumberInput({ id, label, integer, value, onChange, invalid, describedBy }: Pick<ScalarProps, "id" | "label" | "value" | "onChange" | "invalid" | "describedBy"> & { integer: boolean }) {
  const [text, setText, markSeen] = useTypedText(value, (current) => typeof current === "number" ? String(current) : "");
  const [bad, setBad] = useState(false);
  return (
    <input id={id} aria-label={label} inputMode={integer ? "numeric" : "decimal"} className={field} value={text} aria-invalid={invalid || bad} aria-describedby={describedBy}
      onChange={(event) => {
        const typed = event.target.value;
        setText(typed);
        const parsed = textToNumber(typed, integer);
        setBad(parsed === undefined);
        if (parsed !== undefined) { markSeen(parsed); onChange(parsed); }
      }} />
  );
}

function MoneyInput({ id, label, value, onChange, invalid, describedBy, currency }: Pick<ScalarProps, "id" | "label" | "value" | "onChange" | "invalid" | "describedBy"> & { currency: string }) {
  const [text, setText, markSeen] = useTypedText(value, moneyToText);
  const [bad, setBad] = useState(false);
  const shown = typeof value === "object" && value !== null && "currency" in value ? String((value as { currency: unknown }).currency) : currency;
  return (
    <div className="flex items-center gap-2">
      <input id={id} aria-label={label} inputMode="decimal" className={field} value={text} placeholder="0.00" aria-invalid={invalid || bad} aria-describedby={describedBy}
        onChange={(event) => {
          const typed = event.target.value;
          setText(typed);
          const parsed = textToMoney(typed, shown);
          setBad(parsed === undefined);
          if (parsed !== undefined) { markSeen(parsed); onChange(parsed); }
        }} />
      <span className="text-[13px] text-muted-foreground">{shown}</span>
    </div>
  );
}

function ColorInput({ id, label, value, onChange, invalid, describedBy }: Pick<ScalarProps, "id" | "label" | "value" | "onChange" | "invalid" | "describedBy">) {
  const [text, setText, markSeen] = useTypedText(value, (current) => typeof current === "string" ? current : "");
  const valid = /^#[0-9a-fA-F]{6}$/.test(text);
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={`${label} colour picker`} className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-card p-1" value={valid ? text : "#000000"} onChange={(event) => { setText(event.target.value); markSeen(event.target.value); onChange(event.target.value); }} />
      <input id={id} aria-label={label} className={field} value={text} placeholder="#1a2b3c" aria-invalid={invalid || (text !== "" && !valid)} aria-describedby={describedBy}
        onChange={(event) => { const typed = event.target.value; setText(typed); if (typed === "") { markSeen(null); onChange(null); } else if (/^#[0-9a-fA-F]{6}$/.test(typed)) { markSeen(typed); onChange(typed); } }} />
    </div>
  );
}

function ChoiceSelect({ id, label, options, value, onChange, invalid, describedBy, none }: Pick<ScalarProps, "id" | "label" | "value" | "onChange" | "invalid" | "describedBy"> & { options: LookupOption[]; none: string }) {
  const known = typeof value === "string" && options.some((option) => option.id === value);
  return (
    <select id={id} aria-label={label} className={field} value={typeof value === "string" ? value : ""} aria-invalid={invalid} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">{none}</option>
      {/* A saved choice that is no longer in the list stays visible instead of silently disappearing. */}
      {typeof value === "string" && value && !known && <option value={value}>{value} (not found)</option>}
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  );
}

function LookupSelect({ kind, ...props }: Omit<Parameters<typeof ChoiceSelect>[0], "options" | "none"> & { kind: "products" | "collections" | "media"; context: InputContext }) {
  const { context } = props;
  const { options, error, ready } = useOptions(context.lookups ? () => context.lookups![kind](context.storeId) : null);
  const noun = kind === "products" ? "product" : kind === "collections" ? "collection" : "file";
  const selected = options.find((option) => option.id === props.value);
  return (
    <div className="flex items-center gap-2">
      {kind === "media" && selected?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selected.imageUrl} alt="" className="size-9 shrink-0 rounded border border-border object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <ChoiceSelect {...props} options={options} none={ready ? `Choose a ${noun}` : "Loading…"} />
        {error && <p role="alert" className="mt-1 text-[12px] font-semibold text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function Scalar(props: ScalarProps) {
  const { id, label, type, rules, value, onChange, invalid, describedBy, context } = props;
  const base = baseTypeOf(type);
  const common = { id, "aria-label": label, "aria-invalid": invalid, "aria-describedby": describedBy };
  switch (base) {
    case "string": {
      const choices = Array.isArray(rules?.choices) ? rules.choices.filter((choice): choice is string => typeof choice === "string") : null;
      if (choices) return <ChoiceSelect id={id} label={label} options={choices.map((choice) => ({ id: choice, label: choice }))} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} none="Not set" />;
      return <input {...common} className={field} maxLength={255} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)} />;
    }
    case "text":
    case "rich_text":
      return <textarea {...common} rows={4} className={`${field} h-auto py-2`} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)} />;
    case "boolean":
      return (
        <select {...common} className={field} value={value === true ? "yes" : value === false ? "no" : ""} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "yes")}>
          <option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      );
    case "integer":
    case "decimal":
      return <NumberInput id={id} label={label} integer={base === "integer"} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />;
    case "money":
      return <MoneyInput id={id} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} currency={context.currency} />;
    case "color":
      return <ColorInput id={id} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />;
    case "url":
      return <input {...common} className={field} inputMode="url" placeholder="https://" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value.trim() || null)} />;
    case "date":
      return <input {...common} type="date" className={field} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)} />;
    case "datetime":
      return <input {...common} type="datetime-local" className={field} value={isoToLocalInput(value)} onChange={(event) => onChange(event.target.value ? localInputToIso(event.target.value) : null)} />;
    case "image":
    case "file":
      return <LookupSelect kind="media" id={id} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} context={context} />;
    case "product_reference":
      return <LookupSelect kind="products" id={id} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} context={context} />;
    case "collection_reference":
      return <LookupSelect kind="collections" id={id} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} context={context} />;
    default:
      // Pages and custom objects: paste the item's id until a picker exists for them.
      return <input {...common} className={field} placeholder="Item ID" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value.trim() || null)} />;
  }
}

/** A list: each item is edited like a single value, blank items are kept out of what is saved. */
function ListInput({ id, label, type, rules, value, onChange, invalid, describedBy, context }: ScalarProps) {
  const toItems = (current: unknown): unknown[] => Array.isArray(current) ? current : [];
  const [items, setItems] = useState<unknown[]>(() => toItems(value));
  const [seen, setSeen] = useState(value);
  if (!sameValue(seen, value)) { setSeen(value); setItems(toItems(value)); }

  function emit(next: unknown[]) {
    setItems(next);
    const filled = next.filter((item) => item !== null && item !== undefined);
    const emitted = filled.length ? filled : null;
    setSeen(emitted);
    onChange(emitted);
  }
  const itemType = baseTypeOf(type);
  return (
    <div className="space-y-2" id={id} role="group" aria-label={label} aria-describedby={describedBy}>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Scalar id={`${id}-${index}`} label={`${label}, item ${index + 1}`} type={itemType} rules={rules} value={item} invalid={invalid} context={context}
              onChange={(next) => emit(items.map((current, position) => position === index ? next : current))} />
          </div>
          <button type="button" className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold hover:bg-muted" aria-label={`Remove ${label}, item ${index + 1}`} onClick={() => emit(items.filter((_, position) => position !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className="h-8 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold hover:bg-muted" onClick={() => setItems([...items, null])}>Add item</button>
    </div>
  );
}

type Props = Omit<ScalarProps, "type" | "rules" | "label"> & { definition: MetafieldDefinition };

/** The right input for a custom field's type, including lists. `onChange(null)` takes the value away. */
export function MetafieldInput({ definition, ...rest }: Props) {
  const rules = definition.validations ?? null;
  const common = { ...rest, label: definition.name, type: definition.type, rules };
  return isListType(definition.type) ? <ListInput {...common} /> : <Scalar {...common} />;
}
