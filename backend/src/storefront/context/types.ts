/** What the merchant set for search engines on a page or post; empty values mean "use the defaults". */
export interface PublicSeoFields {
  title: string | null;
  description: string | null;
  /** Ask search engines not to list this page (and leave it out of the sitemap). */
  noindex: boolean;
  /** The page's own canonical address, when the merchant set one. */
  canonical: string | null;
  /** The page's sharing image, as a public media path. */
  imageUrl: string | null;
}

export interface PublicPageRecord {
  id: string;
  handle: string;
  title: string;
  content: Record<string, unknown>;
  excerpt?: string;
  publishedAt: Date | null;
  seo?: PublicSeoFields;
}

export interface PublicBlogRecord {
  id: string;
  handle: string;
  title: string;
}

export interface PublicArticleSummary {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
}

export interface PublicArticleRecord extends PublicArticleSummary {
  content: Record<string, unknown>;
  /** Who wrote it (shown by the theme); null when nobody is named. */
  authorName?: string | null;
  tags?: string[];
  seo?: PublicSeoFields;
}

export interface PublicSearchProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  imageUrl: string | null;
  priceMinor: number;
}

export interface SearchPageContext {
  type: "search";
  query: string;
  state: "empty" | "results" | "none";
  resultCount: number;
  results: PublicSearchProduct[];
}

export interface PagePageContext { type: "page"; page: PublicPageRecord; }
export interface BlogPageContext { type: "blog"; blog: PublicBlogRecord; articles: PublicArticleSummary[]; }
export interface ArticlePageContext { type: "article"; blog: PublicBlogRecord; article: PublicArticleRecord; }

export interface PublicStorefrontContextRepository {
  listNavigationResources?(storeId: string): Promise<Array<{ kind: "page" | "blog" | "article"; id: string; handle: string; blogHandle: string | null; noindex?: boolean; updatedAt?: string | null }>>;
  findPublishedPageByHandle(storeId: string, handle: string): Promise<PublicPageRecord | null>;
  findBlogByHandle(storeId: string, handle: string): Promise<PublicBlogRecord | null>;
  listPublishedArticles(storeId: string, blogId: string): Promise<PublicArticleSummary[]>;
  findPublishedArticleByHandles(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null>;
}
