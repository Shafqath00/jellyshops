import { useEffect, useRef } from "react";

/**
 * Editor keyboard shortcuts, like Shopify's: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or
 * Ctrl+Y redo, Ctrl/Cmd+S save now, Delete/Backspace delete the selected item,
 * Ctrl/Cmd+D duplicate it, Escape clear the selection. Typing in a field never
 * triggers them (except save). They also work while focus is inside the preview frame.
 */
export interface EditorShortcutHandlers {
  undo(): void;
  redo(): void;
  save(): void;
  remove?(): void;
  duplicate?(): void;
  deselect?(): void;
}

function typing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== "function") return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']"));
}

export function shortcutFor(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "target">): keyof EditorShortcutHandlers | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (event.altKey) return null;
  if (mod && key === "s") return "save";
  if (typing(event.target)) return null;
  if (mod && key === "z") return event.shiftKey ? "redo" : "undo";
  if (mod && key === "y") return "redo";
  if (mod && key === "d") return "duplicate";
  if (!mod && (key === "delete" || key === "backspace")) return "remove";
  if (!mod && key === "escape") return "deselect";
  return null;
}

export function useEditorShortcuts(handlers: EditorShortcutHandlers, frameTitle = "Storefront preview") {
  const latest = useRef(handlers);
  useEffect(() => { latest.current = handlers; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const name = shortcutFor(event);
      const handler = name ? latest.current[name] : undefined;
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    // The preview frame has its own window; listen there too, again after each load.
    let frame: HTMLIFrameElement | null = null;
    const listenInFrame = () => { frame?.contentWindow?.removeEventListener("keydown", onKey); frame?.contentWindow?.addEventListener("keydown", onKey); };
    const attachFrame = () => {
      const next = document.querySelector<HTMLIFrameElement>(`iframe[title="${frameTitle}"]`);
      if (next === frame) return;
      frame?.removeEventListener("load", listenInFrame);
      frame?.contentWindow?.removeEventListener("keydown", onKey);
      frame = next;
      frame?.addEventListener("load", listenInFrame);
      listenInFrame();
    };
    window.addEventListener("keydown", onKey);
    attachFrame();
    const observer = new MutationObserver(attachFrame);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener("keydown", onKey); frame?.removeEventListener("load", listenInFrame); frame?.contentWindow?.removeEventListener("keydown", onKey); observer.disconnect(); };
  }, [frameTitle]);
}
