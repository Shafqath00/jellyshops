import type { PublicStorefrontPublication } from "./public-storefront-api";
import { loadStorefrontRouteValues, serializeRouteValues, type PublicStorefrontResource, type StorefrontRouteRequest } from "./resource-loader";

/**
 * Custom-field values for a page's sections, looked up on the server so the page is complete in the first HTML.
 * Only the resource's type and id matter here; the client page builds the full resource itself.
 */
export async function serverRouteValues(
  publication: PublicStorefrontPublication | null | undefined,
  route: StorefrontRouteRequest,
  resource: Pick<PublicStorefrontResource, "type" | "id" | "handle"> | null,
): Promise<Array<[string, unknown]>> {
  if (publication?.kind !== "v4") return [];
  const full: PublicStorefrontResource | null = resource ? { ...resource, visible: true, data: {} } : null;
  return serializeRouteValues(await loadStorefrontRouteValues(publication.snapshot, route, full));
}
