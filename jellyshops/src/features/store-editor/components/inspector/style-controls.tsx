import { useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * Shopify-style setting controls: a slider paired with an exact number box,
 * and a colour field that can stay empty ("Default", follows the theme).
 * Clearing either one saves `undefined`, which removes the setting.
 */

const labelClass = "mb-2 block text-xs font-medium text-[var(--ink-soft)]";
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
        <label className="flex h-9 w-[84px] shrink-0 items-center rounded-lg border border-border bg-card px-2 focus-within:ring-2 focus-within:ring-black/[0.06]">
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
          <button type="button" aria-label={`Reset ${label}`} title="Use the theme's value" onClick={() => onChange(undefined)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
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
  if (shown !== color) { setShown(color); setDraft(color ?? ""); }

  const commit = (text: string) => {
    const next = text.trim();
    if (!next) onChange(undefined);
    else if (hex.test(next)) onChange(next.toLowerCase());
    else if (/^[0-9a-fA-F]{6}$/.test(next)) onChange(`#${next.toLowerCase()}`);
    else setDraft(color ?? "");
  };

  return (
    <div>
      <label htmlFor={`optional-color-${label}`} className={labelClass}>{label}</label>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 focus-within:ring-2 focus-within:ring-black/[0.06]">
        <label
          className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10"
          style={color ? { background: color } : { background: "linear-gradient(to top right, transparent calc(50% - 1px), #9ca3af, transparent calc(50% + 1px))" }}
        >
          <input
            type="color"
            aria-label={`${label} colour picker`}
            value={color ?? "#ffffff"}
            onChange={(event) => onChange(event.target.value)}
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
        {color && (
          <button type="button" aria-label={`Clear ${label}`} title="Use the theme's colour" onClick={() => onChange(undefined)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <RotateCcw size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}
