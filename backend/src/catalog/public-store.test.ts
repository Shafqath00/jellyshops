import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createPublicStoreBySlugRouter, createPublicStoreRouter } from "./public-store.js";

describe("public store details", () => {
  it("returns store identity from the database and scopes by id", async () => {
    const database = { query: vi.fn(async (_sql: string, values: unknown[]) => values[0] === "store-a" ? { rows: [{ id: "store-a", name: "Sweet Bakes", slug: "sweet-bakes", currency: "INR", country: "IN" }] } : { rows: [] }) };
    const app = express();
    app.use("/api/public/stores/:storeId", createPublicStoreRouter(database));
    await expect(request(app).get("/api/public/stores/store-a")).resolves.toMatchObject({ status: 200, body: { store: { id: "store-a", slug: "sweet-bakes" } } });
    await expect(request(app).get("/api/public/stores/store-b")).resolves.toMatchObject({ status: 404 });
  });

  it("resolves a public storefront by slug", async () => {
    const database = { query: vi.fn(async (_sql: string, values: unknown[]) => values[0] === "tester" ? { rows: [{ id: "store-tester", name: "Tester", slug: "tester", currency: "INR", country: "IN" }] } : { rows: [] }) };
    const app = express();
    app.use("/api/public/storefronts/:slug", createPublicStoreBySlugRouter(database));
    await expect(request(app).get("/api/public/storefronts/tester")).resolves.toMatchObject({ status: 200, body: { store: { id: "store-tester", slug: "tester" } } });
  });
});
