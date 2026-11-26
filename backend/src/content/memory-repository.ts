/** An in-memory content repository for tests and local runs without a database. Behaves like the SQL one. */
import type {
  ArticleRecord,
  BlogRecord,
  ContentRedirectRecord,
  ContentRepository,
  ContentResourceType,
  CreateArticleRecordInput,
  CreateBlogRecordInput,
  CreatePageRecordInput,
  PageRecord,
  ScheduledPublication,
  UpdateArticleRecordInput,
  UpdateBlogRecordInput,
  UpdatePageRecordInput,
} from "./repository.js";

function uniqueViolation(): Error {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
}

export class MemoryContentRepository implements ContentRepository {
  readonly pages = new Map<string, PageRecord>();
  readonly blogs = new Map<string, BlogRecord>();
  readonly articles = new Map<string, ArticleRecord>();
  readonly redirects = new Map<string, ContentRedirectRecord>();
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  private next(prefix: string): string { this.sequence++; return `${prefix}-${this.sequence}`; }
  private tick(): Date { return new Date(this.now().getTime() + this.sequence++); }

  async createPage(input: CreatePageRecordInput) {
    if ([...this.pages.values()].some((page) => page.storeId === input.storeId && page.handle === input.handle)) throw uniqueViolation();
    const at = this.tick();
    const record: PageRecord = { ...structuredClone(input), id: this.next("page"), createdAt: at, updatedAt: at };
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
    if (patch.handle && [...this.pages.values()].some((page) => page.storeId === storeId && page.id !== id && page.handle === patch.handle)) throw uniqueViolation();
    const updated: PageRecord = { ...current, ...structuredClone(patch), id, storeId, updatedAt: this.tick() };
    this.pages.set(id, updated);
    return structuredClone(updated);
  }
  async deletePage(storeId: string, id: string) {
    if (this.pages.get(id)?.storeId !== storeId) return false;
    this.pages.delete(id);
    await this.removeRedirectsFor(storeId, "page", id);
    return true;
  }

  async createBlog(input: CreateBlogRecordInput) {
    if ([...this.blogs.values()].some((blog) => blog.storeId === input.storeId && blog.handle === input.handle)) throw uniqueViolation();
    const at = this.tick();
    const record: BlogRecord = { ...structuredClone(input), id: this.next("blog"), createdAt: at, updatedAt: at };
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
    const updated: BlogRecord = { ...current, ...structuredClone(patch), id, storeId, updatedAt: this.tick() };
    this.blogs.set(id, updated);
    return structuredClone(updated);
  }
  async deleteBlog(storeId: string, id: string) {
    if (this.blogs.get(id)?.storeId !== storeId) return false;
    this.blogs.delete(id);
    await this.removeRedirectsFor(storeId, "blog", id);
    return true;
  }

  async createArticle(input: CreateArticleRecordInput) {
    if ([...this.articles.values()].some((post) => post.storeId === input.storeId && post.blogId === input.blogId && post.handle === input.handle)) throw uniqueViolation();
    const at = this.tick();
    const record: ArticleRecord = { ...structuredClone(input), id: this.next("article"), createdAt: at, updatedAt: at };
    this.articles.set(record.id, record);
    return structuredClone(record);
  }
  async getArticle(storeId: string, id: string) {
    const record = this.articles.get(id);
    return record?.storeId === storeId ? structuredClone(record) : null;
  }
  async listArticles(storeId: string, blogId?: string) {
    return [...this.articles.values()]
      .filter((post) => post.storeId === storeId && (!blogId || post.blogId === blogId))
      .map((post) => structuredClone(post));
  }
  async updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput) {
    const current = this.articles.get(id);
    if (!current || current.storeId !== storeId) return null;
    const updated: ArticleRecord = { ...current, ...structuredClone(patch), id, storeId, updatedAt: this.tick() };
    if ([...this.articles.values()].some((post) => post.storeId === storeId && post.id !== id && post.blogId === updated.blogId && post.handle === updated.handle)) throw uniqueViolation();
    this.articles.set(id, updated);
    return structuredClone(updated);
  }
  async deleteArticle(storeId: string, id: string) {
    if (this.articles.get(id)?.storeId !== storeId) return false;
    this.articles.delete(id);
    await this.removeRedirectsFor(storeId, "article", id);
    return true;
  }

  async saveRedirect(redirect: ContentRedirectRecord) {
    this.redirects.set(`${redirect.storeId} ${redirect.fromPath}`, structuredClone(redirect));
  }
  async removeRedirect(storeId: string, fromPath: string) {
    this.redirects.delete(`${storeId} ${fromPath}`);
  }
  async findRedirect(storeId: string, fromPath: string) {
    const found = this.redirects.get(`${storeId} ${fromPath}`);
    return found ? structuredClone(found) : null;
  }
  async removeRedirectsFor(storeId: string, resourceType: ContentResourceType, resourceId: string) {
    for (const [key, redirect] of this.redirects) {
      if (redirect.storeId === storeId && redirect.resourceType === resourceType && redirect.resourceId === resourceId) this.redirects.delete(key);
    }
  }

  async publishDue(now: Date) {
    const published: ScheduledPublication[] = [];
    const due = (record: PageRecord | ArticleRecord) => record.status === "DRAFT" && !record.archivedAt && record.scheduledAt && record.scheduledAt <= now;
    for (const page of this.pages.values()) {
      if (!due(page)) continue;
      this.pages.set(page.id, { ...page, status: "PUBLISHED", publishedAt: page.scheduledAt, scheduledAt: null, updatedAt: now });
      published.push({ storeId: page.storeId, resourceType: "page", id: page.id });
    }
    for (const post of this.articles.values()) {
      if (!due(post)) continue;
      this.articles.set(post.id, { ...post, status: "PUBLISHED", publishedAt: post.scheduledAt, scheduledAt: null, updatedAt: now });
      published.push({ storeId: post.storeId, resourceType: "article", id: post.id });
    }
    return published;
  }
}
