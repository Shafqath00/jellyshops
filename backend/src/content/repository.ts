export type ContentStatus = "DRAFT" | "PUBLISHED";
export type ContentDocument = Record<string, unknown>;

export interface SeoFields {
  seoTitle?: string;
  seoDescription?: string;
  socialMediaId?: string;
  noindex: boolean;
  canonicalOverride?: string;
}

export interface PageRecord extends SeoFields {
  id: string;
  storeId: string;
  title: string;
  handle: string;
  content: ContentDocument;
  featuredMediaId?: string;
  status: ContentStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogRecord {
  id: string;
  storeId: string;
  title: string;
  handle: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleRecord extends SeoFields {
  id: string;
  storeId: string;
  blogId: string;
  title: string;
  handle: string;
  excerpt: string;
  content: ContentDocument;
  featuredMediaId?: string;
  status: ContentStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePageRecordInput = Omit<PageRecord, "id" | "createdAt" | "updatedAt">;
export type CreateBlogRecordInput = Omit<BlogRecord, "id" | "createdAt" | "updatedAt">;
export type CreateArticleRecordInput = Omit<ArticleRecord, "id" | "createdAt" | "updatedAt">;

export type UpdatePageRecordInput = Partial<Omit<PageRecord, "id" | "storeId" | "createdAt" | "updatedAt">>;
export type UpdateBlogRecordInput = Partial<Omit<BlogRecord, "id" | "storeId" | "createdAt" | "updatedAt">>;
export type UpdateArticleRecordInput = Partial<Omit<ArticleRecord, "id" | "storeId" | "blogId" | "createdAt" | "updatedAt">>;

export interface ContentRepository {
  createPage(input: CreatePageRecordInput): Promise<PageRecord>;
  getPage(storeId: string, id: string): Promise<PageRecord | null>;
  listPages(storeId: string): Promise<PageRecord[]>;
  updatePage(storeId: string, id: string, patch: UpdatePageRecordInput): Promise<PageRecord | null>;

  createBlog(input: CreateBlogRecordInput): Promise<BlogRecord>;
  getBlog(storeId: string, id: string): Promise<BlogRecord | null>;
  listBlogs(storeId: string): Promise<BlogRecord[]>;
  updateBlog(storeId: string, id: string, patch: UpdateBlogRecordInput): Promise<BlogRecord | null>;

  createArticle(input: CreateArticleRecordInput): Promise<ArticleRecord>;
  getArticle(storeId: string, id: string): Promise<ArticleRecord | null>;
  listArticles(storeId: string, blogId?: string): Promise<ArticleRecord[]>;
  updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput): Promise<ArticleRecord | null>;
}
