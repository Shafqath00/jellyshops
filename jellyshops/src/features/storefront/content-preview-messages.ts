/** Messages between the admin and the store's draft preview route (content-preview.tsx). Kept tiny: the admin imports it. */
import { storeLinkSettings, type RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";

/** Sent inside the preview page to the store layout, which draws the header and footer. */
export const PREVIEW_MENUS_EVENT = "jelly:preview-menus";

export const PREVIEW_READY = "jelly-content-preview-ready";
export const PREVIEW_DRAFT = "jelly-content-preview";

export interface ContentPreviewDraft {
  type: typeof PREVIEW_DRAFT;
  kind: "page" | "article";
  title: string;
  handle: string;
  content: Record<string, unknown>;
  excerpt?: string;
  authorName?: string | null;
  tags?: string[];
  publishedAt?: string | null;
  blog?: { id: string; handle: string; title: string };
}

/** Unsaved menus, drawn in the store's real header and footer on its home page. Keys are menu handles. */
export interface MenuPreviewDraft {
  type: typeof PREVIEW_DRAFT;
  kind: "menus";
  menus: Record<string, unknown[]>;
}

/** Where admin messages may come from: this site, plus the admin host when shops have their own addresses. */
export function allowedPreviewOrigins(here: string, settings = storeLinkSettings()): string[] {
  const origins = [here];
  if (settings.mode === "subdomain") {
    const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(settings.rootDomain) || settings.rootDomain.endsWith(".localhost");
    origins.push(`${local ? "http" : "https"}://admin.${settings.rootDomain}`);
  }
  return origins;
}

export function readPreviewDraft(value: unknown): ContentPreviewDraft | MenuPreviewDraft | null {
  if (!value || typeof value !== "object") return null;
  const menus = value as Partial<MenuPreviewDraft>;
  if (menus.type === PREVIEW_DRAFT && menus.kind === "menus") {
    return menus.menus && typeof menus.menus === "object" && Object.values(menus.menus).every(Array.isArray) ? menus as MenuPreviewDraft : null;
  }
  const draft = value as Partial<ContentPreviewDraft>;
  if (draft.type !== PREVIEW_DRAFT || (draft.kind !== "page" && draft.kind !== "article")) return null;
  if (typeof draft.title !== "string" || typeof draft.handle !== "string" || !draft.content || typeof draft.content !== "object") return null;
  return draft as ContentPreviewDraft;
}


/** The published design with some menus swapped for unsaved ones (matched by handle). */
export function withDraftMenus(snapshot: RuntimeStorefrontSnapshotV4, menus: Record<string, unknown[]>): RuntimeStorefrontSnapshotV4 {
  const next = structuredClone(snapshot);
  for (const menu of Object.values(next.menus)) {
    const draft = menus[menu.handle];
    if (draft) (menu as { items: unknown[] }).items = structuredClone(draft);
  }
  return next;
}
