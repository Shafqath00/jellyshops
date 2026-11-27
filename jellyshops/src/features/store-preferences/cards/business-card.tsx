import type { SocialPlatform } from "@jelly/storefront-schema";

/** Lists shared by Business details (Settings > General) and social links (Site preferences > Branding). */
export const BUSINESS_LANGUAGES = [
  { value: "en", label: "English" }, { value: "en-GB", label: "English (UK)" }, { value: "en-US", label: "English (US)" },
  { value: "fr", label: "French" }, { value: "de", label: "German" }, { value: "es", label: "Spanish" }, { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" }, { value: "pt", label: "Portuguese" }, { value: "hi", label: "Hindi" },
];
export const BUSINESS_COUNTRIES = [
  ["", "Choose a country"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["US", "United States"], ["CA", "Canada"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["IN", "India"], ["FR", "France"], ["DE", "Germany"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"], ["PT", "Portugal"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["NO", "Norway"], ["CH", "Switzerland"], ["AT", "Austria"], ["PL", "Poland"], ["AE", "United Arab Emirates"], ["SG", "Singapore"],
].map(([value, label]) => ({ value, label }));

export const SOCIAL_LABEL: Record<SocialPlatform, { label: string; example: string }> = {
  instagram: { label: "Instagram", example: "https://instagram.com/yourshop" },
  facebook: { label: "Facebook", example: "https://facebook.com/yourshop" },
  x: { label: "X (Twitter)", example: "https://x.com/yourshop" },
  youtube: { label: "YouTube", example: "https://youtube.com/@yourshop" },
  tiktok: { label: "TikTok", example: "https://tiktok.com/@yourshop" },
  pinterest: { label: "Pinterest", example: "https://pinterest.com/yourshop" },
  linkedin: { label: "LinkedIn", example: "https://linkedin.com/company/yourshop" },
  threads: { label: "Threads", example: "https://threads.net/@yourshop" },
};

