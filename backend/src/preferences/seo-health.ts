import { POLICY_KINDS, PREFERENCE_LIMITS, type PolicyKind, type PolicyState, type RawSeoCheck, type SeoCheckItem, type SeoItemKind, type StorePreferences } from "@jelly/storefront-schema";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";

export interface SeoHealthReport {
  checks: RawSeoCheck[];
  /** The state of the page each policy points at (for the setup checklist). */
  policies: Record<PolicyKind, PolicyState>;
  counts: { products: number; pages: number; posts: number; collections: number };
}

const SAMPLE = 10;
type Row = { id: string; label: string; n: number };

async function num(sql: SqlExecutor, query: string, storeId: string): Promise<number> {
  const result = await sql.query<{ n: number }>(query, [storeId]);
  return Number(result.rows[0]?.n ?? 0);
}

/** A few examples and the full count of rows a query would return (the query must select id, label and `n`). */
async function sample(sql: SqlExecutor, kind: SeoItemKind, query: string, storeId: string): Promise<{ count: number; items: SeoCheckItem[] }> {
  const result = await sql.query<Row>(`${query} LIMIT ${SAMPLE}`, [storeId]);
  return { count: Number(result.rows[0]?.n ?? 0), items: result.rows.map((row) => ({ kind, id: String(row.id), label: String(row.label) })) };
}

const check = (id: string, total: number, found: { count: number; items: SeoCheckItem[] }): RawSeoCheck => ({ id, total, count: found.count, items: found.items });

/**
 * Counts what is wrong with the catalogue and content for the SEO health check. Only live things are examined:
 * active products, published and not archived pages and posts. Nothing here changes data.
 */
export async function collectSeoHealth(db: CommerceDatabase, storeId: string, preferences: StorePreferences): Promise<SeoHealthReport> {
  return db.transaction(async (sql) => {
    const products = await num(sql, `SELECT count(*)::int AS n FROM "Product" WHERE "storeId" = $1 AND "status" = 'ACTIVE'`, storeId);
    const pages = await num(sql, `SELECT count(*)::int AS n FROM "StorePage" WHERE "storeId" = $1 AND "status" = 'PUBLISHED' AND "archivedAt" IS NULL AND "noindex" = false`, storeId);
    const posts = await num(sql, `SELECT count(*)::int AS n FROM "Article" WHERE "storeId" = $1 AND "status" = 'PUBLISHED' AND "archivedAt" IS NULL AND "noindex" = false`, storeId);
    const collections = await num(sql, `SELECT count(*)::int AS n FROM "Collection" WHERE "storeId" = $1`, storeId);
    const checks: RawSeoCheck[] = [];

    if (products > 0) {
      const active = `FROM "Product" WHERE "storeId" = $1 AND "status" = 'ACTIVE'`;
      checks.push(check("product-no-description", products, await sample(sql, "product",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n ${active} AND btrim("description") = '' AND btrim(coalesce("seoDescription", '')) = '' ORDER BY "title"`, storeId)));
      checks.push(check("product-no-photo", products, await sample(sql, "product",
        `SELECT p."id", p."title" AS label, count(*) OVER()::int AS n FROM "Product" p WHERE p."storeId" = $1 AND p."status" = 'ACTIVE'
         AND NOT EXISTS (SELECT 1 FROM "ProductMedia" pm WHERE pm."storeId" = p."storeId" AND pm."productId" = p."id") ORDER BY p."title"`, storeId)));
      // Photos with no description of their own or on the file itself. Counted per photo, listed per product.
      const photos = `FROM "Product" p JOIN "ProductMedia" pm ON pm."storeId" = p."storeId" AND pm."productId" = p."id"
        LEFT JOIN "Media" m ON m."storeId" = pm."storeId" AND m."id" = pm."mediaId"
        WHERE p."storeId" = $1 AND p."status" = 'ACTIVE'`;
      const missing = `btrim(coalesce(nullif(btrim(pm."altText"), ''), nullif(btrim(m."altText"), ''), '')) = ''`;
      const photoCounts = await sql.query<{ total: number; missing: number }>(`SELECT count(*)::int AS total, (count(*) FILTER (WHERE ${missing}))::int AS missing ${photos}`, [storeId]);
      const totalPhotos = Number(photoCounts.rows[0]?.total ?? 0);
      if (totalPhotos > 0) {
        const examples = await sql.query<{ id: string; label: string }>(`SELECT p."id", p."title" AS label ${photos} AND ${missing} GROUP BY p."id", p."title" ORDER BY p."title" LIMIT ${SAMPLE}`, [storeId]);
        checks.push({ id: "product-photo-alt", total: totalPhotos, count: Number(photoCounts.rows[0]?.missing ?? 0), items: examples.rows.map((row) => ({ kind: "product" as const, id: String(row.id), label: String(row.label) })) });
      }
      checks.push(check("product-duplicate-title", products, await sample(sql, "product",
        `WITH t AS (SELECT "id", "title", lower(btrim(coalesce(nullif(btrim("seoTitle"), ''), "title"))) AS eff ${active}),
              d AS (SELECT eff FROM t GROUP BY eff HAVING count(*) > 1)
         SELECT t."id", t."title" AS label, count(*) OVER()::int AS n FROM t JOIN d ON d.eff = t.eff ORDER BY t.eff, t."title"`, storeId)));
      checks.push(check("product-title-long", products, await sample(sql, "product",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n ${active} AND char_length("seoTitle") > ${PREFERENCE_LIMITS.homeTitle} ORDER BY "title"`, storeId)));
      checks.push(check("product-description-long", products, await sample(sql, "product",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n ${active} AND char_length("seoDescription") > ${PREFERENCE_LIMITS.homeDescription} ORDER BY "title"`, storeId)));
    }
    if (pages > 0) {
      checks.push(check("page-no-description", pages, await sample(sql, "page",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n FROM "StorePage" WHERE "storeId" = $1 AND "status" = 'PUBLISHED' AND "archivedAt" IS NULL AND "noindex" = false
         AND btrim(coalesce("seoDescription", '')) = '' ORDER BY "title"`, storeId)));
    }
    if (posts > 0) {
      checks.push(check("post-no-description", posts, await sample(sql, "post",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n FROM "Article" WHERE "storeId" = $1 AND "status" = 'PUBLISHED' AND "archivedAt" IS NULL AND "noindex" = false
         AND btrim(coalesce("seoDescription", '')) = '' AND btrim(coalesce("excerpt", '')) = '' ORDER BY "title"`, storeId)));
    }
    if (collections > 0) {
      checks.push(check("collection-no-description", collections, await sample(sql, "collection",
        `SELECT "id", "title" AS label, count(*) OVER()::int AS n FROM "Collection" WHERE "storeId" = $1 AND btrim("description") = '' ORDER BY "title"`, storeId)));
    }

    // The page each policy points at, as the setup checklist needs it.
    const handles = POLICY_KINDS.map((kind) => preferences.policies[kind]).filter(Boolean);
    const pageRows = handles.length
      ? (await sql.query<{ handle: string; status: string; archived: boolean }>(`SELECT "handle", "status"::text AS status, ("archivedAt" IS NOT NULL) AS archived FROM "StorePage" WHERE "storeId" = $1 AND "handle" = ANY($2::text[])`, [storeId, handles])).rows
      : [];
    const policies = Object.fromEntries(POLICY_KINDS.map((kind): [PolicyKind, PolicyState] => {
      const handle = preferences.policies[kind];
      if (!handle) return [kind, "unset"];
      const page = pageRows.find((row) => row.handle === handle);
      if (!page || page.archived) return [kind, "missing"];
      return [kind, page.status === "PUBLISHED" ? "published" : "draft"];
    })) as Record<PolicyKind, PolicyState>;

    return { checks, policies, counts: { products, pages, posts, collections } };
  });
}
