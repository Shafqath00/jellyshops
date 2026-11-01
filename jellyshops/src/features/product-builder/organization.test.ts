import { expect, it } from "vitest";
import { draftToPayload, emptyDraft, productToDraft } from "./draft";
import type { Product } from "@/lib/domain";

it("keeps organization and stock tracking independent from category", () => {
  const product: Product = { id: "p", storeId: "s", name: "Tee", slug: "tee", description: "", category: "Clothing", productType: "Everyday", vendor: "Jelly", tags: ["summer"], collectionIds: ["c"], primaryCategoryId: "shirts", imageUrl: "", published: true, archived: false, featured: false, variants: [{ id: "v", name: "Standard", priceMinor: 1200, sku: "T", stock: 4, trackInventory: false }] };
  const { draft, persisted } = productToDraft(product);
  const payload = draftToPayload({ ...draft, categoryId: "other" }, "Different category", persisted);
  expect(payload).toMatchObject({ productType: "Everyday", vendor: "Jelly", tags: ["summer"], collectionIds: ["c"], variants: [{ trackInventory: false }] });
  expect(draftToPayload({ ...emptyDraft, title: "Tee", price: "12", productType: "", vendor: "", tags: [], collectionIds: [] }, "Shirts")).toMatchObject({ productType: null, vendor: null, tags: [], collectionIds: [] });
});

it("round trips optional specifications, saved brand and extra categories", () => {
  const draft = { ...emptyDraft, title: "Tee", price: "12", categoryId: "primary", specificationsText: "Material: Cotton\nCare: Cold wash", brandId: "brand", additionalCategoryIds: ["primary", "secondary"] };
  expect(draftToPayload(draft, undefined)).toMatchObject({ specifications: { Material: "Cotton", Care: "Cold wash" }, brandId: "brand", additionalCategoryIds: ["secondary"] });
  expect(draftToPayload({ ...draft, specificationsText: "", brandId: "", additionalCategoryIds: [] }, undefined)).toMatchObject({ specifications: {}, brandId: null, additionalCategoryIds: [] });
});
