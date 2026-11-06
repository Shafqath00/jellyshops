"use client";

import { Check } from "lucide-react";
import type { ThemeStyle } from "@jelly/storefront-themes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** True when every setting the style names already has the style's value. */
export function styleIsApplied(settings: Record<string, unknown>, style: ThemeStyle): boolean {
  const matches = (current: unknown, wanted: unknown): boolean => isRecord(wanted)
    ? isRecord(current) && Object.entries(wanted).every(([key, value]) => matches(current[key], value))
    : current === wanted;
  return matches(settings, style.settings);
}

/**
 * Theme styles: the ready-made looks the theme ships (colours, colour schemes, fonts). Applying one changes those
 * theme settings only; pages, sections and content stay. It is an ordinary theme change, so Undo brings the old look back.
 */
export function ThemeStylesPanel({ styles, settings, busy = false, onApply }: {
  styles: ThemeStyle[];
  settings: Record<string, unknown>;
  busy?: boolean;
  onApply(style: ThemeStyle): void;
}) {
  if (!styles.length) return null;
  return <section aria-label="Theme styles" className="border-b border-border p-4">
    <h2 className="text-[13px] font-semibold">Theme styles</h2>
    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Ready-made colours and fonts from the theme&apos;s designer. Your pages and content stay the same; Undo brings your previous look back.</p>
    <ul className="mt-3 grid grid-cols-2 gap-2">{styles.map((style) => {
      const applied = styleIsApplied(settings, style);
      return <li key={style.id}>
        <button
          type="button"
          disabled={busy || applied}
          aria-pressed={applied}
          aria-label={applied ? `${style.name} (current style)` : `Apply the ${style.name} style`}
          title={style.description}
          onClick={() => onApply(style)}
          className={`flex w-full flex-col gap-2 rounded-lg border p-2.5 text-left transition hover:bg-muted/50 disabled:cursor-default ${applied ? "border-foreground" : "border-border"}`}
        >
          <span className="flex h-7 overflow-hidden rounded-md border border-border" aria-hidden="true">{style.swatches.map((colour, index) => <span key={`${colour}-${index}`} className="flex-1" style={{ background: colour }} />)}</span>
          <span className="flex items-center justify-between gap-1 text-[12px] font-semibold">{style.name}{applied && <Check size={13} aria-hidden="true" />}</span>
          <span className="text-[11px] leading-4 text-muted-foreground">{style.description}</span>
        </button>
      </li>;
    })}</ul>
  </section>;
}
