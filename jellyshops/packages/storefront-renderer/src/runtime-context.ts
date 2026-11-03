import type { RuntimeMenuV4 } from "@jelly/storefront-schema";
import { safeRichTextHref } from "@jelly/storefront-schema";
import type { CommerceDataProvider, RendererMode, StorefrontPageContext } from "./types";

export type RuntimeRegion = "header" | "template" | "footer";

export interface StorefrontRuntimeContext {
  mode: RendererMode;
  region?: RuntimeRegion;
  themeVersion?: string;
  commerce: CommerceDataProvider;
  page?: StorefrontPageContext;
  menus?: Record<string, RuntimeMenuV4>;
  storeSlug?: string;
  collectionLinks?: Record<string, string>;
  resourceLinks?: Record<string, string>;
}

export function createCollectionLinks(storeId: string, storeSlug: string, collections: Array<{ id: string; storeId: string; slug: string }>): Record<string, string> {
  return Object.fromEntries(collections.filter(item => item.storeId === storeId && item.slug).map(item => [item.id, `/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(item.slug)}`]));
}

export function createStorefrontRuntimeContext(input: StorefrontRuntimeContext): StorefrontRuntimeContext {
  return Object.freeze({ ...input });
}

export function resolveStorefrontHref(value: unknown, storeSlug?: string): string | null {
  const safe = safeRichTextHref(value);
  if (!safe || !storeSlug || !safe.startsWith("/")) return safe;
  const root = `/${encodeURIComponent(storeSlug)}`;
  if (safe === root || safe.startsWith(`${root}/`)) return safe;
  return safe === "/" ? root : `${root}${safe}`;
}
