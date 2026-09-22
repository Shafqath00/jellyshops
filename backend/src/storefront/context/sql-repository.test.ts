import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { SqlPublicStorefrontContextRepository } from "./sql-repository.js";

describe("SqlPublicStorefrontContextRepository", () => {
  let database: IntegrationDatabase;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const [id, slug] of [["store-a", "a"], ["store-b", "b"]] as const) await seedStore(database, id, slug);
    await database.query(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "status", "updatedAt") VALUES ('page-a', 'store-a', 'About A', 'about', '{}', 'PUBLISHED', CURRENT_TIMESTAMP), ('page-b', 'store-b', 'About B', 'about', '{}', 'PUBLISHED', CURRENT_TIMESTAMP), ('draft-a', 'store-a', 'Draft', 'draft-page', '{}', 'DRAFT', CURRENT_TIMESTAMP)`);
    await database.query(`INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt") VALUES ('blog-a', 'store-a', 'News A', 'news', CURRENT_TIMESTAMP), ('blog-b', 'store-b', 'News B', 'news', CURRENT_TIMESTAMP)`);
    await database.query(`INSERT INTO "Article" ("id", "storeId", "blogId", "title", "handle", "excerpt", "content", "status", "publishedAt", "updatedAt") VALUES ('article-a', 'store-a', 'blog-a', 'Launch A', 'launch', 'A', '{}', 'PUBLISHED', '2026-09-22T12:00:00Z', CURRENT_TIMESTAMP), ('article-old', 'store-a', 'blog-a', 'Old', 'old', 'Old', '{}', 'PUBLISHED', '2026-09-21T12:00:00Z', CURRENT_TIMESTAMP), ('article-draft', 'store-a', 'blog-a', 'Draft', 'draft', 'Draft', '{}', 'DRAFT', NULL, CURRENT_TIMESTAMP), ('article-b', 'store-b', 'blog-b', 'Launch B', 'launch', 'B', '{}', 'PUBLISHED', '2026-09-22T12:00:00Z', CURRENT_TIMESTAMP)`);
  });
  afterEach(async () => database.close());

  it("returns only same-store published content and ordered blog summaries", async () => {
    const repository = new SqlPublicStorefrontContextRepository(database);
    await expect(repository.findPublishedPageByHandle("store-a", "about")).resolves.toMatchObject({ id: "page-a", title: "About A" });
    await expect(repository.findPublishedPageByHandle("store-b", "about")).resolves.toMatchObject({ id: "page-b", title: "About B" });
    await expect(repository.findPublishedPageByHandle("store-a", "draft-page")).resolves.toBeNull();
    await expect(repository.findPublishedArticleByHandles("store-a", "news", "launch")).resolves.toMatchObject({ article: { id: "article-a" }, blog: { id: "blog-a" } });
    await expect(repository.findPublishedArticleByHandles("store-a", "other-blog", "launch")).resolves.toBeNull();
    await expect(repository.listPublishedArticles("store-a", "blog-a")).resolves.toMatchObject([{ id: "article-a" }, { id: "article-old" }]);
  });
});
