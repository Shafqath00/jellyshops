import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { storeCacheTag, storefrontCacheTag } from "@/features/storefront/storefront-cache";

/**
 * `POST /api/revalidate` with `{ storeId?, slug? }` and `Authorization: Bearer <STOREFRONT_REVALIDATE_SECRET>`.
 *
 * The backend calls this after a merchant changes something shoppers see (publish, products, collections, pages,
 * menus, password, stock after an order). Every cached page of that store is rebuilt on its next visit; the stale
 * copy is never shown again (`expire: 0`), so a merchant sees their change on the next page load.
 */
const MAX_TAG_PART = 200;

function authorised(request: Request): boolean {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const validPart = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= MAX_TAG_PART && /^[\w-]+$/.test(value);

export async function POST(request: Request) {
  if (!process.env.STOREFRONT_REVALIDATE_SECRET) return NextResponse.json({ error: "Refreshing is not set up on this server." }, { status: 503 });
  if (!authorised(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const body = await request.json().catch(() => null) as { storeId?: unknown; slug?: unknown } | null;
  const tags = [
    ...(validPart(body?.storeId) ? [storeCacheTag(body.storeId)] : []),
    ...(validPart(body?.slug) ? [storefrontCacheTag(body.slug)] : []),
  ];
  if (!tags.length) return NextResponse.json({ error: "Send a storeId or slug." }, { status: 400 });
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: tags });
}
