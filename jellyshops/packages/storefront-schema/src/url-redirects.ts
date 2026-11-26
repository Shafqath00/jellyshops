/**
 * URL redirects a merchant adds by hand (Settings > Store preferences > Redirects): an old address on their store that
 * should send shoppers somewhere else. They only apply when the old address no longer shows a page, so a redirect can
 * never hide a live page. Plain rules, no zod: the admin and the backend share them.
 */

export const MAX_REDIRECT_PATH = 300;
export const MAX_REDIRECT_TARGET = 500;
export const MAX_REDIRECTS_PER_STORE = 5000;

/** Addresses a redirect may not start from: the home page and pages the platform always draws. */
const PROTECTED_PATHS = ["/", "/cart", "/checkout", "/search", "/account", "/sitemap.xml", "/robots.txt"];

/**
 * Turns what a merchant typed into the stored form of an old address: a path starting with "/", without the store's
 * own domain, without a trailing slash and without "#…". A query string is kept ("/old?colour=red").
 * Full addresses on another site give null.
 */
export function normaliseRedirectFrom(input: string, ownHosts: readonly string[] = []): string | null {
  let value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { return null; }
    if (!ownHosts.map((host) => host.toLowerCase()).includes(url.host.toLowerCase())) return null;
    value = url.pathname + url.search;
  }
  value = value.split("#")[0];
  if (!value.startsWith("/")) value = `/${value}`;
  const [path, query] = splitQuery(value);
  let clean = path.replace(/\/{2,}/g, "/");
  if (clean.length > 1) clean = clean.replace(/\/+$/, "");
  try { clean = encodeURI(decodeURI(clean)); } catch { return null; }
  return query ? `${clean}?${query}` : clean;
}

/** The stored form of a destination: a store path ("/collections/beds") or a full https address. */
export function normaliseRedirectTo(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  }
  if (value.startsWith("//")) return null;
  return normaliseRedirectFrom(value.startsWith("/") ? value : `/${value}`);
}

function splitQuery(value: string): [string, string] {
  const index = value.indexOf("?");
  return index === -1 ? [value, ""] : [value.slice(0, index), value.slice(index + 1)];
}

/** The problem with one redirect, in plain words, or null when it can be saved. */
export function redirectProblem(fromInput: string, toInput: string, ownHosts: readonly string[] = []): string | null {
  if (!fromInput.trim()) return "Add the old address.";
  if (!toInput.trim()) return "Add where it should go.";
  const from = normaliseRedirectFrom(fromInput, ownHosts);
  if (!from) return "The old address must be on your store, for example /old-page.";
  if (from.length > MAX_REDIRECT_PATH) return `The old address can be up to ${MAX_REDIRECT_PATH} characters.`;
  if (/[\u0000-\u001f\u007f<>"\s]/.test(from)) return "The old address can't contain spaces, quotes or < >.";
  const [fromPath] = splitQuery(from);
  if (PROTECTED_PATHS.includes(fromPath.toLowerCase()) || fromPath.toLowerCase().startsWith("/checkout/")) return "This address is always a page on your store, so it can't be redirected.";
  const to = normaliseRedirectTo(toInput);
  if (!to) return "Send it to a page on your store (/collections/beds) or a full https:// address.";
  if (to.length > MAX_REDIRECT_TARGET) return `The destination can be up to ${MAX_REDIRECT_TARGET} characters.`;
  if (/[\u0000-\u001f\u007f<>"\s]/.test(to)) return "The destination can't contain spaces, quotes or < >.";
  if (to === from) return "The old address and the destination are the same.";
  return null;
}

/**
 * Whether adding `from → to` to `existing` would make shoppers go round in a circle (a → b → a). Follows at most
 * 20 steps; a longer chain counts as a loop too.
 */
export function createsRedirectLoop(existing: ReadonlyMap<string, string>, from: string, to: string): boolean {
  const map = new Map(existing);
  map.set(from, to);
  let current = to;
  for (let step = 0; step < 20; step += 1) {
    if (current === from) return true;
    const next = map.get(current);
    if (!next) return false;
    current = next;
  }
  return true;
}
