import type { V4StarterPack } from "@jelly/storefront-registry";

/** Shop types the Store designs gallery can be filtered by. */
export const TEMPLATE_CATEGORIES = ["Fashion", "Home & living", "Beauty", "Food & drink", "Electronics"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

type GalleryEntry = { category: TemplateCategory; cover: string; tags: string[] };

/**
 * How each store design is shown in the gallery. Covers are photographs made with ChatGPT image
 * generation (9 November 2026, no text or logos), stored as 1200x800 WebP in `public/templates/`.
 */
const GALLERY: Record<string, GalleryEntry> = {
  "jelly-avenue": { category: "Fashion", cover: "/templates/jelly-avenue.webp", tags: ["Editorial", "Image-led"] },
  "jelly-signature": { category: "Fashion", cover: "/templates/jelly-signature.webp", tags: ["Clean", "Minimal"] },
  "fresh-market": { category: "Food & drink", cover: "/templates/fresh-market.webp", tags: ["Bright", "Natural"] },
  "artisan-boutique": { category: "Home & living", cover: "/templates/artisan-boutique.webp", tags: ["Warm", "Handmade"] },
  "jelly-diode": { category: "Electronics", cover: "/templates/jelly-diode.webp", tags: ["Technical", "Compare products"] },
  "jelly-forma": { category: "Home & living", cover: "/templates/jelly-forma.webp", tags: ["Furniture", "Search-first"] },
  "jelly-halo": { category: "Beauty", cover: "/templates/jelly-halo.webp", tags: ["Skincare", "Reviews"] },
  "jelly-harbour": { category: "Home & living", cover: "/templates/jelly-harbour.webp", tags: ["Coastal", "Calm"] },
  "jelly-resthaven": { category: "Home & living", cover: "/templates/jelly-resthaven.webp", tags: ["Showroom", "Big-ticket"] },
};

/** Merchant-facing name: short, without "Jelly" ("Jelly Avenue" -> "Avenue"). Ids never change. */
export function templateDisplayName(name: string): string {
  return name.replace(/^Jelly\s+/i, "").trim() || name;
}

export type GalleryTemplate = { id: string; name: string; summary: string; category?: TemplateCategory; cover?: string; tags: string[] };

export function galleryTemplate(starter: Pick<V4StarterPack, "id" | "name" | "summary" | "tags" | "previewAsset">): GalleryTemplate {
  const entry = GALLERY[starter.id];
  return {
    id: starter.id,
    name: templateDisplayName(starter.name),
    summary: starter.summary,
    category: entry?.category,
    cover: entry?.cover ?? (starter.previewAsset || undefined),
    tags: entry?.tags ?? starter.tags,
  };
}

/** Categories that at least one template uses, in the fixed order above. */
export function usedCategories(templates: GalleryTemplate[]): TemplateCategory[] {
  return TEMPLATE_CATEGORIES.filter((category) => templates.some((template) => template.category === category));
}
