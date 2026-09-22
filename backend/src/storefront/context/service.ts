import type { CatalogReader } from "../../catalog/service.js";
import type {
  ArticlePageContext,
  BlogPageContext,
  PagePageContext,
  PublicSearchProduct,
  PublicStorefrontContextRepository,
  SearchPageContext,
} from "./types.js";

function handle(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export class PublicStorefrontContextService {
  constructor(
    private readonly repository: PublicStorefrontContextRepository,
    private readonly catalog: Pick<CatalogReader, "listPublicProducts">,
  ) {}

  async search(storeId: string, value: string): Promise<SearchPageContext> {
    const query = value.trim();
    if (!query) return { type: "search", query: "", state: "empty", resultCount: 0, results: [] };
    const products = await this.catalog.listPublicProducts(storeId, { query, limit: 100 });
    const results: PublicSearchProduct[] = products.nodes.map((product) => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      imageUrl: product.media[0]?.url ?? null,
      priceMinor: product.priceRange?.minMinor ?? 0,
    }));
    return { type: "search", query, state: results.length ? "results" : "none", resultCount: results.length, results };
  }

  async page(storeId: string, value: string): Promise<PagePageContext | null> {
    const normalized = handle(value);
    if (!normalized) return null;
    const page = await this.repository.findPublishedPageByHandle(storeId, normalized);
    return page ? { type: "page", page } : null;
  }

  async blog(storeId: string, value: string): Promise<BlogPageContext | null> {
    const normalized = handle(value);
    if (!normalized) return null;
    const blog = await this.repository.findBlogByHandle(storeId, normalized);
    if (!blog) return null;
    return { type: "blog", blog, articles: await this.repository.listPublishedArticles(storeId, blog.id) };
  }

  article(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null> {
    const blog = handle(blogHandle);
    const article = handle(articleHandle);
    return blog && article ? this.repository.findPublishedArticleByHandles(storeId, blog, article) : Promise.resolve(null);
  }
}
