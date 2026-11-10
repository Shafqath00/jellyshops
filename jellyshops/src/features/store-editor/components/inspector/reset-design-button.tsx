"use client";

import { useState } from "react";

/**
 * "Reset design" for the selected section: asks once, then puts the section's look back to its defaults. The
 * merchant's text, photos, links and custom CSS stay. Undo (Ctrl+Z) brings the design back.
 */
export function ResetDesignButton({ onReset, disabled = false }: { onReset(): void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" disabled={disabled} onClick={() => setAsking(true)} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs text-[var(--ink-soft)] hover:bg-muted disabled:opacity-50">Reset design to defaults</button>;
  }
  return <div role="group" aria-label="Reset design" className="grid gap-2 rounded-lg bg-muted p-2">
    <p className="m-0 text-xs">Reset this section&apos;s colours, spacing, sizes and fonts? Your text, photos and links stay. You can undo this.</p>
    <div className="flex gap-2">
      <button type="button" onClick={() => { setAsking(false); onReset(); }} className="min-h-9 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-white">Reset design</button>
      <button type="button" onClick={() => setAsking(false)} className="min-h-9 rounded-lg px-3 text-xs">Keep it</button>
    </div>
  </div>;
}
