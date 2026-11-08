import { expect, it } from "vitest";
import { getDemoCatalog } from "./demo-catalog-provider.js";

it("returns browser-loadable image URLs for every demo product and collection", () => {
  const catalog = getDemoCatalog();
  const urls = [...catalog.products, ...catalog.collections].map(({ imageUrl }) => imageUrl);

  expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
});
