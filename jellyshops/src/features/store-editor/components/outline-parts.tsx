"use client";
import { useEffect, useRef } from "react";
import {
  AlignLeft, Columns3, Footprints, GalleryHorizontal, Heading, Image as ImageIcon, LayoutGrid, LayoutPanelTop, Mail, Megaphone, MessageSquareQuote,
  MousePointerClick, MoreHorizontal, PanelTop, Rows3, ShoppingBag, Square, Star, Store, Type, Video, ChevronsUpDown, Hash, List, Tag, Sparkles, CreditCard,
  type LucideIcon,
} from "lucide-react";

/** A recognisable icon for each kind of section in the page outline. */
export function sectionIcon(type: string): LucideIcon {
  if (type === "header") return PanelTop;
  if (type === "footer") return Footprints;
  if (type.includes("announcement")) return Megaphone;
  if (type.includes("hero") || type.includes("banner") || type.includes("slideshow")) return ImageIcon;
  if (type.includes("product") || type.includes("collection") || type.includes("cart") || type.includes("recently")) return ShoppingBag;
  if (type.includes("gallery") || type.includes("logo")) return GalleryHorizontal;
  if (type.includes("testimonial") || type.includes("review") || type.includes("rating") || type.includes("trust")) return type.includes("rating") ? Star : MessageSquareQuote;
  if (type.includes("newsletter") || type.includes("contact")) return Mail;
  if (type.includes("column") || type.includes("feature")) return Columns3;
  if (type.includes("faq") || type.includes("text") || type.includes("page") || type.includes("article") || type.includes("blog")) return AlignLeft;
  if (type.includes("video")) return Video;
  if (type.includes("spacer") || type.includes("divider")) return Rows3;
  if (type.includes("store") || type.includes("map")) return Store;
  if (type.includes("grid") || type.includes("list")) return LayoutGrid;
  return LayoutPanelTop;
}

/** A recognisable icon for each kind of block or section part. */
export function blockIcon(type: string): LucideIcon {
  // Shared content blocks first: their names would otherwise match the general rules below (icon-list has "list"…).
  if (type === "grid") return LayoutGrid;
  if (type === "accordion" || type === "accordion-row" || type === "collapsible-text" || type === "tabs" || type === "tab") return ChevronsUpDown;
  if (type === "divider" || type === "spacer") return Rows3;
  if (type === "icon-list" || type === "icon-list-item") return List;
  if (type === "icon" || type === "icon-box") return Sparkles;
  if (type === "badge") return Tag;
  if (type === "counter") return Hash;
  if (type === "card") return CreditCard;
  if (type === "section-header" || type === "subheading") return Heading;
  if (type.includes("heading") || type === "title") return Heading;
  if (type.includes("button") || type.includes("link")) return MousePointerClick;
  if (type.includes("image") || type.includes("photo") || type.includes("logo")) return ImageIcon;
  if (type.includes("video")) return Video;
  if (type.includes("text") || type.includes("quote") || type.includes("answer")) return Type;
  if (type.includes("group") || type.includes("column")) return Columns3;
  return Square;
}

export type RowAction = { label: string; ariaLabel?: string; onAction(): void; disabled?: boolean; destructive?: boolean };

/** The ⋯ menu on an outline row. Its buttons stay in the page so keyboard and screen-reader users reach them like any menu. */
export function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, []);
  if (!actions.length) return null;
  return <details ref={ref} className="relative">
    <summary aria-label={`Actions for ${label}`} title="More actions" className="grid size-6 cursor-pointer list-none place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><MoreHorizontal size={14} aria-hidden="true" /></summary>
    <div className="absolute right-0 z-[80] mt-1 w-44 rounded-xl border border-border bg-card p-1 text-[13px] shadow-lg">
      {actions.map((action) => <button key={action.label} type="button" aria-label={action.ariaLabel} disabled={action.disabled} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); action.onAction(); }}
        className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-muted disabled:opacity-40 ${action.destructive ? "text-destructive" : ""}`}>{action.label}</button>)}
    </div>
  </details>;
}
