"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X } from "lucide-react";

export interface PublishedVersion {
  id: string;
  sourceGeneration: number;
  publishedAt: string;
  isCurrent: boolean;
}

/** Menu entry and dialog listing earlier published versions; restoring one makes it the live store again (the draft is not changed). */
export function PublishHistory({ list, restore, disabled = false, onRestored }: {
  list(): Promise<PublishedVersion[]>;
  restore(publicationId: string): Promise<void>;
  disabled?: boolean;
  onRestored?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<PublishedVersion[]>();
  const [busyId, setBusyId] = useState<string>();
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();

  const load = async () => {
    setVersions(undefined);
    setMessage(undefined);
    try {
      setVersions(await list());
    } catch (error) {
      setVersions([]);
      setMessage({ text: error instanceof Error ? error.message : "Could not load your published versions.", failed: true });
    }
  };

  const restoreVersion = async (version: PublishedVersion) => {
    setBusyId(version.id);
    setMessage(undefined);
    try {
      await restore(version.id);
      setMessage({ text: "Restored. Your store now shows that version. Your draft was not changed.", failed: false });
      setVersions(await list());
      onRestored?.();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not restore that version.", failed: true });
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <>
      <button type="button" disabled={disabled} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setOpen(true); void load(); }} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50">Version history</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-black/40 p-4" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Published versions" className="w-full max-w-md rounded-xl border border-border bg-card p-4 text-foreground shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><History size={15} aria-hidden="true" />Published versions</h2>
                <p className="mt-1 text-xs text-muted-foreground">Restoring puts an earlier version back on your live store. Your draft stays as it is.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-md hover:bg-muted"><X size={15} /></button>
            </div>
            {message && <p role={message.failed ? "alert" : "status"} className={`mt-3 text-xs ${message.failed ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}
            <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
              {!versions && <li className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" />Loading…</li>}
              {versions?.length === 0 && !message && <li className="py-3 text-xs text-muted-foreground">Nothing has been published yet.</li>}
              {versions?.map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <span>
                    <span className="font-semibold">{new Date(version.publishedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    {version.isCurrent && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Live now</span>}
                  </span>
                  {!version.isCurrent && <button type="button" disabled={busyId !== undefined} onClick={() => { void restoreVersion(version); }} aria-label={`Restore the version from ${new Date(version.publishedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`} className="rounded-md border border-border px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-50">{busyId === version.id ? "Restoring…" : "Restore"}</button>}
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
