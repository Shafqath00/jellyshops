import { expect, it } from "vitest";
import {
  createDefaultStorefrontDocument,
  createStorefrontTemplate,
  migrateStorefrontDocument,
  validateStorefrontDocument,
} from "./storefront-v2";

it("migrates a V2 home template into a V3 home page without changing its section ids", () => {
  const current = createDefaultStorefrontDocument("store-demo");
  const legacy = {
    schemaVersion: 2,
    storeId: current.storeId,
    template: "home",
    theme: current.theme,
    regions: {
      header: current.regions.header,
      template: current.pages[0].sections,
      footer: current.regions.footer,
    },
  } as const;
  const migrated = migrateStorefrontDocument(legacy, "store-demo");

  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.pages[0]).toMatchObject({
    type: "home",
    title: "Home page",
    slug: "/",
    system: true,
  });
  expect(migrated.pages[0].sections.map(({ id }) => id)).toEqual(
    legacy.regions.template.map(({ id }) => id),
  );
  expect(validateStorefrontDocument(migrated).success).toBe(true);
});

it("creates two editable starter templates", () => {
  const bakes = createStorefrontTemplate("bakes", "store-demo");
  const essentials = createStorefrontTemplate("essentials", "store-demo");

  expect(bakes.pages.find((page) => page.type === "home")?.sections.map(({ type }) => type)).toEqual(
    expect.arrayContaining(["hero", "product-grid", "rich-text"]),
  );
  expect(essentials.pages.find((page) => page.type === "home")?.sections.map(({ type }) => type)).toEqual(
    expect.arrayContaining(["hero", "featured-collection", "product-grid"]),
  );
});
