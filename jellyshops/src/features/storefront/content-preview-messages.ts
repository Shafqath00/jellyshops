/** Messages between the admin and the store's draft preview route (content-preview.tsx). Kept tiny: the admin imports it. */
import { storeLinkSettings } from "@jelly/storefront-schema";

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

/** Where admin messages may come from: this site, plus the admin host when shops have their own addresses. */
export function allowedPreviewOrigins(here: string, settings = storeLinkSettings()): string[] {
  const origins = [here];
  if (settings.mode === "subdomain") {
    const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(settings.rootDomain) || settings.rootDomain.endsWith(".localhost");
    origins.push(`${local ? "http" : "https"}://admin.${settings.rootDomain}`);
  }
  return origins;
}

export function readPreviewDraft(value: unknown): ContentPreviewDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<ContentPreviewDraft>;
  if (draft.type !== PREVIEW_DRAFT || (draft.kind !== "page" && draft.kind !== "article")) return null;
  if (typeof draft.title !== "string" || typeof draft.handle !== "string" || !draft.content || typeof draft.content !== "object") return null;
  return draft as ContentPreviewDraft;
}

