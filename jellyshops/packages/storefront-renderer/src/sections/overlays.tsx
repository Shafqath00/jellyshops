import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { sectionScheme } from "../section-frame";
import { renderBlocks } from "./custom-content";
import { choice, numberValue, stringValue } from "./shared";

/**
 * Overlay sections (theme plan T6 part 2), drawn from the store's overlay group on every page.
 * In the editor they are drawn in place, so the merchant can click and edit them; on the store the pop-up opens over
 * the page and the slide-out bag section only gives its settings to the store's bag drawer.
 */

const DAY = 24 * 60 * 60 * 1000;
const dismissKey = (storeSlug: string | undefined, sectionId: string) => `jelly-popup:${storeSlug ?? "store"}:${sectionId}`;

function readDismissed(key: string): number | null {
  try { const value = Number(window.localStorage.getItem(key)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; }
}
function writeDismissed(key: string) {
  try { window.localStorage.setItem(key, String(Date.now())); } catch { /* private window: the pop-up may show again */ }
}

/** Whether a shopper who closed the pop-up at `closedAt` should see it again now. */
export function popupDue(closedAt: number | null, showAgainDays: number, now = Date.now()): boolean {
  return closedAt === null || now - closedAt >= showAgainDays * DAY;
}

function photo(section: SectionNode) {
  const image = section.settings.image as { url?: unknown; alt?: unknown } | undefined;
  return typeof image?.url === "string" && image.url ? { url: image.url, alt: typeof image.alt === "string" ? image.alt : "" } : null;
}

function PopupContent({ section, context, editor, selectedBlockId, titleId }: { section: SectionNode; context: StorefrontRuntimeContext; editor: boolean; selectedBlockId?: string; titleId?: string }) {
  const image = photo(section);
  return <div className="jelly-popup-content" id={titleId}>
    {/* eslint-disable-next-line @next/next/no-img-element -- merchant photo in a shared renderer */}
    {image && <img className="jelly-popup-image" src={image.url} alt={image.alt} />}
    <div className="jelly-popup-body">{renderBlocks(section.blocks, { context, editor, selectedBlockId })}</div>
  </div>;
}

export function PopupSection({ section, context, editor = false, selectedBlockId }: { section: SectionNode; context: StorefrontRuntimeContext; editor?: boolean; selectedBlockId?: string }) {
  const position = choice(section.settings, "position", ["centre", "corner"] as const, "centre");
  const delay = numberValue(section.settings, "delaySeconds", 5, 0, 120);
  const again = numberValue(section.settings, "showAgainDays", 14, 1, 365);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);
  const [root, setRoot] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const key = dismissKey(context.storeSlug, section.id);

  useEffect(() => {
    if (editor) return;
    // Drawn inside the theme root, so it keeps the store's colours and fonts but no section's transform.
    setRoot(anchor.current?.closest("[data-jelly-theme]") ?? document.body);
    if (!popupDue(readDismissed(key), again)) return;
    const timer = window.setTimeout(() => setOpen(true), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [editor, key, delay, again]);

  useEffect(() => {
    if (!open) return;
    before.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();
  }, [open]);

  const close = () => {
    writeDismissed(key);
    setOpen(false);
    before.current?.focus?.();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); close(); return; }
    if (event.key !== "Tab" || position === "corner") return;
    // Keep keyboard focus inside the pop-up while it covers the page.
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])].filter((item) => !item.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (editor) {
    return <section className="jelly-section jelly-popup-preview" data-position={position}>
      <p className="jelly-overlay-note">Pop-up: opens {delay ? `${delay} seconds after a shopper arrives` : "as soon as a shopper arrives"}, then not again for {again} {again === 1 ? "day" : "days"} once closed.</p>
      <div className="jelly-popup-panel" data-position={position}><PopupContent section={section} context={context} editor selectedBlockId={selectedBlockId} /></div>
    </section>;
  }
  const dialog = open ? <div className="jelly-popup" data-position={position} onMouseDown={(event) => { if (position === "centre" && event.target === event.currentTarget) close(); }}>
    <div ref={panel} className="jelly-popup-panel" data-position={position} data-scheme={sectionScheme(section.settings)} role="dialog" aria-modal={position === "centre" ? true : undefined} aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      <button type="button" className="jelly-popup-close" aria-label="Close" onClick={close}><span aria-hidden="true">×</span></button>
      <PopupContent section={section} context={context} editor={false} titleId={titleId} />
    </div>
  </div> : null;
  return <><span ref={anchor} hidden />{dialog && root ? createPortal(dialog, root) : null}</>;
}

/** The store's bag drawer reads these settings; a missing or empty value keeps the theme's own. */
export interface CartDrawerSectionSettings { variant: "drawer" | "sheet"; heading?: string; emptyText?: string; freeDeliveryFromMinor: number | null }
export function cartDrawerSectionSettings(section: SectionNode): CartDrawerSectionSettings {
  const from = numberValue(section.settings, "freeDeliveryFrom", 0, 0, 100000);
  return {
    variant: choice(section.settings, "style", ["drawer", "sheet"] as const, "drawer"),
    heading: stringValue(section.settings, "heading") || undefined,
    emptyText: stringValue(section.settings, "emptyText") || undefined,
    freeDeliveryFromMinor: from > 0 ? Math.round(from * 100) : null,
  };
}

/** Editor only: a still picture of the slide-out bag with its settings, so the merchant sees what they change. */
export function CartDrawerSection({ section, editor = false }: { section: SectionNode; editor?: boolean }) {
  if (!editor) return null;
  const settings = cartDrawerSectionSettings(section);
  return <section className="jelly-section jelly-cart-drawer-preview">
    <p className="jelly-overlay-note">Slide-out bag: opens over the page when a shopper adds something or taps the bag.{settings.variant === "sheet" ? " On phones it rises from the bottom." : ""}</p>
    <div className="jelly-cart-drawer-preview-panel" aria-hidden="true">
      <strong className="jelly-cart-drawer-preview-heading">{settings.heading ?? "Your bag"}</strong>
      {settings.freeDeliveryFromMinor !== null && <p className="jelly-cart-drawer-preview-free">Free delivery on orders over {(settings.freeDeliveryFromMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
      <p className="jelly-cart-drawer-preview-empty">{settings.emptyText ?? "Your bag is empty."}</p>
      <span className="jelly-button">Check out</span>
    </div>
  </section>;
}
