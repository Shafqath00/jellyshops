"use client";

import { useState } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { MetafieldApiError, type MetafieldDefinition, type NewDefinition } from "./api";
import { SCALAR_TYPES, SCALAR_TYPE_LABELS, buildRules, emptyRuleForm, isValidKey, keyFromName, ruleKinds, type RuleForm } from "./values";

type Props = {
  ownerType: "product" | "variant";
  onCreate: (input: NewDefinition) => Promise<MetafieldDefinition>;
  onCreated: (definition: MetafieldDefinition) => void;
  onCancel: () => void;
};

const label = "block text-[13px] font-semibold text-foreground";
const field = `${inputClass} !mt-1.5`;

/**
 * Adds a reusable custom field. This is not a nested form: the product editor around it is one, so
 * Enter creates the field instead of saving the product.
 */
export function NewDefinitionForm({ ownerType, onCreate, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [namespace, setNamespace] = useState("custom");
  const [scalar, setScalar] = useState<string>("string");
  const [list, setList] = useState(false);
  const [description, setDescription] = useState("");
  const [visible, setVisible] = useState(true);
  const [rules, setRules] = useState<RuleForm>(emptyRuleForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const type = list ? `list:${scalar}` : scalar;
  const kinds = ruleKinds(type);
  const effectiveKey = keyEdited ? key : keyFromName(name);
  const setRule = (patch: Partial<RuleForm>) => setRules((current) => ({ ...current, ...patch }));

  async function create() {
    setError("");
    if (!name.trim()) return setError("Give the field a name, like Material.");
    if (!isValidKey(effectiveKey)) return setError("The key must start with a letter and use only lowercase letters, numbers and underscores.");
    if (!isValidKey(namespace)) return setError("The namespace must start with a letter and use only lowercase letters, numbers and underscores.");
    const built = buildRules(type, rules);
    if (built.error) return setError(built.error);
    setBusy(true);
    try {
      const created = await onCreate({ ownerType, namespace, key: effectiveKey, name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), type, ...(built.rules ? { validations: built.rules } : {}), storefrontVisible: visible });
      onCreated(created);
    } catch (caught) {
      setError(caught instanceof MetafieldApiError || caught instanceof Error ? caught.message : "The field could not be created.");
    } finally {
      setBusy(false);
    }
  }
  const onEnter = (event: React.KeyboardEvent) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "TEXTAREA") { event.preventDefault(); void create(); } };

  return (
    <div role="group" aria-label="New custom field" className="space-y-4 rounded-xl border border-border bg-muted/25 p-4" onKeyDown={onEnter}>
      <p className="text-[13px] font-semibold text-foreground">New custom field for {ownerType === "product" ? "products" : "combinations"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-field-name" className={label}>Name</label>
          <input id="new-field-name" className={field} value={name} maxLength={120} placeholder="e.g. Material" onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="new-field-type" className={label}>Type</label>
          <select id="new-field-type" className={field} value={scalar} onChange={(event) => { setScalar(event.target.value); setRules(emptyRuleForm); }}>
            {SCALAR_TYPES.map((option) => <option key={option} value={option}>{SCALAR_TYPE_LABELS[option]}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={list} onChange={(event) => { setList(event.target.checked); setRules(emptyRuleForm); }} />It holds a list of values</label>
      <div>
        <label htmlFor="new-field-description" className={label}>Description <span className="font-normal text-muted-foreground">(optional)</span></label>
        <input id="new-field-description" className={field} value={description} maxLength={500} placeholder="Shown under the field to help whoever fills it in" onChange={(event) => setDescription(event.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />Available to my store&apos;s theme</label>

      {kinds.length > 0 && (
        <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
          <legend className="px-1 text-[13px] font-semibold text-foreground">Rules (optional)</legend>
          {kinds.includes("length") && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="rule-min-length" className={label}>Shortest length</label><input id="rule-min-length" inputMode="numeric" className={field} value={rules.minLength} onChange={(event) => setRule({ minLength: event.target.value })} /></div>
            <div><label htmlFor="rule-max-length" className={label}>Longest length</label><input id="rule-max-length" inputMode="numeric" className={field} value={rules.maxLength} onChange={(event) => setRule({ maxLength: event.target.value })} /></div>
          </div>}
          {kinds.includes("choices") && <div><label htmlFor="rule-choices" className={label}>Only allow these values</label><textarea id="rule-choices" rows={3} className={`${field} h-auto py-2`} placeholder={"Cotton\nLinen\nWool"} value={rules.choices} onChange={(event) => setRule({ choices: event.target.value })} /><p className="mt-1 text-[12px] text-muted-foreground">One per line. Leave empty to allow anything.</p></div>}
          {kinds.includes("range") && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="rule-min" className={label}>Lowest number</label><input id="rule-min" inputMode="decimal" className={field} value={rules.min} onChange={(event) => setRule({ min: event.target.value })} /></div>
            <div><label htmlFor="rule-max" className={label}>Highest number</label><input id="rule-max" inputMode="decimal" className={field} value={rules.max} onChange={(event) => setRule({ max: event.target.value })} /></div>
          </div>}
          {kinds.includes("dates") && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="rule-min-date" className={label}>Earliest</label><input id="rule-min-date" type={scalar === "date" ? "date" : "datetime-local"} className={field} value={rules.min} onChange={(event) => setRule({ min: event.target.value })} /></div>
            <div><label htmlFor="rule-max-date" className={label}>Latest</label><input id="rule-max-date" type={scalar === "date" ? "date" : "datetime-local"} className={field} value={rules.max} onChange={(event) => setRule({ max: event.target.value })} /></div>
          </div>}
          {kinds.includes("items") && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="rule-min-items" className={label}>Fewest items</label><input id="rule-min-items" inputMode="numeric" className={field} value={rules.minItems} onChange={(event) => setRule({ minItems: event.target.value })} /></div>
            <div><label htmlFor="rule-max-items" className={label}>Most items</label><input id="rule-max-items" inputMode="numeric" className={field} value={rules.maxItems} onChange={(event) => setRule({ maxItems: event.target.value })} /></div>
          </div>}
        </fieldset>
      )}

      <details className="text-[13px]">
        <summary className="cursor-pointer font-semibold">Advanced: key and namespace</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="new-field-key" className={label}>Key</label><input id="new-field-key" className={field} value={effectiveKey} onChange={(event) => { setKey(event.target.value); setKeyEdited(true); }} /></div>
          <div><label htmlFor="new-field-namespace" className={label}>Namespace</label><input id="new-field-namespace" className={field} value={namespace} onChange={(event) => setNamespace(event.target.value)} /></div>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">Your theme reads this field as <code>{namespace || "custom"}.{effectiveKey || "key"}</code>. They cannot be changed later.</p>
      </details>

      {error && <p role="alert" className="text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void create()} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Adding…" : "Add field"}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}
