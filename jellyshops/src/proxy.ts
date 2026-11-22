import { NextResponse, type NextRequest } from "next/server";
import { decideStoreAccess } from "@/features/storefront-access/access-gate";

/**
 * Runs before store pages are served. Today it only does the storefront password check (see
 * `features/storefront-access/access-gate.ts`); keep other concerns in their own modules and call them from here, as
 * Next allows one proxy file per app.
 */
export async function proxy(request: NextRequest) {
  const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const decision = await decideStoreAccess(request.nextUrl.pathname, (name) => request.cookies.get(name)?.value, { origin });
  if (decision.kind === "password") {
    const response = NextResponse.rewrite(new URL(`/store-password/${decision.slug}`, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (decision.kind === "pass-private") {
    // An unlocked visit to a protected store must never be kept by a shared cache.
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Store pages only: not the app's own folders, Next's files or anything with a file extension.
  matcher: ["/((?!_next/|api/|admin|auth/|login|signup|onboarding|changelog|theme-preview|themes/|store-password/|.*\\..*).+)"],
};
