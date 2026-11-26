"use client";

import type { ReactNode } from "react";
import { Field, HelpTip } from "@/components/admin";
import type { PreferencesForm } from "./use-preferences-form";

/** Reads a value from the draft by a dotted path. */
export function valueAt<T = unknown>(form: PreferencesForm, path: string): T {
  let value: unknown = form.draft;
  for (const key of path.split(".")) value = (value as Record<string, unknown> | null)?.[key];
  return value as T;
}

const fieldId = (path: string) => `pref-${path.replaceAll(".", "-")}`;

function counter(length: number, max: number) {
  const left = max - length;
  return <span className={left < 0 ? "jk-field-error" : left <= 10 ? "jk-strong" : undefined}>{length} of {max} characters{left < 0 ? ` (${-left} too many)` : ""}</span>;
}

/**
 * A text box tied to one preference: label, an optional tip, help with an example, a character counter and the
 * problem for that field. `data-pref-path` lets Save focus the first field with a problem.
 */
export function PrefText({ form, path, label, tip, help, example, max, multiline = false, placeholder, type = "text", inputMode, autoComplete }: {
  form: PreferencesForm; path: string; label: string; tip?: ReactNode; help?: ReactNode; example?: string; max?: number;
  multiline?: boolean; placeholder?: string; type?: "text" | "url" | "tel" | "email"; inputMode?: "text" | "url" | "tel" | "numeric"; autoComplete?: string;
}) {
  const id = fieldId(path);
  const value = valueAt<string>(form, path) ?? "";
  const hint = <>{help}{example && <>{help ? " " : ""}For example: <span className="jk-code">{example}</span></>}{max !== undefined && <>{help || example ? " · " : ""}{counter(value.length, max)}</>}</>;
  return <div data-pref-path={path}>
    <Field id={id} label={tip ? <>{label} <HelpTip label={`About ${label.toLowerCase()}`}>{tip}</HelpTip></> : label} help={hint} error={form.problem(path)}>
      {multiline
        ? <textarea id={id} rows={3} value={value} placeholder={placeholder} onChange={(event) => form.set(path, event.target.value)} />
        : <input id={id} type={type} inputMode={inputMode} autoComplete={autoComplete ?? "off"} value={value} placeholder={placeholder} onChange={(event) => form.set(path, event.target.value)} />}
    </Field>
  </div>;
}

/** A tick box tied to one yes/no preference, with a line saying what it does. */
export function PrefCheck({ form, path, label, help }: { form: PreferencesForm; path: string; label: string; help?: ReactNode }) {
  const id = fieldId(path);
  return <div data-pref-path={path}>
    <label className="jk-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(valueAt(form, path))} aria-describedby={help ? `${id}-help` : undefined} onChange={(event) => form.set(path, event.target.checked)} />
      <span><span className="jk-strong">{label}</span>{help && <><br /><small id={`${id}-help`} className="jk-muted">{help}</small></>}</span>
    </label>
  </div>;
}

/** A dropdown tied to one preference. */
export function PrefSelect({ form, path, label, tip, help, options }: {
  form: PreferencesForm; path: string; label: string; tip?: ReactNode; help?: ReactNode; options: { value: string; label: string }[];
}) {
  const id = fieldId(path);
  return <div data-pref-path={path}>
    <Field id={id} label={tip ? <>{label} <HelpTip label={`About ${label.toLowerCase()}`}>{tip}</HelpTip></> : label} help={help} error={form.problem(path)}>
      <select id={id} value={valueAt<string>(form, path) ?? ""} onChange={(event) => form.set(path, event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  </div>;
}
