import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimeStorefrontView } from "./runtime-storefront-view";

describe("the shopper's language reaches every section", () => {
  it("draws the page's own sections (not only header and footer) in the chosen language", () => {
    const search = { id: "search", type: "search-results", enabled: true, settings: { heading: "Find a bed", translations: { fr: { heading: "Trouver un lit" } } }, blocks: [] };
    const route = {
      status: "ready", resource: null, template: {}, sections: [search],
      context: { pageType: "search", resource: null, data: { type: "search", query: "lit", state: "empty", resultCount: 0, results: [] } },
      layout: { announcement: [], header: [], template: [search], footer: [] },
    };
    const html = renderToStaticMarkup(<RuntimeStorefrontView route={route as never} commerce={{ getProducts: async () => [] } as never} themeId="jelly-resthaven" storeSlug="s" language="fr" />);
    expect(html).toContain("Trouver un lit");
    expect(html).toContain("Saisissez un ou deux mots pour trouver des produits.");
    expect(html).not.toContain("Find a bed");
  });
});
