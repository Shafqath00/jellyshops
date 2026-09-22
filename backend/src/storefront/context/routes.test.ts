import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../http/errors.js";
import { createPublicStorefrontContextRouter } from "./routes.js";

describe("public storefront context routes", () => {
  it("uses the path store identity and returns contexts or 404", async () => {
    const service = {
      search: vi.fn(async () => ({ type: "search", query: "shoes", state: "none", resultCount: 0, results: [] })),
      page: vi.fn(async () => null), blog: vi.fn(async () => null), article: vi.fn(async () => null),
    };
    const app = express();
    app.use("/api/public/stores/:storeId/storefront/context", createPublicStorefrontContextRouter(service));
    app.use(errorHandler);

    const search = await request(app).get("/api/public/stores/store-a/storefront/context/search?q=shoes");
    expect(search.status).toBe(200);
    expect(service.search).toHaveBeenCalledWith("store-a", "shoes");
    expect((await request(app).get("/api/public/stores/store-a/storefront/context/pages/about")).status).toBe(404);
    expect((await request(app).get("/api/public/stores/store-a/storefront/context/blogs/news")).status).toBe(404);
    expect((await request(app).get("/api/public/stores/store-a/storefront/context/blogs/news/articles/launch")).status).toBe(404);
  });
});
