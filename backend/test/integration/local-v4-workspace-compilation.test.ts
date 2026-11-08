import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { SqlExecutor } from "../../src/commerce/repository.js";
import { StorefrontCompilationService } from "../../src/storefront/compiler/service.js";
import type {
  CompilerDynamicSourceResolver,
  CompilerRegistry,
} from "../../src/storefront/compiler/types.js";
import { LocalV4WorkspaceReader } from "../../src/storefront/local-v4-workspace-reader.js";
import {
  createSqlCompilerResourceIdLoader,
  createSqlV4WorkspaceDataSource,
} from "../../src/storefront/sql-v4-workspace-data-source.js";
import { WorkspaceGenerationConflictError } from "../../src/storefront/workspace/errors.js";
import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "./pglite.js";

const registry: CompilerRegistry = {
  validateSection: () => [],
  dynamicSettingType: () => null,
};
const dynamicSources: CompilerDynamicSourceResolver = {
  async describeBinding() {
    return { valueType: "string" };
  },
};

async function persistRepresentativeWorkspace(
  database: IntegrationDatabase,
  storeId: string,
  suffix: string,
  generation: number,
): Promise<void> {
  await database.query(
    `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [storeId, generation],
  );
  await database.query(
    `INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [`product-${suffix}`, storeId, `Product ${suffix}`, `product-${suffix}`],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplate"
       ("id", "storeId", "type", "handle", "name", "layout", "updatedAt")
     VALUES
       ($1, $2, 'HOME', 'default', 'Home', $3, CURRENT_TIMESTAMP),
       ($4, $2, 'PRODUCT', 'default', 'Product', $5, CURRENT_TIMESTAMP)`,
    [
      `home-${suffix}`,
      storeId,
      {
        sections: [
          { kind: "global", globalSectionId: `announcement-${suffix}` },
          { kind: "global", globalSectionId: `header-${suffix}` },
          {
            kind: "inline",
            section: {
              id: `hero-${suffix}`,
              type: "hero",
              settings: { heading: `Draft ${suffix}` },
              blocks: [],
            },
          },
          { kind: "global", globalSectionId: `footer-${suffix}` },
        ],
      },
      `product-template-${suffix}`,
      {
        sections: [{
          kind: "inline",
          section: {
            id: `product-main-${suffix}`,
            type: "product-main",
            settings: {},
            blocks: [],
          },
        }],
      },
    ],
  );

  for (const region of ["announcement", "header", "footer"] as const) {
    await database.query(
      `INSERT INTO "GlobalSection"
         ("id", "storeId", "name", "section", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        `${region}-${suffix}`,
        storeId,
        region,
        {
          id: `${region}-section-${suffix}`,
          type: region === "announcement" ? "announcement-bar" : region,
          settings: { text: `${region} ${suffix}` },
          blocks: [],
        },
      ],
    );
  }

  await database.query(
    `INSERT INTO "NavigationMenu"
       ("id", "storeId", "name", "handle", "items", "updatedAt")
     VALUES ($1, $2, 'Main', 'main', $3, CURRENT_TIMESTAMP)`,
    [
      `menu-${suffix}`,
      storeId,
      [{
        id: `product-link-${suffix}`,
        label: `Product ${suffix}`,
        target: { kind: "product", resourceId: `product-${suffix}` },
        children: [],
      }],
    ],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplateAssignment"
       ("storeId", "resourceType", "resourceId", "templateId", "updatedAt")
     VALUES ($1, 'product', $2, $3, CURRENT_TIMESTAMP)`,
    [storeId, `product-${suffix}`, `product-template-${suffix}`],
  );
  await database.query(
    `INSERT INTO "ThemeConfiguration"
       ("storeId", "themeId", "settings", "draftArtifactId", "updatedAt")
     VALUES ($1, 'minimal', $2, $3, CURRENT_TIMESTAMP)`,
    [storeId, { colors: { accent: suffix === "a" ? "#ff00aa" : "#0000ff" } }, `artifact-${suffix}`],
  );
}

function compilationService(
  database: SqlExecutor,
  resourceLoader = createSqlCompilerResourceIdLoader(database),
): StorefrontCompilationService {
  return new StorefrontCompilationService(
    new LocalV4WorkspaceReader(
      createSqlV4WorkspaceDataSource(database, resourceLoader),
    ),
    registry,
    dynamicSources,
    "local-v4-test",
    () => "registry-test",
  );
}

describe("persisted local V4 workspace compilation", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    await persistRepresentativeWorkspace(database, "store-a", "a", 12);
    await persistRepresentativeWorkspace(database, "store-b", "b", 93);
  });

  afterEach(async () => database.close());

  it("compiles a representative Store A workspace without reading Store B", async () => {
    const queries: string[] = [];
    const tracedSql: SqlExecutor = {
      async query(text, values) {
        queries.push(text);
        return database.query(text, values);
      },
    };

    const result = await compilationService(tracedSql).compile("store-a", 12);

    expect(result).toMatchObject({
      ok: true,
      diagnostics: [],
      snapshot: {
        schemaVersion: 4,
        storeId: "store-a",
        sourceGeneration: 12,
        theme: {
          presetId: "minimal",
          settings: { colors: { accent: "#ff00aa" } },
          artifactId: "artifact-a",
        },
        templateDefaults: {
          home: "home-a",
          product: "product-template-a",
        },
        assignments: [{
          resourceType: "product",
          resourceId: "product-a",
          templateId: "product-template-a",
        }],
      },
    });
    expect(Object.keys(result.snapshot?.globalSections ?? {})).toEqual([
      "announcement-a",
      "footer-a",
      "header-a",
    ]);
    expect(Object.keys(result.snapshot?.menus ?? {})).toEqual(["menu-a"]);
    expect(Object.keys(result.snapshot?.templates ?? {})).toEqual(["home-a", "product-template-a"]);
    expect(result.snapshot?.templates).not.toHaveProperty("home-b");
    expect(result.snapshot?.templates).not.toHaveProperty("product-template-b");
    expect(result.snapshot?.globalSections).not.toHaveProperty("header-b");
    expect(result.snapshot?.menus).not.toHaveProperty("menu-b");
    expect(result.snapshot?.theme.artifactId).not.toBe("artifact-b");

    expect(queries[0]).toContain('FROM "StorefrontWorkspace"');
    expect(queries.at(-1)).toContain('FROM "StorefrontWorkspace"');
  });

  it("returns existing compiler diagnostics for malformed persisted references", async () => {
    await database.query(
      `UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "id" = 'home-a'`,
      [{ sections: [{ kind: "global", globalSectionId: "missing-global" }] }],
    );

    const result = await compilationService(database).compile("store-a", 12);

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_GLOBAL_SECTION" }),
    ]));
  });

  it("reads a structured rich-text document from persisted draft workspace state", async () => {
    const document = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our story", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [{ type: "text", text: "Read more", marks: [{ type: "link", attrs: { href: "/pages/about" } }] }] },
    ] };
    await database.query(
      `UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "id" = 'home-a'`,
      [{ sections: [{ kind: "inline", section: { id: "story-a", type: "rich-text", settings: { document }, blocks: [] } }] }],
    );

    const result = await compilationService(database).compile("store-a", 12);

    expect(result.ok).toBe(true);
    expect(result.snapshot?.templates["home-a"].layout.sections[0]).toMatchObject({
      kind: "inline",
      section: { settings: { document } },
    });
    expect(result.snapshot?.templates).not.toHaveProperty("home-b");
  });

  it("rejects a generation changed during aggregate reads instead of returning a mixed workspace", async () => {
    const loadResources = createSqlCompilerResourceIdLoader(database);
    const result = compilationService(database, async (storeId) => {
      const ids = await loadResources(storeId);
      await database.query(
        `UPDATE "StorefrontWorkspace"
         SET "generation" = "generation" + 1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "storeId" = $1`,
        [storeId],
      );
      return ids;
    }).compile("store-a", 12);

    await expect(result).rejects.toEqual(new WorkspaceGenerationConflictError(13));
  });
});
