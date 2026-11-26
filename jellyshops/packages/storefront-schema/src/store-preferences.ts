import { z } from "zod";
import {
  GA_ID, GTM_ID, PIXEL_ID, POLICY_KINDS, PREFERENCE_LIMITS as L, SEARCH_CONSOLE_TOKEN, SOCIAL_PLATFORMS, STORE_LANGUAGES,
  STORE_PREFERENCES_VERSION, TITLE_TEMPLATE_KINDS, isSocialUrl, unknownTemplateTokens, type StorePreferences,
} from "./store-preferences-read.js";

/**
 * The strict save-time schema for store preferences. The backend runs it on every save; the admin runs it too, to show
 * the same messages before sending. Every message is written for a shop owner, not a developer.
 */

const plain = (max: number, label: string) => z.string().trim().max(max, `${label} can be up to ${max} characters.`)
  // Control characters and angle brackets never belong in these fields and would only matter to an attacker.
  .refine((value) => !/[\u0000-\u001f\u007f<>]/.test(value), `${label} can't contain < or > or hidden characters.`);

const imageSchema = z.object({
  mediaId: z.string().trim().min(1).max(120),
  url: z.string().trim().max(500).refine((value) => value.startsWith("/") || value.startsWith("https://"), "Choose a photo from your files."),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  alt: plain(200, "Photo description"),
}).strict();

const templateSchema = (kind: (typeof TITLE_TEMPLATE_KINDS)[number]) => plain(L.titleTemplate, "Title template")
  .refine((value) => value.length > 0, "Add a title template, for example {store name}.")
  .superRefine((value, context) => {
    const unknown = unknownTemplateTokens(kind, value);
    if (unknown.length) context.addIssue({ code: "custom", message: `{${unknown[0]}} isn't a word this template can use.` });
    if ((value.match(/\{/g) ?? []).length !== (value.match(/\}/g) ?? []).length) context.addIssue({ code: "custom", message: "Every { needs a matching }." });
  });

const socialSchema = z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform,
  z.string().trim().max(L.socialUrl).refine((value) => isSocialUrl(platform, value), `Use a full https:// link to your ${platform === "x" ? "X" : platform[0].toUpperCase() + platform.slice(1)} page.`),
])) as unknown as Record<(typeof SOCIAL_PLATFORMS)[number], z.ZodString>).strict();

const optionalId = (pattern: RegExp, message: string) => z.string().trim().refine((value) => value === "" || pattern.test(value), message);

export const storePreferencesSchema = z.object({
  version: z.literal(STORE_PREFERENCES_VERSION),
  seo: z.object({
    homeTitle: plain(L.homeTitle, "Homepage title"),
    homeDescription: plain(L.homeDescription, "Homepage description"),
    socialImage: imageSchema.nullable(),
    favicon: imageSchema.nullable(),
    titleTemplates: z.object({
      product: templateSchema("product"), collection: templateSchema("collection"),
      article: templateSchema("article"), page: templateSchema("page"),
    }).strict(),
    allowIndexing: z.boolean(),
    structuredData: z.object({ products: z.boolean(), breadcrumbs: z.boolean(), organization: z.boolean() }).strict(),
    searchConsoleToken: optionalId(SEARCH_CONSOLE_TOKEN, "Paste only the code from Google's tag: the part inside content=\"…\"."),
  }).strict(),
  business: z.object({
    legalName: plain(L.legalName, "Legal business name"),
    phone: plain(L.phone, "Phone number").refine((value) => value === "" || /^\+?[0-9 ()\-.]{6,40}$/.test(value), "Use digits, spaces and an optional + at the start."),
    address: z.object({
      line1: plain(L.addressLine, "Address line 1"), line2: plain(L.addressLine, "Address line 2"),
      city: plain(L.city, "Town or city"), region: plain(L.region, "County, state or region"),
      postalCode: plain(L.postalCode, "Postcode"),
      country: z.string().trim().toUpperCase().refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Choose a country."),
    }).strict(),
    language: z.enum(STORE_LANGUAGES),
    units: z.enum(["metric", "imperial"]),
  }).strict(),
  social: socialSchema,
  policies: z.object(Object.fromEntries(POLICY_KINDS.map((kind) => [kind,
    z.string().trim().max(120).refine((value) => value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), "Choose a page."),
  ])) as unknown as Record<(typeof POLICY_KINDS)[number], z.ZodString>).strict(),
  tracking: z.object({
    googleAnalyticsId: optionalId(GA_ID, "A Google Analytics ID looks like G-XXXXXXXXXX."),
    googleTagManagerId: optionalId(GTM_ID, "A Google Tag Manager ID looks like GTM-XXXXXXX."),
    metaPixelId: optionalId(PIXEL_ID, "A Meta Pixel ID is a number of 8 to 20 digits."),
  }).strict(),
  privacy: z.object({
    cookieBanner: z.enum(["off", "required-regions", "everywhere"]),
    cookieMessage: plain(L.cookieMessage, "Cookie message"),
  }).strict(),
  spam: z.object({ contactForm: z.boolean(), newsletter: z.boolean(), accountForms: z.boolean() }).strict(),
}).strict();

/** A field path ("seo.homeTitle") and the owner-friendly message for it. */
export type PreferenceProblem = { path: string; message: string };

export function validateStorePreferences(input: unknown): { ok: true; value: StorePreferences } | { ok: false; problems: PreferenceProblem[] } {
  const parsed = storePreferencesSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data as StorePreferences };
  const problems = parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.code === "invalid_type" || issue.code === "unrecognized_keys" || issue.code === "invalid_value" ? "This value isn't allowed." : issue.message,
  }));
  return { ok: false, problems };
}

/** Which top-level sections differ between two documents (used for the change history). */
export function changedPreferenceSections(before: StorePreferences, after: StorePreferences): string[] {
  return (Object.keys(after) as (keyof StorePreferences)[]).filter((key) => key !== "version" && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
