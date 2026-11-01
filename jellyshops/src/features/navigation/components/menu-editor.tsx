"use client";

import type { MenuItem, NavigationMenu } from "../api/client";
import { useState } from "react";
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

function rows(items: MenuItem[], depth = 0): Array<{ item: MenuItem; depth: number; parentId: string | null; index: number }> {
  return items.flatMap((item, index) => [
    { item, depth, parentId: null as string | null, index },
    ...item.children.flatMap((child, childIndex) => [
      { item: child, depth: depth + 1, parentId: item.id, index: childIndex },
      ...rows(child.children, depth + 2).map((entry) => ({ ...entry, parentId: entry.parentId ?? child.id })),
    ]),
  ]);
}

export function MenuEditor({
  menu,
  onChange,
  onSave,
  collections = [],
  saving = false,
  dirty = true,
}: {
  menu: NavigationMenu;
  onChange(items: MenuItem[]): void;
  onSave(): void;
  collections?: CollectionChoice[];
  saving?: boolean;
  dirty?: boolean;
}) {
  const entries = rows(menu.items);
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);

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
        {entries.map(({ item, depth, parentId, index }) => (
          <div key={item.id} className="flex min-h-11 items-center gap-2 px-3" style={{ paddingLeft: 12 + depth * 20 }}>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">{item.target.kind}</span>
            {depth === 0 && <><Button type="button" variant="ghost" size="sm" aria-label={`Edit ${item.label}`} onClick={() => setEditing(item)}>Edit</Button><Button type="button" variant="ghost" size="sm" aria-label={`Remove ${item.label}`} onClick={() => { onChange(menu.items.flatMap(entry => entry.id === item.id ? entry.children : [entry])); setEditing(null); }}>Remove</Button></>}
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
              disabled={index === (parentId ? findItem(menu.items, parentId)?.children.length ?? 0 : menu.items.length) - 1}
              onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index + 1 }))}
              className="h-7 rounded border border-border px-2 text-[10px]"
            >
              Down
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="p-6 text-center text-[12px] text-muted-foreground">No menu items yet.</p>}
      </div>
      <div className="p-4">{editing ? <MenuLinkForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? undefined : editing} collections={collections} onCancel={() => setEditing(null)} onApply={item => { onChange(editing === "new" ? [...menu.items, item] : menu.items.map(entry => entry.id === item.id ? item : entry)); setEditing(null); }} /> : <Button type="button" variant="outline" onClick={() => setEditing("new")}>Add link</Button>}</div>
      </fieldset>
    </section>
  );
}
