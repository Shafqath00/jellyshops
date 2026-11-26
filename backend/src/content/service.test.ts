import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../http/errors.js";
import { MemoryContentRepository } from "./memory-repository.js";
import { ContentService } from "./service.js";

const NOW = new Date("2026-11-26T12:00:00Z");
const actor = { userId: "user-1", name: "Sam" };

function setup(limits?: { check: (storeId: string, kind: string) => Promise<void> }) {
  let now = NOW;
  const repository = new MemoryContentRepository(() => now);
  const service = new ContentService(repository, () => now, limits as never);
  return { repository, service, setNow: (value: Date) => { now = value; } };
}

async function failure(run: Promise<unknown>): Promise<ApiError> {
  try { await run; } catch (error) { if (error instanceof ApiError) return error; throw error; }
  throw new Error("expected a failure");
}

describe("pages", () => {
  it("creates a draft with an address made from the title and the author", async () => {
    const { service } = setup();
    const page = await service.createPage("store-a", { title: "Delivery & Returns" }, actor);
    expect(page).toMatchObject({ handle: "delivery-and-returns", status: "DRAFT", authorUserId: "user-1", authorName: "Sam", archivedAt: null });
    expect(page.content).toEqual({ type: "doc", content: [] });
  });

  it("keeps addresses unique: a made-up one gets a number, a typed one is refused with a suggestion", async () => {
    const { service } = setup();
    await service.createPage("store-a", { title: "About" });
    expect((await service.createPage("store-a", { title: "About" })).handle).toBe("about-2");
    const error = await failure(service.createPage("store-a", { title: "Our story", handle: "about" }));
    expect(error.status).toBe(409);
    expect(error.code).toBe("CONTENT_HANDLE_TAKEN");
    expect(error.message).toContain("about-3");
    expect(await service.checkPageHandle("store-a", "about")).toEqual({ handle: "about", available: false, suggestion: "about-3" });
    expect((await service.checkPageHandle("store-b", "about")).available).toBe(true);
  });

  it("refuses an invalid address and an empty title with plain messages", async () => {
    const { service } = setup();
    expect((await failure(service.createPage("store-a", { title: "About", handle: "About Us!" }))).code).toBe("CONTENT_HANDLE_INVALID");
    expect((await failure(service.createPage("store-a", { title: "   " }))).message).toBe("The page title can't be empty.");
  });

  it("publishes at once, schedules for later, and the job publishes when the time comes", async () => {
    const { service, setNow } = setup();
    const now = await service.createPage("store-a", { title: "Now", publish: true });
    expect(now.status).toBe("PUBLISHED");
    const later = await service.createPage("store-a", { title: "Later", scheduledAt: "2026-11-27T09:00:00Z" });
    expect(later).toMatchObject({ status: "DRAFT", scheduledAt: new Date("2026-11-27T09:00:00Z") });
    expect(await service.publishDue()).toEqual([]);
    setNow(new Date("2026-11-27T09:01:00Z"));
    expect(await service.publishDue()).toEqual([{ storeId: "store-a", resourceType: "page", id: later.id }]);
    expect(await service.getPage("store-a", later.id)).toMatchObject({ status: "PUBLISHED", scheduledAt: null, publishedAt: new Date("2026-11-27T09:00:00Z") });
    expect((await failure(service.createPage("store-a", { title: "Past", scheduledAt: "2026-11-01T00:00:00Z" }))).code).toBe("CONTENT_SCHEDULE_INVALID");
  });

  it("archives before a permanent delete, and archived pages don't publish on schedule", async () => {
    const { service, repository, setNow } = setup();
    const page = await service.createPage("store-a", { title: "Sale", scheduledAt: "2026-11-27T09:00:00Z" });
    expect((await failure(service.deletePage("store-a", page.id))).code).toBe("CONTENT_NOT_ARCHIVED");
    const archived = await service.archivePage("store-a", page.id);
    expect(archived).toMatchObject({ status: "DRAFT", scheduledAt: null });
    setNow(new Date("2026-11-28T00:00:00Z"));
    expect(await service.publishDue()).toEqual([]);
    expect((await service.restorePage("store-a", page.id)).archivedAt).toBeNull();
    await service.archivePage("store-a", page.id);
    await service.deletePage("store-a", page.id);
    expect(repository.pages.size).toBe(0);
  });

  it("duplicates as a draft copy with a free address", async () => {
    const { service } = setup();
    const page = await service.createPage("store-a", { title: "About", content: { type: "doc", content: [{ type: "paragraph" }] }, publish: true, seoTitle: "About us" });
    const copy = await service.duplicatePage("store-a", page.id, { userId: "user-2", name: "Alex" });
    expect(copy).toMatchObject({ title: "About (copy)", handle: "about-copy", status: "DRAFT", seoTitle: "About us", authorName: "Alex" });
    expect(copy.content).toEqual(page.content);
    expect((await service.duplicatePage("store-a", page.id)).handle).toBe("about-copy-2");
  });

  it("checks the plan limit before creating or duplicating", async () => {
    const check = vi.fn(async () => { throw new ApiError(409, "PLAN_LIMIT", "full"); });
    const { service, repository } = setup({ check });
    expect((await failure(service.createPage("store-a", { title: "About" }))).code).toBe("PLAN_LIMIT");
    expect(check).toHaveBeenCalledWith("store-a", "pages");
    expect(repository.pages.size).toBe(0);
  });

  it("keeps an old address working after a rename, through more than one rename", async () => {
    const { service } = setup();
    const page = await service.createPage("store-a", { title: "Delivery", publish: true });
    await service.updatePage("store-a", page.id, { handle: "shipping" });
    await service.updatePage("store-a", page.id, { handle: "delivery-info" });
    expect(await service.resolveRedirect("store-a", "/pages/delivery")).toBe("/pages/delivery-info");
    expect(await service.resolveRedirect("store-a", "/pages/shipping/")).toBe("/pages/delivery-info");
    expect(await service.resolveRedirect("store-b", "/pages/delivery")).toBeNull();
    await service.unpublishPage("store-a", page.id);
    expect(await service.resolveRedirect("store-a", "/pages/delivery")).toBeNull();
  });

  it("lets a new page take an old address for itself", async () => {
    const { service } = setup();
    const first = await service.createPage("store-a", { title: "Delivery", publish: true });
    await service.updatePage("store-a", first.id, { handle: "shipping" });
    const second = await service.createPage("store-a", { title: "Delivery", publish: true });
    expect(second.handle).toBe("delivery");
    expect(await service.resolveRedirect("store-a", "/pages/delivery")).toBeNull();
  });

  it("runs bulk actions item by item and reports what failed", async () => {
    const { service } = setup();
    const a = await service.createPage("store-a", { title: "A" });
    const b = await service.createPage("store-a", { title: "B" });
    const published = await service.bulkPages("store-a", "publish", [a.id, b.id, "missing"]);
    expect(published.done).toEqual([a.id, b.id]);
    expect(published.failed).toEqual([{ id: "missing", message: expect.stringContaining("doesn't exist") }]);
    const deleted = await service.bulkPages("store-a", "delete", [a.id]);
    expect(deleted.failed[0]?.message).toContain("Archive this page");
  });

  it("filters, counts and sorts the list", async () => {
    const { service } = setup();
    await service.createPage("store-a", { title: "About", publish: true });
    const old = await service.createPage("store-a", { title: "Old" });
    await service.archivePage("store-a", old.id);
    await service.createPage("store-b", { title: "Elsewhere" });
    const result = await service.browsePages("store-a", { sort: "title" });
    expect(result.items.map((page) => page.title)).toEqual(["About"]);
    expect(result.counts).toMatchObject({ all: 2, active: 1, published: 1, archived: 1 });
  });
});

describe("blogs and posts", () => {
  it("creates posts with tags inside a blog of the same store", async () => {
    const { service } = setup();
    const blog = await service.createBlog("store-a", { title: "News" });
    const post = await service.createArticle("store-a", { blogId: blog.id, title: "Opening day", tags: ["Events", "events", " Shop "] }, actor);
    expect(post).toMatchObject({ blogId: blog.id, handle: "opening-day", tags: ["Events", "Shop"], authorName: "Sam" });
    expect((await failure(service.createArticle("store-b", { blogId: blog.id, title: "Nope" }))).status).toBe(404);
  });

  it("allows the same post address in two blogs but not twice in one", async () => {
    const { service } = setup();
    const news = await service.createBlog("store-a", { title: "News" });
    const guides = await service.createBlog("store-a", { title: "Guides" });
    await service.createArticle("store-a", { blogId: news.id, title: "Hello" });
    expect((await service.createArticle("store-a", { blogId: guides.id, title: "Hello" })).handle).toBe("hello");
    expect((await failure(service.createArticle("store-a", { blogId: news.id, title: "Hi", handle: "hello" }))).code).toBe("CONTENT_HANDLE_TAKEN");
  });

  it("follows a renamed blog to its posts, and a post moved to another blog", async () => {
    const { service } = setup();
    const news = await service.createBlog("store-a", { title: "News" });
    const guides = await service.createBlog("store-a", { title: "Guides" });
    const post = await service.createArticle("store-a", { blogId: news.id, title: "Choosing a mattress", publish: true });
    await service.updateBlog("store-a", news.id, { handle: "journal" });
    expect(await service.resolveRedirect("store-a", "/blogs/news")).toBe("/blogs/journal");
    expect(await service.resolveRedirect("store-a", "/blogs/news/choosing-a-mattress")).toBe("/blogs/journal/choosing-a-mattress");
    await service.updateArticle("store-a", post.id, { blogId: guides.id });
    expect(await service.resolveRedirect("store-a", "/blogs/journal/choosing-a-mattress")).toBe("/blogs/guides/choosing-a-mattress");
  });

  it("only deletes an empty blog", async () => {
    const { service } = setup();
    const blog = await service.createBlog("store-a", { title: "News" });
    const post = await service.createArticle("store-a", { blogId: blog.id, title: "Hello" });
    expect((await failure(service.deleteBlog("store-a", blog.id))).code).toBe("CONTENT_BLOG_NOT_EMPTY");
    await service.archiveArticle("store-a", post.id);
    await service.deleteArticle("store-a", post.id);
    await service.deleteBlog("store-a", blog.id);
    expect(await service.listBlogs("store-a")).toEqual([]);
  });

  it("checks the post limit", async () => {
    const check = vi.fn(async (_storeId: string, kind: string) => { if (kind === "articles") throw new ApiError(409, "PLAN_LIMIT", "full"); });
    const { service } = setup({ check });
    const blog = await service.createBlog("store-a", { title: "News" });
    expect((await failure(service.createArticle("store-a", { blogId: blog.id, title: "Hello" }))).code).toBe("PLAN_LIMIT");
  });
});
