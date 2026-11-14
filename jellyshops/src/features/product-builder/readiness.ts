import { majorToMinor } from "@/lib/domain";
import type { ProductDraft } from "./draft";

/**
 * "Is this product ready to sell?" in the merchant's words. Essentials must be done before a product
 * can sensibly go live; the rest are recommendations. Pure, so the builder can show it as it is typed.
 */
export interface ReadinessItem {
  id: "title" | "price" | "photo" | "description" | "stock" | "search";
  label: string;
  done: boolean;
  essential: boolean;
  /** What to do, shown while the item is not done. */
  hint: string;
  /** The id of the builder element that fixes it. */
  target: string;
}
export interface Readiness { items: ReadinessItem[]; done: number; total: number; ready: boolean; summary: string }

const SEO_TITLE_MAX = 70, SEO_DESCRIPTION_MAX = 160;
type Draft = Pick<ProductDraft, "title" | "description" | "imageUrl" | "media" | "price" | "stock" | "trackInventory" | "options" | "published" | "archived"> & { variants?: Array<{ priceMinor: number; stock: number }>; seoTitle?: string; seoDescription?: string };

export function productReadiness(draft: Draft): Readiness {
  const combinations = draft.options.some((option) => option.type === "variant") && (draft.variants?.length ?? 0) > 0;
  const variants = draft.variants ?? [];
  const priced = combinations ? variants.every((variant) => variant.priceMinor > 0) : (majorToMinor(draft.price) || 0) > 0;
  const untracked = draft.trackInventory === false;
  const stocked = untracked || (combinations ? variants.some((variant) => variant.stock > 0) : Number(draft.stock || 0) > 0);
  const seoTitle = draft.seoTitle?.trim().length ?? 0, seoDescription = draft.seoDescription?.trim().length ?? 0;
  const items: ReadinessItem[] = [
    { id: "title", label: "Name", essential: true, done: draft.title.trim().length > 0, hint: "Give the product a name.", target: "pb-title" },
    { id: "price", label: "Price", essential: true, done: priced, hint: combinations ? "Some combinations have no price yet." : "Set a price above 0.", target: combinations ? "pb-variant-list" : "pb-selling" },
    { id: "photo", label: "Photo", essential: false, done: (draft.media?.length ?? 0) > 0 || Boolean(draft.imageUrl), hint: "Products with a photo sell far better. Add at least one.", target: "pb-photos" },
    { id: "description", label: "Description", essential: false, done: draft.description.trim().length >= 20, hint: "Add a sentence or two about what it is and who it is for.", target: "pb-description" },
    { id: "stock", label: "Stock", essential: false, done: stocked, hint: "Nothing is in stock, so shoppers cannot buy it yet.", target: combinations ? "pb-variant-list" : "pb-selling" },
    { id: "search", label: "Search listing", essential: false, done: seoTitle <= SEO_TITLE_MAX && seoDescription <= SEO_DESCRIPTION_MAX, hint: seoTitle > SEO_TITLE_MAX ? `The search title is ${seoTitle} characters. Keep it to ${SEO_TITLE_MAX}.` : `The search description is ${seoDescription} characters. Keep it to ${SEO_DESCRIPTION_MAX}.`, target: seoTitle > SEO_TITLE_MAX ? "pb-seo-title" : "pb-seo-description" },
  ];
  const done = items.filter((item) => item.done).length;
  const ready = items.filter((item) => item.essential).every((item) => item.done);
  const missing = items.filter((item) => !item.done);
  const summary = draft.archived ? "Archived. Restore it to sell it again."
    : !ready ? `Add ${missing.filter((item) => item.essential).map((item) => item.label.toLowerCase()).join(" and ")} before you publish.`
    : missing.length ? (draft.published ? "Live. A few things could make it sell better." : "Ready to publish. A few things could make it sell better.")
    : draft.published ? "Live and complete." : "Ready to publish.";
  return { items, done, total: items.length, ready, summary };
}
