"use client";

import type { MenuItem, NavigationMenu } from "../api/client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { humanizeCode } from "@/components/admin";
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
    <section aria-label="Menu editor" className="jk-card is-flush">
      <div className="jk-card-header">
        <div><h2>{menu.name}</h2><p>Links shoppers see in this menu, in order. Links can hold one level of sub-links.</p></div>
        <div className="jk-row"><span className="jk-muted" role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span><button type="button" className="jk-button jk-button-primary" disabled={saving || !dirty || editing !== null} onClick={onSave}>Save menu</button></div>
      </div>
      <fieldset disabled={saving} className="min-w-0">
      <ul className="jk-list">
        {entries.map(({ item, depth, parentId, index }) => (
          <li key={item.id} className="jk-menu-row" style={{ paddingLeft: 16 + depth * 24 }}>
            <span className="min-w-0 flex-1"><span className="jk-strong block truncate">{item.label}</span><span className="jk-cell-sub">{depth > 0 ? "Sub-link · " : ""}{humanizeCode(item.target.kind)}</span></span>
            <span className="jk-row" style={{ gap: 2, flexWrap: "nowrap" }}>
              <button type="button" className="jk-icon-button" aria-label={`Move ${item.label} up`} title="Move up" disabled={index === 0}
                onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index - 1 }))}><ArrowUp size={15} aria-hidden="true" /></button>
              <button type="button" className="jk-icon-button" aria-label={`Move ${item.label} down`} title="Move down"
                disabled={index === (parentId ? findItem(menu.items, parentId)?.children.length ?? 0 : menu.items.length) - 1}
                onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index + 1 }))}><ArrowDown size={15} aria-hidden="true" /></button>
              {depth === 0 && <>
                <button type="button" className="jk-button jk-button-plain" aria-label={`Edit ${item.label}`} onClick={() => setEditing(item)}>Edit</button>
                <button type="button" className="jk-button jk-button-plain jk-button-critical" aria-label={`Remove ${item.label}`} onClick={() => { onChange(menu.items.flatMap(entry => entry.id === item.id ? entry.children : [entry])); setEditing(null); }}>Remove</button>
              </>}
            </span>
          </li>
        ))}
        {entries.length === 0 && <li className="jk-select-empty">No links yet. Add your first link below.</li>}
      </ul>
      <div className="jk-select-footer">{editing ? <MenuLinkForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? undefined : editing} collections={collections} onCancel={() => setEditing(null)} onApply={item => { onChange(editing === "new" ? [...menu.items, item] : menu.items.map(entry => entry.id === item.id ? item : entry)); setEditing(null); }} /> : <button type="button" className="jk-button" onClick={() => setEditing("new")}><Plus size={15} aria-hidden="true" />Add link</button>}</div>
      </fieldset>
    </section>
  );
}
