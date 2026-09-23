import type { SqlExecutor } from "../commerce/repository.js";

type ReferenceSource = "template" | "global" | "publication";

function containsMediaReference(value: unknown, mediaId: string, seen = new Set<unknown>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsMediaReference(item, mediaId, seen));
  const record = value as Record<string, unknown>;
  const mediaObject = record.id === mediaId
    && typeof record.url === "string"
    && (record.type === "media" || "alt" in record || "focalPoint" in record);
  return mediaObject || Object.values(record).some((item) => containsMediaReference(item, mediaId, seen));
}

export function createStorefrontMediaReferenceReader(sql: SqlExecutor): (storeId: string, mediaId: string) => Promise<boolean> {
  return async (storeId, mediaId) => {
    const sources: Array<{ kind: ReferenceSource; query: string }> = [
      { kind: "template", query: `SELECT "layout" AS value FROM "StorefrontTemplate" WHERE "storeId" = $1` },
      { kind: "global", query: `SELECT "section" AS value FROM "GlobalSection" WHERE "storeId" = $1` },
      { kind: "publication", query: `SELECT "document" AS value FROM "StorefrontPublication" WHERE "storeId" = $1` },
    ];
    const results = await Promise.all(sources.map(({ query }) => sql.query<{ value: unknown }>(query, [storeId])));
    return results.some(({ rows }) => rows.some(({ value }) => containsMediaReference(value, mediaId)));
  };
}
