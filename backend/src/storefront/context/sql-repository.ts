import type { QueryResultRow } from "pg";
import type { SqlExecutor } from "../../commerce/repository.js";
import type {
  ArticlePageContext,
  PublicArticleRecord,
  PublicArticleSummary,
  PublicBlogRecord,
  PublicPageRecord,
  PublicStorefrontContextRepository,
} from "./types.js";

type Row = QueryResultRow & Record<string, unknown>;
const date = (value: unknown): Date | null => value == null ? null : value instanceof Date ? value : new Date(String(value));
const page = (row: Row): PublicPageRecord => ({ id: String(row.id), handle: String(row.handle), title: String(row.title), content: structuredClone(row.content as Record<string, unknown>), publishedAt: date(row.publishedAt) });
const blog = (row: Row): PublicBlogRecord => ({ id: String(row.id), handle: String(row.handle), title: String(row.title) });
const summary = (row: Row): PublicArticleSummary => ({ id: String(row.id), handle: String(row.handle), title: String(row.title), excerpt: String(row.excerpt), publishedAt: date(row.publishedAt) });
const article = (row: Row): PublicArticleRecord => ({ ...summary(row), content: structuredClone(row.content as Record<string, unknown>) });

export class SqlPublicStorefrontContextRepository implements PublicStorefrontContextRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findPublishedPageByHandle(storeId: string, handle: string): Promise<PublicPageRecord | null> {
    const result = await this.sql.query<Row>(`SELECT "id", "handle", "title", "content", "publishedAt" FROM "StorePage" WHERE "storeId" = $1 AND "handle" = $2 AND "status" = 'PUBLISHED'`, [storeId, handle]);
    return result.rows[0] ? page(result.rows[0]) : null;
  }

  async findBlogByHandle(storeId: string, handle: string): Promise<PublicBlogRecord | null> {
    const result = await this.sql.query<Row>('SELECT "id", "handle", "title" FROM "Blog" WHERE "storeId" = $1 AND "handle" = $2', [storeId, handle]);
    return result.rows[0] ? blog(result.rows[0]) : null;
  }

  async listPublishedArticles(storeId: string, blogId: string): Promise<PublicArticleSummary[]> {
    const result = await this.sql.query<Row>(`SELECT "id", "handle", "title", "excerpt", "publishedAt" FROM "Article" WHERE "storeId" = $1 AND "blogId" = $2 AND "status" = 'PUBLISHED' ORDER BY "publishedAt" DESC NULLS LAST, "id" ASC`, [storeId, blogId]);
    return result.rows.map(summary);
  }

  async findPublishedArticleByHandles(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null> {
    const result = await this.sql.query<Row>(
      `SELECT blog."id" AS "blogId", blog."handle" AS "blogHandle", blog."title" AS "blogTitle", article."id", article."handle", article."title", article."excerpt", article."content", article."publishedAt"
       FROM "Article" article JOIN "Blog" blog ON blog."storeId" = article."storeId" AND blog."id" = article."blogId"
       WHERE article."storeId" = $1 AND blog."handle" = $2 AND article."handle" = $3 AND article."status" = 'PUBLISHED'`,
      [storeId, blogHandle, articleHandle],
    );
    const row = result.rows[0];
    return row ? { type: "article", blog: { id: String(row.blogId), handle: String(row.blogHandle), title: String(row.blogTitle) }, article: article(row) } : null;
  }
}
