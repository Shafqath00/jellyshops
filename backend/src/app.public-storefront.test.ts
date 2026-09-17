import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("./database/client.js", () => ({
  createSupabasePool: () => ({ query }),
}));

describe("default public storefront loading", () => {
  const originalDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_DATABASE_URL = "postgresql://test";
    query.mockResolvedValue({
      rows: [{
        id: "home",
        revision: 7,
        layout: {
          theme: { id: "fresh-market", settings: {} },
          sections: [{
            kind: "inline",
            section: {
              id: "fresh-market-hero",
              type: "hero",
              enabled: true,
              settings: {},
              blocks: [{
                id: "fresh-market-heading",
                type: "heading",
                enabled: true,
                settings: { text: "Good food, gathered well." },
              }],
            },
          }],
        },
      }],
    });
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.SUPABASE_DATABASE_URL;
    } else {
      process.env.SUPABASE_DATABASE_URL = originalDatabaseUrl;
    }
    vi.clearAllMocks();
  });

  it("publishes an installed Fresh Market layout stored in the home template", async () => {
    const { createApp } = await import("./app.js");

    const response = await request(createApp())
      .get("/api/stores/store-demo/storefront/public");

    expect(response.status).toBe(200);
    expect(response.body.document.theme.presetId).toBe("fresh-market");
    expect(response.body.document.regions.template[0].blocks[0].settings.text)
      .toBe("Good food, gathered well.");
  });
});
