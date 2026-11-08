import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { normalizeHex, readRecentColors, rememberColor } from "../../color-palette";
import { useColorPalette } from "./color-palette-context";
import { fieldShellClass, iconButtonClass, labelClass } from "./control-styles";

/**
 * Shopify-style setting controls: a slider paired with an exact number box,
 * and a colour field that can stay empty ("Default", follows the theme) with
 * one-click theme colours and the colours used lately.
 * Clearing either one saves `undefined`, which removes the setting.
 */

const hex = /^#[0-9a-fA-F]{6}$/;

function clamp(value: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
}

export function SliderNumberControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange(value: number | undefined): void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  // Follow a new saved value (slider, undo, another block) without an effect.
  const [shown, setShown] = useState(value);
  if (shown !== value) { setShown(value); setDraft(value === undefined ? "" : String(value)); }

  const commit = (text: string) => {
    if (!text.trim()) { onChange(undefined); return; }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, Math.round(parsed))));
    else setDraft(value === undefined ? "" : String(value));
  };

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={value === undefined || Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-9 ? step : "any"}
          value={value ?? min}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max, step))}
          className={`h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary ${value === undefined ? "opacity-50" : ""}`}
        />
        <label className={`${fieldShellClass} w-[84px] shrink-0`}>
          <input
            aria-label={label}
            inputMode="numeric"
            value={draft}
            placeholder="Auto"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") commit(event.currentTarget.value); }}
            className="w-full min-w-0 bg-transparent text-[12px] font-medium tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[11px] text-muted-foreground">{unit}</span>
        </label>
        {value !== undefined && (
          <button type="button" aria-label={`Reset ${label}`} title="Use the theme's value" onClick={() => onChange(undefined)} className={iconButtonClass}>
            <RotateCcw size={13} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}

export function OptionalColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange(value: string | undefined): void;
}) {
  const color = value && hex.test(value) ? value : undefined;
  const [draft, setDraft] = useState(color ?? "");
  const [shown, setShown] = useState(color);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => readRecentColors());
  const palette = useColorPalette();
  if (shown !== color) { setShown(color); setDraft(color ?? ""); }

  // Picking or typing a colour also puts it first in the recent colours.
  const choose = (next: string) => { onChange(next); setRecent(rememberColor(next)); };
  const commit = (text: string) => {
    const next = text.trim();
    if (!next) { onChange(undefined); return; }
    const parsed = normalizeHex(next);
    if (parsed) choose(parsed);
    else setDraft(color ?? "");
  };
  const swatch = (item: { label: string; color: string }) => (
    <button
      key={item.color}
      type="button"
      aria-label={`Use ${item.label} ${item.color}`}
      title={`${item.label} ${item.color}`}
      aria-pressed={color === item.color}
      onClick={() => choose(item.color)}
      className="size-6 rounded-md border border-black/15 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
      style={{ background: item.color }}
    />
  );
  const recentOnly = recent.filter((item) => !palette.some((entry) => entry.color === item));

  return (
    <div>
      <label htmlFor={`optional-color-${label}`} className={labelClass}>{label}</label>
      <div className={`${fieldShellClass} gap-2`}>
        <label
          className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10"
          style={color ? { background: color } : { background: "linear-gradient(to top right, transparent calc(50% - 1px), #9ca3af, transparent calc(50% + 1px))" }}
        >
          <input
            type="color"
            aria-label={`${label} colour picker`}
            value={color ?? "#ffffff"}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => setRecent(rememberColor(event.target.value))}
            className="absolute -inset-2 size-10 cursor-pointer border-0 p-0 opacity-0"
          />
        </label>
        <input
          id={`optional-color-${label}`}
          aria-label={label}
          value={draft}
          placeholder="Default"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") commit(event.currentTarget.value); }}
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        {(palette.length > 0 || recentOnly.length > 0) && (
          <button type="button" aria-label={`${label} palette`} aria-expanded={open} title="Theme and recent colours" onClick={() => setOpen((current) => !current)} className={iconButtonClass}>
            <ChevronDown size={14} strokeWidth={1.8} className={open ? "rotate-180" : ""} />
          </button>
        )}
        {color && (
          <button type="button" aria-label={`Clear ${label}`} title="Use the theme's colour" onClick={() => onChange(undefined)} className={iconButtonClass}>
            <RotateCcw size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-card p-2" role="group" aria-label={`${label} colour choices`}>
          {palette.length > 0 && <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Theme colours</p><div className="flex flex-wrap gap-1.5">{palette.map(swatch)}</div></div>}
          {recentOnly.length > 0 && <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Recent</p><div className="flex flex-wrap gap-1.5">{recentOnly.map((item) => swatch({ label: "Recent colour", color: item }))}</div></div>}
        </div>
      )}
    </div>
  );
}
