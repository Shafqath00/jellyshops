import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "../../test/integration/pglite.js";
import { SqlContentRepository } from "./sql-repository.js";

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
      status: "DRAFT", publishedAt: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null,
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
      status: "DRAFT", publishedAt: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null,
    });

    const restarted = new SqlContentRepository(database);
    await expect(restarted.listPages("store-a")).resolves.toMatchObject([
      { id: "page-a", handle: "faq", content: { text: "Answers" } },
    ]);
  });
});

function ids(...values: string[]): () => string {
  return () => {
    const id = values.shift();
    if (!id) throw new Error("No id configured for test");
    return id;
  };
}
