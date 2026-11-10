import type { PublicProduct } from "@jelly/storefront-renderer";
import type { Currency, Product } from "@/lib/domain";
import { productCardData } from "./product-card-data";

type Searchable = { name: string; vendor?: string; category?: string; tags?: readonly string[] };

/**
 * Products matching what the shopper is typing, best first: names that start with the words, then names that
 * contain them, then brand, category or tag matches. Every typed word must match somewhere. Case and accents ignored.
 */
export function rankSuggestions<T extends Searchable>(items: readonly T[], query: string, limit: number): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length || limit <= 0) return [];
  const scored: Array<{ item: T; score: number; index: number }> = [];
  items.forEach((item, index) => {
    const name = fold(item.name);
    const other = fold([item.vendor, item.category, ...(item.tags ?? [])].filter(Boolean).join(" "));
    if (!words.every((word) => name.includes(word) || other.includes(word))) return;
    const phrase = words.join(" ");
    const score = name.startsWith(phrase) ? 0 : name.split(/\s+/).some((part) => part.startsWith(words[0])) ? 1 : words.every((word) => name.includes(word)) ? 2 : 3;
    scored.push({ item, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map((entry) => entry.item);
}

/** Suggestions from the store's published products, as product cards. */
export function suggestStoreProducts(products: readonly Product[], storeSlug: string, currency: Currency) {
  const visible = products.filter((product) => product.published && !product.archived);
  return (query: string, limit: number): PublicProduct[] =>
    rankSuggestions(visible, query, limit).map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, currency));
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
