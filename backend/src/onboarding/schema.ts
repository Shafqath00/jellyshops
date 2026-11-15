import { isStarterPackId } from "@jelly/storefront-themes";
import { z } from "zod";
import { storeSlugSchema } from "../tenants/store-slug.js";

export const onboardingStepSchema = z.enum(["profile", "store", "branding", "business", "products", "review"]);
export const imageKindSchema = z.enum(["profile", "logo"]);
export type OnboardingImageKind = z.infer<typeof imageKindSchema>;

const country = z.enum(["IN", "GB", "US"]);
// Any installable store design (built-in or folder theme), checked against the starter packs.
const theme = z.string().trim().max(100).refine(isStarterPackId, "Choose one of the store designs.");
/** How the merchant sells today (onboarding step "How do you sell today?"). Stored in the draft answers only. */
export const sellingChannels = ["starting", "own-website", "marketplace", "social", "in-person", "wholesale"] as const;
const priceMinor = z.number().int().min(0).max(2_147_483_647);
const stock = z.number().int().min(0).max(2_147_483_647);
const productShape = { title: z.string().trim().min(1).max(120), priceMinor, stock: stock.optional() };

export const storeDescriptionSchema = z.string().trim().max(500);
export const storeCategorySchema = z.string().trim().max(100);
export const businessTypeSchema = z.string().trim().max(100);
export const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(500).optional().default(""),
}).strict();

function optionalText(max: number) {
  return z.string().trim().max(max).nullish().transform(value => value || undefined);
}

const draftAnswers = z.object({
  fullName: optionalText(120),
  bio: optionalText(500),
  name: optionalText(120),
  slug: optionalText(100),
  description: optionalText(500),
  category: optionalText(100),
  theme: theme.nullish().transform(value => value ?? undefined),
  country: z.union([country, z.literal("")]).nullish().transform(value => value || undefined),
  businessType: optionalText(100),
  contactEmail: optionalText(320),
  timezone: optionalText(100),
  sellingChannels: z.array(z.enum(sellingChannels)).max(sellingChannels.length).optional(),
  productCategories: z.array(z.string().trim().max(80)).max(10).optional(),
  product: z.object({ title: z.string().trim().max(120).optional(), priceMinor: priceMinor.optional(), stock: stock.optional() }).strict().nullish(),
}).strict();

export const onboardingRevisionSchema = z.object({ revision: z.number().int().min(0).max(2_147_483_646) }).strict();
export const saveOnboardingSchema = onboardingRevisionSchema.extend({ step: onboardingStepSchema, answers: draftAnswers });
export const acceptConsentSchema = z.object({ version: z.string().trim().min(1).max(100) }).strict();
export type DraftOnboardingAnswers = z.infer<typeof draftAnswers>;
export type SaveOnboarding = z.infer<typeof saveOnboardingSchema>;

export function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const completeOnboardingSchema = z.object({
  ...draftAnswers.shape,
  fullName: profileSchema.shape.fullName,
  name: z.string().trim().min(1).max(120),
  slug: storeSlugSchema,
  theme: theme.default("jelly-signature"),
  country,
  contactEmail: z.email().max(320).optional(),
  timezone: z.string().refine(validTimezone, "Choose a valid timezone.").optional(),
  productCategories: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  product: z.preprocess(value => value && typeof value === "object" && !Array.isArray(value)
    && Object.values(value).every(field => field === undefined || field === "") ? null : value,
  z.object(productShape).strict().nullish()),
}).strict();

export type CompleteOnboardingAnswers = z.infer<typeof completeOnboardingSchema>;
