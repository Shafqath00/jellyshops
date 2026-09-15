import { expect, it } from "vitest";
import { createThemePackDocument, listThemePacks } from "./theme-packs";

it.each(["fresh-market", "artisan-boutique"] as const)("creates an isolated complete %s storefront", (id) => {
  const first = createThemePackDocument(id);
  const second = createThemePackDocument(id);

  first.pages.home.sections[0].settings.changed = true;

  expect(second.pages.home.sections[0].settings.changed).toBeUndefined();
  expect(first.theme.id).toBe(id);
  expect(Object.keys(first.pages)).toEqual(["home", "product", "collection", "cart", "search", "not-found"]);
  expect(first.pages.home.sections.length).toBeGreaterThanOrEqual(7);
});

it("lists both installable ecommerce packs", () => {
  expect(listThemePacks().map((pack) => pack.id)).toEqual(["fresh-market", "artisan-boutique"]);
});
