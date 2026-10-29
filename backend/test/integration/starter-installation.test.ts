import { resolveTheme } from "@jelly/storefront-themes";
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { createApp } from "../../src/app.js";
import { CatalogPostgresRepository } from "../../src/catalog/postgres-repository.js";
import { CatalogService } from "../../src/catalog/service.js";
import type { AppConfig } from "../../src/config.js";
import { StarterInstallationConflictError, StorefrontStarterInstallationService } from "../../src/storefront/starter/installation-service.js";
import { createLocalV4CompilationService } from "../../src/storefront/local-v4-compilation.js";
import type { StorefrontWorkspaceApi } from "../../src/storefront/workspace/routes.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type StarterPlacement = { kind: string; section?: { type: string; settings: Record<string, unknown>; blocks: Array<{ type: string; settings: Record<string, unknown> }> } };
type StarterLayout = { sections: StarterPlacement[] };

function editHero(layout: StarterLayout, heading: string, image?: { id: string; url: string }): StarterLayout {
  return { sections: layout.sections.map((placement) => {
    if (placement.kind !== "inline" || placement.section?.type !== "hero") return placement;
    const section = placement.section;
    return { ...placement, section: {
      ...section,
      settings: image ? { ...section.settings, image: { id: image.id, url: image.url, alt: "Merchant-uploaded market hero" } } : section.settings,
      blocks: section.blocks.map((block) => block.type === "heading" ? { ...block, settings: { ...block.settings, text: heading } } : block),
    } };
  }) };
}

function pgliteEditorWorkspaceApi(database: Awaited<ReturnType<typeof createPGliteDatabase>>): StorefrontWorkspaceApi {
  const templates = async (storeId: string, type?: string) => (await database.query(
    `SELECT "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt"
     FROM "StorefrontTemplate" WHERE "storeId" = $1 AND ($2::text IS NULL OR lower("type"::text) = $2) ORDER BY "createdAt"`,
    [storeId, type ?? null],
  )).rows;
  return {
    async listThemeCatalog() { return []; },
    async getWorkspace(storeId) {
      return (await database.query<{ generation: number; updatedAt: Date }>(
        `SELECT "generation", "updatedAt" FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId],
      )).rows[0] ?? null;
    },
    listTemplates: templates,
    async listGlobalSections(storeId) {
      return (await database.query(`SELECT "id", "storeId", "revision", "name", "section", "createdAt", "updatedAt" FROM "GlobalSection" WHERE "storeId" = $1`, [storeId])).rows;
    },
    async listMenus(storeId) {
      return (await database.query(`SELECT "id", "storeId", "revision", "name", "handle", "items", "createdAt", "updatedAt" FROM "NavigationMenu" WHERE "storeId" = $1`, [storeId])).rows;
    },
    async listPresets() { return []; },
    async getThemeConfiguration(storeId) {
      return (await database.query(`SELECT "storeId", "revision", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt" FROM "ThemeConfiguration" WHERE "storeId" = $1`, [storeId])).rows[0] ?? null;
    },
    async getTemplate(storeId, templateId) {
      return (await database.query(
        `SELECT "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt"
         FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2`, [storeId, templateId],
      )).rows[0] ?? null;
    },
    async updateTemplate(storeId, templateId, expectedRevision, patch) {
      return database.transaction(async (sql) => {
        const result = await sql.query(
          `UPDATE "StorefrontTemplate" SET "layout" = COALESCE($4::jsonb, "layout"), "revision" = "revision" + 1, "updatedAt" = NOW()
           WHERE "storeId" = $1 AND "id" = $2 AND "revision" = $3
           RETURNING "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt"`,
          [storeId, templateId, expectedRevision, patch.layout ? JSON.stringify(patch.layout) : null],
        );
        if (!result.rows[0]) throw new Error("Template revision conflict");
        const workspace = await sql.query<{ generation: number }>(
          `UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 RETURNING "generation"`, [storeId],
        );
        return { template: result.rows[0], generation: workspace.rows[0]!.generation };
      });
    },
  } as StorefrontWorkspaceApi;
}

function transactionDatabase(database: Awaited<ReturnType<typeof createPGliteDatabase>>): CommerceDatabase {
  return {
    async transaction(work) {
      return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor));
    },
  };
}

async function testConfig(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-starter-lifecycle-"));
  return {
    port: 3001, nodeEnv: "test", corsOrigins: ["http://localhost:3000"], trustProxy: false,
    authProvider: "development", mediaProvider: "local-files", dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-a",
  };
}

describe("V4 starter installation persistence", () => {
  it("installs one complete isolated workspace atomically and makes same-pack retry a no-op", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    let installSequence = 0;
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => `install-${++installSequence}`);

    const installed = await installer.install("store-a", "fresh-market");
    expect(installed).toMatchObject({ storeId: "store-a", starterPackId: "fresh-market", generation: 1, installed: true });
    const compilation = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-a", installed.generation);
    expect(compilation).toMatchObject({ ok: true, snapshot: { sourceGeneration: 1, templateDefaults: { home: expect.any(String), product: expect.any(String), collection: expect.any(String), "not-found": expect.any(String) } } });
    expect(await database.query(`SELECT "id", lower("type"::text) AS type, "handle", "layout" FROM "StorefrontTemplate" WHERE "storeId" = 'store-a'`)).toMatchObject({ rows: expect.arrayContaining([
      expect.objectContaining({ type: "home", handle: "default" }),
      expect.objectContaining({ type: "product", handle: "default" }),
      expect.objectContaining({ type: "not_found", handle: "default" }),
    ]) });
    const counts = await database.query<{ templates: number; globals: number; menus: number; themes: number; assignments: number }>(
      `SELECT
        (SELECT COUNT(*)::int FROM "StorefrontTemplate" WHERE "storeId" = 'store-a') AS templates,
        (SELECT COUNT(*)::int FROM "GlobalSection" WHERE "storeId" = 'store-a') AS globals,
        (SELECT COUNT(*)::int FROM "NavigationMenu" WHERE "storeId" = 'store-a') AS menus,
        (SELECT COUNT(*)::int FROM "ThemeConfiguration" WHERE "storeId" = 'store-a') AS themes,
        (SELECT COUNT(*)::int FROM "StorefrontTemplateAssignment" WHERE "storeId" = 'store-a') AS assignments`,
    );
    expect(counts.rows[0]).toEqual({ templates: 9, globals: 3, menus: 1, themes: 1, assignments: 0 });
    await expect(database.query(`SELECT "starterPackId", "starterPackVersion", "generation" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ starterPackId: "fresh-market", starterPackVersion: "1.0.0", generation: 1 }] });
    // The theme version is pinned from the theme itself, never from the starter pack's version.
    await expect(database.query(`SELECT "themeId", "themeVersion" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ themeId: "fresh-market", themeVersion: resolveTheme("fresh-market").version }] });

    const retry = await installer.install("store-a", "fresh-market");
    expect(retry).toMatchObject({ generation: 1, installed: false });
    await expect(installer.install("store-a", "artisan-boutique")).rejects.toBeInstanceOf(StarterInstallationConflictError);
    await expect(database.query(`SELECT COUNT(*)::int AS count FROM "StorefrontTemplate" WHERE "storeId" = 'store-b'`)).resolves.toMatchObject({ rows: [{ count: 0 }] });
    const secondStore = await installer.install("store-b", "artisan-boutique");
    expect(secondStore).toMatchObject({ storeId: "store-b", starterPackId: "artisan-boutique", generation: 1, installed: true });
    const ids = await database.query<{ storeId: string; id: string }>(`SELECT "storeId", "id" FROM "StorefrontTemplate" WHERE "storeId" IN ('store-a', 'store-b')`);
    expect(ids.rows.filter((row) => row.storeId === "store-a")).toHaveLength(9);
    expect(ids.rows.filter((row) => row.storeId === "store-b")).toHaveLength(9);
    expect(new Set(ids.rows.map((row) => row.id)).size).toBe(18);
    const isolatedCompilation = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-a", 1);
    expect(isolatedCompilation.ok).toBe(true);
    const compiledTemplateIds = Object.keys(isolatedCompilation.snapshot!.templates);
    expect(compiledTemplateIds).toEqual(expect.arrayContaining(ids.rows.filter((row) => row.storeId === "store-a").map((row) => row.id)));
    expect(compiledTemplateIds.filter((id) => ids.rows.some((row) => row.storeId === "store-b" && row.id === id))).toEqual([]);
    await database.close();
  });

  it("replaces a draft with another template, keeping the old templates under previous handles and exactly one active template per page", async () => {
    const database = await createPGliteDatabase();
    // The complete themes ship checkout, wishlist and account pages. Their page types come from this migration, which the shared test schema skips; only its enum statements are needed here.
    const customerServices = await readFile(new URL("../../sql/migrations/20261020163817_jelly_signature_customer_services.sql", import.meta.url), "utf8");
    await database.exec(customerServices.split(/\r?\n/).filter((line) => line.startsWith('ALTER TYPE "StorefrontTemplateType"')).join("\n"));
    await seedStore(database, "store-a", "store-a");
    let installSequence = 0;
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => `install-${++installSequence}`);
    const first = await installer.install("store-a", "jelly-signature");
    const replaced = await installer.install("store-a", "jelly-avenue", { replaceDraft: true, expectedGeneration: first.generation });
    expect(replaced).toMatchObject({ starterPackId: "jelly-avenue", installed: true, generation: first.generation + 1 });

    const homes = await database.query<{ id: string; handle: string; layout: { sections: Array<{ kind: string; section?: { type: string } }> } }>(
      `SELECT "id", "handle", "layout" FROM "StorefrontTemplate" WHERE "storeId" = 'store-a' AND lower("type"::text) = 'home' ORDER BY "createdAt", "id"`,
    );
    const sectionTypes = (home: (typeof homes.rows)[number]) => home.layout.sections.flatMap((placement) => placement.kind === "inline" && placement.section ? [placement.section.type] : []);
    expect(homes.rows).toHaveLength(2);
    // The editor opens the one handled "default"; it must be the new template, not the oldest row.
    const active = homes.rows.filter((home) => home.handle === "default");
    expect(active).toHaveLength(1);
    expect(sectionTypes(active[0])).toContain("slideshow");
    const retained = homes.rows.filter((home) => home.handle !== "default");
    expect(retained).toHaveLength(1);
    expect(retained[0].handle).toMatch(/^previous-/);
    expect(sectionTypes(retained[0])).not.toContain("slideshow");
    await expect(database.query(`SELECT "themeId" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ themeId: "jelly-avenue" }] });
    await database.close();
  });

  it("rejects installation over customized workspace state without changing the generation", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await database.query(
      `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ('store-a', 4, CURRENT_TIMESTAMP)`,
    );
    await database.query(`INSERT INTO "ThemeConfiguration" ("storeId", "revision", "themeId", "themeVersion", "settings", "updatedAt") VALUES ('store-a', 1, 'minimal', '1.0.0', '{}'::jsonb, CURRENT_TIMESTAMP)`);
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-a");

    await expect(installer.install("store-a", "fresh-market")).rejects.toBeInstanceOf(StarterInstallationConflictError);
    await expect(database.query(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ generation: 4 }] });
    await database.close();
  });

  it("rolls back every write if an injected database write fails", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    const failureDatabase: CommerceDatabase = {
      async transaction(work) {
        return database.transaction((tx) => work({ query: async (sql, values) => {
          if (sql.includes('INSERT INTO "NavigationMenu"')) throw new Error("injected menu write failure");
          return tx.query(sql, values);
        } } as SqlExecutor));
      },
    };
    const installer = new StorefrontStarterInstallationService(failureDatabase, () => "install-a");

    await expect(installer.install("store-a", "fresh-market")).rejects.toThrow("injected menu write failure");
    await expect(database.query(`SELECT COUNT(*)::int AS templates FROM "StorefrontTemplate" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ templates: 0 }] });
    await expect(database.query(`SELECT "generation", "starterPackId" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [] });
    await database.close();
  });

  it("serializes concurrent first installs and advances generation exactly once", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-a");

    const results = await Promise.all([installer.install("store-a", "fresh-market"), installer.install("store-a", "fresh-market")]);
    expect(results.map(({ installed }) => installed).sort()).toEqual([false, true]);
    await expect(database.query(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ generation: 1 }] });
    await expect(database.query(`SELECT COUNT(*)::int AS count FROM "StorefrontTemplate" WHERE "storeId" = 'store-a'`)).resolves.toMatchObject({ rows: [{ count: 9 }] });
    await database.close();
  });

  it("runs Install → Validate → draft Preview through local startup without creating publication state", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-lifecycle");
    const app = createApp({ config: await testConfig(), storefrontSql: database, storefrontStarterApi: installer });
    const auth = { Authorization: "Bearer jelly-demo-merchant" };

    const installed = await request(app).post("/api/stores/store-a/storefront/starters/fresh-market/install").set(auth);
    expect(installed.status).toBe(201);
    const initialWorkspace = await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`);
    const initialCompile = await request(app).post("/api/stores/store-a/storefront/validate").set(auth).send({ expectedGeneration: 1 });
    expect(initialCompile.status).toBe(200);
    expect(initialCompile.body).toMatchObject({ ok: true, diagnostics: [] });
    expect(await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).toEqual(initialWorkspace);
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);

    const home = await database.query<{ layout: { sections: unknown[] } }>(`SELECT "layout" FROM "StorefrontTemplate" WHERE "storeId" = 'store-a' AND "type" = 'HOME'`);
    const nextLayout = { sections: [...home.rows[0]!.layout.sections, { kind: "inline", section: { id: "draft-copy", type: "rich-text", enabled: true, settings: { text: "Current draft copy" }, blocks: [] } }] };
    await database.query(`UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "storeId" = 'store-a' AND "type" = 'HOME'`, [nextLayout]);
    await database.query(`UPDATE "StorefrontWorkspace" SET "generation" = 2 WHERE "storeId" = 'store-a'`);
    const beforePreview = await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`);
    const preview = await request(app).post("/api/stores/store-a/storefront/preview/compile").set(auth).send({ expectedGeneration: 2 });
    expect(preview.status).toBe(200);
    expect(JSON.stringify(preview.body.snapshot.templates)).toContain("Current draft copy");
    expect(await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).toEqual(beforePreview);
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);

    const published = await request(app).post("/api/stores/store-a/storefront/publish").set(auth).send({ expectedGeneration: 2, idempotencyKey: "starter-lifecycle" });
    expect(published.status).toBe(201);
    expect(published.body.publication).toMatchObject({ storeId: "store-a", sourceGeneration: 2 });
    const publicSnapshot = await request(app).get("/api/stores/store-a/storefront/public");
    expect(publicSnapshot.status).toBe(200);
    expect(publicSnapshot.body.document.templateDefaults).toMatchObject({
      home: expect.any(String), product: expect.any(String), collection: expect.any(String), cart: expect.any(String),
      search: expect.any(String), page: expect.any(String), blog: expect.any(String), article: expect.any(String), "not-found": expect.any(String),
    });
    expect(JSON.stringify(publicSnapshot.body.document.templates)).toContain("Current draft copy");
    await database.query(`UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "storeId" = 'store-a' AND "type" = 'HOME'`, [{ sections: [{ kind: "global", globalSectionId: "missing-global" }] }]);
    await database.query(`UPDATE "StorefrontWorkspace" SET "generation" = 3 WHERE "storeId" = 'store-a'`);
    const beforeInvalidValidate = await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`);
    const invalid = await request(app).post("/api/stores/store-a/storefront/validate").set(auth).send({ expectedGeneration: 3 });
    expect(invalid.status).toBe(422);
    expect(invalid.body.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_GLOBAL_SECTION" })]));
    expect(await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).toEqual(beforeInvalidValidate);
    expect((await request(app).get("/api/stores/store-a/storefront/public")).body.id).toBe(published.body.publication.id);
    expect((await database.query(`SELECT COUNT(*)::int AS count FROM "StorefrontPublication" WHERE "storeId" = 'store-a'`)).rows[0]?.count).toBe(1);
    await database.close();
  });

  it("launches Fresh Market with uploaded media and a live Catalog Product, then isolates draft B from publication A", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    const catalogRepository = new CatalogPostgresRepository(database);
    const app = createApp({
      config: await testConfig(),
      storefrontSql: database,
      storefrontStarterApi: new StorefrontStarterInstallationService(transactionDatabase(database), () => "fresh-launch"),
      storefrontWorkspaceApi: pgliteEditorWorkspaceApi(database),
      catalogService: new CatalogService(catalogRepository, catalogRepository),
    });
    const auth = { Authorization: "Bearer jelly-demo-merchant" };

    const install = await request(app).post("/api/stores/store-a/storefront/starters/fresh-market/install").set(auth);
    expect(install.status).toBe(201);
    const editorWorkspace = await request(app).get("/api/stores/store-a/storefront/workspace").set(auth);
    const editorTemplates = await request(app).get("/api/stores/store-a/storefront/templates").set(auth);
    const editorGlobals = await request(app).get("/api/stores/store-a/storefront/global-sections").set(auth);
    const editorMenus = await request(app).get("/api/stores/store-a/storefront/menus").set(auth);
    const editorTheme = await request(app).get("/api/stores/store-a/storefront/theme-settings").set(auth);
    expect(editorWorkspace.body.generation).toBe(1);
    expect(editorTemplates.body).toHaveLength(9);
    expect(editorGlobals.body).toHaveLength(3);
    expect(editorMenus.body).toHaveLength(1);
    expect(editorTheme.body).toMatchObject({ themeId: "fresh-market" });
    const home = editorTemplates.body.find((template: { type: string }) => template.type === "home");
    expect(home).toBeDefined();

    const uploaded = await request(app).post("/api/stores/store-a/media").set(auth)
      .attach("file", tinyPng, { filename: "merchant-market-hero.png", contentType: "image/png" });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.url).toBe(`/api/public/media/store-a/${uploaded.body.id}`);
    const imageResponse = await request(app).get(uploaded.body.url);
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.body).toEqual(tinyPng);

    const createdProduct = await request(app).post("/api/stores/store-a/catalog/products").set(auth).send({
      handle: "market-apples", title: "Market Apples", description: "Fresh from the orchard", status: "ACTIVE",
      variants: [{ title: "One bag", priceMinor: 1299, quantity: 7 }],
    });
    expect(createdProduct.status).toBe(201);
    const productId = createdProduct.body.id as string;
    const publicCatalog = await request(app).get("/api/public/stores/store-a/catalog/products?limit=10");
    expect(publicCatalog.status).toBe(200);
    expect(publicCatalog.body.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: productId, title: "Market Apples" })]));
    const productDetail = await request(app).get(`/api/stores/store-a/catalog/products/${productId}`).set(auth);
    expect(productDetail.body).toMatchObject({ id: productId, handle: "market-apples", priceRange: { minMinor: 1299 } });
    const search = await request(app).get("/api/public/stores/store-a/storefront/context/search?q=Market%20Apples");
    expect(search.body.results).toEqual(expect.arrayContaining([expect.objectContaining({ id: productId, title: "Market Apples", priceMinor: 1299 })]));
    expect(JSON.stringify(editorTemplates.body)).not.toContain(productId);
    expect(JSON.stringify(editorTemplates.body)).not.toContain("1299");

    const draftA = await request(app).patch(`/api/stores/store-a/storefront/templates/${home.id}`).set(auth).send({
      expectedRevision: home.revision,
      layout: editHero(home.layout as StarterLayout, "Merchant's Market A", uploaded.body),
    });
    expect(draftA.status).toBe(200);
    const generationA = (await request(app).get("/api/stores/store-a/storefront/workspace").set(auth)).body.generation as number;
    const beforeValidate = await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`);
    const validation = await request(app).post("/api/stores/store-a/storefront/validate").set(auth).send({ expectedGeneration: generationA });
    expect(validation.status).toBe(200);
    expect(validation.body.ok).toBe(true);
    expect(await database.query(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).toEqual(beforeValidate);
    expect((await database.query(`SELECT COUNT(*)::int AS count FROM "StorefrontPublication" WHERE "storeId" = 'store-a'`)).rows[0]?.count).toBe(0);

    const previewA = await request(app).post("/api/stores/store-a/storefront/preview/compile").set(auth).send({ expectedGeneration: generationA });
    expect(previewA.status).toBe(200);
    expect(JSON.stringify(previewA.body.snapshot.templates)).toContain("Merchant's Market A");
    expect(JSON.stringify(previewA.body.snapshot.templates)).toContain(uploaded.body.url);
    expect(JSON.stringify(previewA.body.snapshot)).not.toContain(tinyPng.toString("base64"));
    expect(previewA.body.snapshot.dependencies.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: { type: "media", id: uploaded.body.id }, reason: "media" }),
    ]));
    const protectedMedia = await request(app).delete(`/api/stores/store-a/media/${uploaded.body.id}`).set(auth);
    expect(protectedMedia.status).toBe(409);
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);

    const publishA = await request(app).post("/api/stores/store-a/storefront/publish").set(auth)
      .send({ expectedGeneration: generationA, idempotencyKey: "fresh-launch-a" });
    expect(publishA.status).toBe(201);
    const publicA = await request(app).get("/api/stores/store-a/storefront/public");
    expect(publicA.status).toBe(200);
    expect(publicA.body.id).toBe(publishA.body.publication.id);
    expect(publicA.body.document.templateDefaults).toMatchObject({
      home: expect.any(String), product: expect.any(String), collection: expect.any(String), cart: expect.any(String),
      search: expect.any(String), page: expect.any(String), blog: expect.any(String), article: expect.any(String), "not-found": expect.any(String),
    });
    expect(JSON.stringify(publicA.body.document.templates)).toContain("Merchant's Market A");
    expect(JSON.stringify(publicA.body.document.templates)).toContain(uploaded.body.url);
    expect(JSON.stringify(publicA.body.document.templates)).not.toContain(productId);
    expect(JSON.stringify(publicA.body.document.templates)).not.toContain("1299");

    const draftB = await request(app).patch(`/api/stores/store-a/storefront/templates/${home.id}`).set(auth).send({
      expectedRevision: draftA.body.template.revision,
      layout: editHero(draftA.body.template.layout as StarterLayout, "Merchant's Market B"),
    });
    expect(draftB.status).toBe(200);
    const generationB = (await request(app).get("/api/stores/store-a/storefront/workspace").set(auth)).body.generation as number;
    const previewB = await request(app).post("/api/stores/store-a/storefront/preview/compile").set(auth).send({ expectedGeneration: generationB });
    expect(previewB.status).toBe(200);
    expect(JSON.stringify(previewB.body.snapshot.templates)).toContain("Merchant's Market B");
    expect(JSON.stringify(previewB.body.snapshot.templates)).toContain(uploaded.body.url);
    const stillPublicA = await request(app).get("/api/stores/store-a/storefront/public");
    expect(stillPublicA.body.id).toBe(publicA.body.id);
    expect(JSON.stringify(stillPublicA.body.document.templates)).toContain("Merchant's Market A");
    expect(JSON.stringify(stillPublicA.body.document.templates)).not.toContain("Merchant's Market B");

    const publishB = await request(app).post("/api/stores/store-a/storefront/publish").set(auth)
      .send({ expectedGeneration: generationB, idempotencyKey: "fresh-launch-b" });
    expect(publishB.status).toBe(201);
    const publicB = await request(app).get("/api/stores/store-a/storefront/public");
    expect(publicB.body.id).toBe(publishB.body.publication.id);
    expect(JSON.stringify(publicB.body.document.templates)).toContain("Merchant's Market B");
    expect(JSON.stringify(publicB.body.document.templates)).toContain(uploaded.body.url);
    expect((await request(app).get(uploaded.body.url)).body).toEqual(tinyPng);
    expect((await database.query(`SELECT COUNT(*)::int AS count FROM "StorefrontPublication" WHERE "storeId" = 'store-a'`)).rows[0]?.count).toBe(2);
    const immutableA = await database.query<{ document: unknown }>(`SELECT "document" FROM "StorefrontPublication" WHERE "id" = $1`, [publicA.body.id]);
    expect(JSON.stringify(immutableA.rows[0]?.document)).toContain("Merchant's Market A");
    expect(JSON.stringify(immutableA.rows[0]?.document)).not.toContain("Merchant's Market B");
    await database.close();
  });

  it("previews and publishes the distinct Artisan Boutique starter through the same local pipeline", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    const installer = new StorefrontStarterInstallationService(transactionDatabase(database), () => "artisan-launch");
    const config = { ...await testConfig(), demoStoreId: "store-b" };
    const app = createApp({ config, storefrontSql: database, storefrontStarterApi: installer });
    const auth = { Authorization: "Bearer jelly-demo-merchant" };
    const installed = await request(app).post("/api/stores/store-b/storefront/starters/artisan-boutique/install").set(auth);
    expect(installed.status).toBe(201);
    const preview = await request(app).post("/api/stores/store-b/storefront/preview/compile").set(auth).send({ expectedGeneration: 1 });
    expect(preview.status).toBe(200);
    expect(preview.body.snapshot.templateDefaults).toMatchObject({
      home: expect.any(String), product: expect.any(String), collection: expect.any(String), cart: expect.any(String),
      search: expect.any(String), page: expect.any(String), blog: expect.any(String), article: expect.any(String), "not-found": expect.any(String),
    });
    expect(JSON.stringify(preview.body.snapshot.templates)).toContain("Made to become part of your story.");
    expect(JSON.stringify(preview.body.snapshot.templates)).not.toContain("Good food, gathered well.");
    expect(preview.body.snapshot.theme).toMatchObject({ presetId: "artisan-boutique" });
    const globals = await database.query(`SELECT COUNT(*)::int AS count FROM "GlobalSection" WHERE "storeId" = 'store-b'`);
    expect(globals.rows[0]).toMatchObject({ count: 3 });
    const published = await request(app).post("/api/stores/store-b/storefront/publish").set(auth)
      .send({ expectedGeneration: 1, idempotencyKey: "artisan-launch" });
    expect(published.status).toBe(201);
    const publicSnapshot = await request(app).get("/api/stores/store-b/storefront/public");
    expect(publicSnapshot.body.id).toBe(published.body.publication.id);
    expect(JSON.stringify(publicSnapshot.body.document.templates)).toContain("Made to become part of your story.");
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);
    await database.close();
  });
});
