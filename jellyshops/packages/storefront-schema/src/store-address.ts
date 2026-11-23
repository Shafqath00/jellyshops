/**
 * Rules for a shop's web address (`<address>.jellyshop.io`). One copy, used by onboarding, "Add another store",
 * Settings and the backend (the backend is the authority). Design: §7 of
 * docs/plans/2026-11-22-subdomain-tenancy-plan.md.
 *
 * Plain data and functions only (no zod), so the proxy and store pages can import it cheaply.
 */

export const STORE_ADDRESS_MIN_LENGTH = 3;
/** Shorter than a DNS label (63) so addresses stay readable and leave room for preview prefixes. */
export const STORE_ADDRESS_MAX_LENGTH = 40;

const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names the platform uses for itself: subdomains, app pages, mail and DNS names. These are never served as shops
 * (the host router refuses them) and can never be chosen.
 */
export const SYSTEM_STORE_ADDRESSES: readonly string[] = [
  "_shop", "about", "abuse", "account", "accounts", "admin", "api", "app", "apps", "assets", "auth", "beta", "billing",
  "blog", "brand", "careers", "cdn", "changelog", "checkout", "contact", "cookies", "dashboard", "demo", "dev",
  "developer", "developers", "dns", "docs", "email", "files", "ftp", "help", "hostmaster", "images", "imap", "img",
  "img-staging", "internal", "invoice", "jelly", "jellylinks", "jellyshop", "legal", "localhost", "login", "logos", "mail", "media",
  "mx", "news", "ns", "ns1", "ns2", "onboarding", "ops", "partners", "pay", "payments", "platform", "platform-admin",
  "pop", "postmaster", "preview", "pricing", "privacy", "qa", "root", "sandbox", "secure", "security", "shop",
  "shop-not-found", "shop-paused", "shops", "sign-in", "signup", "sites", "smtp", "ssl", "staging", "static", "status", "store",
  "store-password", "stores", "support", "system", "templates", "terms", "test", "theme-preview", "themes", "uploads",
  "webmail", "webmaster", "www",
];

/**
 * Payment providers, marketplaces, big brands and official bodies people might imitate. Blocked as a whole address,
 * as any hyphen-separated word of it, and (names of 6+ letters only) at the start or end of it, after folding
 * lookalike characters.
 */
export const BRAND_STORE_ADDRESSES: readonly string[] = [
  // Ordinary words that are also brands (apple, bank, wise, ups) are left out so "apple-tree-bakery" stays possible.
  "adyen", "aliexpress", "amazon", "amex", "applepay", "applestore", "barclays", "dhl", "ebay", "etsy", "facebook",
  "fedex", "gov", "govuk", "google", "googlepay", "halifax", "hmrc", "hsbc", "icloud", "instagram", "klarna", "lloyds",
  "mastercard", "microsoft", "monzo", "natwest", "netflix", "nhs", "paypal", "revolut", "royalmail", "santander",
  "shopify", "squareup", "starling", "stripe", "tiktok", "visa", "whatsapp",
];

/** A short list of offensive words, matched as whole hyphen-separated words (never inside other words). */
export const BLOCKED_WORD_STORE_ADDRESSES: readonly string[] = [
  // Words with an everyday meaning too (cock, dick, fag, prick) are left out.
  "arse", "arsehole", "asshole", "bastard", "bitch", "bollocks", "bullshit", "cunt", "faggot", "fuck", "fucker",
  "fucking", "motherfucker", "nazi", "nigga", "nigger", "paedo", "pedo", "porn", "pussy", "rape", "retard", "shit",
  "slut", "twat", "wank", "wanker", "whore",
];

export type StoreAddressProblem = "length" | "shape" | "letters" | "unavailable";

export type StoreAddressCheck = { ok: true } | { ok: false; problem: StoreAddressProblem; message: string };

const MESSAGES: Record<StoreAddressProblem, string> = {
  length: `Use ${STORE_ADDRESS_MIN_LENGTH} to ${STORE_ADDRESS_MAX_LENGTH} characters.`,
  shape: "Use lowercase letters, numbers and single hyphens.",
  letters: "Include at least one letter.",
  // Never says why, so the lists can't be probed.
  unavailable: "This address isn't available. Try another.",
};

/** Folds characters people swap to imitate a name: 0→o, 1/l→i, 3→e, 4→a, 5→s, 7→t, rn→m, vv→w; hyphens removed. */
export function foldLookalikes(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, "")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[0134578l]/g, (char) => ({ "0": "o", "1": "i", l: "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" })[char] ?? char);
}

const SYSTEM = new Set(SYSTEM_STORE_ADDRESSES);
const BRANDS = BRAND_STORE_ADDRESSES.map(foldLookalikes);
const BRAND_SET = new Set(BRANDS);
const LONG_BRANDS = BRANDS.filter((brand) => brand.length >= 6);
const BLOCKED_WORDS = new Set(BLOCKED_WORD_STORE_ADDRESSES.map(foldLookalikes));

/** True when the address is one the platform uses itself. */
export function isSystemStoreAddress(address: string): boolean {
  return SYSTEM.has(address.toLowerCase());
}

function isBlockedName(address: string): boolean {
  if (isSystemStoreAddress(address)) return true;
  const folded = foldLookalikes(address);
  const words = address.split("-").map(foldLookalikes);
  if (BRAND_SET.has(folded) || words.some((word) => BRAND_SET.has(word))) return true;
  if (LONG_BRANDS.some((brand) => folded.startsWith(brand) || folded.endsWith(brand))) return true;
  return BLOCKED_WORDS.has(folded) || words.some((word) => BLOCKED_WORDS.has(word));
}

/** Checks an address a merchant wants to use. Run it on the normalised value. */
export function checkStoreAddress(address: string): StoreAddressCheck {
  const fail = (problem: StoreAddressProblem): StoreAddressCheck => ({ ok: false, problem, message: MESSAGES[problem] });
  if (address.length < STORE_ADDRESS_MIN_LENGTH || address.length > STORE_ADDRESS_MAX_LENGTH) return fail("length");
  if (!SHAPE.test(address)) return fail("shape");
  if (!/[a-z]/.test(address)) return fail("letters");
  if (address.startsWith("xn--") || isBlockedName(address)) return fail("unavailable");
  return { ok: true };
}

/**
 * Turns what someone typed (or a shop name) into an address: lowercase, accents removed, spaces and other characters
 * to single hyphens, trimmed to the maximum length. The result may still fail `checkStoreAddress`.
 */
export function normaliseStoreAddress(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STORE_ADDRESS_MAX_LENGTH)
    .replace(/-+$/g, "");
}
