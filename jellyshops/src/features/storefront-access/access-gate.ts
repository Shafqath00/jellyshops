/**
 * The password check for store pages, run by `src/proxy.ts` before a page is served.
 *
 * Store pages are cached and shared by every shopper, so they can't read a shopper's cookie themselves. Instead this
 * gate runs first: an open store passes straight through; on a password-protected store a shopper without a valid
 * access token is shown the password page (rewritten to `/store-password/<slug>`, the address stays the same).
 *
 * The backend is asked at most once a minute per store (and per token), and the answers are kept in this server's
 * memory. If the backend can't be reached the store stays open, as before.
 */
import { accessCookieName } from "./access-api";

/** Top-level app folders and files that are not stores. Keep in step with the backend's RESERVED_STORE_SLUGS. */
const NOT_STORES = new Set(["admin", "api", "auth", "changelog", "login", "signup", "onboarding", "theme-preview", "themes", "store-password", "_next"]);
const CACHE_MS = 60_000;
const MAX_ENTRIES = 5_000;

export type GateDecision = { kind: "pass" } | { kind: "pass-private" } | { kind: "password"; slug: string } | { kind: "moved"; slug: string } | { kind: "paused" };
/** `paused`: the shop's plan ended or payment stopped (billing), so the storefront shows "temporarily unavailable". */
interface StoreAccess { storeId: string; protected: boolean; paused: boolean }
/** A shop address that changed: where the shop is now. */
interface MovedStore { movedTo: string }
type Lookup = (url: string, headers?: Record<string, string>) => Promise<Response>;

const stores = new Map<string, { at: number; value: StoreAccess | MovedStore | null }>();
const tokens = new Map<string, { at: number; value: boolean }>();

function remember<T>(map: Map<string, { at: number; value: T }>, key: string, value: T) {
  if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value as string);
  map.set(key, { at: Date.now(), value });
}
function recall<T>(map: Map<string, { at: number; value: T }>, key: string): { value: T } | undefined {
  const entry = map.get(key);
  return entry && Date.now() - entry.at < CACHE_MS ? { value: entry.value } : undefined;
}

/** The store slug a path belongs to, or null for app pages, files and the home page. */
export function storeSlugFromPath(pathname: string): string | null {
  const first = pathname.split("/")[1] ?? "";
  if (!first || NOT_STORES.has(first) || first.includes(".")) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(first) ? first : null;
}

async function storeAccess(slug: string, origin: string, lookup: Lookup): Promise<StoreAccess | MovedStore | null> {
  const known = recall(stores, slug);
  if (known) return known.value;
  const details = await lookup(`${origin}/api/public/storefronts/${encodeURIComponent(slug)}`);
  // A missing store: either it changed its address (redirect) or the page itself shows "not found".
  if (details.status === 404) {
    const moved = await lookup(`${origin}/api/public/slugs/${encodeURIComponent(slug)}`).catch(() => null);
    const movedTo = moved?.ok ? ((await moved.json()) as { slug?: string }).slug : undefined;
    const value = movedTo && movedTo !== slug ? { movedTo } : null;
    remember(stores, slug, value);
    return value;
  }
  if (!details.ok) throw new Error("store lookup failed");
  const storeId = ((await details.json()) as { store?: { id?: string } }).store?.id;
  if (!storeId) throw new Error("store lookup failed");
  const status = await lookup(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/storefront/access/status`);
  if (!status.ok) throw new Error("status failed");
  const body = (await status.json()) as { protected?: boolean; paused?: boolean };
  const value = { storeId, protected: body.protected === true, paused: body.paused === true };
  remember(stores, slug, value);
  return value;
}

async function tokenUnlocks(storeId: string, token: string, origin: string, lookup: Lookup): Promise<boolean> {
  const key = `${storeId}:${token}`;
  const known = recall(tokens, key);
  if (known) return known.value;
  const response = await lookup(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/storefront/access/status`, { "x-storefront-access": token });
  if (!response.ok) throw new Error("status failed");
  const value = ((await response.json()) as { unlocked?: boolean }).unlocked === true;
  remember(tokens, key, value);
  return value;
}

export async function decideStoreAccess(
  pathname: string,
  readCookie: (name: string) => string | undefined,
  options: { origin: string; lookup?: Lookup },
): Promise<GateDecision> {
  const slug = storeSlugFromPath(pathname);
  if (!slug) return { kind: "pass" };
  const lookup: Lookup = options.lookup ?? ((url, headers) => fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(3000) }));
  try {
    const access = await storeAccess(slug, options.origin, lookup);
    if (access && "movedTo" in access) return { kind: "moved", slug: access.movedTo };
    if (access?.paused) return { kind: "paused" };
    if (!access?.protected) return { kind: "pass" };
    const token = readCookie(accessCookieName(access.storeId));
    if (token && await tokenUnlocks(access.storeId, token, options.origin, lookup)) return { kind: "pass-private" };
    return { kind: "password", slug };
  } catch {
    return { kind: "pass" };
  }
}

/** For tests: forget what the gate remembered. */
export function resetAccessGate() { stores.clear(); tokens.clear(); }
