/**
 * Where a dragged section or block would land: the pointer's height against the
 * siblings' rectangles gives the sibling to drop before (null for the end of the
 * list) and where to draw the drop line. Items that are not on the page (hidden) have no rectangle and are skipped.
 */
export interface DragRect { id: string; top: number; bottom: number }

export function dropPosition(rects: DragRect[], draggedId: string, y: number): { beforeId: string | null; lineY: number } | null {
  const others = rects.filter((rect) => rect.id !== draggedId);
  if (others.length === 0) return null;
  const next = others.find((rect) => y < (rect.top + rect.bottom) / 2);
  return next ? { beforeId: next.id, lineY: next.top } : { beforeId: null, lineY: others[others.length - 1].bottom };
}

/** A block's rectangle and the list it sits in (`parentId` null = the section's own blocks). */
export interface NestedDragRect extends DragRect { parentId: string | null; left: number; right: number }
export interface DropLine { top: number; left: number; width: number; height: number }

const contains = (rect: NestedDragRect, x: number, y: number) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
const area = (rect: NestedDragRect) => (rect.right - rect.left) * (rect.bottom - rect.top);
/** Items laid out side by side (a horizontal group): two of them share a row. */
const sideBySide = (list: NestedDragRect[]) => list.some((a, index) => list.slice(index + 1).some((b) => a.top < b.bottom - 4 && b.top < a.bottom - 4));

/**
 * Where a block dragged across levels would land. The innermost block under the
 * pointer decides the list (its own); the pointer's half of that block gives
 * before or after it (left/right halves in a horizontal group). Over an empty
 * group the block goes inside it. Elsewhere it stays in its own list.
 */
export function nestedDropPosition(
  rects: NestedDragRect[],
  draggedId: string,
  ownParentId: string | null,
  x: number,
  y: number,
  emptyLists: Array<{ parentId: string; rect: NestedDragRect }> = [],
): { parentId: string | null; beforeId: string | null; line: DropLine } | null {
  const others = rects.filter((rect) => rect.id !== draggedId);
  const under = others.filter((rect) => contains(rect, x, y)).sort((a, b) => area(a) - area(b))[0];
  const empty = emptyLists.find((list) => contains(list.rect, x, y) && (!under || area(list.rect) <= area(under)));
  if (empty) {
    const { rect } = empty;
    return { parentId: empty.parentId, beforeId: null, line: { top: rect.top + 4, left: rect.left + 4, width: Math.max(rect.right - rect.left - 8, 4), height: 4 } };
  }
  if (!under) {
    const own = others.filter((rect) => rect.parentId === ownParentId);
    const flat = dropPosition(own, draggedId, y);
    if (!flat) return null;
    const lineRect = own.find((rect) => rect.id === flat.beforeId) ?? own[own.length - 1];
    return { parentId: ownParentId, beforeId: flat.beforeId, line: { top: flat.lineY - 2, left: lineRect.left, width: lineRect.right - lineRect.left, height: 4 } };
  }
  const list = others.filter((rect) => rect.parentId === under.parentId);
  const horizontal = sideBySide(list);
  const before = horizontal ? x < (under.left + under.right) / 2 : y < (under.top + under.bottom) / 2;
  const next = list[list.indexOf(under) + 1];
  const beforeId = before ? under.id : next?.id ?? null;
  const line = horizontal
    ? { top: under.top, left: (before ? under.left : under.right) - 2, width: 4, height: under.bottom - under.top }
    : { top: (before ? under.top : under.bottom) - 2, left: under.left, width: under.right - under.left, height: 4 };
  return { parentId: under.parentId, beforeId, line };
}
