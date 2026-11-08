import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createPublicMetaobjectRouter, PublicMetaobjectService } from "./public-metaobjects.js";
import type { MetaobjectDefinitionRecord, MetaobjectEntryRecord } from "./repository.js";

const now = new Date();
const definition = (overrides: Partial<MetaobjectDefinitionRecord> = {}): MetaobjectDefinitionRecord => ({
  id: "def-1", storeId: "store-1", handle: "designers", name: "Designers", storefrontVisible: true, archivedAt: null, createdAt: now, updatedAt: now,
  fields: [
    { handle: "bio", name: "Bio", type: "text", storefrontVisible: true },
    { handle: "photo", name: "Photo", type: "image", storefrontVisible: true },
    { handle: "site", name: "Website", type: "url", storefrontVisible: true },
    { handle: "cost", name: "Internal cost", type: "decimal", storefrontVisible: false },
  ],
  ...overrides,
});
const entry = (handle: string, values: Record<string, unknown>, archivedAt: Date | null = null): MetaobjectEntryRecord => ({ id: handle, storeId: "store-1", definitionId: "def-1", handle, displayName: handle.toUpperCase(), values, archivedAt, createdAt: now, updatedAt: now });

const source = (definitions: MetaobjectDefinitionRecord[]) => ({
  listDefinitions: async () => definitions,
  listEntries: async () => [
    entry("ana", { bio: "Makes chairs", photo: "media-9", site: "javascript:alert(1)", cost: 12 }),
    entry("old", { bio: "Gone" }, now),
  ],
});

describe("public metaobjects", () => {
  it("returns only visible fields and live entries, with safe values", async () => {
    const list = await new PublicMetaobjectService(source([definition()])).list("store-1", "designers");
    expect(list?.definition.fields.map(({ handle }) => handle)).toEqual(["bio", "photo", "site"]);
    expect(list?.entries).toEqual([{ handle: "ana", displayName: "ANA", values: { bio: "Makes chairs", photo: "/api/public/media/store-1/media-9" } }]);
  });

  it("hides definitions that aren't visible on the storefront or are archived", async () => {
    expect(await new PublicMetaobjectService(source([definition({ storefrontVisible: false })])).list("store-1", "designers")).toBeNull();
    expect(await new PublicMetaobjectService(source([definition({ archivedAt: now })])).list("store-1", "designers")).toBeNull();
  });

  it("serves the list and one entry, 404 otherwise", async () => {
    const app = express();
    app.use("/api/public/stores/:storeId/storefront/metaobjects", createPublicMetaobjectRouter(new PublicMetaobjectService(source([definition()]))));
    const base = "/api/public/stores/store-1/storefront/metaobjects";
    expect((await request(app).get(`${base}/designers`)).body.entries).toHaveLength(1);
    expect((await request(app).get(`${base}/designers/ana`)).body.entry.displayName).toBe("ANA");
    expect((await request(app).get(`${base}/designers/old`)).status).toBe(404);
    expect((await request(app).get(`${base}/unknown`)).status).toBe(404);
  });
});
