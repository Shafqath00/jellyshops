import { describe, expect, it } from "vitest";
import { STOREFRONT_WORDS, STOREFRONT_WORD_TRANSLATIONS, storefrontWord, type StorefrontWordKey } from "./storefront-words";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("built-in storefront words", () => {
  it.each(Object.keys(STOREFRONT_WORD_TRANSLATIONS))("%s translates every word, with the same values to fill in", (language) => {
    const words = STOREFRONT_WORD_TRANSLATIONS[language];
    const keys = Object.keys(STOREFRONT_WORDS) as StorefrontWordKey[];
    expect(keys.filter((key) => !words[key])).toEqual([]);
    expect(Object.keys(words).filter((key) => !(key in STOREFRONT_WORDS))).toEqual([]);
    for (const key of keys) expect(placeholders(words[key] ?? ""), `${language} ${key}`).toEqual(placeholders(STOREFRONT_WORDS[key]));
  });

  it("looks words up by language, regional codes included, and falls back to English", () => {
    expect(storefrontWord("product.addToCart")).toBe("Add to cart");
    expect(storefrontWord("product.addToCart", "fr")).toBe("Ajouter au panier");
    expect(storefrontWord("product.addToCart", "fr-CA")).toBe("Ajouter au panier");
    expect(storefrontWord("product.addToCart", "ta")).toBe("Add to cart");
    expect(storefrontWord("search.results", "de", { count: 3, query: "Bett" })).toBe("3 Ergebnisse für „Bett“");
    expect(storefrontWord("list.showing", null, { shown: 12 })).toBe("Showing 12 of {total}");
  });
});
