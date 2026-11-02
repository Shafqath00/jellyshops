"use client";

import { useState } from "react";

export interface ThemeLookItem {
  id: string;
  name: string;
  themeId: string;
  themeVersion: string;
  settings: Record<string, unknown>;
}

/**
 * Theme library: saved looks of the store (a theme with its settings). Saving
 * keeps a copy of the current look; applying one replaces the theme and its
 * settings in the draft (pages and sections stay as they are). Publish to put
 * the change on the live store.
 */
export function ThemeLibraryPanel({
  looks,
  currentThemeName,
  themeName,
  busy = false,
  error,
  onSave,
  onApply,
  onRename,
  onDelete,
}: {
  looks: ThemeLookItem[];
  currentThemeName: string;
  /** The display name of a look's theme. */
  themeName(themeId: string): string;
  busy?: boolean;
  error?: string;
  onSave(name: string): void;
  onApply(look: ThemeLookItem): void;
  onRename(look: ThemeLookItem, name: string): void;
  onDelete(look: ThemeLookItem): void;
}) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const button = "h-8 rounded-md border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50";
  return <section aria-label="Saved looks" className="border-b border-border p-4">
    <h2 className="text-[13px] font-semibold">Saved looks</h2>
    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Keep the current look ({currentThemeName} and its settings) so you can switch back to it later. Applying a saved look changes your theme and settings; your pages and sections stay as they are.</p>
    <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const value = name.trim(); if (value) { onSave(value); setName(""); } }}>
      <input aria-label="Name for this look" value={name} maxLength={80} placeholder="e.g. Winter sale" onChange={(event) => setName(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-[12px]" />
      <button type="submit" disabled={busy || !name.trim()} className="h-8 shrink-0 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50">Save current look</button>
    </form>
    {error && <p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {looks.length === 0
      ? <p className="mt-3 text-[12px] text-muted-foreground">No saved looks yet.</p>
      : <ul className="mt-3 space-y-2">{looks.map((look) => <li key={look.id} className="rounded-lg border border-border p-2.5">
        {renaming?.id === look.id
          ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const value = renaming.name.trim(); if (value) onRename(look, value); setRenaming(null); }}>
            <input aria-label={`New name for ${look.name}`} autoFocus value={renaming.name} maxLength={80} onChange={(event) => setRenaming({ id: look.id, name: event.target.value })} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-[12px]" />
            <button type="submit" className={button}>Save</button>
            <button type="button" className={button} onClick={() => setRenaming(null)}>Cancel</button>
          </form>
          : <>
            <p className="truncate text-[12px] font-semibold">{look.name}</p>
            <p className="text-[11px] text-muted-foreground">{themeName(look.themeId)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" disabled={busy} className={button} aria-label={`Apply ${look.name}`} onClick={() => { if (window.confirm(`Apply "${look.name}"? It replaces your current theme and theme settings. Save the current look first if you want to keep it.`)) onApply(look); }}>Apply</button>
              <button type="button" disabled={busy} className={button} aria-label={`Rename ${look.name}`} onClick={() => setRenaming({ id: look.id, name: look.name })}>Rename</button>
              <button type="button" disabled={busy} className={button} aria-label={`Delete ${look.name}`} onClick={() => { if (window.confirm(`Delete "${look.name}"? Your store keeps its current look.`)) onDelete(look); }}>Delete</button>
            </div>
          </>}
      </li>)}</ul>}
  </section>;
}
