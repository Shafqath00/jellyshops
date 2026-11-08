export interface NavigationResource { kind: "product" | "page" | "blog" | "article"; id: string; handle: string; blogHandle?: string | null }
export function createResourceLinks(storeSlug: string, resources: NavigationResource[]): Record<string, string> {
  const root = `/${encodeURIComponent(storeSlug)}`;
  return Object.fromEntries(resources.filter(item => item.handle && (item.kind !== "article" || item.blogHandle)).map(item => {
    const handle = encodeURIComponent(item.handle);
    const path = item.kind === "page" ? handle : item.kind === "product" ? `products/${handle}` : item.kind === "blog" ? `blogs/${handle}` : `blogs/${encodeURIComponent(item.blogHandle!)}/${handle}`;
    return [`${item.kind}:${item.id}`, `${root}/${path}`];
  }));
}
