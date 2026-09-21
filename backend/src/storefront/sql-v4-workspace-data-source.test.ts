import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "../../test/integration/pglite.js";
import {
  createSqlCompilerResourceIdLoader,
  createSqlV4WorkspaceDataSource,
} from "./sql-v4-workspace-data-source.js";

async function seedWorkspace(
  database: IntegrationDatabase,
  storeId: string,
  suffix: string,
): Promise<void> {
  await database.query(
    `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [storeId, suffix === "a" ? 7 : 91],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplate"
       ("id", "storeId", "type", "handle", "name", "layout", "updatedAt")
     VALUES
       ($1, $2, 'HOME', 'default', $3, $4, CURRENT_TIMESTAMP),
       ($5, $2, 'PRODUCT', 'default', $6, $7, CURRENT_TIMESTAMP)`,
    [
      `home-${suffix}`,
      storeId,
      `Home ${suffix}`,
      { sections: [{ kind: "global", globalSectionId: `header-${suffix}` }] },
      `product-${suffix}`,
      `Product ${suffix}`,
      { sections: [] },
    ],
  );

  for (const placement of ["announcement", "header", "footer"] as const) {
    await database.query(
      `INSERT INTO "GlobalSection"
         ("id", "storeId", "name", "section", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        `${placement}-${suffix}`,
        storeId,
        `${placement} ${suffix}`,
        {
          id: `${placement}-section-${suffix}`,
          type: placement === "announcement" ? "announcement-bar" : placement,
          settings: { marker: suffix },
          blocks: [],
        },
      ],
    );
  }

  await database.query(
    `INSERT INTO "NavigationMenu"
       ("id", "storeId", "name", "handle", "items", "updatedAt")
     VALUES ($1, $2, $3, 'main', $4, CURRENT_TIMESTAMP)`,
    [
      `menu-${suffix}`,
      storeId,
      `Menu ${suffix}`,
      [{ id: `item-${suffix}`, label: suffix, target: { kind: "product", resourceId: `catalog-product-${suffix}` }, children: [] }],
    ],
  );
  await database.query(
    `INSERT INTO "ThemeConfiguration"
       ("storeId", "themeId", "settings", "draftArtifactId", "updatedAt")
     VALUES ($1, 'minimal', $2, $3, CURRENT_TIMESTAMP)`,
    [storeId, { accent: suffix }, `artifact-${suffix}`],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplateAssignment"
       ("storeId", "resourceType", "resourceId", "templateId", "updatedAt")
     VALUES ($1, 'product', $2, $3, CURRENT_TIMESTAMP)`,
    [storeId, `catalog-product-${suffix}`, `product-${suffix}`],
  );
  await database.query(
    `INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [`catalog-product-${suffix}`, storeId, `Product ${suffix}`, `product-${suffix}`],
  );
  await database.query(
    `INSERT INTO "Collection" ("id", "storeId", "title", "slug", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [`collection-${suffix}`, storeId, `Collection ${suffix}`, `collection-${suffix}`],
  );
  await database.query(
    `INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "updatedAt")
     VALUES ($1, $2, $3, $4, '{}', CURRENT_TIMESTAMP)`,
    [`page-${suffix}`, storeId, `Page ${suffix}`, `page-${suffix}`],
  );
  await database.query(
    `INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [`blog-${suffix}`, storeId, `Blog ${suffix}`, `blog-${suffix}`],
  );
  await database.query(
    `INSERT INTO "Article" ("id", "storeId", "blogId", "title", "handle", "content", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, '{}', CURRENT_TIMESTAMP)`,
    [`article-${suffix}`, storeId, `blog-${suffix}`, `Article ${suffix}`, `article-${suffix}`],
  );
}

describe("SQL V4 workspace data source", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    await seedWorkspace(database, "store-a", "a");
    await seedWorkspace(database, "store-b", "b");
  });

  afterEach(async () => database.close());

  it("reads every V4 workspace table for only the requested store", async () => {
    const source = createSqlV4WorkspaceDataSource(
      database,
      createSqlCompilerResourceIdLoader(database),
    );

    expect(await source.getWorkspace("store-a")).toMatchObject({ generation: 7 });
    expect((await source.listTemplates("store-a"))?.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: "home-a", type: "HOME" },
      { id: "product-a", type: "PRODUCT" },
    ]);
    expect((await source.listGlobalSections("store-a"))?.map(({ id }) => id)).toEqual([
      "announcement-a",
      "footer-a",
      "header-a",
    ]);
    expect((await source.listMenus("store-a"))?.map(({ id }) => id)).toEqual(["menu-a"]);
    expect(await source.getThemeConfiguration("store-a")).toMatchObject({
      storeId: "store-a",
      themeId: "minimal",
      themeVersion: "1.0.0",
      settings: { accent: "a" },
      draftArtifactId: "artifact-a",
    });
    expect(await source.listAssignments("store-a")).toMatchObject([
      {
        storeId: "store-a",
        resourceType: "product",
        resourceId: "catalog-product-a",
        templateId: "product-a",
      },
    ]);
    expect(await source.listResourceIds("store-a")).toEqual({
      products: ["catalog-product-a"],
      collections: ["collection-a"],
      pages: ["page-a"],
      blogs: ["blog-a"],
      articles: ["article-a"],
    });
  });

  it("returns missing optional state without inventing persisted rows", async () => {
    const source = createSqlV4WorkspaceDataSource(database, async () => undefined);

    expect(await source.getWorkspace("missing-store")).toBeNull();
    expect(await source.listTemplates("missing-store")).toEqual([]);
    expect(await source.listGlobalSections("missing-store")).toEqual([]);
    expect(await source.listMenus("missing-store")).toEqual([]);
    expect(await source.getThemeConfiguration("missing-store")).toBeNull();
    expect(await source.listAssignments("missing-store")).toEqual([]);
    expect(await source.listResourceIds("missing-store")).toBeUndefined();
  });

  it("preserves malformed JSON documents for reader and compiler diagnostics", async () => {
    await database.query(
      `UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "id" = 'home-a'`,
      [{ sections: [{ kind: "global", globalSectionId: "missing-global" }] }],
    );
    const source = createSqlV4WorkspaceDataSource(database, async () => ({
      products: [], collections: [], pages: [], blogs: [], articles: [],
    }));

    expect((await source.listTemplates("store-a"))?.[0]?.layout).toEqual({
      sections: [{ kind: "global", globalSectionId: "missing-global" }],
    });
  });
});
