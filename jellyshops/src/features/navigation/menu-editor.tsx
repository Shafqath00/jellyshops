"use client";

import type { MenuItem, NavigationMenu } from "./api";

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
}: {
  menu: NavigationMenu;
  onChange(items: MenuItem[]): void;
  onSave(): void;
}) {
  const entries = rows(menu.items);

  return (
    <section aria-label="Menu editor" className="rounded-xl border border-[#e3e3e3] bg-white">
      <header className="flex items-center justify-between border-b border-[#eeeeee] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Navigation</p>
          <h2 className="mt-1 text-sm font-semibold text-[#303030]">{menu.name}</h2>
        </div>
        <button type="button" onClick={onSave} className="h-8 rounded-md bg-[#303030] px-3 text-[11px] font-semibold text-white">Save menu</button>
      </header>
      <div className="divide-y divide-[#eeeeee]">
        {entries.map(({ item, depth, parentId, index }) => (
          <div key={item.id} className="flex min-h-11 items-center gap-2 px-3" style={{ paddingLeft: 12 + depth * 20 }}>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#454f5b]">{item.label}</span>
            <span className="text-[10px] text-[#8c9196]">{item.target.kind}</span>
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              disabled={index === 0}
              onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index - 1 }))}
              className="h-7 rounded border border-[#d7d7d7] px-2 text-[10px] disabled:opacity-30"
            >
              Up
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              onClick={() => onChange(reorderMenuItem(menu.items, item.id, { parentId, index: index + 1 }))}
              className="h-7 rounded border border-[#d7d7d7] px-2 text-[10px]"
            >
              Down
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="p-6 text-center text-[12px] text-[#8c9196]">No menu items yet.</p>}
      </div>
    </section>
  );
}
