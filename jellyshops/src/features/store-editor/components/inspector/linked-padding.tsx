"use client";

import { useState } from "react";
import { Link2, RotateCcw, Unlink2 } from "lucide-react";
import type { ControlDefinition } from "@jelly/storefront-registry";
import { fieldShellClass } from "./control-styles";

type RangeControl = Extract<ControlDefinition, { type: "number" | "range" }>;

/** The padding sides, in the order of the box: top, right, bottom, left. */
const SIDE_ORDER = ["Top", "Right", "Bottom", "Left"] as const;

export const isPaddingControl = (control: ControlDefinition): control is RangeControl => (control.type === "range" || control.type === "number") && /Padding(Top|Right|Bottom|Left)$/.test(control.key);
const sideOf = (control: RangeControl) => SIDE_ORDER.find((side) => control.key.endsWith(`Padding${side}`))!;

function clampTo(control: RangeControl, value: number): number {
  const stepped = control.min + Math.round((value - control.min) / control.step) * control.step;
  return Math.min(control.max, Math.max(control.min, stepped));
}

function SideField({ control, value, onCommit }: { control: RangeControl; value: number | undefined; onCommit(value: number | undefined): void }) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) { setShown(value); setDraft(value === undefined ? "" : String(value)); }
  const commit = (text: string) => {
    if (!text.trim()) { onCommit(undefined); return; }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onCommit(clampTo(control, parsed));
    else setDraft(value === undefined ? "" : String(value));
  };
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-medium text-muted-foreground">{sideOf(control)}</span>
      <span className={fieldShellClass}>
        <input
          aria-label={control.label}
          inputMode="numeric"
          value={draft}
          placeholder="Auto"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
            // Arrow keys step the value by the control's step, like a number field (Shift = five steps).
            if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.altKey) {
              event.preventDefault();
              const base = value ?? control.min;
              onCommit(clampTo(control, base + (event.key === "ArrowUp" ? control.step : -control.step) * (event.shiftKey ? 5 : 1)));
            }
          }}
          className="w-full min-w-0 bg-transparent text-[12px] font-medium tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
        />
        <span className="text-[11px] text-muted-foreground">{control.unit ?? "px"}</span>
      </span>
    </label>
  );
}

/**
 * Padding for all sides in one box (top, right, bottom, left) with a link
 * button: while linked, changing one side changes every side. Starts linked
 * when all sides are equal (or all empty).
 */
export function LinkedPaddingControl({
  controls,
  values,
  onPatch,
}: {
  controls: RangeControl[];
  values: Record<string, unknown>;
  onPatch(patch: Record<string, number | undefined>): void;
}) {
  const ordered = [...controls].sort((a, b) => SIDE_ORDER.indexOf(sideOf(a)) - SIDE_ORDER.indexOf(sideOf(b)));
  const read = (control: RangeControl) => typeof values[control.key] === "number" ? values[control.key] as number : undefined;
  const current = ordered.map(read);
  const equal = current.every((value) => value === current[0]);
  const [linkedByUser, setLinked] = useState<boolean | undefined>(undefined);
  const linked = linkedByUser ?? equal;
  const setAll = (value: number | undefined) => onPatch(Object.fromEntries(ordered.map((control) => [control.key, value === undefined ? undefined : clampTo(control, value)])));
  const anySet = current.some((value) => value !== undefined);
  return (
    <div role="group" aria-label="Padding">
      <div className="grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr)) auto` }}>
        {ordered.map((control, index) => (
          <SideField key={control.key} control={control} value={current[index]} onCommit={(value) => linked ? setAll(value) : onPatch({ [control.key]: value })} />
        ))}
        <button
          type="button"
          aria-label={linked ? "Padding sides linked. Select to set each side separately" : "Padding sides separate. Select to link all sides"}
          aria-pressed={linked}
          title={linked ? "All sides change together" : "Each side on its own"}
          onClick={() => {
            const next = !linked;
            setLinked(next);
            // Linking makes every side match the first one.
            if (next && !equal) setAll(current[0]);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-muted aria-pressed:text-foreground"
        >
          {linked ? <Link2 size={15} strokeWidth={1.8} /> : <Unlink2 size={15} strokeWidth={1.8} />}
        </button>
      </div>
      {anySet && (
        <button type="button" aria-label="Reset padding" onClick={() => onPatch(Object.fromEntries(ordered.map((control) => [control.key, undefined])))} className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <RotateCcw size={12} strokeWidth={1.8} /> Use the theme&apos;s padding
        </button>
      )}
    </div>
  );
}
