import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";

import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { createApp } from "../app.js";

import type {
  AppConfig,
} from "../config.js";

import type {
  StorefrontRepository,
} from "./repository.js";

function createTestConfig(
  directory: string,
): AppConfig {
  return {
    port: 3001,

    nodeEnv: "test",

    corsOrigins: [
      "http://localhost:3000",
    ],

    trustProxy: false,

    authProvider: "development",

    // repositoryProvider: "local-json",

    mediaProvider: "local-files",

    dataDirectory: directory,

    uploadDirectory: path.join(
      directory,
      "uploads",
    ),

    maxUploadBytes:
      1024 * 1024,

    demoStoreId: "store-demo",
  };
}

async function createTestApp() {
  const directory = await mkdtemp(
    path.join(
      tmpdir(),
      "jelly-api-",
    ),
  );

  return createApp({
    config:
      createTestConfig(directory),
  });
}

function authed(
  app: ReturnType<typeof createApp>,
) {
  return {
    get: (url: string) =>
      request(app)
        .get(url)
        .set(
          "Authorization",
          "Bearer jelly-demo-merchant",
        ),

    put: (url: string) =>
      request(app)
        .put(url)
        .set(
          "Authorization",
          "Bearer jelly-demo-merchant",
        ),

    post: (url: string) =>
      request(app)
        .post(url)
        .set(
          "Authorization",
          "Bearer jelly-demo-merchant",
        ),
  };
}

describe("legacy storefront routes", () => {
  let app:
    ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("keeps the V3 draft readable for migration compatibility", async () => {
    const response =
      await authed(app).get(
        "/api/stores/store-demo/storefront/draft",
      );

    expect(
      response.status,
    ).toBe(200);

    expect(
      response.body,
    ).toMatchObject({
      storeId: "store-demo",
      revision: 0,
    });

    expect(
      response.body.document
        .regions.template[0].type,
    ).toBe("hero");
  });

  it("rejects legacy draft writes so new changes cannot bypass normalized resources", async () => {
    const initial =
      await authed(app).get(
        "/api/stores/store-demo/storefront/draft",
      );

    const response =
      await authed(app)
        .put(
          "/api/stores/store-demo/storefront/draft",
        )
        .send({
          expectedRevision: 0,
          document:
            initial.body.document,
        });

    expect(
      response.status,
    ).toBe(404);

    const unchanged =
      await authed(app).get(
        "/api/stores/store-demo/storefront/draft",
      );

    expect(
      unchanged.body.revision,
    ).toBe(0);
  });

  it("returns 503 when the compiled publication service is not configured", async () => {
    const response =
      await authed(app)
        .post(
          "/api/stores/store-demo/storefront/publish",
        )
        .send({
          expectedGeneration: 0,
          idempotencyKey:
            "publish-test-1",
        });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: {
        code: "STOREFRONT_PUBLICATION_NOT_CONFIGURED",
      },
    });

    /*
     * A failed/unconfigured publish must not
     * accidentally create a public storefront.
     */
    const publicResponse =
      await request(app).get(
        "/api/stores/store-demo/storefront/public",
      );

    expect(
      publicResponse.status,
    ).toBe(404);
  });

  it("serves the injected public publication instead of the legacy draft repository", async () => {
    const directory = await mkdtemp(
      path.join(
        tmpdir(),
        "jelly-published-",
      ),
    );

    const publishedDocument = {
      schemaVersion: 4 as const,

      storeId: "store-demo",

      sourceGeneration: 14,

      compilerVersion: "local-v4-1",

      registryManifestHash: "registry",

      theme: {
        presetId: "minimal",

        settings: {},

        artifactId: null,
      },

      templates: {},
      globalSections: {},
      menus: {},
      templateDefaults: {},
      assignments: [],
      dependencies: { edges: [] },
    };

    const storefrontRepository:
      StorefrontRepository<unknown> = {
      async getDraft() {
        return null;
      },

      async saveDraft() {
        throw new Error(
          "saveDraft should not be called",
        );
      },

      async publish() {
        throw new Error(
          "legacy publish should not be called",
        );
      },

      async getPublic(storeId) {
        throw new Error(
          `legacy public read should not be called for ${storeId}`,
        );
      },
    };

    const appWithPublishedTheme =
      createApp({
        config:
          createTestConfig(
            directory,
          ),

        storefrontRepository,

        publicStorefrontApi: {
          async load() {
            return {
              id:
                "publication-store-demo-14",
              document:
                publishedDocument,
            };
          },
        },
      });

    const response =
      await request(
        appWithPublishedTheme,
      ).get(
        "/api/stores/store-demo/storefront/public",
      );

    expect(
      response.status,
    ).toBe(200);

    expect(
      response.body,
    ).toMatchObject({
      id:
        "publication-store-demo-14",

      document: {
        sourceGeneration: 14,

        theme: {
          presetId:
            "minimal",
        },
      },
    });
  });

  it("returns 404 when the injected public API has no active publication", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "jelly-unpublished-"),
    );
    const appWithoutPublication = createApp({
      config: createTestConfig(directory),
      publicStorefrontApi: {
        async load() {
          return null;
        },
      },
    });

    const response = await request(appWithoutPublication).get(
      "/api/stores/store-demo/storefront/public",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: { code: "PUBLICATION_NOT_FOUND" },
    });
  });
});
