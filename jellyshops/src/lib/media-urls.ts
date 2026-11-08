/** Resolve API-owned media at the read boundary, including URLs saved by old local servers. */
export function resolveMediaUrls<T>(value: T, baseUrl: string): T {
  const base = baseUrl.replace(/\/$/, "");
  function resolve(url: string): string {
    if (url.startsWith("/api/public/media/")) return `${base}${url}`;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)
        || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) return url;
      const start = parsed.pathname.indexOf("/api/public/media/");
      return start < 0 ? url : `${base}${parsed.pathname.slice(start)}${parsed.search}${parsed.hash}`;
    } catch {
      return url;
    }
  }
  function visit(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(Object.entries(input).map(([key, item]) => [key,
      typeof item === "string" && (key === "url" || key.endsWith("Url") || key === "imageSnapshot") ? resolve(item) : visit(item),
    ]));
  }
  return visit(value) as T;
}
