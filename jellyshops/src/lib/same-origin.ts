/**
 * True when a state-changing request comes from a page of the same site: its Origin header matches the address it was
 * sent to. Browsers always send Origin on POST/PUT/PATCH/DELETE from pages, so a missing one is refused too. Shops
 * share jellyshop.io, so SameSite cookies alone don't stop one shop's pages posting to another (§8 of the tenancy plan).
 */
export function isSameOrigin(request: Request): boolean {
  const sent = request.headers.get("origin");
  if (!sent) return false;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]!.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
  if (!host) return false;
  try {
    return new URL(sent).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}
