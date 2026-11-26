export interface SeoResourceFields {
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
}

/** What a merchant sees: archived wins, then published; a draft with a publish time is scheduled. */
export type ContentState = "published" | "draft" | "scheduled" | "archived";

/** Who wrote it and when it goes live (backend migration 20261126000000_content_management.sql). */
export interface ContentLifecycleFields {
  scheduledAt?: string | null;
  archivedAt?: string | null;
  authorUserId?: string | null;
  authorName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResource extends SeoResourceFields, ContentLifecycleFields {
  id: string;
  storeId?: string;
  title: string;
  handle: string;
  content?: Record<string, unknown>;
  featuredMediaId?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  showInNavigation?: boolean;
}

export interface BlogResource {
  id: string;
  storeId?: string;
  title: string;
  handle: string;
}

export interface ArticleResource extends SeoResourceFields, ContentLifecycleFields {
  id: string;
  blogId: string;
  title: string;
  handle: string;
  excerpt: string;
  content?: Record<string, unknown>;
  featuredMediaId?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  tags?: string[];
}

export interface ContentTemplate {
  id: string;
  name: string;
  type: "page" | "blog" | "article";
}

export interface TemplateAssignment {
  resourceType: "page" | "blog" | "article";
  resourceId: string;
  templateId: string;
  revision: number;
}

export type ContentSort = "updated" | "created" | "title" | "published";

export interface ContentListQuery {
  q?: string;
  state?: ContentState | "active" | "all";
  author?: string;
  tag?: string;
  blogId?: string;
  /** YYYY-MM-DD (inclusive). */
  updatedFrom?: string;
  updatedTo?: string;
  sort?: ContentSort;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ContentListResult<T> {
  items: T[];
  total: number;
  counts: Record<ContentState | "all" | "active", number>;
  facets?: { authors: Array<{ id: string; name: string }>; tags: string[] };
}

export interface HandleCheck {
  handle: string;
  available: boolean;
  suggestion: string;
}

export type BulkAction = "publish" | "unpublish" | "archive" | "restore" | "delete";

export interface BulkResult {
  done: string[];
  failed: Array<{ id: string; message: string }>;
}

/** Publish now, or at a time (ISO); neither leaves a draft. */
export interface PublishingInput {
  publish?: boolean;
  scheduledAt?: string | null;
}

type EditableSeo = Partial<SeoResourceFields> & { featuredMediaId?: string | null };

export type CreatePageInput = EditableSeo & PublishingInput & {
  title: string;
  handle?: string;
  content?: Record<string, unknown>;
  showInNavigation?: boolean;
  authorName?: string | null;
};
export type UpdatePageInput = EditableSeo & Partial<Pick<PageResource, "title" | "handle" | "content" | "showInNavigation" | "authorName">> & { scheduledAt?: string | null };

export type CreateArticleInput = EditableSeo & PublishingInput & {
  blogId: string;
  title: string;
  handle?: string;
  excerpt?: string;
  content?: Record<string, unknown>;
  tags?: string[];
  authorName?: string | null;
};
export type UpdateArticleInput = EditableSeo & Partial<Pick<ArticleResource, "title" | "handle" | "excerpt" | "content" | "tags" | "authorName" | "blogId">> & { scheduledAt?: string | null };

/** A failed request with the server's plain message (shown to the merchant as is) and its code. */
export class ContentRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly suggestion?: string) {
    super(message);
    this.name = "ContentRequestError";
  }
}

export interface ContentApi {
  listPages(storeId: string): Promise<PageResource[]>;
  browsePages(storeId: string, query?: ContentListQuery): Promise<ContentListResult<PageResource>>;
  getPage(storeId: string, pageId: string): Promise<PageResource>;
  checkPageHandle(storeId: string, handle: string, excludeId?: string): Promise<HandleCheck>;
  createPage(storeId: string, input: CreatePageInput): Promise<PageResource>;
  updatePage(storeId: string, pageId: string, patch: UpdatePageInput): Promise<PageResource>;
  publishPage(storeId: string, pageId: string): Promise<PageResource>;
  unpublishPage(storeId: string, pageId: string): Promise<PageResource>;
  schedulePage(storeId: string, pageId: string, scheduledAt: string): Promise<PageResource>;
  archivePage(storeId: string, pageId: string): Promise<PageResource>;
  restorePage(storeId: string, pageId: string): Promise<PageResource>;
  duplicatePage(storeId: string, pageId: string): Promise<PageResource>;
  deletePage(storeId: string, pageId: string): Promise<void>;
  bulkPages(storeId: string, action: BulkAction, ids: string[]): Promise<BulkResult>;

  listBlogs(storeId: string): Promise<BlogResource[]>;
  createBlog(storeId: string, input: { title: string; handle?: string }): Promise<BlogResource>;
  updateBlog(storeId: string, blogId: string, patch: { title?: string; handle?: string }): Promise<BlogResource>;
  deleteBlog(storeId: string, blogId: string): Promise<void>;

  listArticles(storeId: string, blogId?: string): Promise<ArticleResource[]>;
  browseArticles(storeId: string, query?: ContentListQuery): Promise<ContentListResult<ArticleResource>>;
  getArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  checkArticleHandle(storeId: string, blogId: string, handle: string, excludeId?: string): Promise<HandleCheck>;
  createArticle(storeId: string, input: CreateArticleInput): Promise<ArticleResource>;
  updateArticle(storeId: string, articleId: string, patch: UpdateArticleInput): Promise<ArticleResource>;
  publishArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  unpublishArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  scheduleArticle(storeId: string, articleId: string, scheduledAt: string): Promise<ArticleResource>;
  archiveArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  restoreArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  duplicateArticle(storeId: string, articleId: string): Promise<ArticleResource>;
  deleteArticle(storeId: string, articleId: string): Promise<void>;
  bulkArticles(storeId: string, action: BulkAction, ids: string[]): Promise<BulkResult>;

  /** Pasted or typed HTML as a safe rich text document (cleaned on the server). */
  importHtml(storeId: string, html: string): Promise<Record<string, unknown>>;
  listTemplates(storeId: string, type: ContentTemplate["type"]): Promise<ContentTemplate[]>;
  getAssignment(storeId: string, resourceType: TemplateAssignment["resourceType"], resourceId: string): Promise<TemplateAssignment | null>;
  assignTemplate(storeId: string, resourceType: TemplateAssignment["resourceType"], resourceId: string, templateId: string, expectedRevision: number | null): Promise<{ assignment: TemplateAssignment; generation: number }>;
}

/** Same rule as the backend, for showing a state before the next reload. */
export function contentState(item: { status?: "DRAFT" | "PUBLISHED"; scheduledAt?: string | null; archivedAt?: string | null }): ContentState {
  if (item.archivedAt) return "archived";
  if (item.status === "PUBLISHED") return "published";
  return item.scheduledAt ? "scheduled" : "draft";
}

function queryString(query: ContentListQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function createContentApi({
  baseUrl,
  token,
  fetch: fetcher = fetch,
}: {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
}): ContentApi {
  const origin = baseUrl.replace(/\/$/, "");
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetcher(`${origin}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; issues?: Array<{ path?: string; message?: string }> } } | null;
      const suggestion = body?.error?.code === "CONTENT_HANDLE_TAKEN" ? body.error.issues?.find((issue) => issue.path === "handle")?.message : undefined;
      throw new ContentRequestError(body?.error?.message ?? `Something went wrong (${response.status}). Try again.`, response.status, body?.error?.code, suggestion);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  };
  const content = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/content${suffix}`;
  const storefront = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/storefront${suffix}`;
  const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const page = (storeId: string, pageId: string, suffix = "") => content(storeId, `/pages/${encodeURIComponent(pageId)}${suffix}`);
  const article = (storeId: string, articleId: string, suffix = "") => content(storeId, `/articles/${encodeURIComponent(articleId)}${suffix}`);

  return {
    listPages: (storeId) => request(content(storeId, "/pages")),
    browsePages: (storeId, query) => request(content(storeId, `/pages/browse${queryString(query)}`)),
    getPage: (storeId, pageId) => request(page(storeId, pageId)),
    checkPageHandle: (storeId, handle, excludeId) => request(content(storeId, `/pages/handle-check${queryString({ handle, excludeId } as ContentListQuery)}`)),
    createPage: (storeId, input) => post(content(storeId, "/pages"), input),
    updatePage: (storeId, pageId, patch) => request(page(storeId, pageId), { method: "PATCH", body: JSON.stringify(patch) }),
    publishPage: (storeId, pageId) => post(page(storeId, pageId, "/publish")),
    unpublishPage: (storeId, pageId) => post(page(storeId, pageId, "/unpublish")),
    schedulePage: (storeId, pageId, scheduledAt) => post(page(storeId, pageId, "/schedule"), { scheduledAt }),
    archivePage: (storeId, pageId) => post(page(storeId, pageId, "/archive")),
    restorePage: (storeId, pageId) => post(page(storeId, pageId, "/restore")),
    duplicatePage: (storeId, pageId) => post(page(storeId, pageId, "/duplicate")),
    deletePage: (storeId, pageId) => request(page(storeId, pageId), { method: "DELETE" }),
    bulkPages: (storeId, action, ids) => post(content(storeId, "/pages/bulk"), { action, ids }),

    listBlogs: (storeId) => request(content(storeId, "/blogs")),
    createBlog: (storeId, input) => post(content(storeId, "/blogs"), input),
    updateBlog: (storeId, blogId, patch) => request(content(storeId, `/blogs/${encodeURIComponent(blogId)}`), { method: "PATCH", body: JSON.stringify(patch) }),
    deleteBlog: (storeId, blogId) => request(content(storeId, `/blogs/${encodeURIComponent(blogId)}`), { method: "DELETE" }),

    listArticles: (storeId, blogId) => request(content(storeId, `/articles${blogId ? `?blogId=${encodeURIComponent(blogId)}` : ""}`)),
    browseArticles: (storeId, query) => request(content(storeId, `/articles/browse${queryString(query)}`)),
    getArticle: (storeId, articleId) => request(article(storeId, articleId)),
    checkArticleHandle: (storeId, blogId, handle, excludeId) => request(content(storeId, `/articles/handle-check${queryString({ handle, blogId, excludeId } as ContentListQuery)}`)),
    createArticle: (storeId, input) => post(content(storeId, "/articles"), input),
    updateArticle: (storeId, articleId, patch) => request(article(storeId, articleId), { method: "PATCH", body: JSON.stringify(patch) }),
    publishArticle: (storeId, articleId) => post(article(storeId, articleId, "/publish")),
    unpublishArticle: (storeId, articleId) => post(article(storeId, articleId, "/unpublish")),
    scheduleArticle: (storeId, articleId, scheduledAt) => post(article(storeId, articleId, "/schedule"), { scheduledAt }),
    archiveArticle: (storeId, articleId) => post(article(storeId, articleId, "/archive")),
    restoreArticle: (storeId, articleId) => post(article(storeId, articleId, "/restore")),
    duplicateArticle: (storeId, articleId) => post(article(storeId, articleId, "/duplicate")),
    deleteArticle: (storeId, articleId) => request(article(storeId, articleId), { method: "DELETE" }),
    bulkArticles: (storeId, action, ids) => post(content(storeId, "/articles/bulk"), { action, ids }),

    importHtml: async (storeId, html) => (await post<{ document: Record<string, unknown> }>(content(storeId, "/import-html"), { html })).document,
    listTemplates: (storeId, type) => request(storefront(storeId, `/templates?type=${encodeURIComponent(type)}`)),
    getAssignment: (storeId, resourceType, resourceId) => request(storefront(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`)),
    assignTemplate: (storeId, resourceType, resourceId, templateId, expectedRevision) => request(storefront(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`), {
      method: "PUT",
      body: JSON.stringify({ templateId, expectedRevision }),
    }),
  };
}
