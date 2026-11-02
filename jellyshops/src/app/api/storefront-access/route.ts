import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, requestAccessToken } from "@/features/storefront-access/access-api";
import { getServerStorefront } from "@/features/storefront/server-storefront";

/**
 * `POST /api/storefront-access` with `{ storeSlug, password }`: checks the password with the
 * backend and keeps the access token in an httpOnly cookie for 30 days. Wrong passwords are 401.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { storeSlug?: unknown; password?: unknown } | null;
  if (!body || typeof body.storeSlug !== "string" || typeof body.password !== "string") return NextResponse.json({ error: "Enter the password." }, { status: 400 });
  const data = await getServerStorefront(body.storeSlug);
  if (!data) return NextResponse.json({ error: "This store isn't here." }, { status: 404 });
  try {
    const token = await requestAccessToken(data.store.id, body.password);
    (await cookies()).set(accessCookieName(data.store.id), token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That password isn't right.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Too many") ? 429 : 401 });
  }
}
