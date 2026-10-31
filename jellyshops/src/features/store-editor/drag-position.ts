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
