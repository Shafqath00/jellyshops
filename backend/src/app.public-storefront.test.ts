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
  vi,
} from "vitest";

import type { AppConfig } from "./config.js";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("./database/client.js", () => ({
  createSupabasePool: () => ({
    query,
  }),
}));

describe("default public storefront loading", () => {
  const originalDatabaseUrl =
    process.env.SUPABASE_DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();

    process.env.SUPABASE_DATABASE_URL =
      "postgresql://test";

    /*
     * This represents an editable workspace template.
     *
     * The public storefront MUST NOT expose this
     * merely because it exists.
     */
    query.mockResolvedValue({
      rows: [
        {
          id: "home",
          revision: 7,

          layout: {
            theme: {
              id: "fresh-market",
              settings: {},
            },

            sections: [
              {
                kind: "inline",

                section: {
                  id: "fresh-market-hero",
                  type: "hero",
                  enabled: true,
                  settings: {},

                  blocks: [
                    {
                      id:
                        "fresh-market-heading",
                      type: "heading",
                      enabled: true,

                      settings: {
                        text:
                          "Good food, gathered well.",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
  });

  afterEach(() => {
    if (
      originalDatabaseUrl === undefined
    ) {
      delete process.env
        .SUPABASE_DATABASE_URL;
    } else {
      process.env.SUPABASE_DATABASE_URL =
        originalDatabaseUrl;
    }

    vi.clearAllMocks();
  });

  it("does not expose an unpublished home template", async () => {
    const directory = await mkdtemp(
      path.join(
        tmpdir(),
        "jelly-public-test-",
      ),
    );

    const config: AppConfig = {
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

    const { createApp } =
      await import("./app.js");

    const response = await request(
      createApp({
        config,
      }),
    ).get(
      "/api/stores/store-demo/storefront/public",
    );

    /*
     * No publication exists.
     *
     * The editable StorefrontTemplate above
     * must therefore NOT be returned publicly.
     */
    expect(response.status).toBe(404);

    expect(response.body).toMatchObject({
      error: {
        code: "PUBLICATION_NOT_FOUND",
      },
    });

    /*
     * /storefront/public no longer reads the
     * StorefrontTemplate table directly.
     */
    expect(query).not.toHaveBeenCalled();
  });
});