import { History } from "lucide-react";

/** Offered after a reload when the last visit ended with changes that never reached the server. */
export function RestoreSessionBanner({ summary, savedAt, onRestore, onDiscard }: {
  /** What changed, e.g. "2 pages and theme settings". */
  summary: string;
  savedAt: number;
  onRestore(): void;
  onDiscard(): void;
}) {
  const time = new Date(savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return (
    <div role="region" aria-label="Restore your last session" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--paper)] px-5 py-3 text-xs leading-5 text-[var(--ink)]">
      <p className="flex items-center gap-2"><History size={14} aria-hidden="true" /><span><strong>You have changes that were not saved.</strong> Your last session ({time}) ended before {summary} could be saved. Restoring replaces what is saved now.</span></p>
      <span className="flex gap-2">
        <button type="button" onClick={onRestore} className="inline-flex min-h-9 items-center rounded-lg bg-[var(--ink)] px-3 font-semibold text-white">Restore changes</button>
        <button type="button" onClick={onDiscard} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] bg-card px-3 font-semibold">Discard</button>
      </span>
    </div>
  );
}
