"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ListIndentDecrease, ListIndentIncrease, Trash2 } from "lucide-react";
import type { SelectionAction, SelectionTarget } from "../selection-actions";

/**
 * Shopify-style floating toolbar for the selected section or block, drawn inside
 * the preview frame next to the selected element: move up/down, duplicate,
 * hide/show and delete, plus moving a block into or out of a group when it can. When the element is not on the page (hidden), the toolbar
 * sits at the top of the preview so the item can be shown again.
 */

function findElement(doc: Document, target: SelectionTarget): HTMLElement | null {
  const section = [...doc.querySelectorAll<HTMLElement>("[data-editor-section-id]")].find((item) => item.dataset.editorSectionId === target.sectionId);
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
}: {
  frameTitle?: string;
  target: SelectionTarget | null;
  label: string;
  hidden: boolean;
  actions: Record<SelectionAction, boolean>;
  onAction(action: SelectionAction): void;
}) {
  const doc = usePreviewDocument(frameTitle);
  const [position, setPosition] = useState<{ top: number; left: number; docked: boolean } | null>(null);

  useEffect(() => {
    if (!doc || !target) return;
    const view = doc.defaultView;
    let frame = 0;
    // Skip identical positions so the toolbar's own updates never loop through the observer.
    const set = (next: { top: number; left: number; docked: boolean }) => setPosition((current) => current && current.top === next.top && current.left === next.left && current.docked === next.docked ? current : next);
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = findElement(doc, target);
        doc.querySelectorAll("[data-editor-current]").forEach((item) => { if (item !== element) item.removeAttribute("data-editor-current"); });
        if (element && !element.hasAttribute("data-editor-current")) element.setAttribute("data-editor-current", "");
        const scrollTop = view?.scrollY ?? 0;
        const width = doc.documentElement.clientWidth;
        const rect = element?.getBoundingClientRect();
        // Missing (hidden) or not drawn at this width ("Show on" desktop or phones only): dock at the top.
        if (!element || !rect || (rect.width === 0 && rect.height === 0)) { set({ top: scrollTop + 8, left: width / 2, docked: true }); return; }
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
  }, [doc, target]);

  if (!doc || !target || !position) return null;
  return createPortal(
    <div
      role="toolbar"
      aria-label={`${label} actions`}
      data-editor-toolbar=""
      onClick={(event) => event.stopPropagation()}
      style={{ position: "absolute", top: position.top, left: position.left, transform: position.docked ? "translateX(-50%)" : "translateX(-100%)", zIndex: 2147483000 }}
      className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-1 font-sans text-[#1c1b19] shadow-[0_4px_16px_rgba(0,0,0,0.16)]"
    >
      <style>{currentStyle}</style>
      <span className="max-w-[220px] truncate px-1.5 text-[11px] font-semibold">{hidden ? `${label} (hidden)` : position.docked ? `${label} (not shown at this width)` : label}</span>
      {actionButtons.filter(({ action, onlyWhenAvailable }) => !onlyWhenAvailable || actions[action]).map(({ action, label: name, icon }) => {
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
    </div>,
    doc.body,
  );
}
