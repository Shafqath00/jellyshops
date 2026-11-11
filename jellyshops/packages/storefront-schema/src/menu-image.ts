import { z } from "zod";

/**
 * A photo on a menu link, shown as a tile in the header's mega menu ("Shop by room").
 * The address is a full https address (merchant media) or a path on the store's own site
 * ("/themes/<id>/room.webp"); nothing else is accepted, so a menu can never load from http or data: URLs.
 */
export interface MenuImage {
  url: string;
  alt?: string;
}

export const MAX_MENU_IMAGE_URL = 2000;
export const MAX_MENU_IMAGE_ALT = 200;
/** Menus can go three levels deep: top link, column or tile, and the links inside a column. */
export const MAX_MENU_DEPTH = 3;

/**
 * True for an https address or a path on the store. `allowLocalHttp` also accepts http on this computer
 * (localhost, 127.0.0.1): uploaded photos are saved as API paths and shown from the local API during development.
 */
export function isSafeMenuImageUrl(url: string, options: { allowLocalHttp?: boolean } = {}): boolean {
  if (url.length === 0 || url.length > MAX_MENU_IMAGE_URL) return false;
  if (/[\s\x00-\x1f\x7f\\"'<>]/.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return options.allowLocalHttp === true && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export const menuImageSchema = z.object({
  url: z.string().trim().refine(isSafeMenuImageUrl, "Menu photo must be an https address or a path on this store"),
  alt: z.string().trim().max(MAX_MENU_IMAGE_ALT).optional(),
}).strict();

/** Returns a clean copy of a menu photo, undefined when there is none, or throws a plain message when it is not allowed. */
export function normalizeMenuImage(value: unknown): MenuImage | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = menuImageSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Menu photo is not valid");
  const alt = parsed.data.alt?.trim();
  return alt ? { url: parsed.data.url, alt } : { url: parsed.data.url };
}

/** The menu photo if it is safe to draw, otherwise undefined (old or hand-edited data never breaks the header). */
export function readMenuImage(value: unknown): MenuImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { url, alt } = value as { url?: unknown; alt?: unknown };
  if (typeof url !== "string" || !isSafeMenuImageUrl(url.trim(), { allowLocalHttp: true })) return undefined;
  const text = typeof alt === "string" ? alt.trim().slice(0, MAX_MENU_IMAGE_ALT) : "";
  return text ? { url: url.trim(), alt: text } : { url: url.trim() };
}
