import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { SqlExecutor } from "../commerce/repository.js";
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

type Row = QueryResultRow & Record<string, unknown>;

export interface SqlContentRepositoryDependencies {
  id?: () => string;
  now?: () => Date;
}

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function page(row: Row): PageRecord {
  return {
    id: String(row.id), storeId: String(row.storeId), title: String(row.title), handle: String(row.handle),
    content: structuredClone(row.content as PageRecord["content"]),
    featuredMediaId: row.featuredMediaId == null ? null : String(row.featuredMediaId),
    status: String(row.status) as PageRecord["status"],
    publishedAt: row.publishedAt == null ? null : date(row.publishedAt),
    seoTitle: row.seoTitle == null ? null : String(row.seoTitle),
    seoDescription: row.seoDescription == null ? null : String(row.seoDescription),
    socialMediaId: row.socialMediaId == null ? null : String(row.socialMediaId),
    noindex: Boolean(row.noindex),
    canonicalOverride: row.canonicalOverride == null ? null : String(row.canonicalOverride),
    createdAt: date(row.createdAt), updatedAt: date(row.updatedAt),
  };
}

function blog(row: Row): BlogRecord {
  return { id: String(row.id), storeId: String(row.storeId), title: String(row.title), handle: String(row.handle), createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) };
}

function article(row: Row): ArticleRecord {
  return {
    id: String(row.id), storeId: String(row.storeId), blogId: String(row.blogId), title: String(row.title), handle: String(row.handle), excerpt: String(row.excerpt),
    content: structuredClone(row.content as ArticleRecord["content"]),
    featuredMediaId: row.featuredMediaId == null ? null : String(row.featuredMediaId),
    status: String(row.status) as ArticleRecord["status"],
    publishedAt: row.publishedAt == null ? null : date(row.publishedAt),
    seoTitle: row.seoTitle == null ? null : String(row.seoTitle),
    seoDescription: row.seoDescription == null ? null : String(row.seoDescription),
    socialMediaId: row.socialMediaId == null ? null : String(row.socialMediaId),
    noindex: Boolean(row.noindex),
    canonicalOverride: row.canonicalOverride == null ? null : String(row.canonicalOverride),
    createdAt: date(row.createdAt), updatedAt: date(row.updatedAt),
  };
}

export class SqlContentRepository implements ContentRepository {
  private readonly id: () => string;
  private readonly now: () => Date;

  constructor(private readonly sql: SqlExecutor, dependencies: SqlContentRepositoryDependencies = {}) {
    this.id = dependencies.id ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date());
  }

  async createPage(input: CreatePageRecordInput): Promise<PageRecord> {
    const result = await this.sql.query<Row>(
      `INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "featuredMediaId", "status", "publishedAt", "seoTitle", "seoDescription", "socialMediaId", "noindex", "canonicalOverride", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::"ContentStatus", $8, $9, $10, $11, $12, $13, $14, $14) RETURNING *`,
      [this.id(), input.storeId, input.title, input.handle, JSON.stringify(input.content), input.featuredMediaId, input.status, input.publishedAt, input.seoTitle, input.seoDescription, input.socialMediaId, input.noindex, input.canonicalOverride, this.now()],
    );
    return page(result.rows[0]);
  }

  async getPage(storeId: string, id: string): Promise<PageRecord | null> {
    const result = await this.sql.query<Row>('SELECT * FROM "StorePage" WHERE "storeId" = $1 AND "id" = $2', [storeId, id]);
    return result.rows[0] ? page(result.rows[0]) : null;
  }

  async listPages(storeId: string): Promise<PageRecord[]> {
    const result = await this.sql.query<Row>('SELECT * FROM "StorePage" WHERE "storeId" = $1 ORDER BY "id"', [storeId]);
    return result.rows.map(page);
  }

  async updatePage(storeId: string, id: string, patch: UpdatePageRecordInput): Promise<PageRecord | null> {
    const result = await this.update("StorePage", storeId, id, patch);
    return result ? page(result) : null;
  }

  async createBlog(input: CreateBlogRecordInput): Promise<BlogRecord> {
    const now = this.now();
    const result = await this.sql.query<Row>(
      'INSERT INTO "Blog" ("id", "storeId", "title", "handle", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5) RETURNING *',
      [this.id(), input.storeId, input.title, input.handle, now],
    );
    return blog(result.rows[0]);
  }

  async getBlog(storeId: string, id: string): Promise<BlogRecord | null> {
    const result = await this.sql.query<Row>('SELECT * FROM "Blog" WHERE "storeId" = $1 AND "id" = $2', [storeId, id]);
    return result.rows[0] ? blog(result.rows[0]) : null;
  }

  async listBlogs(storeId: string): Promise<BlogRecord[]> {
    const result = await this.sql.query<Row>('SELECT * FROM "Blog" WHERE "storeId" = $1 ORDER BY "id"', [storeId]);
    return result.rows.map(blog);
  }

  async updateBlog(storeId: string, id: string, patch: UpdateBlogRecordInput): Promise<BlogRecord | null> {
    const result = await this.update("Blog", storeId, id, patch);
    return result ? blog(result) : null;
  }

  async createArticle(input: CreateArticleRecordInput): Promise<ArticleRecord> {
    const result = await this.sql.query<Row>(
      `INSERT INTO "Article" ("id", "storeId", "blogId", "title", "handle", "excerpt", "content", "featuredMediaId", "status", "publishedAt", "seoTitle", "seoDescription", "socialMediaId", "noindex", "canonicalOverride", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::"ContentStatus", $10, $11, $12, $13, $14, $15, $16, $16) RETURNING *`,
      [this.id(), input.storeId, input.blogId, input.title, input.handle, input.excerpt, JSON.stringify(input.content), input.featuredMediaId, input.status, input.publishedAt, input.seoTitle, input.seoDescription, input.socialMediaId, input.noindex, input.canonicalOverride, this.now()],
    );
    return article(result.rows[0]);
  }

  async getArticle(storeId: string, id: string): Promise<ArticleRecord | null> {
    const result = await this.sql.query<Row>('SELECT * FROM "Article" WHERE "storeId" = $1 AND "id" = $2', [storeId, id]);
    return result.rows[0] ? article(result.rows[0]) : null;
  }

  async listArticles(storeId: string, blogId?: string): Promise<ArticleRecord[]> {
    const result = await this.sql.query<Row>(
      blogId
        ? 'SELECT * FROM "Article" WHERE "storeId" = $1 AND "blogId" = $2 ORDER BY "id"'
        : 'SELECT * FROM "Article" WHERE "storeId" = $1 ORDER BY "id"',
      blogId ? [storeId, blogId] : [storeId],
    );
    return result.rows.map(article);
  }

  async updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput): Promise<ArticleRecord | null> {
    const result = await this.update("Article", storeId, id, patch);
    return result ? article(result) : null;
  }

  private async update(table: "StorePage" | "Blog" | "Article", storeId: string, id: string, patch: Record<string, unknown>): Promise<Row | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      values.push(key === "content" ? JSON.stringify(value) : value);
      const parameter = `$${values.length}`;
      const cast = key === "content" ? "::jsonb" : key === "status" ? '::"ContentStatus"' : "";
      fields.push(`"${key}" = ${parameter}${cast}`);
    }
    if (!fields.length) return this.select(table, storeId, id);
    values.push(this.now(), storeId, id);
    const result = await this.sql.query<Row>(
      `UPDATE "${table}" SET ${fields.join(", ")}, "updatedAt" = $${values.length - 2} WHERE "storeId" = $${values.length - 1} AND "id" = $${values.length} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  }

  private async select(table: "StorePage" | "Blog" | "Article", storeId: string, id: string): Promise<Row | null> {
    const result = await this.sql.query<Row>(`SELECT * FROM "${table}" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id]);
    return result.rows[0] ?? null;
  }
}
