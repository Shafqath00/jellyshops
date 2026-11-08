import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { createApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config.js";
import { createLocalV4CompilationService } from "../../src/storefront/local-v4-compilation.js";
import type {
  CompiledPublicationRepository,
  SaveCompiledSnapshotInput,
} from "../../src/storefront/publication/repository.js";
import { CompiledStorefrontPublicationService } from "../../src/storefront/publication/service.js";
import { SqlCompiledPublicationRepository } from "../../src/storefront/publication/sql-repository.js";
import {
  ImmutablePublicationCache,
  StorefrontRuntimeService,
} from "../../src/storefront/runtime/service.js";
import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "./pglite.js";

const storeId = "store-a";

async function testConfig(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-v4-publication-"));
  return {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    trustProxy: false,
    authProvider: "development",
    mediaProvider: "local-files",
    dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024,
    demoStoreId: storeId,
  };
}

function homeLayout(marker: string, missingGlobal = false) {
  return {
    sections: [
      {
        kind: "global",
        globalSectionId: missingGlobal ? "missing-global" : "announcement",
      },
      { kind: "global", globalSectionId: "header" },
      {
        kind: "inline",
        section: {
          id: `draft-${marker.toLowerCase()}`,
          type: "rich-text",
          settings: { marker },
          blocks: [],
        },
      },
      { kind: "global", globalSectionId: "footer" },
    ],
  };
}

async function persistWorkspace(database: IntegrationDatabase): Promise<void> {
  await seedStore(database, storeId, "store-a");
  await database.query(
    `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
     VALUES ($1, 1, CURRENT_TIMESTAMP)`,
    [storeId],
  );
  await database.query(
    `INSERT INTO "Product" ("id", "storeId", "title", "slug", "status", "updatedAt")
     VALUES ('product-a', $1, 'Product A', 'product-a', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [storeId],
  );
  await database.query(
    `INSERT INTO "Collection" ("id", "storeId", "title", "slug", "updatedAt")
     VALUES ('collection-a', $1, 'Collection A', 'collection-a', CURRENT_TIMESTAMP)`,
    [storeId],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplate"
       ("id", "storeId", "type", "handle", "name", "layout", "updatedAt")
     VALUES
       ('home-default', $1, 'HOME', 'default', 'Home', $2, CURRENT_TIMESTAMP),
       ('product-default', $1, 'PRODUCT', 'default', 'Product', $3, CURRENT_TIMESTAMP),
       ('collection-default', $1, 'COLLECTION', 'default', 'Collection', $3, CURRENT_TIMESTAMP),
       ('cart-default', $1, 'CART', 'default', 'Cart', $3, CURRENT_TIMESTAMP)`,
    [storeId, homeLayout("A"), { sections: [] }],
  );

  for (const [id, type] of [
    ["announcement", "announcement-bar"],
    ["header", "header"],
    ["footer", "footer"],
  ] as const) {
    await database.query(
      `INSERT INTO "GlobalSection"
         ("id", "storeId", "name", "section", "updatedAt")
       VALUES ($1, $2, $1, $3, CURRENT_TIMESTAMP)`,
      [id, storeId, { id: `${id}-section`, type, settings: {}, blocks: [] }],
    );
  }

  await database.query(
    `INSERT INTO "NavigationMenu"
       ("id", "storeId", "name", "handle", "items", "updatedAt")
     VALUES ('main-menu', $1, 'Main menu', 'main', $2, CURRENT_TIMESTAMP)`,
    [
      storeId,
      [
        {
          id: "product-link",
          label: "Product A",
          target: { kind: "product", resourceId: "product-a" },
          children: [],
        },
        {
          id: "collection-link",
          label: "Collection A",
          target: { kind: "collection", resourceId: "collection-a" },
          children: [],
        },
      ],
    ],
  );
  await database.query(
    `INSERT INTO "StorefrontTemplateAssignment"
       ("storeId", "resourceType", "resourceId", "templateId", "updatedAt")
     VALUES
       ($1, 'product', 'product-a', 'product-default', CURRENT_TIMESTAMP),
       ($1, 'collection', 'collection-a', 'collection-default', CURRENT_TIMESTAMP)`,
    [storeId],
  );
  await database.query(
    `INSERT INTO "ThemeConfiguration"
       ("storeId", "themeId", "settings", "draftArtifactId", "updatedAt")
     VALUES ($1, 'minimal', '{}', 'artifact-a', CURRENT_TIMESTAMP)`,
    [storeId],
  );
}

async function setDraft(
  database: IntegrationDatabase,
  generation: number,
  marker: string,
  missingGlobal = false,
): Promise<void> {
  await database.query(
    `UPDATE "StorefrontWorkspace"
     SET "generation" = $2, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1`,
    [storeId, generation],
  );
  await database.query(
    `UPDATE "StorefrontTemplate"
     SET "layout" = $2, "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1 AND "id" = 'home-default'`,
    [storeId, homeLayout(marker, missingGlobal)],
  );
}

async function draftState(database: IntegrationDatabase) {
  const workspace = await database.query(
    `SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1`,
    [storeId],
  );
  const template = await database.query(
    `SELECT "layout" FROM "StorefrontTemplate"
     WHERE "storeId" = $1 AND "id" = 'home-default'`,
    [storeId],
  );
  return {
    generation: Number((workspace.rows[0] as { generation: unknown }).generation),
    layout: (template.rows[0] as { layout: unknown }).layout,
  };
}

async function publicationCount(database: IntegrationDatabase): Promise<number> {
  const result = await database.query(
    `SELECT COUNT(*) AS "count" FROM "StorefrontPublication" WHERE "storeId" = $1`,
    [storeId],
  );
  return Number((result.rows[0] as { count: unknown }).count);
}

function marker(responseBody: Record<string, any>): string | undefined {
  return responseBody.document?.templates?.["home-default"]?.layout?.sections?.[2]?.section?.settings?.marker
    ?? responseBody.snapshot?.templates?.["home-default"]?.layout?.sections?.[2]?.section?.settings?.marker;
}

function post(
  app: ReturnType<typeof createApp>,
  route: "publish" | "preview/compile",
  generation: number,
  idempotencyKey?: string,
) {
  return request(app)
    .post(`/api/stores/${storeId}/storefront/${route}`)
    .set("authorization", "Bearer jelly-demo-merchant")
    .send(route === "publish"
      ? { expectedGeneration: generation, idempotencyKey }
      : { expectedGeneration: generation });
}

function getPublic(app: ReturnType<typeof createApp>) {
  return request(app).get(`/api/stores/${storeId}/storefront/public`);
}

function delegateRepository(
  repository: SqlCompiledPublicationRepository,
  overrides: Partial<CompiledPublicationRepository>,
): CompiledPublicationRepository {
  return {
    findByIdempotencyKey: repository.findByIdempotencyKey.bind(repository),
    save: repository.save.bind(repository),
    get: repository.get.bind(repository),
    getCurrentPublicationId: repository.getCurrentPublicationId.bind(repository),
    getCurrent: repository.getCurrent.bind(repository),
    activate: repository.activate.bind(repository),
    ...overrides,
  };
}

describe("local V4 publication pipeline", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await persistWorkspace(database);
  });

  afterEach(async () => database.close());

  it("keeps draft, preview, publish, and public isolated across restart", async () => {
    const app = createApp({ config: await testConfig(), storefrontSql: database });
    const repository = new SqlCompiledPublicationRepository(database);

    const draftA = await draftState(database);
    const publishedA = await post(app, "publish", 1, "key-a");
    expect(publishedA.status).toBe(201);
    expect(await draftState(database)).toEqual(draftA);
    const publicationAId = String(publishedA.body.publication.id);
    expect(marker((await getPublic(app)).body)).toBe("A");

    await setDraft(database, 2, "B");
    const previewB = await post(app, "preview/compile", 2);
    expect(previewB.status).toBe(200);
    expect(marker(previewB.body)).toBe("B");
    expect(marker((await getPublic(app)).body)).toBe("A");

    const draftB = await draftState(database);
    const publishedB = await post(app, "publish", 2, "key-b");
    expect(publishedB.status).toBe(201);
    expect(await draftState(database)).toEqual(draftB);
    const publicationBId = String(publishedB.body.publication.id);
    expect(publicationBId).not.toBe(publicationAId);
    expect(marker((await getPublic(app)).body)).toBe("B");

    expect(marker({ document: (await repository.get(storeId, publicationAId))?.snapshot })).toBe("A");
    expect(marker({ document: (await repository.get(storeId, publicationBId))?.snapshot })).toBe("B");

    await setDraft(database, 3, "C");

    const restartedRepository = new SqlCompiledPublicationRepository(database);
    const restartedRuntime = new StorefrontRuntimeService(
      restartedRepository,
      new ImmutablePublicationCache(restartedRepository),
    );
    const restartedApp = createApp({
      config: await testConfig(),
      storefrontSql: database,
      publicStorefrontApi: {
        async load(requestedStoreId) {
          const current = await restartedRuntime.getPublishedPublication(requestedStoreId);
          return current ? { id: current.id, document: current.snapshot } : null;
        },
      },
    });

    await expect(restartedRepository.getCurrentPublicationId(storeId)).resolves.toBe(publicationBId);
    await expect(restartedRuntime.getPublishedPublication(storeId)).resolves.toMatchObject({
      id: publicationBId,
      snapshot: { sourceGeneration: 2 },
    });
    expect(marker((await post(restartedApp, "preview/compile", 3)).body)).toBe("C");
    const restartedPublic = await getPublic(restartedApp);
    expect(restartedPublic.status).toBe(200);
    expect(restartedPublic.body.id).toBe(publicationBId);
    expect(marker(restartedPublic.body)).toBe("B");
    expect(await draftState(database)).toMatchObject({ generation: 3 });
  });

  it("rejects an invalid next draft without saving or replacing public A", async () => {
    const app = createApp({ config: await testConfig(), storefrontSql: database });
    const publishedA = await post(app, "publish", 1, "key-a");
    const publicationAId = String(publishedA.body.publication.id);
    await setDraft(database, 2, "B", true);
    const invalidDraftB = await draftState(database);

    const rejected = await post(app, "publish", 2, "key-b-invalid");

    expect(rejected.status).toBe(422);
    expect(rejected.body.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_GLOBAL_SECTION" }),
    ]));
    expect(await publicationCount(database)).toBe(1);
    expect(await draftState(database)).toEqual(invalidDraftB);
    const publicA = await getPublic(app);
    expect(publicA.body.id).toBe(publicationAId);
    expect(marker(publicA.body)).toBe("A");
  });

  it("does not activate when saving B fails and leaves public A", async () => {
    const initialApp = createApp({ config: await testConfig(), storefrontSql: database });
    const publishedA = await post(initialApp, "publish", 1, "key-a");
    const publicationAId = String(publishedA.body.publication.id);
    await setDraft(database, 2, "B");

    const sqlRepository = new SqlCompiledPublicationRepository(database);
    let activationAttempts = 0;
    const failingRepository = delegateRepository(sqlRepository, {
      async save(_input: SaveCompiledSnapshotInput) {
        throw new Error("injected save failure");
      },
      async activate() {
        activationAttempts += 1;
      },
    });
    const service = new CompiledStorefrontPublicationService(
      createLocalV4CompilationService(database),
      failingRepository,
    );
    const failingApp = createApp({
      config: await testConfig(),
      storefrontSql: database,
      storefrontPublicationApi: service,
    });

    expect((await post(failingApp, "publish", 2, "key-b-save-fails")).status).toBe(500);
    expect(activationAttempts).toBe(0);
    expect(await publicationCount(database)).toBe(1);
    await expect(sqlRepository.getCurrentPublicationId(storeId)).resolves.toBe(publicationAId);
    expect((await getPublic(failingApp)).body.id).toBe(publicationAId);
  });

  it("keeps a real-saved B inactive when activation fails and leaves public A", async () => {
    const initialApp = createApp({ config: await testConfig(), storefrontSql: database });
    const publishedA = await post(initialApp, "publish", 1, "key-a");
    const publicationAId = String(publishedA.body.publication.id);
    await setDraft(database, 2, "B");

    const sqlRepository = new SqlCompiledPublicationRepository(database);
    let publicationBId: string | undefined;
    const failingRepository = delegateRepository(sqlRepository, {
      async save(input: SaveCompiledSnapshotInput) {
        const saved = await sqlRepository.save(input);
        publicationBId = saved.id;
        return saved;
      },
      async activate(_requestedStoreId, publicationId) {
        if (publicationId === publicationBId) throw new Error("injected activation failure");
        await sqlRepository.activate(storeId, publicationId);
      },
    });
    const service = new CompiledStorefrontPublicationService(
      createLocalV4CompilationService(database),
      failingRepository,
    );
    const failingApp = createApp({
      config: await testConfig(),
      storefrontSql: database,
      storefrontPublicationApi: service,
    });

    expect((await post(failingApp, "publish", 2, "key-b-activate-fails")).status).toBe(500);
    expect(publicationBId).toBeTruthy();
    expect(await publicationCount(database)).toBe(2);
    await expect(sqlRepository.get(storeId, publicationBId!)).resolves.toMatchObject({
      id: publicationBId,
      sourceGeneration: 2,
    });
    await expect(sqlRepository.getCurrentPublicationId(storeId)).resolves.toBe(publicationAId);
    const publicA = await getPublic(failingApp);
    expect(publicA.body.id).toBe(publicationAId);
    expect(marker(publicA.body)).toBe("A");
  });
});
