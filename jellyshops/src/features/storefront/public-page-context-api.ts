import { z } from "zod";

const searchContextSchema = z.object({
  type: z.literal("search"), query: z.string(), state: z.enum(["empty", "results", "none"]), resultCount: z.number().int().nonnegative(),
  results: z.array(z.object({ id: z.string(), handle: z.string(), title: z.string(), description: z.string(), imageUrl: z.string().nullable(), priceMinor: z.number() })),
});
const pageContextSchema = z.object({
  type: z.literal("page"),
  page: z.object({ id: z.string(), handle: z.string(), title: z.string(), content: z.record(z.string(), z.unknown()), publishedAt: z.string().nullable() }),
});
const blogContextSchema = z.object({
  type: z.literal("blog"),
  blog: z.object({ id: z.string(), handle: z.string(), title: z.string() }),
  articles: z.array(z.object({ id: z.string(), handle: z.string(), title: z.string(), excerpt: z.string(), publishedAt: z.string().nullable() })),
});

export type PublicSearchPageContext = z.infer<typeof searchContextSchema>;
export type PublicPageContext = z.infer<typeof pageContextSchema>;
export type PublicBlogContext = z.infer<typeof blogContextSchema>;

interface SearchOptions { baseUrl: string; storeId: string; query: string; fetch?: typeof fetch; }
interface PageOptions { baseUrl: string; storeId: string; handle: string; fetch?: typeof fetch; }
interface BlogOptions { baseUrl: string; storeId: string; handle: string; fetch?: typeof fetch; }

export async function loadPublicSearchPageContext({ baseUrl, storeId, query, fetch: fetcher = fetch }: SearchOptions): Promise<PublicSearchPageContext | null> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(storeId)}/storefront/context/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    const parsed = searchContextSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export async function loadPublicPageContext({ baseUrl, storeId, handle, fetch: fetcher = fetch }: PageOptions): Promise<PublicPageContext | null> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(storeId)}/storefront/context/pages/${encodeURIComponent(handle)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    const parsed = pageContextSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export async function loadPublicBlogContext({ baseUrl, storeId, handle, fetch: fetcher = fetch }: BlogOptions): Promise<PublicBlogContext | null> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(storeId)}/storefront/context/blogs/${encodeURIComponent(handle)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    const parsed = blogContextSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
