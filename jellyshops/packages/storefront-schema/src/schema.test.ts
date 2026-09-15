import { expect, it } from "vitest";
import { createDefaultStoreDesign } from "./defaults";
import { storeDesignDocumentSchema } from "./schema";

it("validates a complete default Store Design document", () => {
  const result = storeDesignDocumentSchema.safeParse(createDefaultStoreDesign());
  expect(result.success, result.success ? undefined : JSON.stringify(result.error.issues)).toBe(true);
});

it("validates Fresh Market with every public ecommerce page", () => {
  const result = storeDesignDocumentSchema.safeParse(createDefaultStoreDesign("fresh-market" as never));

  expect(result.success, result.success ? undefined : JSON.stringify(result.error.issues)).toBe(true);
  if (result.success) {
    expect(Object.keys(result.data.pages)).toEqual(["home", "product", "collection", "cart", "search", "not-found"]);
  }
});

it("rejects an unsupported theme", () => {
  const document = createDefaultStoreDesign() as { theme: { id: string } };
  document.theme.id = "neon";

  expect(storeDesignDocumentSchema.safeParse(document).success).toBe(false);
});

it("rejects a malformed mobile override", () => {
  const document = createDefaultStoreDesign();
  document.pages.home.sections[0].responsive = { mobile: "center" } as never;

  expect(storeDesignDocumentSchema.safeParse(document).success).toBe(false);
});

it.each([
  ["home", "hero"],
  ["product", "product-information"],
  ["collection", "collection-product-grid"]
] as const)("requires the %s page's %s section", (page, requiredSection) => {
  const document = createDefaultStoreDesign();
  document.pages[page].sections = document.pages[page].sections.filter((section) => section.type !== requiredSection);

  expect(storeDesignDocumentSchema.safeParse(document).success).toBe(false);
});
