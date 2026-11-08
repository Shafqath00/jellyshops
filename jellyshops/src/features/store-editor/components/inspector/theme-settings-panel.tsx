"use client";

import type { ControlDefinition } from "@jelly/storefront-registry";
import type { MediaRecord, ThemeSettingDefinition } from "../../api/types";
import { themeSchemaForPanel } from "../../color-schemes";
import { ControlRenderer } from "./control-renderer";
import { inputClass } from "./control-styles";

/**
 * The editor control for a theme setting, so theme settings look and behave like
 * section and block settings (same boxes, sliders, colour palette, focus ring).
 * Image and radio settings keep their own markup (below) but use the same classes.
 */
export function controlForThemeSetting(field: ThemeSettingDefinition): ControlDefinition | null {
  const base = { key: field.id, label: field.label, group: "style" as const };
  switch (field.type) {
    case "text": case "url": return { ...base, type: "text", maxLength: 500 };
    case "textarea": case "richtext": return { ...base, type: "textarea", maxLength: 5000 };
    case "number": case "range": return { ...base, type: "range", min: field.min ?? 0, max: field.max ?? 100, step: field.step ?? 1 };
    case "checkbox": return { ...base, type: "checkbox" };
    case "color": return { ...base, type: "color", allowAlpha: false };
    case "select": case "font": case "alignment": return { ...base, type: (field.options?.length ?? 0) <= 3 && field.type !== "font" ? "segmented" : "select", options: field.options ?? [] };
    default: return null;
  }
}

const emptyCatalog = { products: [], collections: [] };

function read(settings: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined, settings);
}

function grouped(schema: ThemeSettingDefinition[]) {
  return schema.reduce<Record<string, ThemeSettingDefinition[]>>((result, definition) => {
    const group = definition.group ?? "Theme settings";
    (result[group] ??= []).push(definition);
    return result;
  }, {});
}

export function ThemeSettingsPanel({ schema, settings, saving, error, upload, onChange }: {
  schema: ThemeSettingDefinition[];
  settings: Record<string, unknown>;
  saving: boolean;
  error?: string;
  upload?(file: File, onProgress?: (percent: number) => void): Promise<MediaRecord>;
  onChange(path: string, value: unknown): void;
}) {
  return (
    <aside aria-label="Theme settings" className="min-h-0 bg-[var(--white)]">
      <header className="border-b border-[var(--line)] px-4 py-3"><p className="text-[10px] font-medium text-[var(--ink-soft)]">Global</p><h2 className="mt-0.5 text-[13px] font-semibold text-[var(--ink)]">Theme settings</h2></header>
      {error ? <p role="alert" className="m-3 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{error}</p> : null}
      {Object.entries(grouped(themeSchemaForPanel(schema, settings))).map(([group, fields]) => <details key={group} className="border-b border-[var(--line)]"><summary className="cursor-pointer px-4 py-3 text-[13px] font-medium">{group}</summary><div className="space-y-4 px-4 pb-4">{fields.map((field) => <ThemeSettingControl key={field.id} field={field} value={read(settings, field.id) ?? field.default} disabled={saving} upload={upload} onChange={(value) => onChange(field.id, value)} />)}</div></details>)}
      {!schema.length ? <p className="p-6 text-center text-[12px] text-[var(--ink-soft)]">This theme does not declare editable global settings.</p> : null}
    </aside>
  );
}

function ThemeSettingControl({ field, value, disabled, upload, onChange }: { field: ThemeSettingDefinition; value: unknown; disabled: boolean; upload?: (file: File, onProgress?: (percent: number) => void) => Promise<MediaRecord>; onChange(value: unknown): void }) {
  const stringValue = typeof value === "string" ? value : "";
  const choices = field.options ?? [];
  const description = field.description ? <p className="mt-1 text-xs text-muted-foreground">{field.description}</p> : null;
  const control = controlForThemeSetting(field);
  if (control) {
    // A disabled fieldset disables every control inside it while a save is running.
    return <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0"><ControlRenderer definition={control} value={control.type === "checkbox" ? Boolean(value) : control.type === "range" ? (typeof value === "number" ? value : undefined) : value} catalog={emptyCatalog} onChange={onChange} />{description}</fieldset>;
  }
  const label = <span className="mb-2 block text-xs font-medium text-[var(--ink-soft)]">{field.label}</span>;
  if (field.type === "radio") return <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0"><legend className="mb-2 text-xs font-medium text-[var(--ink-soft)]">{field.label}</legend><div className="flex flex-wrap gap-2">{choices.map((option) => <label key={option.value} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] text-foreground has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"><input className="size-3.5" type="radio" name={field.id} value={option.value} checked={stringValue === option.value} onChange={() => onChange(option.value)} />{option.label}</label>)}</div>{description}</fieldset>;
  // Image settings hold a link, so they take a link or an uploaded file.
  return <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0"><label className="block">{label}<input aria-label={field.label} className={inputClass} type="url" value={stringValue} onChange={(event) => onChange(event.target.value)} /></label>{upload ? <input aria-label={`Upload ${field.label}`} className="mt-2 block w-full text-[11px]" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file).then((media) => onChange(media.url)); }} /> : null}{description}</fieldset>;
}
