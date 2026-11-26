export type ContentStatus = "DRAFT" | "PUBLISHED";
export type ContentDocument = Record<string, unknown>;

/**
 * What a merchant sees for a page or post, worked out from the stored columns:
 * archived wins, then published, then a draft with a publish time is scheduled, else draft.
 */
export type ContentState = "published" | "draft" | "scheduled" | "archived";

export interface SeoFields {
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
}

/** Shared by pages and posts (migration 20261126000000_content_management.sql). */
export interface ContentLifecycle {
  scheduledAt: Date | null;
  archivedAt: Date | null;
  authorUserId: string | null;
  authorName: string | null;
}

export interface PageRecord extends SeoFields, ContentLifecycle {
  id: string;
  storeId: string;
  title: string;
  handle: string;
  content: ContentDocument;
  featuredMediaId: string | null;
  status: ContentStatus;
  publishedAt: Date | null;
  showInNavigation: boolean;
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

export interface ArticleRecord extends SeoFields, ContentLifecycle {
  id: string;
  storeId: string;
  blogId: string;
  title: string;
  handle: string;
  excerpt: string;
  content: ContentDocument;
  featuredMediaId: string | null;
  status: ContentStatus;
  publishedAt: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ContentResourceType = "page" | "blog" | "article";

export interface ContentRedirectRecord {
  storeId: string;
  fromPath: string;
  resourceType: ContentResourceType;
  resourceId: string;
}

/** A scheduled item the job published. */
export interface ScheduledPublication {
  storeId: string;
  resourceType: "page" | "article";
  id: string;
}

export type CreatePageRecordInput = Omit<PageRecord, "id" | "createdAt" | "updatedAt">;
export type CreateBlogRecordInput = Omit<BlogRecord, "id" | "createdAt" | "updatedAt">;
export type CreateArticleRecordInput = Omit<ArticleRecord, "id" | "createdAt" | "updatedAt">;

export type UpdatePageRecordInput = Partial<Omit<PageRecord, "id" | "storeId" | "createdAt" | "updatedAt">>;
export type UpdateBlogRecordInput = Partial<Omit<BlogRecord, "id" | "storeId" | "createdAt" | "updatedAt">>;
export type UpdateArticleRecordInput = Partial<Omit<ArticleRecord, "id" | "storeId" | "createdAt" | "updatedAt">>;

export interface ContentRepository {
  createPage(input: CreatePageRecordInput): Promise<PageRecord>;
  getPage(storeId: string, id: string): Promise<PageRecord | null>;
  listPages(storeId: string): Promise<PageRecord[]>;
  updatePage(storeId: string, id: string, patch: UpdatePageRecordInput): Promise<PageRecord | null>;
  deletePage(storeId: string, id: string): Promise<boolean>;

  createBlog(input: CreateBlogRecordInput): Promise<BlogRecord>;
  getBlog(storeId: string, id: string): Promise<BlogRecord | null>;
  listBlogs(storeId: string): Promise<BlogRecord[]>;
  updateBlog(storeId: string, id: string, patch: UpdateBlogRecordInput): Promise<BlogRecord | null>;
  /** Removes an empty blog; false when it does not exist. Callers check it has no posts first. */
  deleteBlog(storeId: string, id: string): Promise<boolean>;

  createArticle(input: CreateArticleRecordInput): Promise<ArticleRecord>;
  getArticle(storeId: string, id: string): Promise<ArticleRecord | null>;
  listArticles(storeId: string, blogId?: string): Promise<ArticleRecord[]>;
  updateArticle(storeId: string, id: string, patch: UpdateArticleRecordInput): Promise<ArticleRecord | null>;
  deleteArticle(storeId: string, id: string): Promise<boolean>;

  /** Points an old address at an item (replacing what that address pointed at before). */
  saveRedirect(redirect: ContentRedirectRecord): Promise<void>;
  /** Forgets an old address, used when a new item takes that address for itself. */
  removeRedirect(storeId: string, fromPath: string): Promise<void>;
  findRedirect(storeId: string, fromPath: string): Promise<ContentRedirectRecord | null>;
  removeRedirectsFor(storeId: string, resourceType: ContentResourceType, resourceId: string): Promise<void>;

  /** Publishes every draft whose publish time has passed (all stores) and returns what it published. */
  publishDue(now: Date): Promise<ScheduledPublication[]>;
}
