"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { storeUrl } from "@jelly/storefront-schema";
import { PREVIEW_DRAFT, PREVIEW_READY, type ContentPreviewDraft } from "@/features/storefront/content-preview-messages";

type Device = "desktop" | "tablet" | "phone";

/** Where the store's preview route lives, and whether it can be framed (same site) or needs its own tab. */
export function previewTarget(storeSlug: string, here = typeof window === "undefined" ? "" : window.location.origin): { url: string; origin: string; framed: boolean } {
  const address = storeUrl(storeSlug, "/jelly-preview");
  const url = new URL(address, here || "http://localhost");
  return { url: url.toString(), origin: url.origin, framed: !here || url.origin === here };
}

/**
 * Shows the unsaved draft in the store's real theme. Same-site stores are framed here with Desktop/Tablet/Phone
 * widths; stores on their own address open in a new tab (the draft is sent to that tab the same way).
 */
export function PreviewDialog({ open, onClose, storeSlug, draft }: { open: boolean; onClose: () => void; storeSlug: string; draft: Omit<ContentPreviewDraft, "type"> }) {
  const [device, setDevice] = useState<Device>("desktop");
  /** The store page never said it was ready (no published design, or the store is closed). */
  const [silent, setSilent] = useState(false);
  const readyRef = useRef(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const windowRef = useRef<Window | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const target = previewTarget(storeSlug);
  const message: ContentPreviewDraft = { ...draft, type: PREVIEW_DRAFT };
  const messageRef = useRef(message);
  useEffect(() => { messageRef.current = message; });

  const send = useCallback((to: Window | null | undefined) => to?.postMessage(messageRef.current, target.origin), [target.origin]);

  // The preview page says when it is ready; the draft is sent then, and again whenever it changes.
  useEffect(() => {
    if (!open) return;
    const listener = (event: MessageEvent) => {
      if (event.origin !== target.origin || (event.data as { type?: string } | null)?.type !== PREVIEW_READY) return;
      readyRef.current = true;
      setSilent(false);
      send(event.source as Window);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [open, send, target.origin]);

  useEffect(() => {
    if (!open) return;
    send(frameRef.current?.contentWindow);
    if (windowRef.current && !windowRef.current.closed) send(windowRef.current);
  });

  useEffect(() => () => { if (silenceTimer.current) clearTimeout(silenceTimer.current); }, []);

  // Escape closes it; focus starts on Close and goes back where it was.
  useEffect(() => {
    if (!open || !target.framed) return;
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [open, onClose, target.framed]);

  // On its own address, the preview is a tab of its own.
  useEffect(() => {
    if (!open || target.framed) return;
    windowRef.current = window.open(target.url, "jelly-content-preview");
    onClose();
  }, [open, target.framed, target.url, onClose]);

  if (!open || !target.framed || typeof document === "undefined") return null;
  return createPortal(
    <div className="jca-preview admin-ui-preview" role="dialog" aria-modal="true" aria-label={`Preview: ${draft.title || "Untitled"}`}>
      <div className="jca-preview-bar">
        <h2>Preview <span className="jk-muted">· your unsaved changes, in your store&apos;s design</span></h2>
        <div className="jca-segmented" role="group" aria-label="Screen size">
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={15} aria-hidden /> Desktop</button>
          <button type="button" aria-pressed={device === "tablet"} onClick={() => setDevice("tablet")}><Tablet size={15} aria-hidden /> Tablet</button>
          <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}><Smartphone size={15} aria-hidden /> Phone</button>
        </div>
        <button type="button" className="jk-button" onClick={() => { windowRef.current = window.open(target.url, "jelly-content-preview"); }}><ExternalLink size={15} aria-hidden /> New tab</button>
        <button ref={closeRef} type="button" className="jk-button" onClick={onClose}><X size={15} aria-hidden /> Close</button>
      </div>
      <div className="jca-preview-stage">
        <iframe ref={frameRef} className="jca-preview-frame" data-device={device} src={target.url} title="Store preview" onLoad={() => {
          send(frameRef.current?.contentWindow);
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
          silenceTimer.current = setTimeout(() => { if (!readyRef.current) setSilent(true); }, 2500);
        }} />
        {silent && (
          <div className="jca-preview-note" role="status">
            <strong>This store can&apos;t show a preview yet</strong>
            <p>Previews use your published store design. Publish a design in Online store, then try again.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
