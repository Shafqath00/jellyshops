import { markets, type SetupMarket } from "@/features/auth/api/onboarding-api";

/** What the "Add another store" form sends. */
export interface NewStoreInput { name: string; slug: string; country: SetupMarket; design: string }
export interface CreatedStore { id: string; slug: string; name: string }

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A web address made from the store name (same rule as onboarding). */
export function slugFromName(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").slice(0, 63).replace(/-$/, "");
}

/** Problems that stop the form, in plain words, by field. */
export function newStoreProblems(input: NewStoreInput): Partial<Record<keyof NewStoreInput, string>> {
  const problems: Partial<Record<keyof NewStoreInput, string>> = {};
  if (!input.name.trim()) problems.name = "Enter a store name.";
  if (input.slug.length < 3 || input.slug.length > 63 || !SLUG_PATTERN.test(input.slug)) problems.slug = "Use 3 to 63 lowercase letters, numbers and single hyphens.";
  if (!markets[input.country]) problems.country = "Choose where the business is based.";
  return problems;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

/** Is this web address free? Uses the same check as onboarding. */
export async function isAddressFree(apiOrigin: string, token: string, slug: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${apiOrigin}/api/onboarding/availability?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response, "Could not check the web address."));
  return Boolean((await response.json() as { available?: boolean }).available);
}

/**
 * Creates the store under the signed-in merchant, then installs the chosen design (when one is chosen).
 * A failed design install leaves the store in place; `designInstalled` says whether it worked.
 */
export async function createStore(apiOrigin: string, token: string, input: NewStoreInput): Promise<{ store: CreatedStore; designInstalled: boolean }> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const response = await fetch(`${apiOrigin}/api/stores`, {
    method: "POST", headers,
    body: JSON.stringify({ name: input.name.trim(), slug: input.slug, country: input.country, currency: markets[input.country].currency }),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not create the store. Try again."));
  const { store } = await response.json() as { store: CreatedStore };
  if (!input.design) return { store, designInstalled: false };
  const installed = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(store.id)}/storefront/starters/${encodeURIComponent(input.design)}/install`, { method: "POST", headers })
    .then((result) => result.ok).catch(() => false);
  return { store, designInstalled: installed };
}
