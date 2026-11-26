import { consentRequiredFor } from "@/features/storefront/consent-regions";

/**
 * Whether this visitor is somewhere that needs cookie consent before analytics and ads (UK, EU/EEA, Switzerland and
 * similar). Read from the hosting platform's country header; when it is missing the answer is "yes" (the safe side).
 * Kept apart from store pages so those stay cached and shared.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? null;
  return Response.json({ consentRequired: consentRequiredFor(country) }, { headers: { "Cache-Control": "private, no-store" } });
}
