import { z } from "zod";
import { isSafeMenuImageUrl, MAX_MENU_IMAGE_ALT, type MenuImage } from "./menu-image-read.js";

export { isSafeMenuImageUrl, MAX_MENU_DEPTH, MAX_MENU_IMAGE_ALT, MAX_MENU_IMAGE_URL, readMenuImage, type MenuImage } from "./menu-image-read.js";

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
