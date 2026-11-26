/**
 * Store preferences: the site-wide choices a merchant makes on Settings > Store preferences (search listing, social
 * sharing, business details, policies, tracking, cookies, spam protection). One document per store.
 *
 * This file has no zod on purpose: storefront pages read preferences with `readStorePreferences` and use the template
 * helpers, and store pages must not pull in zod. The strict save-time schema lives in `store-preferences.ts`.
 */

export const STORE_PREFERENCES_VERSION = 1;

/** Limits shown as character counters in the admin and enforced by the save schema. */
export const PREFERENCE_LIMITS = {
  homeTitle: 70,
  homeDescription: 160,
  titleTemplate: 120,
  legalName: 160,
  phone: 40,
  addressLine: 120,
  city: 80,
  region: 80,
  postalCode: 20,
  socialUrl: 300,
  cookieMessage: 300,
  searchConsoleToken: 100,
} as const;

export type PreferenceImage = { mediaId: string; url: string; width: number | null; height: number | null; alt: string };

export type TitleTemplateKind = "product" | "collection" | "article" | "page";
export const TITLE_TEMPLATE_KINDS: readonly TitleTemplateKind[] = ["product", "collection", "article", "page"];

/** Words a title template may use, per kind. `{store name}` works everywhere. */
export const TITLE_TEMPLATE_TOKENS: Record<TitleTemplateKind, readonly string[]> = {
  product: ["product name", "brand", "store name"],
  collection: ["collection name", "store name"],
  article: ["post title", "blog name", "store name"],
  page: ["page title", "store name"],
};

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "x", "youtube", "tiktok", "pinterest", "linkedin", "threads"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
/** Which web addresses count as each platform (the address must be https on one of these hosts or their subdomains). */
export const SOCIAL_HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  x: ["x.com", "twitter.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  pinterest: ["pinterest.com", "pinterest.co.uk", "pin.it"],
  linkedin: ["linkedin.com"],
  threads: ["threads.net", "threads.com"],
};

export const POLICY_KINDS = ["refund", "privacy", "terms", "shipping"] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];
/** The page handles the starter creates for each policy. */
export const DEFAULT_POLICY_HANDLES: Record<PolicyKind, string> = { refund: "returns", privacy: "privacy", terms: "terms", shipping: "shipping" };

export const STORE_LANGUAGES = ["en", "en-GB", "en-US", "fr", "de", "es", "it", "nl", "pt", "hi"] as const;
export type CookieBannerMode = "off" | "required-regions" | "everywhere";

export interface StorePreferences {
  version: typeof STORE_PREFERENCES_VERSION;
  seo: {
    homeTitle: string;
    homeDescription: string;
    socialImage: PreferenceImage | null;
    favicon: PreferenceImage | null;
    titleTemplates: Record<TitleTemplateKind, string>;
    /** When false the whole store asks search engines not to list it (robots noindex, Disallow in robots.txt). */
    allowIndexing: boolean;
    structuredData: { products: boolean; breadcrumbs: boolean; organization: boolean };
    /** The `content` value of Google Search Console's HTML tag (google-site-verification). */
    searchConsoleToken: string;
  };
  business: {
    legalName: string;
    phone: string;
    address: { line1: string; line2: string; city: string; region: string; postalCode: string; country: string };
    language: (typeof STORE_LANGUAGES)[number];
    units: "metric" | "imperial";
  };
  social: Record<SocialPlatform, string>;
  /** Page handles that hold each policy; empty = no page chosen. */
  policies: Record<PolicyKind, string>;
  tracking: { googleAnalyticsId: string; googleTagManagerId: string; metaPixelId: string };
  privacy: { cookieBanner: CookieBannerMode; cookieMessage: string };
  spam: { contactForm: boolean; newsletter: boolean; accountForms: boolean };
}

export const DEFAULT_TITLE_TEMPLATES: Record<TitleTemplateKind, string> = {
  product: "{product name} | {store name}",
  collection: "{collection name} | {store name}",
  article: "{post title} | {store name}",
  page: "{page title} | {store name}",
};

export function defaultStorePreferences(): StorePreferences {
  return {
    version: STORE_PREFERENCES_VERSION,
    seo: {
      homeTitle: "", homeDescription: "", socialImage: null, favicon: null,
      titleTemplates: { ...DEFAULT_TITLE_TEMPLATES }, allowIndexing: true,
      structuredData: { products: true, breadcrumbs: true, organization: true }, searchConsoleToken: "",
    },
    business: { legalName: "", phone: "", address: { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" }, language: "en", units: "metric" },
    social: Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, ""])) as Record<SocialPlatform, string>,
    policies: { ...DEFAULT_POLICY_HANDLES },
    tracking: { googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "" },
    privacy: { cookieBanner: "required-regions", cookieMessage: "" },
    spam: { contactForm: true, newsletter: true, accountForms: true },
  };
}

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback: string, max: number) => typeof value === "string" ? value.slice(0, max) : fallback;
const flag = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
function image(value: unknown): PreferenceImage | null {
  if (!isObject(value) || typeof value.mediaId !== "string" || typeof value.url !== "string") return null;
  if (!value.url.startsWith("/") && !value.url.startsWith("https://")) return null;
  const size = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  return { mediaId: value.mediaId, url: value.url, width: size(value.width), height: size(value.height), alt: text(value.alt, "", 200) };
}
const oneOf = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;

/**
 * Reads a stored document leniently: missing or broken parts fall back to the defaults, so an older or damaged
 * document never stops a store page from drawing. Saving always goes through the strict schema.
 */
export function readStorePreferences(raw: unknown): StorePreferences {
  const base = defaultStorePreferences();
  if (!isObject(raw)) return base;
  const seo = isObject(raw.seo) ? raw.seo : {};
  const templates = isObject(seo.titleTemplates) ? seo.titleTemplates : {};
  const structured = isObject(seo.structuredData) ? seo.structuredData : {};
  const business = isObject(raw.business) ? raw.business : {};
  const address = isObject(business.address) ? business.address : {};
  const social = isObject(raw.social) ? raw.social : {};
  const policies = isObject(raw.policies) ? raw.policies : {};
  const tracking = isObject(raw.tracking) ? raw.tracking : {};
  const privacy = isObject(raw.privacy) ? raw.privacy : {};
  const spam = isObject(raw.spam) ? raw.spam : {};
  const L = PREFERENCE_LIMITS;
  return {
    version: STORE_PREFERENCES_VERSION,
    seo: {
      homeTitle: text(seo.homeTitle, "", L.homeTitle),
      homeDescription: text(seo.homeDescription, "", L.homeDescription),
      socialImage: image(seo.socialImage),
      favicon: image(seo.favicon),
      titleTemplates: Object.fromEntries(TITLE_TEMPLATE_KINDS.map((kind) => [kind, text(templates[kind], base.seo.titleTemplates[kind], L.titleTemplate) || base.seo.titleTemplates[kind]])) as Record<TitleTemplateKind, string>,
      allowIndexing: flag(seo.allowIndexing, true),
      structuredData: { products: flag(structured.products, true), breadcrumbs: flag(structured.breadcrumbs, true), organization: flag(structured.organization, true) },
      searchConsoleToken: text(seo.searchConsoleToken, "", L.searchConsoleToken),
    },
    business: {
      legalName: text(business.legalName, "", L.legalName),
      phone: text(business.phone, "", L.phone),
      address: {
        line1: text(address.line1, "", L.addressLine), line2: text(address.line2, "", L.addressLine),
        city: text(address.city, "", L.city), region: text(address.region, "", L.region),
        postalCode: text(address.postalCode, "", L.postalCode), country: text(address.country, "", 2).toUpperCase(),
      },
      language: oneOf(business.language, STORE_LANGUAGES, "en"),
      units: oneOf(business.units, ["metric", "imperial"] as const, "metric"),
    },
    social: Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => {
      const value = text(social[platform], "", L.socialUrl);
      return [platform, isSocialUrl(platform, value) ? value : ""];
    })) as Record<SocialPlatform, string>,
    policies: Object.fromEntries(POLICY_KINDS.map((kind) => [kind, typeof policies[kind] === "string" ? String(policies[kind]).slice(0, 120) : base.policies[kind]])) as Record<PolicyKind, string>,
    tracking: {
      googleAnalyticsId: GA_ID.test(String(tracking.googleAnalyticsId ?? "")) ? String(tracking.googleAnalyticsId) : "",
      googleTagManagerId: GTM_ID.test(String(tracking.googleTagManagerId ?? "")) ? String(tracking.googleTagManagerId) : "",
      metaPixelId: PIXEL_ID.test(String(tracking.metaPixelId ?? "")) ? String(tracking.metaPixelId) : "",
    },
    privacy: { cookieBanner: oneOf(privacy.cookieBanner, ["off", "required-regions", "everywhere"] as const, "required-regions"), cookieMessage: text(privacy.cookieMessage, "", L.cookieMessage) },
    spam: { contactForm: flag(spam.contactForm, true), newsletter: flag(spam.newsletter, true), accountForms: flag(spam.accountForms, true) },
  };
}

/** Tracking ids are checked against their exact shapes, so nothing but an id can reach a script tag. */
export const GA_ID = /^G-[A-Z0-9]{4,12}$/;
export const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;
export const PIXEL_ID = /^\d{8,20}$/;
export const SEARCH_CONSOLE_TOKEN = /^[A-Za-z0-9_-]{10,100}$/;

export function isSocialUrl(platform: SocialPlatform, value: string): boolean {
  if (!value) return true;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return SOCIAL_HOSTS[platform].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** The `{word}` names used in a template. */
export function templateTokens(template: string): string[] {
  return [...template.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1].trim().toLowerCase());
}

/** Names in a template that this kind of page doesn't know (shown as an error in the admin, refused on save). */
export function unknownTemplateTokens(kind: TitleTemplateKind, template: string): string[] {
  const known = TITLE_TEMPLATE_TOKENS[kind];
  return templateTokens(template).filter((token) => !known.includes(token));
}

/**
 * Fills a title template. Empty values are dropped together with the separator next to them, so
 * "{product name} | {brand} | {store name}" without a brand gives "Oak bed | Harbour", not "Oak bed |  | Harbour".
 */
export function fillTitleTemplate(template: string, values: Record<string, string | null | undefined>): string {
  const lowered = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), (value ?? "").trim()]));
  const parts = template.split(/(\{[^{}]*\})/);
  let out = "";
  for (const part of parts) {
    const token = /^\{([^{}]*)\}$/.exec(part);
    out += token ? lowered[token[1].trim().toLowerCase()] ?? "" : part;
  }
  // Tidy separators left around empty values.
  return out
    .replace(/\s*([|\-–—·:,])\s*(?:\1\s*)+/g, " $1 ")
    .replace(/^\s*[|\-–—·:,]\s*/, "")
    .replace(/\s*[|\-–—·:,]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The search-result title for a page: the page's own SEO title wins, else the store's template. */
export function seoTitleFor(kind: TitleTemplateKind, preferences: Pick<StorePreferences, "seo">, values: Record<string, string | null | undefined>, ownTitle?: string | null): string {
  const own = ownTitle?.trim();
  if (own) return own;
  return fillTitleTemplate(preferences.seo.titleTemplates[kind] || DEFAULT_TITLE_TEMPLATES[kind], values);
}
