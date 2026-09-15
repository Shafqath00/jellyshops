import { expect, it } from "vitest";
import { createDefaultStoreDesign } from "./defaults";
import {
  createDefaultStorefrontDocument,
  migrateStorefrontDocument,
  validateStorefrontDocument,
} from "./storefront-v2";

it("creates a validated V3 home document with three editor regions", () => {
  const document = createDefaultStorefrontDocument("store-demo", "minimal");

  expect(document).toMatchObject({ schemaVersion: 3, storeId: "store-demo" });
  expect(document.regions.header[0].type).toBe("header");
  expect(document.regions.template.some((section) => section.type === "hero")).toBe(true);
  expect(document.regions.footer[0].type).toBe("footer");
  expect(validateStorefrontDocument(document).success).toBe(true);
});

it("migrates V1 home nodes without changing their ids", () => {
  const legacy = createDefaultStoreDesign("playful");
  const migrated = migrateStorefrontDocument(legacy, "store-demo");

  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.theme.presetId).toBe("playful");
  expect(migrated.regions.header[0].id).toBe(legacy.header.id);
  expect(migrated.regions.template.map(({ id }) => id)).toEqual(
    legacy.pages.home.sections.map(({ id }) => id),
  );
  expect(migrated.regions.footer[0].id).toBe(legacy.footer.id);
});

it("rejects duplicate node ids and unsafe media URLs", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  document.regions.template[0].id = document.regions.header[0].id;
  document.regions.template[0].settings.image = {
    id: "image-1",
    url: "javascript:alert(1)",
    alt: "Unsafe",
    focalPoint: { x: 50, y: 50 },
    fit: "cover",
  };

  const result = validateStorefrontDocument(document);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map(({ message }) => message)).toEqual(
      expect.arrayContaining(["Node IDs must be unique", "Media URL uses an unsafe protocol"]),
    );
  }
});
