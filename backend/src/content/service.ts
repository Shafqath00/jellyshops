import type {
  ArticleRecord,
  BlogRecord,
  ContentDocument,
  ContentRepository,
  PageRecord,
  SeoFields,
  UpdateArticleRecordInput,
  UpdateBlogRecordInput,
  UpdatePageRecordInput,
} from "./repository.js";

export interface CreatePageInput extends Partial<SeoFields> {
  title: string;
  handle: string;
  content: ContentDocument;
  featuredMediaId?: string;
}

export interface UpdatePageInput {
  title?: string;
  handle?: string;
  content?: ContentDocument;
  featuredMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  socialMediaId?: string | null;
  noindex?: boolean;
  canonicalOverride?: string | null;
}

export interface CreateBlogInput {
  title: string;
  handle: string;
}

export interface UpdateBlogInput {
  title?: string;
  handle?: string;
}

export interface CreateArticleInput extends Partial<SeoFields> {
  blogId: string;
  title: string;
  handle: string;
  excerpt?: string;
  content: ContentDocument;
  featuredMediaId?: string;
}

export interface UpdateArticleInput {
  title?: string;
  handle?: string;
  excerpt?: string;
  content?: ContentDocument;
  featuredMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  socialMediaId?: string | null;
  noindex?: boolean;
  canonicalOverride?: string | null;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function handle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Content handle must use lowercase letters, numbers, and hyphens");
  }
  return normalized;
}

function content(value: ContentDocument): ContentDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Content document must be an object");
  }
  return structuredClone(value);
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.trim();
  return normalized || null;
}

function requireRecord<T>(record: T | null, label: string): T {
  if (!record) throw new Error(`${label} was not found`);
  return record;
}

export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getPage(storeId: string, id: string) {
    return this.repository.getPage(storeId, id);
  }

  listPages(storeId: string) {
    return this.repository.listPages(storeId);
  }

  async createPage(storeId: string, input: CreatePageInput): Promise<PageRecord> {
    return this.repository.createPage({
      storeId,
      title: requiredText(input.title, "Page title"),
      handle: handle(input.handle),
      content: content(input.content),
      ...(input.featuredMediaId ? { featuredMediaId: input.featuredMediaId.trim() } : {}),
      status: "DRAFT",
      publishedAt: null,
      ...(input.seoTitle ? { seoTitle: requiredText(input.seoTitle, "SEO title") } : {}),
      ...(input.seoDescription ? { seoDescription: requiredText(input.seoDescription, "SEO description") } : {}),
      ...(input.socialMediaId ? { socialMediaId: input.socialMediaId.trim() } : {}),
      noindex: input.noindex ?? false,
      ...(input.canonicalOverride ? { canonicalOverride: input.canonicalOverride.trim() } : {}),
    });
  }

  async updatePage(storeId: string, id: string, patch: UpdatePageInput): Promise<PageRecord> {
    const normalized: UpdatePageRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "Page title") } : {}),
      ...(patch.handle !== undefined ? { handle: handle(patch.handle) } : {}),
      ...(patch.content !== undefined ? { content: content(patch.content) } : {}),
      ...(patch.featuredMediaId !== undefined ? { featuredMediaId: optionalText(patch.featuredMediaId) ?? undefined } : {}),
      ...(patch.seoTitle !== undefined ? { seoTitle: optionalText(patch.seoTitle) ?? undefined } : {}),
      ...(patch.seoDescription !== undefined ? { seoDescription: optionalText(patch.seoDescription) ?? undefined } : {}),
      ...(patch.socialMediaId !== undefined ? { socialMediaId: optionalText(patch.socialMediaId) ?? undefined } : {}),
      ...(patch.noindex !== undefined ? { noindex: patch.noindex } : {}),
      ...(patch.canonicalOverride !== undefined ? { canonicalOverride: optionalText(patch.canonicalOverride) ?? undefined } : {}),
    };
    return requireRecord(await this.repository.updatePage(storeId, id, normalized), "Page");
  }

  async publishPage(storeId: string, id: string): Promise<PageRecord> {
    return requireRecord(await this.repository.updatePage(storeId, id, {
      status: "PUBLISHED",
      publishedAt: this.now(),
    }), "Page");
  }

  async unpublishPage(storeId: string, id: string): Promise<PageRecord> {
    return requireRecord(await this.repository.updatePage(storeId, id, {
      status: "DRAFT",
      publishedAt: null,
    }), "Page");
  }

  getBlog(storeId: string, id: string) {
    return this.repository.getBlog(storeId, id);
  }

  listBlogs(storeId: string) {
    return this.repository.listBlogs(storeId);
  }

  createBlog(storeId: string, input: CreateBlogInput): Promise<BlogRecord> {
    return this.repository.createBlog({
      storeId,
      title: requiredText(input.title, "Blog title"),
      handle: handle(input.handle),
    });
  }

  async updateBlog(storeId: string, id: string, patch: UpdateBlogInput): Promise<BlogRecord> {
    const normalized: UpdateBlogRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "Blog title") } : {}),
      ...(patch.handle !== undefined ? { handle: handle(patch.handle) } : {}),
    };
    return requireRecord(await this.repository.updateBlog(storeId, id, normalized), "Blog");
  }

  getArticle(storeId: string, id: string) {
    return this.repository.getArticle(storeId, id);
  }

  listArticles(storeId: string, blogId?: string) {
    return this.repository.listArticles(storeId, blogId);
  }

  async createArticle(storeId: string, input: CreateArticleInput): Promise<ArticleRecord> {
    const blogId = requiredText(input.blogId, "Blog id");
    if (!await this.repository.getBlog(storeId, blogId)) {
      throw new Error("Article blog was not found in this store");
    }
    return this.repository.createArticle({
      storeId,
      blogId,
      title: requiredText(input.title, "Article title"),
      handle: handle(input.handle),
      excerpt: input.excerpt?.trim() ?? "",
      content: content(input.content),
      ...(input.featuredMediaId ? { featuredMediaId: input.featuredMediaId.trim() } : {}),
      status: "DRAFT",
      publishedAt: null,
      ...(input.seoTitle ? { seoTitle: requiredText(input.seoTitle, "SEO title") } : {}),
      ...(input.seoDescription ? { seoDescription: requiredText(input.seoDescription, "SEO description") } : {}),
      ...(input.socialMediaId ? { socialMediaId: input.socialMediaId.trim() } : {}),
      noindex: input.noindex ?? false,
      ...(input.canonicalOverride ? { canonicalOverride: input.canonicalOverride.trim() } : {}),
    });
  }

  async updateArticle(storeId: string, id: string, patch: UpdateArticleInput): Promise<ArticleRecord> {
    const normalized: UpdateArticleRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "Article title") } : {}),
      ...(patch.handle !== undefined ? { handle: handle(patch.handle) } : {}),
      ...(patch.excerpt !== undefined ? { excerpt: patch.excerpt.trim() } : {}),
      ...(patch.content !== undefined ? { content: content(patch.content) } : {}),
      ...(patch.featuredMediaId !== undefined ? { featuredMediaId: optionalText(patch.featuredMediaId) ?? undefined } : {}),
      ...(patch.seoTitle !== undefined ? { seoTitle: optionalText(patch.seoTitle) ?? undefined } : {}),
      ...(patch.seoDescription !== undefined ? { seoDescription: optionalText(patch.seoDescription) ?? undefined } : {}),
      ...(patch.socialMediaId !== undefined ? { socialMediaId: optionalText(patch.socialMediaId) ?? undefined } : {}),
      ...(patch.noindex !== undefined ? { noindex: patch.noindex } : {}),
      ...(patch.canonicalOverride !== undefined ? { canonicalOverride: optionalText(patch.canonicalOverride) ?? undefined } : {}),
    };
    return requireRecord(await this.repository.updateArticle(storeId, id, normalized), "Article");
  }

  async publishArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return requireRecord(await this.repository.updateArticle(storeId, id, {
      status: "PUBLISHED",
      publishedAt: this.now(),
    }), "Article");
  }

  async unpublishArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return requireRecord(await this.repository.updateArticle(storeId, id, {
      status: "DRAFT",
      publishedAt: null,
    }), "Article");
  }
}
