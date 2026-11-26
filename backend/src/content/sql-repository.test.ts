import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "../../test/integration/pglite.js";
import { SqlContentRepository } from "./sql-repository.js";

/** Columns from 20261126000000_content_management.sql (pages ignore tags, posts ignore showInNavigation). */
const lifecycle = { scheduledAt: null, archivedAt: null, authorUserId: null, authorName: null, showInNavigation: true, tags: [] as string[] };

describe("SqlContentRepository", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
  });

  afterEach(async () => database.close());

  it("persists page, blog, and article CRUD independently for each store", async () => {
    const repository = new SqlContentRepository(database, {
      id: ids("page-a", "blog-a", "article-a", "page-b"),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    });
    const pageContent = { blocks: [{ type: "paragraph", text: "About A" }] };

    const page = await repository.createPage({
      storeId: "store-a",
      title: "About A",
      handle: "about",
      content: pageContent,
      featuredMediaId: null,
      status: "DRAFT",
      publishedAt: null,
      seoTitle: null,
      seoDescription: null,
      socialMediaId: null,
      noindex: false,
      canonicalOverride: null,
      ...lifecycle,
    });
    const blog = await repository.createBlog({
      storeId: "store-a",
      title: "Journal",
      handle: "journal",
    });
    const article = await repository.createArticle({
      storeId: "store-a",
      blogId: blog.id,
      title: "Opening",
      handle: "opening",
      excerpt: "We are open.",
      content: { text: "Hello" },
      featuredMediaId: null,
      status: "PUBLISHED",
      publishedAt: new Date("2026-09-22T13:00:00.000Z"),
      seoTitle: "Opening",
      seoDescription: null,
      socialMediaId: null,
      noindex: false,
      canonicalOverride: null,
      ...lifecycle,
    });
    const otherPage = await repository.createPage({
      storeId: "store-b",
      title: "About B",
      handle: "about",
      content: {},
      featuredMediaId: null,
      status: "DRAFT",
      publishedAt: null,
      seoTitle: null,
      seoDescription: null,
      socialMediaId: null,
      noindex: false,
      canonicalOverride: null,
      ...lifecycle,
    });

    pageContent.blocks[0].text = "Caller mutation";
    expect(await repository.listPages("store-a")).toMatchObject([{ id: page.id, content: { blocks: [{ text: "About A" }] } }]);
    expect(await repository.listPages("store-b")).toMatchObject([{ id: otherPage.id }]);
    expect(await repository.getPage("store-b", page.id)).toBeNull();
    expect(await repository.listBlogs("store-b")).toEqual([]);
    expect(await repository.getBlog("store-b", blog.id)).toBeNull();
    expect(await repository.listArticles("store-a", blog.id)).toMatchObject([{ id: article.id }]);
    expect(await repository.listArticles("store-b")).toEqual([]);
    expect(await repository.getArticle("store-b", article.id)).toBeNull();

    await expect(repository.createPage({
      storeId: "store-a", title: "Duplicate", handle: "about", content: {}, featuredMediaId: null,
      status: "DRAFT", publishedAt: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null, ...lifecycle,
    })).rejects.toThrow();

    const updated = await repository.updatePage("store-a", page.id, {
      title: "About our store",
      content: { text: "Updated" },
      status: "PUBLISHED",
      publishedAt: new Date("2026-09-22T14:00:00.000Z"),
    });
    expect(updated).toMatchObject({ id: page.id, title: "About our store", status: "PUBLISHED", content: { text: "Updated" } });
    expect(await repository.updatePage("store-b", page.id, { title: "Wrong store" })).toBeNull();

    await expect(repository.updateBlog("store-a", blog.id, { title: "Store journal" })).resolves.toMatchObject({ title: "Store journal" });
    await expect(repository.updateArticle("store-a", article.id, { excerpt: "Updated excerpt" })).resolves.toMatchObject({ excerpt: "Updated excerpt" });
  });

  it("reloads persisted content through a new repository instance", async () => {
    const first = new SqlContentRepository(database, { id: ids("page-a") });
    await first.createPage({
      storeId: "store-a", title: "FAQ", handle: "faq", content: { text: "Answers" }, featuredMediaId: null,
      status: "DRAFT", publishedAt: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null, ...lifecycle,
    });

    const restarted = new SqlContentRepository(database);
    await expect(restarted.listPages("store-a")).resolves.toMatchObject([
      { id: "page-a", handle: "faq", content: { text: "Answers" } },
    ]);
  });
});

describe("SqlContentRepository content management", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
  });

  afterEach(async () => database.close());

  const base = { featuredMediaId: null, publishedAt: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null };

  it("stores authors, tags, schedules and archive times, and publishes due drafts", async () => {
    const repository = new SqlContentRepository(database);
    const page = await repository.createPage({ ...base, ...lifecycle, storeId: "store-a", title: "Launch", handle: "launch", content: {}, status: "DRAFT",
      scheduledAt: new Date("2026-12-01T09:00:00.000Z"), authorUserId: "user-1", authorName: "Sam", showInNavigation: false });
    // Exact times are not compared here: PGlite reads TIMESTAMP columns back in the machine time zone.
    expect(page).toMatchObject({ authorName: "Sam", showInNavigation: false, archivedAt: null });
    expect(page.scheduledAt).toBeInstanceOf(Date);
    const blog = await repository.createBlog({ storeId: "store-a", title: "News", handle: "news" });
    const post = await repository.createArticle({ ...base, ...lifecycle, storeId: "store-a", blogId: blog.id, title: "Hi", handle: "hi", excerpt: "", content: {}, status: "DRAFT", tags: ["One", "Two"] });
    expect(post.tags).toEqual(["One", "Two"]);
    expect((await repository.updateArticle("store-a", post.id, { tags: ["Three"] }))?.tags).toEqual(["Three"]);

    expect(await repository.publishDue(new Date("2026-11-30T00:00:00.000Z"))).toEqual([]);
    expect(await repository.publishDue(new Date("2026-12-01T10:00:00.000Z"))).toEqual([{ storeId: "store-a", resourceType: "page", id: page.id }]);
    expect(await repository.getPage("store-a", page.id)).toMatchObject({ status: "PUBLISHED", scheduledAt: null, publishedAt: expect.any(Date) });
  });

  it("keeps one redirect per old address and removes an item's redirects when it is deleted", async () => {
    const repository = new SqlContentRepository(database);
    const page = await repository.createPage({ ...base, ...lifecycle, storeId: "store-a", title: "A", handle: "a", content: {}, status: "DRAFT" });
    await repository.saveRedirect({ storeId: "store-a", fromPath: "/pages/old", resourceType: "page", resourceId: "someone-else" });
    await repository.saveRedirect({ storeId: "store-a", fromPath: "/pages/old", resourceType: "page", resourceId: page.id });
    expect(await repository.findRedirect("store-a", "/pages/old")).toEqual({ storeId: "store-a", fromPath: "/pages/old", resourceType: "page", resourceId: page.id });
    expect(await repository.findRedirect("store-b", "/pages/old")).toBeNull();
    expect(await repository.deletePage("store-a", page.id)).toBe(true);
    expect(await repository.findRedirect("store-a", "/pages/old")).toBeNull();
    expect(await repository.deletePage("store-a", page.id)).toBe(false);
  });
});

function ids(...values: string[]): () => string {
  return () => {
    const id = values.shift();
    if (!id) throw new Error("No id configured for test");
    return id;
  };
}
