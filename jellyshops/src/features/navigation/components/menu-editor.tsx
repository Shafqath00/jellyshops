"use client";

import type { MenuItem, NavigationMenu } from "../api/client";
import { useState } from "react";
import { MAX_MENU_DEPTH } from "@jelly/storefront-schema";
import { Button } from "@/components/ui/button";
import { MenuLinkForm, type CollectionChoice } from "./menu-link-form";

export interface MenuDestination {
  parentId: string | null;
  index: number;
}

function removeItem(items: MenuItem[], itemId: string): MenuItem | null {
  const index = items.findIndex((item) => item.id === itemId);
  if (index >= 0) return items.splice(index, 1)[0] ?? null;
  for (const item of items) {
    const removed = removeItem(item.children, itemId);
    if (removed) return removed;
  }
  return null;
}

function findItem(items: MenuItem[], itemId: string): MenuItem | null {
  for (const item of items) {
    if (item.id === itemId) return item;
    const nested = findItem(item.children, itemId);
    if (nested) return nested;
  }
  return null;
}

export function reorderMenuItem(
  items: MenuItem[],
  itemId: string,
  destination: MenuDestination,
): MenuItem[] {
  const next = structuredClone(items);
  const moved = removeItem(next, itemId);
  if (!moved) return next;
  const target = destination.parentId === null ? next : findItem(next, destination.parentId)?.children;
  if (!target) return items;
  target.splice(Math.max(0, Math.min(destination.index, target.length)), 0, moved);
  return next;
}

/** Replaces one item (found at any level) and keeps everything else as it was. */
export function replaceMenuItem(items: MenuItem[], replacement: MenuItem): MenuItem[] {
  return items.map((item) => item.id === replacement.id ? replacement : { ...item, children: replaceMenuItem(item.children, replacement) });
}

/** Removes one item; the links inside it move up into its place, so nothing else disappears. */
export function removeMenuItem(items: MenuItem[], itemId: string): MenuItem[] {
  return items.flatMap((item) => item.id === itemId ? item.children : [{ ...item, children: removeMenuItem(item.children, itemId) }]);
}

/** Adds a link at the end of another link's list (the parent becomes a dropdown, column or large-menu group). */
export function addMenuChild(items: MenuItem[], parentId: string, child: MenuItem): MenuItem[] {
  return items.map((item) => item.id === parentId ? { ...item, children: [...item.children, child] } : { ...item, children: addMenuChild(item.children, parentId, child) });
}

type Row = { item: MenuItem; depth: number; parentId: string | null; index: number; siblings: number };
function rows(items: MenuItem[], depth = 0, parentId: string | null = null): Row[] {
  return items.flatMap((item, index) => [
    { item, depth, parentId, index, siblings: items.length },
    ...rows(item.children, depth + 1, item.id),
  ]);
}

type Editing = { kind: "edit"; item: MenuItem } | { kind: "new"; parentId: string | null; parentLabel?: string } | null;

export function MenuEditor({
  menu,
  onChange,
  onSave,
  collections = [],
  saving = false,
  dirty = true,
  uploadImage,
}: {
  menu: NavigationMenu;
  onChange(items: MenuItem[]): void;
  onSave(): void;
  collections?: CollectionChoice[];
  saving?: boolean;
  dirty?: boolean;
  /** Uploads a photo for the large menu and returns its address; without it the photo field is hidden. */
  uploadImage?(file: File): Promise<string>;
}) {
  const entries = rows(menu.items);
  const [editing, setEditing] = useState<Editing>(null);
  const editingKey = editing === null ? "" : editing.kind === "edit" ? editing.item.id : `new:${editing.parentId ?? "top"}`;

  function apply(item: MenuItem) {
    if (editing?.kind === "edit") onChange(replaceMenuItem(menu.items, item));
    else if (editing?.kind === "new" && editing.parentId) onChange(addMenuChild(menu.items, editing.parentId, item));
    else onChange([...menu.items, item]);
    setEditing(null);
  }

  return (
    <section aria-label="Menu editor" className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Navigation</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{menu.name}</h2>
        </div>
        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground" role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span><Button type="button" disabled={saving || !dirty || editing !== null} onClick={onSave}>Save menu</Button></div>
      </header>
      <fieldset disabled={saving} className="min-w-0">
      <div className="divide-y divide-border">
        {entries.map(({ item, depth, parentId, index, siblings }) => (
          <div key={item.id} className="flex min-h-11 flex-wrap items-center gap-2 px-3 py-1" style={{ paddingLeft: 12 + depth * 20 }}>
            {item.image?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image.url} alt="" className="size-8 shrink-0 rounded object-cover" />
            )}
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">{item.image?.url ? "photo · " : ""}{item.target.kind}</span>
            <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${item.label}`} onClick={() => setEditing({ kind: "edit", item })}>Edit</Button>
            {depth + 1 < MAX_MENU_DEPTH && <Button type="button" variant="ghost" size="sm" aria-label={`Add link inside ${item.label}`} onClick={() => setEditing({ kind: "new", parentId: item.id, parentLabel: item.label })}>Add inside</Button>}
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${item.label}`} onClick={() => { onChange(removeMenuItem(menu.items, item.id)); setEditing(null); }}>Remove</Button>
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              disabled={index === 0}
              onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index - 1 }))}
              className="h-7 rounded border border-border px-2 text-[10px] disabled:opacity-30"
            >
              Up
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              disabled={index === siblings - 1}
              onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index + 1 }))}
              className="h-7 rounded border border-border px-2 text-[10px] disabled:opacity-30"
            >
              Down
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="p-6 text-center text-[12px] text-muted-foreground">No menu items yet.</p>}
      </div>
      <div className="p-4">{editing
        ? <MenuLinkForm
            key={editingKey}
            item={editing.kind === "edit" ? editing.item : undefined}
            heading={editing.kind === "new" && editing.parentLabel ? `New link inside ${editing.parentLabel}` : undefined}
            collections={collections}
            uploadImage={uploadImage}
            onCancel={() => setEditing(null)}
            onApply={apply}
          />
        : <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="self-start" onClick={() => setEditing({ kind: "new", parentId: null })}>Add link</Button>
            <p className="text-[12px] text-muted-foreground">Links inside a link open as a dropdown. With the header&apos;s Large menu, links that hold links become columns and links with a photo become picture tiles.</p>
          </div>}</div>
      </fieldset>
    </section>
  );
}
