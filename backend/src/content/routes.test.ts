import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createContentRouter } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "ADMIN" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const service = {
    listPages: vi.fn(async () => []),
    getPage: vi.fn(async () => null),
    createPage: vi.fn(async (storeId: string, input: Record<string, unknown>) => ({ id: "page-1", storeId, ...input, status: "DRAFT" })),
    updatePage: vi.fn(async (storeId: string, id: string, input: Record<string, unknown>) => ({ id, storeId, ...input })),
    publishPage: vi.fn(async (storeId: string, id: string) => ({ id, storeId, status: "PUBLISHED" })),
    unpublishPage: vi.fn(async (storeId: string, id: string) => ({ id, storeId, status: "DRAFT", publishedAt: null })),
    listBlogs: vi.fn(async () => []),
    getBlog: vi.fn(async () => null),
    createBlog: vi.fn(async (storeId: string, input: Record<string, unknown>) => ({ id: "blog-1", storeId, ...input })),
    updateBlog: vi.fn(async (storeId: string, id: string, input: Record<string, unknown>) => ({ id, storeId, ...input })),
    listArticles: vi.fn(async () => []),
    getArticle: vi.fn(async () => null),
    createArticle: vi.fn(async (storeId: string, input: Record<string, unknown>) => ({ id: "article-1", storeId, ...input, status: "DRAFT" })),
    updateArticle: vi.fn(async (storeId: string, id: string, input: Record<string, unknown>) => ({ id, storeId, ...input })),
    publishArticle: vi.fn(async (storeId: string, id: string) => ({ id, storeId, status: "PUBLISHED" })),
    unpublishArticle: vi.fn(async (storeId: string, id: string) => ({ id, storeId, status: "DRAFT", publishedAt: null })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "content-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/content", createContentRouter(service, authProvider));
  app.use(errorHandler);
  return { app, service };
}

describe("content routes", () => {
  it("requires store membership for page reads", async () => {
    const { app, service } = setup();
    const allowed = await request(app)
      .get("/api/stores/store-a/content/pages")
      .set("Authorization", "Bearer token");
    const denied = await request(app)
      .get("/api/stores/store-b/content/pages")
      .set("Authorization", "Bearer token");

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(service.listPages).toHaveBeenCalledWith("store-a");
  });

  it("uses authorized store context when creating a page", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/content/pages")
      .set("Authorization", "Bearer token")
      .send({ storeId: "store-b", title: "About", handle: "about", content: {}, noindex: false });

    expect(response.status).toBe(201);
    expect(service.createPage).toHaveBeenCalledWith(
      "store-a",
      expect.not.objectContaining({ storeId: "store-b" }),
    );
  });

  it("publishes and unpublishes through explicit lifecycle actions", async () => {
    const { app, service } = setup();
    const published = await request(app)
      .post("/api/stores/store-a/content/pages/page-1/publish")
      .set("Authorization", "Bearer token");
    const unpublished = await request(app)
      .post("/api/stores/store-a/content/pages/page-1/unpublish")
      .set("Authorization", "Bearer token");

    expect(published.status).toBe(200);
    expect(unpublished.status).toBe(200);
    expect(service.publishPage).toHaveBeenCalledWith("store-a", "page-1");
    expect(service.unpublishPage).toHaveBeenCalledWith("store-a", "page-1");
  });

  it("lists articles within an optional blog filter", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .get("/api/stores/store-a/content/articles?blogId=blog-1")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(service.listArticles).toHaveBeenCalledWith("store-a", "blog-1");
  });
});
