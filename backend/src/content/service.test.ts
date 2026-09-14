import { describe, expect, it } from "vitest";
import type {
  ArticleRecord,
  BlogRecord,
  ContentRepository,
  CreateArticleRecordInput,
  CreateBlogRecordInput,
  CreatePageRecordInput,
  PageRecord,
  UpdateArticleRecordInput,
  UpdateBlogRecordInput,
  UpdatePageRecordInput,
} from "./repository.js";
import { ContentService } from "./service.js";

class FakeContentRepository implements ContentRepository {
  pages = new Map<string, PageRecord>();
  blogs = new Map<string, BlogRecord>();
  articles = new Map<string, ArticleRecord>();

  async createPage(input: CreatePageRecordInput) {
    const record: PageRecord = { id: `page-${this.pages.size + 1}`, createdAt: new Date(0), updatedAt: new Date(0), ...input };
    this.pages.set(record.id, record);
    return structuredClone(record);
  }
  async getPage(storeId: string, id: string) {
    const record = this.pages.get(id);
    return record?.storeId === storeId ? structuredClone(record) : null;
  }
  async listPages(storeId: string) {
    return [...this.pages.values()].filter((page) => page.storeId === storeId).map((page) => structuredClone(page));
  }
  async updatePage(storeId: string, id: string, patch: UpdatePageRecordInput) {
    const current = this.pages.get(id);
    if (!current || current.storeId !== storeId) return null;
    const updated: PageRecord = { ...current, ...structuredClone(patch), id: current.id, storeId: current.storeId, updatedAt: new Date(1) };
    this.pages.set(id, updated);
    return structuredClone(updated);
  }

  async createBlog(input: CreateBlogRecordInput) {
    const record: BlogRecord = { id: `blog-${this.blogs.size + 1}`, createdAt: new Date(0), updatedAt: new Date(0), ...input };
    this.blogs.set(record.id, record);
    return structuredClone(record);
  }
  async getBlog(storeId: string, id: string) {
    const record = this.blogs.get(id);
    return record?.storeId === storeId ? structuredClone(record) : null;
  }
  async listBlogs(storeId: string) {
    return [...this.blogs.values()].filter((blog) => blog.storeId === storeId).map((blog) => structuredClone(blog));
  }
  async updateBlog(storeId: string, id: string, patch: UpdateBlogRecordInput) {
    const current = this.blogs.get(id);
    if (!current || current.storeId !== storeId) return null;
    const updated: BlogRecord = { ...current, ...structuredClone(patch), id: current.id, storeId: current.storeId, updatedAt: new Date(1) };
    this.blogs.set(id, updated);
    return structuredClone(updated);
  }

  async createArticle(input: CreateArticleRecordInput) {
    const record: ArticleRecord = { id: `article-${this.articles.size + 1}`, createdAt: new Date(0), updatedAt: new Date(0), ...input };
    this.articles.set(record.id, record);
    return structuredClone(record);
  }
  async getArticle(storeId: string, id: string) {
    const record = this.articles.get(id);
    return record?.storeId === storeId ? structuredClone(record) : null;
  }
  async listArticles(storeId: string, blogId?: string) {
    return [...this.articles.values()]
      .filter((article) => article.storeId === storeId && (!blogId || article.blogId === blogId))
      .map((article) => structuredClone(article));
  }
  async updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput) {
    const current = this.articles.get(id);
    if (!current || current.storeId !== storeId) return null;
    const updated: ArticleRecord = { ...current, ...structuredClone(patch), id: current.id, storeId: current.storeId, blogId: current.blogId, updatedAt: new Date(1) };
    this.articles.set(id, updated);
    return structuredClone(updated);
  }
}

describe("ContentService", () => {
  it("publishes and unpublishes a page without changing its content fields", async () => {
    const repository = new FakeContentRepository();
    const service = new ContentService(repository, () => new Date("2026-09-13T12:00:00Z"));
    const page = await service.createPage("store-a", {
      title: "About Us",
      handle: "about-us",
      content: { blocks: [{ type: "paragraph", text: "Hello" }] },
      seoTitle: "About Jelly",
      seoDescription: "About our shop",
      noindex: false,
    });

    const published = await service.publishPage("store-a", page.id);
    expect(published).toMatchObject({
      status: "PUBLISHED",
      seoTitle: "About Jelly",
      seoDescription: "About our shop",
      publishedAt: new Date("2026-09-13T12:00:00Z"),
    });

    const unpublished = await service.unpublishPage("store-a", page.id);
    expect(unpublished.status).toBe("DRAFT");
    expect(unpublished.publishedAt).toBeNull();
    expect(unpublished.content).toEqual(page.content);
  });

  it("publishes and unpublishes an article inside a same-store blog", async () => {
    const repository = new FakeContentRepository();
    const service = new ContentService(repository, () => new Date("2026-09-13T12:00:00Z"));
    const blog = await service.createBlog("store-a", { title: "News", handle: "news" });
    const article = await service.createArticle("store-a", {
      blogId: blog.id,
      title: "Opening Day",
      handle: "opening-day",
      excerpt: "We are open",
      content: { blocks: [] },
      seoTitle: "Opening Day",
      noindex: false,
    });

    await expect(service.publishArticle("store-a", article.id)).resolves.toMatchObject({ status: "PUBLISHED" });
    await expect(service.unpublishArticle("store-a", article.id)).resolves.toMatchObject({ status: "DRAFT", publishedAt: null });
  });

  it("rejects creating an article under a blog owned by another store", async () => {
    const repository = new FakeContentRepository();
    const service = new ContentService(repository);
    const blog = await service.createBlog("store-b", { title: "Other", handle: "other" });

    await expect(service.createArticle("store-a", {
      blogId: blog.id,
      title: "Wrong store",
      handle: "wrong-store",
      content: {},
      noindex: false,
    })).rejects.toThrow(/blog/i);
  });

  it("keeps handles stable unless explicitly edited and preserves SEO on content edits", async () => {
    const repository = new FakeContentRepository();
    const service = new ContentService(repository);
    const page = await service.createPage("store-a", {
      title: "FAQ",
      handle: "faq",
      content: {},
      seoTitle: "Frequently Asked Questions",
      seoDescription: "Answers",
      socialMediaId: "media-1",
      canonicalOverride: "https://example.test/pages/faq",
      noindex: false,
    });

    const updated = await service.updatePage("store-a", page.id, {
      title: "Help & FAQ",
      content: { blocks: [{ type: "faq" }] },
    });

    expect(updated.handle).toBe("faq");
    expect(updated).toMatchObject({
      seoTitle: "Frequently Asked Questions",
      seoDescription: "Answers",
      socialMediaId: "media-1",
      canonicalOverride: "https://example.test/pages/faq",
    });
  });

  it("can explicitly clear nullable SEO and media fields", async () => {
    const repository = new FakeContentRepository();
    const service = new ContentService(repository);
    const page = await service.createPage("store-a", {
      title: "Story",
      handle: "story",
      content: {},
      featuredMediaId: "media-1",
      seoTitle: "Story title",
      socialMediaId: "media-2",
    });

    const updated = await service.updatePage("store-a", page.id, {
      featuredMediaId: null,
      seoTitle: null,
      socialMediaId: null,
    });

    expect(updated).toMatchObject({ featuredMediaId: null, seoTitle: null, socialMediaId: null });
  });
});
