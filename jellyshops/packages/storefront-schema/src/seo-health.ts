import { POLICY_KINDS, PREFERENCE_LIMITS, type PolicyKind, type StorePreferences } from "./store-preferences-read.js";

/**
 * The SEO health check and the store setup checklist on Settings > Store preferences. Pure rules with no zod: the
 * backend counts what is wrong in the catalogue and content (`RawSeoCheck`), and this file turns those counts and the
 * store's preferences into plain-language checks, a score and a checklist. Wording is for shop owners, not developers.
 */

export type SeoArea = "store" | "products" | "pages" | "posts" | "collections";
export type SeoSeverity = "problem" | "tip";
export type SeoItemKind = "product" | "page" | "post" | "collection";

export interface SeoCheckItem { kind: SeoItemKind; id: string; label: string }
/** What the backend counted: how many things were examined, how many have the problem, and a few examples. */
export interface RawSeoCheck { id: string; total: number; count: number; items: SeoCheckItem[] }

export interface SeoCheck {
  id: string;
  area: SeoArea;
  severity: SeoSeverity;
  total: number;
  count: number;
  /** What is wrong, with the number: "3 products have no description". */
  title: string;
  /** How to fix it. */
  advice: string;
  /** Where to fix it: "#search" (a card on the preferences page) or an admin address. */
  fix: { label: string; href: string } | null;
  items: SeoCheckItem[];
}

interface Def {
  area: SeoArea;
  severity: SeoSeverity;
  weight: number;
  text: (count: number, total: number) => string;
  advice: string;
  fix: { label: string; href: string } | null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const have = (count: number) => (count === 1 ? "has" : "have");

export const SEO_CHECK_DEFS: Record<string, Def> = {
  "store-indexing": { area: "store", severity: "problem", weight: 5, text: () => "Search engines are asked not to list your store", advice: "Turn this back on before you open the store, or nobody will find it on Google.", fix: { label: "Change", href: "#visibility" } },
  "store-description": { area: "store", severity: "problem", weight: 3, text: () => "Your homepage has no description", advice: "Write one or two sentences so shoppers know what you sell before they click.", fix: { label: "Add description", href: "#search" } },
  "store-title": { area: "store", severity: "tip", weight: 1, text: () => "Your homepage title is just your store name", advice: "Add what you sell, for example “Handmade oak beds | Harbour Home”.", fix: { label: "Add title", href: "#search" } },
  "store-share-image": { area: "store", severity: "tip", weight: 1, text: () => "No sharing image", advice: "Without one, sites pick a random photo when your store is shared. Add a wide 1200 × 630 picture.", fix: { label: "Add image", href: "#sharing" } },
  "store-favicon": { area: "store", severity: "tip", weight: 1, text: () => "No browser tab icon", advice: "A small square icon makes your store easy to spot in tabs and bookmarks.", fix: { label: "Add icon", href: "#sharing" } },
  "store-structured-products": { area: "store", severity: "tip", weight: 1, text: () => "Product details for search results are switched off", advice: "They let Google show price and stock under your products. Recommended.", fix: { label: "Switch on", href: "#visibility" } },
  "store-search-console": { area: "store", severity: "tip", weight: 1, text: () => "Not connected to Google Search Console", advice: "It shows which searches bring shoppers to you and flags problems Google finds.", fix: { label: "Connect", href: "#visibility" } },
  "product-no-description": { area: "products", severity: "problem", weight: 3, text: (n) => `${plural(n, "product", "products")} ${have(n)} no description`, advice: "Search results show the start of your description. Describe what it is, who it's for and what it's made of.", fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "product-no-photo": { area: "products", severity: "problem", weight: 2, text: (n) => `${plural(n, "product", "products")} ${have(n)} no photo`, advice: "Products with photos are shared and found far more often.", fix: { label: "See products", href: "/admin/products" } },
  "product-photo-alt": { area: "products", severity: "problem", weight: 2, text: (n, total) => `${plural(n, "product photo", "product photos")} of ${total} ${have(n)} no description`, advice: "Describe each photo in a few words. It helps people using screen readers and image search.", fix: { label: "See products", href: "/admin/products" } },
  "product-duplicate-title": { area: "products", severity: "problem", weight: 2, text: (n) => `${plural(n, "product", "products")} share a search title with another`, advice: "Give each product its own title so search engines can tell them apart.", fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "product-title-long": { area: "products", severity: "tip", weight: 1, text: (n) => `${plural(n, "product search title", "product search titles")} ${n === 1 ? "is" : "are"} too long`, advice: `Google cuts titles after about ${PREFERENCE_LIMITS.homeTitle} characters.`, fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "product-description-long": { area: "products", severity: "tip", weight: 1, text: (n) => `${plural(n, "product search description", "product search descriptions")} ${n === 1 ? "is" : "are"} too long`, advice: `Google cuts descriptions after about ${PREFERENCE_LIMITS.homeDescription} characters.`, fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "page-no-description": { area: "pages", severity: "problem", weight: 2, text: (n) => `${plural(n, "page", "pages")} ${have(n)} no search description`, advice: "Add a sentence saying what the page is about.", fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "post-no-description": { area: "posts", severity: "problem", weight: 2, text: (n) => `${plural(n, "blog post", "blog posts")} ${have(n)} no summary or search description`, advice: "A short summary is shown in search results and when the post is shared.", fix: { label: "Edit in bulk", href: "/admin/settings/preferences/seo" } },
  "collection-no-description": { area: "collections", severity: "tip", weight: 1, text: (n) => `${plural(n, "collection", "collections")} ${have(n)} no description`, advice: "A description helps shoppers and search engines understand the collection.", fix: { label: "See collections", href: "/admin/products/collections" } },
};

/** Checks about the store as a whole, worked out from its saved preferences. */
export function storeSeoChecks(preferences: StorePreferences): RawSeoCheck[] {
  const seo = preferences.seo;
  const failing: Record<string, boolean> = {
    "store-indexing": !seo.allowIndexing,
    "store-description": !seo.homeDescription.trim(),
    "store-title": !seo.homeTitle.trim(),
    "store-share-image": !seo.socialImage,
    "store-favicon": !seo.favicon,
    "store-structured-products": !seo.structuredData.products,
    "store-search-console": !seo.searchConsoleToken,
  };
  return Object.entries(failing).map(([id, bad]) => ({ id, total: 1, count: bad ? 1 : 0, items: [] }));
}

/** Turns counts into checks with plain wording. Unknown ids are ignored; checks that examined nothing are left out. */
export function buildSeoChecks(raw: RawSeoCheck[]): SeoCheck[] {
  return raw.flatMap((entry) => {
    const def = SEO_CHECK_DEFS[entry.id];
    if (!def || entry.total <= 0) return [];
    return [{ id: entry.id, area: def.area, severity: def.severity, total: entry.total, count: entry.count, title: def.text(entry.count, entry.total), advice: def.advice, fix: def.fix, items: entry.items }];
  });
}

/** 0 to 100. Each check costs its weight times the share of things affected, so one bad product costs less than all. */
export function seoScore(checks: SeoCheck[]): number {
  let weights = 0, penalty = 0;
  for (const check of checks) {
    const weight = SEO_CHECK_DEFS[check.id]?.weight ?? 1;
    weights += weight;
    penalty += weight * Math.min(1, check.count / check.total);
  }
  return weights === 0 ? 100 : Math.round(100 - (penalty / weights) * 100);
}

export function seoGrade(score: number): { label: string; tone: "success" | "info" | "warning" | "critical" } {
  if (score >= 90) return { label: "Great", tone: "success" };
  if (score >= 75) return { label: "Good", tone: "info" };
  if (score >= 50) return { label: "Needs work", tone: "warning" };
  return { label: "Poor", tone: "critical" };
}

/** Problems first, then tips; biggest share affected first. */
export function sortSeoChecks(checks: SeoCheck[]): SeoCheck[] {
  const severity = { problem: 0, tip: 1 } as const;
  return [...checks].sort((a, b) => severity[a.severity] - severity[b.severity] || (SEO_CHECK_DEFS[b.id]?.weight ?? 1) - (SEO_CHECK_DEFS[a.id]?.weight ?? 1) || b.count / b.total - a.count / a.total);
}

/* ---------- Store setup checklist ---------- */

export type PolicyState = "published" | "draft" | "missing" | "unset";
export interface SetupContext { contactEmail: string | null; policies: Record<PolicyKind, PolicyState> }
export interface SetupItem { id: string; label: string; help: string; done: boolean; optional: boolean; href: string }

const POLICY_NAMES: Record<PolicyKind, string> = { refund: "refund policy", privacy: "privacy policy", terms: "terms of service", shipping: "shipping policy" };
const POLICY_STATE_HELP: Record<PolicyState, string> = {
  published: "", draft: "It's still a draft, so shoppers can't read it. Publish it.", missing: "The chosen page no longer exists.", unset: "Create it from our starter wording, then read and edit it.",
};

/** What is still left to set up on this page. Optional items don't count towards the progress. */
export function setupChecklist(preferences: StorePreferences, context: SetupContext): SetupItem[] {
  const { business, social, tracking, privacy, seo } = preferences;
  const address = business.address;
  const hasTools = Boolean(tracking.googleAnalyticsId || tracking.googleTagManagerId || tracking.metaPixelId);
  const items: SetupItem[] = [
    { id: "contact-email", label: "Add a contact email", help: "Shoppers' replies to order emails go here.", done: Boolean(context.contactEmail), optional: false, href: "/admin/settings/general" },
    { id: "legal-name", label: "Add your legal business name", help: "Used on policies and invoices.", done: Boolean(business.legalName.trim()), optional: false, href: "#business" },
    { id: "address", label: "Add your business address", help: "Many countries require it on your legal pages.", done: Boolean(address.line1.trim() && address.city.trim() && address.country), optional: false, href: "#business" },
    { id: "phone", label: "Add a phone number", help: "Shown to search engines and on your contact page.", done: Boolean(business.phone.trim()), optional: true, href: "#business" },
    { id: "home-listing", label: "Write your homepage title and description", help: "They're what shoppers read on Google.", done: Boolean(seo.homeTitle.trim() && seo.homeDescription.trim()), optional: false, href: "#search" },
    { id: "share-image", label: "Add a sharing image", help: "The picture shown when your store is shared.", done: Boolean(seo.socialImage), optional: false, href: "#sharing" },
    { id: "favicon", label: "Add a browser tab icon", help: "A small square picture for tabs and bookmarks.", done: Boolean(seo.favicon), optional: false, href: "#sharing" },
    ...POLICY_KINDS.map((kind): SetupItem => ({
      id: `policy-${kind}`, label: `Publish your ${POLICY_NAMES[kind]}`, help: POLICY_STATE_HELP[context.policies[kind]] || "Shown in your footer and checkout.",
      done: context.policies[kind] === "published", optional: kind === "shipping", href: "#policies",
    })),
    { id: "social", label: "Add a social media link", help: "Shown in your footer and to search engines.", done: Object.values(social).some(Boolean), optional: true, href: "#social" },
    { id: "analytics", label: "Connect analytics", help: "See how shoppers find and use your store.", done: hasTools, optional: true, href: "#tracking" },
    { id: "search-console", label: "Connect Google Search Console", help: "See which searches bring shoppers to you.", done: Boolean(seo.searchConsoleToken), optional: true, href: "#visibility" },
  ];
  // Tracking without a cookie banner can break the law in the UK and EU, so it becomes a task.
  if (hasTools && privacy.cookieBanner === "off") items.push({ id: "cookie-banner", label: "Turn on the cookie banner", help: "Your analytics set cookies, which need shoppers' consent in many countries.", done: false, optional: false, href: "#privacy" });
  return items;
}

/** How much of the required setup is done. */
export function setupProgress(items: SetupItem[]): { done: number; total: number; percent: number } {
  const required = items.filter((item) => !item.optional);
  const done = required.filter((item) => item.done).length;
  return { done, total: required.length, percent: required.length ? Math.round((done / required.length) * 100) : 100 };
}
