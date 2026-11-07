"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, ListIndentDecrease, ListIndentIncrease, Trash2 } from "lucide-react";
import { dropPosition, nestedDropPosition, type DropLine, type NestedDragRect } from "../drag-position";
import type { BlockDropList, SelectionAction, SelectionTarget } from "../selection-actions";

/**
 * Shopify-style floating toolbar for the selected section or block, drawn inside
 * the preview frame next to the selected element: move up/down, duplicate,
 * hide/show and delete, plus moving a block into or out of a group when it can. When the element is not on the page (hidden), the toolbar
 * sits at the top of the preview so the item can be shown again.
 */

/** A part of the section drawn from its settings, and which copy of it (the nth product card). */
export interface ToolbarElement { id: string; index?: number }

function findElement(doc: Document, target: SelectionTarget, element?: ToolbarElement): HTMLElement | null {
  const section = [...doc.querySelectorAll<HTMLElement>("[data-editor-section-id]")].find((item) => item.dataset.editorSectionId === target.sectionId);
  if (section && element) {
    const copies = [...section.querySelectorAll<HTMLElement>("[data-editor-element]")].filter((item) => item.dataset.editorElement === element.id);
    return copies[element.index ?? 0] ?? copies[0] ?? null;
  }
  if (!section || !target.blockId) return section ?? null;
  const blocks = [...section.querySelectorAll<HTMLElement>("[data-editor-block-id]")].filter((item) => item.dataset.editorBlockId === target.blockId);
  return blocks.find((item) => !item.parentElement?.closest("[data-editor-block-id]")) ?? blocks[0] ?? null;
}

function usePreviewDocument(frameTitle: string): Document | null {
  const [doc, setDoc] = useState<Document | null>(null);
  useEffect(() => {
    let frame: HTMLIFrameElement | null = null;
    const sync = () => setDoc(frame?.contentDocument?.body ? frame.contentDocument : null);
    const attach = () => {
      const next = document.querySelector<HTMLIFrameElement>(`iframe[title="${frameTitle}"]`);
      if (next === frame) return;
      frame?.removeEventListener("load", sync);
      frame = next;
      frame?.addEventListener("load", sync);
      sync();
    };
    const first = requestAnimationFrame(attach);
    // The editor can swap the preview frame (page change, device switch).
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(first); observer.disconnect(); frame?.removeEventListener("load", sync); };
  }, [frameTitle]);
  return doc;
}

/** Outlines the selected element even in sections that cannot mark their own selected block. */
const currentStyle = ".theme-preview-viewport [data-editor-current] { outline: 2px solid var(--primary, #2563eb) !important; outline-offset: -2px; }";

const actionButtons: Array<{ action: SelectionAction; label: (hidden: boolean) => string; icon: (hidden: boolean) => typeof ArrowUp; onlyWhenAvailable?: boolean }> = [
  { action: "move-up", label: () => "Move up", icon: () => ArrowUp },
  { action: "move-down", label: () => "Move down", icon: () => ArrowDown },
  { action: "group-in", label: () => "Move into group above", icon: () => ListIndentIncrease, onlyWhenAvailable: true },
  { action: "group-out", label: () => "Move out of group", icon: () => ListIndentDecrease, onlyWhenAvailable: true },
  { action: "duplicate", label: () => "Duplicate", icon: () => Copy },
  { action: "toggle", label: (hidden) => hidden ? "Show" : "Hide", icon: (hidden) => hidden ? Eye : EyeOff },
  { action: "remove", label: () => "Delete", icon: () => Trash2 },
];

export function SelectionToolbar({
  frameTitle = "Storefront preview",
  target,
  label,
  hidden,
  actions,
  onAction,
  siblingIds,
  onMove,
  dropLists,
  onMoveTo,
  element,
  onSelectParent,
}: {
  frameTitle?: string;
  target: SelectionTarget | null;
  label: string;
  hidden: boolean;
  actions: Record<SelectionAction, boolean>;
  onAction(action: SelectionAction): void;
  /** Ids of the items the selection sits among, in page order; with `onMove` they make the grip draggable. */
  siblingIds?: string[];
  /** Drop before the sibling with this id, or at the end of the list when null. */
  onMove?(beforeId: string | null): void;
  /** For a block: every list it may be dragged into (its own, the section's, groups); with `onMoveTo` it can change level. */
  dropLists?: BlockDropList[];
  onMoveTo?(parentId: string | null, beforeId: string | null): void;
  /** A section element is selected: the toolbar outlines it and offers going up to its section instead of the section's actions. */
  element?: ToolbarElement;
  onSelectParent?(): void;
}) {
  const doc = usePreviewDocument(frameTitle);
  const elementId = element?.id;
  const elementIndex = element?.index;
  const elementTarget = useMemo(() => elementId ? { id: elementId, index: elementIndex } : undefined, [elementId, elementIndex]);
  const [position, setPosition] = useState<{ top: number; left: number; docked: boolean } | null>(null);
  const [dropLine, setDropLine] = useState<DropLine | null>(null);
  const nested = Boolean(target?.blockId && dropLists && onMoveTo);
  const canDrag = element ? false : nested ? (dropLists!.length > 1 || (siblingIds?.length ?? 0) > 1) : Boolean(onMove && siblingIds && siblingIds.length > 1);

  // Drag the grip over the preview: a line shows where the item would land, and letting go moves it there.
  // Blocks can also go into or out of groups (any list in `dropLists`).
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!doc || !target || !canDrag || event.button > 0) return;
    event.preventDefault();
    const view = doc.defaultView;
    if (!view) return;
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const draggedId = target.blockId ?? target.sectionId;
    let pointer = { x: event.clientX, y: event.clientY };
    let latest: { parentId: string | null; beforeId: string | null } | null = null;
    let frame = 0;
    const box = (element: HTMLElement | null) => {
      const rect = element?.getBoundingClientRect();
      return rect && (rect.width > 0 || rect.height > 0) ? { top: rect.top + view.scrollY, bottom: rect.bottom + view.scrollY, left: rect.left + view.scrollX, right: rect.right + view.scrollX } : null;
    };
    const ownParentId = nested ? dropLists!.find((list) => list.ids.includes(draggedId))?.parentId ?? null : null;
    const measureNested = () => {
      const rects: NestedDragRect[] = [];
      const emptyLists: Array<{ parentId: string; rect: NestedDragRect }> = [];
      for (const list of dropLists!) {
        for (const id of list.ids) {
          const found = box(findElement(doc, { sectionId: target.sectionId, blockId: id }));
          if (found) rects.push({ id, parentId: list.parentId, ...found });
        }
        if (list.parentId && list.ids.length === 0) {
          const found = box(findElement(doc, { sectionId: target.sectionId, blockId: list.parentId }));
          if (found) emptyLists.push({ parentId: list.parentId, rect: { id: list.parentId, parentId: null, ...found } });
        }
      }
      return { rects, emptyLists };
    };
    const measure = () => (siblingIds ?? []).flatMap((id) => {
      const found = box(findElement(doc, target.blockId ? { sectionId: target.sectionId, blockId: id } : { sectionId: id }));
      return found ? [{ id, top: found.top, bottom: found.bottom }] : [];
    });
    const tick = () => {
      if (pointer.y < 60) view.scrollBy(0, -14);
      else if (pointer.y > view.innerHeight - 60) view.scrollBy(0, 14);
      const x = pointer.x + view.scrollX;
      const y = pointer.y + view.scrollY;
      if (nested) {
        const { rects, emptyLists } = measureNested();
        const drop = nestedDropPosition(rects, draggedId, ownParentId, x, y, emptyLists);
        latest = drop;
        setDropLine(drop ? drop.line : null);
      } else {
        const drop = dropPosition(measure(), draggedId, y);
        latest = drop ? { parentId: null, beforeId: drop.beforeId } : null;
        setDropLine(drop ? { top: drop.lineY - 2, left: 0, width: doc.documentElement.clientWidth, height: 4 } : null);
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (moveEvent: PointerEvent) => { pointer = { x: moveEvent.clientX, y: moveEvent.clientY }; };
    const finish = (commit: boolean) => {
      cancelAnimationFrame(frame);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", cancel);
      doc.removeEventListener("keydown", key);
      setDropLine(null);
      if (!commit || !latest) return;
      if (nested) onMoveTo!(latest.parentId, latest.beforeId);
      else onMove?.(latest.beforeId);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") finish(false); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", cancel);
    doc.addEventListener("keydown", key);
    frame = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!doc || !target) return;
    const view = doc.defaultView;
    let frame = 0;
    // Skip identical positions so the toolbar's own updates never loop through the observer.
    const set = (next: { top: number; left: number; docked: boolean }) => setPosition((current) => current && current.top === next.top && current.left === next.left && current.docked === next.docked ? current : next);
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = findElement(doc, target, elementTarget);
        doc.querySelectorAll("[data-editor-current]").forEach((item) => { if (item !== found) item.removeAttribute("data-editor-current"); });
        if (found && !found.hasAttribute("data-editor-current")) found.setAttribute("data-editor-current", "");
        const scrollTop = view?.scrollY ?? 0;
        const width = doc.documentElement.clientWidth;
        const rect = found?.getBoundingClientRect();
        // Missing (hidden) or not drawn at this width ("Show on" desktop or phones only): dock at the top.
        if (!found || !rect || (rect.width === 0 && rect.height === 0)) { set({ top: scrollTop + 8, left: width / 2, docked: true }); return; }
        // Above the element's top-right corner, or just inside it when there is no room above.
        const top = rect.top >= 44 ? rect.top + scrollTop - 40 : Math.max(rect.top, 0) + scrollTop + 6;
        set({ top, left: Math.min(Math.max(rect.right - 6, 220), width - 6), docked: false });
      });
    };
    place();
    const content = new MutationObserver(place);
    content.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-editor-selected", "data-editor-block-selected"] });
    view?.addEventListener("scroll", place, { passive: true });
    view?.addEventListener("resize", place);
    // The preview is hidden (zero size) while the editor shows another tab on small screens; measure again when it comes back.
    const size = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    size?.observe(doc.documentElement);
    return () => { cancelAnimationFrame(frame); content.disconnect(); size?.disconnect(); doc.querySelectorAll("[data-editor-current]").forEach((item) => item.removeAttribute("data-editor-current")); view?.removeEventListener("scroll", place); view?.removeEventListener("resize", place); };
  }, [doc, target, elementTarget]);

  if (!doc || !target || !position) return null;
  return createPortal(
    <>
    {dropLine !== null && <div aria-hidden="true" data-editor-drop-line="" style={{ position: "absolute", left: dropLine.left, top: dropLine.top, width: dropLine.width, height: dropLine.height, borderRadius: 2, background: "var(--primary, #2563eb)", pointerEvents: "none", zIndex: 2147482999 }} />}
    <div
      role="toolbar"
      aria-label={`${label} actions`}
      data-editor-toolbar=""
      onClick={(event) => event.stopPropagation()}
      style={{ position: "absolute", top: position.top, left: position.left, transform: position.docked ? "translateX(-50%)" : "translateX(-100%)", zIndex: 2147483000 }}
      className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-1 font-sans text-[#1c1b19] shadow-[0_4px_16px_rgba(0,0,0,0.16)]"
    >
      <style>{currentStyle}</style>
      {canDrag && !hidden && !position.docked && (
        <button type="button" aria-label="Drag to move" title="Drag to move" onPointerDown={startDrag} style={{ touchAction: "none", cursor: "grab" }} className="grid size-7 place-items-center rounded-md hover:bg-black/[0.06]">
          <GripVertical size={14} strokeWidth={1.9} />
        </button>
      )}
      <span className="max-w-[220px] truncate px-1.5 text-[11px] font-semibold">{hidden ? `${label} (hidden)` : position.docked ? `${label} (not shown at this width)` : label}</span>
      {element && onSelectParent && (
        <button type="button" onClick={onSelectParent} className="h-7 rounded-md px-2 text-[11px] font-medium text-[#55524c] hover:bg-black/[0.06]">
          Select section
        </button>
      )}
      {!element && actionButtons.filter(({ action, onlyWhenAvailable }) => !onlyWhenAvailable || actions[action]).map(({ action, label: name, icon }) => {
        const Icon = icon(hidden);
        const text = name(hidden);
        return (
          <button
            key={action}
            type="button"
            aria-label={text}
            title={text}
            disabled={!actions[action]}
            onClick={() => onAction(action)}
            className={`grid size-7 place-items-center rounded-md transition hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-30 ${action === "remove" ? "text-[#b42318]" : ""}`}
          >
            <Icon size={14} strokeWidth={1.9} />
          </button>
        );
      })}
    </div>
    </>,
    doc.body,
  );
}
