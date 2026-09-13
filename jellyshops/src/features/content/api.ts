export interface SeoResourceFields {
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
}

export interface PageResource extends SeoResourceFields {
  id: string;
  storeId?: string;
  title: string;
  handle: string;
  content?: Record<string, unknown>;
  featuredMediaId?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
}

export interface BlogResource {
  id: string;
  storeId?: string;
  title: string;
  handle: string;
}

export interface ArticleResource extends SeoResourceFields {
  id: string;
  blogId: string;
  title: string;
  handle: string;
  excerpt: string;
  content?: Record<string, unknown>;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
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

export interface ContentApi {
  listPages(storeId: string): Promise<PageResource[]>;
  createPage(storeId: string, input: Omit<PageResource, "id" | "storeId" | "status" | "publishedAt"> & { content: Record<string, unknown> }): Promise<PageResource>;
  updatePage(storeId: string, pageId: string, patch: Partial<Omit<PageResource, "id" | "storeId" | "status" | "publishedAt">>): Promise<PageResource>;
  publishPage(storeId: string, pageId: string): Promise<PageResource>;
  unpublishPage(storeId: string, pageId: string): Promise<PageResource>;
  listBlogs(storeId: string): Promise<BlogResource[]>;
  createBlog(storeId: string, input: Omit<BlogResource, "id" | "storeId">): Promise<BlogResource>;
  listArticles(storeId: string, blogId?: string): Promise<ArticleResource[]>;
  listTemplates(storeId: string, type: ContentTemplate["type"]): Promise<ContentTemplate[]>;
  getAssignment(storeId: string, resourceType: TemplateAssignment["resourceType"], resourceId: string): Promise<TemplateAssignment | null>;
  assignTemplate(storeId: string, resourceType: TemplateAssignment["resourceType"], resourceId: string, templateId: string, expectedRevision: number | null): Promise<{ assignment: TemplateAssignment; generation: number }>;
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
    if (!response.ok) throw new Error(`Content request failed (${response.status})`);
    return await response.json() as T;
  };
  const content = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/content${suffix}`;
  const storefront = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/storefront${suffix}`;

  return {
    listPages: (storeId) => request(content(storeId, "/pages")),
    createPage: (storeId, input) => request(content(storeId, "/pages"), { method: "POST", body: JSON.stringify(input) }),
    updatePage: (storeId, pageId, patch) => request(content(storeId, `/pages/${encodeURIComponent(pageId)}`), { method: "PATCH", body: JSON.stringify(patch) }),
    publishPage: (storeId, pageId) => request(content(storeId, `/pages/${encodeURIComponent(pageId)}/publish`), { method: "POST" }),
    unpublishPage: (storeId, pageId) => request(content(storeId, `/pages/${encodeURIComponent(pageId)}/unpublish`), { method: "POST" }),
    listBlogs: (storeId) => request(content(storeId, "/blogs")),
    createBlog: (storeId, input) => request(content(storeId, "/blogs"), { method: "POST", body: JSON.stringify(input) }),
    listArticles: (storeId, blogId) => request(content(storeId, `/articles${blogId ? `?blogId=${encodeURIComponent(blogId)}` : ""}`)),
    listTemplates: (storeId, type) => request(storefront(storeId, `/templates?type=${encodeURIComponent(type)}`)),
    getAssignment: (storeId, resourceType, resourceId) => request(storefront(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`)),
    assignTemplate: (storeId, resourceType, resourceId, templateId, expectedRevision) => request(storefront(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`), {
      method: "PUT",
      body: JSON.stringify({ templateId, expectedRevision }),
    }),
  };
}
