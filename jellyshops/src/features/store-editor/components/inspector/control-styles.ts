/**
 * One look for every control in the editor panel (section, block and theme
 * settings): the same height, corners, border, hover and focus ring. Use these
 * instead of writing new class lists in a control.
 */

/** Small grey label above a control. */
export const labelClass = "mb-2 block text-xs font-medium text-[var(--ink-soft)]";

/** Text boxes, number boxes and dropdowns (the input itself carries the border). */
export const inputClass =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground hover:border-tint-border focus:border-tint-border focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

/** A bordered wrapper around a bare input (number with a unit, hex colour, padding side): same box, focus ring on the wrapper. */
export const fieldShellClass =
  "flex h-9 items-center rounded-lg border border-border bg-card px-2 transition hover:border-tint-border focus-within:border-tint-border focus-within:ring-2 focus-within:ring-ring/40";

/** Multi-line text. */
export const textareaClass =
  "w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] font-medium leading-5 text-foreground outline-none transition placeholder:text-muted-foreground hover:border-tint-border focus:border-tint-border focus:ring-2 focus:ring-ring/40";

/** Small square or round buttons next to a control (reset, link, palette). */
export const iconButtonClass =
  "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40";
