import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type {
  ArticleRecord,
  BlogRecord,
  ContentDocument,
  ContentRepository,
  CreateArticleRecordInput,
  CreateBlogRecordInput,
  CreatePageRecordInput,
  PageRecord,
  UpdateArticleRecordInput,
  UpdateBlogRecordInput,
  UpdatePageRecordInput,
} from "./repository.js";

function contentDocument(value: unknown): ContentDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Persisted content document must be an object");
  }
  return structuredClone(value as ContentDocument);
}

function mapPage(row: {
  id: string; storeId: string; title: string; handle: string; content: unknown;
  featuredMediaId: string | null; status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null; seoDescription: string | null; socialMediaId: string | null;
  noindex: boolean; canonicalOverride: string | null; publishedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): PageRecord {
  return { ...row, content: contentDocument(row.content) };
}

function mapBlog(row: {
  id: string; storeId: string; title: string; handle: string; createdAt: Date; updatedAt: Date;
}): BlogRecord {
  return { ...row };
}

function mapArticle(row: {
  id: string; storeId: string; blogId: string; title: string; handle: string; excerpt: string; content: unknown;
  featuredMediaId: string | null; status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null; seoDescription: string | null; socialMediaId: string | null;
  noindex: boolean; canonicalOverride: string | null; publishedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): ArticleRecord {
  return { ...row, content: contentDocument(row.content) };
}

function pageData(input: CreatePageRecordInput | UpdatePageRecordInput): Prisma.StorePageUncheckedCreateInput | Prisma.StorePageUncheckedUpdateInput {
  return {
    ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.handle !== undefined ? { handle: input.handle } : {}),
    ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
    ...(input.featuredMediaId !== undefined ? { featuredMediaId: input.featuredMediaId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
    ...(input.socialMediaId !== undefined ? { socialMediaId: input.socialMediaId } : {}),
    ...(input.noindex !== undefined ? { noindex: input.noindex } : {}),
    ...(input.canonicalOverride !== undefined ? { canonicalOverride: input.canonicalOverride } : {}),
    ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
  };
}

function articleData(input: CreateArticleRecordInput | UpdateArticleRecordInput): Prisma.ArticleUncheckedCreateInput | Prisma.ArticleUncheckedUpdateInput {
  return {
    ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
    ...(input.blogId !== undefined ? { blogId: input.blogId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.handle !== undefined ? { handle: input.handle } : {}),
    ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
    ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
    ...(input.featuredMediaId !== undefined ? { featuredMediaId: input.featuredMediaId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
    ...(input.socialMediaId !== undefined ? { socialMediaId: input.socialMediaId } : {}),
    ...(input.noindex !== undefined ? { noindex: input.noindex } : {}),
    ...(input.canonicalOverride !== undefined ? { canonicalOverride: input.canonicalOverride } : {}),
    ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
  };
}

export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly client: PrismaClient) {}

  async createPage(input: CreatePageRecordInput): Promise<PageRecord> {
    return mapPage(await this.client.storePage.create({ data: pageData(input) as Prisma.StorePageUncheckedCreateInput }));
  }

  async getPage(storeId: string, id: string): Promise<PageRecord | null> {
    const row = await this.client.storePage.findFirst({ where: { storeId, id } });
    return row ? mapPage(row) : null;
  }

  async listPages(storeId: string): Promise<PageRecord[]> {
    return (await this.client.storePage.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } })).map(mapPage);
  }

  async updatePage(storeId: string, id: string, patch: UpdatePageRecordInput): Promise<PageRecord | null> {
    const existing = await this.client.storePage.findFirst({ where: { storeId, id }, select: { id: true } });
    if (!existing) return null;
    return mapPage(await this.client.storePage.update({
      where: { id: existing.id },
      data: pageData(patch) as Prisma.StorePageUncheckedUpdateInput,
    }));
  }

  async createBlog(input: CreateBlogRecordInput): Promise<BlogRecord> {
    return mapBlog(await this.client.blog.create({ data: input }));
  }

  async getBlog(storeId: string, id: string): Promise<BlogRecord | null> {
    const row = await this.client.blog.findFirst({ where: { storeId, id } });
    return row ? mapBlog(row) : null;
  }

  async listBlogs(storeId: string): Promise<BlogRecord[]> {
    return (await this.client.blog.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } })).map(mapBlog);
  }

  async updateBlog(storeId: string, id: string, patch: UpdateBlogRecordInput): Promise<BlogRecord | null> {
    const existing = await this.client.blog.findFirst({ where: { storeId, id }, select: { id: true } });
    if (!existing) return null;
    return mapBlog(await this.client.blog.update({ where: { id: existing.id }, data: patch }));
  }

  async createArticle(input: CreateArticleRecordInput): Promise<ArticleRecord> {
    return mapArticle(await this.client.article.create({ data: articleData(input) as Prisma.ArticleUncheckedCreateInput }));
  }

  async getArticle(storeId: string, id: string): Promise<ArticleRecord | null> {
    const row = await this.client.article.findFirst({ where: { storeId, id } });
    return row ? mapArticle(row) : null;
  }

  async listArticles(storeId: string, blogId?: string): Promise<ArticleRecord[]> {
    return (await this.client.article.findMany({
      where: { storeId, ...(blogId ? { blogId } : {}) },
      orderBy: { createdAt: "asc" },
    })).map(mapArticle);
  }

  async updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput): Promise<ArticleRecord | null> {
    const existing = await this.client.article.findFirst({ where: { storeId, id }, select: { id: true } });
    if (!existing) return null;
    return mapArticle(await this.client.article.update({
      where: { id: existing.id },
      data: articleData(patch) as Prisma.ArticleUncheckedUpdateInput,
    }));
  }
}
