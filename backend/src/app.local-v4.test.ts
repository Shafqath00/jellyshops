import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../test/integration/pglite.js";
import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";

async function config(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-local-v4-app-"));
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
    demoStoreId: "store-a",
  };
}

async function persistDraft(database: IntegrationDatabase): Promise<void> {
  await seedStore(database, "store-a", "a");
  await database.query(
    `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
     VALUES ('store-a', 4, CURRENT_TIMESTAMP)`,
  );
  await database.query(
    `INSERT INTO "StorefrontTemplate"
       ("id", "storeId", "type", "handle", "name", "layout", "updatedAt")
     VALUES ('home-a', 'store-a', 'HOME', 'default', 'Home', $1, CURRENT_TIMESTAMP)`,
    [{ sections: [{ kind: "inline", section: { id: "rich-text-a", type: "rich-text", settings: { heading: "Before" }, blocks: [] } }] }],
  );
  await database.query(
    `INSERT INTO "ThemeConfiguration"
       ("storeId", "themeId", "settings", "updatedAt")
     VALUES ('store-a', 'minimal', '{}', CURRENT_TIMESTAMP)`,
  );
}

function post(
  app: ReturnType<typeof createApp>,
  route: string,
  generation: number,
  idempotencyKey = `key-${route}`,
) {
  return request(app)
    .post(`/api/stores/store-a/storefront/${route}`)
    .set("authorization", "Bearer jelly-demo-merchant")
    .send(
      route === "publish"
        ? { expectedGeneration: generation, idempotencyKey }
        : { expectedGeneration: generation },
    );
}

function getPublic(app: ReturnType<typeof createApp>) {
  return request(app).get("/api/stores/store-a/storefront/public");
}

async function workspaceState(database: IntegrationDatabase) {
  const tables = [
    "StorefrontWorkspace",
    "StorefrontTemplate",
    "GlobalSection",
    "NavigationMenu",
    "ThemeConfiguration",
    "StorefrontTemplateAssignment",
  ];
  return Object.fromEntries(await Promise.all(tables.map(async (table) => [
    table,
    (await database.query(`SELECT * FROM "${table}" WHERE "storeId" = 'store-a'`)).rows,
  ])));
}

describe("local SQL-backed V4 compiler startup", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await persistDraft(database);
  });

  afterEach(async () => database.close());

  it("uses the shared SQL reader chain for Validate without mutating or publishing", async () => {
    const app = createApp({ config: await config(), storefrontSql: database });
    const before = await workspaceState(database);

    const valid = await post(app, "validate", 4);
    expect(valid.status).toBe(200);
    expect(valid.body).toMatchObject({ ok: true, diagnostics: [] });

    expect(await workspaceState(database)).toEqual(before);
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);

    await database.query(
      `UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "id" = 'home-a'`,
      [{ sections: [{ kind: "global", globalSectionId: "missing-global" }] }],
    );
    const invalid = await post(app, "validate", 4);
    expect(invalid.status).toBe(422);
    expect(invalid.body.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_GLOBAL_SECTION" }),
    ]));
  });

  it("previews the current persisted draft without publishing a public snapshot", async () => {
    const app = createApp({ config: await config(), storefrontSql: database });
    await database.query(
      `UPDATE "StorefrontTemplate" SET "layout" = $1 WHERE "id" = 'home-a'`,
      [{ sections: [{ kind: "inline", section: { id: "rich-text-a", type: "rich-text", settings: { heading: "Current draft" }, blocks: [] } }] }],
    );

    const preview = await post(app, "preview/compile", 4);
    expect(preview.status).toBe(200);
    expect(preview.body.snapshot.templates["home-a"].layout.sections[0].section.settings.heading).toBe("Current draft");
    expect((await request(app).get("/api/stores/store-a/storefront/public")).status).toBe(404);
  });

  it("publishes the persisted draft and serves its active source generation", async () => {
    const app = createApp({ config: await config(), storefrontSql: database });

    const published = await post(app, "publish", 4, "pub-a");
    expect(published.status).toBe(201);
    expect(published.body).toMatchObject({
      ok: true,
      publication: {
        storeId: "store-a",
        sourceGeneration: 4,
      },
      reused: false,
    });

    const publicResponse = await getPublic(app);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body).toMatchObject({
      id: published.body.publication.id,
      document: {
        storeId: "store-a",
        sourceGeneration: 4,
      },
    });
  });

  it("retains an injected publication API while composing the SQL public reader", async () => {
    const app = createApp({
      config: await config(),
      storefrontSql: database,
      storefrontPublicationApi: {
        async publish(storeId, expectedGeneration) {
          return {
            ok: true,
            publication: {
              id: "injected-publication",
              storeId,
              sourceGeneration: expectedGeneration,
            },
            diagnostics: [],
            reused: true,
          };
        },
      },
    });

    const published = await post(app, "publish", 4, "injected-key");
    expect(published.status).toBe(200);
    expect(published.body.publication.id).toBe("injected-publication");
    expect((await getPublic(app)).status).toBe(404);
  });

  it("retains an injected public API while composing the SQL publication service", async () => {
    const app = createApp({
      config: await config(),
      storefrontSql: database,
      publicStorefrontApi: {
        async load(storeId) {
          return {
            id: "injected-public",
            document: {
              schemaVersion: 4,
              storeId,
              sourceGeneration: 77,
              compilerVersion: "injected",
              registryManifestHash: "injected",
              theme: { presetId: "minimal", settings: {}, artifactId: null },
              templates: {},
              globalSections: {},
              menus: {},
              templateDefaults: {},
              assignments: [],
              dependencies: { edges: [] },
            },
          };
        },
      },
    });

    expect((await post(app, "publish", 4, "composed-key")).status).toBe(201);
    const publicResponse = await getPublic(app);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body).toMatchObject({
      id: "injected-public",
      document: { sourceGeneration: 77 },
    });
  });

  it("keeps an explicitly injected compiler API as the composition override", async () => {
    const app = createApp({
      config: await config(),
      storefrontSql: database,
      storefrontCompilerApi: {
        async compile() {
          return {
            ok: false,
            diagnostics: [{ code: "INJECTED_COMPILER" }],
            dependencies: { injected: true },
          };
        },
      },
    });

    const response = await post(app, "validate", 4);
    expect(response.status).toBe(422);
    expect(response.body.diagnostics).toEqual([{ code: "INJECTED_COMPILER" }]);
  });
});
