import { describe, expect, it, vi } from "vitest";

const product = (extra: Record<string, unknown> = {}) => ({ id: "shirt", storeId: "store-a", name: "Linen shirt", slug: "linen-shirt", description: "A soft, breathable linen shirt for warm days.", category: "Shirts", imageUrl: "https://x/shirt.jpg", published: true, archived: false, featured: false, variants: [{ id: "v", name: "Standard", sku: "", priceMinor: 4900, stock: 2, available: true }], ...extra });
const storefront = vi.hoisted(() => ({ products: [] as unknown[] }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("./product-client", () => ({ default: () => null }));
vi.mock("@/features/storefront/server-storefront", () => ({ getServerStorefront: async () => ({ store: { name: "Hemp & Co", slug: "hemp", currency: "GBP" }, products: storefront.products }) }));

import { generateMetadata } from "./page";

const metadataFor = async (extra: Record<string, unknown> = {}) => {
  storefront.products = [product(extra)];
  return generateMetadata({ params: Promise.resolve({ storeSlug: "hemp", productSlug: "linen-shirt" }) });
};

describe("product page metadata", () => {
  it("uses the seller's search listing for the page and for social cards", async () => {
    const metadata = await metadataFor({ seoTitle: "Organic linen shirt | Hemp & Co", seoDescription: "Breathable organic linen, made to last." });
    expect(metadata.title).toBe("Organic linen shirt | Hemp & Co");
    expect(metadata.description).toBe("Breathable organic linen, made to last.");
    expect(metadata.openGraph).toMatchObject({ title: "Organic linen shirt | Hemp & Co", description: "Breathable organic linen, made to last." });
  });

  it("falls back to the product name, the store and the start of the description", async () => {
    const metadata = await metadataFor({ description: "word ".repeat(80) });
    expect(metadata.title).toBe("Linen shirt · Hemp & Co");
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
    expect(String(metadata.description).endsWith("…")).toBe(true);
    expect(metadata.openGraph).toMatchObject({ title: "Linen shirt" });
  });

  it("points search engines at the product's own address", async () => {
    const metadata = await metadataFor();
    expect(metadata.alternates).toMatchObject({ canonical: "/hemp/products/linen-shirt" });
  });
});
