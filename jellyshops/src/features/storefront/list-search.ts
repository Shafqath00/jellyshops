/** A server page's searchParams as an address query ("?sort=price-asc&f.size=king"), for product lists. */
export function searchFromParams(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  const text = search.toString();
  return text ? `?${text}` : "";
}
