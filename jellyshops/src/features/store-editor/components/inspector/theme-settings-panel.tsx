"use client";

import type { MediaRecord, ThemeSettingDefinition } from "../../api/types";

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
    <aside aria-label="Theme settings" className="min-h-0 overflow-y-auto bg-white">
      <header className="border-b border-[#eeeeee] px-4 py-3"><p className="text-[10px] font-medium text-[#8c9196]">Global</p><h2 className="mt-0.5 text-[13px] font-semibold">Theme settings</h2></header>
      {error ? <p role="alert" className="m-3 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{error}</p> : null}
      {Object.entries(grouped(schema)).map(([group, fields]) => <section key={group} className="border-b border-[#eeeeee] p-4"><h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">{group}</h3><div className="space-y-4">{fields.map((field) => <ThemeSettingControl key={field.id} field={field} value={read(settings, field.id) ?? field.default} disabled={saving} upload={upload} onChange={(value) => onChange(field.id, value)} />)}</div></section>)}
      {!schema.length ? <p className="p-6 text-center text-[12px] text-[#8c9196]">This theme does not declare editable global settings.</p> : null}
    </aside>
  );
}

function ThemeSettingControl({ field, value, disabled, upload, onChange }: { field: ThemeSettingDefinition; value: unknown; disabled: boolean; upload?: (file: File, onProgress?: (percent: number) => void) => Promise<MediaRecord>; onChange(value: unknown): void }) {
  const inputClass = "mt-1.5 w-full rounded-lg border border-[#d7d7d7] bg-white px-3 py-2 text-[12px] outline-none disabled:bg-[#f6f6f7]";
  const stringValue = typeof value === "string" ? value : "";
  const choices = field.options ?? [];
  const label = <><span className="text-[12px] font-medium text-[#454f5b]">{field.label}</span>{field.description ? <span className="mt-1 block text-[11px] text-[#8c9196]">{field.description}</span> : null}</>;
  if (field.type === "checkbox") return <label className="flex items-center justify-between gap-3">{label}<input aria-label={field.label} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
  if (["select", "font", "alignment"].includes(field.type)) return <label className="block">{label}<select aria-label={field.label} className={inputClass} value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{choices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.type === "radio") return <fieldset><legend className="text-[12px] font-medium text-[#454f5b]">{field.label}</legend><div className="mt-2 flex flex-wrap gap-2">{choices.map((option) => <label key={option.value} className="rounded-lg border px-2 py-1 text-[11px]"><input className="mr-1" type="radio" name={field.id} value={option.value} checked={stringValue === option.value} disabled={disabled} onChange={() => onChange(option.value)} />{option.label}</label>)}</div></fieldset>;
  if (field.type === "color") return <label className="block">{label}<div className="mt-1.5 flex gap-2"><input aria-label={`${field.label} picker`} type="color" value={/^#[0-9a-f]{6}$/i.test(stringValue) ? stringValue : "#ffffff"} disabled={disabled} onChange={(event) => onChange(event.target.value)} /><input aria-label={field.label} className={inputClass} value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div></label>;
  if (field.type === "image") return <label className="block">{label}<input aria-label={field.label} className={inputClass} type="url" value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} />{upload ? <input aria-label={`Upload ${field.label}`} className="mt-2 block w-full text-[11px]" type="file" accept="image/*" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file).then((media) => onChange(media.url)); }} /> : null}</label>;
  if (["number", "range"].includes(field.type)) return <label className="block">{label}<input aria-label={field.label} className={inputClass} type={field.type === "range" ? "range" : "number"} min={field.min} max={field.max} step={field.step ?? 1} value={typeof value === "number" ? value : field.min ?? 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
  if (["textarea", "richtext"].includes(field.type)) return <label className="block">{label}<textarea aria-label={field.label} className={inputClass} rows={field.type === "richtext" ? 6 : 4} value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label className="block">{label}<input aria-label={field.label} className={inputClass} type={field.type === "url" ? "url" : "text"} value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}
