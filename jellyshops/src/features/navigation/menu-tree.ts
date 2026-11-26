/**
 * Menu tree editing as plain functions: a menu is a nested list of links; for drag and drop it is handled as a flat
 * list where each link has a depth (0 = top level). Links can be at most MAX_MENU_DEPTH levels deep.
 */
import { MAX_MENU_DEPTH } from "@jelly/storefront-schema";
import type { MenuItem } from "./api/client";

export interface FlatMenuItem {
  id: string;
  depth: number;
  parentId: string | null;
  item: MenuItem;
}

export function flattenMenu(items: MenuItem[], depth = 0, parentId: string | null = null): FlatMenuItem[] {
  return items.flatMap((item) => [{ id: item.id, depth, parentId, item }, ...flattenMenu(item.children, depth + 1, item.id)]);
}

/** Builds the nested list back from a flat one (depths must step down at most one at a time). */
export function buildMenu(flat: Array<Pick<FlatMenuItem, "depth" | "item">>): MenuItem[] {
  const root: MenuItem[] = [];
  const stack: MenuItem[][] = [root];
  for (const entry of flat) {
    const depth = Math.max(0, Math.min(entry.depth, stack.length - 1));
    stack.length = depth + 1;
    const node: MenuItem = { ...entry.item, children: [] };
    stack[depth]!.push(node);
    stack.push(node.children);
  }
  return root;
}

/** The link and everything inside it, as a run in the flat list. */
function block(flat: FlatMenuItem[], index: number): FlatMenuItem[] {
  const start = flat[index]!;
  let end = index + 1;
  while (end < flat.length && flat[end]!.depth > start.depth) end++;
  return flat.slice(index, end);
}

/** How many levels a link takes up, itself included (a link with sub-links is 2). */
export function levelsOf(item: MenuItem): number {
  return 1 + Math.max(0, ...item.children.map(levelsOf));
}

/** The deepest a link may go where it would land, given what is before and after it. */
export function allowedDepth(previous: FlatMenuItem | undefined, next: FlatMenuItem | undefined, wanted: number, levels: number): number {
  const max = Math.min(previous ? previous.depth + 1 : 0, MAX_MENU_DEPTH - levels);
  const min = next ? next.depth - 1 : 0;
  return Math.max(0, Math.min(Math.max(wanted, min), Math.max(max, 0)));
}

/**
 * Moves a link (with its sub-links) to where another link is, at the depth the pointer suggests. Returns the menu
 * unchanged when the move makes no sense (onto itself or into its own sub-links).
 */
export function moveMenuItem(items: MenuItem[], activeId: string, overId: string, wantedDepth: number): MenuItem[] {
  const flat = flattenMenu(items);
  const from = flat.findIndex((entry) => entry.id === activeId);
  const to = flat.findIndex((entry) => entry.id === overId);
  if (from < 0 || to < 0) return items;
  const moving = block(flat, from);
  if (moving.some((entry) => entry.id === overId) && overId !== activeId) return items;
  const rest = flat.filter((entry) => !moving.includes(entry));
  let insertAt = rest.findIndex((entry) => entry.id === overId);
  if (overId === activeId) insertAt = from;
  else if (from < to) insertAt += 1;
  const previous = rest[insertAt - 1];
  const next = rest[insertAt];
  const depth = allowedDepth(previous, next, wantedDepth, levelsOf(moving[0]!.item));
  const shift = depth - moving[0]!.depth;
  const moved = moving.map((entry) => ({ ...entry, depth: entry.depth + shift }));
  return buildMenu([...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)]);
}

/** The depth a dragged link would get where it is hovering, from how far it was dragged sideways. */
export function projectedDepth(items: MenuItem[], activeId: string, overId: string, offsetX: number, indent = 28): number {
  const flat = flattenMenu(items);
  const active = flat.find((entry) => entry.id === activeId);
  if (!active) return 0;
  return active.depth + Math.round(offsetX / indent);
}

/** Moves a link one place up or down among the links next to it at the same level. */
export function shiftMenuItem(items: MenuItem[], itemId: string, direction: -1 | 1): MenuItem[] {
  const shift = (list: MenuItem[]): [MenuItem[], boolean] => {
    const index = list.findIndex((item) => item.id === itemId);
    if (index >= 0) {
      const target = index + direction;
      if (target < 0 || target >= list.length) return [list, true];
      const next = [...list];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return [next, true];
    }
    for (let position = 0; position < list.length; position++) {
      const [children, found] = shift(list[position]!.children);
      if (found) return [list.map((item, i) => i === position ? { ...item, children } : item), true];
    }
    return [list, false];
  };
  return shift(items)[0];
}

/** Puts a link inside the link above it (as its last sub-link). Null when that is not possible. */
export function indentMenuItem(items: MenuItem[], itemId: string): MenuItem[] | null {
  const flat = flattenMenu(items);
  const index = flat.findIndex((entry) => entry.id === itemId);
  if (index < 0) return null;
  const entry = flat[index]!;
  const siblingsBefore = flat.slice(0, index).filter((other) => other.parentId === entry.parentId);
  const newParent = siblingsBefore[siblingsBefore.length - 1];
  if (!newParent || entry.depth + levelsOf(entry.item) >= MAX_MENU_DEPTH) return null;
  const without = removeLink(items, itemId);
  return appendChild(without, newParent.id, entry.item);
}

/** Takes a link out of the link it is in, placing it right after that link. Null at the top level. */
export function outdentMenuItem(items: MenuItem[], itemId: string): MenuItem[] | null {
  const flat = flattenMenu(items);
  const entry = flat.find((other) => other.id === itemId);
  if (!entry || entry.parentId === null) return null;
  const parent = flat.find((other) => other.id === entry.parentId)!;
  const without = removeLink(items, itemId);
  return insertAfter(without, parent.id, entry.item);
}

function removeLink(items: MenuItem[], itemId: string): MenuItem[] {
  return items.filter((item) => item.id !== itemId).map((item) => ({ ...item, children: removeLink(item.children, itemId) }));
}

function appendChild(items: MenuItem[], parentId: string, child: MenuItem): MenuItem[] {
  return items.map((item) => item.id === parentId ? { ...item, children: [...item.children, child] } : { ...item, children: appendChild(item.children, parentId, child) });
}

function insertAfter(items: MenuItem[], siblingId: string, item: MenuItem): MenuItem[] {
  const index = items.findIndex((entry) => entry.id === siblingId);
  if (index >= 0) return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
  return items.map((entry) => ({ ...entry, children: insertAfter(entry.children, siblingId, item) }));
}

/** Replaces one link (found at any level). */
export function replaceMenuItem(items: MenuItem[], replacement: MenuItem): MenuItem[] {
  return items.map((item) => item.id === replacement.id ? { ...replacement, children: item.children } : { ...item, children: replaceMenuItem(item.children, replacement) });
}

/** Removes a link; its sub-links move up into its place, so nothing else disappears. */
export function removeMenuItem(items: MenuItem[], itemId: string): MenuItem[] {
  return items.flatMap((item) => item.id === itemId ? item.children : [{ ...item, children: removeMenuItem(item.children, itemId) }]);
}

/** Adds a link at the end of the top level, or inside another link. */
export function addMenuItem(items: MenuItem[], item: MenuItem, parentId?: string | null): MenuItem[] {
  return parentId ? appendChild(items, parentId, item) : [...items, item];
}

export function countLinks(items: MenuItem[]): number {
  return items.reduce((total, item) => total + 1 + countLinks(item.children), 0);
}

export function newMenuItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `link-${crypto.randomUUID()}` : `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
