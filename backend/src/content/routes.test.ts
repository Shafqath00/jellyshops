import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { MemoryContentRepository } from "./memory-repository.js";
import { createContentRouter, createPublicContentRedirectRouter } from "./routes.js";
import { ContentService } from "./service.js";

const principal: MerchantPrincipal = {
  userId: "user-7",
  email: "sam@example.test",
  storeIds: ["store-a"],
  storeRoles: { "store-a": "ADMIN" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const service = new ContentService(new MemoryContentRepository(() => new Date("2026-11-26T12:00:00Z")), () => new Date("2026-11-26T12:00:00Z"));
  const app = express();
  app.use((req, _res, next) => { req.id = "content-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/content", createContentRouter(service, authProvider));
  app.use("/api/public/stores/:storeId", createPublicContentRedirectRouter(service));
  app.use(errorHandler);
  const as = (method: "get" | "post" | "patch" | "delete", path: string) => request(app)[method](`/api/stores/store-a/content${path}`).set("Authorization", "Bearer token");
  return { app, service, as };
}

describe("content routes", () => {
  it("only lets members of the store in", async () => {
    const { app } = setup();
    const denied = await request(app).get("/api/stores/store-b/content/pages").set("Authorization", "Bearer token");
    expect(denied.status).toBe(404);
  });

  it("creates a page in the signed-in store with the person as author, ignoring a storeId in the body", async () => {
    const { as, service } = setup();
    const response = await as("post", "/pages").send({ storeId: "store-b", title: "About us" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ storeId: "store-a", handle: "about-us", authorUserId: "user-7", authorName: "sam" });
    expect(await service.listPages("store-b")).toEqual([]);
  });

  it("browses with filters and checks addresses before the item routes", async () => {
    const { as } = setup();
    await as("post", "/pages").send({ title: "About", publish: true });
    await as("post", "/pages").send({ title: "Draft page" });
    const browse = await as("get", "/pages/browse?state=published&sort=title");
    expect(browse.status).toBe(200);
    expect(browse.body.items.map((page: { title: string }) => page.title)).toEqual(["About"]);
    expect(browse.body.counts).toMatchObject({ active: 2, published: 1, draft: 1 });
    const check = await as("get", "/pages/handle-check?handle=about");
    expect(check.body).toEqual({ handle: "about", available: false, suggestion: "about-2" });
    expect((await as("get", "/pages/browse?limit=1000")).status).toBe(400);
  });

  it("answers a taken address with 409 and a suggestion", async () => {
    const { as } = setup();
    await as("post", "/pages").send({ title: "About" });
    const response = await as("post", "/pages").send({ title: "Story", handle: "about" });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "CONTENT_HANDLE_TAKEN" });
  });

  it("archives, restores, duplicates and deletes", async () => {
    const { as } = setup();
    const page = (await as("post", "/pages").send({ title: "Sale" })).body;
    expect((await as("delete", `/pages/${page.id}`)).status).toBe(409);
    expect((await as("post", `/pages/${page.id}/archive`)).body.archivedAt).toBeTruthy();
    expect((await as("post", `/pages/${page.id}/duplicate`)).status).toBe(201);
    expect((await as("delete", `/pages/${page.id}`)).status).toBe(204);
    expect((await as("get", `/pages/${page.id}`)).status).toBe(404);
  });

  it("schedules and runs bulk actions", async () => {
    const { as } = setup();
    const page = (await as("post", "/pages").send({ title: "Launch" })).body;
    const scheduled = await as("post", `/pages/${page.id}/schedule`).send({ scheduledAt: "2026-12-01T09:00:00Z" });
    expect(scheduled.body).toMatchObject({ status: "DRAFT", scheduledAt: "2026-12-01T09:00:00.000Z" });
    const bulk = await as("post", "/pages/bulk").send({ action: "publish", ids: [page.id] });
    expect(bulk.body).toEqual({ done: [page.id], failed: [] });
    expect((await as("post", "/pages/bulk").send({ action: "explode", ids: [page.id] })).status).toBe(400);
  });

  it("manages blogs and posts", async () => {
    const { as } = setup();
    const blog = (await as("post", "/blogs").send({ title: "News" })).body;
    const post = await as("post", "/articles").send({ blogId: blog.id, title: "Hello", tags: ["One"] });
    expect(post.status).toBe(201);
    expect((await as("get", `/articles/browse?blogId=${blog.id}&tag=one`)).body.total).toBe(1);
    expect((await as("get", `/articles/handle-check?handle=hello&blogId=${blog.id}`)).body.available).toBe(false);
    expect((await as("delete", `/blogs/${blog.id}`)).status).toBe(409);
  });

  it("tells the storefront where an old address went, and nothing about drafts", async () => {
    const { app, as } = setup();
    const page = (await as("post", "/pages").send({ title: "Delivery", publish: true })).body;
    await as("patch", `/pages/${page.id}`).send({ handle: "shipping" });
    const moved = await request(app).get("/api/public/stores/store-a/content-redirect?path=/pages/delivery");
    expect(moved.body).toEqual({ location: "/pages/shipping" });
    expect(moved.headers["cache-control"]).toContain("max-age=60");
    const unknown = await request(app).get("/api/public/stores/store-a/content-redirect?path=/admin");
    expect(unknown.body).toEqual({ location: null });
  });

  it("turns pasted HTML into a safe document and a document back into HTML", async () => {
    const { as } = setup();
    const imported = await as("post", "/import-html").send({ html: "<h2>Hi</h2><p onclick=\"alert(1)\">Text<script>alert(1)</script></p>" });
    expect(imported.status).toBe(200);
    expect(imported.body.document).toEqual({ type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] },
      { type: "paragraph", content: [{ type: "text", text: "Text" }] },
    ] });
    const exported = await as("post", "/export-html").send({ content: imported.body.document });
    expect(exported.body.html).toBe("<h2>Hi</h2>\n<p>Text</p>");
    expect((await as("post", "/import-html").send({ html: 5 })).status).toBe(400);
  });
});
