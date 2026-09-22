export interface PublicPageRecord {
  id: string;
  handle: string;
  title: string;
  content: Record<string, unknown>;
  excerpt?: string;
  publishedAt: Date | null;
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
  findPublishedPageByHandle(storeId: string, handle: string): Promise<PublicPageRecord | null>;
  findBlogByHandle(storeId: string, handle: string): Promise<PublicBlogRecord | null>;
  listPublishedArticles(storeId: string, blogId: string): Promise<PublicArticleSummary[]>;
  findPublishedArticleByHandles(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null>;
}
