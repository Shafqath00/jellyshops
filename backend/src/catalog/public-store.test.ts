import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createPublicStoreRouter } from "./public-store.js";

describe("public store details", () => {
  it("returns store identity from the database and scopes by id", async () => {
    const database = { query: vi.fn(async (_sql: string, values: unknown[]) => values[0] === "store-a" ? { rows: [{ id: "store-a", name: "Sweet Bakes", slug: "sweet-bakes", currency: "INR", country: "IN" }] } : { rows: [] }) };
    const app = express();
    app.use("/api/public/stores/:storeId", createPublicStoreRouter(database));
    await expect(request(app).get("/api/public/stores/store-a")).resolves.toMatchObject({ status: 200, body: { store: { id: "store-a", slug: "sweet-bakes" } } });
    await expect(request(app).get("/api/public/stores/store-b")).resolves.toMatchObject({ status: 404 });
  });
});
